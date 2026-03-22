import React from 'react';

export interface PanelProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  collapsible?: boolean;
}

export const Panel: React.FC<PanelProps> = ({
  children,
  className = '',
  title,
}) => {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}>
      {title && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {title}
          </h3>
        </div>
      )}
      <div className="p-4">
        {children}
      </div>
    </div>
  );
};

export interface PanelSectionProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export const PanelSection: React.FC<PanelSectionProps> = ({
  children,
  title,
  className = '',
}) => (
  <div className={`py-3 ${className}`}>
    {title && (
      <h4 className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
        {title}
      </h4>
    )}
    {children}
  </div>
);
