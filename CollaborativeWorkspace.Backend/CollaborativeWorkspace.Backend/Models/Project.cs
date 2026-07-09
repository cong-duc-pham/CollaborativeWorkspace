using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace CollaborativeWorkspace.Backend.Models
{
    public class Project
    {
        public int Id { get; set; }
        
        public string Name { get; set; } = string.Empty;
        
        public string Description { get; set; } = string.Empty;
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Relationships
        [JsonIgnore]
        public ICollection<ProjectMember> Members { get; set; } = new List<ProjectMember>();
        
        [JsonIgnore]
        public ICollection<Column> Columns { get; set; } = new List<Column>();
    }
}
