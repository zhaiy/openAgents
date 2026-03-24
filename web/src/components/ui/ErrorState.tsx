/**
 * ErrorState - Unified error display component
 *
 * Handles ApiError with proper error code mapping.
 * Used for validation errors, internal errors, etc.
 */
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import { Button } from './Button';
import type { ApiErrorCode } from '../../api';

interface ErrorStateProps {
  code?: ApiErrorCode;
  message?: string;
  details?: unknown;
  onRetry?: () => void;
  showHomeButton?: boolean;
}

export function ErrorState({
  code,
  message,
  details,
  onRetry,
  showHomeButton = true,
}: ErrorStateProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const getErrorContent = (): { title: string; description: string; icon: string } => {
    switch (code) {
      case 'VALIDATION_ERROR':
        return {
          title: t('errors.validationError') || 'Validation Error',
          description: message || 'The provided input is invalid. Please check your input and try again.',
          icon: '⚠️',
        };
      case 'NOT_FOUND':
        return {
          title: t('errors.notFound') || 'Not Found',
          description: message || 'The requested resource does not exist.',
          icon: '🔍',
        };
      case 'BAD_REQUEST':
        return {
          title: t('errors.badRequest') || 'Bad Request',
          description: message || 'The request was malformed or invalid.',
          icon: '❌',
        };
      case 'UNAUTHORIZED':
        return {
          title: t('errors.unauthorized') || 'Unauthorized',
          description: message || 'You are not authorized to perform this action.',
          icon: '🔒',
        };
      case 'FORBIDDEN':
        return {
          title: t('errors.forbidden') || 'Forbidden',
          description: message || 'Access to this resource is forbidden.',
          icon: '🚫',
        };
      case 'CONFLICT':
        return {
          title: t('errors.conflict') || 'Conflict',
          description: message || 'The resource state conflicts with the request.',
          icon: '⚡',
        };
      case 'INTERNAL_ERROR':
      default:
        return {
          title: t('errors.internalError') || 'Internal Error',
          description: message || 'An unexpected error occurred. Please try again later.',
          icon: '💥',
        };
    }
  };

  const { title, description, icon } = getErrorContent();
  const detailText =
    typeof details === 'string'
      ? details
      : details !== undefined
        ? JSON.stringify(details, null, 2)
        : null;

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 text-center">
      <div className="text-5xl mb-4">{icon}</div>
      <h2 className="text-xl font-semibold text-text mb-2">{title}</h2>
      <p className="text-muted text-sm max-w-md mb-2">{description}</p>
      {detailText && (
        <pre className="text-xs text-muted bg-panel border border-line rounded p-3 max-w-md overflow-auto mb-4">
          {detailText}
        </pre>
      )}
      <div className="flex gap-3">
        {onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            {t('common.retry') || 'Retry'}
          </Button>
        )}
        {showHomeButton && (
          <Button variant="primary" onClick={() => navigate('/runs')}>
            {t('common.viewRuns') || 'View Runs'}
          </Button>
        )}
      </div>
    </div>
  );
}
