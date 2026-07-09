using System;
using System.ComponentModel.DataAnnotations;

namespace CollaborativeWorkspace.Backend.DTOs
{
    public class CreateProjectRequest
    {
        [Required(ErrorMessage = "Tên dự án là bắt buộc.")]
        [MaxLength(200, ErrorMessage = "Tên dự án không được vượt quá 200 ký tự.")]
        public string Name { get; set; } = string.Empty;

        [MaxLength(1000, ErrorMessage = "Mô tả không được vượt quá 1000 ký tự.")]
        public string Description { get; set; } = string.Empty;
    }

    public class AddMemberRequest
    {
        [Required(ErrorMessage = "Email của thành viên là bắt buộc.")]
        [EmailAddress(ErrorMessage = "Định dạng Email không hợp lệ.")]
        public string Email { get; set; } = string.Empty;

        [Required(ErrorMessage = "Vai trò là bắt buộc.")]
        [RegularExpression("^(ADMIN|MEMBER|VIEWER)$", ErrorMessage = "Vai trò phải là ADMIN, MEMBER hoặc VIEWER.")]
        public string Role { get; set; } = "MEMBER";
    }

    public class ProjectDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public string UserRole { get; set; } = string.Empty; // Role of the current user querying the project
    }

    public class ProjectMemberDto
    {
        public int UserId { get; set; }
        public string Email { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public DateTime JoinedAt { get; set; }
    }

    public class UpdateProjectRequest
    {
        [Required(ErrorMessage = "Tên dự án là bắt buộc.")]
        [MaxLength(200, ErrorMessage = "Tên dự án không được vượt quá 200 ký tự.")]
        public string Name { get; set; } = string.Empty;

        [MaxLength(1000, ErrorMessage = "Mô tả không được vượt quá 1000 ký tự.")]
        public string Description { get; set; } = string.Empty;
    }

    public class UpdateMemberRoleRequest
    {
        [Required(ErrorMessage = "Vai trò là bắt buộc.")]
        [RegularExpression("^(ADMIN|MEMBER|VIEWER)$", ErrorMessage = "Vai trò phải là ADMIN, MEMBER hoặc VIEWER.")]
        public string Role { get; set; } = "MEMBER";
    }
}
