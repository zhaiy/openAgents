/**
 * WorkflowsPage - T25 (Workflows List Upgrade)
 *
 * Upgraded with:
 * - Search functionality
 * - Filter by gate/eval
 * - Visual summary excerpt
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n';
import { useApi } from '../hooks/useApi';
import { workflowApi } from '../api';
import { Badge } from '../components/ui/Badge';

type FilterType = 'all' | 'hasGate' | 'hasEval' | 'hasGateOrEval';

export default function WorkflowsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: workflows, isLoading } = useApi(() => workflowApi.list());

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

  // Filter workflows
  const filteredWorkflows = useMemo(() => {
    if (!workflows) return [];

    return workflows.filter((workflow) => {
      // Search filter
      const matchesSearch =
        searchQuery === '' ||
        workflow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        workflow.description.toLowerCase().includes(searchQuery.toLowerCase());

      // Type filter
      let matchesFilter = true;
      if (filter === 'hasGate') {
        matchesFilter = !!workflow.hasGate;
      } else if (filter === 'hasEval') {
        matchesFilter = workflow.hasEval;
      } else if (filter === 'hasGateOrEval') {
        matchesFilter = !!workflow.hasGate || workflow.hasEval;
      }

      return matchesSearch && matchesFilter;
    });
  }, [workflows, searchQuery, filter]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h2 className="text-2xl font-semibold text-text">{t('workflows.title')}</h2>

        {/* Search */}
        <div className="flex gap-3">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('workflows.searchPlaceholder')}
              className="pl-10 pr-4 py-2 bg-panel border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 w-48 sm:w-64"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Filter dropdown */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterType)}
            className="px-3 py-2 bg-panel border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
          >
            <option value="all">{t('workflows.filterAll')}</option>
            <option value="hasGate">{t('workflows.filterHasGate')}</option>
            <option value="hasEval">{t('workflows.filterHasEval')}</option>
            <option value="hasGateOrEval">{t('workflows.filterHasGateOrEval')}</option>
          </select>
        </div>
      </div>

      {/* Results count */}
      {workflows && (
        <p className="text-sm text-muted mb-4">
          {t('workflows.resultsCount')
            .replace('{shown}', String(filteredWorkflows.length))
            .replace('{total}', String(workflows.length))}
        </p>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredWorkflows.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredWorkflows.map((workflow) => (
            <div
              key={workflow.id}
              className="bg-panel border border-line rounded-xl p-5 hover:border-brand/30 transition-all duration-200 flex flex-col"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <h3 className="text-lg font-medium text-text truncate flex-1">{workflow.name}</h3>
                <div className="flex gap-1 flex-shrink-0">
                  {workflow.hasEval && (
                    <Badge variant="completed" className="text-xs">📊</Badge>
                  )}
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-muted mb-4 line-clamp-2 flex-1">{workflow.description}</p>

              {/* Stats */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted mb-4">
                <span className="flex items-center gap-1">
                  <span>🔗</span>
                  <span>{workflow.stepCount} {t('workflows.steps')}</span>
                </span>
                <span className="flex items-center gap-1">
                  <span>🤖</span>
                  <span>{t('workflows.agents')}</span>
                </span>
                {workflow.hasEval && (
                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <span>✓</span>
                    <span>{t('workflows.evalEnabled')}</span>
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => navigate(`/workflows/${workflow.id}`)}
                  className="flex-1 btn-secondary py-2 text-sm"
                >
                  {t('workflows.viewDetail')}
                </button>
                <button
                  onClick={() => navigate(`/workflows/${workflow.id}/run`)}
                  className="flex-1 btn-primary py-2 text-sm"
                >
                  ▶ {t('workflows.run')}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : workflows && workflows.length > 0 ? (
        <div className="text-center py-12 bg-panel rounded-lg border border-line">
          <svg className="w-12 h-12 mx-auto text-muted mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-muted">{t('workflows.noSearchResults')}</p>
          <button
            onClick={() => { setSearchQuery(''); setFilter('all'); }}
            className="mt-4 text-sm text-brand hover:underline"
          >
            {t('workflows.clearFilters')}
          </button>
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
