using System;

namespace CollaborativeWorkspace.Backend.Models
{
    public class TaskItem
    {
        public int Id { get; set; }
        
        public int ColumnId { get; set; }
        public Column Column { get; set; } = null!;
        
        public string Title { get; set; } = string.Empty;
        
        public string Description { get; set; } = string.Empty;
        
        public string Priority { get; set; } = "MEDIUM"; // LOW, MEDIUM, HIGH
        
        public int Position { get; set; }
        
        public int? AssignedUserId { get; set; }
        public User? AssignedUser { get; set; }
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
