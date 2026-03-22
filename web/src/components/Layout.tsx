import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useTranslation } from '../i18n';

export default function Layout() {
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-line bg-panel sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-brand">OpenAgents</h1>

            {/* Mobile menu button */}
            <button
              type="button"
              className="sm:hidden p-2 -mr-2 text-muted hover:text-text"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>

            {/* Desktop nav */}
            <nav className="hidden sm:flex items-center gap-6">
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `text-sm transition-colors ${isActive ? 'text-text font-medium' : 'text-muted hover:text-text'}`
                }
              >
                {t('nav.home')}
              </NavLink>
              <NavLink
                to="/workflows"
                className={({ isActive }) =>
                  `text-sm transition-colors ${isActive ? 'text-text font-medium' : 'text-muted hover:text-text'}`
                }
              >
                {t('nav.workflows')}
              </NavLink>
              <NavLink
                to="/runs"
                className={({ isActive }) =>
                  `text-sm transition-colors ${isActive ? 'text-text font-medium' : 'text-muted hover:text-text'}`
                }
              >
                {t('nav.runs')}
              </NavLink>
              <NavLink
                to="/diagnostics"
                className={({ isActive }) =>
                  `text-sm transition-colors ${isActive ? 'text-text font-medium' : 'text-muted hover:text-text'}`
                }
              >
                {t('nav.diagnostics')}
              </NavLink>
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  `text-sm transition-colors ${isActive ? 'text-text font-medium' : 'text-muted hover:text-text'}`
                }
              >
                {t('nav.settings')}
              </NavLink>
            </nav>
          </div>

          {/* Mobile nav */}
          {mobileMenuOpen && (
            <nav className="sm:hidden mt-4 pb-2 border-t border-line pt-4 flex flex-col gap-3">
              <NavLink
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `text-sm transition-colors ${isActive ? 'text-text font-medium' : 'text-muted hover:text-text'}`
                }
              >
                {t('nav.home')}
              </NavLink>
              <NavLink
                to="/workflows"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `text-sm transition-colors ${isActive ? 'text-text font-medium' : 'text-muted hover:text-text'}`
                }
              >
                {t('nav.workflows')}
              </NavLink>
              <NavLink
                to="/runs"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `text-sm transition-colors ${isActive ? 'text-text font-medium' : 'text-muted hover:text-text'}`
                }
              >
                {t('nav.runs')}
              </NavLink>
              <NavLink
                to="/diagnostics"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `text-sm transition-colors ${isActive ? 'text-text font-medium' : 'text-muted hover:text-text'}`
                }
              >
                {t('nav.diagnostics')}
              </NavLink>
              <NavLink
                to="/settings"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `text-sm transition-colors ${isActive ? 'text-text font-medium' : 'text-muted hover:text-text'}`
                }
              >
                {t('nav.settings')}
              </NavLink>
            </nav>
          )}
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
