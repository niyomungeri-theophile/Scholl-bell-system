import { ArrowRight, Bell, Globe, Menu, Moon, Sun, X } from 'lucide-react';
import { useState } from 'react';
import { LanguageCode, TRANSLATIONS } from '../data/translations';
import { AppView, AuthUser } from '../types';

interface TopBarProps {
  currentView: AppView;
  user: AuthUser | null;
  theme: 'dark' | 'light';
  language: LanguageCode;
  onToggleTheme: () => void;
  onChangeLanguage: (lang: LanguageCode) => void;
  onNavigate: (view: AppView) => void;
  onSignOut: () => void;
}

export function TopBar({
  currentView,
  user,
  theme,
  language,
  onToggleTheme,
  onChangeLanguage,
  onNavigate,
  onSignOut,
}: TopBarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const t = TRANSLATIONS[language].nav;

  const handleNav = (view: AppView) => {
    setMobileOpen(false);
    onNavigate(view);
  };

  const navItems: { view: AppView; label: string }[] = [
    { view: 'home', label: t.home },
    { view: 'about', label: t.about },
    { view: 'contact', label: t.contact },
    { view: 'announcements', label: t.announcements },
    { view: 'console', label: t.console },
    ...(!user ? [{ view: 'login' as AppView, label: t.login }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#060B19]/95 backdrop-blur border-b border-slate-200 dark:border-slate-800/80">
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 xl:px-8 h-16 sm:h-[72px] flex items-center justify-between gap-3 sm:gap-4">
        {/* Zone 1: Brand Mark */}
        <button
          type="button"
          onClick={() => handleNav('home')}
          className="flex items-center gap-2.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
        >
          <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-blue-600 to-cyan-400 flex items-center justify-center text-white shrink-0">
            <Bell className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
          </span>
          <span className="font-display text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            BellCraft
          </span>
        </button>

        {/* Zone 2: Desktop Navigation Links (Larger, legible text & responsive spacing) */}
        <nav
          aria-label="Main navigation"
          className="hidden lg:flex items-center gap-1 xl:gap-2 text-[15px] xl:text-base font-semibold text-slate-700 dark:text-slate-200"
        >
          {navItems.map((item) => {
            const isActive = currentView === item.view;
            return (
              <button
                key={item.view}
                type="button"
                onClick={() => handleNav(item.view)}
                className={`whitespace-nowrap shrink-0 px-2.5 xl:px-3.5 py-2 rounded-lg transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-cyan-400'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-blue-600 dark:hover:text-white'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Theme Toggle, Language Switcher, Primary CTA & Mobile Menu Toggle */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-100 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <div className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-full bg-slate-100 dark:bg-white text-slate-900 text-xs xl:text-sm font-semibold shrink-0">
            <Globe className="w-3.5 h-3.5 text-slate-600 shrink-0" />
            <select
              aria-label="Select language"
              value={language}
              onChange={(e) => onChangeLanguage(e.target.value as LanguageCode)}
              className="bg-transparent text-slate-900 text-xs xl:text-sm font-semibold focus:outline-none cursor-pointer pr-1"
            >
              <option value="en">ENGLISH</option>
              <option value="rw">KINYARWANDA</option>
            </select>
          </div>

          {user ? (
            currentView === 'console' ? (
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>{t.signOut}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleNav('console')}
                className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>{t.openConsole}</span>
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={() => handleNav('login')}
              className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>{t.joinPlatform}</span>
              <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
            className="lg:hidden w-9 h-9 sm:w-10 sm:h-10 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile & Tablet Responsive Dropdown Navigation */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1224] px-4 sm:px-6 py-4 space-y-3 shadow-lg">
          <nav aria-label="Mobile navigation" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {navItems.map((item) => {
              const isActive = currentView === item.view;
              return (
                <button
                  key={item.view}
                  type="button"
                  onClick={() => handleNav(item.view)}
                  className={`text-left py-3 px-4 rounded-xl text-base font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-cyan-400'
                      : 'text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Language
            </span>
            <select
              aria-label="Mobile select language"
              value={language}
              onChange={(e) => onChangeLanguage(e.target.value as LanguageCode)}
              className="px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white cursor-pointer"
            >
              <option value="en">ENGLISH</option>
              <option value="rw">KINYARWANDA</option>
            </select>
          </div>
        </div>
      )}
    </header>
  );
}
