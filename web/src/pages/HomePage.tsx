import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n';
import { useApi } from '../hooks/useApi';
import { runApi } from '../api';

export default function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: runs, isLoading } = useApi(() => runApi.list());

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
      <section className="text-center mb-10 sm:mb-16">
        <h2 className="text-2xl sm:text-3xl font-semibold text-text mb-3">{t('home.title')}</h2>
        <p className="text-muted text-base sm:text-lg max-w-2xl mx-auto">{t('home.subtitle')}</p>
      </section>

      <section className="mb-8 sm:mb-12">
        <h3 className="text-sm font-medium text-muted uppercase tracking-wide mb-4">{t('home.quickActions')}</h3>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <button
            onClick={() => navigate('/workflows')}
            className="btn-primary px-6 py-3"
          >
            {t('home.runTemplate')}
          </button>
          <button
            onClick={() => navigate('/workflows')}
            className="btn-secondary px-6 py-3"
          >
            {t('home.viewWorkflows')}
          </button>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium text-muted uppercase tracking-wide mb-4">{t('home.recentRuns')}</h3>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : runs && runs.length > 0 ? (
          <div className="space-y-2">
            {runs.slice(0, 5).map((run) => (
              <div
                key={run.runId}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-panel rounded-lg border border-line hover:border-brand/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`badge ${getStatusBadgeClass(run.status)}`}>
                    {t(`status.${run.status}`)}
                  </span>
                  <span className="text-sm font-medium">{run.workflowName}</span>
                </div>
                <button
                  onClick={() => navigate(`/runs/${run.runId}`)}
                  className="text-sm text-muted hover:text-text transition-colors text-left sm:text-right"
                >
                  {t('runs.viewDetail')}
                </button>
              </div>
            ))}
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
    </div>
  );
}
