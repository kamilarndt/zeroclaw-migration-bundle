import React, { useMemo, useCallback } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import TaskCard from './TaskCard';
import { Task as TaskType, TaskStatus } from '../../stores/taskStore';

interface TaskItemProps {
  task: TaskType;
  onClick: () => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onDelete?: (taskId: string) => void;
}

const TaskItem = React.memo(({ task, onClick, onStatusChange, onDelete }: TaskItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: task.id });

  const style = useMemo(() => ({
    transform: CSS.Transform.toString(transform),
    transition,
  }), [transform, transition]);

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} data-testid={`task-item-${task.id}`}>
      <TaskCard
        task={task}
        onClick={onClick}
        onStatusChange={onStatusChange}
        onDelete={onDelete}
      />
    </div>
  );
});

TaskItem.displayName = 'TaskItem';

interface ColumnProps {
  title: string;
  status: TaskStatus;
  tasks: TaskType[];
  onTaskClick: (task: TaskType) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onDeleteTask?: (taskId: string) => void;
}

const Column = React.memo(({ 
  title, 
  status, 
  tasks, 
  onTaskClick, 
  onStatusChange,
  onDeleteTask 
}: ColumnProps) => {
  const taskIds = useMemo(() => tasks.map(t => t.id), [tasks]);

  const handleTaskClick = useCallback((task: TaskType) => {
    onTaskClick(task);
  }, [onTaskClick]);

  // Virtualization: Only render first 10 tasks + 1 placeholder for large lists
  const maxVisibleTasks = 10;
  const visibleTasks = useMemo(() => 
    tasks.slice(0, maxVisibleTasks),
    [tasks]
  );
  const hasMoreTasks = tasks.length > maxVisibleTasks;

  return (
    <div className="bg-black/30 backdrop-blur-sm rounded-xl p-4 border border-white/10 min-h-[400px]" data-testid={`kanban-column-${status}`}>
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center justify-between" data-testid={`column-title-${status}`}>
        {title}
        <span className="text-sm bg-white/10 px-2 py-1 rounded-full text-gray-400" data-testid={`column-count-${status}`}>
          {tasks.length}
        </span>
      </h3>

      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {visibleTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onClick={() => handleTaskClick(task)}
              onStatusChange={onStatusChange}
              onDelete={onDeleteTask}
            />
          ))}
          
          {hasMoreTasks && (
            <div className="text-center py-3 text-gray-500 text-sm">
              {tasks.length - maxVisibleTasks} more tasks...
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
});

Column.displayName = 'Column';

interface KanbanBoardProps {
  tasks: TaskType[];
  onTaskClick: (task: TaskType) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onDeleteTask?: (taskId: string) => void;
}

const KanbanBoard = React.memo(({ 
  tasks, 
  onTaskClick, 
  onStatusChange,
  onDeleteTask 
}: KanbanBoardProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const columns = useMemo(() => {
    return [
      { id: 'todo', title: 'To Do', status: 'todo' as TaskStatus },
      { id: 'in_progress', title: 'In Progress', status: 'in_progress' as TaskStatus },
      { id: 'review', title: 'In Review', status: 'review' as TaskStatus },
      { id: 'done', title: 'Done', status: 'done' as TaskStatus },
    ];
  }, []);

  const getTasksByStatus = useCallback((status: TaskStatus) => {
    return tasks.filter(task => task.status === status);
  }, [tasks]);

  const [activeId, setActiveId] = React.useState<string | null>(null);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) return;
    
    const taskId = active.id as string;
    const newStatus = over.id as TaskStatus;
    
    const task = tasks.find(t => t.id === taskId);
    if (task && task.status !== newStatus) {
      onStatusChange(taskId, newStatus);
    }
    
    setActiveId(null);
  }, [tasks, onStatusChange]);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="kanban-board">
        {columns.map((column) => (
          <Column
            key={column.id}
            title={column.title}
            status={column.status}
            tasks={getTasksByStatus(column.status)}
            onTaskClick={onTaskClick}
            onStatusChange={onStatusChange}
            onDeleteTask={onDeleteTask}
          />
        ))}
      </div>

      <DragOverlay>
        {activeId && (
          <TaskCard
            task={tasks.find(t => t.id === activeId)!}
            onClick={() => {}}
            onStatusChange={() => {}}
            onDelete={() => {}}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
});

KanbanBoard.displayName = 'KanbanBoard';

export default KanbanBoard;
