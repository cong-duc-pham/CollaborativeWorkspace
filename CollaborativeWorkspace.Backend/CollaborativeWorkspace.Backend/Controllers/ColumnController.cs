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
    public class ColumnController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ColumnController(AppDbContext context)
        {
            _context = context;
        }

        // 1. Get all columns and their nested tasks for a project (ordered by Position)
        [HttpGet("project/{projectId}")]
        [ProjectAuthorize("VIEWER")]
        public async Task<IActionResult> GetByProject(int projectId)
        {
            var columns = await _context.Columns
                .AsNoTracking()
                .Where(c => c.ProjectId == projectId)
                .OrderBy(c => c.Position)
                .Select(c => new ColumnDto
                {
                    Id = c.Id,
                    ProjectId = c.ProjectId,
                    Name = c.Name,
                    Position = c.Position,
                    CreatedAt = c.CreatedAt,
                    Tasks = _context.Tasks
                        .AsNoTracking()
                        .Where(t => t.ColumnId == c.Id)
                        .OrderBy(t => t.Position)
                        .Select(t => new TaskItemDto
                        {
                            Id = t.Id,
                            ColumnId = t.ColumnId,
                            Title = t.Title,
                            Description = t.Description,
                            Priority = t.Priority,
                            Position = t.Position,
                            AssignedUserId = t.AssignedUserId,
                            AssignedUserName = t.AssignedUser != null ? t.AssignedUser.FullName : string.Empty,
                            CreatedAt = t.CreatedAt
                        })
                        .ToList()
                })
                .ToListAsync();

            return Ok(columns);
        }

        // 2. Create a new column in a project
        [HttpPost("project/{projectId}")]
        [ProjectAuthorize("MEMBER")]
        public async Task<IActionResult> Create(int projectId, [FromBody] CreateColumnRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            // Determine the next position
            int maxPosition = await _context.Columns
                .Where(c => c.ProjectId == projectId)
                .Select(c => (int?)c.Position)
                .MaxAsync() ?? -1;

            var column = new Column
            {
                ProjectId = projectId,
                Name = request.Name.Trim(),
                Position = maxPosition + 1,
                CreatedAt = DateTime.UtcNow
            };

            _context.Columns.Add(column);
            await _context.SaveChangesAsync();

            return Ok(new ColumnDto
            {
                Id = column.Id,
                ProjectId = column.ProjectId,
                Name = column.Name,
                Position = column.Position,
                CreatedAt = column.CreatedAt,
                Tasks = new List<TaskItemDto>()
            });
        }

        // 3. Update column name
        [HttpPut("{id}")]
        [ProjectAuthorize("MEMBER")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateColumnRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var column = await _context.Columns.FindAsync(id);
            if (column == null)
                return NotFound(new { message = "Không tìm thấy cột." });

            column.Name = request.Name.Trim();
            await _context.SaveChangesAsync();

            return Ok(new { message = "Cập nhật cột thành công.", columnName = column.Name });
        }

        // 4. Delete column (and automatically delete tasks inside it due to cascade delete)
        [HttpDelete("{id}")]
        [ProjectAuthorize("MEMBER")]
        public async Task<IActionResult> Delete(int id)
        {
            var column = await _context.Columns.FindAsync(id);
            if (column == null)
                return NotFound(new { message = "Không tìm thấy cột." });

            int deletedPosition = column.Position;
            int projectId = column.ProjectId;

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                _context.Columns.Remove(column);
                await _context.SaveChangesAsync();

                // Shift positions of subsequent columns in the same project
                var subsequentColumns = await _context.Columns
                    .Where(c => c.ProjectId == projectId && c.Position > deletedPosition)
                    .ToListAsync();

                foreach (var c in subsequentColumns)
                {
                    c.Position--;
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new { message = "Đã xóa cột và tái cấu trúc lại vị trí các cột khác thành công." });
            }
            catch (Exception)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = "Đã xảy ra lỗi hệ thống trong quá trình xóa cột." });
            }
        }
    }
}
