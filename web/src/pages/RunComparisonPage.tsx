/**
 * RunComparisonPage - T22
 *
 * Session-based run comparison page showing diff summary
 * between two runs.
 */
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from '../i18n';
import { useApi } from '../hooks/useApi';
import { comparisonApi, runApi } from '../api';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';

export default function RunComparisonPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  const runAId = searchParams.get('runA') || '';
  const runBId = searchParams.get('runB') || '';
  const sessionId = searchParams.get('session') || '';

  const { data: session, isLoading, error } = useApi(
    () => sessionId ? comparisonApi.getSession(sessionId) : Promise.resolve(null),
    [sessionId]
  );

  const { data: runA } = useApi(
    () => runAId ? runApi.get(runAId) : Promise.resolve(null),
    [runAId]
  );

  const { data: runB } = useApi(
    () => runBId ? runApi.get(runBId) : Promise.resolve(null),
    [runBId]
  );

  const comparison = session?.comparison ?? null;
  const canCompare = Boolean(runAId && runBId && runAId !== runBId);

  const updateRunParam = (key: 'runA' | 'runB', value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('session');
    setSearchParams(params);
  };

  const handleCompare = async () => {
    if (!canCompare) return;
    setIsCreatingSession(true);
    try {
      const created = await comparisonApi.createSession(runAId, runBId);
      const params = new URLSearchParams(searchParams);
      params.set('session', created.sessionId);
      setSearchParams(params);
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleClearComparison = async () => {
    if (sessionId) {
      try {
        await comparisonApi.deleteSession(sessionId);
      } catch {
        // Ignore missing session
      }
    }
    const params = new URLSearchParams(searchParams);
    params.delete('session');
    setSearchParams(params);
  };

  const handleViewRun = (runId: string) => {
    navigate(`/runs/${runId}/execute`);
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  const getStatusBadge = (status: string): 'success' | 'error' | 'warning' | 'default' => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'running':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-text">{t('comparison.title')}</h1>
        <p className="text-sm text-muted mt-1">{t('comparison.subtitle')}</p>
      </header>

      <Card className="mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">{t('comparison.runA')}</label>
            <input
              type="text"
              value={runAId}
              onChange={(e) => updateRunParam('runA', e.target.value)}
              placeholder={t('comparison.enterRunId')}
              className="w-full px-3 py-2 border border-line rounded-lg bg-bg text-sm focus:ring-2 focus:ring-brand focus:border-transparent"
            />
            {runA && (
              <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{runA.workflowName}</span>
                  <Badge variant={getStatusBadge(runA.status)}>{runA.status}</Badge>
                </div>
                <div className="text-xs text-muted space-y-1">
                  <div>{t('comparison.createdAt')}: {new Date(runA.createdAt).toLocaleString()}</div>
                  {runA.durationMs && <div>{t('comparison.duration')}: {formatDuration(runA.durationMs)}</div>}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{t('comparison.runB')}</label>
            <input
              type="text"
              value={runBId}
              onChange={(e) => updateRunParam('runB', e.target.value)}
              placeholder={t('comparison.enterRunId')}
              className="w-full px-3 py-2 border border-line rounded-lg bg-bg text-sm focus:ring-2 focus:ring-brand focus:border-transparent"
            />
            {runB && (
              <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{runB.workflowName}</span>
                  <Badge variant={getStatusBadge(runB.status)}>{runB.status}</Badge>
                </div>
                <div className="text-xs text-muted space-y-1">
                  <div>{t('comparison.createdAt')}: {new Date(runB.createdAt).toLocaleString()}</div>
                  {runB.durationMs && <div>{t('comparison.duration')}: {formatDuration(runB.durationMs)}</div>}
                </div>
              </div>
            )}
          </div>
        </div>

        {runAId === runBId && runAId && (
          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-700 dark:text-yellow-300">{t('comparison.sameRunWarning')}</p>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={handleCompare}
            disabled={!canCompare || isLoading || isCreatingSession}
          >
            {t('comparison.compare')}
          </Button>
          {sessionId && (
            <Button variant="ghost" onClick={handleClearComparison}>
              {t('common.close')}
            </Button>
          )}
        </div>
      </Card>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <p className="text-red-600 dark:text-red-400">
            {t('comparison.error')}: {error instanceof Error ? error.message : String(error)}
          </p>
        </Card>
      )}

      {comparison && (
        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
              <span>📊</span> {t('comparison.statusDiff')}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-xs text-muted mb-1">{t('comparison.runA')}: {comparison.runAId}</div>
                <Badge variant={getStatusBadge(comparison.statusDiff.runA)}>{comparison.statusDiff.runA}</Badge>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-xs text-muted mb-1">{t('comparison.runB')}: {comparison.runBId}</div>
                <Badge variant={getStatusBadge(comparison.statusDiff.runB)}>{comparison.statusDiff.runB}</Badge>
              </div>
            </div>
          </Card>

          {comparison.durationDiff && (
            <Card>
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                <span>⏱️</span> {t('comparison.durationDiff')}
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
                  <div className="text-2xl font-semibold">{formatDuration(comparison.durationDiff.runA)}</div>
                  <div className="text-xs text-muted mt-1">{t('comparison.runA')}</div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
                  <div className="text-2xl font-semibold">{formatDuration(comparison.durationDiff.runB)}</div>
                  <div className="text-xs text-muted mt-1">{t('comparison.runB')}</div>
                </div>
              </div>
            </Card>
          )}

          {comparison.tokenUsageDiff && (
            <Card>
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                <span>💰</span> {t('comparison.tokenUsageDiff')}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line">
                      <th className="text-left py-2 px-3">{t('comparison.metric')}</th>
                      <th className="text-right py-2 px-3">{t('comparison.runA')}</th>
                      <th className="text-right py-2 px-3">{t('comparison.runB')}</th>
                      <th className="text-right py-2 px-3">Diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-line">
                      <td className="py-2 px-3">{t('comparison.promptTokens')}</td>
                      <td className="text-right py-2 px-3 font-mono">{comparison.tokenUsageDiff.runA.promptTokens?.toLocaleString() || '-'}</td>
                      <td className="text-right py-2 px-3 font-mono">{comparison.tokenUsageDiff.runB.promptTokens?.toLocaleString() || '-'}</td>
                      <td className="text-right py-2 px-3">
                        {comparison.tokenUsageDiff.runA.promptTokens !== undefined && comparison.tokenUsageDiff.runB.promptTokens !== undefined
                          ? comparison.tokenUsageDiff.runA.promptTokens - comparison.tokenUsageDiff.runB.promptTokens
                          : '-'}
                      </td>
                    </tr>
                    <tr className="border-b border-line">
                      <td className="py-2 px-3">{t('comparison.completionTokens')}</td>
                      <td className="text-right py-2 px-3 font-mono">{comparison.tokenUsageDiff.runA.completionTokens?.toLocaleString() || '-'}</td>
                      <td className="text-right py-2 px-3 font-mono">{comparison.tokenUsageDiff.runB.completionTokens?.toLocaleString() || '-'}</td>
                      <td className="text-right py-2 px-3">
                        {comparison.tokenUsageDiff.runA.completionTokens !== undefined && comparison.tokenUsageDiff.runB.completionTokens !== undefined
                          ? comparison.tokenUsageDiff.runA.completionTokens - comparison.tokenUsageDiff.runB.completionTokens
                          : '-'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-medium">{t('comparison.totalTokens')}</td>
                      <td className="text-right py-2 px-3 font-mono font-medium">{comparison.tokenUsageDiff.runA.totalTokens.toLocaleString()}</td>
                      <td className="text-right py-2 px-3 font-mono font-medium">{comparison.tokenUsageDiff.runB.totalTokens.toLocaleString()}</td>
                      <td className="text-right py-2 px-3">
                        {comparison.tokenUsageDiff.runA.totalTokens - comparison.tokenUsageDiff.runB.totalTokens}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {comparison.nodeStatusDiff && comparison.nodeStatusDiff.length > 0 && (
            <Card>
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                <span>🔀</span> {t('comparison.nodeStatusDiff')}
              </h2>
              <div className="space-y-2">
                {comparison.nodeStatusDiff.map((diff) => (
                  <div key={`${diff.nodeId}:${diff.statusA}:${diff.statusB}`} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <span className="font-mono text-sm">{diff.nodeId}</span>
                    <div className="flex items-center gap-3">
                      <Badge variant={getStatusBadge(diff.statusA)}>{diff.statusA}</Badge>
                      <span className="text-muted">→</span>
                      <Badge variant={getStatusBadge(diff.statusB)}>{diff.statusB}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {comparison.outputDiffSummary && (
            <Card>
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                <span>📝</span> {t('comparison.outputDiffSummary')}
              </h2>
              <pre className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm font-mono whitespace-pre-wrap break-words">
                {comparison.outputDiffSummary}
              </pre>
            </Card>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => handleViewRun(comparison.runAId)}>
              {t('comparison.viewRunA')}
            </Button>
            <Button variant="secondary" onClick={() => handleViewRun(comparison.runBId)}>
              {t('comparison.viewRunB')}
            </Button>
          </div>
        </div>
      )}

      {!comparison && !isLoading && !error && (
        <Card>
          <div className="text-center py-8">
            <p className="text-sm text-muted">{t('comparison.enterRunIds')}</p>
            <p className="text-xs text-muted mt-2">{t('comparison.hint')}</p>
          </div>
        </Card>
      )}
    </div>
  );
}
