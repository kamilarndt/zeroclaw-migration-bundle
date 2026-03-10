import React, { useState } from 'react';
import { 
  Clock, 
  ChevronRight, 
  Play, 
  Pause, 
  CheckCircle,
  X,
  ChevronDown,
  ChevronUp,
  AlertTriangle
} from 'lucide-react';
import { Task as TaskType, TaskStatus } from '../../stores/taskStore';

interface TaskCardProps {
  task: TaskType;
  onClick: () => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onDelete?: (taskId: string) => void;
}

const TaskCard = React.memo(({ 
  task, 
  onClick, 
  onStatusChange,
  onDelete
}: TaskCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'todo': return <Clock size={16} className="text-yellow-400" />;
      case 'in_progress': return <Play size={16} className="text-blue-400" />;
      case 'review': return <ChevronRight size={16} className="text-purple-400" />;
      case 'done': return <CheckCircle size={16} className="text-green-400" />;
    }
  };

  const getNextStatus = (current: TaskStatus): TaskStatus => {
    const statusOrder: TaskStatus[] = ['todo', 'in_progress', 'review', 'done'];
    const currentIndex = statusOrder.indexOf(current);
    return statusOrder[(currentIndex + 1) % statusOrder.length];
  };

  const handleStatusClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStatusChange(task.id, getNextStatus(task.status));
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      if (showDeleteConfirm) {
        onDelete(task.id);
        setShowDeleteConfirm(false);
      } else {
        setShowDeleteConfirm(true);
        setTimeout(() => setShowDeleteConfirm(false), 3000);
      }
    }
  };

  return (
    <div
      onClick={onClick}
      tabIndex={0}
      className={`bg-black/30 backdrop-blur-sm rounded-lg p-4 border border-white/10 cursor-pointer hover:bg-black/50 transition-all group ${
        isExpanded ? 'ring-2 ring-white/20' : ''
      }`}
      data-testid={`task-card-${task.id}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {getStatusIcon(task.status)}
            <h4 className="font-semibold text-white" data-testid={`task-title-${task.id}`}>{task.title}</h4>
          </div>
          {task.description && (
            <p className="text-gray-400 text-sm line-clamp-2" data-testid={`task-description-${task.id}`}>{task.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleStatusClick}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            title="Change status"
          >
            {task.status === 'in_progress' ? <Pause size={16} /> : <Play size={16} />}
          </button>
          {onDelete && (
            <button
              onClick={handleDeleteClick}
              className={`p-1 hover:bg-red-500/20 rounded transition-colors ${
                showDeleteConfirm ? 'bg-red-500/20' : ''
              }`}
              title={showDeleteConfirm ? 'Confirm delete' : 'Delete task'}
            >
              {showDeleteConfirm ? (
                <AlertTriangle size={16} className="text-red-400" />
              ) : (
                <X size={16} />
              )}
            </button>
          )}
        </div>
      </div>
      
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {task.tags.map((tag, index) => (
            <span
              key={`${task.id}-tag-${index}`}
              className="text-xs px-2 py-1 bg-white/10 rounded-full text-gray-300"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {task.dueDate && (
        <div className="flex items-center gap-1 mt-3 text-sm text-gray-400">
          <Clock size={14} />
          <span>{new Date(task.dueDate).toLocaleDateString()}</span>
        </div>
      )}

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <h5 className="text-sm font-semibold text-white mb-2">Description</h5>
          <p className="text-gray-400 text-sm">{task.description || 'No description'}</p>
          
          {task.tags && task.tags.length > 0 && (
            <>
              <h5 className="text-sm font-semibold text-white mb-2 mt-4">Tags</h5>
              <div className="flex flex-wrap gap-2">
                {task.tags.map((tag, index) => (
                  <span
                    key={`expanded-${task.id}-tag-${index}`}
                    className="text-xs px-2 py-1 bg-white/10 rounded-full text-gray-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {task.description && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="mt-3 flex items-center gap-1 text-sm text-white/50 hover:text-white/80 transition-colors"
        >
          {isExpanded ? (
            <>
              <ChevronUp size={16} /> Show less
            </>
          ) : (
            <>
              <ChevronDown size={16} /> Show more
            </>
          )}
        </button>
      )}
    </div>
  );
});

TaskCard.displayName = 'TaskCard';

export default TaskCard;
