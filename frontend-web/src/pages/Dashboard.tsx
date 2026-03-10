import React, { useMemo, useCallback } from "react";
import MetricCard from '../components/dashboard/MetricCard';
import ActiveHands from '../components/dashboard/ActiveHands';
import { useMetricsStore } from '../stores/metricsStore';
import { useTaskStore } from '../stores/taskStore';
import { 
  Clock, 
  Zap, 
  Database, 
  Activity,
  Sparkles,
  AlertCircle
} from 'lucide-react';

const Dashboard: React.FC = () => {
  const { history, activeHands, metrics } = useMetricsStore();
  const { tasks } = useTaskStore();

  // Memoized calculations
  const stats = useMemo(() => {
    if (history.length === 0) {
      return {
        totalRequests: 0,
        totalDuration: 0,
        totalTokens: 0,
        avgDuration: 0,
        recentErrors: []
      };
    }

    const last24h = history.filter(h => 
      new Date(h.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    return {
      totalRequests: history.length,
      totalDuration: history.reduce((acc, h) => acc + h.duration, 0),
      totalTokens: history.reduce((acc, h) => {
        const input = h.apiCost?.inputTokens || 0;
        const output = h.apiCost?.outputTokens || 0;
        return acc + input + output;
      }, 0),
      avgDuration: history.length > 0 
        ? history.reduce((acc, h) => acc + h.duration, 0) / history.length 
        : 0,
      recentErrors: history.filter(h => h.error).slice(-5)
    };
  }, [history]);

  const costHistory = useMemo(() => 
    history.map(h => h.apiCost?.total || 0),
    [history]
  );

  const taskStats = useMemo(() => {
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    const totalTasks = tasks.length;
    
    return {
      completed: completedTasks,
      total: totalTasks,
      progress: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
    };
  }, [tasks]);

  const handleMetricClick = useCallback((title: string) => {
    console.log(`Metric clicked: ${title}`);
    // Future: Open detailed view for this metric
  }, []);

  return (
    <div className="space-y-6 p-6" data-testid="dashboard-page">
      {/* Header */}
      <div data-testid="dashboard-header">
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-gray-400">Monitor your ZeroClaw agents and performance</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="kpi-cards-grid">
        <MetricCard
          title="Total Requests"
          value={stats.totalRequests}
          icon={Activity}
          onClick={() => handleMetricClick('Total Requests')}
          dataTestId="kpi-total-requests"
        />
        <MetricCard
          title="Avg Duration"
          value={stats.avgDuration.toFixed(2)}
          unit="ms"
          icon={Clock}
          color="#ff9f43"
          onClick={() => handleMetricClick('Avg Duration')}
          dataTestId="kpi-avg-duration"
        />
        <MetricCard
          title="Total Tokens"
          value={stats.totalTokens}
          icon={Sparkles}
          color="#9b59b6"
          onClick={() => handleMetricClick('Total Tokens')}
          dataTestId="kpi-total-tokens"
        />
        <MetricCard
          title="Active Hands"
          value={activeHands.length}
          icon={Zap}
          color="#e74c3c"
          onClick={() => handleMetricClick('Active Hands')}
          dataTestId="kpi-active-hands"
        />
      </div>

      {/* Task Progress */}
      <div className="bg-black/30 backdrop-blur-sm rounded-xl p-6 border border-white/10" data-testid="task-progress-section">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Database size={24} />
          Task Progress
        </h2>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Completed Tasks</span>
              <span className="text-white font-semibold">
                {taskStats.completed} / {taskStats.total}
              </span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-400 to-blue-500 transition-all duration-500"
                style={{ width: `${taskStats.progress}%` }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">
                {tasks.filter(t => t.status === 'todo').length}
              </div>
              <div className="text-sm text-gray-400">To Do</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">
                {tasks.filter(t => t.status === 'in_progress').length}
              </div>
              <div className="text-sm text-gray-400">In Progress</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">
                {tasks.filter(t => t.status === 'review').length}
              </div>
              <div className="text-sm text-gray-400">In Review</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">
                {taskStats.completed}
              </div>
              <div className="text-sm text-gray-400">Done</div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Hands */}
      <ActiveHands hands={activeHands} dataTestId="active-processes-section" />

      {/* Recent Errors */}
      {stats.recentErrors.length > 0 && (
        <div className="bg-red-500/10 backdrop-blur-sm rounded-xl p-6 border border-red-500/20">
          <h2 className="text-xl font-semibold text-red-400 mb-4 flex items-center gap-2">
            <AlertCircle size={24} />
            Recent Errors
          </h2>
          <div className="space-y-3">
            {stats.recentErrors.map((error, index) => (
              <div
                key={`${error.timestamp}-${index}`}
                className="bg-red-500/5 rounded-lg p-4 border border-red-500/10"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-red-400 font-semibold">{error.error}</span>
                  <span className="text-sm text-gray-400">
                    {new Date(error.timestamp).toLocaleString()}
                  </span>
                </div>
                {error.path && (
                  <p className="text-sm text-gray-500">{error.path}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance History */}
      {costHistory.length > 0 && (
        <div className="bg-black/30 backdrop-blur-sm rounded-xl p-6 border border-white/10" data-testid="finops-chart-section">
          <h2 className="text-xl font-semibold text-white mb-4">API Cost History</h2>
          <div className="h-64 flex items-end gap-1" data-testid="api-cost-chart">
            {costHistory.slice(-100).map((cost, index) => (
              <div
                key={index}
                className="flex-1 bg-gradient-to-t from-blue-500 to-purple-500 rounded-t-sm transition-all hover:from-blue-400 hover:to-purple-400"
                style={{
                  height: `${Math.max(5, (cost / Math.max(...costHistory)) * 100)}%`,
                }}
                title={`Cost: $${cost.toFixed(4)}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
