import React, { useMemo, useState, useEffect } from 'react';
import { Plus, Search, Filter, LayoutGrid, List, ArrowRight } from 'lucide-react';
import KanbanBoard from '../components/tasks/KanbanBoard';
import TaskAccordion from '../components/tasks/TaskAccordion';
import SearchFilter, { FilterOption } from '../components/SearchFilter';
import { useTaskStore, Task } from '../stores/taskStore';
import { useNotifications } from '../components/NotificationProvider';
import TaskDetailModal from '../components/tasks/TaskDetailModal';

const Tasks: React.FC = () => {
  const { tasks, createTask, updateTask, deleteTask, fetchTasks } = useTaskStore();
  const { addNotification } = useNotifications();
  
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>(tasks);

  // Fetch tasks when component mounts
  useEffect(() => {
    fetchTasks().catch(err => {
      console.error('Failed to fetch tasks:', err);
    });
  }, [fetchTasks]);

  // Filter options
  const filterOptions: FilterOption<Task>[] = useMemo(() => [
    {
      key: 'status',
      label: 'Status',
      multiple: true,
      options: [
        { label: 'To Do', value: 'todo', predicate: (t) => t.status === 'todo' },
        { label: 'In Progress', value: 'in_progress', predicate: (t) => t.status === 'in_progress' },
        { label: 'In Review', value: 'review', predicate: (t) => t.status === 'review' },
        { label: 'Done', value: 'done', predicate: (t) => t.status === 'done' },
      ],
    },
    {
      key: 'priority',
      label: 'Priority',
      multiple: false,
      options: [
        { label: 'High', value: 'high', predicate: (t) => t.priority === 'high' },
        { label: 'Medium', value: 'medium', predicate: (t) => t.priority === 'medium' },
        { label: 'Low', value: 'low', predicate: (t) => t.priority === 'low' },
      ],
    },
    {
      key: 'dueDate',
      label: 'Due Date',
      multiple: true,
      options: [
        { 
          label: 'Overdue', 
          value: 'overdue', 
          predicate: (t) => t.dueDate ? new Date(t.dueDate) < new Date() : false 
        },
        { 
          label: 'Today', 
          value: 'today', 
          predicate: (t) => {
            if (!t.dueDate) return false;
            const today = new Date();
            const due = new Date(t.dueDate);
            return today.toDateString() === due.toDateString();
          }
        },
        { 
          label: 'This Week', 
          value: 'this_week', 
          predicate: (t) => {
            if (!t.dueDate) return false;
            const today = new Date();
            const due = new Date(t.dueDate);
            const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
            return due >= today && due <= weekFromNow;
          }
        },
      ],
    },
  ], []);

  // When filtered tasks change, update UI
  React.useEffect(() => {
    setFilteredTasks(tasks);
  }, [tasks]);

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
  };

  const handleStatusChange = (taskId: string, newStatus: Task['status']) => {
    updateTask(taskId, { status: newStatus });
    addNotification({
      type: 'success',
      title: 'Task updated',
      message: `Task status changed to ${newStatus.replace('_', ' ')}`,
    });
  };

  const handleDeleteTask = (taskId: string) => {
    deleteTask(taskId);
    addNotification({
      type: 'info',
      title: 'Task deleted',
      message: 'Task has been removed',
    });
  };

  const handleCreateTask = () => {
    setShowNewTaskModal(true);
  };

  const handleSaveTask = (taskData: Partial<Task>) => {
    if (selectedTask) {
      updateTask(selectedTask.id, taskData);
      addNotification({
        type: 'success',
        title: 'Task updated',
        message: 'Changes saved successfully',
      });
    } else {
      createTask({
        title: taskData.title || '',
        description: taskData.description,
        priority: taskData.priority || 'medium',
        dueDate: taskData.dueDate,
        tags: taskData.tags,
        assignee: taskData.assignee,
      });
      addNotification({
        type: 'success',
        title: 'Task created',
        message: 'New task has been created',
      });
    }
    setShowNewTaskModal(false);
    setSelectedTask(null);
  };

  const handleCloseModal = () => {
    setShowNewTaskModal(false);
    setSelectedTask(null);
  };

  const taskStats = useMemo(() => {
    return {
      total: filteredTasks.length,
      todo: filteredTasks.filter(t => t.status === 'todo').length,
      inProgress: filteredTasks.filter(t => t.status === 'in_progress').length,
      inReview: filteredTasks.filter(t => t.status === 'review').length,
      done: filteredTasks.filter(t => t.status === 'done').length,
    };
  }, [filteredTasks]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Tasks</h1>
          <p className="text-gray-400">Manage and track your tasks</p>
        </div>
        <button
          onClick={handleCreateTask}
          className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg font-semibold hover:bg-white/90 transition-colors"
        >
          <Plus size={20} />
          New Task
        </button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-black/30 backdrop-blur-sm rounded-lg p-4 border border-white/10">
          <div className="text-2xl font-bold text-white">{taskStats.total}</div>
          <div className="text-sm text-gray-400">Total</div>
        </div>
        <div className="bg-yellow-500/10 backdrop-blur-sm rounded-lg p-4 border border-yellow-500/20">
          <div className="text-2xl font-bold text-yellow-400">{taskStats.todo}</div>
          <div className="text-sm text-gray-400">To Do</div>
        </div>
        <div className="bg-blue-500/10 backdrop-blur-sm rounded-lg p-4 border border-blue-500/20">
          <div className="text-2xl font-bold text-blue-400">{taskStats.inProgress}</div>
          <div className="text-sm text-gray-400">In Progress</div>
        </div>
        <div className="bg-purple-500/10 backdrop-blur-sm rounded-lg p-4 border border-purple-500/20">
          <div className="text-2xl font-bold text-purple-400">{taskStats.inReview}</div>
          <div className="text-sm text-gray-400">In Review</div>
        </div>
        <div className="bg-green-500/10 backdrop-blur-sm rounded-lg p-4 border border-green-500/20">
          <div className="text-2xl font-bold text-green-400">{taskStats.done}</div>
          <div className="text-sm text-gray-400">Done</div>
        </div>
      </div>

      {/* Search & Filter */}
      <SearchFilter
        items={tasks}
        onFilteredItemsChange={setFilteredTasks}
        searchFields={['title', 'description']}
        filterOptions={filterOptions}
        placeholder="Search tasks..."
        showCount
      />

      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('kanban')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              viewMode === 'kanban'
                ? 'bg-white/10 text-white'
                : 'text-gray-400 hover:bg-white/5'
            }`}
          >
            <LayoutGrid size={18} />
            <span className="text-sm">Kanban</span>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              viewMode === 'list'
                ? 'bg-white/10 text-white'
                : 'text-gray-400 hover:bg-white/5'
            }`}
          >
            <List size={18} />
            <span className="text-sm">List</span>
          </button>
        </div>

        {filteredTasks.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <ArrowRight size={16} />
            <span>Showing {filteredTasks.length} of {tasks.length} tasks</span>
          </div>
        )}
      </div>

      {/* Task View */}
      {viewMode === 'kanban' ? (
        <KanbanBoard
          tasks={filteredTasks}
          onTaskClick={handleTaskClick}
          onStatusChange={handleStatusChange}
          onDeleteTask={handleDeleteTask}
        />
      ) : (
        <TaskAccordion
          tasks={filteredTasks}
          onTaskClick={handleTaskClick}
          onStatusChange={handleStatusChange}
          onDeleteTask={handleDeleteTask}
        />
      )}

      {/* Empty State */}
      {filteredTasks.length === 0 && (
        <div className="text-center py-16">
          <Search size={64} className="mx-auto text-gray-600 mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No tasks found</h3>
          <p className="text-gray-400 mb-6">
            {tasks.length === 0 
              ? "You haven't created any tasks yet." 
              : 'Try adjusting your search or filters.'}
          </p>
          {tasks.length === 0 && (
            <button
              onClick={handleCreateTask}
              className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-lg font-semibold hover:bg-white/90 transition-colors"
            >
              <Plus size={20} />
              Create your first task
            </button>
          )}
        </div>
      )}

      {/* Task Detail Modal */}
      {showNewTaskModal && (
        <TaskDetailModal
          task={null}
          onSave={handleSaveTask}
          onClose={handleCloseModal}
        />
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onSave={handleSaveTask}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};

export default Tasks;
