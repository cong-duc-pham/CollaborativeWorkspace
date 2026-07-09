using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CollaborativeWorkspace.Backend.Data;
using CollaborativeWorkspace.Backend.Models;
using CollaborativeWorkspace.Backend.DTOs;
using CollaborativeWorkspace.Backend.Filters;

namespace CollaborativeWorkspace.Backend.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class TaskController : ControllerBase
    {
        private readonly AppDbContext _context;

        public TaskController(AppDbContext context)
        {
            _context = context;
        }

        // 1. Create a task in a specific column
        [HttpPost("column/{columnId}")]
        [ProjectAuthorize("MEMBER")]
        public async Task<IActionResult> Create(int columnId, [FromBody] CreateTaskRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var column = await _context.Columns.FindAsync(columnId);
            if (column == null)
                return NotFound(new { message = "Không tìm thấy cột." });

            // If assignee is specified, verify they are part of the project
            if (request.AssignedUserId.HasValue)
            {
                bool isAssigneeMember = await _context.ProjectMembers
                    .AnyAsync(pm => pm.ProjectId == column.ProjectId && pm.UserId == request.AssignedUserId.Value);

                if (!isAssigneeMember)
                {
                    return BadRequest(new { message = "Người được giao việc phải là thành viên của dự án." });
                }
            }

            // Find the maximum position in the current column
            int maxPosition = await _context.Tasks
                .Where(t => t.ColumnId == columnId)
                .Select(t => (int?)t.Position)
                .MaxAsync() ?? -1;

            var task = new TaskItem
            {
                ColumnId = columnId,
                Title = request.Title.Trim(),
                Description = request.Description?.Trim() ?? string.Empty,
                Priority = request.Priority.ToUpper(),
                Position = maxPosition + 1,
                AssignedUserId = request.AssignedUserId,
                CreatedAt = DateTime.UtcNow
            };

            _context.Tasks.Add(task);
            await _context.SaveChangesAsync();

            // Fetch assigned user name if assigned
            string assignedUserName = string.Empty;
            if (task.AssignedUserId.HasValue)
            {
                assignedUserName = await _context.Users
                    .Where(u => u.Id == task.AssignedUserId.Value)
                    .Select(u => u.FullName)
                    .FirstOrDefaultAsync() ?? string.Empty;
            }

            return Ok(new TaskItemDto
            {
                Id = task.Id,
                ColumnId = task.ColumnId,
                Title = task.Title,
                Description = task.Description,
                Priority = task.Priority,
                Position = task.Position,
                AssignedUserId = task.AssignedUserId,
                AssignedUserName = assignedUserName,
                CreatedAt = task.CreatedAt
            });
        }

        // 2. Update task details
        [HttpPut("{id}")]
        [ProjectAuthorize("MEMBER")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateTaskRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var task = await _context.Tasks
                .Include(t => t.Column)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (task == null)
                return NotFound(new { message = "Không tìm thấy thẻ công việc." });

            // If assignee is specified, verify they are part of the project
            if (request.AssignedUserId.HasValue)
            {
                bool isAssigneeMember = await _context.ProjectMembers
                    .AnyAsync(pm => pm.ProjectId == task.Column.ProjectId && pm.UserId == request.AssignedUserId.Value);

                if (!isAssigneeMember)
                {
                    return BadRequest(new { message = "Người được giao việc phải là thành viên của dự án." });
                }
            }

            task.Title = request.Title.Trim();
            task.Description = request.Description?.Trim() ?? string.Empty;
            task.Priority = request.Priority.ToUpper();
            task.AssignedUserId = request.AssignedUserId;

            await _context.SaveChangesAsync();

            // Fetch assigned user name
            string assignedUserName = string.Empty;
            if (task.AssignedUserId.HasValue)
            {
                assignedUserName = await _context.Users
                    .Where(u => u.Id == task.AssignedUserId.Value)
                    .Select(u => u.FullName)
                    .FirstOrDefaultAsync() ?? string.Empty;
            }

            return Ok(new TaskItemDto
            {
                Id = task.Id,
                ColumnId = task.ColumnId,
                Title = task.Title,
                Description = task.Description,
                Priority = task.Priority,
                Position = task.Position,
                AssignedUserId = task.AssignedUserId,
                AssignedUserName = assignedUserName,
                CreatedAt = task.CreatedAt
            });
        }

        // 3. Delete a task
        [HttpDelete("{id}")]
        [ProjectAuthorize("MEMBER")]
        public async Task<IActionResult> Delete(int id)
        {
            var task = await _context.Tasks.FindAsync(id);
            if (task == null)
                return NotFound(new { message = "Không tìm thấy thẻ công việc." });

            int deletedPosition = task.Position;
            int columnId = task.ColumnId;

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                _context.Tasks.Remove(task);
                await _context.SaveChangesAsync();

                // Shift positions of subsequent tasks in the same column
                var subsequentTasks = await _context.Tasks
                    .Where(t => t.ColumnId == columnId && t.Position > deletedPosition)
                    .ToListAsync();

                foreach (var t in subsequentTasks)
                {
                    t.Position--;
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new { message = "Đã xóa thẻ công việc và tái cấu trúc lại vị trí trong cột thành công." });
            }
            catch (Exception)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = "Đã xảy ra lỗi hệ thống trong quá trình xóa thẻ công việc." });
            }
        }
    }
}
