/**
 * HomePage - T24 (Workbench Upgrade)
 *
 * Upgraded to a workbench dashboard with:
 * - Needs Attention section (failed runs + waiting gates)
 * - Quick actions
 * - Recent runs
 * - Environment status
 */
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n';
import { useApi } from '../hooks/useApi';
import { runApi, diagnosticsApi } from '../api';
import { Badge } from '../components/ui/Badge';

export default function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: runs, isLoading: runsLoading } = useApi(() => runApi.list());
  const { data: failedRuns, isLoading: failedLoading } = useApi(() => diagnosticsApi.getFailedRuns());
  const { data: waitingGates, isLoading: gatesLoading } = useApi(() => diagnosticsApi.getWaitingGates());

  const needsAttention = (failedRuns?.length || 0) + (waitingGates?.length || 0);
  const isLoading = runsLoading || failedLoading || gatesLoading;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'completed':
        return 'badge-success';
      case 'failed':
        return 'badge-danger';
      case 'running':
        return 'badge-brand';
      case 'interrupted':
        return 'badge-warning';
      default:
        return 'bg-line text-muted';
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <section className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold text-text mb-2">{t('home.title')}</h1>
        <p className="text-muted text-base">{t('home.subtitle')}</p>
      </section>

      {/* Needs Attention Section */}
      {needsAttention > 0 && (
        <section className="mb-8">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚠️</span>
                <h2 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100">
                  {t('diagnostics.needsAttention')}
                </h2>
                <Badge variant="warning">{needsAttention}</Badge>
              </div>
              <button
                onClick={() => navigate('/diagnostics')}
                className="text-sm text-yellow-700 dark:text-yellow-300 hover:underline"
              >
                {t('diagnostics.title')} →
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Failed Runs */}
              {failedRuns && failedRuns.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-yellow-100 dark:border-yellow-900">
                  <h3 className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">
                    🔴 {t('diagnostics.failedRunsTab')} ({failedRuns.length})
                  </h3>
                  <div className="space-y-2">
                    {failedRuns.slice(0, 3).map((run) => (
                      <div key={run.runId} className="flex items-center justify-between">
                        <button
                          onClick={() => navigate(`/runs/${run.runId}`)}
                          className="text-sm text-muted hover:text-text truncate max-w-[180px]"
                        >
                          {run.workflowId}
                        </button>
                        <button
                          onClick={() => navigate(`/runs/${run.runId}/execute`)}
                          className="text-xs text-red-600 dark:text-red-400 hover:underline ml-2"
                        >
                          {t('diagnostics.viewRun')}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Waiting Gates */}
              {waitingGates && waitingGates.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-yellow-100 dark:border-yellow-900">
                  <h3 className="text-sm font-medium text-yellow-600 dark:text-yellow-400 mb-2">
                    🚧 {t('diagnostics.waitingGatesTab')} ({waitingGates.length})
                  </h3>
                  <div className="space-y-2">
                    {waitingGates.slice(0, 3).map((gate) => (
                      <div key={`${gate.runId}-${gate.stepId}`} className="flex items-center justify-between">
                        <button
                          onClick={() => navigate(`/runs/${gate.runId}/execute`)}
                          className="text-sm text-muted hover:text-text truncate max-w-[180px]"
                        >
                          {gate.workflowId}
                        </button>
                        <button
                          onClick={() => navigate(`/runs/${gate.runId}/execute`)}
                          className="text-xs text-yellow-600 dark:text-yellow-400 hover:underline ml-2"
                        >
                          {t('diagnostics.handleGate')}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Quick Actions */}
      <section className="mb-8">
        <h3 className="text-sm font-medium text-muted uppercase tracking-wide mb-4">{t('home.quickActions')}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => navigate('/workflows')}
            className="btn-primary px-4 py-3 text-left"
          >
            <span className="block text-lg mb-1">▶</span>
            <span className="text-sm font-medium">{t('home.runTemplate')}</span>
          </button>
          <button
            onClick={() => navigate('/runs')}
            className="btn-secondary px-4 py-3 text-left"
          >
            <span className="block text-lg mb-1">📋</span>
            <span className="text-sm font-medium">{t('runs.title')}</span>
          </button>
          <button
            onClick={() => navigate('/diagnostics')}
            className="btn-secondary px-4 py-3 text-left"
          >
            <span className="block text-lg mb-1">🔍</span>
            <span className="text-sm font-medium">{t('diagnostics.title')}</span>
          </button>
          <button
            onClick={() => navigate('/runs/compare')}
            className="btn-secondary px-4 py-3 text-left"
          >
            <span className="block text-lg mb-1">⚖️</span>
            <span className="text-sm font-medium">{t('comparison.title')}</span>
          </button>
        </div>
      </section>

      {/* Recent Runs */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-muted uppercase tracking-wide">{t('home.recentRuns')}</h3>
          <button
            onClick={() => navigate('/runs')}
            className="text-sm text-brand hover:underline"
          >
            {t('diagnostics.allRuns')} →
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : runs && runs.length > 0 ? (
          <div className="bg-panel rounded-xl border border-line overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-line text-left text-sm text-muted">
                    <th className="px-4 py-3 font-medium">{t('runs.status')}</th>
                    <th className="px-4 py-3 font-medium">{t('runs.workflow')}</th>
                    <th className="px-4 py-3 font-medium hidden sm:table-cell">{t('runs.createdAt')}</th>
                    <th className="px-4 py-3 font-medium hidden sm:table-cell">{t('runs.duration')}</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {runs.slice(0, 5).map((run) => (
                    <tr key={run.runId} className="hover:bg-bg/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`badge ${getStatusBadgeClass(run.status)}`}>
                          {t(`status.${run.status}`)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">{run.workflowName}</td>
                      <td className="px-4 py-3 text-sm text-muted hidden sm:table-cell">
                        {formatDate(run.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted hidden sm:table-cell">
                        {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {run.status === 'running' && (
                            <button
                              onClick={() => navigate(`/runs/${run.runId}/execute`)}
                              className="text-xs text-brand hover:underline"
                            >
                              📊 {t('rerun.viewInConsole')}
                            </button>
                          )}
                          <button
                            onClick={() => navigate(`/runs/${run.runId}`)}
                            className="text-xs text-muted hover:text-text"
                          >
                            {t('runs.viewDetail')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 bg-panel rounded-lg border border-line">
            <svg className="w-12 h-12 mx-auto text-muted mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-muted">{t('home.noRuns')}</p>
            <button
              onClick={() => navigate('/workflows')}
              className="mt-4 text-sm text-brand hover:underline"
            >
              {t('home.runTemplate')}
            </button>
          </div>
        )}
      </section>

      {/* Quick Links */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/workflows')}
          className="bg-panel border border-line rounded-xl p-4 text-left hover:border-brand/30 transition-colors"
        >
          <h3 className="font-medium mb-1">{t('diagnostics.workflows')}</h3>
          <p className="text-sm text-muted">{t('diagnostics.workflowsDesc')}</p>
        </button>
        <button
          onClick={() => navigate('/runs')}
          className="bg-panel border border-line rounded-xl p-4 text-left hover:border-brand/30 transition-colors"
        >
          <h3 className="font-medium mb-1">{t('diagnostics.allRuns')}</h3>
          <p className="text-sm text-muted">{t('diagnostics.allRunsDesc')}</p>
        </button>
      </section>
    </div>
  );
}
