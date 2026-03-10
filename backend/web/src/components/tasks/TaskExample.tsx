/**
 * TaskExample.tsx
 * 
 * Example usage of KanbanBoard and TaskAccordion components.
 * 
 * Usage:
 * import { KanbanBoard, TaskAccordion } from './components/tasks';
 * 
 * const sampleTasks = [
 *   {
 *     id: '1',
 *     title: 'Setup project structure',
 *     description: 'Create initial directory structure and configuration files',
 *     status: 'Done',
 *     priority: 'high',
 *     assignee: 'John Doe',
 *     createdAt: new Date().toISOString(),
 *   },
 *   // ... more tasks
 * ];
 * 
 * function App() {
 *   const handleTaskUpdate = (taskId: string, newStatus: Task['status']) => {
 *     console.log(`Task ${taskId} moved to ${newStatus}`);
 *   };
 * 
 *   return (
 *     <div className="p-8">
 *       <h1 className="text-3xl font-bold mb-8">Project Tasks</h1>
 *       
 *       <div className="mb-8">
 *         <h2 className="text-2xl font-semibold mb-4">Kanban Board</h2>
 *         <KanbanBoard 
 *           initialTasks={sampleTasks}
 *           onTaskUpdate={handleTaskUpdate}
 *         />
 *       </div>
 *       
 *       <div>
 *         <h2 className="text-2xl font-semibold mb-4">Task List</h2>
 *         <TaskAccordion 
 *           tasks={sampleTasks}
 *           onTaskClick={(task) => console.log('Clicked task:', task)}
 *         />
 *       </div>
 *     </div>
 *   );
 * }
 */

import { KanbanBoard } from './KanbanBoard';
import { TaskAccordion } from './TaskAccordion';
import { Task } from '../../types/tasks';

const sampleTasks: Task[] = [
  {
    id: '1',
    title: 'Setup project structure',
    description: 'Create initial directory structure and configuration files',
    status: 'Done',
    priority: 'high',
    assignee: 'John Doe',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Implement authentication',
    description: 'Add login and registration functionality with JWT tokens',
    status: 'InProgress',
    priority: 'high',
    assignee: 'Jane Smith',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '3',
    title: 'Create dashboard UI',
    description: 'Build the main dashboard with charts and statistics',
    status: 'InProgress',
    priority: 'medium',
    assignee: 'Bob Johnson',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '4',
    title: 'Write unit tests',
    description: 'Add comprehensive unit tests for all components',
    status: 'Todo',
    priority: 'medium',
    assignee: 'Alice Brown',
    createdAt: new Date().toISOString(),
  },
  {
    id: '5',
    title: 'Setup CI/CD pipeline',
    description: 'Configure GitHub Actions for automated testing and deployment',
    status: 'Review',
    priority: 'low',
    assignee: 'Charlie Wilson',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '6',
    title: 'Documentation',
    description: 'Write API documentation and user guides',
    status: 'Todo',
    priority: 'low',
    createdAt: new Date().toISOString(),
  },
];

export function TaskExample() {
  const handleTaskUpdate = (taskId: string, newStatus: Task['status']) => {
    console.log(`Task ${taskId} moved to ${newStatus}`);
  };

  const handleTaskClick = (task: Task) => {
    console.log('Clicked task:', task);
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-8 text-gray-900">Project Tasks</h1>
      
      <div className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">Kanban Board</h2>
        <p className="text-gray-600 mb-4">Drag and drop tasks between columns to update their status.</p>
        <KanbanBoard 
          initialTasks={sampleTasks}
          onTaskUpdate={handleTaskUpdate}
        />
      </div>
      
      <div>
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">Task List</h2>
        <p className="text-gray-600 mb-4">Click on task groups to expand/collapse. Click on individual tasks for details.</p>
        <TaskAccordion 
          tasks={sampleTasks}
          onTaskClick={handleTaskClick}
        />
      </div>
    </div>
  );
}
