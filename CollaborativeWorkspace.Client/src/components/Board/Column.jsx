import React from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { Plus, Trash2 } from 'lucide-react';
import TaskCard from './TaskCard';

const Column = ({ column, tasks, onAddTask, onDeleteColumn, onDeleteTask, onEditTask, canEdit }) => {
  const { setNodeRef: setDroppableRef } = useDroppable({
    id: column.id.toString(),
  });

  return (
    <div className="w-72 shrink-0 flex flex-col max-h-full rounded-xl bg-slate-100/60 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-900 p-4 transition-colors duration-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="font-semibold text-slate-700 dark:text-slate-200 text-sm tracking-wide truncate">{column.name}</span>
          <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 dark:bg-slate-900 text-slate-500 dark:text-slate-400 rounded border border-slate-300 dark:border-slate-800/80 font-bold shrink-0">
            {tasks.length}
          </span>
        </div>
        {canEdit && (
          <button
            onClick={() => onDeleteColumn(column.id)}
            className="p-1 hover:bg-red-500/10 rounded text-slate-500 hover:text-red-400 transition-colors"
            title="Xóa cột"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Sortable & Droppable Tasks Container */}
      <div 
        ref={setDroppableRef}
        className="flex-1 overflow-y-auto overflow-x-hidden space-y-3 pr-1 mb-4 min-h-[150px]"
      >
        <SortableContext items={tasks.map(t => t.id.toString())} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              disabled={!canEdit}
              onDelete={canEdit ? onDeleteTask : null}
              onEdit={canEdit ? onEditTask : null}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="h-24 border border-dashed border-slate-300 dark:border-slate-800/80 rounded-xl flex items-center justify-center text-xs text-slate-400 dark:text-slate-600 italic">
            Kéo thả thẻ vào đây
          </div>
        )}
      </div>

      {/* Add Task Button */}
      {canEdit && (
        <button
          onClick={() => onAddTask(column.id)}
          className="w-full py-2 border border-slate-250 dark:border-slate-900 hover:border-slate-300 dark:hover:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/20 rounded-lg flex items-center justify-center gap-2 text-slate-500 hover:text-slate-950 dark:hover:text-slate-400 text-xs font-semibold transition-all group"
        >
          <Plus className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
          Thêm công việc
        </button>
      )}
    </div>
  );
};

export default Column;
