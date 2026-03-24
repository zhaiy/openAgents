/**
 * Run Store - Execution console state
 *
 * Manages the run execution state including visual state, timeline,
 * stream buffers, and SSE connection state.
 *
 * DESIGN PRINCIPLE: visualState is the SINGLE SOURCE OF TRUTH for node states.
 * React Flow nodes should be DERIVED from visualState, not maintained separately.
 */
import { create } from 'zustand';
import type { RunVisualState, TimelineEntry, RunEvent, NodeStatus, RunNodeState } from '../api';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting';

export interface RunState {
  // Core run data
  runId: string | null;
  workflowId: string | null;

  // Visual state - SINGLE SOURCE OF TRUTH for node states
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

  // Visual state management - SINGLE SOURCE OF TRUTH
  setVisualState: (visualState: RunVisualState) => void;
  syncFromSnapshot: (visualState: RunVisualState, sequence: number) => void;
  updateNodeStatus: (nodeId: string, status: NodeStatus) => void;
  updateNodeState: (nodeId: string, updates: Partial<RunNodeState>) => void;
  setTimeline: (timeline: TimelineEntry[]) => void;
  addTimelineEntry: (entry: TimelineEntry) => void;

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

  /**
   * Sync visual state from server snapshot.
   * This is the authoritative state recovery method for:
   * - Initial page load
   * - Page refresh
   * - SSE reconnection
   */
  syncFromSnapshot: (visualState, sequence) => {
    const pendingGate = visualState.gateWaitingNodeIds.length > 0
      ? { stepId: visualState.gateWaitingNodeIds[0] }
      : null;

    set({
      visualState,
      lastSequence: sequence,
      lastEventId: `${visualState.runId}:${sequence}`,
      isLoading: false,
      error: null,
      pendingGate,
    });
  },

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

  addTimelineEntry: (entry) => {
    const { timeline } = get();
    // Avoid duplicates
    if (timeline.some(e => e.id === entry.id)) return;
    // Insert and sort by timestamp
    const newTimeline = [...timeline, entry].sort((a, b) => a.timestamp - b.timestamp);
    set({ timeline: newTimeline });
  },

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
    const { lastSequence, visualState } = get();

    // Extract sequence from event ID if present (format: "runId:seq")
    let sequence = lastSequence;
    if (eventId) {
      const parts = eventId.split(':');
      const seqPart = parts[parts.length - 1];
      const parsedSeq = parseInt(seqPart, 10);
      if (!isNaN(parsedSeq)) {
        sequence = parsedSeq;
      }
    }

    // Handle specific event types
    switch (event.type) {
      case 'sync': {
        // Sync event contains authoritative visual state from server
        // This is used for initial load, refresh recovery, and reconnection
        const syncEvent = event as RunEvent & {
          visualState?: RunVisualState;
          sequence?: number;
          lastSequence?: number;
        };

        if (syncEvent.visualState) {
          // Use syncFromSnapshot for authoritative state recovery
          const serverSequence = syncEvent.sequence ?? sequence;
          get().syncFromSnapshot(syncEvent.visualState, serverSequence);
        }
        break;
      }

      case 'step.started':
        if (event.stepId) {
          get().updateNodeStatus(event.stepId, 'running');
          // Update sequence tracking
          if (sequence > lastSequence) {
            set({ lastSequence: sequence, lastEventId: eventId ?? null });
          }
        }
        break;

      case 'step.stream':
        if (event.stepId && event.chunk) {
          get().appendStreamChunk(event.stepId, event.chunk);
        }
        break;

      case 'step.completed':
        if (event.stepId) {
          const updates: Partial<RunNodeState> = { status: 'completed' };
          // Include additional data from event if present
          if ('duration' in event && typeof event.duration === 'number') {
            updates.durationMs = event.duration;
          }
          if ('outputPreview' in event && typeof event.outputPreview === 'string') {
            updates.outputPreview = event.outputPreview;
          }
          get().updateNodeState(event.stepId, updates);
          get().clearStreamBuffer(event.stepId);
          if (sequence > lastSequence) {
            set({ lastSequence: sequence, lastEventId: eventId ?? null });
          }
        }
        break;

      case 'step.failed':
        if (event.stepId) {
          const updates: Partial<RunNodeState> = { status: 'failed' };
          if ('error' in event && typeof event.error === 'string') {
            updates.errorMessage = event.error;
          }
          get().updateNodeState(event.stepId, updates);
          get().clearStreamBuffer(event.stepId);
          if (sequence > lastSequence) {
            set({ lastSequence: sequence, lastEventId: eventId ?? null });
          }
        }
        break;

      case 'step.skipped':
        if (event.stepId) {
          get().updateNodeStatus(event.stepId, 'skipped');
          if (sequence > lastSequence) {
            set({ lastSequence: sequence, lastEventId: eventId ?? null });
          }
        }
        break;

      case 'gate.waiting':
        if (event.stepId) {
          get().updateNodeStatus(event.stepId, 'gate_waiting');
          const preview = typeof (event as Record<string, unknown>).preview === 'string'
            ? (event as Record<string, unknown>).preview as string
            : undefined;
          set({ pendingGate: { stepId: event.stepId, preview } });
          if (sequence > lastSequence) {
            set({ lastSequence: sequence, lastEventId: eventId ?? null });
          }
        }
        break;

      case 'gate.resolved':
        if (event.stepId) {
          // After gate resolved, node goes back to running
          get().updateNodeStatus(event.stepId, 'running');
          set({ pendingGate: null });
          if (sequence > lastSequence) {
            set({ lastSequence: sequence, lastEventId: eventId ?? null });
          }
        }
        break;

      case 'workflow.completed':
        if (visualState) {
          set({
            visualState: { ...visualState, status: 'completed' },
            lastSequence: sequence,
            lastEventId: eventId ?? null,
          });
        }
        break;

      case 'workflow.failed':
        if (visualState) {
          set({
            visualState: { ...visualState, status: 'failed' },
            lastSequence: sequence,
            lastEventId: eventId ?? null,
          });
        }
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
