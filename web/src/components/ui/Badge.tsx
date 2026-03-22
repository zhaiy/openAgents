import React from 'react';

export type BadgeVariant = 'default' | 'running' | 'gate_waiting' | 'failed' | 'completed' | 'cached' | 'pending' | 'skipped' | 'success' | 'warning' | 'error' | 'queued' | 'streaming';

export interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  children,
  className = '',
  title,
}) => {
  const baseStyles = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';

  const variants: Record<BadgeVariant, string> = {
    default: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    running: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    gate_waiting: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    cached: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    pending: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    skipped: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
    success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    queued: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    streaming: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  };

  return (
    <span className={`${baseStyles} ${variants[variant]} ${className}`} title={title}>
      {children}
    </span>
  );
};
