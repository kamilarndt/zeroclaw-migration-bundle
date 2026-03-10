import React, { useCallback } from 'react';
import TaskCard from './TaskCard';
import { Task as TaskType, TaskStatus } from '../../stores/taskStore';

interface TaskAccordionProps {
  tasks: TaskType[];
  onTaskClick: (task: TaskType) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onDeleteTask?: (taskId: string) => void;
}

const TaskAccordion = React.memo(({ 
  tasks, 
  onTaskClick, 
  onStatusChange,
  onDeleteTask 
}: TaskAccordionProps) => {
  const handleTaskClick = useCallback((task: TaskType) => {
    onTaskClick(task);
  }, [onTaskClick]);

  const handleStatusChange = useCallback((taskId: string, newStatus: TaskStatus) => {
    onStatusChange(taskId, newStatus);
  }, [onStatusChange]);

  const handleDeleteTask = useCallback((taskId: string) => {
    if (onDeleteTask) {
      onDeleteTask(taskId);
    }
  }, [onDeleteTask]);

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          onClick={() => handleTaskClick(task)}
          onStatusChange={handleStatusChange}
          onDelete={onDeleteTask ? handleDeleteTask : undefined}
        />
      ))}
    </div>
  );
});

TaskAccordion.displayName = 'TaskAccordion';

export default TaskAccordion;
