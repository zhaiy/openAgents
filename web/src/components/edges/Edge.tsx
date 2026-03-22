/* eslint-disable react-refresh/only-export-components */
import React from 'react';

export type EdgeType = 'default' | 'active' | 'error' | 'gate' | 'conditional';

export interface EdgeProps {
  id: string;
  type?: EdgeType;
  animated?: boolean;
  label?: string;
  className?: string;
}

// Note: In React Flow, edges are handled differently via the Edge component
// This provides styling utilities for edge types

export const edgeTypeStyles: Record<EdgeType, { stroke: string; dashed: boolean }> = {
  default: { stroke: '#6b7280', dashed: false },
  active: { stroke: '#3b82f6', dashed: false },
  error: { stroke: '#ef4444', dashed: false },
  gate: { stroke: '#f59e0b', dashed: true },
  conditional: { stroke: '#8b5cf6', dashed: true },
};

export const EdgeLine: React.FC<{ type?: EdgeType; animated?: boolean }> = ({
  type = 'default',
  animated = false,
}) => {
  const style = edgeTypeStyles[type];

  return (
    <path
      fill="none"
      stroke={style.stroke}
      strokeWidth={2}
      strokeDasharray={style.dashed ? '5,5' : undefined}
      className={animated ? 'animate-flow' : ''}
    />
  );
};

const animateFlowKeyframes = `
@keyframes flow {
  from { stroke-dashoffset: 20; }
  to { stroke-dashoffset: 0; }
}
.animate-flow {
  animation: flow 0.5s linear infinite;
}
`;

// Inject animation styles
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = animateFlowKeyframes;
  document.head.appendChild(style);
}
