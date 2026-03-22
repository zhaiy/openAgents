/**
 * SettingsPage - T27 (Settings Environment Upgrade)
 *
 * Upgraded with:
 * - Environment readiness status
 * - Default runtime options
 * - More detailed environment info
 */
import { useState } from 'react';
import { useTranslation } from '../i18n';
import { useApi } from '../hooks/useApi';
import { settingsApi } from '../api';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';

const DEFAULT_RUNTIME_OPTIONS_KEY = 'openagents.defaultRuntimeOptions';

export default function SettingsPage() {
  const { t, locale, setLocale } = useTranslation();
  const { data: settings, isLoading } = useApi(() => settingsApi.get());

  const persistedDefaults = (() => {
    try {
      const raw = window.localStorage.getItem(DEFAULT_RUNTIME_OPTIONS_KEY);
      return raw
        ? (JSON.parse(raw) as { stream?: boolean; autoApprove?: boolean; noEval?: boolean })
        : {};
    } catch {
      return {};
    }
  })();
  const [defaultStream, setDefaultStream] = useState(persistedDefaults.stream ?? true);
  const [defaultAutoApprove, setDefaultAutoApprove] = useState(persistedDefaults.autoApprove ?? false);
  const [defaultNoEval, setDefaultNoEval] = useState(persistedDefaults.noEval ?? false);

  const handleLocaleChange = (newLocale: 'en' | 'zh-CN') => {
    setLocale(newLocale);
  };

  const persistDefaults = (next: { stream?: boolean; autoApprove?: boolean; noEval?: boolean }) => {
    window.localStorage.setItem(DEFAULT_RUNTIME_OPTIONS_KEY, JSON.stringify(next));
  };

  // Determine environment readiness
  const isReady = settings?.apiKeyConfigured && settings?.baseUrlConfigured;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <h2 className="text-2xl font-semibold text-text mb-8">{t('settings.title')}</h2>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Environment Readiness */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium uppercase tracking-wide text-muted">
                {t('settings.environment')}
              </h3>
              <Badge variant={isReady ? 'completed' : 'warning'}>
                {isReady ? `✓ ${t('settings.ready')}` : `⚠ ${t('settings.notReady')}`}
              </Badge>
            </div>

            <div className="space-y-4">
              {/* Status indicators */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 bg-bg rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🔑</span>
                    <div>
                      <p className="text-sm font-medium">{t('settings.apiKey')}</p>
                      <p className="text-xs text-muted">{t('settings.apiKeyHint')}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-medium ${settings?.apiKeyConfigured ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {settings?.apiKeyConfigured ? t('home.configured') : t('home.notConfigured')}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-bg rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🌐</span>
                    <div>
                      <p className="text-sm font-medium">{t('settings.baseUrl')}</p>
                      <p className="text-xs text-muted">{t('settings.baseUrlHint')}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-medium ${settings?.baseUrlConfigured ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {settings?.baseUrlConfigured ? t('home.configured') : t('home.notConfigured')}
                  </span>
                </div>
              </div>

              {/* Environment details */}
              {settings?.projectPath && (
                <div className="p-3 bg-bg rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">📁</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{t('settings.projectPath')}</p>
                      <p className="text-xs text-muted font-mono break-all">{settings.projectPath}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Readiness message */}
              {!isReady && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    ⚠️ {t('settings.configureHint')}
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Default Runtime Options */}
          <Card>
            <h3 className="text-sm font-medium uppercase tracking-wide text-muted mb-4">
              {t('settings.defaultRuntimeOptions')}
            </h3>
            <p className="text-xs text-muted mb-4">
              {t('settings.defaultRuntimeHint')}
            </p>

            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 bg-bg rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <input
                  type="checkbox"
                  checked={defaultStream}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setDefaultStream(checked);
                    persistDefaults({ stream: checked, autoApprove: defaultAutoApprove, noEval: defaultNoEval });
                  }}
                  className="w-4 h-4 rounded border-line text-brand focus:ring-brand"
                />
                <div>
                  <p className="text-sm font-medium">{t('runForm.enableStreaming')}</p>
                  <p className="text-xs text-muted">{t('settings.streamHint')}</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-bg rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <input
                  type="checkbox"
                  checked={defaultAutoApprove}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setDefaultAutoApprove(checked);
                    persistDefaults({ stream: defaultStream, autoApprove: checked, noEval: defaultNoEval });
                  }}
                  className="w-4 h-4 rounded border-line text-brand focus:ring-brand"
                />
                <div>
                  <p className="text-sm font-medium">{t('runForm.autoApproveGates')}</p>
                  <p className="text-xs text-muted">{t('settings.autoApproveHint')}</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-bg rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <input
                  type="checkbox"
                  checked={defaultNoEval}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setDefaultNoEval(checked);
                    persistDefaults({ stream: defaultStream, autoApprove: defaultAutoApprove, noEval: checked });
                  }}
                  className="w-4 h-4 rounded border-line text-brand focus:ring-brand"
                />
                <div>
                  <p className="text-sm font-medium">{t('runForm.skipEval')}</p>
                  <p className="text-xs text-muted">{t('settings.noEvalHint')}</p>
                </div>
              </label>
            </div>
          </Card>

          {/* Language */}
          <Card>
            <h3 className="text-sm font-medium uppercase tracking-wide text-muted mb-4">{t('settings.language')}</h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => handleLocaleChange('en')}
                className={`px-4 py-2.5 rounded-lg font-medium transition-colors ${
                  locale === 'en'
                    ? 'bg-brand text-white'
                    : 'bg-bg border border-line hover:border-brand/30'
                }`}
              >
                {t('settings.languageEnglish')}
              </button>
              <button
                onClick={() => handleLocaleChange('zh-CN')}
                className={`px-4 py-2.5 rounded-lg font-medium transition-colors ${
                  locale === 'zh-CN'
                    ? 'bg-brand text-white'
                    : 'bg-bg border border-line hover:border-brand/30'
                }`}
              >
                {t('settings.languageSimplifiedChinese')}
              </button>
            </div>
          </Card>

          {/* Theme (Coming Soon) */}
          <Card>
            <h3 className="text-sm font-medium uppercase tracking-wide text-muted mb-4">{t('settings.theme')}</h3>
            <p className="text-sm text-muted mb-4">{t('settings.themeComingSoon')}</p>
            <div className="flex flex-wrap gap-3">
              <button
                disabled
                className="px-4 py-2.5 bg-bg border border-line rounded-lg font-medium text-muted cursor-not-allowed opacity-60"
              >
                {t('settings.themeLight')}
              </button>
              <button
                disabled
                className="px-4 py-2.5 bg-bg border border-line rounded-lg font-medium text-muted cursor-not-allowed opacity-60"
              >
                {t('settings.themeDark')}
              </button>
              <button
                disabled
                className="px-4 py-2.5 bg-bg border border-line rounded-lg font-medium text-muted cursor-not-allowed opacity-60"
              >
                {t('settings.themeSystem')}
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
