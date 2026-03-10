import { useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCorners } from '@dnd-kit/core';
import { Task } from '../../types/tasks';
import { KanbanColumn } from './KanbanColumn';
import { TaskCard } from './TaskCard';

interface KanbanBoardProps {
  initialTasks?: Task[];
  onTaskUpdate?: (taskId: string, newStatus: Task['status']) => void;
}

export function KanbanBoard({ initialTasks = [], onTaskUpdate }: KanbanBoardProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activeId, setActiveId] = useState<string | null>(null);

  const columns: { status: Task['status']; label: string }[] = [
    { status: 'Todo', label: 'To Do' },
    { status: 'InProgress', label: 'In Progress' },
    { status: 'Review', label: 'Review' },
    { status: 'Done', label: 'Done' },
  ];

  const getTasksByStatus = (status: Task['status']) => {
    return tasks.filter(task => task.status === status);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as Task['status'];

    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === newStatus) return;

    const updatedTasks = tasks.map(t =>
      t.id === taskId
        ? { ...t, status: newStatus, updatedAt: new Date().toISOString() }
        : t
    );

    setTasks(updatedTasks);
    onTaskUpdate?.(taskId, newStatus);
  };

  return (
    <div className="kanban-board">
      <DndContext
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {columns.map(column => {
            const columnTasks = getTasksByStatus(column.status);
            return (
              <KanbanColumn
                key={column.status}
                status={column.status}
                label={column.label}
                tasks={columnTasks}
              />
            );
          })}
        </div>

        <DragOverlay>
          {activeId ? (
            <TaskCard
              task={tasks.find(t => t.id === activeId)!}
              isDragging
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
