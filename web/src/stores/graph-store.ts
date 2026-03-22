/**
 * Graph Store - DAG visualization state
 *
 * Manages the workflow graph visualization state including nodes, edges,
 * selection, and viewport.
 */
import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges, type Node, type Edge, type NodeChange, type EdgeChange } from '@xyflow/react';
import type { WorkflowVisualNode, WorkflowVisualEdge, NodeStatus } from '../api';

export interface GraphNodeData extends Record<string, unknown> {
  id: string;
  name: string;
  type: 'agent' | 'gate' | 'eval' | 'script' | 'start' | 'end';
  status: NodeStatus;
  hasGate: boolean;
  hasEval: boolean;
  description?: string;
  selected?: boolean;
}

export type GraphNode = Node<GraphNodeData>;
export type GraphEdge = Edge;

export interface GraphState {
  // Core graph data
  nodes: GraphNode[];
  edges: GraphEdge[];

  // Selection state
  selectedNodeId: string | null;

  // Viewport state
  viewport: { x: number; y: number; zoom: number };

  // Loading state
  isLoading: boolean;
  error: string | null;

  // Workflow metadata
  workflowId: string | null;
  workflowName: string | null;
}

export interface GraphActions {
  // Node/Edge mutations
  setNodes: (nodes: GraphNode[]) => void;
  setEdges: (edges: GraphEdge[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;

  // Selection
  selectNode: (nodeId: string | null) => void;
  clearSelection: () => void;

  // Viewport
  setViewport: (viewport: { x: number; y: number; zoom: number }) => void;

  // Data loading
  loadFromVisualSummary: (
    workflowId: string,
    workflowName: string,
    visualNodes: WorkflowVisualNode[],
    visualEdges: WorkflowVisualEdge[]
  ) => void;
  updateNodeStatus: (nodeId: string, status: NodeStatus) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState: GraphState = {
  nodes: [],
  edges: [],
  selectedNodeId: null,
  viewport: { x: 0, y: 0, zoom: 1 },
  isLoading: false,
  error: null,
  workflowId: null,
  workflowName: null,
};

export const useGraphStore = create<GraphState & GraphActions>((set, get) => ({
  ...initialState,

  setNodes: (nodes) => set({ nodes }),

  setEdges: (edges) => set({ edges }),

  onNodesChange: (changes) => {
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes) as GraphNode[],
    }));
  },

  onEdgesChange: (changes) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges) as GraphEdge[],
    }));
  },

  selectNode: (nodeId) => {
    const { nodes } = get();
    // Update selected flag on nodes
    const updatedNodes = nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        selected: node.id === nodeId,
      },
    }));
    set({ selectedNodeId: nodeId, nodes: updatedNodes });
  },

  clearSelection: () => {
    const { nodes } = get();
    const updatedNodes = nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        selected: false,
      },
    }));
    set({ selectedNodeId: null, nodes: updatedNodes });
  },

  setViewport: (viewport) => set({ viewport }),

  loadFromVisualSummary: (workflowId, workflowName, visualNodes, visualEdges) => {
    // Convert visual nodes to React Flow nodes
    const nodes: GraphNode[] = visualNodes.map((vn) => ({
      id: vn.id,
      type: 'default',
      position: { x: 0, y: 0 }, // Will be calculated by layout algorithm
      data: {
        id: vn.id,
        name: vn.name,
        type: vn.type,
        status: 'pending' as NodeStatus,
        hasGate: vn.hasGate,
        hasEval: vn.hasEval,
        description: vn.description,
        selected: false,
      },
    }));

    // Convert visual edges to React Flow edges
    const edges: GraphEdge[] = visualEdges.map((ve) => ({
      id: ve.id,
      source: ve.source,
      target: ve.target,
      type: ve.type === 'gate' ? 'stepgate' : 'default',
      animated: ve.type === 'gate',
      style: {
        stroke: ve.type === 'gate' ? '#f59e0b' : '#6b7280',
        strokeDasharray: ve.type === 'gate' || ve.type === 'conditional' ? '5,5' : undefined,
      },
    }));

    set({
      workflowId,
      workflowName,
      nodes,
      edges,
      isLoading: false,
      error: null,
    });
  },

  updateNodeStatus: (nodeId, status) => {
    const { nodes } = get();
    const updatedNodes = nodes.map((node) =>
      node.id === nodeId
        ? { ...node, data: { ...node.data, status } }
        : node
    );
    set({ nodes: updatedNodes });
  },

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),

  reset: () => set(initialState),
}));
