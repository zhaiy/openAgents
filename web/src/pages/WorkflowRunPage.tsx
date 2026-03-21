import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n';
import { useApi } from '../hooks/useApi';
import { workflowApi, runApi } from '../api';

export default function WorkflowRunPage() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [inputMode, setInputMode] = useState<'text' | 'json'>('text');
  const [input, setInput] = useState('');
  const [inputJson, setInputJson] = useState('{}');
  const [streaming, setStreaming] = useState(true);
  const [autoApprove, setAutoApprove] = useState(false);
  const [noEval, setNoEval] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const { data: workflow } = useApi(() => workflowId ? workflowApi.get(workflowId) : Promise.resolve(null), [workflowId]);

  const handleJsonChange = (value: string) => {
    setInputJson(value);
    if (inputMode === 'json') {
      try {
        JSON.parse(value);
        setJsonError(null);
      } catch (e) {
        setJsonError(e instanceof Error ? e.message : 'Invalid JSON');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workflowId || (inputMode === 'json' && jsonError)) return;
    setIsSubmitting(true);
    try {
      let inputData: Record<string, unknown> | undefined;
      if (inputMode === 'json') {
        try {
          inputData = JSON.parse(inputJson);
        } catch {
          inputData = {};
        }
      }
      const result = await runApi.start({
        workflowId,
        input: inputMode === 'text' ? input : undefined,
        inputData,
        stream: streaming,
        autoApprove,
        noEval,
      });
      navigate(`/runs/${result.runId}`);
    } catch (err) {
      console.error('Failed to start run:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!workflow) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <h2 className="text-2xl font-semibold text-text mb-2">{t('runForm.title')}</h2>
      <p className="text-muted mb-8">{workflow.name}</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
            <span className="text-sm font-medium">{t('runForm.inputMode')}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setInputMode('text')}
                className={`px-3 py-1.5 text-sm rounded ${
                  inputMode === 'text' ? 'bg-brand text-white' : 'bg-panel border border-line'
                }`}
              >
                {t('runForm.plainText')}
              </button>
              <button
                type="button"
                onClick={() => setInputMode('json')}
                className={`px-3 py-1.5 text-sm rounded ${
                  inputMode === 'json' ? 'bg-brand text-white' : 'bg-panel border border-line'
                }`}
              >
                {t('runForm.json')}
              </button>
            </div>
          </div>

          {inputMode === 'text' ? (
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('runForm.inputPlaceholder')}
              rows={6}
              className="input resize-none"
            />
          ) : (
            <div>
              <textarea
                value={inputJson}
                onChange={(e) => handleJsonChange(e.target.value)}
                placeholder="{}"
                rows={6}
                className={`input resize-none font-mono text-sm ${jsonError ? 'border-danger' : ''}`}
              />
              {jsonError && (
                <p className="mt-2 text-sm text-danger">{jsonError}</p>
              )}
            </div>
          )}
        </div>

        <details className="group">
          <summary className="text-sm font-medium text-muted cursor-pointer hover:text-text list-none flex items-center gap-2">
            <span className="transition-transform group-open:rotate-90">▶</span>
            {t('runForm.options')}
          </summary>
          <div className="mt-4 space-y-3 pl-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={streaming}
                onChange={(e) => setStreaming(e.target.checked)}
                className="w-4 h-4 rounded border-line text-brand focus:ring-brand"
              />
              <span className="text-sm">{t('runForm.enableStreaming')}</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoApprove}
                onChange={(e) => setAutoApprove(e.target.checked)}
                className="w-4 h-4 rounded border-line text-brand focus:ring-brand"
              />
              <span className="text-sm">{t('runForm.autoApproveGates')}</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={noEval}
                onChange={(e) => setNoEval(e.target.checked)}
                className="w-4 h-4 rounded border-line text-brand focus:ring-brand"
              />
              <span className="text-sm">{t('runForm.skipEval')}</span>
            </label>
          </div>
        </details>

        <button
          type="submit"
          disabled={isSubmitting || (inputMode === 'json' && !!jsonError)}
          className="w-full btn-primary py-3"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {t('runForm.running')}
            </span>
          ) : t('runForm.submit')}
        </button>
      </form>
    </div>
  );
}
