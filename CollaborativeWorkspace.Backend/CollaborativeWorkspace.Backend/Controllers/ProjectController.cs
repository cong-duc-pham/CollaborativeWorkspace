using System;
using System.Linq;
using System.Security.Claims;
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
    public class ProjectController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ProjectController(AppDbContext context)
        {
            _context = context;
        }

        // 1. Create a new project
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateProjectRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            int userId = GetCurrentUserId();

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var project = new Project
                {
                    Name = request.Name.Trim(),
                    Description = request.Description?.Trim() ?? string.Empty,
                    CreatedAt = DateTime.UtcNow
                };

                _context.Projects.Add(project);
                await _context.SaveChangesAsync();

                // Assign the creator as ADMIN of the project
                var member = new ProjectMember
                {
                    ProjectId = project.Id,
                    UserId = userId,
                    Role = "ADMIN",
                    JoinedAt = DateTime.UtcNow
                };

                _context.ProjectMembers.Add(member);
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();

                return Ok(new ProjectDto
                {
                    Id = project.Id,
                    Name = project.Name,
                    Description = project.Description,
                    CreatedAt = project.CreatedAt,
                    UserRole = "ADMIN"
                });
            }
            catch (Exception)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = "Đã xảy ra lỗi hệ thống trong quá trình tạo dự án." });
            }
        }

        // 2. Get list of projects the logged-in user participates in
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            int userId = GetCurrentUserId();

            var projects = await _context.ProjectMembers
                .AsNoTracking()
                .Where(pm => pm.UserId == userId)
                .Include(pm => pm.Project)
                .Select(pm => new ProjectDto
                {
                    Id = pm.Project.Id,
                    Name = pm.Project.Name,
                    Description = pm.Project.Description,
                    CreatedAt = pm.Project.CreatedAt,
                    UserRole = pm.Role
                })
                .OrderByDescending(p => p.CreatedAt)
                .ToListAsync();

            return Ok(projects);
        }

        // 3. Get project details (requires VIEWER access)
        [HttpGet("{id}")]
        [ProjectAuthorize("VIEWER")]
        public async Task<IActionResult> GetById(int id)
        {
            int userId = GetCurrentUserId();

            var project = await _context.Projects
                .AsNoTracking()
                .Where(p => p.Id == id)
                .Select(p => new ProjectDto
                {
                    Id = p.Id,
                    Name = p.Name,
                    Description = p.Description,
                    CreatedAt = p.CreatedAt,
                    UserRole = _context.ProjectMembers
                        .Where(pm => pm.ProjectId == id && pm.UserId == userId)
                        .Select(pm => pm.Role)
                        .FirstOrDefault() ?? "VIEWER"
                })
                .FirstOrDefaultAsync();

            if (project == null)
                return NotFound(new { message = "Không tìm thấy dự án." });

            return Ok(project);
        }

        // 4. Add member to project (requires ADMIN access)
        [HttpPost("{projectId}/members")]
        [ProjectAuthorize("ADMIN")]
        public async Task<IActionResult> AddMember(int projectId, [FromBody] AddMemberRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var emailNormalized = request.Email.Trim().ToLower();

            // Find user
            var user = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Email.ToLower() == emailNormalized);

            if (user == null)
                return NotFound(new { message = "Không tìm thấy tài khoản người dùng có Email này." });

            // Check if user is already a member
            bool isAlreadyMember = await _context.ProjectMembers
                .AnyAsync(pm => pm.ProjectId == projectId && pm.UserId == user.Id);

            if (isAlreadyMember)
                return BadRequest(new { message = "Người dùng này đã tham gia dự án rồi." });

            // Add member
            var member = new ProjectMember
            {
                ProjectId = projectId,
                UserId = user.Id,
                Role = request.Role.ToUpper(),
                JoinedAt = DateTime.UtcNow
            };

            _context.ProjectMembers.Add(member);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Thêm thành viên vào dự án thành công." });
        }

        // 5. Get list of project members (requires VIEWER access)
        [HttpGet("{projectId}/members")]
        [ProjectAuthorize("VIEWER")]
        public async Task<IActionResult> GetMembers(int projectId)
        {
            var members = await _context.ProjectMembers
                .AsNoTracking()
                .Where(pm => pm.ProjectId == projectId)
                .Include(pm => pm.User)
                .Select(pm => new ProjectMemberDto
                {
                    UserId = pm.UserId,
                    Email = pm.User.Email,
                    FullName = pm.User.FullName,
                    Role = pm.Role,
                    JoinedAt = pm.JoinedAt
                })
                .OrderBy(m => m.FullName)
                .ToListAsync();

            return Ok(members);
        }

        // 6. Delete member from project (requires ADMIN access)
        [HttpDelete("{projectId}/members/{userId}")]
        [ProjectAuthorize("ADMIN")]
        public async Task<IActionResult> RemoveMember(int projectId, int userId)
        {
            int currentUserId = GetCurrentUserId();

            // Find the member to delete
            var member = await _context.ProjectMembers
                .FirstOrDefaultAsync(pm => pm.ProjectId == projectId && pm.UserId == userId);

            if (member == null)
                return NotFound(new { message = "Thành viên này không tồn tại trong dự án." });

            // Check if attempting to remove the last ADMIN
            if (member.Role == "ADMIN")
            {
                int adminCount = await _context.ProjectMembers
                    .CountAsync(pm => pm.ProjectId == projectId && pm.Role == "ADMIN");

                if (adminCount <= 1)
                {
                    return BadRequest(new { message = "Không thể xóa Admin duy nhất của dự án." });
                }
            }

            _context.ProjectMembers.Remove(member);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Đã xóa thành viên khỏi dự án thành công." });
        }

        private int GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
            {
                throw new InvalidOperationException("User ID not found in token claims.");
            }
            return userId;
        }
    }
}
