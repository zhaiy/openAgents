import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n';
import { useApi } from '../hooks/useApi';
import { workflowApi } from '../api';

export default function WorkflowsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: workflows, isLoading } = useApi(() => workflowApi.list());

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <h2 className="text-2xl font-semibold text-text mb-8">{t('workflows.title')}</h2>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : workflows && workflows.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {workflows.map((workflow) => (
            <div
              key={workflow.id}
              className="bg-panel border border-line rounded-xl p-6 hover:border-brand/30 transition-all duration-200 flex flex-col"
            >
              <h3 className="text-lg font-medium text-text mb-2">{workflow.name}</h3>
              <p className="text-sm text-muted mb-4 line-clamp-2 flex-1">{workflow.description}</p>
              <div className="flex items-center gap-4 text-xs text-muted mb-6">
                <span>{workflow.stepCount} {t('workflows.steps')}</span>
                {workflow.hasEval && <span className="text-success">{t('workflows.evalEnabled')}</span>}
              </div>
              <button
                onClick={() => navigate(`/workflows/${workflow.id}/run`)}
                className="w-full btn-primary py-2.5"
              >
                {t('workflows.run')}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-panel rounded-lg border border-line">
          <svg className="w-12 h-12 mx-auto text-muted mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-muted text-lg mb-2">{t('workflows.empty')}</p>
          <p className="text-sm text-muted">{t('workflows.emptyHint')}</p>
        </div>
      )}
    </div>
  );
}
