/**
 * RunExecutionPage - Visual Execution Console (T18)
 *
 * Real-time DAG visualization with node status updates, timeline,
 * live output streaming, and gate handling.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useTranslation } from '../i18n';
import { useApi } from '../hooks/useApi';
import {
  visualApi,
  runApi,
  createSSEConnection,
  type RunEvent,
  type RunNodeState,
  type NodeStatus,
} from '../api';
import { useGraphStore } from '../stores/graph-store';
import { useRunStore } from '../stores/run-store';
import { adaptWorkflowToFlowNodes, adaptWorkflowToFlowEdges } from '../lib/graph';
import { layoutDAG } from '../lib/graph';
import { NodeCard } from '../components/nodes/NodeCard';
import { InspectorPanel } from '../components/panels/InspectorPanel';
import { TimelineItem } from '../components/panels/TimelineItem';
import { MetricCard } from '../components/panels/MetricCard';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import type { BadgeVariant } from '../components/ui/Badge';

// Custom node component for React Flow
function VisualizationNode({ data }: { data: Record<string, unknown> }) {
  const status = (data.status as NodeStatus) || 'pending';
  const isActive = data.isActive as boolean;
  const isFailed = data.isFailed as boolean;
  const isGateWaiting = data.isGateWaiting as boolean;

  let state: 'default' | 'hover' | 'selected' | 'active' | 'blocked' = 'default';
  if (isActive) state = 'active';
  else if (isFailed) state = 'blocked';
  else if (isGateWaiting) state = 'hover';

  return (
    <NodeCard
      name={data.label as string}
      type={(data.type as 'agent' | 'gate' | 'eval' | 'script' | 'start' | 'end') || 'agent'}
      status={status}
      state={state}
      durationMs={data.durationMs as number}
      tokenUsage={data.tokenUsage as { totalTokens: number }}
      errorMessage={data.errorMessage as string}
      hasGate={data.hasGate as boolean}
      hasEval={data.hasEval as boolean}
      isGateWaiting={isGateWaiting}
    />
  );
}

const nodeTypes: NodeTypes = {
  visualizationNode: VisualizationNode,
};

type TabType = 'timeline' | 'output' | 'details';

export default function RunExecutionPage() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Graph store - only for selection
  const { selectNode, selectedNodeId } = useGraphStore();

  // Local state for ReactFlow - using FlowNode structure
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Run store - single source of truth for node state
  const {
    visualState,
    timeline,
    streamBuffers,
    connectionStatus,
    pendingGate,
    setVisualState,
    updateNodeState,
    setTimeline,
    setPendingGate,
    initRun,
    handleSSEEvent,
    setConnectionStatus,
  } = useRunStore();

  // Local state
  const [activeTab, setActiveTab] = useState<TabType>('timeline');
  const [selectedNodeData, setSelectedNodeData] = useState<RunNodeState | null>(null);
  const [editText, setEditText] = useState('');
  const [isSubmittingGate, setIsSubmittingGate] = useState(false);
  const esRef = useRef<ReturnType<typeof createSSEConnection> | null>(null);
  const streamRef = useRef<HTMLPreElement>(null);

  // Fetch workflow visual summary and run visual state (single fetch, no duplication)
  const { data: workflowSummary, isLoading: workflowLoading } = useApi(
    async () => {
      if (!runId) return null;
      const state = await visualApi.getRunVisualState(runId);
      if (state) {
        setVisualState(state);
        initRun(runId, state.workflowId);
        // Get workflow summary for DAG layout
        const summary = await visualApi.getWorkflowSummary(state.workflowId);
        if (summary) {
          // Apply layout
          const layoutPositions = layoutDAG(
            summary.visualNodes.map((n) => ({ id: n.id })),
            summary.visualEdges.map((e) => ({ source: e.source, target: e.target })),
            { direction: 'LR' }
          );
          // Convert to flow nodes with positions
          const flowNodes = adaptWorkflowToFlowNodes(summary, layoutPositions);
          const flowEdges = adaptWorkflowToFlowEdges(summary.visualEdges);
          setNodes(flowNodes);
          setEdges(flowEdges);
        }
        // Get timeline
        const timelineData = await visualApi.getRunTimeline(runId);
        if (timelineData) {
          setTimeline(timelineData);
        }
        return { visualState: state, workflowSummary: await visualApi.getWorkflowSummary(state.workflowId) };
      }
      return null;
    },
    [runId]
  );

  // Initialize run and set up SSE
  useEffect(() => {
    if (!runId) return;

    // Set up SSE connection (visual state already fetched via useApi above)
    setConnectionStatus('connecting');
    esRef.current = createSSEConnection(
      runId,
      (event: RunEvent, eventId?: string) => {
        // Handle SSE event in run-store (updates visualState for Inspector)
        handleSSEEvent(event, eventId);

        // Update React Flow nodes directly for graph visualization
        if (event.stepId) {
          const stepId = event.stepId;
          let newStatus: NodeStatus | null = null;
          const additionalUpdates: Record<string, unknown> = {};

          switch (event.type) {
            case 'step.started':
              newStatus = 'running';
              break;
            case 'step.completed':
              newStatus = 'completed';
              if (event.durationMs) additionalUpdates.durationMs = event.durationMs;
              if (event.output) additionalUpdates.outputPreview = event.output;
              break;
            case 'step.failed':
              newStatus = 'failed';
              if (event.error) additionalUpdates.errorMessage = event.error;
              break;
            case 'step.skipped':
              newStatus = 'skipped';
              break;
            case 'gate.waiting':
              newStatus = 'gate_waiting';
              if (event.preview) additionalUpdates.outputPreview = event.preview;
              break;
            case 'step.stream':
              // Stream chunks handled separately via appendStreamChunk
              break;
          }

          if (newStatus) {
            // Update React Flow nodes
            setNodes((nds) =>
              nds.map((node) =>
                node.id === stepId
                  ? { ...node, data: { ...node.data, status: newStatus, ...additionalUpdates } }
                  : node
              )
            );
            // Also update run-store node state
            updateNodeState(stepId, { status: newStatus, ...additionalUpdates });
          }
        }
      },
      (error?: Error, retryCount?: number) => {
        console.warn('SSE error:', error?.message, 'retry:', retryCount);
        setConnectionStatus('error');
      },
      {
        onStatusChange: setConnectionStatus,
        maxRetries: 10,
      }
    );

    return () => {
      esRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  // Update selected node data when selection changes
  useEffect(() => {
    if (selectedNodeId && visualState?.nodeStates[selectedNodeId]) {
      setSelectedNodeData(visualState.nodeStates[selectedNodeId]);
    } else {
      setSelectedNodeData(null);
    }
  }, [selectedNodeId, visualState]);

  // Auto-scroll stream output
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [streamBuffers]);

  // Handle node click
  const handleNodeClick = useCallback((_: unknown, node: Node) => {
    selectNode(node.id);
  }, [selectNode]);

  // Handle pane click (deselect)
  const handlePaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  // Gate action handler
  const handleGateAction = async (action: 'approve' | 'reject' | 'edit') => {
    if (!runId || !pendingGate) return;
    setIsSubmittingGate(true);
    try {
      await runApi.gateAction(runId, pendingGate.stepId, {
        action,
        editedOutput: action === 'edit' ? editText : undefined,
      });
      setPendingGate(null);
    } catch (err) {
      console.error('Gate action failed:', err);
    } finally {
      setIsSubmittingGate(false);
    }
  };

  // Get connection status badge
  const getConnectionBadge = (): { variant: BadgeVariant; text: string } => {
    switch (connectionStatus) {
      case 'connected':
        return { variant: 'completed', text: t('execution.connected') };
      case 'connecting':
        return { variant: 'running', text: t('execution.connecting') };
      case 'reconnecting':
        return { variant: 'gate_waiting', text: t('execution.reconnecting') };
      case 'error':
        return { variant: 'failed', text: t('execution.error') };
      default:
        return { variant: 'pending', text: t('execution.disconnected') };
    }
  };

  // Get selected node from local nodes state
  const selectedNode = selectedNodeId
    ? nodes.find((n) => n.id === selectedNodeId)
    : null;

  if (workflowLoading && !visualState) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const connectionBadge = getConnectionBadge();

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-line bg-panel px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              ← {t('common.back')}
            </Button>
            <div>
              <h1 className="text-lg font-semibold">
                {workflowSummary?.workflowSummary?.name || t('execution.console')}
              </h1>
              <p className="text-xs text-muted">
                {t('execution.runId')}: {runId}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={connectionBadge.variant}>
              {connectionBadge.text}
            </Badge>
            {visualState && (
              <span className="text-sm text-muted">
                {Object.values(visualState.nodeStates).filter(
                  (s) => s.status === 'completed' || s.status === 'skipped'
                ).length}/{Object.keys(visualState.nodeStates).length}{' '}
                {t('execution.nodesCompleted')}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Graph area */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.1}
            maxZoom={2}
          >
            <Background />
            <Controls />
            <MiniMap />
            <Panel position="top-left" className="bg-panel border border-line rounded-lg p-2 shadow-md">
              <div className="text-xs text-muted">
                {t('execution.clickNodeHint')}
              </div>
            </Panel>
          </ReactFlow>

          {/* Progress indicator */}
          {visualState && (
            <Panel position="bottom-left" className="bg-panel border border-line rounded-lg p-3 shadow-md">
              <div className="text-xs font-medium mb-1">
                {t('execution.progress')}
              </div>
              <div className="w-48 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand transition-all duration-300"
                  style={{
                    width: `${(Object.values(visualState.nodeStates).filter(
                      (s) => s.status === 'completed' || s.status === 'skipped' || s.status === 'cached'
                    ).length / Math.max(Object.keys(visualState.nodeStates).length, 1)) * 100}%`,
                  }}
                />
              </div>
            </Panel>
          )}
        </div>

        {/* Right sidebar */}
        <div className="w-80 border-l border-line flex flex-col overflow-hidden bg-panel">
          {/* Tab buttons */}
          <div className="flex border-b border-line">
            <button
              onClick={() => setActiveTab('timeline')}
              className={`flex-1 px-3 py-2 text-xs font-medium ${
                activeTab === 'timeline'
                  ? 'text-brand border-b-2 border-brand'
                  : 'text-muted hover:text-text'
              }`}
            >
              {t('execution.timeline')}
            </button>
            <button
              onClick={() => setActiveTab('output')}
              className={`flex-1 px-3 py-2 text-xs font-medium ${
                activeTab === 'output'
                  ? 'text-brand border-b-2 border-brand'
                  : 'text-muted hover:text-text'
              }`}
            >
              {t('execution.output')}
            </button>
            <button
              onClick={() => setActiveTab('details')}
              className={`flex-1 px-3 py-2 text-xs font-medium ${
                activeTab === 'details'
                  ? 'text-brand border-b-2 border-brand'
                  : 'text-muted hover:text-text'
              }`}
            >
              {t('execution.details')}
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-auto">
            {activeTab === 'timeline' && (
              <div className="p-3 space-y-1">
                {timeline.length === 0 ? (
                  <p className="text-xs text-muted text-center py-4">
                    {t('execution.noTimelineEvents')}
                  </p>
                ) : (
                  timeline.map((entry) => (
                    <TimelineItem
                      key={entry.id}
                      event={entry.event}
                      timestamp={entry.timestamp}
                      details={entry.details}
                      status={entry.status}
                      nodeId={entry.stepId}
                      onClick={selectNode}
                    />
                  ))
                )}
              </div>
            )}

            {activeTab === 'output' && (
              <div className="p-3">
                {selectedNodeId && streamBuffers[selectedNodeId] ? (
                  <pre
                    ref={streamRef}
                    className="text-xs font-mono bg-bg rounded p-3 overflow-auto max-h-96 whitespace-pre-wrap break-words"
                  >
                    {streamBuffers[selectedNodeId]}
                  </pre>
                ) : (
                  <p className="text-xs text-muted text-center py-4">
                    {selectedNodeId
                      ? t('execution.noOutput')
                      : t('execution.selectNodeForOutput')}
                  </p>
                )}
              </div>
            )}

            {activeTab === 'details' && (
              <div className="p-3 space-y-4">
                {selectedNode && selectedNodeData ? (
                  <InspectorPanel
                    title={selectedNode.data.label as string}
                    nodeId={selectedNode.id}
                    status={(selectedNode.data.status as string) || 'pending'}
                    nodeType={selectedNode.data.type as string}
                    startedAt={selectedNodeData.startedAt
                      ? new Date(selectedNodeData.startedAt).toLocaleTimeString()
                      : undefined}
                    completedAt={selectedNodeData.completedAt
                      ? new Date(selectedNodeData.completedAt).toLocaleTimeString()
                      : undefined}
                    durationMs={selectedNodeData.durationMs}
                    tokenUsage={selectedNodeData.tokenUsage}
                    errorMessage={selectedNodeData.errorMessage}
                    inputPreview={selectedNodeData.inputPreview}
                    outputPreview={selectedNodeData.outputPreview}
                    logSummary={selectedNodeData.logSummary}
                    retryCount={selectedNodeData.retryCount}
                  />
                ) : (
                  <p className="text-xs text-muted text-center py-4">
                    {t('execution.selectNodeToInspect')}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Metrics bar */}
          {visualState && (
            <div className="border-t border-line p-3 grid grid-cols-3 gap-2">
              <MetricCard
                label={t('execution.active')}
                value={visualState.currentActiveNodeIds.length}
              />
              <MetricCard
                label={t('execution.waiting')}
                value={visualState.gateWaitingNodeIds.length}
              />
              <MetricCard
                label={t('execution.failed')}
                value={visualState.failedNodeIds.length}
              />
            </div>
          )}
        </div>
      </div>

      {/* Gate Modal */}
      {pendingGate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-panel rounded-xl border border-line max-w-lg w-full p-6 shadow-2xl">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/40 flex items-center justify-center">
                <span className="text-xl">🚧</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold">{t('execution.gateWaiting')}</h3>
                <p className="text-xs text-muted font-mono">{pendingGate.stepId}</p>
              </div>
            </div>

            {/* Preview */}
            <div className="mb-4">
              <label className="text-xs text-muted mb-1 block">Output Preview</label>
              <pre className="p-4 bg-bg rounded-lg border border-line text-sm font-mono max-h-48 overflow-auto whitespace-pre-wrap break-words">
                {pendingGate.preview || t('execution.noPreview')}
              </pre>
            </div>

            {/* Edit textarea */}
            <div className="mb-4">
              <label className="text-xs text-muted mb-1 block">Edit Output (Optional)</label>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={3}
                className="w-full p-3 bg-bg border border-line rounded-lg text-sm font-mono resize-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                placeholder={t('execution.editPlaceholder')}
              />
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="primary"
                onClick={() => handleGateAction('approve')}
                disabled={isSubmittingGate}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                ✓ {t('execution.approve')}
              </Button>
              <Button
                variant="danger"
                onClick={() => handleGateAction('reject')}
                disabled={isSubmittingGate}
                className="flex-1"
              >
                ✕ {t('execution.reject')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleGateAction('edit')}
                disabled={isSubmittingGate}
                className="flex-1"
              >
                ✎ {t('execution.edit')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
