import { useTranslation } from '../i18n';
import { useApi } from '../hooks/useApi';
import { settingsApi } from '../api';

export default function SettingsPage() {
  const { t, locale, setLocale } = useTranslation();
  const { data: settings, isLoading } = useApi(() => settingsApi.get());

  const handleLocaleChange = (newLocale: 'en' | 'zh-CN') => {
    setLocale(newLocale);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <h2 className="text-2xl font-semibold text-text mb-8">{t('settings.title')}</h2>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          <section className="card">
            <h3 className="text-sm font-medium text-muted uppercase tracking-wide mb-4">{t('settings.language')}</h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => handleLocaleChange('en')}
                className={`px-4 py-2.5 rounded-lg font-medium transition-colors ${
                  locale === 'en' ? 'bg-brand text-white' : 'bg-bg border border-line hover:border-brand/30'
                }`}
              >
                English
              </button>
              <button
                onClick={() => handleLocaleChange('zh-CN')}
                className={`px-4 py-2.5 rounded-lg font-medium transition-colors ${
                  locale === 'zh-CN' ? 'bg-brand text-white' : 'bg-bg border border-line hover:border-brand/30'
                }`}
              >
                简体中文
              </button>
            </div>
          </section>

          <section className="card">
            <h3 className="text-sm font-medium text-muted uppercase tracking-wide mb-4">{t('settings.theme')}</h3>
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
          </section>

          <section className="card">
            <h3 className="text-sm font-medium text-muted uppercase tracking-wide mb-4">{t('settings.projectPath')}</h3>
            <p className="text-sm font-mono bg-bg px-3 py-2.5 rounded break-all">{settings?.projectPath || '-'}</p>
          </section>

          <section className="card">
            <h3 className="text-sm font-medium text-muted uppercase tracking-wide mb-4">{t('settings.environment')}</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">{t('settings.apiKey')}</span>
                <span className={`text-sm font-medium ${settings?.apiKeyConfigured ? 'text-success' : 'text-danger'}`}>
                  {settings?.apiKeyConfigured ? t('home.configured') : t('home.notConfigured')}
                </span>
              </div>
              <div className="h-px bg-line" />
              <div className="flex items-center justify-between">
                <span className="text-sm">{t('settings.baseUrl')}</span>
                <span className={`text-sm font-medium ${settings?.baseUrlConfigured ? 'text-success' : 'text-danger'}`}>
                  {settings?.baseUrlConfigured ? t('home.configured') : t('home.notConfigured')}
                </span>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
