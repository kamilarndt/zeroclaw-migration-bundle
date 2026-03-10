import { useState, useEffect } from 'react';

interface ActiveHand {
  hand_id: string;
  current_task: string;
  progress: number;
}

export function ActiveHands() {
  const [hands, setHands] = useState<ActiveHand[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Replace with actual API call
    // fetch('/v1/agent/active')
    //   .then(res => res.json())
    //   .then(data => setHands(data.hands || []))
    //   .finally(() => setLoading(false));
    setLoading(false);
  }, []);

  const handleStop = async (handId: string) => {
    try {
      await fetch(`/v1/agent/${handId}/interrupt`, { method: 'POST' });
      setHands(prev => prev.filter(h => h.hand_id !== handId));
    } catch (error) {
      console.error('Failed to stop agent:', error);
    }
  };

  if (loading) {
    return (
      <div className="active-hands p-4">
        <div className="animate-pulse">Loading active agents...</div>
      </div>
    );
  }

  if (hands.length === 0) {
    return (
      <div className="active-hands p-4">
        <p className="text-gray-400 text-sm">No active agents running</p>
      </div>
    );
  }

  return (
    <div className="active-hands">
      <h3 className="text-lg font-semibold mb-4">Active Agents</h3>
      <div className="space-y-3">
        {hands.map(hand => (
          <div key={hand.hand_id} className="hand-card bg-gray-800 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">{hand.current_task}</span>
              <span className="text-xs text-gray-400">ID: {hand.hand_id}</span>
            </div>
            <div className="mb-3">
              <progress 
                value={hand.progress} 
                max={100} 
                className="w-full h-2"
              />
              <p className="text-xs text-gray-400 mt-1">{hand.progress}% complete</p>
            </div>
            <button 
              onClick={() => handleStop(hand.hand_id)} 
              className="btn-stop bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors"
            >
              STOP
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
