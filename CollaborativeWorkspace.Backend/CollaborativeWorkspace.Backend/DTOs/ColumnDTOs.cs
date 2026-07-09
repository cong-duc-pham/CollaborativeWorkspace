using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace CollaborativeWorkspace.Backend.DTOs
{
    public class CreateColumnRequest
    {
        [Required(ErrorMessage = "Tên cột là bắt buộc.")]
        [MaxLength(100, ErrorMessage = "Tên cột không được vượt quá 100 ký tự.")]
        public string Name { get; set; } = string.Empty;
    }

    public class UpdateColumnRequest
    {
        [Required(ErrorMessage = "Tên cột là bắt buộc.")]
        [MaxLength(100, ErrorMessage = "Tên cột không được vượt quá 100 ký tự.")]
        public string Name { get; set; } = string.Empty;
    }

    public class ColumnDto
    {
        public int Id { get; set; }
        public int ProjectId { get; set; }
        public string Name { get; set; } = string.Empty;
        public int Position { get; set; }
        public DateTime CreatedAt { get; set; }
        public List<TaskItemDto> Tasks { get; set; } = new List<TaskItemDto>();
    }

    public class TaskItemDto
    {
        public int Id { get; set; }
        public int ColumnId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Priority { get; set; } = string.Empty;
        public int Position { get; set; }
        public int? AssignedUserId { get; set; }
        public string AssignedUserName { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }
}
