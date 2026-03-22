import React from 'react';
import { Panel } from '../ui/Panel';
import { Badge } from '../ui/Badge';
import type { BadgeVariant } from '../ui/Badge';

export interface InspectorPanelProps {
  title: string;
  nodeId: string;
  status: string;
  nodeType?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  tokenUsage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  errorMessage?: string;
  inputPreview?: string;
  outputPreview?: string;
  logSummary?: string;
  retryCount?: number;
  onViewLogs?: () => void;
  children?: React.ReactNode;
  className?: string;
}

const statusVariantMap: Record<string, BadgeVariant> = {
  pending: 'pending',
  queued: 'default',
  running: 'running',
  streaming: 'running',
  gate_waiting: 'gate_waiting',
  completed: 'completed',
  failed: 'failed',
  skipped: 'skipped',
  cached: 'cached',
};

const nodeTypeLabels: Record<string, string> = {
  agent: 'Agent',
  gate: 'Gate',
  eval: 'Evaluation',
  script: 'Script',
  start: 'Start',
  end: 'End',
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  title,
  nodeId,
  status,
  nodeType,
  startedAt,
  completedAt,
  durationMs,
  tokenUsage,
  errorMessage,
  inputPreview,
  outputPreview,
  logSummary,
  retryCount,
  onViewLogs,
  children,
  className = '',
}) => {
  return (
    <Panel className={className} title={title}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
            {nodeId}
          </span>
          <div className="flex items-center gap-2">
            {nodeType && (
              <Badge variant="default">
                {nodeTypeLabels[nodeType] || nodeType}
              </Badge>
            )}
            <Badge variant={statusVariantMap[status] ?? 'default'}>
              {status.replace('_', ' ')}
            </Badge>
          </div>
        </div>

        {/* Timing info */}
        {(startedAt || completedAt || durationMs) && (
          <div className="grid grid-cols-3 gap-2 text-xs">
            {startedAt && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded p-2">
                <div className="text-gray-500 dark:text-gray-400 mb-0.5">Started</div>
                <div className="font-medium text-gray-900 dark:text-gray-100">{startedAt}</div>
              </div>
            )}
            {completedAt && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded p-2">
                <div className="text-gray-500 dark:text-gray-400 mb-0.5">Completed</div>
                <div className="font-medium text-gray-900 dark:text-gray-100">{completedAt}</div>
              </div>
            )}
            {durationMs !== undefined && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded p-2">
                <div className="text-gray-500 dark:text-gray-400 mb-0.5">Duration</div>
                <div className="font-medium text-gray-900 dark:text-gray-100">{formatDuration(durationMs)}</div>
              </div>
            )}
          </div>
        )}

        {/* Token usage */}
        {tokenUsage && (tokenUsage.totalTokens || tokenUsage.promptTokens || tokenUsage.completionTokens) && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Token Usage</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {tokenUsage.promptTokens !== undefined && (
                <div>
                  <div className="text-gray-500 dark:text-gray-400">Prompt</div>
                  <div className="font-medium">{tokenUsage.promptTokens.toLocaleString()}</div>
                </div>
              )}
              {tokenUsage.completionTokens !== undefined && (
                <div>
                  <div className="text-gray-500 dark:text-gray-400">Completion</div>
                  <div className="font-medium">{tokenUsage.completionTokens.toLocaleString()}</div>
                </div>
              )}
              {tokenUsage.totalTokens !== undefined && (
                <div>
                  <div className="text-gray-500 dark:text-gray-400">Total</div>
                  <div className="font-medium">{tokenUsage.totalTokens.toLocaleString()}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Retry count */}
        {retryCount !== undefined && retryCount > 0 && (
          <div className="flex items-center gap-2 text-xs text-orange-600 dark:text-orange-400">
            <span>🔄</span>
            <span>Retried {retryCount} time{retryCount > 1 ? 's' : ''}</span>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 font-medium mb-1">
              <span>❌</span>
              <span>Error</span>
            </div>
            <pre className="text-xs text-red-700 dark:text-red-300 whitespace-pre-wrap break-words font-mono">
              {errorMessage}
            </pre>
          </div>
        )}

        {/* Input preview */}
        {inputPreview && (
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Input Preview</div>
            <pre className="text-xs bg-gray-50 dark:bg-gray-800 rounded p-3 overflow-auto max-h-40 whitespace-pre-wrap break-words font-mono">
              {inputPreview}
            </pre>
          </div>
        )}

        {/* Output preview */}
        {outputPreview && (
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Output Preview</div>
            <pre className="text-xs bg-gray-50 dark:bg-gray-800 rounded p-3 overflow-auto max-h-40 whitespace-pre-wrap break-words font-mono">
              {outputPreview}
            </pre>
          </div>
        )}

        {/* Log summary */}
        {logSummary && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">Log Summary</span>
              {onViewLogs && (
                <button
                  onClick={onViewLogs}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  View Full Logs →
                </button>
              )}
            </div>
            <pre className="text-xs bg-gray-50 dark:bg-gray-800 rounded p-3 overflow-auto max-h-32 whitespace-pre-wrap break-words font-mono text-gray-600 dark:text-gray-400">
              {logSummary}
            </pre>
          </div>
        )}

        {/* Children content */}
        {children}
      </div>
    </Panel>
  );
};
