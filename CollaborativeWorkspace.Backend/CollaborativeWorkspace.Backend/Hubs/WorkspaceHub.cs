using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace CollaborativeWorkspace.Backend.Hubs
{
    [Authorize]
    public class WorkspaceHub : Hub
    {
        public async Task JoinProject(int projectId)
        {
            string groupName = $"project_{projectId}";
            await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
        }

        public async Task LeaveProject(int projectId)
        {
            string groupName = $"project_{projectId}";
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
        }
    }
}
