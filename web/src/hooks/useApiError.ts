/**
 * useApiError - Hook for handling API errors uniformly
 *
 * Provides:
 * - Error state management
 * - Error type detection (not found, validation, etc.)
 * - Retry mechanism
 */
import { useState, useCallback } from 'react';
import { ApiError, type ApiErrorCode } from '../api';

export type ApiErrorState = {
  hasError: boolean;
  code?: ApiErrorCode;
  message?: string;
  details?: unknown;
  status?: number;
} | null;

interface UseApiErrorResult {
  error: ApiErrorState;
  isError: boolean;
  isNotFound: boolean;
  isValidationError: boolean;
  setError: (error: unknown) => void;
  clearError: () => void;
  wrapAsync: <T>(fn: () => Promise<T>) => Promise<T | null>;
}

export function useApiError(): UseApiErrorResult {
  const [error, setErrorState] = useState<ApiErrorState>(null);

  const setError = useCallback((err: unknown) => {
    if (err instanceof ApiError) {
      setErrorState({
        hasError: true,
        code: err.code,
        message: err.message,
        details: err.details,
        status: err.status,
      });
    } else if (err instanceof Error) {
      setErrorState({
        hasError: true,
        message: err.message,
      });
    } else {
      setErrorState({
        hasError: true,
        message: String(err),
      });
    }
  }, []);

  const clearError = useCallback(() => {
    setErrorState(null);
  }, []);

  const wrapAsync = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    try {
      clearError();
      return await fn();
    } catch (err) {
      setError(err);
      return null;
    }
  }, [clearError, setError]);

  return {
    error,
    isError: error?.hasError ?? false,
    isNotFound: error?.code === 'NOT_FOUND',
    isValidationError: error?.code === 'VALIDATION_ERROR',
    setError,
    clearError,
    wrapAsync,
  };
}