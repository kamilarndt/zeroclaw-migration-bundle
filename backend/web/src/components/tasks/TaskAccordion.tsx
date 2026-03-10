import { Task } from '../../types/tasks';

interface TaskAccordionProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
}

export function TaskAccordion({ tasks, onTaskClick }: TaskAccordionProps) {
  const getStatusBadgeClass = (status: Task['status']) => {
    const classes = {
      Todo: 'badge-todo bg-gray-100 text-gray-800',
      InProgress: 'badge-inprogress bg-blue-100 text-blue-800',
      Review: 'badge-review bg-yellow-100 text-yellow-800',
      Done: 'badge-done bg-green-100 text-green-800',
    };
    return classes[status];
  };

  const getPriorityBadgeClass = (priority?: Task['priority']) => {
    const classes = {
      low: 'priority-low bg-green-50 text-green-700 border-green-200',
      medium: 'priority-medium bg-yellow-50 text-yellow-700 border-yellow-200',
      high: 'priority-high bg-red-50 text-red-700 border-red-200',
    };
    return classes[priority || 'medium'];
  };

  const groupTasksByStatus = () => {
    const groups: Record<Task['status'], Task[]> = {
      Todo: [],
      InProgress: [],
      Review: [],
      Done: [],
    };

    tasks.forEach(task => {
      groups[task.status].push(task);
    });

    return groups;
  };

  const groupedTasks = groupTasksByStatus();

  return (
    <div className="task-accordion space-y-4">
      {Object.entries(groupedTasks).map(([status, statusTasks]) => (
        <div key={status} className="task-group">
          <details
            className="group/details bg-white border border-gray-200 rounded-lg overflow-hidden"
            open={status === 'InProgress'}
          >
            <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-3">
                <h3 className="font-semibold text-gray-900">{status.replace(/([A-Z])/g, ' $1').trim()}</h3>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(status as Task['status'])}`}>
                  {statusTasks.length}
                </span>
              </div>
              <svg
                className="w-5 h-5 text-gray-500 transition-transform group-open/details:rotate-180"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>

            <div className="p-4 pt-0 space-y-3">
              {statusTasks.length === 0 ? (
                <p className="text-gray-500 text-sm py-4">No tasks in this status</p>
              ) : (
                statusTasks.map(task => (
                  <div
                    key={task.id}
                    onClick={() => onTaskClick?.(task)}
                    className="task-item border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-gray-900 flex-1">{task.title}</h4>
                      <div className="flex items-center space-x-2 ml-4">
                        {task.priority && (
                          <span className={`px-2 py-1 rounded text-xs font-medium border ${getPriorityBadgeClass(task.priority)}`}>
                            {task.priority}
                          </span>
                        )}
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadgeClass(task.status)}`}>
                          {task.status}
                        </span>
                      </div>
                    </div>

                    {task.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {task.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center space-x-4">
                        {task.assignee && (
                          <span className="flex items-center">
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                            {task.assignee}
                          </span>
                        )}
                      </div>
                      {task.updatedAt && (
                        <span>Updated {new Date(task.updatedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </details>
        </div>
      ))}
    </div>
  );
}
