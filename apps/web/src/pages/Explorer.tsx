import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';
import 'reactflow/dist/style.css';
import { api } from '../lib/api';
import type { Node as GraphNode, Edge as GraphEdge } from 'shared';

export default function Explorer() {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [nodeTypeFilter, setNodeTypeFilter] = useState<string>('');

  const { data: nodesData, isLoading } = useQuery({
    queryKey: ['nodes', nodeTypeFilter, searchTerm],
    queryFn: () =>
      api.graph.nodes({
        type: nodeTypeFilter || undefined,
        search: searchTerm || undefined,
        limit: 100,
      }),
  });

  const { data: edgesData } = useQuery({
    queryKey: ['edges'],
    queryFn: () => api.graph.edges({ limit: 200 }),
  });

  const { data: selectedNodeData } = useQuery({
    queryKey: ['node', selectedNodeId],
    queryFn: () => api.graph.node(selectedNodeId!),
    enabled: !!selectedNodeId,
  });

  const nodes =
    nodesData?.nodes.map((node, index) => ({
      id: node.id,
      data: { label: node.name },
      position: { x: (index % 5) * 200, y: Math.floor(index / 5) * 100 },
      style: {
        background: getNodeColor(node.type),
        color: '#fff',
        padding: 10,
        borderRadius: 5,
      },
    })) || [];

  const edges =
    edgesData?.edges.map((edge) => ({
      id: edge.id,
      source: edge.sourceId,
      target: edge.targetId,
      label: edge.type,
      type: 'smoothstep',
    })) || [];

  return (
    <div className="flex h-[calc(100vh-8rem)]">
      <div className="w-2/3 border-r border-gray-200 bg-white">
        <div className="p-4 border-b border-gray-200">
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Search nodes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={nodeTypeFilter}
              onChange={(e) => setNodeTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="paper">Paper</option>
              <option value="method">Method</option>
              <option value="concept">Concept</option>
              <option value="dataset">Dataset</option>
              <option value="metric">Metric</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">Loading graph...</div>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        )}
      </div>

      <div className="w-1/3 p-6 bg-gray-50 overflow-y-auto">
        {selectedNodeData ? (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Node Details</h3>
            <div className="bg-white rounded-lg shadow p-4 space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-500">Name</label>
                <p className="text-base text-gray-900">{selectedNodeData.node.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Type</label>
                <p className="text-base text-gray-900 capitalize">
                  {selectedNodeData.node.type}
                </p>
              </div>
              {selectedNodeData.node.description && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Description</label>
                  <p className="text-sm text-gray-700">{selectedNodeData.node.description}</p>
                </div>
              )}
            </div>

            {selectedNodeData.outgoingEdges.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Outgoing Relationships ({selectedNodeData.outgoingEdges.length})
                </h4>
                <div className="space-y-2">
                  {selectedNodeData.outgoingEdges.map((edge) => (
                    <div key={edge.id} className="bg-white rounded p-2 text-sm">
                      <span className="text-gray-600">{edge.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedNodeData.incomingEdges.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Incoming Relationships ({selectedNodeData.incomingEdges.length})
                </h4>
                <div className="space-y-2">
                  {selectedNodeData.incomingEdges.map((edge) => (
                    <div key={edge.id} className="bg-white rounded p-2 text-sm">
                      <span className="text-gray-600">{edge.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-gray-500 mt-8">
            <p>Select a node to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}

function getNodeColor(type: string): string {
  const colors: Record<string, string> = {
    paper: '#3b82f6',
    method: '#10b981',
    concept: '#f59e0b',
    dataset: '#8b5cf6',
    metric: '#ef4444',
  };
  return colors[type] || '#6b7280';
}
