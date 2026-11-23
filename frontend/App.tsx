import { WifiOff } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ConsolePage } from './components/ConsolePage';
import { HomePage } from './components/HomePage';
import { LoginPage } from './components/LoginPage';
import { TopBar } from './components/TopBar';
import { LanguageCode } from './data/translations';
import { auth } from '../database/firebase';
import { fetchCurrentUser, logoutSession } from './services/schoolBellService';
import { AppView, AuthUser } from './types';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetchCurrentUser()
      .then((sessionUser) => {
        if (!active) return;
        setUser(sessionUser);
      })
      .finally(() => {
        if (active) setAuthReady(true);
      });

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!active) return;
      if (!firebaseUser) {
        setUser(null);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const handleNavigate = (view: AppView) => {
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSignOut = async () => {
    setUser(null);
    setCurrentView('home');
    await logoutSession();
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#060B19] text-slate-900 dark:text-slate-100 transition-colors">
      <TopBar
        currentView={currentView}
        user={user}
        theme={theme}
        language={language}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        onChangeLanguage={setLanguage}
        onNavigate={handleNavigate}
        onSignOut={handleSignOut}
      />

      {!isOnline && currentView !== 'console' && (
        <div
          role="status"
          className="bg-red-600 text-white px-4 py-2 text-xs sm:text-sm font-medium flex items-center justify-center gap-2"
        >
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>
            {language === 'rw'
              ? 'Sisitemu iri OFFLINE — Nta internet ihari ubu.'
              : 'System is OFFLINE — No internet connection detected.'}
          </span>
        </div>
      )}

      {!authReady ? (
        <div className="max-w-[1440px] mx-auto px-6 py-20 text-center text-sm text-slate-500 dark:text-slate-400">
          Loading BellCraft School System...
        </div>
      ) : currentView === 'login' && !user ? (
        <LoginPage
          language={language}
          onNavigate={handleNavigate}
          onLoginSuccess={(loggedInUser) => {
            setUser(loggedInUser);
            setCurrentView('console');
          }}
        />
      ) : currentView === 'console' ? (
        <ConsolePage
          user={user}
          language={language}
          onNavigate={handleNavigate}
          onSignOut={handleSignOut}
          onFirebaseUserConnected={(connectedUser) => setUser(connectedUser)}
        />
      ) : (
        <HomePage
          activePage={
            currentView === 'about' ||
            currentView === 'contact' ||
            currentView === 'campuses' ||
            currentView === 'announcements'
              ? currentView
              : 'home'
          }
          user={user}
          language={language}
          onNavigate={handleNavigate}
        />
      )}
    </div>
  );
}
