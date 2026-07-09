using Microsoft.EntityFrameworkCore;
using CollaborativeWorkspace.Backend.Models;

namespace CollaborativeWorkspace.Backend.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        public DbSet<User> Users { get; set; } = null!;
        public DbSet<Project> Projects { get; set; } = null!;
        public DbSet<ProjectMember> ProjectMembers { get; set; } = null!;
        public DbSet<Column> Columns { get; set; } = null!;
        public DbSet<TaskItem> Tasks { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // User configuration
            modelBuilder.Entity<User>(entity =>
            {
                entity.HasKey(u => u.Id);
                entity.HasIndex(u => u.Email).IsUnique();
                entity.Property(u => u.Email).IsRequired().HasMaxLength(256);
                entity.Property(u => u.FullName).IsRequired().HasMaxLength(100);
                entity.Property(u => u.PasswordHash).IsRequired().HasMaxLength(500);
            });

            // Project configuration
            modelBuilder.Entity<Project>(entity =>
            {
                entity.HasKey(p => p.Id);
                entity.Property(p => p.Name).IsRequired().HasMaxLength(200);
                entity.Property(p => p.Description).HasMaxLength(1000);
            });

            // ProjectMember configuration (Many-to-Many junction table)
            modelBuilder.Entity<ProjectMember>(entity =>
            {
                entity.HasKey(pm => new { pm.ProjectId, pm.UserId });

                entity.HasOne(pm => pm.Project)
                    .WithMany(p => p.Members)
                    .HasForeignKey(pm => pm.ProjectId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(pm => pm.User)
                    .WithMany(u => u.ProjectMembers)
                    .HasForeignKey(pm => pm.UserId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.Property(pm => pm.Role).IsRequired().HasMaxLength(50);
            });

            // Column configuration
            modelBuilder.Entity<Column>(entity =>
            {
                entity.HasKey(c => c.Id);
                entity.Property(c => c.Name).IsRequired().HasMaxLength(100);
                entity.HasIndex(c => new { c.ProjectId, c.Position }); // Optimize sorting

                entity.HasOne(c => c.Project)
                    .WithMany(p => p.Columns)
                    .HasForeignKey(c => c.ProjectId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // TaskItem configuration
            modelBuilder.Entity<TaskItem>(entity =>
            {
                entity.HasKey(t => t.Id);
                entity.Property(t => t.Title).IsRequired().HasMaxLength(200);
                entity.Property(t => t.Description).HasMaxLength(4000);
                entity.Property(t => t.Priority).IsRequired().HasMaxLength(50);
                entity.HasIndex(t => new { t.ColumnId, t.Position }); // Optimize sorting

                entity.HasOne(t => t.Column)
                    .WithMany(c => c.Tasks)
                    .HasForeignKey(t => t.ColumnId)
                    .OnDelete(DeleteBehavior.Cascade); // Cascade delete: Column deleted => Tasks deleted

                entity.HasOne(t => t.AssignedUser)
                    .WithMany(u => u.AssignedTasks)
                    .HasForeignKey(t => t.AssignedUserId)
                    .OnDelete(DeleteBehavior.SetNull); // SetNull: User deleted => task's assigned user becomes null
            });
        }
    }
}
