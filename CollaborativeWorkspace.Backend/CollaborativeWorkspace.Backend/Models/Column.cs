using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace CollaborativeWorkspace.Backend.Models
{
    public class Column
    {
        public int Id { get; set; }
        
        public int ProjectId { get; set; }
        public Project Project { get; set; } = null!;
        
        public string Name { get; set; } = string.Empty;
        
        public int Position { get; set; }
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Relationships
        [JsonIgnore]
        public ICollection<TaskItem> Tasks { get; set; } = new List<TaskItem>();
    }
}
