import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n';
import { useApi } from '../hooks/useApi';
import { runApi } from '../api';

export default function RunsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: runs, isLoading } = useApi(() => runApi.list());

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

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
      <h2 className="text-2xl font-semibold text-text mb-8">{t('runs.title')}</h2>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : runs && runs.length > 0 ? (
        <div className="bg-panel rounded-xl border border-line overflow-hidden">
          {/* Desktop table view */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line text-left text-sm text-muted">
                  <th className="px-6 py-3 font-medium">{t('runs.status')}</th>
                  <th className="px-6 py-3 font-medium">{t('runs.workflow')}</th>
                  <th className="px-6 py-3 font-medium">{t('runs.createdAt')}</th>
                  <th className="px-6 py-3 font-medium">{t('runs.duration')}</th>
                  <th className="px-6 py-3 font-medium">{t('runs.score')}</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {runs.map((run) => (
                  <tr key={run.runId} className="hover:bg-bg/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className={`badge ${getStatusBadgeClass(run.status)}`}>
                        {t(`status.${run.status}`)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium">{run.workflowName}</td>
                    <td className="px-6 py-4 text-sm text-muted">{formatDate(run.createdAt)}</td>
                    <td className="px-6 py-4 text-sm text-muted">{formatDuration(run.durationMs)}</td>
                    <td className="px-6 py-4 text-sm">
                      {run.score !== undefined ? (
                        <span className={run.score >= 0.8 ? 'text-success' : run.score >= 0.5 ? 'text-warning' : 'text-danger'}>
                          {(run.score * 100).toFixed(0)}%
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {run.status === 'interrupted' && (
                          <button
                            onClick={() => runApi.resume(run.runId).then(() => navigate(`/runs/${run.runId}`))}
                            className="btn-primary px-3 py-1.5 text-sm"
                          >
                            {t('runs.resume')}
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/runs/${run.runId}`)}
                          className="btn-secondary px-3 py-1.5 text-sm"
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

          {/* Mobile card view */}
          <div className="sm:hidden divide-y divide-line">
            {runs.map((run) => (
              <div key={run.runId} className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`badge ${getStatusBadgeClass(run.status)}`}>
                      {t(`status.${run.status}`)}
                    </span>
                    <span className="text-sm font-medium">{run.workflowName}</span>
                  </div>
                  <span className="text-xs text-muted">{formatDate(run.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted space-x-3">
                    <span>{formatDuration(run.durationMs)}</span>
                    {run.score !== undefined && (
                      <span className={run.score >= 0.8 ? 'text-success' : run.score >= 0.5 ? 'text-warning' : 'text-danger'}>
                        {(run.score * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {run.status === 'interrupted' && (
                      <button
                        onClick={() => runApi.resume(run.runId).then(() => navigate(`/runs/${run.runId}`))}
                        className="btn-primary px-3 py-1.5 text-sm"
                      >
                        {t('runs.resume')}
                      </button>
                    )}
                    <button
                      onClick={() => navigate(`/runs/${run.runId}`)}
                      className="btn-secondary px-3 py-1.5 text-sm"
                    >
                      {t('runs.viewDetail')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-panel rounded-lg border border-line">
          <svg className="w-12 h-12 mx-auto text-muted mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-muted">{t('runs.empty')}</p>
        </div>
      )}
    </div>
  );
}
