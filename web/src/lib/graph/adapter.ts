/**
 * Graph Adapter - Converts backend DTOs to React Flow nodes/edges
 */
import type { Node, Edge } from '@xyflow/react';
import type { WorkflowVisualSummary, WorkflowVisualEdge, RunVisualState, NodeStatus } from '../../api';

export interface FlowNodeData extends Record<string, unknown> {
  id: string;
  label: string;
  sublabel?: string;
  type: string;
  status: NodeStatus;
  icon?: string;
  hasGate?: boolean;
  hasEval?: boolean;
  isCritical?: boolean;
  [key: string]: unknown;
}

export type FlowNode = Node<FlowNodeData>;
export type FlowEdge = Edge;

const nodeTypeIcons: Record<string, string> = {
  start: '▶',
  end: '⏹',
  agent: '🤖',
  gate: '🚧',
  eval: '📊',
  script: '📜',
};

const nodeTypeColors: Record<string, { bg: string; border: string; text: string }> = {
  start: { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-700' },
  end: { bg: 'bg-gray-50', border: 'border-gray-300', text: 'text-gray-700' },
  agent: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700' },
  gate: { bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-700' },
  eval: { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-700' },
  script: { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-700' },
};

const statusColors: Record<NodeStatus, { bg: string; border: string; text: string }> = {
  pending: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-500' },
  queued: { bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-600' },
  running: { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-600' },
  streaming: { bg: 'bg-blue-100', border: 'border-blue-500', text: 'text-blue-700' },
  gate_waiting: { bg: 'bg-yellow-50', border: 'border-yellow-400', text: 'text-yellow-700' },
  completed: { bg: 'bg-green-50', border: 'border-green-400', text: 'text-green-700' },
  failed: { bg: 'bg-red-50', border: 'border-red-400', text: 'text-red-700' },
  skipped: { bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-500' },
  cached: { bg: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-700' },
};

/**
 * Convert workflow visual nodes to React Flow nodes
 */
export function adaptWorkflowToFlowNodes(
  visualSummary: WorkflowVisualSummary,
  nodePositions?: Map<string, { x: number; y: number }>
): FlowNode[] {
  return visualSummary.visualNodes.map((node) => {
    const position = nodePositions?.get(node.id) ?? { x: 0, y: 0 };

    return {
      id: node.id,
      type: 'visualizationNode', // Custom node type
      position,
      data: {
        id: node.id,
        label: node.name,
        sublabel: node.type !== 'agent' ? node.type : undefined,
        type: node.type,
        status: 'pending',
        icon: nodeTypeIcons[node.type] ?? '📦',
        hasGate: node.hasGate,
        hasEval: node.hasEval,
        isCritical: node.hasGate,
      },
    };
  });
}

/**
 * Convert workflow visual edges to React Flow edges
 */
export function adaptWorkflowToFlowEdges(
  visualEdges: WorkflowVisualEdge[]
): FlowEdge[] {
  return visualEdges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.type === 'gate' ? 'gateEdge' : 'default',
    animated: edge.type === 'gate',
    label: edge.type === 'gate' ? 'Gate' : undefined,
    style: {
      stroke: edge.type === 'gate' ? '#f59e0b' : edge.type === 'conditional' ? '#8b5cf6' : '#6b7280',
      strokeWidth: 2,
      strokeDasharray: edge.type === 'gate' || edge.type === 'conditional' ? '5,5' : undefined,
    },
  }));
}

/**
 * Update node statuses from run visual state
 */
export function updateNodeStatusesFromRun(
  nodes: FlowNode[],
  runState: RunVisualState
): FlowNode[] {
  return nodes.map((node) => {
    const nodeState = runState.nodeStates[node.id];
    if (!nodeState) return node;

    const status = nodeState.status;

    return {
      ...node,
      data: {
        ...node.data,
        status,
        durationMs: nodeState.durationMs,
        outputPreview: nodeState.outputPreview,
        errorMessage: nodeState.errorMessage,
        isActive: runState.currentActiveNodeIds.includes(node.id),
        isFailed: runState.failedNodeIds.includes(node.id),
        isGateWaiting: runState.gateWaitingNodeIds.includes(node.id),
      },
    };
  });
}

/**
 * Get node style based on type and status
 */
export function getNodeStyle(node: FlowNode): {
  containerClass: string;
  borderClass: string;
  iconClass: string;
} {
  const typeStyle = nodeTypeColors[node.data.type] ?? nodeTypeColors.agent;
  const statusStyle = statusColors[node.data.status] ?? statusColors.pending;

  // Merge type and status styling - status takes precedence for some properties
  return {
    containerClass: `${statusStyle.bg} ${typeStyle.border}`,
    borderClass: node.data.status === 'running' || node.data.status === 'streaming'
      ? 'ring-2 ring-blue-400'
      : node.data.status === 'failed'
        ? 'ring-2 ring-red-400'
        : node.data.status === 'gate_waiting'
          ? 'ring-2 ring-yellow-400'
          : '',
    iconClass: nodeTypeIcons[node.data.type] ?? '📦',
  };
}

/**
 * Calculate execution progress percentage
 */
export function calculateExecutionProgress(runState: RunVisualState): number {
  const totalNodes = Object.keys(runState.nodeStates).length;
  if (totalNodes === 0) return 0;

  const completedNodes = Object.values(runState.nodeStates).filter(
    (state) => state.status === 'completed' || state.status === 'skipped' || state.status === 'cached'
  ).length;

  return Math.round((completedNodes / totalNodes) * 100);
}

/**
 * Check if run is in a terminal state
 */
export function isRunTerminal(status: string): boolean {
  return status === 'completed' || status === 'failed' || status === 'interrupted';
}
