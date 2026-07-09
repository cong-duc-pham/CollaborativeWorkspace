using System;
using System.ComponentModel.DataAnnotations;

namespace CollaborativeWorkspace.Backend.DTOs
{
    public class CreateTaskRequest
    {
        [Required(ErrorMessage = "Tiêu đề công việc là bắt buộc.")]
        [MaxLength(200, ErrorMessage = "Tiêu đề không được vượt quá 200 ký tự.")]
        public string Title { get; set; } = string.Empty;

        [MaxLength(4000, ErrorMessage = "Mô tả không được vượt quá 4000 ký tự.")]
        public string Description { get; set; } = string.Empty;

        [Required(ErrorMessage = "Độ ưu tiên là bắt buộc.")]
        [RegularExpression("^(LOW|MEDIUM|HIGH)$", ErrorMessage = "Độ ưu tiên phải là LOW, MEDIUM hoặc HIGH.")]
        public string Priority { get; set; } = "MEDIUM";

        public int? AssignedUserId { get; set; }
    }

    public class UpdateTaskRequest
    {
        [Required(ErrorMessage = "Tiêu đề công việc là bắt buộc.")]
        [MaxLength(200, ErrorMessage = "Tiêu đề không được vượt quá 200 ký tự.")]
        public string Title { get; set; } = string.Empty;

        [MaxLength(4000, ErrorMessage = "Mô tả không được vượt quá 4000 ký tự.")]
        public string Description { get; set; } = string.Empty;

        [Required(ErrorMessage = "Độ ưu tiên là bắt buộc.")]
        [RegularExpression("^(LOW|MEDIUM|HIGH)$", ErrorMessage = "Độ ưu tiên phải là LOW, MEDIUM hoặc HIGH.")]
        public string Priority { get; set; } = "MEDIUM";

        public int? AssignedUserId { get; set; }
    }

    public class MoveTaskRequest
    {
        [Required(ErrorMessage = "Cột đích là bắt buộc.")]
        public int TargetColumnId { get; set; }

        [Required(ErrorMessage = "Vị trí đích là bắt buộc.")]
        public int TargetPosition { get; set; }

        public string? ConnectionId { get; set; }
    }
}
