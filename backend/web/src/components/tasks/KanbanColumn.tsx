import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Task } from '../../types/tasks';
import { TaskCard } from './TaskCard';

interface KanbanColumnProps {
  status: Task['status'];
  label: string;
  tasks: Task[];
}

export function KanbanColumn({ status, label, tasks }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: status,
  });

  const getStatusColor = (status: Task['status']) => {
    const colors = {
      Todo: 'bg-gray-100 border-gray-300',
      InProgress: 'bg-blue-50 border-blue-300',
      Review: 'bg-yellow-50 border-yellow-300',
      Done: 'bg-green-50 border-green-300',
    };
    return colors[status];
  };

  return (
    <div className={`kanban-column rounded-lg border-2 p-4 min-h-[500px] ${getStatusColor(status)}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">{label}</h3>
        <span className="bg-white px-2 py-1 rounded-full text-sm font-medium">
          {tasks.length}
        </span>
      </div>

      <div ref={setNodeRef} className="space-y-3">
        <SortableContext
          items={tasks.map(t => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
