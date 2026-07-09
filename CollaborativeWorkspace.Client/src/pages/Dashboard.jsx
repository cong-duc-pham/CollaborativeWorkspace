import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api, { SIGNALR_URL } from '../services/api';
import { HubConnectionBuilder } from '@microsoft/signalr';
import { 
  DndContext, 
  MouseSensor,
  TouchSensor, 
  useSensor, 
  useSensors, 
  DragOverlay,
  pointerWithin,
  closestCenter
} from '@dnd-kit/core';
import ColumnComponent from '../components/Board/Column';
import TaskCard from '../components/Board/TaskCard';
import { 
  LayoutDashboard, 
  Plus, 
  Folder, 
  LogOut, 
  UserPlus, 
  Loader2, 
  Trash2,
  ClipboardList,
  X,
  Settings,
  Sun,
  Moon
} from 'lucide-react';

const Dashboard = () => {
  const { user, logout } = useAuth();
  
  // Theme state
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };
  
  // Projects state
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [columns, setColumns] = useState([]);
  const [members, setMembers] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingBoard, setLoadingBoard] = useState(false);

  // SignalR connection ref/state
  const [signalrConnectionId, setSignalrConnectionId] = useState(null);
  const signalrConnectionRef = useRef(null);

  // Active Drag state for DndOverlay
  const [activeDragTask, setActiveDragTask] = useState(null);

  // Column inline creation state
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');

  // Task creation/edit modal state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null); // null for create, task object for edit
  const [targetColumnId, setTargetColumnId] = useState(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState('MEDIUM');
  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [taskModalError, setTaskModalError] = useState('');
  const [savingTask, setSavingTask] = useState(false);

  // Project modal state
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [projectModalError, setProjectModalError] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);

  // Member modal state
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState('MEMBER');
  const [memberModalError, setMemberModalError] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  // Project settings modal state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsProjectName, setSettingsProjectName] = useState('');
  const [settingsProjectDesc, setSettingsProjectDesc] = useState('');
  const [settingsModalError, setSettingsModalError] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [settingsActiveTab, setSettingsActiveTab] = useState('general');

  // DnD sensors
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  // Fetch projects on load
  useEffect(() => {
    fetchProjects();
  }, []);

  // Fetch board and members when active project changes
  useEffect(() => {
    if (activeProject) {
      fetchBoard(activeProject.id);
      fetchMembers(activeProject.id);
      setupSignalRConnection(activeProject.id);
    } else {
      setColumns([]);
      setMembers([]);
      disconnectSignalR();
    }

    return () => {
      disconnectSignalR();
    };
  }, [activeProject]);

  // SignalR Setup
  const setupSignalRConnection = async (projectId) => {
    disconnectSignalR();

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const connection = new HubConnectionBuilder()
        .withUrl(SIGNALR_URL, {
          accessTokenFactory: () => token
        })
        .withAutomaticReconnect()
        .build();

      connection.on('ReceiveTaskMoved', (taskId, sourceColId, targetColId, targetPosition) => {
        console.log(`Nhận sự kiện real-time: Task ${taskId} di chuyển từ Cột ${sourceColId} sang Cột ${targetColId} ở vị trí ${targetPosition}`);
        moveTaskInState(taskId, sourceColId, targetColId, targetPosition);
      });

      await connection.start();
      console.log('Kết nối SignalR thành công.');
      
      await connection.invoke('JoinProject', projectId);
      console.log(`Đã tham gia phòng dự án: project_${projectId}`);

      signalrConnectionRef.current = connection;
      setSignalrConnectionId(connection.connectionId);
    } catch (err) {
      console.error('Không thể kết nối SignalR:', err);
    }
  };

  const disconnectSignalR = () => {
    if (signalrConnectionRef.current) {
      signalrConnectionRef.current.stop();
      signalrConnectionRef.current = null;
      setSignalrConnectionId(null);
      console.log('Đã đóng kết nối SignalR.');
    }
  };

  // Helper function to update board state on task move (used by both local DragEnd and real-time SignalR event)
  const moveTaskInState = (taskId, sourceColId, targetColId, targetPosition) => {
    setColumns(prevColumns => {
      // Deep clone to avoid mutating state directly
      let updatedColumns = JSON.parse(JSON.stringify(prevColumns));

      // Find the dragged task in the source column
      let sourceCol = updatedColumns.find(c => c.id === sourceColId);
      if (!sourceCol) {
        // Fallback search if sourceColId is incorrect
        for (const col of updatedColumns) {
          if (col.tasks.some(t => t.id === taskId)) {
            sourceCol = col;
            break;
          }
        }
      }

      if (!sourceCol) return prevColumns; // Task not found

      const taskIndex = sourceCol.tasks.findIndex(t => t.id === taskId);
      if (taskIndex === -1) return prevColumns;

      const [draggedTask] = sourceCol.tasks.splice(taskIndex, 1);
      
      // Update task column ID
      draggedTask.columnId = targetColId;

      // Find target column
      const targetCol = updatedColumns.find(c => c.id === targetColId);
      if (!targetCol) return prevColumns;

      // Insert at targetPosition
      targetCol.tasks.splice(targetPosition, 0, draggedTask);

      // Re-calculate positions for both source and target columns
      sourceCol.tasks = sourceCol.tasks.map((t, idx) => ({ ...t, position: idx }));
      targetCol.tasks = targetCol.tasks.map((t, idx) => ({ ...t, position: idx }));

      return updatedColumns;
    });
  };

  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const response = await api.get('/project');
      setProjects(response.data);
      if (response.data.length > 0) {
        const storedActiveId = localStorage.getItem('activeProjectId');
        let selectedProject = response.data[0];
        if (storedActiveId) {
          const found = response.data.find(p => p.id.toString() === storedActiveId);
          if (found) {
            selectedProject = found;
          }
        }
        setActiveProject(selectedProject);
        localStorage.setItem('activeProjectId', selectedProject.id.toString());
      }
    } catch (err) {
      console.error('Lỗi tải danh sách dự án:', err);
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchBoard = async (projectId) => {
    setLoadingBoard(true);
    try {
      const response = await api.get(`/column/project/${projectId}`);
      setColumns(response.data);
    } catch (err) {
      console.error('Lỗi tải bảng công việc:', err);
    } finally {
      setLoadingBoard(false);
    }
  };

  const fetchMembers = async (projectId) => {
    try {
      const response = await api.get(`/project/${projectId}/members`);
      setMembers(response.data);
    } catch (err) {
      console.error('Lỗi tải thành viên dự án:', err);
    }
  };

  // --- Project CRUD ---
  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!projectName.trim()) {
      setProjectModalError('Tên dự án là bắt buộc.');
      return;
    }

    setProjectModalError('');
    setCreatingProject(true);

    try {
      const response = await api.post('/project', {
        name: projectName.trim(),
        description: projectDesc.trim(),
      });
      setProjects([response.data, ...projects]);
      setActiveProject(response.data);
      localStorage.setItem('activeProjectId', response.data.id.toString());
      
      setProjectName('');
      setProjectDesc('');
      setShowProjectModal(false);
    } catch (err) {
      setProjectModalError(err.response?.data?.message || 'Không thể tạo dự án.');
    } finally {
      setCreatingProject(false);
    }
  };

  // --- Project Settings Handlers ---
  const handleOpenSettingsModal = () => {
    if (!activeProject) return;
    setSettingsProjectName(activeProject.name);
    setSettingsProjectDesc(activeProject.description || '');
    setSettingsModalError('');
    setSettingsActiveTab('general');
    setShowSettingsModal(true);
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!settingsProjectName.trim()) {
      setSettingsModalError('Tên dự án là bắt buộc.');
      return;
    }

    setSettingsModalError('');
    setSavingSettings(true);

    try {
      const response = await api.put(`/project/${activeProject.id}`, {
        name: settingsProjectName.trim(),
        description: settingsProjectDesc.trim(),
      });
      const updatedActive = { 
        ...activeProject, 
        name: response.data.name, 
        description: response.data.description 
      };
      setActiveProject(updatedActive);
      setProjects(projects.map(p => p.id === activeProject.id ? { ...p, name: response.data.name, description: response.data.description } : p));
      setShowSettingsModal(false);
    } catch (err) {
      setSettingsModalError(err.response?.data?.message || 'Không thể lưu cài đặt.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeleteProject = async () => {
    const isConfirmed = window.confirm(
      'Bạn có chắc chắn muốn xóa dự án này?\nHành động này không thể hoàn tác và sẽ xóa toàn bộ cột/thẻ công việc liên quan.'
    );
    if (!isConfirmed) return;

    setDeletingProject(true);
    try {
      await api.delete(`/project/${activeProject.id}`);
      
      const updatedProjects = projects.filter(p => p.id !== activeProject.id);
      setProjects(updatedProjects);
      
      if (updatedProjects.length > 0) {
        setActiveProject(updatedProjects[0]);
        localStorage.setItem('activeProjectId', updatedProjects[0].id.toString());
      } else {
        setActiveProject(null);
        localStorage.removeItem('activeProjectId');
      }
      setShowSettingsModal(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể xóa dự án.');
    } finally {
      setDeletingProject(false);
    }
  };

  const handleUpdateMemberRole = async (userId, newRole) => {
    try {
      await api.put(`/project/${activeProject.id}/members/${userId}`, { role: newRole });
      setMembers(members.map(m => m.userId === userId ? { ...m, role: newRole } : m));
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể cập nhật vai trò thành viên.');
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa thành viên này khỏi dự án?')) return;
    try {
      await api.delete(`/project/${activeProject.id}/members/${userId}`);
      setMembers(members.filter(m => m.userId !== userId));
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể xóa thành viên.');
    }
  };

  // --- Member CRUD ---
  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!memberEmail.trim()) {
      setMemberModalError('Email thành viên là bắt buộc.');
      return;
    }

    setMemberModalError('');
    setAddingMember(true);

    try {
      await api.post(`/project/${activeProject.id}/members`, {
        email: memberEmail.trim(),
        role: memberRole,
      });
      fetchMembers(activeProject.id);
      
      setMemberEmail('');
      setMemberRole('MEMBER');
      setShowMemberModal(false);
    } catch (err) {
      setMemberModalError(err.response?.data?.message || 'Không thể thêm thành viên.');
    } finally {
      setAddingMember(false);
    }
  };

  // --- Column CRUD ---
  const handleAddColumn = async (e) => {
    e.preventDefault();
    if (!newColumnName.trim()) return;

    try {
      const response = await api.post(`/column/project/${activeProject.id}`, {
        name: newColumnName.trim(),
      });
      setColumns([...columns, response.data]);
      setNewColumnName('');
      setIsAddingColumn(false);
    } catch (err) {
      alert('Không thể tạo cột mới. Vui lòng thử lại.');
    }
  };

  const handleDeleteColumn = async (columnId) => {
    if (!window.confirm('Xóa cột sẽ xóa toàn bộ thẻ công việc bên trong. Bạn có chắc chắn muốn tiếp tục?')) return;

    try {
      await api.delete(`/column/${columnId}`);
      setColumns(columns.filter(c => c.id !== columnId));
    } catch (err) {
      alert('Lỗi khi xóa cột.');
    }
  };

  // --- Task CRUD ---
  const openAddTaskModal = (columnId) => {
    setEditingTask(null);
    setTargetColumnId(columnId);
    setTaskTitle('');
    setTaskDesc('');
    setTaskPriority('MEDIUM');
    setTaskAssigneeId('');
    setTaskModalError('');
    setShowTaskModal(true);
  };

  const openEditTaskModal = (task) => {
    setEditingTask(task);
    setTargetColumnId(task.columnId);
    setTaskTitle(task.title);
    setTaskDesc(task.description);
    setTaskPriority(task.priority);
    setTaskAssigneeId(task.assignedUserId ? task.assignedUserId.toString() : '');
    setTaskModalError('');
    setShowTaskModal(true);
  };

  const handleSaveTask = async (e) => {
    e.preventDefault();
    if (!taskTitle.trim()) {
      setTaskModalError('Tiêu đề công việc là bắt buộc.');
      return;
    }

    setTaskModalError('');
    setSavingTask(true);

    const payload = {
      title: taskTitle.trim(),
      description: taskDesc.trim(),
      priority: taskPriority,
      assignedUserId: taskAssigneeId ? parseInt(taskAssigneeId) : null,
    };

    try {
      if (editingTask) {
        // Edit mode
        const response = await api.put(`/task/${editingTask.id}`, payload);
        
        setColumns(columns.map(col => {
          if (col.id === editingTask.columnId) {
            return {
              ...col,
              tasks: col.tasks.map(t => t.id === editingTask.id ? response.data : t)
            };
          }
          return col;
        }));
      } else {
        // Create mode
        const response = await api.post(`/task/column/${targetColumnId}`, payload);
        
        setColumns(columns.map(col => {
          if (col.id === targetColumnId) {
            return {
              ...col,
              tasks: [...col.tasks, response.data]
            };
          }
          return col;
        }));
      }
      setShowTaskModal(false);
    } catch (err) {
      setTaskModalError(err.response?.data?.message || 'Không thể lưu thẻ công việc.');
    } finally {
      setSavingTask(false);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa thẻ công việc này?')) return;

    try {
      await api.delete(`/task/${taskId}`);
      setColumns(columns.map(col => ({
        ...col,
        tasks: col.tasks.filter(t => t.id !== taskId)
      })));
    } catch (err) {
      alert('Lỗi khi xóa thẻ công việc.');
    }
  };


  // Custom collision detection for Kanban:
  //  1. First check if the POINTER is inside a task card → use that task (precise placement)
  //  2. Then check if the POINTER is inside a column container → use that column (for empty cols)
  //  3. Fallback to closestCenter (handles edge-of-column drags)
  const customCollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);

    // Find collision with a TASK (not a column container)
    const overTask = pointerCollisions.find(
      ({ id }) => !columns.some(c => c.id.toString() === String(id))
    );
    if (overTask) return [overTask];

    // Find collision with a COLUMN container (e.g. empty column)
    const overColumn = pointerCollisions.find(
      ({ id }) => columns.some(c => c.id.toString() === String(id))
    );
    if (overColumn) return [overColumn];

    // Fallback
    return closestCenter(args);
  }, [columns]);

  const handleDragStart = (event) => {
    const activeId = event.active.id; // string
    let foundTask = null;
    for (const col of columns) {
      const t = col.tasks.find(x => x.id.toString() === activeId);
      if (t) { foundTask = t; break; }
    }
    setActiveDragTask(foundTask);
  };

  const handleDragEnd = async (event) => {
    setActiveDragTask(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    // Find the task and its CURRENT column (after any onDragOver moves)
    let sourceCol = null;
    let draggedTask = null;
    for (const col of columns) {
      const idx = col.tasks.findIndex(t => t.id.toString() === activeId);
      if (idx !== -1) { sourceCol = col; draggedTask = col.tasks[idx]; break; }
    }
    if (!sourceCol || !draggedTask) return;

    let targetColId = null;
    let targetIndex = 0;

    const overColumn = columns.find(c => c.id.toString() === overId);
    if (overColumn) {
      targetColId = overColumn.id;
      targetIndex = overColumn.id === sourceCol.id
        ? sourceCol.tasks.findIndex(t => t.id === draggedTask.id)
        : overColumn.tasks.length;
    } else {
      for (const col of columns) {
        const idx = col.tasks.findIndex(t => t.id.toString() === overId);
        if (idx !== -1) { targetColId = col.id; targetIndex = idx; break; }
      }
    }

    if (targetColId === null) return;

    // Apply final position in state
    const srcIdx = sourceCol.tasks.findIndex(t => t.id === draggedTask.id);
    if (sourceCol.id === targetColId && srcIdx === targetIndex) return;

    const previousColumnsState = JSON.parse(JSON.stringify(columns));
    moveTaskInState(draggedTask.id, sourceCol.id, targetColId, targetIndex);

    try {
      await api.put(`/task/${draggedTask.id}/move`, {
        targetColumnId: targetColId,
        targetPosition: targetIndex,
        connectionId: signalrConnectionId,
      });
    } catch (err) {
      console.error('Lỗi khi di chuyển thẻ công việc, đang rollback...', err);
      setColumns(previousColumnsState);
      alert(err.response?.data?.message || 'Không thể di chuyển công việc.');
    }
  };

  const isViewer = activeProject?.userRole === 'VIEWER';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-200">
      {/* 1. Sidebar */}
      <aside className="w-64 border-r border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950 flex flex-col z-20 transition-colors duration-200">
        {/* Sidebar Header */}
        <div className="h-16 border-b border-slate-200 dark:border-slate-900 flex items-center px-6 gap-3 transition-colors duration-200">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-md shadow-purple-500/20">
            <LayoutDashboard className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-lg bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
            Workspace
          </span>
        </div>

        {/* Sidebar Project Section */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>Dự án của bạn</span>
              <button 
                onClick={() => setShowProjectModal(true)}
                className="p-1 hover:bg-slate-900 rounded text-slate-400 hover:text-white transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {loadingProjects ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
              </div>
            ) : projects.length === 0 ? (
              <p className="px-2 text-xs text-slate-600 italic">Chưa có dự án nào</p>
            ) : (
              <div className="space-y-1">
                {projects.map((proj) => (
                  <button
                    key={proj.id}
                    onClick={() => {
                      setActiveProject(proj);
                      localStorage.setItem('activeProjectId', proj.id.toString());
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 text-left ${
                      activeProject?.id === proj.id
                        ? 'bg-purple-50 dark:bg-purple-600/10 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900/50 hover:text-slate-900 dark:hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    <Folder className="h-4 w-4 shrink-0" />
                    <span className="truncate flex-1">{proj.name}</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
                      {proj.userRole}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Footer / User Info */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-purple-600 dark:text-purple-400 font-semibold uppercase">
                {user?.fullName.charAt(0)}
              </div>
              <div className="overflow-hidden">
                <h4 className="text-sm font-semibold truncate text-slate-800 dark:text-slate-200">{user?.fullName}</h4>
                <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
              </div>
            </div>
            <button 
              onClick={logout}
              className="p-2 hover:bg-red-500/10 hover:text-red-400 text-slate-400 dark:text-slate-500 rounded-lg transition-all"
              title="Đăng xuất"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* 2. Main Space */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
        {activeProject ? (
          <>
            {/* Main Header */}
            <header className="h-16 border-b border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950/30 flex items-center justify-between px-8 transition-colors duration-200">
              <div className="overflow-hidden mr-4">
                <h1 className="text-xl font-bold text-slate-800 dark:text-white truncate">{activeProject.name}</h1>
                <p className="text-xs text-slate-500 truncate max-w-xl">{activeProject.description || 'Không có mô tả dự án'}</p>
              </div>
              
              <div className="flex items-center gap-4 shrink-0">
                {/* Members list preview */}
                <div className="flex -space-x-2 overflow-hidden">
                  {members.slice(0, 4).map((member) => (
                    <div 
                      key={member.userId} 
                      className="h-8 w-8 rounded-full bg-slate-800 border-2 border-slate-950 flex items-center justify-center text-xs font-bold text-purple-400 uppercase"
                      title={`${member.fullName} (${member.role})`}
                    >
                      {member.fullName.charAt(0)}
                    </div>
                  ))}
                  {members.length > 4 && (
                    <div className="h-8 w-8 rounded-full bg-slate-900 border-2 border-slate-950 flex items-center justify-center text-xs font-bold text-slate-500">
                      +{members.length - 4}
                    </div>
                  )}
                </div>

                {/* Add member button (ADMIN only) */}
                {activeProject.userRole === 'ADMIN' && (
                  <button
                    onClick={() => setShowMemberModal(true)}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/10 active:scale-95 transition-all"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Mời thành viên
                  </button>
                )}
                {/* Project settings button */}
                <button
                  onClick={handleOpenSettingsModal}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white hover:bg-slate-50 dark:bg-slate-900/50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-200 transition-all active:scale-95 shadow-sm"
                  title="Cài đặt dự án"
                >
                  <Settings className="h-4 w-4" />
                </button>

                {/* Theme toggle button */}
                <button
                  onClick={toggleTheme}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white hover:bg-slate-50 dark:bg-slate-900/50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-200 transition-all active:scale-95 shadow-sm"
                  title={theme === 'dark' ? "Chuyển sang Giao diện Sáng" : "Chuyển sang Giao diện Tối"}
                >
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
              </div>
            </header>

            {/* DndContext wrapping Columns */}
            <DndContext 
              sensors={sensors} 
              collisionDetection={customCollisionDetection}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="flex-1 overflow-x-auto p-8 flex items-start gap-6 select-none">
                {loadingBoard ? (
                  <div className="flex-1 flex flex-col items-center justify-center h-full gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                    <p className="text-sm text-slate-500">Đang tải bảng Kanban...</p>
                  </div>
                ) : (
                  <>
                    {columns.map((col) => (
                      <ColumnComponent
                        key={col.id}
                        column={col}
                        tasks={col.tasks}
                        onAddTask={openAddTaskModal}
                        onDeleteColumn={handleDeleteColumn}
                        onDeleteTask={handleDeleteTask}
                        onEditTask={openEditTaskModal}
                        canEdit={!isViewer}
                      />
                    ))}

                    {/* Add Column button */}
                    {!isViewer && (
                      <div className="w-72 shrink-0">
                        {isAddingColumn ? (
                          <form onSubmit={handleAddColumn} className="bg-slate-900/40 border border-slate-900 p-4 rounded-xl space-y-3">
                            <input
                              type="text"
                              required
                              autoFocus
                              value={newColumnName}
                              onChange={(e) => setNewColumnName(e.target.value)}
                              placeholder="Nhập tên cột..."
                              className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-slate-200 text-xs outline-none focus:border-purple-500 transition-colors"
                            />
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                type="button"
                                onClick={() => setIsAddingColumn(false)}
                                className="px-3 py-1.5 border border-slate-800 text-slate-400 hover:text-white rounded text-[11px] font-semibold"
                              >
                                Hủy
                              </button>
                              <button
                                type="submit"
                                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-[11px] font-semibold active:scale-95 transition-all"
                              >
                                Thêm cột
                              </button>
                            </div>
                          </form>
                        ) : (
                          <button 
                            onClick={() => setIsAddingColumn(true)}
                            className="w-full border border-dashed border-slate-900 hover:border-slate-800 hover:bg-slate-900/20 p-4 rounded-xl flex items-center justify-center gap-2 text-slate-500 hover:text-slate-400 text-sm font-medium transition-all group"
                          >
                            <Plus className="h-4 w-4 group-hover:scale-110 transition-transform" />
                            Thêm cột mới
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Drag Overlay representation */}
              <DragOverlay>
                {activeDragTask ? (
                  <div className="rotate-2 opacity-90 shadow-2xl">
                    <TaskCard task={activeDragTask} />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <ClipboardList className="h-16 w-16 text-slate-700 mb-4 animate-bounce" />
            <h2 className="text-xl font-bold text-slate-300">Không có dự án nào đang mở</h2>
            <p className="text-sm text-slate-500 mt-2 max-w-sm">
              Chọn một dự án ở cột bên trái hoặc tạo dự án mới để bắt đầu quản lý công việc cộng tác.
            </p>
            <button 
              onClick={() => setShowProjectModal(true)}
              className="mt-6 flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-sm font-semibold rounded-lg text-white shadow-lg shadow-purple-600/10 active:scale-95 transition-all"
            >
              <Plus className="h-4 w-4" />
              Tạo dự án mới
            </button>
          </div>
        )}
      </main>

      {/* 3. Modals */}
      {/* 3.1. Project Creation Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Tạo dự án mới</h3>
            <form onSubmit={handleCreateProject} className="space-y-4">
              {projectModalError && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
                  {projectModalError}
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tên dự án</label>
                <input 
                  type="text" 
                  required
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Ví dụ: Landing Page redesign" 
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 px-3 text-slate-200 placeholder-slate-600 text-sm outline-none focus:border-purple-500 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Mô tả chi tiết</label>
                <textarea 
                  value={projectDesc}
                  onChange={(e) => setProjectDesc(e.target.value)}
                  placeholder="Mô tả mục tiêu của dự án..." 
                  rows="3"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 px-3 text-slate-200 placeholder-slate-600 text-sm outline-none focus:border-purple-500 transition-colors resize-none"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setShowProjectModal(false)}
                  className="px-4 py-2 border border-slate-800 bg-transparent text-slate-400 hover:text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Hủy
                </button>
                <button 
                  type="submit"
                  disabled={creatingProject}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-semibold shadow-lg shadow-purple-600/10 active:scale-95 transition-all disabled:opacity-50"
                >
                  {creatingProject && <Loader2 className="h-4 w-4 animate-spin" />}
                  Tạo mới
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3.2. Member Management Modal */}
      {showMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Quản lý thành viên</h3>
              <button 
                onClick={() => setShowMemberModal(false)}
                className="text-slate-500 hover:text-white transition-colors text-sm font-medium"
              >
                Đóng
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4 border-b border-slate-800/80 pb-6 mb-6">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mời thành viên mới</h4>
              {memberModalError && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
                  {memberModalError}
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-3">
                <input 
                  type="email" 
                  required
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="Email thành viên..." 
                  className="flex-1 rounded-lg border border-slate-800 bg-slate-950 py-2.5 px-3 text-slate-200 placeholder-slate-600 text-sm outline-none focus:border-purple-500 transition-colors"
                />
                <select 
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value)}
                  className="rounded-lg border border-slate-800 bg-slate-950 py-2.5 px-3 text-slate-200 text-sm outline-none focus:border-purple-500 transition-colors"
                >
                  <option value="MEMBER">MEMBER</option>
                  <option value="VIEWER">VIEWER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
                <button 
                  type="submit"
                  disabled={addingMember}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-semibold active:scale-95 transition-all shrink-0"
                >
                  {addingMember && <Loader2 className="h-4 w-4 animate-spin" />}
                  Mời vào
                </button>
              </div>
            </form>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Danh sách thành viên hiện tại ({members.length})</h4>
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {members.map((member) => (
                  <div key={member.userId} className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-850">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="h-8 w-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-xs font-bold text-purple-400 uppercase shrink-0">
                        {member.fullName.charAt(0)}
                      </div>
                      <div className="overflow-hidden">
                        <h5 className="text-sm font-semibold text-slate-200 truncate">{member.fullName}</h5>
                        <p className="text-[11px] text-slate-500 truncate">{member.email}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                        {member.role}
                      </span>
                      {activeProject.userRole === 'ADMIN' && member.userId !== user.id && (
                        <button 
                          onClick={() => handleRemoveMember(member.userId)}
                          className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
                          title="Xóa khỏi dự án"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3.3. Task Add/Edit Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">
                {editingTask ? 'Cập nhật công việc' : 'Thêm công việc mới'}
              </h3>
              <button 
                onClick={() => setShowTaskModal(false)}
                className="text-slate-500 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="space-y-4">
              {taskModalError && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
                  {taskModalError}
                </div>
              )}
              
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tiêu đề</label>
                <input 
                  type="text" 
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Ví dụ: Thiết kế giao diện Login..." 
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 px-3 text-slate-200 placeholder-slate-600 text-sm outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Mô tả công việc</label>
                <textarea 
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  placeholder="Mô tả công việc cần làm..." 
                  rows="4"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 px-3 text-slate-200 placeholder-slate-600 text-sm outline-none focus:border-purple-500 transition-colors resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Độ ưu tiên</label>
                  <select 
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 px-3 text-slate-200 text-sm outline-none focus:border-purple-500 transition-colors"
                  >
                    <option value="LOW">LOW (Thấp)</option>
                    <option value="MEDIUM">MEDIUM (Trung bình)</option>
                    <option value="HIGH">HIGH (Cao)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Giao cho</label>
                  <select 
                    value={taskAssigneeId}
                    onChange={(e) => setTaskAssigneeId(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 px-3 text-slate-200 text-sm outline-none focus:border-purple-500 transition-colors"
                  >
                    <option value="">Chưa phân công</option>
                    {members.map(member => (
                      <option key={member.userId} value={member.userId}>
                        {member.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2 border border-slate-800 bg-transparent text-slate-400 hover:text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Hủy
                </button>
                <button 
                  type="submit"
                  disabled={savingTask}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-semibold shadow-lg shadow-purple-600/10 active:scale-95 transition-all disabled:opacity-50"
                >
                  {savingTask && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingTask ? 'Cập nhật' : 'Thêm mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3.4. Project Settings Modal */}
      {showSettingsModal && activeProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col h-[550px]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-white">Cài đặt dự án</h3>
                <p className="text-xs text-slate-500">{activeProject.name}</p>
              </div>
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-500 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-850 px-6 bg-slate-950/20 shrink-0">
              <button
                onClick={() => setSettingsActiveTab('general')}
                className={`py-3 px-4 text-sm font-medium border-b-2 transition-all ${
                  settingsActiveTab === 'general'
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Thông tin chung
              </button>
              <button
                onClick={() => setSettingsActiveTab('members')}
                className={`py-3 px-4 text-sm font-medium border-b-2 transition-all ${
                  settingsActiveTab === 'members'
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Thành viên ({members.length})
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {settingsActiveTab === 'general' ? (
                <form onSubmit={handleSaveSettings} className="space-y-6 h-full flex flex-col justify-between">
                  <div className="space-y-4">
                    {settingsModalError && (
                      <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
                        {settingsModalError}
                      </div>
                    )}
                    
                    <div className="space-y-1">
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tên dự án</label>
                      <input 
                        type="text" 
                        required
                        disabled={activeProject.userRole === 'VIEWER'}
                        value={settingsProjectName}
                        onChange={(e) => setSettingsProjectName(e.target.value)}
                        placeholder="Tên dự án của bạn..." 
                        className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 px-3 text-slate-200 placeholder-slate-600 text-sm outline-none focus:border-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Mô tả dự án</label>
                      <textarea 
                        disabled={activeProject.userRole === 'VIEWER'}
                        value={settingsProjectDesc}
                        onChange={(e) => setSettingsProjectDesc(e.target.value)}
                        placeholder="Mô tả tóm tắt về dự án..." 
                        rows="5"
                        className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 px-3 text-slate-200 placeholder-slate-600 text-sm outline-none focus:border-purple-500 transition-colors resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="border-t border-slate-850 pt-6 mt-6 flex flex-col gap-4">
                    {/* General Save Actions */}
                    {activeProject.userRole !== 'VIEWER' && (
                      <div className="flex items-center justify-end gap-3">
                        <button 
                          type="button"
                          onClick={() => setShowSettingsModal(false)}
                          className="px-4 py-2 border border-slate-800 bg-transparent text-slate-400 hover:text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          Hủy
                        </button>
                        <button 
                          type="submit"
                          disabled={savingSettings}
                          className="flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-semibold shadow-lg shadow-purple-600/10 active:scale-95 transition-all disabled:opacity-50"
                        >
                          {savingSettings && <Loader2 className="h-4 w-4 animate-spin" />}
                          Lưu cài đặt
                        </button>
                      </div>
                    )}

                    {/* Danger Zone */}
                    {activeProject.userRole === 'ADMIN' && (
                      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-2">
                        <div>
                          <h4 className="text-sm font-semibold text-red-400">Vùng nguy hiểm (Danger Zone)</h4>
                          <p className="text-xs text-slate-500">Xóa vĩnh viễn dự án này và tất cả các tài nguyên liên quan.</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleDeleteProject}
                          disabled={deletingProject}
                          className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-red-600/10 active:scale-95 transition-all shrink-0 disabled:opacity-50"
                        >
                          {deletingProject && <Loader2 className="h-3 w-3 animate-spin" />}
                          Xóa dự án
                        </button>
                      </div>
                    )}
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Danh sách thành viên hiện tại</h4>
                    {activeProject.userRole === 'ADMIN' && (
                      <button
                        onClick={() => {
                          setShowSettingsModal(false);
                          setShowMemberModal(true);
                        }}
                        className="text-xs text-purple-400 hover:text-purple-300 font-semibold transition-colors"
                      >
                        + Mời thành viên mới
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {members.map((member) => (
                      <div key={member.userId} className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-slate-850 hover:border-slate-800 transition-all">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="h-9 w-9 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-sm font-bold text-purple-400 uppercase shrink-0">
                            {member.fullName.charAt(0)}
                          </div>
                          <div className="overflow-hidden">
                            <h5 className="text-sm font-semibold text-slate-200 truncate">{member.fullName}</h5>
                            <p className="text-xs text-slate-500 truncate">{member.email}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 shrink-0">
                          {activeProject.userRole === 'ADMIN' && member.userId !== user.id ? (
                            <select
                              value={member.role}
                              onChange={(e) => handleUpdateMemberRole(member.userId, e.target.value)}
                              className="rounded-lg border border-slate-800 bg-slate-950 py-1.5 px-2 text-slate-300 text-xs outline-none focus:border-purple-500 transition-colors"
                            >
                              <option value="VIEWER">VIEWER</option>
                              <option value="MEMBER">MEMBER</option>
                              <option value="ADMIN">ADMIN</option>
                            </select>
                          ) : (
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-400">
                              {member.role}
                            </span>
                          )}

                          {activeProject.userRole === 'ADMIN' && member.userId !== user.id && (
                            <button 
                              onClick={() => handleRemoveMember(member.userId)}
                              className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                              title="Xóa khỏi dự án"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
