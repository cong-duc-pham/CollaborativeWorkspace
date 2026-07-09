using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace CollaborativeWorkspace.Backend.Models
{
    public class User
    {
        public int Id { get; set; }
        
        public string Email { get; set; } = string.Empty;
        
        [JsonIgnore]
        public string PasswordHash { get; set; } = string.Empty;
        
        public string FullName { get; set; } = string.Empty;
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Relationships
        [JsonIgnore]
        public ICollection<ProjectMember> ProjectMembers { get; set; } = new List<ProjectMember>();
        
        [JsonIgnore]
        public ICollection<TaskItem> AssignedTasks { get; set; } = new List<TaskItem>();
    }
}
