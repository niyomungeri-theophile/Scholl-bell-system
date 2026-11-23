import {
  ArrowRight,
  Bell,
  BookOpen,
  Info,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  Phone,
  Send,
  Share2,
  X,
} from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { CAMPUS_GALLERY, HERO_CAMPUS_IMAGE, LOGIN_CAMPUS_IMAGE } from '../data/campusGallery';
import { LanguageCode, TRANSLATIONS } from '../data/translations';
import { listPublicAnnouncements, submitContactInquiry } from '../services/schoolBellService';
import {
  AnnouncementItem,
  AppView,
  AuthUser,
  BellTone,
  CampusShowcasePhoto,
} from '../types';
import { CampusImage } from './CampusImage';

interface HomePageProps {
  activePage: 'home' | 'about' | 'contact' | 'campuses' | 'announcements';
  user: AuthUser | null;
  language: LanguageCode;
  onNavigate: (view: AppView) => void;
}

const FILMSTRIP_PHOTOS: CampusShowcasePhoto[] = [
  ...CAMPUS_GALLERY,
  {
    id: 'heritage-tower',
    title: 'Heritage Stone Bell Tower',
    campusArea: 'Main Entrance',
    zoneTag: 'Zone 05 · Main Gate Chime',
    tone: 'westminster-chime',
    description:
      'Welcoming arrival chime greeting students and faculty at the main limestone entrance pavilion.',
    imageSrc: LOGIN_CAMPUS_IMAGE,
    imageAlt: 'Classic stone school entrance and bell tower framed by cypress trees',
  },
];

export function HomePage({ activePage, user, language, onNavigate }: HomePageProps) {
  const t = TRANSLATIONS[language];
  const [centerIndex, setCenterIndex] = useState<number>(0);
  const [activePhotoModal, setActivePhotoModal] = useState<CampusShowcasePhoto | null>(null);

  // Announcements from Realtime Database
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);

  // Contact form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [submittingContact, setSubmittingContact] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSent, setContactSent] = useState(false);
  const [socialNotice, setSocialNotice] = useState<string | null>(null);

  useEffect(() => {
    if (activePage !== 'announcements') return;
    let active = true;
    setLoadingAnnouncements(true);
    listPublicAnnouncements()
      .then((items) => {
        if (active) setAnnouncements(items);
      })
      .finally(() => {
        if (active) setLoadingAnnouncements(false);
      });
    return () => {
      active = false;
    };
  }, [activePage]);

  // Gentle slideshow rotation across landscape campus photos
  useEffect(() => {
    const slideTimer = window.setInterval(() => {
      setCenterIndex((prev) => (prev + 1) % CAMPUS_GALLERY.length);
    }, 6000);
    return () => window.clearInterval(slideTimer);
  }, []);
  const activeCenterPhoto = CAMPUS_GALLERY[centerIndex] ?? {
    id: 'hero',
    title: 'Central Campus',
    campusArea: 'Main Grounds',
    zoneTag: 'Zone 01',
    tone: 'brass-bell' as BellTone,
    description: '',
    imageSrc: HERO_CAMPUS_IMAGE,
    imageAlt: 'Modern school campus',
  };

  const handleContactSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !staffEmail.trim() || !subject || !inquiryMessage.trim()) {
      return;
    }
    setContactError(null);
    setSubmittingContact(true);
    try {
      await submitContactInquiry({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: staffEmail.trim(),
        subject,
        message: inquiryMessage.trim(),
      });
      setContactSent(true);
      setFirstName('');
      setLastName('');
      setStaffEmail('');
      setSubject('');
      setInquiryMessage('');
    } catch (err) {
      setContactError(err instanceof Error ? err.message : 'Unable to send message to database.');
    } finally {
      setSubmittingContact(false);
    }
  };

  const handleSocialClick = (platform: string, detail: string) => {
    setSocialNotice(`${platform}: ${detail}`);
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] flex flex-col justify-between bg-[#F8F9FA] dark:bg-[#060B19] text-slate-900 dark:text-slate-100 transition-colors">
      {/* PAGE 1: HOME (Photo-Only Hero + Filmstrip + 3 Centered Action Buttons) */}
      {activePage === 'home' && (
        <section className="w-full pb-8">
          <div className="w-full h-[56vh] min-h-[380px] sm:h-[64vh] lg:h-[72vh] overflow-hidden bg-slate-900">
            <CampusImage
              src={activeCenterPhoto.imageSrc}
              alt={activeCenterPhoto.imageAlt}
              fallbackTitle={activeCenterPhoto.title}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Bottom Horizontal School Photo Strip + 3 Centered Action Buttons */}
          <div className="relative w-full px-3 sm:px-4 mt-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {FILMSTRIP_PHOTOS.map((photo, idx) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => {
                    if (idx < CAMPUS_GALLERY.length) {
                      setCenterIndex(idx);
                    }
                    setActivePhotoModal(photo);
                  }}
                  className="group relative aspect-[16/10] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <CampusImage
                    src={photo.imageSrc}
                    alt={photo.imageAlt}
                    fallbackTitle={photo.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/20 to-transparent" />
                  <span className="absolute bottom-2 left-3 right-3 text-left text-xs font-medium text-white truncate">
                    {photo.title}
                  </span>
                </button>
              ))}
            </div>

            {/* Centered 3-Button Action Overlay Row */}
            <div className="mt-4 lg:mt-0 lg:absolute lg:inset-0 lg:pointer-events-none flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => onNavigate(user ? 'console' : 'login')}
                className="pointer-events-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold uppercase tracking-wide shadow-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>{t.hero.enterPortal}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('about')}
                className="pointer-events-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-slate-900/85 dark:bg-white/15 hover:bg-slate-900 dark:hover:bg-white/25 backdrop-blur-md border border-white/25 text-white text-xs sm:text-sm font-bold uppercase tracking-wide shadow-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <BookOpen className="w-4 h-4" />
                <span>{t.hero.quickGuide}</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('campuses')}
                className="pointer-events-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs sm:text-sm font-bold uppercase tracking-wide shadow-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                <span>{t.hero.ourServices}</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* PAGE 2: CAMPUSES & LIVE AUDIO STUDIO */}
      {activePage === 'campuses' && (
        <section
          id="services"
          className="max-w-[1440px] w-full mx-auto px-5 sm:px-8 py-12"
        >
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-cyan-400 mb-2">
              {t.sections.campusesKicker}
            </p>
            <h2
              className="font-display text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight"
              style={{ textWrap: 'balance' }}
            >
              {t.sections.campusesTitle}
            </h2>
          </div>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-md leading-relaxed">
            {t.sections.campusesSubtitle}
          </p>
        </div>

        {/* 4 School Photos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {CAMPUS_GALLERY.map((campus) => (
            <article
              key={campus.id}
              className="group bg-white dark:bg-[#0B1224] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-between"
            >
              <div>
                <button
                  type="button"
                  onClick={() => setActivePhotoModal(campus)}
                  className="relative block w-full aspect-[4/3] overflow-hidden bg-slate-900 cursor-pointer"
                >
                  <CampusImage
                    src={campus.imageSrc}
                    alt={campus.imageAlt}
                    fallbackTitle={campus.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </button>
                <div className="p-5">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                    <span>{campus.campusArea}</span>
                    <span aria-hidden="true">·</span>
                    <span>{campus.zoneTag}</span>
                  </div>
                  <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white mb-1.5">
                    {campus.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {campus.description}
                  </p>
                </div>
              </div>
              <div className="px-5 pb-5 pt-2 flex items-center justify-end border-t border-slate-100 dark:border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setActivePhotoModal(campus)}
                  className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  {t.sections.viewPhoto}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
      )}

      {/* PAGE 3: ANNOUNCEMENTS */}
      {activePage === 'announcements' && (
        <section
          id="announcements"
          className="max-w-[1440px] w-full mx-auto px-5 sm:px-8 py-12"
        >
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2">
              {t.sections.announcementsKicker}
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {t.sections.announcementsTitle}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
              {t.sections.announcementsSubtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate(user ? 'console' : 'login')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start md:self-auto"
          >
            <span>{user ? t.nav.openConsole : t.hero.enterPortal}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loadingAnnouncements ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-40 bg-white dark:bg-[#0B1224] border border-slate-200 dark:border-slate-800 rounded-2xl animate-pulse"
              />
            ))}
          </div>
        ) : announcements.length === 0 ? (
          <div className="bg-white dark:bg-[#0B1224] border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
            <Megaphone className="w-8 h-8 text-slate-400 mx-auto mb-3" />
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white mb-1">
              {language === 'rw'
                ? 'Nta matangazo rusange cyangwa poromosiyo birashyirwaho'
                : 'No Public Promotions or Announcements Yet'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
              {language === 'rw'
                ? 'Poromosiyo nshya zo gushyira inzogera mu bigo (installation) n’amatangazo rusange atangwa na Admin agenewe abantu bose azajya agaragara hano. Ibigo byiyandikishije bishobora kwinjira (Login) bikabona School Bell Announcements.'
                : 'Public installation promotions and general updates published by BellCraft Admin for everyone and new visitors will appear here. Registered schools can sign in to view School Bell Announcements.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {announcements.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-[#0B1224] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 mb-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 text-emerald-700 dark:text-emerald-300 font-semibold">
                      <Megaphone className="w-3.5 h-3.5" />
                      <span>{item.tag || 'Promotion'}</span>
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">
                      {new Date(item.createdAtMs).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                    {item.detail}
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    {language === 'rw' ? 'Itangazo rya BellCraft kuri bose' : 'Public BellCraft Notice'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigate('contact')}
                    className="font-semibold text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer"
                  >
                    {language === 'rw' ? 'Twandikire →' : 'Inquire →'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      )}

      {/* PAGE 4: ABOUT US (Introduction, Objective, Problem, Overview) */}
      {activePage === 'about' && (
        <section
          id="about"
          className="max-w-[1440px] w-full mx-auto px-5 sm:px-8 py-12"
        >
        <div id="quick-guide" className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-cyan-400 mb-2">
              {t.sections.guideKicker}
            </p>
            <h2
              className="font-display text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight mb-3"
              style={{ textWrap: 'balance' }}
            >
              {t.sections.guideTitle}
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              {t.sections.guideSubtitle}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate(user ? 'console' : 'login')}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start lg:self-auto"
          >
            <span>{user ? t.nav.openConsole : t.hero.enterPortal}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {t.sections.aboutPillars.map((pillar) => (
            <article
              key={pillar.number}
              className="bg-white dark:bg-[#0B1224] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-7"
            >
              <p className="font-mono text-xs font-semibold text-blue-600 dark:text-cyan-400 mb-2">
                {pillar.number}.
              </p>
              <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white mb-2.5">
                {pillar.title}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {pillar.detail}
              </p>
            </article>
          ))}
        </div>
      </section>
      )}

      {/* PAGE 5: CONTACT (Get In Touch) */}
      {activePage === 'contact' && (
        <section
          id="contact"
          className="max-w-[1440px] w-full mx-auto px-5 sm:px-8 py-12 space-y-6"
        >
        {/* Top Gradient Header Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-blue-600 to-blue-500 p-7 sm:p-10 text-white">
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mb-2">
            {t.sections.contactTitle}
          </h2>
          <p className="text-sm sm:text-base text-blue-50 max-w-2xl leading-relaxed">
            {t.sections.contactSubtitle}
          </p>
        </div>

        {/* 2-Column Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Send Us a Message Form Card */}
          <div className="lg:col-span-7 bg-white dark:bg-[#0B1224] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8">
            <div className="flex items-center gap-2.5 mb-6">
              <Send className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                {t.sections.contactFormTitle}
              </h3>
            </div>

            {contactSent ? (
              <div className="p-6 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                <h4 className="font-display text-lg font-bold text-emerald-900 dark:text-emerald-200 mb-1">
                  {t.sections.contactSentTitle}
                </h4>
                <p className="text-sm text-emerald-800 dark:text-emerald-300 mb-4">
                  {t.sections.contactSentDetail}
                </p>
                <button
                  type="button"
                  onClick={() => setContactSent(false)}
                  className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 underline cursor-pointer"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="space-y-4">
                {contactError && (
                  <div
                    role="alert"
                    className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-200"
                  >
                    {contactError}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="contact-first-name"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      {t.sections.contactFirstName}
                    </label>
                    <input
                      id="contact-first-name"
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="John"
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#1E293B]/60 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="contact-last-name"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      {t.sections.contactLastName}
                    </label>
                    <input
                      id="contact-last-name"
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Doe"
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#1E293B]/60 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="contact-email"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    {t.sections.contactEmailLabel}
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    required
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#1E293B]/60 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="contact-subject"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    {t.sections.contactSubjectLabel}
                  </label>
                  <select
                    id="contact-subject"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#1E293B]/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">{t.sections.contactSubjectPlaceholder}</option>
                    {t.sections.contactSubjects.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="contact-msg"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    {t.sections.contactMessageLabel}
                  </label>
                  <textarea
                    id="contact-msg"
                    rows={4}
                    required
                    value={inquiryMessage}
                    onChange={(e) => setInquiryMessage(e.target.value)}
                    placeholder={t.sections.contactMessagePlaceholder}
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#1E293B]/60 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingContact}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>{submittingContact ? 'Sending...' : t.sections.contactSend}</span>
                </button>
              </form>
            )}
          </div>

          {/* Right Column: Contact Details + Connect With Us */}
          <div className="lg:col-span-5 space-y-6">
            {/* Contact Details Card */}
            <div className="bg-white dark:bg-[#0B1224] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8">
              <div className="flex items-center gap-2.5 mb-6">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  {t.sections.contactDetailsTitle}
                </h3>
              </div>

              <div className="space-y-5 text-sm">
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Email</p>
                    <a
                      href="mailto:niyomungeritheophile02@gmail.com"
                      className="block font-medium text-blue-600 dark:text-blue-400 hover:underline truncate"
                    >
                      niyomungeritheophile02@gmail.com
                    </a>
                    <a
                      href="mailto:support@bellcraft.rw"
                      className="block font-medium text-blue-600 dark:text-blue-400 hover:underline truncate"
                    >
                      support@bellcraft.rw
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Phone</p>
                    <p className="font-mono font-medium text-slate-900 dark:text-white tabular-nums">
                      +250 785 133 511
                    </p>
                    <p className="font-mono font-medium text-slate-900 dark:text-white tabular-nums">
                      +250 787 853 990
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Mon–Fri, 8am–5pm (GMT+2)
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">
                      Headquarters
                    </p>
                    <p className="font-medium text-slate-900 dark:text-white">
                      BellCraft School Systems
                    </p>
                    <p className="text-slate-600 dark:text-slate-300">KG 7 Avenue, Kigali</p>
                    <p className="text-slate-600 dark:text-slate-300">Rwanda</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Connect With Us Card */}
            <div className="bg-white dark:bg-[#0B1224] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8">
              <div className="flex items-center gap-2.5 mb-5">
                <Share2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  {t.sections.contactConnectTitle}
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  aria-label="WhatsApp"
                  onClick={() => handleSocialClick('WhatsApp', '+250 785 133 511')}
                  className="w-10 h-10 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label="Facebook"
                  onClick={() => handleSocialClick('Facebook', 'BellCraft Rwanda')}
                  className="w-10 h-10 rounded-full bg-blue-500/15 hover:bg-blue-500/25 text-blue-600 dark:text-blue-400 flex items-center justify-center transition-colors cursor-pointer font-display font-bold text-sm"
                >
                  f
                </button>
                <button
                  type="button"
                  aria-label="Instagram"
                  onClick={() => handleSocialClick('Instagram', '@bellcraft.rw')}
                  className="w-10 h-10 rounded-full bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 flex items-center justify-center transition-colors cursor-pointer font-display font-bold text-xs"
                >
                  IG
                </button>
                <button
                  type="button"
                  aria-label="LinkedIn"
                  onClick={() => handleSocialClick('LinkedIn', 'BellCraft School Systems')}
                  className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-colors cursor-pointer font-display font-bold text-xs"
                >
                  in
                </button>
                <button
                  type="button"
                  aria-label="YouTube"
                  onClick={() => handleSocialClick('YouTube', 'BellCraft Tutorials')}
                  className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700/70 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white flex items-center justify-center transition-colors cursor-pointer font-display font-bold text-xs"
                >
                  YT
                </button>
              </div>

              {socialNotice && (
                <p className="mt-4 text-xs text-slate-600 dark:text-slate-300 font-medium">
                  {socialNotice}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
      )}

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#060B19]">
        <div className="w-full px-5 sm:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          <p className="font-medium text-slate-900 dark:text-slate-200">
            BellCraft{' '}
            <span className="font-normal text-slate-500 dark:text-slate-400">
              — Automatic School Bell System · Built by Theophile Nimwungeri
            </span>
          </p>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => onNavigate('announcements')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              {t.nav.announcements}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('about')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              {t.nav.about}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('contact')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              {t.nav.contact}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('console')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              {t.nav.console}
            </button>
            {!user && (
              <button
                type="button"
                onClick={() => onNavigate('login')}
                className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                {t.nav.login}
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Campus Photo Inspection Modal */}
      {activePhotoModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={activePhotoModal.title}
        >
          <div className="bg-white dark:bg-[#0B1224] rounded-2xl max-w-3xl w-full overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="relative aspect-[16/10] bg-slate-900">
              <CampusImage
                src={activePhotoModal.imageSrc}
                alt={activePhotoModal.imageAlt}
                fallbackTitle={activePhotoModal.title}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => setActivePhotoModal(null)}
                aria-label="Close campus photo preview"
                className="absolute top-4 right-4 w-10 h-10 rounded-lg bg-slate-950/75 hover:bg-slate-950 text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{activePhotoModal.campusArea}</span>
                  <span aria-hidden="true">·</span>
                  <span>{activePhotoModal.zoneTag}</span>
                </div>
                <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white mb-1">
                  {activePhotoModal.title}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {activePhotoModal.description}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
