using System;

namespace CollaborativeWorkspace.Backend.Models
{
    public class ProjectMember
    {
        public int ProjectId { get; set; }
        public Project Project { get; set; } = null!;

        public int UserId { get; set; }
        public User User { get; set; } = null!;

        public string Role { get; set; } = "MEMBER"; // ADMIN, MEMBER, VIEWER
        
        public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
    }
}
