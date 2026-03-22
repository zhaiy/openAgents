import React from 'react';
import { Badge } from '../ui/Badge';
import type { BadgeVariant } from '../ui/Badge';

export type NodeType = 'agent' | 'gate' | 'eval' | 'script' | 'start' | 'end';
export type NodeStatus = 'pending' | 'queued' | 'running' | 'streaming' | 'gate_waiting' | 'completed' | 'failed' | 'skipped' | 'cached';
export type NodeCardState = 'default' | 'hover' | 'selected' | 'active' | 'blocked';

export interface NodeCardProps {
  name: string;
  type: NodeType;
  status?: NodeStatus;
  state?: NodeCardState;
  durationMs?: number;
  tokenUsage?: { totalTokens: number };
  errorMessage?: string;
  hasGate?: boolean;
  hasEval?: boolean;
  isGateWaiting?: boolean;
  onClick?: () => void;
  onGateAction?: () => void;
  className?: string;
}

const nodeTypeIcons: Record<NodeType, string> = {
  agent: '🤖',
  gate: '🚧',
  eval: '📊',
  script: '📜',
  start: '▶',
  end: '⏹',
};

const statusVariantMap: Record<NodeStatus, BadgeVariant> = {
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

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

export const NodeCard: React.FC<NodeCardProps> = ({
  name,
  type,
  status = 'pending',
  state = 'default',
  durationMs,
  tokenUsage,
  errorMessage,
  hasGate,
  hasEval,
  isGateWaiting,
  onClick,
  onGateAction,
  className = '',
}) => {
  const baseStyles = `
    relative flex items-start gap-3 p-3 rounded-lg border cursor-pointer
    transition-all duration-150
    ${state === 'hover' ? 'bg-gray-50 dark:bg-gray-700 shadow-md' : ''}
    ${state === 'selected' ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/30' : ''}
    ${state === 'active' ? 'bg-blue-50 dark:bg-blue-900/30' : ''}
    ${state === 'blocked' ? 'bg-red-50 dark:bg-red-900/20' : ''}
    ${state === 'default' ? 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700' : ''}
    ${isGateWaiting ? 'ring-2 ring-yellow-400 dark:ring-yellow-600 animate-pulse' : ''}
  `;

  const borderColors = {
    pending: 'border-gray-200 dark:border-gray-600',
    queued: 'border-gray-200 dark:border-gray-600',
    running: 'border-blue-300 dark:border-blue-600',
    streaming: 'border-blue-300 dark:border-blue-600',
    gate_waiting: 'border-yellow-400 dark:border-yellow-600',
    completed: 'border-green-300 dark:border-green-600',
    failed: 'border-red-300 dark:border-red-600',
    skipped: 'border-gray-200 dark:border-gray-600',
    cached: 'border-purple-300 dark:border-purple-600',
  };

  return (
    <div
      className={`${baseStyles} ${borderColors[status]} ${className}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      {/* Gate Waiting Indicator */}
      {isGateWaiting && (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center animate-bounce">
          <span className="text-xs">⏳</span>
        </div>
      )}

      {/* Type Icon */}
      <div className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-md text-lg ${
        isGateWaiting
          ? 'bg-yellow-100 dark:bg-yellow-900/40'
          : 'bg-gray-100 dark:bg-gray-700'
      }`}>
        {nodeTypeIcons[type]}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {name}
          </p>
          {status && (
            <Badge variant={statusVariantMap[status]}>
              {status.replace('_', ' ')}
            </Badge>
          )}
        </div>

        {/* Metadata */}
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          {durationMs !== undefined && (
            <span>{formatDuration(durationMs)}</span>
          )}
          {tokenUsage?.totalTokens !== undefined && (
            <span>{tokenUsage.totalTokens.toLocaleString()} tokens</span>
          )}
          {hasGate && <span className="text-yellow-600 dark:text-yellow-400">🚧 Gate</span>}
          {hasEval && <span className="text-blue-600 dark:text-blue-400">📊 Eval</span>}
        </div>

        {/* Error Message */}
        {errorMessage && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400 truncate">
            {errorMessage}
          </p>
        )}

        {/* Gate Action Button */}
        {isGateWaiting && onGateAction && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onGateAction();
            }}
            className="mt-2 w-full px-3 py-1.5 bg-yellow-400 hover:bg-yellow-500 dark:bg-yellow-600 dark:hover:bg-yellow-700 text-yellow-900 dark:text-yellow-100 text-xs font-medium rounded transition-colors"
          >
            🚧 Review Gate Decision
          </button>
        )}
      </div>
    </div>
  );
};
