import React from 'react';

export type WarningType = 'warning' | 'error' | 'info' | 'tip';

export interface WarningCalloutProps {
  type?: WarningType;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

const calloutStyles: Record<WarningType, { bg: string; border: string; icon: string; iconColor: string }> = {
  warning: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    border: 'border-yellow-400 dark:border-yellow-600',
    icon: '⚠️',
    iconColor: 'text-yellow-600 dark:text-yellow-400',
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-400 dark:border-red-600',
    icon: '❌',
    iconColor: 'text-red-600 dark:text-red-400',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-400 dark:border-blue-600',
    icon: 'ℹ️',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  tip: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-400 dark:border-green-600',
    icon: '💡',
    iconColor: 'text-green-600 dark:text-green-400',
  },
};

export const WarningCallout: React.FC<WarningCalloutProps> = ({
  type = 'warning',
  title,
  children,
  className = '',
}) => {
  const style = calloutStyles[type];

  return (
    <div
      className={`${style.bg} border-l-4 ${style.border} rounded-r-lg p-4 ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <span className={`text-xl ${style.iconColor}`}>{style.icon}</span>
        <div className="flex-1">
          {title && (
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
              {title}
            </h4>
          )}
          <div className="text-sm text-gray-700 dark:text-gray-300">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
