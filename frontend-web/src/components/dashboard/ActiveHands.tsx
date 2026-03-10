import React, { useMemo } from 'react';
import { Hand as HandType } from '../../stores/metricsStore';
import { Zap, Cpu, Activity, AlertCircle, CheckCircle } from 'lucide-react';

interface ActiveHandsProps {
  hands: HandType[];
  dataTestId?: string;
}

const ActiveHands = React.memo(({ hands, dataTestId }: ActiveHandsProps) => {
  const sortedHands = useMemo(() => {
    return [...hands].sort((a, b) => {
      if (a.isIdle !== b.isIdle) return a.isIdle ? 1 : -1;
      return new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime();
    });
  }, [hands]);

  const stats = useMemo(() => {
    return {
      active: hands.filter(h => !h.isIdle).length,
      idle: hands.filter(h => h.isIdle).length,
      avgLoad: hands.length > 0 
        ? hands.reduce((acc, h) => acc + h.systemLoad, 0) / hands.length 
        : 0
    };
  }, [hands]);

  const getLoadColor = (load: number): string => {
    if (load < 0.5) return 'text-green-400';
    if (load < 0.8) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getStatusIcon = (hand: HandType) => {
    if (hand.isIdle) return <CheckCircle size={16} className="text-gray-500" />;
    if (hand.systemLoad > 0.8) return <AlertCircle size={16} className="text-red-400" />;
    return <Activity size={16} className="text-blue-400" />;
  };

  if (hands.length === 0) {
    return (
      <div className="bg-black/30 backdrop-blur-sm rounded-xl p-6 border border-white/10" data-testid={dataTestId}>
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Zap size={24} />
          Active Hands
        </h2>
        <div className="text-center py-8">
          <Zap size={48} className="mx-auto text-gray-600 mb-4" />
          <p className="text-gray-500">No active hands</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black/30 backdrop-blur-sm rounded-xl p-6 border border-white/10" data-testid={dataTestId}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Zap size={24} />
          Active Hands
        </h2>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-400">
            {stats.active} active / {stats.idle} idle
          </span>
          <span className={`font-semibold ${getLoadColor(stats.avgLoad)}`}>
            {(stats.avgLoad * 100).toFixed(0)}% avg load
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {sortedHands.map((hand) => (
          <div
            key={hand.id}
            className={`bg-white/5 rounded-lg p-4 border ${
              hand.isIdle ? 'border-white/5' : 'border-white/10'
            } hover:bg-white/10 transition-all`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {getStatusIcon(hand)}
                  <span className="font-semibold text-white">{hand.name}</span>
                  {hand.model && (
                    <span className="text-xs px-2 py-0.5 bg-white/10 rounded-full text-gray-400">
                      {hand.model}
                    </span>
                  )}
                </div>
                {hand.description && (
                  <p className="text-gray-400 text-sm">{hand.description}</p>
                )}
              </div>
              
              <div className="text-right">
                <div className={`text-lg font-semibold ${getLoadColor(hand.systemLoad)}`}>
                  {(hand.systemLoad * 100).toFixed(0)}%
                </div>
                <div className="text-xs text-gray-500">System Load</div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Last Active</div>
                <div className="text-white">
                  {new Date(hand.lastActiveAt).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Tasks Completed</div>
                <div className="text-white">{hand.tasksCompleted || 0}</div>
              </div>
            </div>

            {hand.systemLoad > 0.8 && (
              <div className="mt-3 flex items-center gap-2 text-sm text-yellow-400">
                <AlertCircle size={16} />
                <span>High load - consider scaling</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});

ActiveHands.displayName = 'ActiveHands';

export default ActiveHands;
