import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Trash2, Edit2 } from 'lucide-react';

const TaskCard = ({ task, disabled, onDelete, onEdit }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: task.id.toString(), 
    disabled,
    data: { 
      type: 'Task', 
      task 
    } 
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityBorders = {
    HIGH: 'border-l-4 border-l-red-500',
    MEDIUM: 'border-l-4 border-l-amber-500',
    LOW: 'border-l-4 border-l-emerald-500',
  };

  const priorityBadges = {
    HIGH: 'bg-red-500/10 text-red-400 border-red-500/20',
    MEDIUM: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    LOW: 'bg-green-500/10 text-green-400 border-green-500/20',
  };

  const getAvatarStyle = (name) => {
    const bgColors = [
      'bg-blue-600/25 text-blue-300 border-blue-500/30',
      'bg-purple-600/25 text-purple-300 border-purple-500/30',
      'bg-emerald-600/25 text-emerald-300 border-emerald-500/30',
      'bg-amber-600/25 text-amber-300 border-amber-500/30',
      'bg-rose-600/25 text-rose-300 border-rose-500/30',
      'bg-indigo-600/25 text-indigo-300 border-indigo-500/30',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % bgColors.length;
    return bgColors[index];
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`border p-3.5 rounded-xl shadow-sm transition-all select-none touch-none group relative
        ${isDragging
          ? 'bg-slate-100 dark:bg-slate-950 border-dashed border-slate-350 dark:border-slate-700 opacity-40 cursor-grabbing shadow-none'
          : `bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800/80 hover:border-slate-350 dark:hover:border-slate-700/80 hover:shadow-md ${disabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'} ${priorityBorders[task.priority] || priorityBorders.MEDIUM}`
        }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <h4 className="text-sm font-semibold text-slate-850 dark:text-slate-200 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors line-clamp-2 pr-6">
          {task.title}
        </h4>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-2 bg-white dark:bg-slate-900 pl-2">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(task);
              }}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 hover:text-slate-850 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              <Edit2 className="h-3 w-3" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(task.id);
              }}
              className="p-1 hover:bg-red-500/10 rounded text-slate-500 hover:text-red-400"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      
      <p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">{task.description || 'Không có mô tả'}</p>
      
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded border ${priorityBadges[task.priority] || priorityBadges.MEDIUM}`}>
          {task.priority}
        </span>
        
        {task.assignedUserName && (
          <div
            className={`h-5 w-5 rounded-full border text-[10px] font-extrabold flex items-center justify-center uppercase shadow-sm ${getAvatarStyle(task.assignedUserName)}`}
            title={`Được giao cho: ${task.assignedUserName}`}
          >
            {task.assignedUserName.charAt(0)}
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskCard;
