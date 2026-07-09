import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Trash2, Edit2 } from 'lucide-react';

const TaskCard = ({ task, onDelete, onEdit }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: task.id, 
    data: { 
      type: 'Task', 
      task 
    } 
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const priorityColors = {
    HIGH: 'bg-red-500/10 text-red-400 border-red-500/20',
    MEDIUM: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    LOW: 'bg-green-500/10 text-green-400 border-green-500/20',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-slate-900 border border-slate-800/80 hover:border-slate-700/80 p-3.5 rounded-xl shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing group relative select-none"
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <h4 className="text-sm font-semibold text-slate-200 group-hover:text-purple-400 transition-colors line-clamp-2 pr-6">
          {task.title}
        </h4>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-2 bg-slate-900 pl-2">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(task);
              }}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
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
        <span className={`text-[10px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded border ${priorityColors[task.priority] || priorityColors.MEDIUM}`}>
          {task.priority}
        </span>
        
        {task.assignedUserName && (
          <div
            className="h-5 w-5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-400 flex items-center justify-center uppercase"
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
