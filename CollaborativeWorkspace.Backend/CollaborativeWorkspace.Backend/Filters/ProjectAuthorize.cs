using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using CollaborativeWorkspace.Backend.Data;

namespace CollaborativeWorkspace.Backend.Filters
{
    [AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
    public class ProjectAuthorizeAttribute : TypeFilterAttribute
    {
        public ProjectAuthorizeAttribute(string requiredRole = "VIEWER") : base(typeof(ProjectAuthorizeFilter))
        {
            Arguments = new object[] { requiredRole };
        }
    }

    public class ProjectAuthorizeFilter : IAsyncActionFilter
    {
        private readonly AppDbContext _context;
        private readonly string _requiredRole;

        public ProjectAuthorizeFilter(AppDbContext context, string requiredRole)
        {
            _context = context;
            _requiredRole = requiredRole;
        }

        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            // 1. Get User ID from JWT Claims
            var userIdClaim = context.HttpContext.User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
            {
                context.Result = new ObjectResult(new { message = "Bạn chưa đăng nhập hoặc token không hợp lệ." }) { StatusCode = 401 };
                return;
            }

            // 2. Extract ProjectId from route
            int? projectId = null;

            if (context.RouteData.Values.TryGetValue("projectId", out var projIdObj) && projIdObj != null)
            {
                if (int.TryParse(projIdObj.ToString(), out int parsedId))
                {
                    projectId = parsedId;
                }
            }
            else if (context.RouteData.Values.TryGetValue("id", out var idObj) && idObj != null)
            {
                if (int.TryParse(idObj.ToString(), out int parsedId))
                {
                    var controllerName = context.ActionDescriptor.RouteValues["controller"]?.ToLower();
                    if (controllerName == "project")
                    {
                        projectId = parsedId;
                    }
                    else if (controllerName == "column")
                    {
                        var column = await _context.Columns.AsNoTracking().FirstOrDefaultAsync(c => c.Id == parsedId);
                        if (column != null)
                        {
                            projectId = column.ProjectId;
                        }
                    }
                    else if (controllerName == "task" || controllerName == "taskitem")
                    {
                        var task = await _context.Tasks.AsNoTracking()
                            .Include(t => t.Column)
                            .FirstOrDefaultAsync(t => t.Id == parsedId);
                        if (task != null && task.Column != null)
                        {
                            projectId = task.Column.ProjectId;
                        }
                    }
                }
            }

            if (projectId == null)
            {
                context.Result = new BadRequestObjectResult(new { message = "Không tìm thấy thông tin Project ID." });
                return;
            }

            // 3. Query ProjectMembers to check user membership and role
            var member = await _context.ProjectMembers
                .AsNoTracking()
                .FirstOrDefaultAsync(pm => pm.ProjectId == projectId.Value && pm.UserId == userId);

            if (member == null)
            {
                context.Result = new ObjectResult(new { message = "Bạn không phải là thành viên của dự án này." }) { StatusCode = 403 };
                return;
            }

            // 4. Validate Role Hierarchy
            int userRoleLevel = GetRoleLevel(member.Role);
            int requiredRoleLevel = GetRoleLevel(_requiredRole);

            if (userRoleLevel < requiredRoleLevel)
            {
                context.Result = new ObjectResult(new { 
                    message = $"Quyền hạn của bạn ({member.Role}) không đủ để thực hiện hành động này. Yêu cầu tối thiểu: {_requiredRole}." 
                }) { StatusCode = 403 };
                return;
            }

            // Store member info in HttpContext.Items so controllers can reuse it
            context.HttpContext.Items["ProjectMember"] = member;
            context.HttpContext.Items["ProjectId"] = projectId.Value;
            context.HttpContext.Items["CurrentUserId"] = userId;

            await next();
        }

        private int GetRoleLevel(string role)
        {
            return role.ToUpper() switch
            {
                "ADMIN" => 3,
                "MEMBER" => 2,
                "VIEWER" => 1,
                _ => 0
            };
        }
    }
}
