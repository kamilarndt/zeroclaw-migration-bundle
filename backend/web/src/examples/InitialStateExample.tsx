/**
 * Example component demonstrating useInitialHandState hook
 *
 * This example shows how to:
 * 1. Use the useInitialHandState hook to fetch initial state
 * 2. Access the UI store to get hands and tasks
 * 3. Handle loading and error states
 * 4. Use store actions to update state
 */

import React from 'react';
import { useInitialHandState } from '../hooks/useInitialHandState';
import { useUiStore } from '../stores/store';

export function InitialStateExample(): React.ReactElement {
  // Fetch initial state on mount
  useInitialHandState();

  // Access store state
  const { hands, tasks, isLoading, error, addTask, updateTask } = useUiStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading initial state...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="text-red-800">Error loading state: {error}</div>
        <p className="text-sm text-red-600 mt-2">
          Using cached data from localStorage
        </p>
      </div>
    );
  }

  const handleAddTask = () => {
    const newTask = {
      id: `task-${Date.now()}`,
      title: `New Task ${tasks.length + 1}`,
      status: 'Todo' as const,
      createdAt: new Date().toISOString(),
    };
    addTask(newTask);
  };

  const handleUpdateTaskStatus = (taskId: string) => {
    updateTask(taskId, { status: 'Done' as const });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Hands Section */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Active Hands</h2>
        {hands.length === 0 ? (
          <p className="text-gray-500">No active hands</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {hands.map((hand) => (
              <div
                key={hand.id}
                className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">{hand.name}</h3>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      hand.status === 'running'
                        ? 'bg-green-100 text-green-800'
                        : hand.status === 'idle'
                        ? 'bg-gray-100 text-gray-800'
                        : hand.status === 'error'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {hand.status}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  <div>Type: {hand.type}</div>
                  <div>Created: {new Date(hand.createdAt).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Tasks Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Tasks</h2>
          <button
            onClick={handleAddTask}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Add Task
          </button>
        </div>
        {tasks.length === 0 ? (
          <p className="text-gray-500">No tasks yet</p>
        ) : (
          <ul className="space-y-2">
            {tasks.map((task) => (
              <li
                key={task.id}
                className="p-4 bg-white border border-gray-200 rounded-lg flex items-center justify-between"
              >
                <div>
                  <div className="font-medium">{task.title}</div>
                  {task.description && (
                    <p className="text-sm text-gray-600 mt-1">
                      {task.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 text-xs rounded ${
                      task.status === 'Done'
                        ? 'bg-green-100 text-green-800'
                        : task.status === 'InProgress'
                        ? 'bg-blue-100 text-blue-800'
                        : task.status === 'Review'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {task.status}
                  </span>
                  {task.status !== 'Done' && (
                    <button
                      onClick={() => handleUpdateTaskStatus(task.id)}
                      className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                    >
                      Complete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
