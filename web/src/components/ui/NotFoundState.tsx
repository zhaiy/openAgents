/**
 * NotFoundState - Unified "Not Found" feedback component
 *
 * Used for S11-S14 scenarios:
 * - Run not found
 * - Step not found
 * - Draft not found
 * - Compare session not found
 */
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import { Button } from './Button';

export type NotFoundType = 'run' | 'step' | 'draft' | 'compare' | 'workflow';

interface NotFoundStateProps {
  type: NotFoundType;
  identifier?: string;
  onRetry?: () => void;
}

export function NotFoundState({ type, identifier, onRetry }: NotFoundStateProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const getMessages = (): { title: string; description: string; backPath: string } => {
    switch (type) {
      case 'run':
        return {
          title: t('errors.runNotFound') || 'Run Not Found',
          description: identifier
            ? `The run "${identifier}" does not exist or has been deleted.`
            : 'The requested run does not exist or has been deleted.',
          backPath: '/runs',
        };
      case 'step':
        return {
          title: t('errors.stepNotFound') || 'Step Not Found',
          description: identifier
            ? `The step "${identifier}" does not exist in this run.`
            : 'The requested step does not exist in this run.',
          backPath: '/runs',
        };
      case 'draft':
        return {
          title: t('errors.draftNotFound') || 'Draft Not Found',
          description: identifier
            ? `The draft "${identifier}" does not exist or has been deleted.`
            : 'The requested draft does not exist or has been deleted.',
          backPath: '/runs',
        };
      case 'compare':
        return {
          title: t('errors.compareNotFound') || 'Comparison Not Found',
          description: 'The comparison session has expired or does not exist. Please start a new comparison.',
          backPath: '/runs',
        };
      case 'workflow':
        return {
          title: t('errors.workflowNotFound') || 'Workflow Not Found',
          description: identifier
            ? `The workflow "${identifier}" does not exist.`
            : 'The requested workflow does not exist.',
          backPath: '/workflows',
        };
      default:
        return {
          title: t('errors.notFound') || 'Not Found',
          description: 'The requested resource does not exist.',
          backPath: '/',
        };
    }
  };

  const { title, description, backPath } = getMessages();

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 text-center">
      <div className="w-16 h-16 mb-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
        <svg
          className="w-8 h-8 text-red-600 dark:text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-text mb-2">{title}</h2>
      <p className="text-muted text-sm max-w-md mb-6">{description}</p>
      <div className="flex gap-3">
        {onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            {t('common.retry') || 'Retry'}
          </Button>
        )}
        <Button variant="primary" onClick={() => navigate(backPath)}>
          {t('common.goBack') || 'Go Back'}
        </Button>
      </div>
    </div>
  );
}