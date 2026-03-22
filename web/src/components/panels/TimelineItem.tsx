import React from 'react';

export interface TimelineItemProps {
  event: string;
  timestamp: number;
  details?: string;
  status?: 'success' | 'error' | 'warning' | 'info';
  nodeId?: string;
  onClick?: (nodeId: string) => void;
  className?: string;
}

const statusColors = {
  success: 'bg-green-500',
  error: 'bg-red-500',
  warning: 'bg-yellow-500',
  info: 'bg-blue-500',
};

const statusBorderColors = {
  success: 'border-l-green-500',
  error: 'border-l-red-500',
  warning: 'border-l-yellow-500',
  info: 'border-l-blue-500',
};

export const TimelineItem: React.FC<TimelineItemProps> = ({
  event,
  timestamp,
  details,
  status = 'info',
  nodeId,
  onClick,
  className = '',
}) => {
  const formattedTime = new Date(timestamp).toLocaleTimeString();
  const formattedDate = new Date(timestamp).toLocaleDateString();

  const handleClick = () => {
    if (nodeId && onClick) {
      onClick(nodeId);
    }
  };

  return (
    <div
      className={`
        flex gap-3 py-2 px-2 rounded-lg transition-colors
        ${nodeId && onClick ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800' : ''}
        ${className}
      `}
      onClick={handleClick}
      role={nodeId && onClick ? 'button' : undefined}
      tabIndex={nodeId && onClick ? 0 : undefined}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
    >
      {/* Timeline indicator */}
      <div className="flex flex-col items-center">
        <div className={`w-2.5 h-2.5 rounded-full ${statusColors[status]}`} />
        <div className={`w-0.5 flex-1 border-l-2 ${statusBorderColors[status]} mt-1 opacity-30`} />
      </div>

      {/* Content */}
      <div className="flex-1 pb-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {event}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {formattedDate} {formattedTime}
          </span>
        </div>
        {details && (
          <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
            {details}
          </p>
        )}
        {nodeId && (
          <span className="mt-1 inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
            {nodeId}
          </span>
        )}
      </div>
    </div>
  );
};
