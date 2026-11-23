import { ArrowLeft, Bell, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { LOGIN_STUDENTS_UNIFORM_IMAGE } from '../data/campusGallery';
import { LanguageCode, TRANSLATIONS } from '../data/translations';
import {
  confirmPasswordResetWithLink,
  loginWithEmailPassword,
  sendPasswordReset,
} from '../services/schoolBellService';
import { AppView, AuthUser } from '../types';
import { CampusImage } from './CampusImage';

interface LoginPageProps {
  language: LanguageCode;
  onNavigate: (view: AppView) => void;
  onLoginSuccess: (user: AuthUser) => void;
}

type AuthMode = 'signin' | 'reset' | 'confirm_reset';

export function LoginPage({ language, onNavigate, onLoginSuccess }: LoginPageProps) {
  const t = TRANSLATIONS[language].login;
  const isRw = language === 'rw';

  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetLinkOrCode, setResetLinkOrCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resetSentNotice, setResetSentNotice] = useState<string | null>(null);

  const isAdminEmailEntered = email.trim().toLowerCase() === 'niyomungeritheophile02@gmail.com';

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setErrorMessage(null);
    setResetSentNotice(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setResetSentNotice(null);
    setSubmitting(true);

    try {
      if (mode === 'reset') {
        await sendPasswordReset(email);
        setResetSentNotice(
          isRw
            ? `Link yoherejwe kuri ${email.trim()}. Aho kuyikandaho muri browser, ukore Copy Link maze ukande hasi ahanditse "Shyiramo Link cyangwa Code hano".`
            : `Reset link sent to ${email.trim()}. Right-click -> Copy Link Address and paste it below ("Paste Link / Code Here") instead of opening it directly.`
        );
        return;
      }

      if (mode === 'confirm_reset') {
        await confirmPasswordResetWithLink(resetLinkOrCode, password);
        setMode('signin');
        setResetLinkOrCode('');
        setResetSentNotice(
          isRw
            ? 'Ijambo ry’ibanga ryahinduwe neza! Noneho winjire na Email na Password nshya.'
            : 'Password updated successfully! Sign in below with your email and new password.'
        );
        return;
      }

      const authenticatedUser = await loginWithEmailPassword(email, password);
      onLoginSuccess(authenticatedUser);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to sign in.';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] w-full bg-[#F8F9FA] dark:bg-[#060B19] grid grid-cols-1 lg:grid-cols-2 items-stretch transition-colors">
      {/* Left Side (50%): Clear Image of School Students in Uniform */}
      <div className="relative w-full min-h-[320px] lg:min-h-[calc(100vh-4rem)] overflow-hidden bg-slate-900">
        <CampusImage
          src={LOGIN_STUDENTS_UNIFORM_IMAGE}
          alt="School students in crisp uniforms walking across a sunlit school campus courtyard"
          fallbackTitle="BellCraft Partner Schools"
          className="w-full h-full object-cover object-center"
        />
      </div>

      {/* Right Side (50%): Portal Sign-In Panel */}
      <div className="w-full bg-white dark:bg-[#0B1224] lg:border-l border-slate-200 dark:border-slate-800 flex items-center justify-center px-6 sm:px-12 lg:px-16 py-10">
        <div className="w-full max-w-md mx-auto">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-6 cursor-pointer"
          >
              <ArrowLeft className="w-4 h-4" />
              <span>{t.backHome}</span>
            </button>

            <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/70 flex items-center justify-center text-blue-600 dark:text-cyan-400 mb-5">
              <Bell className="w-5 h-5" />
            </div>

            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">
              {mode === 'reset'
                ? isRw
                  ? 'Hindura Ijambo ry’Ibanga'
                  : 'Reset Password'
                : t.portalTitle}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
              {t.portalSubtitle}
            </p>

            {errorMessage && (
              <div
                role="alert"
                className="mb-5 p-3.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs sm:text-sm text-red-800 dark:text-red-200"
              >
                {errorMessage}
              </div>
            )}

            {resetSentNotice && (
              <div
                role="status"
                className="mb-5 p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs sm:text-sm text-emerald-800 dark:text-emerald-200"
              >
                {resetSentNotice}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode !== 'confirm_reset' ? (
                <div>
                  <label
                    htmlFor="login-email"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    {isRw ? 'Imeyili (Email Address)' : 'Assigned Email Address'}
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="login-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="school@example.com"
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#060B19] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label
                    htmlFor="reset-link-code"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    {isRw ? 'Link cyangwa oobCode yo muri Email' : 'Paste Reset Link or oobCode from Email'}
                  </label>
                  <input
                    id="reset-link-code"
                    type="text"
                    required
                    value={resetLinkOrCode}
                    onChange={(e) => setResetLinkOrCode(e.target.value)}
                    placeholder="https://schoolbellsystem-8c6fe.firebaseapp.com/__/auth/action?..."
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#060B19] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {mode !== 'reset' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="login-password"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      {mode === 'confirm_reset'
                        ? isRw
                          ? 'Ijambo ry’Ibanga Rishya (6+)'
                          : 'New Password (6+ characters)'
                        : t.passwordLabel}
                    </label>
                    {mode === 'signin' && (
                      isAdminEmailEntered ? (
                        <button
                          type="button"
                          onClick={() => switchMode('reset')}
                          className="text-xs font-medium text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer"
                        >
                          {isRw ? 'Wibagiwe password?' : 'Forgot password?'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setErrorMessage(
                              isRw
                                ? 'Ask Admin for supporting it — Baza Company Admin (BellCraft) agufashe guhindura password y’ikigo.'
                                : 'Ask Admin for supporting it — Only BellCraft Company Admin can reset or change school passwords.'
                            )
                          }
                          className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                        >
                          {isRw ? 'Ask Admin for supporting it' : 'Ask Admin for supporting it'}
                        </button>
                      )
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete={mode === 'confirm_reset' ? 'new-password' : 'current-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t.passwordPlaceholder}
                      className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#060B19] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold text-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <span>
                  {submitting
                    ? t.signingIn
                    : mode === 'reset'
                    ? isRw
                      ? 'Ohereza Link yo Guhindura'
                      : 'Send Password Reset Email'
                    : mode === 'confirm_reset'
                    ? isRw
                      ? 'Emeza Password Nshya'
                      : 'Set New Password'
                    : t.submitButton}
                </span>
              </button>

              {mode === 'reset' && (
                <div className="flex flex-col gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => switchMode('confirm_reset')}
                    className="w-full py-2 text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer"
                  >
                    {isRw
                      ? 'Ufite Link cyangwa Code? Yishyire hano uhindure password'
                      : 'Already got the email? Paste Link / Code Here'}
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className="w-full py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    {isRw ? 'Subira kuri Sign In' : 'Back to Sign In'}
                  </button>
                </div>
              )}

              {mode === 'confirm_reset' && (
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="w-full py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  {isRw ? 'Subira kuri Sign In' : 'Back to Sign In'}
                </button>
              )}
            </form>

            <div className="mt-7 pt-5 border-t border-slate-100 dark:border-slate-800 space-y-3 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{t.note1}</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-blue-500 dark:text-cyan-400 shrink-0 mt-0.5" />
                <span>{t.note2}</span>
              </div>
            </div>
          </div>
      </div>
    </main>
  );
}
