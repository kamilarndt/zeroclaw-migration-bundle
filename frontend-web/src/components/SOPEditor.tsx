import { useState, useEffect, useRef, useCallback } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  NodeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';

interface SOPNodeData {
  label: string;
  type: 'trigger' | 'agent' | 'tool' | 'condition';
  config?: Record<string, any>;
}

interface SOPEditorProps {
  onSave?: (nodes: Node<SOPNodeData>[], edges: Edge[]) => void;
  initialNodes?: Node<SOPNodeData>[];
  initialEdges?: Edge[];
}

// Custom node component
function CustomNode({ data, selected }: { data: SOPNodeData; selected?: boolean }) {
  const getNodeColor = () => {
    switch (data.type) {
      case 'trigger': return 'bg-indigo-600 border-indigo-400';
      case 'agent': return 'bg-green-600 border-green-400';
      case 'tool': return 'bg-orange-600 border-orange-400';
      case 'condition': return 'bg-purple-600 border-purple-400';
      default: return 'bg-neutral-600 border-neutral-400';
    }
  };

  return (
    <div
      data-testid={`sop-node-${data.type}`}
      className={`px-4 py-2 rounded-lg border-2 shadow-lg ${getNodeColor()} ${selected ? 'ring-2 ring-white' : ''}`}
    >
      <div className="text-sm font-medium text-white">{data.label}</div>
      <div className="text-xs text-neutral-200 capitalize">{data.type}</div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  custom: CustomNode,
};

export function SOPEditor({ onSave, initialNodes, initialEdges }: SOPEditorProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<SOPNodeData>(
    initialNodes || [
      {
        id: '1',
        type: 'custom',
        data: { label: 'Start Trigger', type: 'trigger' },
        position: { x: 250, y: 50 },
      },
      {
        id: '2',
        type: 'custom',
        data: { label: 'Process Data', type: 'agent' },
        position: { x: 250, y: 200 },
      },
    ]
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    initialEdges || [
      {
        id: 'e1-2',
        source: '1',
        target: '2',
        animated: true,
      },
    ]
  );

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const addNode = (type: 'trigger' | 'agent' | 'tool' | 'condition') => {
    const newNode: Node<SOPNodeData> = {
      id: `node-${Date.now()}`,
      type: 'custom',
      data: {
        label: `New ${type}`,
        type,
      },
      position: {
        x: Math.random() * 400 + 100,
        y: Math.random() * 300 + 100,
      },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const handleSave = () => {
    if (onSave) {
      onSave(nodes, edges);
    }
  };

  return (
    <div className="flex flex-col h-full" data-testid="sop-editor">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-neutral-950 border-b border-neutral-800">
        <h1 className="text-lg font-semibold">SOP Editor</h1>
        <div className="flex gap-2">
          <button
            onClick={() => addNode('trigger')}
            className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
            data-testid="add-trigger-node"
          >
            + Trigger
          </button>
          <button
            onClick={() => addNode('agent')}
            className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-500 rounded-lg transition-colors"
            data-testid="add-agent-node"
          >
            + Agent
          </button>
          <button
            onClick={() => addNode('tool')}
            className="px-3 py-1.5 text-sm bg-orange-600 hover:bg-orange-500 rounded-lg transition-colors"
            data-testid="add-tool-node"
          >
            + Tool
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
            data-testid="save-sop"
          >
            Save
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 bg-neutral-900" ref={reactFlowWrapper} data-testid="reactflow-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          data-testid="reactflow-instance"
        >
          <Background color="#4b5563" gap={16} />
          <Controls data-testid="reactflow-controls" />
          <MiniMap
            nodeColor={(node) => {
              const data = node.data as SOPNodeData;
              switch (data.type) {
                case 'trigger': return '#4f46e5';
                case 'agent': return '#16a34a';
                case 'tool': return '#ea580c';
                case 'condition': return '#9333ea';
                default: return '#4b5563';
              }
            }}
            data-testid="reactflow-minimap"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
