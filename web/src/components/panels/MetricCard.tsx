import React from 'react';

export interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  trend,
  className = '',
}) => {
  const trendColors = {
    up: 'text-green-600 dark:text-green-400',
    down: 'text-red-600 dark:text-red-400',
    neutral: 'text-gray-600 dark:text-gray-400',
  };

  const trendIcons = {
    up: '↑',
    down: '↓',
    neutral: '→',
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 ${className}`}>
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        {label}
      </p>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          {value}
        </span>
        {unit && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {unit}
          </span>
        )}
        {trend && (
          <span className={`text-sm ${trendColors[trend]}`}>
            {trendIcons[trend]}
          </span>
        )}
      </div>
    </div>
  );
};
