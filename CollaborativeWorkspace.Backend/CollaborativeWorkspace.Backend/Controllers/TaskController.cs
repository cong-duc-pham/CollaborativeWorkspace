using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using CollaborativeWorkspace.Backend.Data;
using CollaborativeWorkspace.Backend.Models;
using CollaborativeWorkspace.Backend.DTOs;
using CollaborativeWorkspace.Backend.Filters;
using CollaborativeWorkspace.Backend.Hubs;

namespace CollaborativeWorkspace.Backend.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class TaskController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IHubContext<WorkspaceHub> _hubContext;

        public TaskController(AppDbContext context, IHubContext<WorkspaceHub> hubContext)
        {
            _context = context;
            _hubContext = hubContext;
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

        // 4. Move a task to a different position/column (requires MEMBER access and broadcasts via SignalR)
        [HttpPut("{id}/move")]
        [ProjectAuthorize("MEMBER")]
        public async Task<IActionResult> Move(int id, [FromBody] MoveTaskRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var task = await _context.Tasks
                .Include(t => t.Column)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (task == null)
                return NotFound(new { message = "Không tìm thấy thẻ công việc." });

            int sourceColumnId = task.ColumnId;
            int oldPosition = task.Position;
            int projectId = task.Column.ProjectId;

            // Verify if target column belongs to the same project
            var targetColumn = await _context.Columns.FindAsync(request.TargetColumnId);
            if (targetColumn == null || targetColumn.ProjectId != projectId)
            {
                return BadRequest(new { message = "Cột đích không hợp lệ hoặc không thuộc dự án này." });
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                if (sourceColumnId == request.TargetColumnId)
                {
                    // Case 1: Move within the same column
                    if (oldPosition != request.TargetPosition)
                    {
                        if (oldPosition < request.TargetPosition)
                        {
                            // Shift tasks between oldPosition and newPosition up (decrement position)
                            var tasksToShift = await _context.Tasks
                                .Where(t => t.ColumnId == sourceColumnId && t.Position > oldPosition && t.Position <= request.TargetPosition)
                                .ToListAsync();

                            foreach (var t in tasksToShift)
                            {
                                t.Position--;
                            }
                        }
                        else
                        {
                            // Shift tasks between newPosition and oldPosition down (increment position)
                            var tasksToShift = await _context.Tasks
                                .Where(t => t.ColumnId == sourceColumnId && t.Position >= request.TargetPosition && t.Position < oldPosition)
                                .ToListAsync();

                            foreach (var t in tasksToShift)
                            {
                                t.Position++;
                            }
                        }

                        task.Position = request.TargetPosition;
                        await _context.SaveChangesAsync();
                    }
                }
                else
                {
                    // Case 2: Move to a different column
                    // 1. Shift tasks in source column down (decrement position of subsequent tasks)
                    var sourceSubsequentTasks = await _context.Tasks
                        .Where(t => t.ColumnId == sourceColumnId && t.Position > oldPosition)
                        .ToListAsync();

                    foreach (var t in sourceSubsequentTasks)
                    {
                        t.Position--;
                    }

                    // 2. Shift tasks in target column up (increment position of tasks at or after targetPosition)
                    var targetSubsequentTasks = await _context.Tasks
                        .Where(t => t.ColumnId == request.TargetColumnId && t.Position >= request.TargetPosition)
                        .ToListAsync();

                    foreach (var t in targetSubsequentTasks)
                    {
                        t.Position++;
                    }

                    // 3. Move task
                    task.ColumnId = request.TargetColumnId;
                    task.Position = request.TargetPosition;
                    await _context.SaveChangesAsync();
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                // Broadcast move event to other clients in project group
                string groupName = $"project_{projectId}";
                if (!string.IsNullOrEmpty(request.ConnectionId))
                {
                    await _hubContext.Clients.GroupExcept(groupName, request.ConnectionId)
                        .SendAsync("ReceiveTaskMoved", task.Id, sourceColumnId, request.TargetColumnId, request.TargetPosition);
                }
                else
                {
                    await _hubContext.Clients.Group(groupName)
                        .SendAsync("ReceiveTaskMoved", task.Id, sourceColumnId, request.TargetColumnId, request.TargetPosition);
                }

                return Ok(new { message = "Di chuyển thẻ công việc thành công." });
            }
            catch (Exception)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = "Đã xảy ra lỗi hệ thống trong quá trình di chuyển thẻ công việc." });
            }
        }
    }
}
