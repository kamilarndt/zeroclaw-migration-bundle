import { useState } from 'react';
import { X, MessageSquare, CheckSquare, Activity } from 'lucide-react';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';
import { SwarmChatter } from '@/components/chat/SwarmChatter';
import { ActiveHands } from '@/components/system/ActiveHands';
import { Task } from '@/types/tasks';

type TabType = 'tasks' | 'chat' | 'hands';

export default function RightPanel({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<TabType>('tasks');

  // Sample tasks - w przyszłości pobrane z /v1/tasks API
  const [tasks, setTasks] = useState<Task[]>([
    { id: '1', title: 'Setup ZeroClaw', status: 'Done', priority: 'high' },
    { id: '2', title: 'Configure Ollama', status: 'Done', priority: 'high' },
    { id: '3', title: 'Test A2A Protocol', status: 'InProgress', priority: 'medium' },
    { id: '4', title: 'Implement Kanban UI', status: 'Todo', priority: 'medium' },
    { id: '5', title: 'Add WebSocket A2A stream', status: 'Todo', priority: 'low' },
  ]);

  const handleTaskUpdate = (taskId: string, newStatus: Task['status']) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
  };

  return (
    <div className="fixed right-0 top-0 h-screen w-80 bg-gray-900 border-l border-gray-800 flex flex-col z-20">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h2 className="text-lg font-semibold text-white">Panel</h2>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-800 rounded transition-colors"
          aria-label="Close panel"
          title="Close panel"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'tasks'
              ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-800/50'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/30'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          Tasks
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'chat'
              ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-800/50'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/30'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Chat
        </button>
        <button
          onClick={() => setActiveTab('hands')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'hands'
              ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-800/50'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/30'
          }`}
        >
          <Activity className="w-4 h-4" />
          Hands
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'tasks' && (
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-300">Task Board</h3>
              <span className="text-xs text-gray-500">{tasks.filter(t => t.status !== 'Done').length} active</span>
            </div>
            <KanbanBoard
              initialTasks={tasks}
              onTaskUpdate={handleTaskUpdate}
            />
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="p-3">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Agent Swarm Chat</h3>
            <SwarmChatter />
          </div>
        )}

        {activeTab === 'hands' && (
          <div className="p-3">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Active Hands</h3>
            <ActiveHands />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-800">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{tasks.length} total</span>
          <span>{tasks.filter(t => t.status === 'Done').length} done</span>
        </div>
      </div>
    </div>
  );
}
