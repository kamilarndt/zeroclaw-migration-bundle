import { useState, useEffect, useRef } from 'react';
import { Search, Trash2, Zap } from 'lucide-react';

interface MemoryNode {
  id: string;
  content: string;
  category: string;
  timestamp: number;
  strength: number;
  x: number;
  y: number;
}

interface MemoryExplorerProps {
  onForget?: (nodeId: string) => void;
  onSelectNode?: (node: MemoryNode) => void;
}

export function MemoryExplorer({ onForget, onSelectNode }: MemoryExplorerProps) {
  const [memories, setMemories] = useState<MemoryNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<MemoryNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);

  // Generate mock memory data for visualization
  useEffect(() => {
    const generateMockMemories = () => {
      const categories = ['conversation', 'tool_use', 'user_pref', 'system'];
      const contents = [
        'User prefers concise answers',
        'Recent file read operation on config.toml',
        'Async safety patterns in Rust',
        'Python asyncio best practices',
        'Vector database query optimization',
        'WebSocket connection established',
        'Authentication token refreshed',
        'Memory consolidation completed',
      ];

      const mockNodes: MemoryNode[] = Array.from({ length: 12 }, (_, i) => ({
        id: `mem-${i}`,
        content: contents[i % contents.length],
        category: categories[i % categories.length],
        timestamp: Date.now() - i * 3600000,
        strength: 1 - (i * 0.05),
        x: 100 + (i % 4) * 200 + Math.random() * 50,
        y: 100 + Math.floor(i / 4) * 150 + Math.random() * 50,
      }));

      setMemories(mockNodes);
      setLoading(false);
    };

    // Simulate API call delay
    const timer = setTimeout(generateMockMemories, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleNodeClick = (node: MemoryNode) => {
    setSelectedNode(node);
    if (onSelectNode) {
      onSelectNode(node);
    }
  };

  const handleForget = () => {
    if (selectedNode && onForget) {
      onForget(selectedNode.id);
      setMemories((prev) => prev.filter((m) => m.id !== selectedNode.id));
      setSelectedNode(null);
    }
  };

  const filteredMemories = memories.filter((mem) =>
    mem.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    mem.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'conversation': return '#4f46e5'; // indigo
      case 'tool_use': return '#16a34a'; // green
      case 'user_pref': return '#ea580c'; // orange
      case 'system': return '#9333ea'; // purple
      default: return '#4b5563'; // neutral
    }
  };

  return (
    <div className="flex flex-col h-full" data-testid="memory-explorer">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-neutral-950 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <Zap className="w-5 h-5 text-yellow-400" />
          <h1 className="text-lg font-semibold">Memory Explorer</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search memories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-1.5 text-sm bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:border-indigo-500"
              data-testid="memory-search-input"
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* SVG Visualization */}
        <div className="flex-1 relative bg-neutral-900 overflow-hidden" data-testid="memory-visualization">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center text-neutral-500">
              Loading memory graph...
            </div>
          ) : (
            <svg
              ref={svgRef}
              className="w-full h-full"
              data-testid="memory-svg"
            >
              {/* Connections */}
              <g data-testid="memory-connections">
                {filteredMemories.map((mem, i) => {
                  if (i === 0) return null;
                  const prevMem = filteredMemories[i - 1];
                  return (
                    <line
                      key={`conn-${i}`}
                      x1={prevMem.x}
                      y1={prevMem.y}
                      x2={mem.x}
                      y2={mem.y}
                      stroke="#374151"
                      strokeWidth="1"
                      strokeDasharray="4"
                      data-testid={`memory-connection-${i}`}
                    />
                  );
                })}
              </g>

              {/* Memory Nodes */}
              <g data-testid="memory-nodes">
                {filteredMemories.map((mem) => (
                  <g
                    key={mem.id}
                    data-testid={`memory-node-${mem.id}`}
                    className="cursor-pointer"
                    onClick={() => handleNodeClick(mem)}
                  >
                    {/* Node circle */}
                    <circle
                      cx={mem.x}
                      cy={mem.y}
                      r={20 + mem.strength * 15}
                      fill={getCategoryColor(mem.category)}
                      opacity={mem.strength}
                      stroke={selectedNode?.id === mem.id ? '#ffffff' : 'none'}
                      strokeWidth={selectedNode?.id === mem.id ? '3' : '0'}
                      data-testid={`memory-node-circle-${mem.id}`}
                    />

                    {/* Node label */}
                    <text
                      x={mem.x}
                      y={mem.y + 40}
                      textAnchor="middle"
                      fill="#9ca3af"
                      fontSize="10"
                      data-testid={`memory-node-label-${mem.id}`}
                    >
                      {mem.content.slice(0, 20)}...
                    </text>

                    {/* Category badge */}
                    <text
                      x={mem.x}
                      y={mem.y - 30}
                      textAnchor="middle"
                      fill="#6b7280"
                      fontSize="8"
                      data-testid={`memory-node-category-${mem.id}`}
                    >
                      {mem.category}
                    </text>
                  </g>
                ))}
              </g>
            </svg>
          )}
        </div>

        {/* Side Panel */}
        {selectedNode && (
          <div
            className="w-80 bg-neutral-950 border-l border-neutral-800 p-4 overflow-y-auto"
            data-testid="memory-detail-panel"
          >
            <h3 className="text-lg font-semibold mb-3">Memory Details</h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-neutral-500 uppercase">Content</label>
                <p className="text-sm text-neutral-300 mt-1">{selectedNode.content}</p>
              </div>

              <div>
                <label className="text-xs text-neutral-500 uppercase">Category</label>
                <p className="text-sm text-neutral-300 mt-1 capitalize">{selectedNode.category}</p>
              </div>

              <div>
                <label className="text-xs text-neutral-500 uppercase">Strength</label>
                <div className="mt-1">
                  <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600"
                      style={{ width: `${selectedNode.strength * 100}%` }}
                      data-testid="memory-strength-bar"
                    />
                  </div>
                  <p className="text-xs text-neutral-400 mt-1">{(selectedNode.strength * 100).toFixed(0)}%</p>
                </div>
              </div>

              <div>
                <label className="text-xs text-neutral-500 uppercase">Timestamp</label>
                <p className="text-sm text-neutral-300 mt-1">
                  {new Date(selectedNode.timestamp).toLocaleString()}
                </p>
              </div>

              <div className="pt-3 border-t border-neutral-800">
                <button
                  onClick={handleForget}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                  data-testid="forget-memory-button"
                >
                  <Trash2 className="w-4 h-4" />
                  Forget Memory
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats Footer */}
      <div className="px-4 py-2 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between text-sm">
        <div className="flex gap-4">
          <span className="text-neutral-400">
            Total: <span className="text-neutral-200" data-testid="total-memories-count">{memories.length}</span>
          </span>
          <span className="text-neutral-400">
            Showing: <span className="text-neutral-200" data-testid="visible-memories-count">{filteredMemories.length}</span>
          </span>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-indigo-600" />
            Conversation
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-600" />
            Tool Use
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-orange-600" />
            User Pref
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-purple-600" />
            System
          </span>
        </div>
      </div>
    </div>
  );
}
