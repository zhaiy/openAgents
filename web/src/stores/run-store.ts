/**
 * Run Store - Execution console state
 *
 * Manages the run execution state including visual state, timeline,
 * stream buffers, and SSE connection state.
 */
import { create } from 'zustand';
import type { RunVisualState, TimelineEntry, RunEvent, NodeStatus } from '../api';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting';

export interface RunState {
  // Core run data
  runId: string | null;
  workflowId: string | null;

  // Visual state
  visualState: RunVisualState | null;

  // Timeline events
  timeline: TimelineEntry[];

  // Stream buffers for live output
  streamBuffers: Record<string, string>;

  // SSE connection state
  connectionStatus: ConnectionStatus;
  lastEventId: string | null;
  lastSequence: number;
  reconnectAttempts: number;

  // Loading/error states
  isLoading: boolean;
  error: string | null;

  // Gate waiting state
  pendingGate: { stepId: string; preview?: string } | null;
}

export interface RunActions {
  // Initialization
  initRun: (runId: string, workflowId: string) => void;

  // Visual state management
  setVisualState: (visualState: RunVisualState) => void;
  updateNodeStatus: (nodeId: string, status: NodeStatus) => void;
  updateNodeState: (nodeId: string, updates: Partial<RunVisualState['nodeStates'][string]>) => void;
  setTimeline: (timeline: TimelineEntry[]) => void;

  // Stream buffer management
  appendStreamChunk: (stepId: string, chunk: string) => void;
  clearStreamBuffer: (stepId: string) => void;

  // SSE event handling
  handleSSEEvent: (event: RunEvent, eventId?: string) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  incrementReconnectAttempts: () => void;
  resetReconnectAttempts: () => void;

  // Gate handling
  setPendingGate: (gate: { stepId: string; preview?: string } | null) => void;

  // Error handling
  setError: (error: string | null) => void;
  setLoading: (isLoading: boolean) => void;

  // Cleanup
  reset: () => void;
}

const initialState: RunState = {
  runId: null,
  workflowId: null,
  visualState: null,
  timeline: [],
  streamBuffers: {},
  connectionStatus: 'disconnected',
  lastEventId: null,
  lastSequence: 0,
  reconnectAttempts: 0,
  isLoading: false,
  error: null,
  pendingGate: null,
};

export const useRunStore = create<RunState & RunActions>((set, get) => ({
  ...initialState,

  initRun: (runId, workflowId) => set({
    runId,
    workflowId,
    visualState: null,
    timeline: [],
    streamBuffers: {},
    connectionStatus: 'connecting',
    lastEventId: null,
    lastSequence: 0,
    reconnectAttempts: 0,
    isLoading: true,
    error: null,
    pendingGate: null,
  }),

  setVisualState: (visualState) => set({
    visualState,
    isLoading: false,
    error: null,
  }),

  updateNodeStatus: (nodeId, status) => {
    const { visualState } = get();
    if (!visualState) return;

    // Merge status update with existing node state
    get().updateNodeState(nodeId, { status });
  },

  updateNodeState: (nodeId, updates) => {
    const { visualState } = get();
    if (!visualState) return;

    const existingNode = visualState.nodeStates[nodeId];
    if (!existingNode) return;

    const updatedNode = { ...existingNode, ...updates };
    const updatedNodeStates = {
      ...visualState.nodeStates,
      [nodeId]: updatedNode,
    };

    // Update active/gate/failed lists based on new status
    let { currentActiveNodeIds, gateWaitingNodeIds, failedNodeIds } = visualState;
    const newStatus = updates.status ?? existingNode.status;

    if (newStatus === 'running' || newStatus === 'streaming') {
      if (!currentActiveNodeIds.includes(nodeId)) {
        currentActiveNodeIds = [...currentActiveNodeIds, nodeId];
      }
      gateWaitingNodeIds = gateWaitingNodeIds.filter(id => id !== nodeId);
      failedNodeIds = failedNodeIds.filter(id => id !== nodeId);
    } else if (newStatus === 'gate_waiting') {
      if (!gateWaitingNodeIds.includes(nodeId)) {
        gateWaitingNodeIds = [...gateWaitingNodeIds, nodeId];
      }
      currentActiveNodeIds = currentActiveNodeIds.filter(id => id !== nodeId);
      failedNodeIds = failedNodeIds.filter(id => id !== nodeId);
    } else if (newStatus === 'failed') {
      if (!failedNodeIds.includes(nodeId)) {
        failedNodeIds = [...failedNodeIds, nodeId];
      }
      currentActiveNodeIds = currentActiveNodeIds.filter(id => id !== nodeId);
      gateWaitingNodeIds = gateWaitingNodeIds.filter(id => id !== nodeId);
    } else if (newStatus === 'completed' || newStatus === 'skipped' || newStatus === 'cached') {
      currentActiveNodeIds = currentActiveNodeIds.filter(id => id !== nodeId);
      gateWaitingNodeIds = gateWaitingNodeIds.filter(id => id !== nodeId);
      failedNodeIds = failedNodeIds.filter(id => id !== nodeId);
    }

    set({
      visualState: {
        ...visualState,
        nodeStates: updatedNodeStates,
        currentActiveNodeIds,
        gateWaitingNodeIds,
        failedNodeIds,
      },
    });
  },

  setTimeline: (timeline) => set({ timeline }),

  appendStreamChunk: (stepId, chunk) => {
    const { streamBuffers } = get();
    set({
      streamBuffers: {
        ...streamBuffers,
        [stepId]: (streamBuffers[stepId] ?? '') + chunk,
      },
    });
  },

  clearStreamBuffer: (stepId) => {
    const { streamBuffers } = get();
    const rest = { ...streamBuffers };
    delete rest[stepId];
    set({ streamBuffers: rest });
  },

  handleSSEEvent: (event, eventId) => {
    const { lastSequence } = get();

    // Extract sequence from event ID if present (format: "runId:seq")
    let sequence = lastSequence;
    if (eventId) {
      const parts = eventId.split(':');
      const seqPart = parts[parts.length - 1];
      if (!isNaN(parseInt(seqPart, 10))) {
        sequence = parseInt(seqPart, 10);
      }
    }

    // Update sequence if this event is newer
    if (sequence > lastSequence) {
      set({ lastSequence: sequence, lastEventId: eventId ?? null });
    }

    // Handle specific event types
    switch (event.type) {
      case 'sync':
        if ('visualState' in event && event.visualState) {
          const syncedState = event.visualState as RunVisualState;
          set({
            visualState: syncedState,
            isLoading: false,
            pendingGate: syncedState.gateWaitingNodeIds[0]
              ? { stepId: syncedState.gateWaitingNodeIds[0] }
              : null,
          });
        }
        break;

      case 'step.started':
        if (event.stepId) {
          get().updateNodeStatus(event.stepId, 'running');
        }
        break;

      case 'step.stream':
        if (event.stepId && event.chunk) {
          get().appendStreamChunk(event.stepId, event.chunk);
        }
        break;

      case 'step.completed':
        if (event.stepId) {
          get().updateNodeStatus(event.stepId, 'completed');
          get().clearStreamBuffer(event.stepId);
        }
        break;

      case 'step.failed':
        if (event.stepId) {
          get().updateNodeStatus(event.stepId, 'failed');
          get().clearStreamBuffer(event.stepId);
        }
        break;

      case 'step.skipped':
        if (event.stepId) {
          get().updateNodeStatus(event.stepId, 'skipped');
        }
        break;

      case 'gate.waiting':
        if (event.stepId) {
          get().updateNodeStatus(event.stepId, 'gate_waiting');
          const preview = typeof event.preview === 'string' ? event.preview : undefined;
          set({ pendingGate: { stepId: event.stepId, preview } });
        }
        break;

      case 'gate.resolved':
        if (event.stepId) {
          get().updateNodeStatus(event.stepId, 'running');
          set({ pendingGate: null });
        }
        break;

      case 'workflow.completed':
        set((state) => ({
          visualState: state.visualState
            ? { ...state.visualState, status: 'completed' }
            : null,
        }));
        break;

      case 'workflow.failed':
        set((state) => ({
          visualState: state.visualState
            ? { ...state.visualState, status: 'failed' }
            : null,
        }));
        break;

      case 'run.closed':
        set({ connectionStatus: 'disconnected' });
        break;
    }
  },

  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

  incrementReconnectAttempts: () => set((state) => ({
    reconnectAttempts: state.reconnectAttempts + 1,
  })),

  resetReconnectAttempts: () => set({ reconnectAttempts: 0 }),

  setPendingGate: (pendingGate) => set({ pendingGate }),

  setError: (error) => set({ error, isLoading: false }),

  setLoading: (isLoading) => set({ isLoading }),

  reset: () => set(initialState),
}));
