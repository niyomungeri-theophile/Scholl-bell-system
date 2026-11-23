import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  Code2,
  Copy,
  Database,
  Download,
  HardDrive,
  KeyRound,
  LayoutDashboard,
  Link2,
  Mail,
  Maximize2,
  Megaphone,
  Minimize2,
  PauseCircle,
  Pencil,
  Play,
  Plus,
  Power,
  RefreshCw,
  Search,
  Square,
  Trash2,
  Unlink,
  UserPlus,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { FormEvent, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LanguageCode } from '../data/translations';
import { auth, REALTIME_DB_URL } from '../../database/firebase';
import {
  assignEsp32DeviceToSchool,
  changeOwnPassword,
  checkCloudConnectivity,
  checkEsp32RtdbBridgeStatus,
  createAnnouncement,
  createBellSchedule,
  createRingLog,
  createSchool,
  createSchoolUser,
  deleteAnnouncement,
  deleteBellSchedule,
  deleteContactInquiry,
  deleteEsp32Device,
  deleteSchool,
  deleteSchoolUser,
  dispatchHardwareRingCommand,
  fetchSchoolEsp32LiveStatus,
  fetchSchoolWorkspace,
  getCachedSchoolsList,
  getCachedWorkspace,
  getServerSyncedNowMs,
  initializeRealtimeDatabaseTables,
  isEsp32DeviceOnline,
  listAllAnnouncements,
  listContactInquiries,
  listEsp32Devices,
  listSchoolAnnouncements,
  listSchools,
  registerEsp32Device,
  SchoolEsp32LiveStatus,
  sendAdminVerificationEmail,
  sendSchoolUserPasswordReset,
  stopHardwareRingCommand,
  submitContactInquiry,
  subscribeRealtimeConnection,
  subscribeSchoolEsp32LiveStatus,
  syncHardwareScheduleSnapshot,
  syncSchoolsRegistryToBridge,
  toSchoolBridgeKey,
  toggleBellScheduleEnabled,
  unassignEsp32Device,
  updateBellSchedule,
  updateSchoolSettings,
  updateSchoolUser,
  verifyEsp32OnlineBeforeCommand,
  wakeRealtimeConnection,
} from '../services/schoolBellService';
import {
  AnnouncementAudience,
  AnnouncementItem,
  AppView,
  AuthUser,
  BELL_TONE_LABELS,
  BellSchedule,
  BellTone,
  ContactInquiry,
  Esp32Device,
  MAX_USERS_PER_SCHOOL,
  RingLog,
  SCHOOL_WEEKDAYS,
  ScheduleProfile,
  SchoolConfig,
  SchoolUserAccount,
  WEEKDAYS,
  Weekday,
} from '../types';
import { playSchoolBell, stopAllBells } from '../utils/bellAudio';
import { fetchNetworkClockOffsetMs, getSyncedNow } from '../utils/networkTime';
import { downloadAllSchoolsSchedulePdf, downloadSchoolSchedulePdf } from '../utils/schedulePdf';
import { BellScheduleModal } from './BellScheduleModal';

interface ConsolePageProps {
  user: AuthUser | null;
  language?: LanguageCode;
  onNavigate: (view: AppView) => void;
  onSignOut: () => void;
  onFirebaseUserConnected?: (user: AuthUser) => void;
}

type ConsoleTab = 'schools' | 'devices' | 'dashboard' | 'timetable' | 'users' | 'notices';

const DASHBOARD_COPY: Record<
  LanguageCode,
  {
    sidebarSchools: string;
    sidebarDashboard: string;
    sidebarTimetable: string;
    sidebarUsers: string;
    currentLabel: string;
    ringingNow: string;
    inProgress: string;
    processed: string;
    waitingFirst: string;
    startedAt: string;
    until: string;
    startTimeLabel: string;
    endTimeLabel: string;
    noCurrentActivity: string;
    noCurrentActivityAt: string;
    noNextActivity: string;
    noNextActivityAt: string;
    lastProcessed: string;
    nextLabel: string;
    pending: string;
    noActivityBadge: string;
    scheduledAt: string;
    noUpcoming: string;
    manualTopTitle: string;
    manualTopSubtitle: string;
    modeAutomatic: string;
    modeManualSelected: string;
    automaticOption: string;
    manualOption: string;
    startManualBell: string;
    stopManualBell: string;
    modeAutoHint: string;
    modeManualHint: string;
    manualLockedHint: string;
    loginToSetBtn: string;
  }
> = {
  en: {
    sidebarSchools: 'All Schools',
    sidebarDashboard: 'Dashboard',
    sidebarTimetable: 'Set Schedule',
    sidebarUsers: 'School Users',
    currentLabel: 'Current Activity',
    ringingNow: 'Ringing Now',
    inProgress: 'In Progress',
    processed: 'Processed',
    waitingFirst: 'No scheduled activity right now',
    startedAt: 'Start Time',
    until: 'End Time',
    startTimeLabel: 'Start Time',
    endTimeLabel: 'End Time',
    noCurrentActivity: 'No Current Activity',
    noCurrentActivityAt: 'No scheduled activity running at',
    noNextActivity: 'No Next Activity',
    noNextActivityAt: 'No upcoming activity remaining today after',
    lastProcessed: 'Last processed',
    nextLabel: 'Next Activity',
    pending: 'Pending',
    noActivityBadge: 'No Activity',
    scheduledAt: 'Scheduled',
    noUpcoming: 'No upcoming activity for today',
    manualTopTitle: 'MANUAL BELL',
    manualTopSubtitle: 'SCHOOL BELL CONTROL',
    modeAutomatic: 'Automatic Active',
    modeManualSelected: 'Manual Selected',
    automaticOption: 'Automatic',
    manualOption: 'Manual',
    startManualBell: 'START MANUAL BELL',
    stopManualBell: 'STOP MANUAL BELL',
    modeAutoHint: 'Automatic schedule is active.',
    modeManualHint: 'Manual mode selected — press button to ring.',
    manualLockedHint: 'Locked in Automatic mode — select Manual to ring',
    loginToSetBtn: 'Login to Set Daily Schedule',
  },
  rw: {
    sidebarSchools: 'Ibigo Byose',
    sidebarDashboard: 'Dashboard',
    sidebarTimetable: 'Tegura Ingengabihe',
    sidebarUsers: 'Abakoresha b’Ikigo',
    currentLabel: 'Igikorwa Kiriho Ubu',
    ringingNow: 'Kirimo Kuvuga Ubu',
    inProgress: 'Kirimo Gukora',
    processed: 'Cyarangiye',
    waitingFirst: 'Nta gikorwa kiriho ubu',
    startedAt: 'Igihe Itangirira',
    until: 'Igihe Irangirira',
    startTimeLabel: 'Start Time',
    endTimeLabel: 'End Time',
    noCurrentActivity: 'Nta Gikorwa Kiriho Ubu',
    noCurrentActivityAt: 'Nta gikorwa giteganijwe ku isaha ya',
    noNextActivity: 'Nta Gikorwa Gikurikiyeho',
    noNextActivityAt: 'Nta gikorwa giteganijwe nyuma ya saa',
    lastProcessed: 'Iheruka kuvuga',
    nextLabel: 'Igikorwa Gikurikiyeho',
    pending: 'Gitegerejwe',
    noActivityBadge: 'Nta Gikorwa',
    scheduledAt: 'Igihe',
    noUpcoming: 'Nta gikorwa gikurikiyeho uyu munsi',
    manualTopTitle: 'MANUAL BELL',
    manualTopSubtitle: 'KUVUZA INZOGERA N’INTOKI',
    modeAutomatic: 'Automatic (Yikora)',
    modeManualSelected: 'Manual Selected (Intoki)',
    automaticOption: 'Automatic',
    manualOption: 'Manual',
    startManualBell: 'VUZA INZOGERA N’INTOKI',
    stopManualBell: 'HAGARIKA INZOGERA',
    modeAutoHint: 'Ingengabihe yikora irakora ku gihe.',
    modeManualHint: 'Manual yahiswemo — kanda buto itukura uvuze inzogera.',
    manualLockedHint: 'Ifunzwe muri Automatic — hitamo Manual ubone kuvuza',
    loginToSetBtn: 'Injira utegure ibikorwa by’umunsi',
  },
};

const JS_DAY_TO_WEEKDAY: Weekday[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const PROFILE_LABEL: Record<ScheduleProfile, string> = {
  Studying: 'For Studying',
  Exams: 'Exams',
};

const WEEKDAY_FULL_LABELS: Record<Weekday, string> = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
  Sun: 'Sunday',
};

function formatDurationSpan(startHHMM: string, endHHMM?: string): string {
  if (!endHHMM || endHHMM === startHHMM) return '';
  const [sh, sm] = startHHMM.split(':').map(Number);
  const [eh, em] = endHHMM.split(':').map(Number);
  if (Number.isNaN(sh) || Number.isNaN(sm) || Number.isNaN(eh) || Number.isNaN(em)) return '';
  const diffMin = eh * 60 + em - (sh * 60 + sm);
  if (diffMin <= 0) return '';
  const hrs = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins} min`;
}

function computeCountdown(now: Date, targetHHMM: string): string {
  const [hh, mm] = targetHHMM.split(':').map(Number);
  const target = new Date(now);
  target.setHours(hh, mm, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  const diffSec = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
  const hrs = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatDeviceDate(ms: number | null): string {
  if (!ms) return 'Never';
  return new Date(ms).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDeviceDateTime(ms: number | null): string {
  if (!ms) return 'Never';
  return new Date(ms).toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

const LiveClockText = memo(function LiveClockText({ offsetMs }: { offsetMs: number }) {
  const [clock, setClock] = useState(() =>
    getSyncedNow(offsetMs).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  );

  useEffect(() => {
    const update = () =>
      setClock(
        getSyncedNow(offsetMs).toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [offsetMs]);

  return <>{clock}</>;
});

const LiveCountdownText = memo(function LiveCountdownText({
  offsetMs,
  targetHHMM,
}: {
  offsetMs: number;
  targetHHMM: string;
}) {
  const [text, setText] = useState(() => computeCountdown(getSyncedNow(offsetMs), targetHHMM));

  useEffect(() => {
    const update = () => setText(computeCountdown(getSyncedNow(offsetMs), targetHHMM));
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [offsetMs, targetHHMM]);

  return <>{text}</>;
});

export function ConsolePage({
  user,
  language = 'en',
  onNavigate,
  onSignOut,
  onFirebaseUserConnected,
}: ConsolePageProps) {
  const dCopy = DASHBOARD_COPY[language];
  const isCompanyAdmin = user?.role === 'company_admin';

  const [activeTab, setActiveTab] = useState<ConsoleTab>(() =>
    user?.role === 'company_admin' ? 'schools' : 'dashboard'
  );
  const [schools, setSchools] = useState<SchoolConfig[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(
    () => user?.schoolId ?? null
  );

  const [schoolConfig, setSchoolConfig] = useState<SchoolConfig | null>(null);
  const [schedules, setSchedules] = useState<BellSchedule[]>([]);
  const [logs, setLogs] = useState<RingLog[]>([]);
  const [schoolUsers, setSchoolUsers] = useState<SchoolUserAccount[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [inquiries, setInquiries] = useState<ContactInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const [now, setNow] = useState<Date>(() => new Date());
  const [clockOffsetMs, setClockOffsetMs] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDay, setSelectedDay] = useState<Weekday | 'All'>(() => {
    const day = JS_DAY_TO_WEEKDAY[new Date().getDay()];
    return SCHOOL_WEEKDAYS.includes(day) ? day : 'Mon';
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BellSchedule | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isRingingTitle, setIsRingingTitle] = useState<string | null>(null);
  const [guestAutoMode, setGuestAutoMode] = useState(true);

  // Company Admin: Announcements & Inquiries state
  const [annTitle, setAnnTitle] = useState('');
  const [annDetail, setAnnDetail] = useState('');
  const [annAudience, setAnnAudience] = useState<AnnouncementAudience>('schools');
  const [annTag, setAnnTag] = useState('School Notice');
  const [creatingAnn, setCreatingAnn] = useState(false);
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [isDashboardFullscreen, setIsDashboardFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsDashboardFullscreen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDashboardFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const toggleDashboardFullscreen = async () => {
    if (!isDashboardFullscreen) {
      setIsDashboardFullscreen(true);
      try {
        if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        // Overlay fullscreen mode still remains active inside iframe/browser
      }
    } else {
      setIsDashboardFullscreen(false);
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        }
      } catch {
        // Ignore exitFullscreen errors
      }
    }
  };

  // School User: Send Support Request to Company state
  const [supportSubject, setSupportSubject] = useState('System / Technical Support');
  const [supportMessage, setSupportMessage] = useState('');
  const [sendingSupport, setSendingSupport] = useState(false);

  // Company Admin: Add / Edit School state
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newCampusLocation, setNewCampusLocation] = useState('');
  const [schoolSearchQuery, setSchoolSearchQuery] = useState('');
  const [creatingSchool, setCreatingSchool] = useState(false);
  const [confirmDeleteSchoolId, setConfirmDeleteSchoolId] = useState<string | null>(null);
  const [editingSchoolMetaId, setEditingSchoolMetaId] = useState<string | null>(null);
  const [editSchoolName, setEditSchoolName] = useState('');
  const [editCampusLocation, setEditCampusLocation] = useState('');

  // Company Admin: Manage School Users (2 standard per school + optional additional users)
  const [newUsername, setNewUsername] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);
  const [showExtraUserForm, setShowExtraUserForm] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserUsername, setEditUserUsername] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserCurrentPassword, setEditUserCurrentPassword] = useState('');
  const [editUserNewPassword, setEditUserNewPassword] = useState('');
  const [savingUserEdit, setSavingUserEdit] = useState(false);
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null);
  const [initializingRtdb, setInitializingRtdb] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [currentPwdInput, setCurrentPwdInput] = useState('');
  const [newPwdInput, setNewPwdInput] = useState('');
  const [changingPwd, setChangingPwd] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);

  // ESP32 Device Management state
  const [devices, setDevices] = useState<Esp32Device[]>([]);
  const [deviceFilter, setDeviceFilter] = useState<'all' | 'unassigned'>('all');
  const [deviceSearchQuery, setDeviceSearchQuery] = useState('');
  const [assigningDevice, setAssigningDevice] = useState<Esp32Device | null>(null);
  const [assignSchoolIdInput, setAssignSchoolIdInput] = useState('');
  const [assigningSaving, setAssigningSaving] = useState(false);
  const [addDeviceModalOpen, setAddDeviceModalOpen] = useState(false);
  const [newDeviceSerial, setNewDeviceSerial] = useState('');
  const [newDeviceChipId, setNewDeviceChipId] = useState('');
  const [newDeviceRelayPin, setNewDeviceRelayPin] = useState(2);
  const [newDeviceSchoolId, setNewDeviceSchoolId] = useState('');
  const [addingDevice, setAddingDevice] = useState(false);
  const [firmwareModalOpen, setFirmwareModalOpen] = useState(false);
  const [firmwareSchoolId, setFirmwareSchoolId] = useState('');
  const [firmwareRelayPin, setFirmwareRelayPin] = useState(2);
  const [firmwareRelayActiveLow, setFirmwareRelayActiveLow] = useState(true);
  const [firmwareWifiSsid, setFirmwareWifiSsid] = useState('');
  const [firmwareWifiPass, setFirmwareWifiPass] = useState('');
  const [rtdbBridgeStatus, setRtdbBridgeStatus] = useState<{ ready: boolean; status: number } | null>(
    null
  );
  const [checkingBridge, setCheckingBridge] = useState(false);
  const [verifyingHardwareSync, setVerifyingHardwareSync] = useState(false);
  const [lastDbSyncState, setLastDbSyncState] = useState<{ ok: boolean; atMs: number } | null>(null);
  const [isBrowserOnline, setIsBrowserOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isCloudOnline, setIsCloudOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [schoolEsp32Live, setSchoolEsp32Live] = useState<SchoolEsp32LiveStatus>({
    linked: false,
    online: false,
    lastSeenMs: null,
  });
  const [statusClockMs, setStatusClockMs] = useState<number>(() => getServerSyncedNowMs());
  const [verifyingCommand, setVerifyingCommand] = useState(false);
  const [confirmDeleteDeviceId, setConfirmDeleteDeviceId] = useState<string | null>(null);
  const [copiedKeyLabel, setCopiedKeyLabel] = useState<string | null>(null);
  const [exportingPdfSchoolId, setExportingPdfSchoolId] = useState<string | null>(null);
  const [exportingAllSchoolsPdf, setExportingAllSchoolsPdf] = useState(false);
  const syncedLinkedSchoolsRef = useRef<Set<string>>(new Set());
  const linkedWorkspacesRef = useRef<
    Map<string, { school: SchoolConfig; schedules: BellSchedule[] }>
  >(new Map());

  const networkOffsetMsRef = useRef<number>(0);
  const lastMinuteKeyRef = useRef<string>('');
  const lastAutoTriggeredKeysRef = useRef<Set<string>>(new Set());
  const schedulesRef = useRef<BellSchedule[]>(schedules);
  const schoolConfigRef = useRef<SchoolConfig | null>(schoolConfig);
  const schoolsRef = useRef<SchoolConfig[]>(schools);
  const userRef = useRef<AuthUser | null>(user);

  schedulesRef.current = schedules;
  schoolConfigRef.current = schoolConfig;
  schoolsRef.current = schools;
  userRef.current = user;

  // Reset view when logged-in account changes
  useEffect(() => {
    if (!user) {
      setActiveTab('dashboard');
      setSelectedSchoolId(null);
      setSchools([]);
      return;
    }
    if (user.role === 'company_admin') {
      setActiveTab('schools');
      setSelectedSchoolId(null);
    } else {
      setActiveTab('dashboard');
      setSelectedSchoolId(user.schoolId);
    }
  }, [user?.id, user?.role, user?.schoolId]);

  useEffect(() => {
    setShowExtraUserForm(false);
  }, [selectedSchoolId]);

  useEffect(() => {
    let active = true;
    const syncClock = async () => {
      const offset = await fetchNetworkClockOffsetMs();
      if (active && offset !== null) {
        networkOffsetMsRef.current = offset;
        setClockOffsetMs(offset);
        setNow(getSyncedNow(offset));
      }
    };

    syncClock();
    const resyncTimer = window.setInterval(syncClock, 5 * 60 * 1000);
    window.addEventListener('online', syncClock);

    return () => {
      active = false;
      window.clearInterval(resyncTimer);
      window.removeEventListener('online', syncClock);
    };
  }, []);

  const selectedSchoolIdRef = useRef<string | null>(selectedSchoolId);
  selectedSchoolIdRef.current = selectedSchoolId;
  const skipNextSelectedSchoolRefreshRef = useRef(false);
  const lastSyncedSnapshotSigRef = useRef<string>('');

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshWorkspace = useCallback(
    async (targetSchoolId?: string | null, options?: { skipAdminLists?: boolean }) => {
      if (!user || !mountedRef.current) return;
      try {
        let resolvedSchoolId = targetSchoolId ?? selectedSchoolIdRef.current ?? user.schoolId ?? null;

        if (user.role === 'company_admin') {
          // 1. Instant hydration from cache or in-memory schools list so UI never stalls on "Loading School..."
          const cachedList = getCachedSchoolsList(user.id);
          if (cachedList && cachedList.length > 0 && schoolsRef.current.length === 0) {
            setSchools(cachedList);
            if (!resolvedSchoolId) {
              resolvedSchoolId = cachedList[0].id;
              skipNextSelectedSchoolRefreshRef.current = true;
              setSelectedSchoolId(resolvedSchoolId);
            }
          }

          if (resolvedSchoolId) {
            const cachedWs = getCachedWorkspace(resolvedSchoolId);
            if (cachedWs?.school) {
              setSchoolConfig(cachedWs.school);
              setSchedules(cachedWs.schedules);
              setLogs(cachedWs.logs);
              setSchoolUsers(cachedWs.users);
              setLoading(false);
            }
          }

          // 2. Fire announcements & inquiries independently so they NEVER block Loading School...
          if (!options?.skipAdminLists) {
            void listAllAnnouncements()
              .then((allAnns) => {
                if (mountedRef.current) setAnnouncements(allAnns);
              })
              .catch(() => {});
            void listContactInquiries()
              .then((allInqs) => {
                if (mountedRef.current) setInquiries(allInqs);
              })
              .catch(() => {});
          }

          const shouldFetchSchools = !options?.skipAdminLists || schoolsRef.current.length === 0;
          const [allSchools, initialWorkspace] = await Promise.all([
            shouldFetchSchools ? listSchools() : Promise.resolve(schoolsRef.current),
            resolvedSchoolId ? fetchSchoolWorkspace(resolvedSchoolId) : Promise.resolve(null),
          ]);
          if (!mountedRef.current) return;
          if (shouldFetchSchools) {
            setSchools(allSchools);
          }

          if (!resolvedSchoolId || !allSchools.some((s) => s.id === resolvedSchoolId)) {
            resolvedSchoolId = allSchools[0]?.id ?? null;
            if (resolvedSchoolId !== selectedSchoolIdRef.current) {
              skipNextSelectedSchoolRefreshRef.current = true;
              setSelectedSchoolId(resolvedSchoolId);
            }
          }

          if (!resolvedSchoolId) {
            setSchoolConfig(null);
            setSchedules([]);
            setLogs([]);
            setSchoolUsers([]);
            setLoading(false);
            return;
          }

          if (initialWorkspace && initialWorkspace.school?.id === resolvedSchoolId) {
            setSchoolConfig(initialWorkspace.school);
            setSchedules(initialWorkspace.schedules);
            setLogs(initialWorkspace.logs);
            setSchoolUsers(initialWorkspace.users);
            setLoading(false);
            return;
          }

          const cachedSelected = getCachedWorkspace(resolvedSchoolId);
          if (cachedSelected?.school) {
            setSchoolConfig(cachedSelected.school);
            setSchedules(cachedSelected.schedules);
            setLogs(cachedSelected.logs);
            setSchoolUsers(cachedSelected.users);
            setLoading(false);
          }

          const workspace = await fetchSchoolWorkspace(resolvedSchoolId);
          if (!mountedRef.current) return;
          setSchoolConfig(workspace.school);
          setSchedules(workspace.schedules);
          setLogs(workspace.logs);
          setSchoolUsers(workspace.users);
          setLoading(false);
          return;
        }

        // School User path
        resolvedSchoolId = user.schoolId;
        if (!resolvedSchoolId) {
          setInquiries([]);
          setSchoolConfig(null);
          setSchedules([]);
          setLogs([]);
          setSchoolUsers([]);
          setLoading(false);
          void listSchoolAnnouncements()
            .then((schoolAnns) => {
              if (mountedRef.current) setAnnouncements(schoolAnns);
            })
            .catch(() => {});
          return;
        }

        const cachedWs = getCachedWorkspace(resolvedSchoolId);
        if (cachedWs?.school) {
          setSchoolConfig(cachedWs.school);
          setSchedules(cachedWs.schedules);
          setLogs(cachedWs.logs);
          setSchoolUsers(cachedWs.users);
          setLoading(false);
        }

        // Fetch announcements asynchronously so they never delay school name or bell schedule loading
        void listSchoolAnnouncements()
          .then((schoolAnns) => {
            if (mountedRef.current) setAnnouncements(schoolAnns);
          })
          .catch(() => {});

        const workspace = await fetchSchoolWorkspace(resolvedSchoolId);
        if (!mountedRef.current) return;
        setInquiries([]);
        setSchoolConfig(workspace.school);
        setSchedules(workspace.schedules);
        setLogs(workspace.logs);
        setSchoolUsers(workspace.users);
        setLoading(false);
      } catch (err) {
        if (!mountedRef.current) return;
        setErrorBanner(err instanceof Error ? err.message : 'Unable to load school workspace.');
        setLoading(false);
      }
    },
    [user]
  );

  useEffect(() => {
    if (!user) {
      setActiveTab('dashboard');
      setSchoolConfig(null);
      setSchedules([]);
      setLogs([]);
      setSchoolUsers([]);
      setAnnouncements([]);
      setInquiries([]);
      setLoading(false);
      return () => {
        stopAllBells();
      };
    }

    let cancelled = false;
    if (skipNextSelectedSchoolRefreshRef.current) {
      skipNextSelectedSchoolRefreshRef.current = false;
    } else {
      const targetId = selectedSchoolId ?? user.schoolId ?? null;
      const cachedWs = targetId ? getCachedWorkspace(targetId) : null;
      const matchedSchool = targetId
        ? schoolsRef.current.find((s) => s.id === targetId) || null
        : null;
      if (cachedWs?.school) {
        setSchoolConfig(cachedWs.school);
        setSchedules(cachedWs.schedules);
        setLogs(cachedWs.logs);
        setSchoolUsers(cachedWs.users);
        setLoading(false);
      } else if (matchedSchool) {
        setSchoolConfig(matchedSchool);
        setLoading(true);
      } else {
        setLoading(true);
      }
      void refreshWorkspace(selectedSchoolId, {
        skipAdminLists: Boolean(targetId && schoolsRef.current.length > 0),
      });
    }

    const syncTimer = window.setInterval(() => {
      if (!cancelled && document.visibilityState === 'visible') {
        void refreshWorkspace(selectedSchoolIdRef.current);
      }
    }, 60000);

    // Keep Firebase Auth token & RTDB WebSocket warm so idle tabs respond instantaneously on click
    const wakeSession = () => {
      if (!cancelled) {
        void wakeRealtimeConnection(false);
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        wakeSession();
      }
    };
    const keepAliveTimer = window.setInterval(() => {
      if (!cancelled && document.visibilityState === 'visible') {
        wakeSession();
      }
    }, 4 * 60 * 1000);

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', wakeSession);
    window.addEventListener('online', wakeSession);

    return () => {
      cancelled = true;
      window.clearInterval(syncTimer);
      window.clearInterval(keepAliveTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', wakeSession);
      window.removeEventListener('online', wakeSession);
      stopAllBells();
    };
  }, [user, selectedSchoolId, refreshWorkspace]);

  // Sync active school's schedule periods to Express & RTDB Bridge ONLY when actual schedule/config content changes
  useEffect(() => {
    if (!user || !schoolConfig) return;
    const hwCfg = schoolConfig.hardware?.config;
    const tzOffset = -new Date().getTimezoneOffset();
    const signature = JSON.stringify({
      id: schoolConfig.id,
      name: schoolConfig.schoolName,
      profile: schoolConfig.activeProfile,
      auto: schoolConfig.autoRingEnabled,
      hwEnabled: hwCfg?.enabled ?? true,
      relayPin: hwCfg?.relayPin ?? 2,
      tzOffset,
      schedules: schedules.map((s) => [
        s.id,
        s.title,
        s.time,
        s.endTime || '',
        s.profile,
        s.durationSec,
        s.enabled,
        s.examDate || '',
        s.days.join(','),
      ]),
    });

    if (lastSyncedSnapshotSigRef.current === signature) {
      return;
    }
    lastSyncedSnapshotSigRef.current = signature;

    let active = true;
    syncedLinkedSchoolsRef.current.add(schoolConfig.id);
    void syncHardwareScheduleSnapshot(schoolConfig, schedules).then((res) => {
      if (active) {
        setLastDbSyncState({ ok: res.dbSynced, atMs: res.updatedAtMs });
      }
    });
    return () => {
      active = false;
    };
  }, [user, schoolConfig, schedules]);

  const refreshDevices = useCallback(async () => {
    if (!user || !mountedRef.current) return;
    const list = await listEsp32Devices(
      user.role === 'company_admin' ? undefined : user.schoolId || undefined
    ).catch(() => [] as Esp32Device[]);
    if (mountedRef.current) {
      setDevices(list);
    }
  }, [user]);
  const refreshDevicesRef = useRef(refreshDevices);
  refreshDevicesRef.current = refreshDevices;

  // Sync Registered Schools list to Express Hardware Bridge so ESP32 firmware SCHOOL_NAME auto-links strictly to its school
  useEffect(() => {
    if (!user) return;
    const registryList = schools.length > 0 ? schools : schoolConfig ? [schoolConfig] : [];
    if (registryList.length === 0) return;
    void syncSchoolsRegistryToBridge(registryList).then((autoLinked) => {
      if (autoLinked > 0) {
        void refreshDevices();
      }
    });
  }, [user, schools, schoolConfig, refreshDevices]);

  // Ensure every school with a linked ESP32 has its schedule synced & cached for automatic background triggers
  useEffect(() => {
    if (!user || user.role !== 'company_admin' || devices.length === 0) return;
    const linkedSchoolIds = Array.from(
      new Set(
        devices
          .filter((d) => d.status === 'linked' && Boolean(d.schoolId))
          .map((d) => d.schoolId as string)
      )
    );
    const loadLinked = () => {
      linkedSchoolIds.forEach((sid) => {
        if (sid === schoolConfig?.id && schoolConfig) {
          linkedWorkspacesRef.current.set(sid, { school: schoolConfig, schedules });
          return;
        }
        void fetchSchoolWorkspace(sid)
          .then((ws) => {
            if (ws.school) {
              linkedWorkspacesRef.current.set(sid, {
                school: ws.school,
                schedules: ws.schedules,
              });
              if (!syncedLinkedSchoolsRef.current.has(sid)) {
                syncedLinkedSchoolsRef.current.add(sid);
                return syncHardwareScheduleSnapshot(ws.school, ws.schedules);
              }
            }
            return undefined;
          })
          .catch(() => {
            syncedLinkedSchoolsRef.current.delete(sid);
          });
      });
    };
    loadLinked();
    const timer = window.setInterval(loadLinked, 45000);
    return () => window.clearInterval(timer);
  }, [user, devices, schoolConfig, schedules]);

  useEffect(() => {
    if (!user) {
      setDevices([]);
      syncedLinkedSchoolsRef.current.clear();
      return;
    }
    void refreshDevices();
    if (activeTab !== 'devices' && activeTab !== 'timetable') return;
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshDevices();
      }
    }, 8000);
    return () => window.clearInterval(poll);
  }, [user, activeTab, refreshDevices]);

  // Real-time System Online/Offline detection (Browser Network + Firebase RTDB + HTTPS Cloud Check)
  useEffect(() => {
    let active = true;
    let rtdbConnected = false;

    const verifyCloud = async () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        if (active) {
          setIsBrowserOnline(false);
          setIsCloudOnline(false);
        }
        return;
      }
      if (active) setIsBrowserOnline(true);
      if (rtdbConnected) {
        if (active) setIsCloudOnline(true);
        return;
      }
      const reachable = await checkCloudConnectivity();
      if (active) {
        setIsCloudOnline(reachable);
      }
    };

    const handleOnline = () => {
      if (!active) return;
      setIsBrowserOnline(true);
      void wakeRealtimeConnection(false);
      void verifyCloud();
    };
    const handleOffline = () => {
      if (!active) return;
      setIsBrowserOnline(false);
      setIsCloudOnline(false);
    };

    const unsubRtdb = subscribeRealtimeConnection((connected) => {
      rtdbConnected = connected;
      if (!active) return;
      if (connected) {
        setIsBrowserOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
        setIsCloudOnline(true);
      } else if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setIsCloudOnline(false);
      } else {
        void verifyCloud();
      }
    });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    void verifyCloud();

    let tickCount = 0;
    const probeTimer = window.setInterval(() => {
      if (active && document.visibilityState === 'visible') {
        tickCount += 1;
        setStatusClockMs(getServerSyncedNowMs());
        if (!rtdbConnected && tickCount % 20 === 0) {
          void verifyCloud();
        }
      }
    }, 500);

    return () => {
      active = false;
      unsubRtdb();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.clearInterval(probeTimer);
    };
  }, []);

  // Real-time ESP32 Online/Offline monitoring (Firebase RTDB onValue + 2.5s REST fallback for ~1-3s offline detection)
  useEffect(() => {
    if (!user || !schoolConfig) {
      setSchoolEsp32Live({ linked: false, online: false, lastSeenMs: null });
      return;
    }
    let active = true;
    const applyLiveStatus = (live: SchoolEsp32LiveStatus) => {
      if (!active) return;
      setSchoolEsp32Live(live);
      if (live.chipId && live.lastSeenMs) {
        setDevices((prev) =>
          prev.map((d) =>
            d.chipId.toLowerCase() === live.chipId &&
            (d.lastSeenMs ?? 0) < (live.lastSeenMs ?? 0)
              ? { ...d, lastSeenMs: live.lastSeenMs }
              : d
          )
        );
      }
    };

    const unsubLive = subscribeSchoolEsp32LiveStatus(schoolConfig, applyLiveStatus);
    const pollEspStatus = async () => {
      const live = await fetchSchoolEsp32LiveStatus(schoolConfig).catch(() => null);
      if (active && live) {
        applyLiveStatus(live);
      }
    };
    void pollEspStatus();
    const timer = window.setInterval(() => {
      if (active && document.visibilityState === 'visible') {
        void pollEspStatus();
      }
    }, 2500);
    return () => {
      active = false;
      unsubLive();
      window.clearInterval(timer);
    };
  }, [user, schoolConfig]);

  const verifyRtdbBridge = useCallback(async () => {
    setCheckingBridge(true);
    const result = await checkEsp32RtdbBridgeStatus();
    if (mountedRef.current) {
      setRtdbBridgeStatus(result);
      setCheckingBridge(false);
    }
  }, []);

  useEffect(() => {
    if (!firmwareModalOpen) return;
    void verifyRtdbBridge();
  }, [firmwareModalOpen, verifyRtdbBridge]);

  // Real-time bell trigger check on exact second 00 without re-rendering ConsolePage every second
  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = getSyncedNow(networkOffsetMsRef.current);
      const hhmm = `${String(current.getHours()).padStart(2, '0')}:${String(current.getMinutes()).padStart(2, '0')}`;
      if (lastMinuteKeyRef.current !== hhmm) {
        lastMinuteKeyRef.current = hhmm;
        setNow(current);
      }

      const activeUser = userRef.current;
      const activeSchool = schoolConfigRef.current;
      if (!activeUser || current.getFullYear() < 2024) return;

      const ss = current.getSeconds();
      if (ss <= 5) {
        const todayWeekday = JS_DAY_TO_WEEKDAY[current.getDay()];
        const todayISO = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;

        const processSchoolAutoBells = (
          targetSchool: SchoolConfig,
          targetSchedules: BellSchedule[],
          isCurrentlyViewedSchool: boolean
        ) => {
          if (!targetSchool.autoRingEnabled) return;
          const activeToday = targetSchedules.filter((item) => {
            if (!item.enabled || item.profile !== targetSchool.activeProfile) return false;
            // Pre-flight expiration guard: examDate must exactly equal todayISO (expired dates never trigger)
            if (item.examDate) {
              return item.examDate === todayISO;
            }
            return item.days.includes(todayWeekday);
          });

          activeToday.forEach((bell) => {
            const hardwareEnabled = targetSchool.hardware?.config?.enabled ?? true;
            const deviceKey = targetSchool.hardware?.config?.deviceKey;
            const startEligible =
              bell.time === hhmm && (!bell.endTime || bell.endTime <= bell.time || hhmm < bell.endTime);

            if (startEligible) {
              const triggerKey = `${targetSchool.id}-${current.toDateString()}-${bell.id}-start-${hhmm}`;
              if (!lastAutoTriggeredKeysRef.current.has(triggerKey)) {
                lastAutoTriggeredKeysRef.current.add(triggerKey);
                if (isCurrentlyViewedSchool) {
                  setIsRingingTitle(bell.title);
                  playSchoolBell(bell.tone, targetSchool.masterVolume, () =>
                    setIsRingingTitle(null)
                  );
                }
                if (hardwareEnabled) {
                  dispatchHardwareRingCommand(targetSchool.id, {
                    title: bell.title,
                    tone: bell.tone,
                    durationSec: bell.durationSec,
                    triggerType: 'Automatic',
                    deviceKey,
                    schoolName: targetSchool.schoolName,
                    commandId: `auto-${targetSchool.id}-${todayISO}-${bell.id}-start-${hhmm}`,
                  })
                    .then(() => refreshDevicesRef.current())
                    .catch(() => {});
                }
                createRingLog(targetSchool.id, {
                  title: bell.title,
                  zone: bell.zone,
                  tone: bell.tone,
                  triggerType: 'Automatic',
                })
                  .then((createdLog) => {
                    if (isCurrentlyViewedSchool) {
                      setLogs((prev) => [createdLog, ...prev].slice(0, 10));
                    }
                  })
                  .catch(() => {});
              }
            } else if (bell.endTime && bell.endTime === hhmm && bell.endTime !== bell.time) {
              const endTitle = `${bell.title} (End)`;
              const triggerKey = `${targetSchool.id}-${current.toDateString()}-${bell.id}-end-${hhmm}`;
              if (!lastAutoTriggeredKeysRef.current.has(triggerKey)) {
                lastAutoTriggeredKeysRef.current.add(triggerKey);
                if (isCurrentlyViewedSchool) {
                  setIsRingingTitle(endTitle);
                  playSchoolBell(bell.tone, targetSchool.masterVolume, () =>
                    setIsRingingTitle(null)
                  );
                }
                if (hardwareEnabled) {
                  dispatchHardwareRingCommand(targetSchool.id, {
                    title: endTitle,
                    tone: bell.tone,
                    durationSec: bell.durationSec,
                    triggerType: 'Automatic',
                    deviceKey,
                    schoolName: targetSchool.schoolName,
                    commandId: `auto-${targetSchool.id}-${todayISO}-${bell.id}-end-${hhmm}`,
                  })
                    .then(() => refreshDevicesRef.current())
                    .catch(() => {});
                }
                createRingLog(targetSchool.id, {
                  title: endTitle,
                  zone: bell.zone,
                  tone: bell.tone,
                  triggerType: 'Automatic',
                })
                  .then((createdLog) => {
                    if (isCurrentlyViewedSchool) {
                      setLogs((prev) => [createdLog, ...prev].slice(0, 10));
                    }
                  })
                  .catch(() => {});
              }
            }
          });
        };

        if (activeSchool) {
          processSchoolAutoBells(activeSchool, schedulesRef.current, true);
        }
        if (activeUser.role === 'company_admin') {
          linkedWorkspacesRef.current.forEach((entry, sid) => {
            if (sid === activeSchool?.id) return;
            processSchoolAutoBells(entry.school, entry.schedules, false);
          });
        }
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const activeProfile: ScheduleProfile = schoolConfig?.activeProfile ?? 'Studying';
  const todayWeekday = JS_DAY_TO_WEEKDAY[now.getDay()];
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const activeTodaySchedules = useMemo(() => {
    return schedules
      .filter(
        (s) =>
          s.enabled &&
          s.profile === activeProfile &&
          (s.examDate ? s.examDate === todayISO : s.days.includes(todayWeekday))
      )
      .sort(
        (a, b) =>
          a.time.localeCompare(b.time) || (a.endTime || '').localeCompare(b.endTime || '')
      );
  }, [schedules, activeProfile, todayWeekday, todayISO]);

  const currentActivity = useMemo(() => {
    const matching = activeTodaySchedules.filter((s) => {
      if (s.time > currentHHMM) return false;
      if (s.endTime && s.endTime > s.time) {
        return currentHHMM < s.endTime;
      }
      return currentHHMM === s.time;
    });
    return matching.length > 0 ? matching[matching.length - 1] : null;
  }, [activeTodaySchedules, currentHHMM]);

  const nextScheduledBell = useMemo(() => {
    return activeTodaySchedules.find((s) => s.time > currentHHMM) ?? null;
  }, [activeTodaySchedules, currentHHMM]);

  const latestRingLog = logs[0] ?? null;
  const isAutomaticMode = user ? (schoolConfig?.autoRingEnabled ?? true) : guestAutoMode;

  const dayCounts = useMemo(() => {
    const counts: Record<Weekday, number> = {
      Mon: 0,
      Tue: 0,
      Wed: 0,
      Thu: 0,
      Fri: 0,
      Sat: 0,
      Sun: 0,
    };
    schedules.forEach((item) => {
      if (item.profile !== activeProfile) return;
      WEEKDAYS.forEach((day) => {
        if (item.days.includes(day)) counts[day] += 1;
      });
    });
    return counts;
  }, [schedules, activeProfile]);

  const filteredSchedules = useMemo(() => {
    return schedules
      .filter((item) => {
        if (item.profile !== activeProfile) return false;
        if (selectedDay !== 'All' && !item.days.includes(selectedDay)) return false;

        const q = searchQuery.trim().toLowerCase();
        return (
          !q ||
          item.title.toLowerCase().includes(q) ||
          (item.teacherName?.toLowerCase().includes(q) ?? false) ||
          (item.examDate?.includes(q) ?? false) ||
          item.time.includes(q) ||
          item.endTime.includes(q)
        );
      })
      .sort((a, b) => a.time.localeCompare(b.time) || a.endTime.localeCompare(b.endTime));
  }, [schedules, activeProfile, selectedDay, searchQuery]);

  const dayOverview = useMemo(() => {
    if (filteredSchedules.length === 0) return null;
    const firstStart = filteredSchedules[0].time;
    const lastEnd = filteredSchedules.reduce(
      (maxEnd, item) => (item.endTime && item.endTime > maxEnd ? item.endTime : maxEnd),
      filteredSchedules[0].endTime || filteredSchedules[0].time
    );
    const enabledCount = filteredSchedules.filter((s) => s.enabled).length;
    return {
      firstStart,
      lastEnd,
      totalCount: filteredSchedules.length,
      enabledCount,
    };
  }, [filteredSchedules]);

  const filteredSchools = useMemo(() => {
    const q = schoolSearchQuery.trim().toLowerCase();
    if (!q) return schools;
    return schools.filter(
      (s) =>
        s.schoolName.toLowerCase().includes(q) || s.campusLocation.toLowerCase().includes(q)
    );
  }, [schools, schoolSearchQuery]);

  const activeSchoolId = schoolConfig?.id ?? selectedSchoolId ?? user?.schoolId ?? null;

  const activeSchoolLinkedDevices = useMemo(
    () =>
      activeSchoolId
        ? devices.filter((d) => d.status === 'linked' && d.schoolId === activeSchoolId)
        : [],
    [devices, activeSchoolId]
  );

  const isSystemOnline = isBrowserOnline && isCloudOnline;

  const activeEsp32Status = useMemo(() => {
    const dev = activeSchoolLinkedDevices[0];
    if (dev) {
      const bestLastSeen = Math.max(dev.lastSeenMs ?? 0, schoolEsp32Live.lastSeenMs ?? 0) || null;
      return {
        linked: true,
        online: isSystemOnline && isEsp32DeviceOnline(bestLastSeen, statusClockMs),
        serialNumber: dev.serialNumber || schoolEsp32Live.serialNumber,
        lastSeenMs: bestLastSeen,
      };
    }
    if (schoolEsp32Live.linked) {
      return {
        linked: true,
        online: isSystemOnline && isEsp32DeviceOnline(schoolEsp32Live.lastSeenMs, statusClockMs),
        serialNumber: schoolEsp32Live.serialNumber,
        lastSeenMs: schoolEsp32Live.lastSeenMs,
      };
    }
    return {
      linked: false,
      online: false,
      serialNumber: undefined,
      lastSeenMs: null as number | null,
    };
  }, [activeSchoolLinkedDevices, schoolEsp32Live, isSystemOnline, statusClockMs]);

  const unassignedDevicesCount = useMemo(
    () => devices.filter((d) => d.status === 'awaiting_assignment' || !d.schoolId).length,
    [devices]
  );

  const filteredDevices = useMemo(() => {
    const q = deviceSearchQuery.trim().toLowerCase();
    return devices.filter((d) => {
      if (deviceFilter === 'unassigned' && d.status === 'linked' && d.schoolId) {
        return false;
      }
      if (!q) return true;
      return (
        d.serialNumber.toLowerCase().includes(q) ||
        d.chipId.toLowerCase().includes(q) ||
        (d.schoolName?.toLowerCase().includes(q) ?? false) ||
        (d.schoolEmail?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [devices, deviceFilter, deviceSearchQuery]);

  const triggerManualRing = async (title: string, tone: BellTone, zone = 'All Campus') => {
    if (!user || !activeSchoolId) return;
    if (!isSystemOnline || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
      setErrorBanner(
        'System is OFFLINE. Reconnect to the internet before sending bell commands.'
      );
      return;
    }

    const hardwareEnabled = schoolConfig?.hardware?.config?.enabled ?? true;
    const deviceKey = schoolConfig?.hardware?.config?.deviceKey;

    if (hardwareEnabled) {
      if (verifyingCommand) return;
      setVerifyingCommand(true);
      try {
        const verification = await verifyEsp32OnlineBeforeCommand(schoolConfig);
        if (!mountedRef.current) return;
        setStatusClockMs(getServerSyncedNowMs());
        setSchoolEsp32Live({
          linked: verification.linked,
          online: verification.online,
          serialNumber: verification.serialNumber,
          chipId: verification.chipId,
          lastSeenMs: verification.lastSeenMs,
        });
        if (!verification.ready) {
          setErrorBanner(
            verification.reason ||
              'ESP32 is OFFLINE. Power on ESP32 and wait for ESP32: ONLINE before ringing.'
          );
          return;
        }
      } finally {
        if (mountedRef.current) {
          setVerifyingCommand(false);
        }
      }
    }

    setErrorBanner(null);
    setIsRingingTitle(title);
    playSchoolBell(tone, schoolConfig?.masterVolume ?? 85, () => setIsRingingTitle(null));
    void wakeRealtimeConnection(false);

    if (hardwareEnabled) {
      dispatchHardwareRingCommand(activeSchoolId, {
        title,
        tone,
        durationSec: schoolConfig?.hardware?.config?.defaultDurationSec || 5,
        triggerType: 'Manual',
        deviceKey,
        schoolName: schoolConfig?.schoolName,
      })
        .then(() => {
          refreshDevices();
        })
        .catch((err) => {
          if (mountedRef.current) {
            setErrorBanner(
              err instanceof Error
                ? err.message
                : 'Failed to send manual bell command to ESP32 bridge.'
            );
          }
        });
    }
    createRingLog(activeSchoolId, {
      title,
      zone,
      tone,
      triggerType: 'Manual',
    })
      .then((log) => {
        if (mountedRef.current) {
          setLogs((prev) => [log, ...prev].slice(0, 50));
        }
      })
      .catch((err) => {
        if (mountedRef.current) {
          setErrorBanner(err instanceof Error ? err.message : 'Could not log manual bell ring.');
        }
      });
  };

  const handleStopRinging = () => {
    stopAllBells();
    setIsRingingTitle(null);
    if (user && activeSchoolId) {
      void wakeRealtimeConnection(false);
      stopHardwareRingCommand(
        activeSchoolId,
        schoolConfig?.hardware?.config?.deviceKey,
        schoolConfig?.schoolName
      ).catch(() => {});
    }
  };

  const handleCopyValue = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKeyLabel(label);
      window.setTimeout(() => setCopiedKeyLabel((prev) => (prev === label ? null : prev)), 2000);
    } catch {
      setStatusNotice(`Copy ${label}: ${text}`);
    }
  };

  const handleRegisterEsp32Device = async (e: FormEvent) => {
    e.preventDefault();
    if (!isCompanyAdmin) return;
    setErrorBanner(null);
    setAddingDevice(true);
    try {
      const targetSchool = newDeviceSchoolId
        ? schools.find((s) => s.id === newDeviceSchoolId) || null
        : null;
      const created = await registerEsp32Device({
        serialNumber: newDeviceSerial.trim() || undefined,
        chipId: newDeviceChipId.trim(),
        relayPin: newDeviceRelayPin,
        schoolId: targetSchool?.id ?? null,
        schoolName: targetSchool?.schoolName ?? null,
        schoolEmail: targetSchool ? targetSchool.primaryEmail || targetSchool.campusLocation : null,
      });
      setAddDeviceModalOpen(false);
      setNewDeviceSerial('');
      setNewDeviceChipId('');
      setNewDeviceRelayPin(2);
      setNewDeviceSchoolId('');
      if (targetSchool) {
        const ws = await fetchSchoolWorkspace(targetSchool.id).catch(() => null);
        if (ws?.school) {
          await syncHardwareScheduleSnapshot(ws.school, ws.schedules);
        }
      }
      await refreshDevices();
      setStatusNotice(
        created.status === 'linked'
          ? `ESP32 ${created.serialNumber} registered & linked to ${created.schoolName}.`
          : `ESP32 ${created.serialNumber} added as Awaiting Assignment.`
      );
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Unable to register ESP32 device.');
    } finally {
      setAddingDevice(false);
    }
  };

  const handleAssignDeviceSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isCompanyAdmin || !assigningDevice || !assignSchoolIdInput) return;
    const school = schools.find((s) => s.id === assignSchoolIdInput);
    if (!school) return;
    setErrorBanner(null);
    setAssigningSaving(true);
    try {
      const updated = await assignEsp32DeviceToSchool(assigningDevice.id, {
        id: school.id,
        schoolName: school.schoolName,
        email: school.primaryEmail || school.campusLocation,
      });
      const ws = await fetchSchoolWorkspace(school.id).catch(() => null);
      if (ws?.school) {
        await syncHardwareScheduleSnapshot(ws.school, ws.schedules);
      }
      setAssigningDevice(null);
      setAssignSchoolIdInput('');
      await refreshDevices();
      setStatusNotice(
        `ESP32 ${updated.serialNumber} (Chip ${updated.chipId}) linked to ${school.schoolName} only.`
      );
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Unable to assign ESP32 device.');
    } finally {
      setAssigningSaving(false);
    }
  };

  const handleUnassignDevice = async (device: Esp32Device) => {
    if (!isCompanyAdmin) return;
    setErrorBanner(null);
    try {
      await unassignEsp32Device(device.id);
      await refreshDevices();
      setStatusNotice(`ESP32 ${device.serialNumber} unassigned.`);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Unable to unassign ESP32 device.');
    }
  };

  const handleDeleteDevice = async (device: Esp32Device) => {
    if (!isCompanyAdmin) return;
    setErrorBanner(null);
    try {
      await deleteEsp32Device(device.id);
      setConfirmDeleteDeviceId(null);
      await refreshDevices();
      setStatusNotice(`ESP32 ${device.serialNumber} removed.`);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Unable to delete ESP32 device.');
    }
  };

  const handleTestDeviceRing = async (device: Esp32Device) => {
    if (!device.schoolId) return;
    setErrorBanner(null);
    const title = `ESP32 Test Ring (${device.serialNumber})`;
    setIsRingingTitle(title);
    playSchoolBell('brass-bell', schoolConfig?.masterVolume ?? 85, () => setIsRingingTitle(null));
    try {
      await dispatchHardwareRingCommand(device.schoolId, {
        title,
        tone: 'brass-bell',
        durationSec: 5,
        triggerType: 'Test',
        schoolName: device.schoolName || undefined,
      });
      await refreshDevices();
      setStatusNotice(`Ring signal pushed to ${device.serialNumber} (${device.schoolName}).`);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Unable to push ring command to ESP32.');
    }
  };

  const handleVerifyAndSyncHardware = async () => {
    if (!user || !schoolConfig) return;
    setErrorBanner(null);
    setVerifyingHardwareSync(true);
    try {
      const res = await syncHardwareScheduleSnapshot(schoolConfig, schedules);
      setLastDbSyncState({ ok: res.dbSynced, atMs: res.updatedAtMs });
      await refreshDevices();
      if (res.dbSynced) {
        setStatusNotice(
          `Database synced (${schedules.length} activities, TZ offset ${res.timezoneOffsetMinutes}m). ESP32 will confirm Flash EEPROM backup within seconds.`
        );
      } else {
        setErrorBanner(
          'Warning: Cloud RTDB schedule snapshot could not be confirmed. Check your internet connection and try again.'
        );
      }
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Unable to verify hardware sync.');
    } finally {
      setVerifyingHardwareSync(false);
    }
  };

  const handleSaveSchedule = async (
    payload: Omit<BellSchedule, 'id' | 'ownerId'>,
    existingId?: string
  ) => {
    if (!user || !activeSchoolId) return;
    setErrorBanner(null);
    if (existingId) {
      const updated = await updateBellSchedule(activeSchoolId, existingId, payload);
      setSchedules((prev) =>
        prev
          .map((item) => (item.id === existingId ? updated : item))
          .sort((a, b) => a.time.localeCompare(b.time))
      );
      setStatusNotice(`Updated "${payload.title}" at ${payload.time} (syncing to Database & ESP32 EEPROM).`);
    } else {
      const created = await createBellSchedule(activeSchoolId, payload);
      setSchedules((prev) => [...prev, created].sort((a, b) => a.time.localeCompare(b.time)));
      setSchools((prev) =>
        prev.map((s) =>
          s.id === activeSchoolId ? { ...s, scheduleCount: (s.scheduleCount ?? 0) + 1 } : s
        )
      );
      setStatusNotice(`Saved "${payload.title}" at ${payload.time} (syncing to Database & ESP32 EEPROM).`);
    }
    window.setTimeout(() => void refreshDevicesRef.current(), 1500);
    window.setTimeout(() => void refreshDevicesRef.current(), 4000);
  };

  const handleToggleSlotEnabled = async (item: BellSchedule) => {
    if (!user || !activeSchoolId) return;
    setErrorBanner(null);
    const nextEnabled = !item.enabled;
    setSchedules((prev) =>
      prev.map((s) => (s.id === item.id ? { ...s, enabled: nextEnabled } : s))
    );
    try {
      await toggleBellScheduleEnabled(activeSchoolId, item.id, nextEnabled);
      window.setTimeout(() => void refreshDevicesRef.current(), 1500);
      window.setTimeout(() => void refreshDevicesRef.current(), 4000);
    } catch (err) {
      setSchedules((prev) =>
        prev.map((s) => (s.id === item.id ? { ...s, enabled: item.enabled } : s))
      );
      setErrorBanner(err instanceof Error ? err.message : 'Unable to toggle schedule state.');
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!user || !activeSchoolId) return;
    setErrorBanner(null);
    try {
      await deleteBellSchedule(activeSchoolId, scheduleId);
      setConfirmDeleteId(null);
      setSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
      setSchools((prev) =>
        prev.map((s) =>
          s.id === activeSchoolId
            ? { ...s, scheduleCount: Math.max(0, (s.scheduleCount ?? 1) - 1) }
            : s
        )
      );
      setStatusNotice('Bell slot removed & queued for ESP32 EEPROM update.');
      window.setTimeout(() => void refreshDevicesRef.current(), 1500);
      window.setTimeout(() => void refreshDevicesRef.current(), 4000);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Unable to delete bell slot.');
    }
  };

  const handleDownloadSchoolPdf = async (targetSchool?: SchoolConfig) => {
    const schoolToExport = targetSchool || schoolConfig;
    if (!schoolToExport) return;
    setErrorBanner(null);
    setExportingPdfSchoolId(schoolToExport.id);
    try {
      let schoolSchedules = schedules;
      let resolvedSchool = schoolToExport;
      if (schoolToExport.id !== schoolConfig?.id) {
        const ws = await fetchSchoolWorkspace(schoolToExport.id);
        resolvedSchool = ws.school || schoolToExport;
        schoolSchedules = ws.schedules || [];
      }
      downloadSchoolSchedulePdf(resolvedSchool, schoolSchedules);
      setStatusNotice(`Downloaded PDF schedule for ${resolvedSchool.schoolName}.`);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Unable to generate PDF schedule.');
    } finally {
      setExportingPdfSchoolId(null);
    }
  };

  const handleDownloadAllSchoolsPdf = async () => {
    if (!isCompanyAdmin || schools.length === 0) return;
    setErrorBanner(null);
    setExportingAllSchoolsPdf(true);
    try {
      const entries = await Promise.all(
        schools.map(async (s) => {
          if (s.id === schoolConfig?.id) {
            return { school: schoolConfig, schedules };
          }
          const ws = await fetchSchoolWorkspace(s.id).catch(() => null);
          return {
            school: ws?.school || s,
            schedules: ws?.schedules || [],
          };
        })
      );
      downloadAllSchoolsSchedulePdf(entries);
      setStatusNotice(`Downloaded PDF schedules for all ${entries.length} schools.`);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Unable to generate all-schools PDF.');
    } finally {
      setExportingAllSchoolsPdf(false);
    }
  };

  const handleSwitchActiveProfile = async (profile: ScheduleProfile) => {
    if (!user || !activeSchoolId) return;
    setErrorBanner(null);
    const prevProfile = schoolConfig?.activeProfile ?? 'Studying';
    setSchoolConfig((prev) => (prev ? { ...prev, activeProfile: profile } : prev));
    try {
      const updated = await updateSchoolSettings(activeSchoolId, { activeProfile: profile });
      setSchoolConfig(updated);
      setSchools((prev) =>
        prev.map((s) => (s.id === activeSchoolId ? { ...s, activeProfile: profile } : s))
      );
      setStatusNotice(`Active campus timetable switched to ${PROFILE_LABEL[profile]} mode.`);
    } catch (err) {
      setSchoolConfig((prev) => (prev ? { ...prev, activeProfile: prevProfile } : prev));
      setErrorBanner(err instanceof Error ? err.message : 'Unable to switch active profile.');
    }
  };

  const handleSetRingMode = async (enableAuto: boolean) => {
    if (!user) {
      setGuestAutoMode(enableAuto);
      return;
    }
    if (!schoolConfig || schoolConfig.autoRingEnabled === enableAuto) return;
    setErrorBanner(null);
    const prevAuto = schoolConfig.autoRingEnabled;
    setSchoolConfig((prev) => (prev ? { ...prev, autoRingEnabled: enableAuto } : prev));
    try {
      const updated = await updateSchoolSettings(schoolConfig.id, {
        autoRingEnabled: enableAuto,
      });
      setSchoolConfig(updated);
      setSchools((prev) =>
        prev.map((s) => (s.id === schoolConfig.id ? { ...s, autoRingEnabled: enableAuto } : s))
      );
      setStatusNotice(
        enableAuto
          ? 'Automatic bell mode activated.'
          : 'Manual control mode selected. Scheduled auto-ringing is paused.'
      );
    } catch (err) {
      setSchoolConfig((prev) => (prev ? { ...prev, autoRingEnabled: prevAuto } : prev));
      setErrorBanner(err instanceof Error ? err.message : 'Unable to update bell mode.');
    }
  };

  const handleToggleAutoRing = async () => {
    if (!user) {
      setGuestAutoMode((prev) => !prev);
      return;
    }
    if (!schoolConfig) return;
    await handleSetRingMode(!schoolConfig.autoRingEnabled);
  };

  const handleInitializeRtdb = async () => {
    setErrorBanner(null);
    setInitializingRtdb(true);
    try {
      await auth.authStateReady();
      if (!auth.currentUser) {
        onNavigate('login');
        return;
      }
      const result = await initializeRealtimeDatabaseTables();
      setStatusNotice(
        `Realtime Database synced (${result.schoolCount} school${result.schoolCount === 1 ? '' : 's'}) at ${result.databaseUrl}`
      );
      await refreshWorkspace(selectedSchoolId);
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Unable to sync Realtime Database.'
      );
    } finally {
      setInitializingRtdb(false);
    }
  };

  // Company Admin / Owner: School CRUD handlers
  const handleCreateSchool = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !newSchoolName.trim()) return;
    setErrorBanner(null);
    setCreatingSchool(true);
    try {
      const created = await createSchool(
        newSchoolName.trim(),
        newCampusLocation.trim() || 'Main Campus'
      );
      setNewSchoolName('');
      setNewCampusLocation('');
      setSchools((prev) => [...prev, created]);
      setSelectedSchoolId(created.id);
      setSchoolConfig(created);
      setSchedules([]);
      setLogs([]);
      setSchoolUsers([]);
      setStatusNotice(`School "${created.schoolName}" created with isolated settings.`);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Unable to create school.');
    } finally {
      setCreatingSchool(false);
    }
  };

  const handleSaveSchoolMeta = async (schoolId: string) => {
    if (!isCompanyAdmin || !editSchoolName.trim()) return;
    setErrorBanner(null);
    try {
      const updated = await updateSchoolSettings(schoolId, {
        schoolName: editSchoolName.trim(),
        campusLocation: editCampusLocation.trim() || 'Main Campus',
      });
      setEditingSchoolMetaId(null);
      setSchools((prev) =>
        prev.map((s) =>
          s.id === schoolId
            ? { ...s, schoolName: updated.schoolName, campusLocation: updated.campusLocation }
            : s
        )
      );
      if (schoolConfig?.id === schoolId) {
        setSchoolConfig(updated);
      }
      setStatusNotice('School details updated.');
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Unable to update school settings.');
    }
  };

  const handleDeleteSchool = async (schoolId: string) => {
    if (!isCompanyAdmin) return;
    setErrorBanner(null);
    try {
      await deleteSchool(schoolId);
      setConfirmDeleteSchoolId(null);
      const remaining = schools.filter((s) => s.id !== schoolId);
      setSchools(remaining);
      if (selectedSchoolId === schoolId) {
        const nextId = remaining[0]?.id ?? null;
        setSelectedSchoolId(nextId);
        if (!nextId) {
          setSchoolConfig(null);
          setSchedules([]);
          setLogs([]);
          setSchoolUsers([]);
        }
      }
      setStatusNotice('School removed.');
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Unable to delete school.');
    }
  };

  // Company Admin: Per-School User Account Handlers (2 standard + optional additional users)
  const handleCreateSchoolUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!isCompanyAdmin || !activeSchoolId) return;
    if (!newUsername.trim() || !newUserEmail.trim() || !newUserPassword) {
      setErrorBanner('Enter staff name, login email, and password (at least 6 characters).');
      return;
    }
    setErrorBanner(null);
    setCreatingUser(true);
    try {
      const isAdditionalUser = schoolUsers.length >= MAX_USERS_PER_SCHOOL;
      const created = await createSchoolUser(
        activeSchoolId,
        newUsername.trim(),
        newUserEmail.trim(),
        newUserPassword,
        { allowExtra: isAdditionalUser || showExtraUserForm }
      );
      setNewUsername('');
      setNewUserEmail('');
      setNewUserPassword('');
      setShowExtraUserForm(false);
      setSchoolUsers((prev) => [...prev, created]);
      setSchools((prev) =>
        prev.map((s) =>
          s.id === activeSchoolId ? { ...s, userCount: (s.userCount ?? 0) + 1 } : s
        )
      );
      setStatusNotice(
        `Created ${isAdditionalUser ? 'additional ' : ''}login "${created.email}" (${created.username}) for ${schoolConfig?.schoolName || 'this school'}.`
      );
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Unable to create school user.');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleUpdateSchoolUser = async (userId: string) => {
    if (!isCompanyAdmin || !activeSchoolId) return;
    if (!editUserUsername.trim()) return;
    setErrorBanner(null);
    setSavingUserEdit(true);
    try {
      const updated = await updateSchoolUser(activeSchoolId, userId, {
        username: editUserUsername.trim(),
        email: editUserEmail.trim() || undefined,
        currentPassword: editUserCurrentPassword || undefined,
        newPassword: editUserNewPassword || undefined,
      });
      setEditingUserId(null);
      setEditUserUsername('');
      setEditUserEmail('');
      setEditUserCurrentPassword('');
      setEditUserNewPassword('');
      setSchoolUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
      setStatusNotice(`Updated credentials for "${updated.username}" (${updated.email || 'no email'}).`);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Unable to update school user credentials.');
    } finally {
      setSavingUserEdit(false);
    }
  };

  const handleSendUserReset = async (email: string) => {
    if (!isCompanyAdmin || !email) return;
    setErrorBanner(null);
    try {
      await sendSchoolUserPasswordReset(email);
      setStatusNotice(`Password reset link sent to ${email}.`);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Unable to send password reset link.');
    }
  };

  const handleDeleteSchoolUser = async (userId: string) => {
    if (!isCompanyAdmin || !activeSchoolId) return;
    setErrorBanner(null);
    try {
      await deleteSchoolUser(activeSchoolId, userId);
      setConfirmDeleteUserId(null);
      setSchoolUsers((prev) => prev.filter((u) => u.id !== userId));
      setSchools((prev) =>
        prev.map((s) =>
          s.id === activeSchoolId
            ? { ...s, userCount: Math.max(0, (s.userCount ?? 1) - 1) }
            : s
        )
      );
      setStatusNotice('School user account deleted.');
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Unable to delete school user.');
    }
  };

  const handleCreateAnnouncement = async (e: FormEvent) => {
    e.preventDefault();
    if (!isCompanyAdmin || !annTitle.trim() || !annDetail.trim()) return;
    setErrorBanner(null);
    setCreatingAnn(true);
    try {
      const defaultTag =
        annAudience === 'public'
          ? 'Installation Promotion'
          : annAudience === 'all'
          ? 'Public & School Notice'
          : 'School Notice';
      const created = await createAnnouncement({
        tag: annTag.trim() || defaultTag,
        title: annTitle.trim(),
        detail: annDetail.trim(),
        audience: annAudience,
      });
      setAnnTitle('');
      setAnnDetail('');
      setAnnAudience('schools');
      setAnnTag('School Notice');
      setAnnouncementModalOpen(false);
      setAnnouncements((prev) => [created, ...prev]);
      const scopeDesc =
        created.audience === 'public'
          ? 'Public Website (Everyone & New Visitors)'
          : created.audience === 'all'
          ? 'Public Website & Registered Schools'
          : 'Registered Schools Only (Login Required)';
      setStatusNotice(`Announcement "${created.title}" published for ${scopeDesc}.`);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Unable to publish announcement.');
    } finally {
      setCreatingAnn(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!isCompanyAdmin) return;
    setErrorBanner(null);
    try {
      await deleteAnnouncement(id);
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      setStatusNotice('Announcement deleted.');
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Unable to delete announcement.');
    }
  };

  const handleDeleteInquiry = async (id: string) => {
    if (!isCompanyAdmin) return;
    setErrorBanner(null);
    try {
      await deleteContactInquiry(id);
      setInquiries((prev) => prev.filter((i) => i.id !== id));
      setStatusNotice('Contact inquiry removed.');
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Unable to delete inquiry.');
    }
  };

  const handleSubmitSchoolSupport = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !supportMessage.trim()) return;
    setErrorBanner(null);
    setSendingSupport(true);
    try {
      await submitContactInquiry({
        firstName: schoolConfig?.schoolName || 'School Account',
        lastName: user.username,
        email: auth.currentUser?.email || 'school@bellcraft.local',
        subject: supportSubject,
        message: supportMessage.trim(),
        schoolId: schoolConfig?.id || user.schoolId || undefined,
        schoolName: schoolConfig?.schoolName || undefined,
        senderRole: user.role,
      });
      setSupportMessage('');
      setStatusNotice(
        language === 'rw'
          ? 'Ubutumwa bwanyu bwoherejwe kuri BellCraft Company. Admin azabasubiza vuba.'
          : 'Your support request has been sent to BellCraft Company.'
      );
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Unable to send support request.');
    } finally {
      setSendingSupport(false);
    }
  };

  const formattedDate = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const tabBreadcrumbLabel =
    activeTab === 'schools'
      ? 'All Schools'
      : activeTab === 'devices'
      ? 'Device Management'
      : activeTab === 'users'
      ? 'School Users'
      : activeTab === 'timetable'
      ? 'Set Schedule'
      : activeTab === 'notices'
      ? isCompanyAdmin
        ? 'Announcements & Inquiries'
        : 'Announcements & Support'
      : 'Dashboard';

  return (
    <div
      className={`${
        isDashboardFullscreen
          ? 'fixed inset-0 z-50 overflow-y-auto'
          : 'min-h-[calc(100vh-4rem)]'
      } bg-[#F8F9FA] dark:bg-[#060B19] text-slate-900 dark:text-slate-100 flex flex-col lg:flex-row transition-colors`}
    >
      {/* Left Sidebar Navigation — Shown after Login (hidden in Full Screen) */}
      {user && !isDashboardFullscreen && (
        <aside className="w-full lg:w-72 shrink-0 bg-white dark:bg-[#0B1224] border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div className="p-5">
            <div className="pb-5 mb-5 border-b border-slate-200 dark:border-slate-800 space-y-2">
              <p className="text-xs font-semibold text-blue-600 dark:text-cyan-400">
                {isCompanyAdmin ? 'Selected School' : 'Assigned School'}
              </p>

              {isCompanyAdmin && schools.length > 0 ? (
                <select
                  aria-label="Switch active school"
                  value={activeSchoolId || ''}
                  onChange={(e) => {
                    setSelectedSchoolId(e.target.value);
                    if (activeTab === 'schools') {
                      setActiveTab('dashboard');
                    }
                  }}
                  className="w-full px-3 py-2 text-sm font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#060B19] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.schoolName}
                    </option>
                  ))}
                </select>
              ) : (
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white truncate">
                  {schoolConfig?.schoolName ||
                    schools.find((s) => s.id === activeSchoolId)?.schoolName ||
                    (loading ? 'Loading School...' : 'No School Selected')}
                </h2>
              )}

              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {schoolConfig?.campusLocation || (isCompanyAdmin ? 'Select or add a school' : 'Main Campus')}
              </p>
            </div>

            <nav className="flex lg:flex-col gap-1.5 overflow-x-auto">
              {isCompanyAdmin && (
                <button
                  type="button"
                  onClick={() => setActiveTab('schools')}
                  className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeTab === 'schools'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Building2 className="w-4 h-4 shrink-0" />
                    <span>{dCopy.sidebarSchools}</span>
                  </span>
                  <span
                    className={`font-mono text-xs tabular-nums ${
                      activeTab === 'schools' ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {schools.length}
                  </span>
                </button>
              )}

              <button
                type="button"
                disabled={!activeSchoolId}
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                <span>{dCopy.sidebarDashboard}</span>
              </button>

              <button
                type="button"
                disabled={!activeSchoolId}
                onClick={() => setActiveTab('timetable')}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer ${
                  activeTab === 'timetable'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <CalendarClock className="w-4 h-4 shrink-0" />
                <span>{dCopy.sidebarTimetable}</span>
              </button>

              {isCompanyAdmin && (
                <button
                  type="button"
                  onClick={() => setActiveTab('devices')}
                  className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeTab === 'devices'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <HardDrive className="w-4 h-4 shrink-0" />
                    <span>Device Management</span>
                  </span>
                  <span
                    className={`font-mono text-xs tabular-nums ${
                      activeTab === 'devices' ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {devices.length}
                  </span>
                </button>
              )}

              {isCompanyAdmin && (
                <button
                  type="button"
                  disabled={!activeSchoolId}
                  onClick={() => setActiveTab('users')}
                  className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer ${
                    activeTab === 'users'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Users className="w-4 h-4 shrink-0" />
                    <span>{dCopy.sidebarUsers}</span>
                  </span>
                  <span
                    className={`font-mono text-xs tabular-nums ${
                      activeTab === 'users' ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {schoolUsers.length > MAX_USERS_PER_SCHOOL
                      ? `${MAX_USERS_PER_SCHOOL}+${schoolUsers.length - MAX_USERS_PER_SCHOOL}`
                      : `${schoolUsers.length}/${MAX_USERS_PER_SCHOOL}`}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveTab('notices')}
                className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'notices'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Megaphone className="w-4 h-4 shrink-0" />
                  <span>
                    {isCompanyAdmin
                      ? 'Notices & Inquiries'
                      : language === 'rw'
                      ? 'Amatangazo & Support'
                      : 'Announcements & Support'}
                  </span>
                </span>
                <span
                  className={`font-mono text-xs tabular-nums ${
                    activeTab === 'notices' ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {isCompanyAdmin ? announcements.length + inquiries.length : announcements.length}
                </span>
              </button>
            </nav>
          </div>

          <div className="hidden lg:block p-5 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div>
              <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                {user.username}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {isCompanyAdmin ? 'Company Admin' : 'School Staff Account'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigate('home')}
                className="flex-1 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                Home Page
              </button>
              <button
                type="button"
                onClick={onSignOut}
                className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                Sign Out
              </button>
            </div>
            {isCompanyAdmin ? (
              <button
                type="button"
                onClick={() => {
                  setPwdError(null);
                  setCurrentPwdInput('');
                  setNewPwdInput('');
                  setPasswordModalOpen(true);
                }}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-600 dark:text-cyan-400 border border-blue-200 dark:border-blue-900/60 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{language === 'rw' ? 'Hindura Password' : 'Change Password'}</span>
              </button>
            ) : (
              <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 pt-0.5">
                {language === 'rw'
                  ? 'Ask Admin for supporting it (guhindura password)'
                  : 'Ask Admin for supporting it (password changes)'}
              </p>
            )}
          </div>
        </aside>
      )}

      {/* Main Workspace */}
      <main
        className={`flex-1 min-w-0 p-4 sm:p-6 lg:p-8 flex flex-col ${
          activeTab === 'dashboard' || isDashboardFullscreen
            ? 'w-full max-w-none'
            : user
            ? 'max-w-6xl'
            : 'max-w-7xl mx-auto w-full'
        }`}
      >
        {/* Top Breadcrumb & Primary Action Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
              {activeTab === 'schools' || activeTab === 'devices'
                ? 'BellCraft Company'
                : schoolConfig
                ? schoolConfig.schoolName
                : 'BellCraft Company'}{' '}
              <span aria-hidden="true">/</span>{' '}
              <span className="text-slate-800 dark:text-slate-200 font-medium">
                {tabBreadcrumbLabel}
              </span>
            </p>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
              {activeTab === 'devices' && (
                <HardDrive className="w-6 h-6 text-blue-600 dark:text-cyan-400 shrink-0" />
              )}
              <span>
                {activeTab === 'schools'
                  ? 'Company Schools Management'
                  : activeTab === 'devices'
                  ? 'Device Management'
                  : activeTab === 'users'
                  ? `School User Accounts (${schoolConfig?.schoolName || 'School'})`
                  : activeTab === 'notices'
                  ? isCompanyAdmin
                    ? 'Company Announcements & Support Inbox'
                    : 'Company Announcements & Support'
                  : 'Automatic School Bell Controller'}
              </span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div
              className="inline-flex items-center gap-3 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1224] text-xs font-semibold whitespace-nowrap shrink-0"
              role="status"
              aria-live="polite"
            >
              <span
                className={`inline-flex items-center gap-1.5 ${
                  isSystemOnline
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {isSystemOnline ? (
                  <Wifi className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>
                  {isSystemOnline
                    ? language === 'rw'
                      ? 'Sisitemu: ONLINE'
                      : 'System: ONLINE'
                    : language === 'rw'
                    ? 'Sisitemu: OFFLINE'
                    : 'System: OFFLINE'}
                </span>
              </span>

              {user && activeSchoolId && (
                <>
                  <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                    ·
                  </span>
                  <span
                    title={
                      activeEsp32Status.linked && activeEsp32Status.lastSeenMs
                        ? `Last seen: ${formatDeviceDateTime(activeEsp32Status.lastSeenMs)}`
                        : undefined
                    }
                    className={`inline-flex items-center gap-1.5 ${
                      !activeEsp32Status.linked
                        ? 'text-slate-500 dark:text-slate-400'
                        : activeEsp32Status.online
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    <HardDrive className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {!activeEsp32Status.linked
                        ? 'ESP32: Not Linked'
                        : activeEsp32Status.online
                        ? 'ESP32: ONLINE'
                        : 'ESP32: OFFLINE'}
                    </span>
                  </span>
                </>
              )}
            </div>

            {activeTab === 'dashboard' && (
              <button
                type="button"
                onClick={toggleDashboardFullscreen}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1224] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isDashboardFullscreen ? (
                  <>
                    <Minimize2 className="w-4 h-4" />
                    <span>{language === 'rw' ? 'Va muri Full Screen' : 'Exit Full Screen'}</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-4 h-4" />
                    <span>{language === 'rw' ? 'Gira Full Screen' : 'Full Screen'}</span>
                  </>
                )}
              </button>
            )}

            {!user ? (
              <button
                type="button"
                onClick={() => onNavigate('login')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>{dCopy.loginToSetBtn}</span>
              </button>
            ) : activeTab === 'timetable' ? (
              <>
                <button
                  type="button"
                  onClick={handleToggleAutoRing}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    schoolConfig?.autoRingEnabled
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                      : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {schoolConfig?.autoRingEnabled ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Auto-Ring Active</span>
                    </>
                  ) : (
                    <>
                      <PauseCircle className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                      <span>Auto-Ring Paused</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={!schoolConfig || exportingPdfSchoolId === schoolConfig?.id}
                  onClick={() => void handleDownloadSchoolPdf()}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1224] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                >
                  <Download className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
                  <span>
                    {exportingPdfSchoolId === schoolConfig?.id ? 'Exporting...' : 'Download PDF'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditingItem(null);
                    setModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Bell Slot</span>
                </button>
              </>
            ) : isCompanyAdmin && activeTab !== 'schools' && !isDashboardFullscreen ? (
              <button
                type="button"
                onClick={() => setActiveTab('schools')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1224] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Building2 className="w-4 h-4" />
                <span>All Schools</span>
              </button>
            ) : null}
          </div>
        </div>

        {!isSystemOnline && (
          <div
            role="alert"
            className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/45 border border-red-200 dark:border-red-800/80 text-sm text-red-900 dark:text-red-200 flex items-start gap-3"
          >
            <WifiOff className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">
                {language === 'rw'
                  ? 'Sisitemu iri OFFLINE — Nta Internet Ihari'
                  : 'System is Currently OFFLINE — No Internet Connection'}
              </p>
              <p className="text-xs opacity-90 mt-0.5">
                {language === 'rw'
                  ? 'Gukanda Manual Bell kuri internet no guhindura ingengabihe bisubira gukora internet igarutse. ESP32 ikomeza kuvuza ibikorwa byabitswe muri EEPROM nta network.'
                  : 'Cloud commands and schedule updates will resume automatically when internet returns. Your ESP32 continues ringing saved timetable slots offline from EEPROM.'}
              </p>
            </div>
          </div>
        )}

        {isCompanyAdmin && auth.currentUser && !auth.currentUser.emailVerified && (
          <div
            role="alert"
            className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-sm text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div>
              <p className="font-semibold">
                {language === 'rw'
                  ? 'Emeza Email yawe (Email Verification Required)'
                  : 'Admin Email Verification Required'}
              </p>
              <p className="text-xs opacity-90 mt-0.5">
                {language === 'rw'
                  ? 'Realtime Database Rules zisaba ko email ya Company Admin iba yemejwe. Kanda hano wohereze link yo kwemeza email muri Gmail yawe.'
                  : 'Realtime Database rules require a verified email for the Company Admin account before writing data.'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={sendingVerification}
                onClick={async () => {
                  setErrorBanner(null);
                  setSendingVerification(true);
                  try {
                    await sendAdminVerificationEmail();
                    setStatusNotice(
                      `Verification email sent to ${auth.currentUser?.email}. Click the link in your inbox, then click Refresh Status.`
                    );
                  } catch (err) {
                    setErrorBanner(
                      err instanceof Error ? err.message : 'Unable to send verification email.'
                    );
                  } finally {
                    setSendingVerification(false);
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
              >
                {sendingVerification ? 'Sending...' : 'Send Verification Link'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (auth.currentUser) {
                    await auth.currentUser.reload();
                    await auth.currentUser.getIdToken(true);
                    await refreshWorkspace(selectedSchoolId);
                  }
                }}
                className="px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/40 cursor-pointer"
              >
                Refresh Status
              </button>
            </div>
          </div>
        )}

        {errorBanner && (
          <div
            role="alert"
            className="mb-6 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-sm text-red-800 dark:text-red-200 flex items-center justify-between gap-4"
          >
            <span>{errorBanner}</span>
            <button
              type="button"
              onClick={() => setErrorBanner(null)}
              className="text-xs font-semibold underline cursor-pointer shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {statusNotice && (
          <div className="mb-6 p-3.5 rounded-xl bg-slate-900 dark:bg-blue-950/70 border border-slate-800 dark:border-blue-800 text-white text-sm flex items-center justify-between gap-4">
            <span>{statusNotice}</span>
            <button
              type="button"
              onClick={() => setStatusNotice(null)}
              className="text-xs text-slate-300 hover:text-white cursor-pointer shrink-0"
            >
              Close
            </button>
          </div>
        )}

        {/* ADMIN TAB: ALL SCHOOLS */}
        {isCompanyAdmin && activeTab === 'schools' && (
          <div className="space-y-6">
            {/* Create New School Form */}
            <section className="bg-white dark:bg-[#0B1224] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                    Register a School
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Each school gets its own isolated schedules, active mode, and {MAX_USERS_PER_SCHOOL} standard user accounts (with optional additional users).
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-xs font-semibold text-blue-600 dark:text-cyan-400 tabular-nums">
                    {schools.length} {schools.length === 1 ? 'School' : 'Schools'} Active
                  </span>
                  <button
                    type="button"
                    onClick={handleInitializeRtdb}
                    disabled={initializingRtdb}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800/70 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 disabled:opacity-60 text-blue-700 dark:text-cyan-300 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span>
                      {initializingRtdb ? 'Syncing Realtime DB...' : 'Sync Realtime DB'}
                    </span>
                  </button>
                </div>
              </div>

              <form onSubmit={handleCreateSchool} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-5">
                  <label
                    htmlFor="new-school-name"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    School Name
                  </label>
                  <input
                    id="new-school-name"
                    type="text"
                    required
                    value={newSchoolName}
                    onChange={(e) => setNewSchoolName(e.target.value)}
                    placeholder="e.g., Kigali Technical Secondary School"
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#060B19] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-4">
                  <label
                    htmlFor="new-campus-location"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Campus Location
                  </label>
                  <input
                    id="new-campus-location"
                    type="text"
                    value={newCampusLocation}
                    onChange={(e) => setNewCampusLocation(e.target.value)}
                    placeholder="e.g., Gasabo District"
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#060B19] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-3">
                  <button
                    type="submit"
                    disabled={creatingSchool}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{creatingSchool ? 'Creating...' : 'Add School'}</span>
                  </button>
                </div>
              </form>
            </section>

            {/* Filter & School List */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Registered Schools
              </h2>
              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  disabled={schools.length === 0 || exportingAllSchoolsPdf}
                  onClick={() => void handleDownloadAllSchoolsPdf()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1224] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                  <span>
                    {exportingAllSchoolsPdf ? 'Generating PDF...' : 'Download All Schools PDF'}
                  </span>
                </button>
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={schoolSearchQuery}
                    onChange={(e) => setSchoolSearchQuery(e.target.value)}
                    placeholder="Search school or location..."
                    className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1224] text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {filteredSchools.length === 0 ? (
              <div className="bg-white dark:bg-[#0B1224] border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
                <Building2 className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                <p className="font-display text-base font-semibold text-slate-900 dark:text-white mb-1">
                  No schools match your search
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Register a new school above or clear your search filter.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filteredSchools.map((school) => {
                  const isSelected = school.id === activeSchoolId;
                  const isEditingMeta = editingSchoolMetaId === school.id;
                  const userCount = school.userCount ?? 0;
                  const scheduleCount = school.scheduleCount ?? 0;

                  return (
                    <article
                      key={school.id}
                      className={`bg-white dark:bg-[#0B1224] border rounded-2xl p-5 sm:p-6 flex flex-col justify-between transition-colors ${
                        isSelected
                          ? 'border-blue-500 dark:border-cyan-500/70'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div>
                        {isEditingMeta ? (
                          <div className="space-y-3 mb-4">
                            <input
                              type="text"
                              value={editSchoolName}
                              onChange={(e) => setEditSchoolName(e.target.value)}
                              placeholder="School name"
                              className="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#060B19] text-slate-900 dark:text-white"
                            />
                            <input
                              type="text"
                              value={editCampusLocation}
                              onChange={(e) => setEditCampusLocation(e.target.value)}
                              placeholder="Campus location"
                              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#060B19] text-slate-900 dark:text-white"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleSaveSchoolMeta(school.id)}
                                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingSchoolMetaId(null)}
                                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-3 mb-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white truncate">
                                  {school.schoolName}
                                </h3>
                                {isSelected && (
                                  <span className="text-[11px] font-semibold text-blue-600 dark:text-cyan-400 shrink-0">
                                    · Active
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                {school.campusLocation}
                              </p>
                            </div>

                            <button
                              type="button"
                              title="Edit school name or location"
                              onClick={() => {
                                setEditingSchoolMetaId(school.id);
                                setEditSchoolName(school.schoolName);
                                setEditCampusLocation(school.campusLocation);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3.5 px-3.5 rounded-xl bg-slate-50 dark:bg-[#060B19] border border-slate-100 dark:border-slate-800/80 text-xs mb-5">
                          <div>
                            <p className="text-slate-400 dark:text-slate-500">Profile</p>
                            <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                              {PROFILE_LABEL[school.activeProfile]}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-400 dark:text-slate-500">Mode</p>
                            <p
                              className={`font-semibold mt-0.5 ${
                                school.autoRingEnabled
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-red-600 dark:text-[#FF6B63]'
                              }`}
                            >
                              {school.autoRingEnabled ? 'Automatic' : 'Manual'}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-400 dark:text-slate-500">Schedules</p>
                            <p className="font-mono font-semibold text-slate-800 dark:text-slate-200 tabular-nums mt-0.5">
                              {scheduleCount}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-400 dark:text-slate-500">Users</p>
                            <p className="font-mono font-semibold text-slate-800 dark:text-slate-200 tabular-nums mt-0.5">
                              {userCount > MAX_USERS_PER_SCHOOL
                                ? `${MAX_USERS_PER_SCHOOL} + ${userCount - MAX_USERS_PER_SCHOOL} extra`
                                : `${userCount} / ${MAX_USERS_PER_SCHOOL}`}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSchoolId(school.id);
                              setActiveTab('dashboard');
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <span>Enter School</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSchoolId(school.id);
                              setActiveTab('users');
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <Users className="w-3.5 h-3.5" />
                            <span>
                              Users (
                              {userCount > MAX_USERS_PER_SCHOOL
                                ? `${MAX_USERS_PER_SCHOOL}+${userCount - MAX_USERS_PER_SCHOOL}`
                                : `${userCount}/${MAX_USERS_PER_SCHOOL}`}
                              )
                            </span>
                          </button>

                          <button
                            type="button"
                            disabled={exportingPdfSchoolId === school.id}
                            onClick={() => void handleDownloadSchoolPdf(school)}
                            title={`Download ${school.schoolName} schedules as PDF`}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#060B19] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60"
                          >
                            <Download className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                            <span>{exportingPdfSchoolId === school.id ? 'PDF...' : 'PDF'}</span>
                          </button>
                        </div>

                        {confirmDeleteSchoolId === school.id ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleDeleteSchool(school.id)}
                              className="px-2.5 py-1.5 rounded-md bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteSchoolId(null)}
                              className="px-2.5 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            title="Delete school"
                            onClick={() => setConfirmDeleteSchoolId(school.id)}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ADMIN TAB: MANAGE SCHOOL USERS (2 STANDARD + OPTIONAL ADDITIONAL USERS) */}
        {isCompanyAdmin && activeTab === 'users' && (
          <div className="space-y-6">
            <section className="bg-white dark:bg-[#0B1224] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                    {showExtraUserForm && schoolUsers.length >= MAX_USERS_PER_SCHOOL
                      ? `Add Additional User Account (#${schoolUsers.length + 1})`
                      : 'Create School User Account'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Each school includes {MAX_USERS_PER_SCHOOL} standard user accounts with isolated access to {schoolConfig?.schoolName || 'this school'}, with an option to add additional users when needed.
                  </p>
                </div>
                <span
                  className={`font-mono text-xs font-semibold px-3 py-1.5 rounded-lg border tabular-nums ${
                    schoolUsers.length > MAX_USERS_PER_SCHOOL
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                      : schoolUsers.length === MAX_USERS_PER_SCHOOL
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                      : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-cyan-400'
                  }`}
                >
                  {schoolUsers.length > MAX_USERS_PER_SCHOOL
                    ? `${schoolUsers.length} Users (${MAX_USERS_PER_SCHOOL} Standard + ${
                        schoolUsers.length - MAX_USERS_PER_SCHOOL
                      } Additional)`
                    : `${schoolUsers.length} / ${MAX_USERS_PER_SCHOOL} Standard Users`}
                </span>
              </div>

              {schoolUsers.length >= MAX_USERS_PER_SCHOOL && !showExtraUserForm ? (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
                    <p className="font-semibold">
                      {schoolUsers.length === MAX_USERS_PER_SCHOOL
                        ? `Standard ${MAX_USERS_PER_SCHOOL}-user limit reached for ${schoolConfig?.schoolName || 'this school'}.`
                        : `${schoolUsers.length} users assigned (${MAX_USERS_PER_SCHOOL} standard + ${
                            schoolUsers.length - MAX_USERS_PER_SCHOOL
                          } additional).`}
                    </p>
                    <p className="text-amber-800/90 dark:text-amber-300/90">
                      Need another staff login for this school? Click <strong>Add Additional User</strong> to assign an extra account.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorBanner(null);
                      setShowExtraUserForm(true);
                    }}
                    className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Add Additional User</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {schoolUsers.length >= MAX_USERS_PER_SCHOOL && (
                    <div className="px-3.5 py-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/70 flex items-center justify-between gap-3">
                      <p className="text-xs font-medium text-blue-800 dark:text-cyan-300">
                        Creating additional user account #{schoolUsers.length + 1} (beyond the {MAX_USERS_PER_SCHOOL} standard slots).
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setShowExtraUserForm(false);
                          setNewUsername('');
                          setNewUserEmail('');
                          setNewUserPassword('');
                        }}
                        className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  <form
                    onSubmit={handleCreateSchoolUser}
                    className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
                  >
                    <div className="md:col-span-3">
                      <label
                        htmlFor="school-user-username"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                      >
                        Staff Name / Role
                      </label>
                      <input
                        id="school-user-username"
                        type="text"
                        required
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="e.g., Prefet"
                        className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#060B19] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="md:col-span-4">
                      <label
                        htmlFor="school-user-email"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                      >
                        Login Email
                      </label>
                      <input
                        id="school-user-email"
                        type="email"
                        required
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        placeholder="prefet@school.rw"
                        className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#060B19] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label
                        htmlFor="school-user-password"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                      >
                        Assigned Password (6+ chars)
                      </label>
                      <input
                        id="school-user-password"
                        type="password"
                        required
                        minLength={6}
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        placeholder="Assign password"
                        className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#060B19] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <button
                        type="submit"
                        disabled={creatingUser}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors cursor-pointer"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>
                          {creatingUser
                            ? 'Adding...'
                            : schoolUsers.length >= MAX_USERS_PER_SCHOOL
                            ? 'Add User'
                            : 'Create'}
                        </span>
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </section>

            {/* Assigned Users Table */}
            <section className="bg-white dark:bg-[#0B1224] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Assigned User Accounts
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {schoolConfig?.schoolName}
                </span>
              </div>

              {schoolUsers.length === 0 ? (
                <div className="p-10 text-center">
                  <Users className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                  <p className="font-display text-sm font-semibold text-slate-900 dark:text-white mb-1">
                    No School Users Created Yet
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Create up to {MAX_USERS_PER_SCHOOL} standard accounts above (or add additional users later) so staff at this school can sign in.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {schoolUsers.map((acct, index) => {
                    const isEditing = editingUserId === acct.id;
                    const isAdditional = index >= MAX_USERS_PER_SCHOOL;
                    return (
                      <div
                        key={acct.id}
                        className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="font-mono text-xs text-slate-400 tabular-nums">
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            <p className="font-display text-base font-bold text-slate-900 dark:text-white truncate">
                              {acct.username}
                            </p>
                            {isAdditional && (
                              <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/70 text-blue-700 dark:text-cyan-300">
                                Additional User
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                            {acct.email
                              ? `${acct.email} · Created ${new Date(acct.createdAtMs).toLocaleDateString()}`
                              : `Legacy slot (no login email — delete & recreate with email) · ${new Date(acct.createdAtMs).toLocaleDateString()}`}
                          </p>
                        </div>

                        {isEditing ? (
                          <div className="w-full sm:w-auto sm:min-w-[440px] space-y-2.5 bg-slate-50 dark:bg-[#060B19] border border-slate-200 dark:border-slate-700 rounded-xl p-3.5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                                  Staff Name / Role
                                </label>
                                <input
                                  type="text"
                                  value={editUserUsername}
                                  onChange={(e) => setEditUserUsername(e.target.value)}
                                  placeholder="Staff name"
                                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1224] text-slate-900 dark:text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                                  Login Email
                                </label>
                                <input
                                  type="email"
                                  value={editUserEmail}
                                  onChange={(e) => setEditUserEmail(e.target.value)}
                                  placeholder="staff@school.rw"
                                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1224] text-slate-900 dark:text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                                  Current Password (if same email)
                                </label>
                                <input
                                  type="password"
                                  value={editUserCurrentPassword}
                                  onChange={(e) => setEditUserCurrentPassword(e.target.value)}
                                  placeholder="Current password"
                                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1224] text-slate-900 dark:text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                                  New Password (6+ chars, optional)
                                </label>
                                <input
                                  type="password"
                                  minLength={6}
                                  value={editUserNewPassword}
                                  onChange={(e) => setEditUserNewPassword(e.target.value)}
                                  placeholder="Leave blank to keep"
                                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1224] text-slate-900 dark:text-white"
                                />
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <button
                                type="button"
                                disabled={savingUserEdit}
                                onClick={() => setEditingUserId(null)}
                                className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={savingUserEdit}
                                onClick={() => handleUpdateSchoolUser(acct.id)}
                                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
                              >
                                {savingUserEdit ? 'Saving...' : 'Save Credentials'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingUserId(acct.id);
                                setEditUserUsername(acct.username);
                                setEditUserEmail(acct.email || '');
                                setEditUserCurrentPassword('');
                                setEditUserNewPassword('');
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>Edit Credentials</span>
                            </button>

                            {acct.email && (
                              <button
                                type="button"
                                onClick={() => handleSendUserReset(acct.email!)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-cyan-300 text-xs font-semibold cursor-pointer"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                                <span>Send Reset Link</span>
                              </button>
                            )}

                            {confirmDeleteUserId === acct.id ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSchoolUser(acct.id)}
                                  className="px-2.5 py-1.5 rounded-md bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteUserId(null)}
                                  className="px-2.5 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                title="Delete school user"
                                onClick={() => setConfirmDeleteUserId(acct.id)}
                                className="p-2 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 0: DASHBOARD (Current Activity, Next Activity Pending, Manual Bell Power Card + Mode Ball) */}
        {activeTab === 'dashboard' && (
          <div className="flex-1 flex flex-col gap-6">
            {user && !isCompanyAdmin && !loading && !schoolConfig && (
              <section className="bg-white dark:bg-[#0B1224] border border-amber-200 dark:border-amber-800/70 rounded-2xl p-5 sm:p-6">
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white mb-1">
                  School Assignment Required
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  No school is currently assigned to your account. Contact BellCraft Company to complete your school installation and account setup.
                </p>
              </section>
            )}

            {user && announcements.length > 0 && (
              <div className="px-5 py-3.5 rounded-xl bg-blue-50/90 dark:bg-blue-950/35 border border-blue-200 dark:border-blue-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <Megaphone className="w-4 h-4 text-blue-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {announcements[0].title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                      {announcements[0].detail}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('notices')}
                  className="text-xs font-semibold text-blue-700 dark:text-cyan-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-center"
                >
                  {language === 'rw' ? 'Reba byose & Sabe ubufasha' : 'View All & Support'}
                </button>
              </div>
            )}

            {/* Master Clock + Mode Indicator Ball Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-5 py-4 bg-white dark:bg-[#0B1224] border border-slate-200 dark:border-slate-800 rounded-2xl">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-cyan-400">
                    {language === 'rw' ? 'Isaha Iriho Ubu (Current Time)' : 'Current Time'}
                  </p>
                  <p className="font-mono text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tabular-nums tracking-tight leading-none mt-1">
                    <LiveClockText offsetMs={clockOffsetMs} />
                  </p>
                </div>
                <div className="h-10 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" aria-hidden="true" />
                <div className="space-y-0.5 text-xs">
                  <p className="text-slate-700 dark:text-slate-200 font-semibold">
                    {formattedDate}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span>
                      Profile:{' '}
                      <strong className="text-slate-800 dark:text-slate-200">
                        {PROFILE_LABEL[activeProfile]}
                      </strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={`font-semibold ${
                        isSystemOnline
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {isSystemOnline ? 'Online' : 'Offline'}
                    </span>
                    {user && activeEsp32Status.linked && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span
                          className={`font-semibold ${
                            activeEsp32Status.online
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          ESP32 {activeEsp32Status.online ? 'Online' : 'Offline'}
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Mode Indicator Ball + Interactive Switch (Automatic vs Manual Selected) */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-2 text-xs font-semibold whitespace-nowrap">
                  <span
                    aria-hidden="true"
                    className={`w-3 h-3 rounded-full shrink-0 ring-4 transition-colors ${
                      isAutomaticMode
                        ? 'bg-emerald-500 ring-emerald-500/20'
                        : 'bg-[#FF453A] ring-[#FF453A]/20'
                    }`}
                  />
                  <span
                    className={
                      isAutomaticMode
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-red-600 dark:text-[#FF6B63]'
                    }
                  >
                    {isAutomaticMode ? dCopy.modeAutomatic : dCopy.modeManualSelected}
                  </span>
                </div>

                <div
                  role="group"
                  aria-label="Bell Operation Mode"
                  className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#060B19] border border-slate-200 dark:border-slate-800"
                >
                  <button
                    type="button"
                    onClick={() => handleSetRingMode(true)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      isAutomaticMode
                        ? 'bg-white dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {dCopy.automaticOption}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetRingMode(false)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      !isAutomaticMode
                        ? 'bg-white dark:bg-red-950 text-red-700 dark:text-red-300 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {dCopy.manualOption}
                  </button>
                </div>
              </div>
            </div>

            {/* 3 Primary Dashboard Cards */}
            <section className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
              {/* 1. Current Activity (Based on Current Time) */}
              <div className="bg-white dark:bg-[#0B1224] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between min-w-0">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      01 · {dCopy.currentLabel}
                    </p>
                    <span
                      className={`text-xs font-semibold whitespace-nowrap ${
                        currentActivity && isRingingTitle
                          ? 'text-blue-600 dark:text-cyan-400'
                          : currentActivity
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {currentActivity
                        ? isRingingTitle
                          ? dCopy.ringingNow
                          : dCopy.inProgress
                        : dCopy.noActivityBadge}
                    </span>
                  </div>

                  {currentActivity ? (
                    <div>
                      <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white leading-snug">
                        {currentActivity.title}
                      </h2>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="px-3.5 py-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/70">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                            {dCopy.startTimeLabel}
                          </p>
                          <p className="font-mono text-3xl xl:text-4xl font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums tracking-tight leading-none mt-1.5">
                            {currentActivity.time}
                          </p>
                        </div>
                        <div className="px-3.5 py-3 rounded-xl bg-slate-50 dark:bg-[#060B19] border border-slate-200 dark:border-slate-700">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            {dCopy.endTimeLabel}
                          </p>
                          <p className="font-mono text-3xl xl:text-4xl font-extrabold text-slate-900 dark:text-white tabular-nums tracking-tight leading-none mt-1.5">
                            {currentActivity.endTime || currentActivity.time}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2.5 truncate">
                        {currentActivity.profile === 'Exams'
                          ? `${currentActivity.examDate ? `${currentActivity.examDate} · ` : ''}Teacher: ${currentActivity.teacherName || '—'}`
                          : `${PROFILE_LABEL[currentActivity.profile]} · ${currentActivity.days.join(', ')}`}
                      </p>
                    </div>
                  ) : (
                    <div className="pt-1">
                      <h2 className="font-display text-xl font-bold text-slate-700 dark:text-slate-200 leading-snug">
                        {dCopy.noCurrentActivity}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                        {dCopy.noCurrentActivityAt}{' '}
                        <span className="font-mono font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                          {currentHHMM}
                        </span>{' '}
                        ({PROFILE_LABEL[activeProfile]})
                      </p>
                      {isRingingTitle && (
                        <p className="text-xs font-semibold text-blue-600 dark:text-cyan-400 mt-2 font-mono tabular-nums">
                          {dCopy.ringingNow}: {isRingingTitle} (<LiveClockText offsetMs={clockOffsetMs} />)
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400 truncate">
                  {latestRingLog ? (
                    <>
                      {dCopy.lastProcessed}:{' '}
                      <span className="text-slate-700 dark:text-slate-200 font-medium">
                        {latestRingLog.title}
                      </span>{' '}
                      <span className="font-mono tabular-nums">
                        (
                        {new Date(latestRingLog.triggeredAtMs).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        )
                      </span>
                    </>
                  ) : (
                    <span>{PROFILE_LABEL[activeProfile]} Schedule · {currentHHMM}</span>
                  )}
                </div>
              </div>

              {/* 2. Next Activity (Based on Current Time) */}
              <div className="bg-white dark:bg-[#0B1224] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between min-w-0">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      02 · {dCopy.nextLabel}
                    </p>
                    <span
                      className={`text-xs font-semibold whitespace-nowrap ${
                        nextScheduledBell
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {nextScheduledBell ? dCopy.pending : dCopy.noActivityBadge}
                    </span>
                  </div>

                  {nextScheduledBell ? (
                    <div>
                      <div className="flex items-baseline justify-between gap-3">
                        <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white leading-snug truncate">
                          {nextScheduledBell.title}
                        </h2>
                        <span className="font-mono text-lg font-bold text-blue-600 dark:text-cyan-400 tabular-nums shrink-0">
                          <LiveCountdownText
                            offsetMs={clockOffsetMs}
                            targetHHMM={nextScheduledBell.time}
                          />
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="px-3.5 py-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/35 border border-blue-200 dark:border-blue-800/70">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-cyan-300">
                            {dCopy.startTimeLabel}
                          </p>
                          <p className="font-mono text-3xl xl:text-4xl font-extrabold text-blue-600 dark:text-cyan-400 tabular-nums tracking-tight leading-none mt-1.5">
                            {nextScheduledBell.time}
                          </p>
                        </div>
                        <div className="px-3.5 py-3 rounded-xl bg-slate-50 dark:bg-[#060B19] border border-slate-200 dark:border-slate-700">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            {dCopy.endTimeLabel}
                          </p>
                          <p className="font-mono text-3xl xl:text-4xl font-extrabold text-slate-900 dark:text-white tabular-nums tracking-tight leading-none mt-1.5">
                            {nextScheduledBell.endTime || nextScheduledBell.time}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2.5 truncate">
                        {nextScheduledBell.profile === 'Exams'
                          ? `${nextScheduledBell.examDate ? `${nextScheduledBell.examDate} · ` : ''}Teacher: ${nextScheduledBell.teacherName || '—'}`
                          : `${PROFILE_LABEL[nextScheduledBell.profile]} · ${nextScheduledBell.days.join(', ')}`}
                      </p>
                    </div>
                  ) : (
                    <div className="pt-1">
                      <h2 className="font-display text-xl font-bold text-slate-700 dark:text-slate-200 leading-snug">
                        {dCopy.noNextActivity}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                        {dCopy.noNextActivityAt}{' '}
                        <span className="font-mono font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                          {currentHHMM}
                        </span>{' '}
                        ({PROFILE_LABEL[activeProfile]})
                      </p>
                    </div>
                  )}
                </div>

                <p className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400 truncate">
                  {isAutomaticMode ? dCopy.modeAutoHint : dCopy.modeManualHint}
                </p>
              </div>

              {/* 3. Big Round Power-Style Manual Bell Button Card */}
              <div className="bg-[#060E09] text-white border border-slate-300 dark:border-emerald-900/50 rounded-2xl p-6 flex flex-col justify-between min-h-[290px] min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Bell
                      className={`w-6 h-6 shrink-0 ${
                        isRingingTitle ? 'text-[#22C55E] animate-pulse' : 'text-[#22C55E]'
                      }`}
                    />
                    <span
                      aria-hidden="true"
                      className={`w-3 h-3 rounded-full shrink-0 ring-4 ${
                        isAutomaticMode
                          ? 'bg-[#22C55E] ring-[#22C55E]/25'
                          : 'bg-[#FF453A] ring-[#FF453A]/25'
                      }`}
                    />
                  </div>

                  <div className="text-right">
                    <p className="font-display text-xs font-extrabold tracking-widest text-[#22C55E]">
                      {dCopy.manualTopTitle}
                    </p>
                    <p className="text-[11px] font-semibold tracking-wider text-emerald-500/75 mt-0.5">
                      {dCopy.manualTopSubtitle}
                    </p>
                  </div>
                </div>

                {/* Center Big Round Power / Bell Button (Locked when Automatic mode is active) */}
                <div className="my-5 flex items-center justify-center">
                  <button
                    type="button"
                    disabled={(isAutomaticMode && !isRingingTitle) || verifyingCommand}
                    aria-label={
                      verifyingCommand
                        ? 'Checking ESP32 status...'
                        : isRingingTitle
                        ? dCopy.stopManualBell
                        : dCopy.startManualBell
                    }
                    title={
                      isAutomaticMode && !isRingingTitle
                        ? dCopy.manualLockedHint
                        : isRingingTitle
                        ? dCopy.stopManualBell
                        : dCopy.startManualBell
                    }
                    onClick={() => {
                      if (isRingingTitle) {
                        handleStopRinging();
                      } else if (!isAutomaticMode && !verifyingCommand) {
                        void triggerManualRing('Manual School Bell', 'brass-bell');
                      }
                    }}
                    className={`w-28 h-28 rounded-full flex items-center justify-center transition-all duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40 ${
                      isRingingTitle
                        ? 'bg-[#22C55E] shadow-[0_0_45px_rgba(34,197,94,0.55)] hover:scale-105 active:scale-95 cursor-pointer'
                        : verifyingCommand
                        ? 'bg-amber-500/80 shadow-[0_0_35px_rgba(245,158,11,0.45)] animate-pulse cursor-wait'
                        : isAutomaticMode
                        ? 'bg-[#FF453A]/25 border border-[#FF453A]/35 opacity-50 cursor-not-allowed'
                        : (schoolConfig?.hardware?.config?.enabled ?? true) && !activeEsp32Status.online
                        ? 'bg-amber-500/35 border border-amber-400/50 hover:bg-amber-500/50 cursor-pointer'
                        : 'bg-[#FF453A] hover:bg-[#FF584F] shadow-[0_0_45px_rgba(255,69,58,0.48)] hover:scale-105 active:scale-95 cursor-pointer'
                    }`}
                  >
                    {isRingingTitle ? (
                      <Square className="w-8 h-8 text-slate-950 fill-slate-950" />
                    ) : (
                      <Power
                        className={`w-10 h-10 stroke-[2.4] ${
                          isAutomaticMode ? 'text-slate-300/70' : 'text-slate-950'
                        }`}
                      />
                    )}
                  </button>
                </div>

                <div className="space-y-3 text-center">
                  <div>
                    <button
                      type="button"
                      disabled={(isAutomaticMode && !isRingingTitle) || verifyingCommand}
                      onClick={() => {
                        if (isRingingTitle) {
                          handleStopRinging();
                        } else if (!isAutomaticMode && !verifyingCommand) {
                          void triggerManualRing('Manual School Bell', 'brass-bell');
                        }
                      }}
                      className={`font-display text-base font-extrabold tracking-widest transition-colors ${
                        isAutomaticMode && !isRingingTitle
                          ? 'text-slate-500 cursor-not-allowed'
                          : verifyingCommand
                          ? 'text-amber-400 cursor-wait'
                          : (schoolConfig?.hardware?.config?.enabled ?? true) && !activeEsp32Status.online
                          ? 'text-amber-400 hover:text-amber-300 cursor-pointer'
                          : 'text-[#22C55E] hover:text-emerald-300 cursor-pointer'
                      }`}
                    >
                      {verifyingCommand
                        ? 'CHECKING ESP32...'
                        : isRingingTitle
                        ? dCopy.stopManualBell
                        : dCopy.startManualBell}
                    </button>
                    <p
                      className={`text-[11px] font-medium mt-1 ${
                        !isAutomaticMode &&
                        (!isSystemOnline ||
                          ((schoolConfig?.hardware?.config?.enabled ?? true) &&
                            !activeEsp32Status.online))
                          ? 'text-amber-400'
                          : 'text-emerald-400/75'
                      }`}
                    >
                      {isAutomaticMode
                        ? dCopy.manualLockedHint
                        : !isSystemOnline
                        ? 'System OFFLINE — Check internet connection'
                        : (schoolConfig?.hardware?.config?.enabled ?? true) &&
                          !activeEsp32Status.online
                        ? activeEsp32Status.linked
                          ? 'ESP32 OFFLINE — Power on ESP32 before ringing'
                          : 'No ESP32 linked/online — Connect ESP32 first'
                        : dCopy.modeManualSelected}
                    </p>
                    {user && activeSchoolId && activeSchoolLinkedDevices.length > 0 && (
                      <div className="mt-2">
                        {isCompanyAdmin ? (
                          <button
                            type="button"
                            onClick={() => setActiveTab('devices')}
                            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300/90 hover:text-white cursor-pointer"
                          >
                            <HardDrive className="w-3 h-3" />
                            <span>ESP32 Linked: {activeSchoolLinkedDevices[0].serialNumber}</span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-300/90">
                            <HardDrive className="w-3 h-3" />
                            <span>ESP32 Linked: {activeSchoolLinkedDevices[0].serialNumber}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ADMIN TAB: ESP32 DEVICE MANAGEMENT */}
        {isCompanyAdmin && activeTab === 'devices' && (
          <div className="space-y-5">
            {/* Subtitle, Registered Schools Pill & Action Buttons */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 -mt-3">
              <div className="space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Manage and assign ESP32 devices to school accounts
                </p>
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/80 text-xs font-semibold text-blue-700 dark:text-cyan-300">
                  <Users className="w-3.5 h-3.5" />
                  <span>Registered schools detected: {schools.length}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => void refreshDevices()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1224] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFirmwareSchoolId((prev) => prev || activeSchoolId || schools[0]?.id || '');
                    setFirmwareModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1224] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Code2 className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                  <span>ESP32 Firmware</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewDeviceSerial('');
                    setNewDeviceChipId('');
                    setNewDeviceRelayPin(2);
                    setNewDeviceSchoolId('');
                    setAddDeviceModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add ESP32 Board</span>
                </button>
              </div>
            </div>

            {/* Filter Tabs: All Devices (X) | Unassigned (Y) */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setDeviceFilter('all')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  deviceFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-[#0B1224] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                All Devices ({devices.length})
              </button>
              <button
                type="button"
                onClick={() => setDeviceFilter('unassigned')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  deviceFilter === 'unassigned'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-[#0B1224] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                Unassigned ({unassignedDevicesCount})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={deviceSearchQuery}
                onChange={(e) => setDeviceSearchQuery(e.target.value)}
                placeholder="Search by serial, chip ID, school name, or email..."
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1224] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* ESP32 Device Cards */}
            {filteredDevices.length === 0 ? (
              <div className="bg-white dark:bg-[#0B1224] border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-3">
                <HardDrive className="w-9 h-9 text-slate-400 mx-auto" />
                <div>
                  <p className="font-display text-base font-bold text-slate-900 dark:text-white">
                    {devices.length === 0
                      ? 'No ESP32 Boards Connected Yet'
                      : 'No ESP32 Devices Match Filter'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                    {devices.length === 0
                      ? 'Click Add ESP32 Board above to enter your ESP32 Serial Number, Chip ID, and School to connect it directly in the database.'
                      : 'Try clearing your search or switching between All Devices and Unassigned.'}
                  </p>
                </div>
                {devices.length === 0 && (
                  <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setNewDeviceSerial('');
                        setNewDeviceChipId('');
                        setNewDeviceRelayPin(2);
                        setNewDeviceSchoolId('');
                        setAddDeviceModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add ESP32 Board</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3.5">
                {filteredDevices.map((device) => {
                  const isLinked = device.status === 'linked' && Boolean(device.schoolId);
                  const linkedSchool = device.schoolId
                    ? schools.find((s) => s.id === device.schoolId)
                    : undefined;
                  const linkedTarget =
                    device.schoolEmail || linkedSchool?.primaryEmail || linkedSchool?.campusLocation || '';

                  return (
                    <article
                      key={device.id}
                      className={`rounded-2xl border p-5 transition-colors ${
                        isLinked
                          ? 'bg-white dark:bg-[#0B1224] border-slate-200 dark:border-slate-800'
                          : 'bg-amber-50/40 dark:bg-amber-950/15 border-amber-300 dark:border-amber-700/70'
                      }`}
                    >
                      <div
                        className={`grid grid-cols-1 sm:grid-cols-2 ${
                          isLinked ? 'lg:grid-cols-6' : 'lg:grid-cols-5'
                        } gap-4 items-start`}
                      >
                        {/* 1. Serial Number (+ Chip sublabel & Assign button when unassigned) */}
                        <div className="min-w-0">
                          <p className="text-xs text-slate-500 dark:text-slate-400">Serial Number</p>
                          <p className="font-mono text-base font-bold text-slate-900 dark:text-white mt-0.5 truncate">
                            {device.serialNumber}
                          </p>
                          {!isLinked && (
                            <>
                              <p className="font-mono text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                Chip: {device.chipId}
                              </p>
                              {device.requestedSchoolName && (
                                <p className="text-[11px] font-medium text-amber-700 dark:text-amber-300 mt-0.5 truncate">
                                  Firmware School: {device.requestedSchoolName}
                                </p>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setAssigningDevice(device);
                                  setAssignSchoolIdInput(schools[0]?.id || '');
                                }}
                                className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-100/90 dark:bg-amber-900/40 hover:bg-amber-200/80 dark:hover:bg-amber-800/50 border border-amber-300/80 dark:border-amber-700/60 text-amber-800 dark:text-amber-200 text-xs font-semibold transition-colors cursor-pointer"
                              >
                                <Link2 className="w-3.5 h-3.5" />
                                <span>Assign to School</span>
                              </button>
                            </>
                          )}
                        </div>

                        {/* 2. Chip ID (shown as dedicated column when Linked, matching reference layout) */}
                        {isLinked && (
                          <div className="min-w-0">
                            <p className="text-xs text-slate-500 dark:text-slate-400">Chip ID</p>
                            <p className="font-mono text-xs font-medium text-slate-800 dark:text-slate-200 mt-1 truncate">
                              {device.chipId}
                            </p>
                          </div>
                        )}

                        {/* 3. Status */}
                        <div className="min-w-0">
                          <p className="text-xs text-slate-500 dark:text-slate-400">Status</p>
                          {isLinked ? (
                            <>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <span
                                  className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                                    isSystemOnline && isEsp32DeviceOnline(device.lastSeenMs, statusClockMs)
                                      ? 'text-emerald-700 dark:text-emerald-400'
                                      : 'text-red-600 dark:text-red-400'
                                  }`}
                                >
                                  <span
                                    className={`w-2 h-2 rounded-full ${
                                      isSystemOnline && isEsp32DeviceOnline(device.lastSeenMs, statusClockMs)
                                        ? 'bg-emerald-500'
                                        : 'bg-red-500'
                                    }`}
                                  />
                                  <span>
                                    {isSystemOnline && isEsp32DeviceOnline(device.lastSeenMs, statusClockMs)
                                      ? 'Online'
                                      : 'Offline'}
                                  </span>
                                </span>
                                <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                                  ·
                                </span>
                                <span className="text-xs font-semibold text-blue-700 dark:text-cyan-300">
                                  Linked
                                </span>
                              </div>
                              <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 tabular-nums">
                                Last push:{' '}
                                {device.lastPushMs
                                  ? formatDeviceDateTime(device.lastPushMs)
                                  : 'Not pushed yet'}
                              </p>
                              {typeof device.syncedActivityCount === 'number' && (
                                <p className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
                                  ESP32 Synced: {device.syncedActivityCount}{' '}
                                  {device.syncedActivityCount === 1 ? 'activity' : 'activities'}
                                  {device.nvsSaved === true
                                    ? ' · EEPROM OK'
                                    : device.nvsSaved === false
                                    ? ' · EEPROM Warning'
                                    : ''}
                                  {device.lastScheduleSyncMs
                                    ? ` · ${formatDeviceDateTime(device.lastScheduleSyncMs)}`
                                    : ''}
                                </p>
                              )}
                              {device.espClockStamp && (
                                <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                                  ESP Clock: {device.espClockStamp}
                                </p>
                              )}
                            </>
                          ) : (
                            <span className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100/80 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-xs font-semibold text-amber-800 dark:text-amber-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              <span>Awaiting Assignment</span>
                            </span>
                          )}
                        </div>

                        {/* 4. First Seen */}
                        <div className="min-w-0">
                          <p className="text-xs text-slate-500 dark:text-slate-400">First Seen</p>
                          <p className="font-mono text-xs font-medium text-slate-800 dark:text-slate-200 mt-1 tabular-nums">
                            {isLinked
                              ? formatDeviceDate(device.firstSeenMs)
                              : formatDeviceDateTime(device.firstSeenMs)}
                          </p>
                        </div>

                        {/* 5. Last Seen */}
                        <div className="min-w-0">
                          <p className="text-xs text-slate-500 dark:text-slate-400">Last Seen</p>
                          <p className="font-mono text-xs font-medium text-slate-800 dark:text-slate-200 mt-1 tabular-nums">
                            {device.lastSeenMs ? formatDeviceDateTime(device.lastSeenMs) : 'Never'}
                          </p>
                        </div>

                        {/* 6. Linked School & Actions */}
                        <div className="min-w-0 flex flex-col justify-between">
                          <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Linked School
                            </p>
                            {isLinked ? (
                              <div className="mt-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 break-words">
                                <p>
                                  {device.schoolName || linkedSchool?.schoolName || 'Assigned School'}{' '}
                                  ---&gt;
                                </p>
                                {linkedTarget && (
                                  <p className="font-medium break-all">{linkedTarget}</p>
                                )}
                              </div>
                            ) : (
                              <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span>Not yet assigned</span>
                              </p>
                            )}
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-1.5">
                            {isLinked && (
                              <>
                                <button
                                  type="button"
                                  title="Send a 5-second test bell ring to this ESP32"
                                  onClick={() => handleTestDeviceRing(device)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-cyan-300 text-[11px] font-semibold cursor-pointer"
                                >
                                  <Play className="w-3 h-3" />
                                  <span>Ring Test</span>
                                </button>
                                <button
                                  type="button"
                                  title="Unassign ESP32 from school"
                                  onClick={() => handleUnassignDevice(device)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-semibold cursor-pointer"
                                >
                                  <Unlink className="w-3 h-3" />
                                  <span>Unassign</span>
                                </button>
                              </>
                            )}
                            {confirmDeleteDeviceId === device.id ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDevice(device)}
                                  className="px-2 py-1 rounded-md bg-red-600 hover:bg-red-500 text-white text-[11px] font-semibold cursor-pointer"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteDeviceId(null)}
                                  className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-semibold cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                title="Delete ESP32 device"
                                onClick={() => setConfirmDeleteDeviceId(device.id)}
                                className="p-1.5 rounded-md text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {isLinked && device.syncedActivitiesSummary && (
                        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0">
                            Activities in ESP32:
                          </span>
                          <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300 break-words">
                            {device.syncedActivitiesSummary}
                          </span>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB: COMPANY ANNOUNCEMENTS & SCHOOL SUPPORT */}
        {user && activeTab === 'notices' && (
          <div className="space-y-6">
            {isCompanyAdmin ? (
              <>
                <section className="bg-white dark:bg-[#0B1224] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <Megaphone className="w-4 h-4 text-blue-600 dark:text-cyan-400 shrink-0" />
                        <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                          Company Announcements
                        </h2>
                        <span className="font-mono text-xs text-blue-600 dark:text-cyan-400 tabular-nums">
                          {announcements.length}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Choose whether each announcement goes to Registered Schools Only (after login) or the Public Website for everyone &amp; new visitors (e.g., Installation Promotions).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAnnouncementModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-auto"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Publish Announcement</span>
                    </button>
                  </div>

                  {announcements.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                      <Megaphone className="w-7 h-7 text-slate-400 mx-auto mb-2" />
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        No announcements published yet.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {announcements.map((item) => {
                        const audienceBadge =
                          item.audience === 'public'
                            ? {
                                label: 'Public Website · Everyone & New Visitors',
                                classes:
                                  'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300',
                              }
                            : item.audience === 'all'
                            ? {
                                label: 'Public Website + Registered Schools',
                                classes:
                                  'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300',
                              }
                            : {
                                label: 'Registered Schools Only (Login Required)',
                                classes:
                                  'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-cyan-300',
                              };
                        return (
                          <div
                            key={item.id}
                            className="p-4 rounded-xl bg-slate-50 dark:bg-[#060B19] border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span
                                  className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold ${audienceBadge.classes}`}
                                >
                                  {audienceBadge.label}
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                                  {item.tag || 'Notice'}
                                </span>
                                <span className="font-mono text-[11px] text-slate-400">
                                  {new Date(item.createdAtMs).toLocaleString()}
                                </span>
                              </div>
                              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                                {item.title}
                              </h3>
                              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-line">
                                {item.detail}
                              </p>
                            </div>
                            <button
                              type="button"
                              title="Delete announcement"
                              onClick={() => handleDeleteAnnouncement(item.id)}
                              className="p-2 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 cursor-pointer shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Contact Page Inquiries & Registered School Support Requests (Admin Only) */}
                <section className="bg-white dark:bg-[#0B1224] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
                        <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                          Contact Us &amp; School Support Inquiries (Admin Only)
                        </h2>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Private inbox visible strictly to Company Admin — messages from the public Contact page and school support requests.
                      </p>
                    </div>
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                      {inquiries.length} Messages
                    </span>
                  </div>

                  {inquiries.length === 0 ? (
                    <div className="p-10 text-center">
                      <Mail className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        No contact inquiries or school support requests submitted yet.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {inquiries.map((inq) => (
                        <div
                          key={inq.id}
                          className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {inq.schoolName ? (
                                <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-[11px] font-semibold text-blue-700 dark:text-cyan-300">
                                  School Support · {inq.schoolName}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                                  Public Contact Page
                                </span>
                              )}
                              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                                {inq.subject}
                              </h3>
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                · {inq.firstName} {inq.lastName} ({inq.email})
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                              {inq.message}
                            </p>
                            <p className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
                              {new Date(inq.createdAtMs).toLocaleString()}
                            </p>
                          </div>
                          <button
                            type="button"
                            title="Delete inquiry"
                            onClick={() => handleDeleteInquiry(inq.id)}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 cursor-pointer shrink-0 self-start"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            ) : (
              <>
                {/* Registered School View: School Bell Announcements (Login Required) */}
                <section className="bg-white dark:bg-[#0B1224] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                          {language === 'rw'
                            ? 'Amatangazo y’Inzogera ku Bigo Byiyandikishije (School Bell Announcements)'
                            : 'School Bell Announcements'}
                        </h2>
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-[11px] font-semibold text-blue-700 dark:text-cyan-300">
                          {language === 'rw' ? 'Ibigo Byiyandikishije Gusa' : 'Registered Schools Only'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {language === 'rw'
                          ? 'Reba amatangazo yihariye atangwa na BellCraft Company ku bigo byamaze kwiyandikisha no kwinjira muri sisitemu.'
                          : 'Private maintenance advisories, manual-mode notices, and updates sent by BellCraft Admin strictly to registered schools.'}
                      </p>
                    </div>
                    <span className="font-mono text-xs text-blue-600 dark:text-cyan-400 tabular-nums shrink-0">
                      {announcements.length}
                    </span>
                  </div>

                  {announcements.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 py-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                      {language === 'rw'
                        ? 'Nta matangazo mashya agenewe ibigo byiyandikishije ahari ubu.'
                        : 'No registered-school announcements from BellCraft Admin at this time.'}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {announcements.map((item) => (
                        <div
                          key={item.id}
                          className="p-4 rounded-xl bg-slate-50 dark:bg-[#060B19] border border-slate-200 dark:border-slate-800"
                        >
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-[11px] font-semibold text-blue-700 dark:text-cyan-300">
                              {item.tag || 'School Notice'}
                            </span>
                            <span className="font-mono text-[11px] text-slate-400">
                              {new Date(item.createdAtMs).toLocaleString()}
                            </span>
                          </div>
                          <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                            {item.title}
                          </h3>
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-line">
                            {item.detail}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* School View: Submit Support Request to Company */}
                <section className="bg-white dark:bg-[#0B1224] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6">
                  <div className="mb-4">
                    <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                      {language === 'rw'
                        ? 'Saba Ubufasha kuri Company (Support Request)'
                        : 'Request Support from BellCraft Company'}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {language === 'rw'
                        ? 'Ohereza ubutumwa cyangwa ikibazo cya tekiniki kugira ngo Company Admin abashe kubafasha.'
                        : 'Send an issue, password support inquiry, or technical request directly to BellCraft Company Admin.'}
                    </p>
                  </div>

                  <form onSubmit={handleSubmitSchoolSupport} className="space-y-3">
                    <div>
                      <label
                        htmlFor="school-support-subject"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                      >
                        {language === 'rw' ? 'Ubwoko bw’ubufasha' : 'Support Topic'}
                      </label>
                      <select
                        id="school-support-subject"
                        value={supportSubject}
                        onChange={(e) => setSupportSubject(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#060B19] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="System / Technical Support">
                          System / Technical Support
                        </option>
                        <option value="Password / Account Support">
                          Password / Account Support
                        </option>
                        <option value="Timetable & Bell Schedule Help">
                          Timetable & Bell Schedule Help
                        </option>
                        <option value="Maintenance / Manual Mode Question">
                          Maintenance / Manual Mode Question
                        </option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="school-support-message"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                      >
                        {language === 'rw' ? 'Ubutumwa bwanyu' : 'Describe how Company can support you'}
                      </label>
                      <textarea
                        id="school-support-message"
                        rows={4}
                        required
                        value={supportMessage}
                        onChange={(e) => setSupportMessage(e.target.value)}
                        placeholder={
                          language === 'rw'
                            ? 'Sobanura ikibazo cyangwa ubufasha mukeneye...'
                            : 'Explain the issue or support your school needs...'
                        }
                        className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#060B19] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={sendingSupport}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors cursor-pointer"
                    >
                      <Mail className="w-4 h-4" />
                      <span>
                        {sendingSupport
                          ? language === 'rw'
                            ? 'Birimo koherezwa...'
                            : 'Sending...'
                          : language === 'rw'
                          ? 'Ohereza kuri Company'
                          : 'Send Support Request'}
                      </span>
                    </button>
                  </form>
                </section>
              </>
            )}
          </div>
        )}

        {/* TAB 1: TIMETABLE */}
        {activeTab === 'timetable' && (
          <section className="bg-white dark:bg-[#0B1224] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Active Mode:
                </span>
                <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#060B19] rounded-lg">
                  {(['Studying', 'Exams'] as ScheduleProfile[]).map((prof) => (
                    <button
                      key={prof}
                      type="button"
                      onClick={() => handleSwitchActiveProfile(prof)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        activeProfile === prof
                          ? 'bg-white dark:bg-blue-600 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {PROFILE_LABEL[prof]}
                    </button>
                  ))}
                </div>
                {(() => {
                  const linkedEsp = devices.find(
                    (d) =>
                      d.status === 'linked' &&
                      (d.schoolId === schoolConfig?.id ||
                        (d.schoolName &&
                          schoolConfig?.schoolName &&
                          toSchoolBridgeKey(d.schoolName) ===
                            toSchoolBridgeKey(schoolConfig.schoolName)))
                  );
                  if (!linkedEsp) return null;
                  return (
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      {typeof linkedEsp.syncedActivityCount === 'number'
                        ? `ESP32 (${linkedEsp.serialNumber}): ${linkedEsp.syncedActivityCount} activities synced`
                        : `ESP32 (${linkedEsp.serialNumber}) linked`}
                    </span>
                  );
                })()}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search activity, exam, or teacher..."
                  className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#060B19] text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Online + Offline Pre-Flight Verification Strip */}
            {schoolConfig && (
              <div className="px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-blue-50/40 dark:bg-blue-950/20 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {(() => {
                  const linkedEsp = devices.find(
                    (d) =>
                      d.status === 'linked' &&
                      (d.schoolId === schoolConfig.id ||
                        (d.schoolName &&
                          toSchoolBridgeKey(d.schoolName) ===
                            toSchoolBridgeKey(schoolConfig.schoolName)))
                  );
                  const expectedTzMin = -new Date().getTimezoneOffset();
                  const espOnlineRecent =
                    isSystemOnline && isEsp32DeviceOnline(linkedEsp?.lastSeenMs, statusClockMs);
                  const countMatches =
                    typeof linkedEsp?.syncedActivityCount === 'number' &&
                    linkedEsp.syncedActivityCount === schedules.length;
                  const syncFresh =
                    !lastDbSyncState ||
                    (typeof linkedEsp?.lastScheduleSyncMs === 'number' &&
                      linkedEsp.lastScheduleSyncMs >= lastDbSyncState.atMs - 3000);
                  const eepromVerified =
                    Boolean(linkedEsp) &&
                    countMatches &&
                    syncFresh &&
                    linkedEsp?.nvsSaved !== false;
                  const tzMatches =
                    linkedEsp?.espTimezoneOffsetMin === undefined ||
                    linkedEsp?.espTimezoneOffsetMin === null ||
                    linkedEsp.espTimezoneOffsetMin === expectedTzMin;

                  return (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 flex-1 text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              lastDbSyncState?.ok !== false ? 'bg-emerald-500' : 'bg-red-500'
                            }`}
                          />
                          <span className="text-slate-700 dark:text-slate-200">
                            <strong>DB:</strong>{' '}
                            {lastDbSyncState?.ok === false
                              ? 'Sync Error'
                              : `${schedules.length} saved in RTDB`}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              eepromVerified
                                ? 'bg-emerald-500'
                                : linkedEsp
                                ? 'bg-amber-500'
                                : 'bg-slate-400'
                            }`}
                          />
                          <span className="text-slate-700 dark:text-slate-200">
                            <strong>ESP32 EEPROM:</strong>{' '}
                            {!linkedEsp
                              ? 'No ESP32 linked'
                              : eepromVerified
                              ? `Verified (${linkedEsp.syncedActivityCount}/${schedules.length}${
                                  linkedEsp.nvsSaved ? ' · NVS OK' : ''
                                })`
                              : espOnlineRecent
                              ? `Syncing (${linkedEsp.syncedActivityCount ?? 0}/${schedules.length})...`
                              : `Pending (${linkedEsp.syncedActivityCount ?? 0}/${schedules.length} — ESP offline)`}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              tzMatches ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                          />
                          <span className="text-slate-700 dark:text-slate-200 font-mono tabular-nums">
                            <strong>Clock:</strong> {currentHHMM} ({todayISO})
                            {!tzMatches ? ' · TZ Mismatch' : ''}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              schoolConfig.autoRingEnabled ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                          />
                          <span className="text-slate-700 dark:text-slate-200 truncate">
                            <strong>Pre-Flight:</strong>{' '}
                            {!schoolConfig.autoRingEnabled
                              ? 'Auto-Ring Paused'
                              : nextScheduledBell
                              ? `Next "${nextScheduledBell.title}" @ ${nextScheduledBell.time}`
                              : 'No active pending slots right now'}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={verifyingHardwareSync}
                        onClick={() => void handleVerifyAndSyncHardware()}
                        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#0B1224] hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer disabled:opacity-60"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 text-blue-600 dark:text-cyan-400 ${
                            verifyingHardwareSync ? 'animate-spin' : ''
                          }`}
                        />
                        <span>
                          {verifyingHardwareSync ? 'Verifying...' : 'Verify & Sync ESP32'}
                        </span>
                      </button>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Day-by-Day Selector Bar */}
            <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#060B19]/60 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-1 shrink-0">
                  Day View:
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                  {WEEKDAYS.map((day) => {
                    const isSelected = selectedDay === day;
                    const isToday = day === todayWeekday;
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setSelectedDay(day)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                            : 'bg-white dark:bg-[#0B1224] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <span>{WEEKDAY_FULL_LABELS[day]}</span>
                        {isToday && (
                          <span
                            aria-label="Today"
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSelected ? 'bg-white' : 'bg-emerald-500'
                            }`}
                          />
                        )}
                        <span
                          className={`font-mono text-[11px] tabular-nums ${
                            isSelected
                              ? 'text-blue-100'
                              : 'text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          ({dayCounts[day]})
                        </span>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setSelectedDay('All')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      selectedDay === 'All'
                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                        : 'bg-white dark:bg-[#0B1224] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <span>All Days</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-slate-900 dark:text-white text-sm">
                    {selectedDay === 'All'
                      ? `All Days · ${PROFILE_LABEL[activeProfile]}`
                      : `${WEEKDAY_FULL_LABELS[selectedDay]} Full Day Arrangement`}
                  </span>
                  {selectedDay !== 'All' && selectedDay === todayWeekday && (
                    <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                      · Today
                    </span>
                  )}
                </div>

                {dayOverview ? (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-600 dark:text-slate-300">
                    <span>
                      Day Span:{' '}
                      <strong className="font-mono tabular-nums text-slate-900 dark:text-white">
                        {dayOverview.firstStart} – {dayOverview.lastEnd}
                      </strong>
                    </span>
                    <span className="text-slate-400" aria-hidden="true">
                      ·
                    </span>
                    <span className="tabular-nums">
                      <strong className="text-slate-900 dark:text-white">
                        {dayOverview.enabledCount}
                      </strong>
                      /{dayOverview.totalCount} active slots
                    </span>
                  </div>
                ) : (
                  <span className="text-slate-500 dark:text-slate-400">
                    No slots scheduled for{' '}
                    {selectedDay === 'All' ? 'this mode' : WEEKDAY_FULL_LABELS[selectedDay]}
                  </span>
                )}
              </div>
            </div>

            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="h-11 bg-slate-100 dark:bg-slate-800/60 rounded-lg animate-pulse"
                  />
                ))}
              </div>
            ) : filteredSchedules.length === 0 ? (
              <div className="p-12 text-center">
                <CalendarClock className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white mb-1">
                  {selectedDay === 'All'
                    ? 'No Bell Slots Match Your View'
                    : `No Schedule Set for ${WEEKDAY_FULL_LABELS[selectedDay]}`}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-5">
                  Add a new activity slot or switch to another day above to inspect its full
                  schedule.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingItem(null);
                      setModalOpen(true);
                    }}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    Add Bell Slot
                  </button>
                  {selectedDay !== 'All' && dayCounts.Mon > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedDay('Mon')}
                      className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold cursor-pointer"
                    >
                      View Monday Schedule
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#060B19] text-xs font-medium text-slate-500 dark:text-slate-400">
                      <th className="py-3 px-4 w-12">#</th>
                      <th className="py-3 px-4">Time (Start – End)</th>
                      <th className="py-3 px-4">Activity / Exam</th>
                      <th className="py-3 px-4">Days / Teacher</th>
                      <th className="py-3 px-4">State</th>
                      <th className="py-3 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-sm">
                    {filteredSchedules.map((item, idx) => {
                      const durationLabel = formatDurationSpan(item.time, item.endTime);
                      const isExpiredExam =
                        item.profile === 'Exams' &&
                        Boolean(item.examDate) &&
                        (item.examDate! < todayISO ||
                          (item.examDate === todayISO && (item.endTime || item.time) <= currentHHMM));
                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors ${
                            isExpiredExam ? 'opacity-70' : ''
                          }`}
                        >
                          <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-400 dark:text-slate-500 tabular-nums whitespace-nowrap">
                            {String(idx + 1).padStart(2, '0')}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <p className="font-mono text-base font-bold text-slate-900 dark:text-white tabular-nums">
                              {item.time} – {item.endTime || item.time}
                            </p>
                            {durationLabel && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                                {durationLabel}
                              </p>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <p className="font-medium text-slate-900 dark:text-white">{item.title}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {PROFILE_LABEL[item.profile]}
                            </p>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {item.profile === 'Exams' ? (
                              <div>
                                {item.examDate && (
                                  <p className="font-mono font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                                    {item.examDate} ({item.days.join(', ')})
                                  </p>
                                )}
                                <p className="text-slate-600 dark:text-slate-300">
                                  Teacher: {item.teacherName || '—'}
                                </p>
                              </div>
                            ) : (
                              item.days.join(', ')
                            )}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex flex-col items-start gap-1">
                              <button
                                type="button"
                                onClick={() => handleToggleSlotEnabled(item)}
                                className={`inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer ${
                                  item.enabled
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : 'text-slate-400 dark:text-slate-500'
                                }`}
                              >
                                {item.enabled ? (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Enabled</span>
                                  </>
                                ) : (
                                  <>
                                    <PauseCircle className="w-3.5 h-3.5" />
                                    <span>Disabled</span>
                                  </>
                                )}
                              </button>
                              {isExpiredExam && (
                                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 text-amber-800 dark:text-amber-300">
                                  Expired (Won&apos;t Ring)
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                title="Ring this bell now"
                                onClick={() =>
                                  triggerManualRing(item.title, item.tone, item.zone)
                                }
                                className="p-2 rounded-lg text-blue-600 dark:text-cyan-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 cursor-pointer"
                              >
                                <Play className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                title="Edit bell slot"
                                onClick={() => {
                                  setEditingItem(item);
                                  setModalOpen(true);
                                }}
                                className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              {confirmDeleteId === item.id ? (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSchedule(item.id)}
                                  className="px-2.5 py-1 rounded-md bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer"
                                >
                                  Confirm
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  title="Delete bell slot"
                                  onClick={() => setConfirmDeleteId(item.id)}
                                  className="p-2 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>

      <BellScheduleModal
        isOpen={modalOpen}
        editingItem={editingItem}
        defaultProfile={activeProfile}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveSchedule}
      />

      {isCompanyAdmin && passwordModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0B1224] border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white mb-1">
              {language === 'rw' ? 'Hindura Ijambo ry’Ibanga' : 'Change Password'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              {language === 'rw'
                ? 'Shyiramo password usanzwe ukoresha hanyuma uhitemo nshya.'
                : 'Enter your current password and choose a new password (6+ characters).'}
            </p>
            {pwdError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-200">
                {pwdError}
              </div>
            )}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setPwdError(null);
                setChangingPwd(true);
                try {
                  await changeOwnPassword(currentPwdInput, newPwdInput);
                  setPasswordModalOpen(false);
                  setStatusNotice(
                    language === 'rw'
                      ? 'Password yahinduwe neza.'
                      : 'Your password has been updated successfully.'
                  );
                } catch (err) {
                  setPwdError(err instanceof Error ? err.message : 'Unable to update password.');
                } finally {
                  setChangingPwd(false);
                }
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'rw' ? 'Password ya kera' : 'Current Password'}
                </label>
                <input
                  type="password"
                  required
                  value={currentPwdInput}
                  onChange={(e) => setCurrentPwdInput(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#060B19] text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'rw' ? 'Password nshya (6+)' : 'New Password (6+ chars)'}
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPwdInput}
                  onChange={(e) => setNewPwdInput(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#060B19] text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPasswordModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  {language === 'rw' ? 'Hagarika' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={changingPwd}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-60 rounded-lg cursor-pointer"
                >
                  {changingPwd
                    ? language === 'rw'
                      ? 'Birimo guhinduka...'
                      : 'Updating...'
                    : language === 'rw'
                    ? 'Emeza Password Nshya'
                    : 'Save New Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isCompanyAdmin && announcementModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#0B1224] border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white mb-1">
              Publish Company Announcement
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Choose whether this notice goes strictly to registered logged-in schools or to the public Announcements page (e.g., new installation promotions for everyone).
            </p>
            <form onSubmit={handleCreateAnnouncement} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Target Audience
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAnnAudience('schools');
                      if (annTag === 'Installation Promotion' || annTag === 'Public & School Notice') {
                        setAnnTag('School Notice');
                      }
                    }}
                    className={`text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                      annAudience === 'schools'
                        ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-500 text-slate-900 dark:text-white'
                        : 'bg-slate-50 dark:bg-[#060B19] border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <p className="text-xs font-bold">
                      Registered Schools Only (After Login)
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Shown only inside School Bell Announcements after a registered school logs in.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAnnAudience('public');
                      if (annTag === 'School Notice' || annTag === 'Public & School Notice') {
                        setAnnTag('Installation Promotion');
                      }
                    }}
                    className={`text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                      annAudience === 'public'
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-slate-900 dark:text-white'
                        : 'bg-slate-50 dark:bg-[#060B19] border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <p className="text-xs font-bold">
                      Public Website — Everyone &amp; New Visitors
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Shown on the public navbar Announcements page (e.g., New Installation Promotion).
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAnnAudience('all');
                      if (annTag === 'School Notice' || annTag === 'Installation Promotion') {
                        setAnnTag('Public & School Notice');
                      }
                    }}
                    className={`text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                      annAudience === 'all'
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-500 text-slate-900 dark:text-white'
                        : 'bg-slate-50 dark:bg-[#060B19] border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <p className="text-xs font-bold">
                      Both Public Website &amp; Registered Schools
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Appears on the public Announcements page and inside logged-in school dashboards.
                    </p>
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="ann-tag"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Category / Label
                </label>
                <input
                  id="ann-tag"
                  type="text"
                  required
                  value={annTag}
                  onChange={(e) => setAnnTag(e.target.value)}
                  placeholder={
                    annAudience === 'public'
                      ? 'e.g., Installation Promotion'
                      : 'e.g., Maintenance Notice'
                  }
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#060B19] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="ann-title"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Announcement Title
                </label>
                <input
                  id="ann-title"
                  type="text"
                  required
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder={
                    annAudience === 'public'
                      ? 'e.g., 2026 New School Installation Promotion — Free Setup Consultation'
                      : 'e.g., Scheduled Maintenance 15:00 – Use Manual Mode'
                  }
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#060B19] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label
                  htmlFor="ann-detail"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Details
                </label>
                <textarea
                  id="ann-detail"
                  rows={4}
                  required
                  value={annDetail}
                  onChange={(e) => setAnnDetail(e.target.value)}
                  placeholder={
                    annAudience === 'public'
                      ? 'Write public announcement or installation promotion details for new visitors...'
                      : 'Write the announcement message for registered schools...'
                  }
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#060B19] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAnnouncementModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingAnn}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Megaphone className="w-3.5 h-3.5" />
                  <span>{creatingAnn ? 'Publishing...' : 'Publish Announcement'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isCompanyAdmin && assigningDevice && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0B1224] border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white mb-1">
              Assign ESP32 to School
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Link board{' '}
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                {assigningDevice.serialNumber}
              </span>{' '}
              (Chip{' '}
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                {assigningDevice.chipId}
              </span>
              ) to a registered school account.
            </p>
            {schools.length === 0 ? (
              <div className="space-y-4">
                <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  No schools are registered yet. Create a school under All Schools first.
                </p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setAssigningDevice(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAssignDeviceSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="assign-school-select"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Select Registered School
                  </label>
                  <select
                    id="assign-school-select"
                    required
                    value={assignSchoolIdInput}
                    onChange={(e) => setAssignSchoolIdInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#060B19] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {schools.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.schoolName} ({s.primaryEmail || s.campusLocation})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                    Once linked, only this selected school’s schedules and Manual Bell commands will be sent to this ESP32 board.
                  </p>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setAssigningDevice(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={assigningSaving}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-60 rounded-lg cursor-pointer"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>{assigningSaving ? 'Assigning...' : 'Assign ESP32'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {isCompanyAdmin && addDeviceModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0B1224] border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white mb-1">
              Add ESP32 Board
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Enter your ESP32 Serial Number and Chip ID, pick the school, and register to connect it immediately in the database.
            </p>
            <form onSubmit={handleRegisterEsp32Device} className="space-y-3">
              <div>
                <label
                  htmlFor="esp-serial-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Serial Number
                </label>
                <input
                  id="esp-serial-input"
                  type="text"
                  value={newDeviceSerial}
                  onChange={(e) => setNewDeviceSerial(e.target.value)}
                  placeholder="e.g., BC-01-ESP"
                  className="w-full px-3.5 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#060B19] text-slate-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label
                    htmlFor="esp-chip-input"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    ESP32 Chip ID *
                  </label>
                  <input
                    id="esp-chip-input"
                    type="text"
                    required
                    value={newDeviceChipId}
                    onChange={(e) => setNewDeviceChipId(e.target.value)}
                    placeholder="e.g., 24c2b6215788"
                    className="w-full px-3.5 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#060B19] text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label
                    htmlFor="esp-pin-input"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Relay Pin
                  </label>
                  <input
                    id="esp-pin-input"
                    type="number"
                    min={0}
                    max={48}
                    value={newDeviceRelayPin}
                    onChange={(e) => setNewDeviceRelayPin(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#060B19] text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="esp-school-optional"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Select School (Connect in Database)
                </label>
                <select
                  id="esp-school-optional"
                  value={newDeviceSchoolId}
                  onChange={(e) => setNewDeviceSchoolId(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#060B19] text-slate-900 dark:text-white"
                >
                  <option value="">Leave Unassigned (Awaiting Assignment)</option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.schoolName} ({s.primaryEmail || s.campusLocation})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddDeviceModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingDevice}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-60 rounded-lg cursor-pointer"
                >
                  {addingDevice
                    ? 'Connecting...'
                    : newDeviceSchoolId
                      ? 'Register & Connect'
                      : 'Register Board'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isCompanyAdmin && firmwareModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-3xl rounded-2xl bg-white dark:bg-[#0B1224] border border-slate-200 dark:border-slate-800 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  BellCraft ESP32 Firmware V2.10 — Real-Time 1–3s Offline Detection + Instant Command
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Sends ultra-fast 0.9s keep-alive presence pings (~1–3s power-loss offline
                  detection), polls commands first on boot, blocks duplicate/expired triggers, and
                  persists up to 40 activities in Flash NVS/EEPROM.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFirmwareModalOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer shrink-0"
              >
                Close
              </button>
            </div>

            {/* Firebase RTDB Public IoT Bridge Diagnostic Banner (Fixes HTTP 302) */}
            {(() => {
              const rtdbRulesJson = JSON.stringify(
                {
                  rules: {
                    users: {
                      $uid: {
                        '.read':
                          "auth != null && ($uid === auth.uid || (auth.token.email_verified === true && auth.token.email === 'niyomungeritheophile02@gmail.com'))",
                        '.write':
                          "auth != null && auth.token.email_verified === true && auth.token.email === 'niyomungeritheophile02@gmail.com'",
                      },
                    },
                    schools: {
                      '.read':
                        "auth != null && auth.token.email_verified === true && auth.token.email === 'niyomungeritheophile02@gmail.com'",
                      '.write':
                        "auth != null && auth.token.email_verified === true && auth.token.email === 'niyomungeritheophile02@gmail.com'",
                      $schoolId: {
                        '.read':
                          "auth != null && (root.child('users').child(auth.uid).child('schoolId').val() === $schoolId || data.child('ownerId').val() === auth.uid || (auth.token.email_verified === true && auth.token.email === 'niyomungeritheophile02@gmail.com'))",
                        '.write':
                          "auth != null && (root.child('users').child(auth.uid).child('schoolId').val() === $schoolId || (auth.token.email_verified === true && auth.token.email === 'niyomungeritheophile02@gmail.com'))",
                      },
                    },
                    schedules: {
                      $schoolId: {
                        '.read':
                          "auth != null && (root.child('users').child(auth.uid).child('schoolId').val() === $schoolId || root.child('schools').child($schoolId).child('ownerId').val() === auth.uid || (auth.token.email_verified === true && auth.token.email === 'niyomungeritheophile02@gmail.com'))",
                        '.write':
                          "auth != null && (root.child('users').child(auth.uid).child('schoolId').val() === $schoolId || root.child('schools').child($schoolId).child('ownerId').val() === auth.uid || (auth.token.email_verified === true && auth.token.email === 'niyomungeritheophile02@gmail.com'))",
                      },
                    },
                    zones: {
                      $schoolId: {
                        '.read':
                          "auth != null && (root.child('users').child(auth.uid).child('schoolId').val() === $schoolId || root.child('schools').child($schoolId).child('ownerId').val() === auth.uid || (auth.token.email_verified === true && auth.token.email === 'niyomungeritheophile02@gmail.com'))",
                        '.write':
                          "auth != null && (root.child('users').child(auth.uid).child('schoolId').val() === $schoolId || root.child('schools').child($schoolId).child('ownerId').val() === auth.uid || (auth.token.email_verified === true && auth.token.email === 'niyomungeritheophile02@gmail.com'))",
                      },
                    },
                    logs: {
                      $schoolId: {
                        '.read':
                          "auth != null && (root.child('users').child(auth.uid).child('schoolId').val() === $schoolId || root.child('schools').child($schoolId).child('ownerId').val() === auth.uid || (auth.token.email_verified === true && auth.token.email === 'niyomungeritheophile02@gmail.com'))",
                        '.write':
                          "auth != null && (root.child('users').child(auth.uid).child('schoolId').val() === $schoolId || root.child('schools').child($schoolId).child('ownerId').val() === auth.uid || (auth.token.email_verified === true && auth.token.email === 'niyomungeritheophile02@gmail.com'))",
                      },
                    },
                    schoolUsers: {
                      $schoolId: {
                        '.read':
                          "auth != null && auth.token.email_verified === true && auth.token.email === 'niyomungeritheophile02@gmail.com'",
                        '.write':
                          "auth != null && auth.token.email_verified === true && auth.token.email === 'niyomungeritheophile02@gmail.com'",
                      },
                    },
                    publicAnnouncements: {
                      '.read': true,
                      '.write':
                        "auth != null && auth.token.email_verified === true && auth.token.email === 'niyomungeritheophile02@gmail.com'",
                    },
                    announcements: {
                      '.read': 'auth != null',
                      '.write':
                        "auth != null && auth.token.email_verified === true && auth.token.email === 'niyomungeritheophile02@gmail.com'",
                    },
                    inquiries: {
                      '.read':
                        "auth != null && auth.token.email_verified === true && auth.token.email === 'niyomungeritheophile02@gmail.com'",
                      $inquiryId: {
                        '.write':
                          "(!data.exists() && newData.hasChildren(['firstName', 'lastName', 'email', 'subject', 'message', 'createdAtMs'])) || (auth != null && auth.token.email_verified === true && auth.token.email === 'niyomungeritheophile02@gmail.com')",
                      },
                    },
                    hardwareFeeds: {
                      $deviceKey: {
                        '.read': '$deviceKey.length >= 16',
                        '.write': '$deviceKey.length >= 16',
                      },
                    },
                    devices: {
                      '.read':
                        "auth != null && auth.token.email_verified === true && auth.token.email === 'niyomungeritheophile02@gmail.com'",
                      '.write':
                        "auth != null && auth.token.email_verified === true && auth.token.email === 'niyomungeritheophile02@gmail.com'",
                      $deviceId: {
                        '.read':
                          "auth != null && (data.child('schoolId').val() === root.child('users').child(auth.uid).child('schoolId').val() || (auth.token.email_verified === true && auth.token.email === 'niyomungeritheophile02@gmail.com'))",
                      },
                    },
                    esp32Bridge: {
                      health: {
                        '.read': true,
                        '.write':
                          "auth != null && auth.token.email_verified === true && auth.token.email === 'niyomungeritheophile02@gmail.com'",
                      },
                      schools: {
                        $schoolKey: {
                          '.read': '$schoolKey.length >= 2',
                          '.write': 'auth != null',
                        },
                      },
                      devices: {
                        '.read':
                          "auth != null && auth.token.email_verified === true && auth.token.email === 'niyomungeritheophile02@gmail.com'",
                        $chipId: {
                          '.read': '$chipId.length >= 4',
                          '.write': '$chipId.length >= 4',
                        },
                      },
                    },
                  },
                },
                null,
                2
              );
              const isBridgeReady = rtdbBridgeStatus?.ready === true;
              return (
                <div
                  className={`mb-4 rounded-xl border p-3.5 text-xs ${
                    isBridgeReady
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-800/70'
                      : 'bg-amber-50/80 dark:bg-amber-950/25 border-amber-300 dark:border-amber-700/70'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isBridgeReady ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                      />
                      <span>
                        {isBridgeReady
                          ? 'ESP32 Firebase RTDB Bridge Active (HTTP 200 OK — Zero 302)'
                          : `Action Needed Once: Publish RTDB Bridge Rules (Status ${
                              rtdbBridgeStatus?.status ?? 'Checking...'
                            })`}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {!isBridgeReady && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleCopyValue('rtdb-rules', rtdbRulesJson)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-semibold cursor-pointer"
                          >
                            {copiedKeyLabel === 'rtdb-rules' ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Rules Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy RTDB Rules</span>
                              </>
                            )}
                          </button>
                          <a
                            href="https://console.firebase.google.com/project/schoolbellsystem-8c6fe/database/schoolbellsystem-8c6fe-default-rtdb/rules"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 text-[11px] font-semibold hover:bg-amber-50 dark:hover:bg-slate-700"
                          >
                            <span>Open Firebase Rules</span>
                            <ArrowRight className="w-3 h-3" />
                          </a>
                        </>
                      )}
                      <button
                        type="button"
                        disabled={checkingBridge}
                        onClick={() => void verifyRtdbBridge()}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold cursor-pointer"
                      >
                        <RefreshCw
                          className={`w-3 h-3 ${checkingBridge ? 'animate-spin' : ''}`}
                        />
                        <span>{checkingBridge ? 'Checking...' : 'Verify Bridge'}</span>
                      </button>
                    </div>
                  </div>
                  {!isBridgeReady && (
                    <p className="mt-2 text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                      <strong>Why ESP32 gets 401:</strong> Firebase Realtime Database blocks ESP32
                      requests to <span className="font-mono">esp32Bridge</span> until you publish
                      the updated rules once. Click <strong>Copy RTDB Rules</strong>, click{' '}
                      <strong>Open Firebase Rules</strong>, replace the JSON and click{' '}
                      <strong>Publish</strong>, then click <strong>Verify Bridge</strong>.
                    </p>
                  )}
                </div>
              );
            })()}

            <div className="grid grid-cols-1 sm:grid-cols-6 gap-3 mb-4">
              <div className="sm:col-span-3">
                <label
                  htmlFor="firmware-school-select"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Target School (<span className="font-mono">SCHOOL_NAME</span>)
                </label>
                <select
                  id="firmware-school-select"
                  value={firmwareSchoolId}
                  onChange={(e) => setFirmwareSchoolId(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#060B19] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.schoolName} ({s.primaryEmail || s.campusLocation})
                    </option>
                  ))}
                  <option value="">Leave Unassigned (Assign Manually Later)</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="firmware-relay-pin"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Relay GPIO
                </label>
                <input
                  id="firmware-relay-pin"
                  type="number"
                  min={0}
                  max={39}
                  value={firmwareRelayPin}
                  onChange={(e) =>
                    setFirmwareRelayPin(Math.max(0, Math.min(39, Number(e.target.value) || 0)))
                  }
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#060B19] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="firmware-relay-logic"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Relay Logic
                </label>
                <select
                  id="firmware-relay-logic"
                  value={firmwareRelayActiveLow ? 'low' : 'high'}
                  onChange={(e) => setFirmwareRelayActiveLow(e.target.value === 'low')}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#060B19] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Active-LOW (LOW = ON)</option>
                  <option value="high">Active-HIGH (HIGH = ON)</option>
                </select>
              </div>
              <div className="sm:col-span-3">
                <label
                  htmlFor="firmware-wifi-ssid"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  School WiFi Name (Optional)
                </label>
                <input
                  id="firmware-wifi-ssid"
                  type="text"
                  value={firmwareWifiSsid}
                  onChange={(e) => setFirmwareWifiSsid(e.target.value)}
                  placeholder="SCHOOL_WIFI_NAME"
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#060B19] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="sm:col-span-3">
                <label
                  htmlFor="firmware-wifi-pass"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  School WiFi Password (Optional)
                </label>
                <input
                  id="firmware-wifi-pass"
                  type="text"
                  value={firmwareWifiPass}
                  onChange={(e) => setFirmwareWifiPass(e.target.value)}
                  placeholder="SCHOOL_WIFI_PASSWORD"
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#060B19] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {(() => {
              const selectedFirmwareSchool =
                schools.find((s) => s.id === firmwareSchoolId) || null;
              const escapeCpp = (val: string) => val.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
              const rawSchoolName = selectedFirmwareSchool?.schoolName || '';
              const safeSchoolNameLiteral = escapeCpp(rawSchoolName);
              const targetSchoolKeyPreview = rawSchoolName
                ? toSchoolBridgeKey(rawSchoolName)
                : '';
              const safeWifiSsidLiteral = escapeCpp(firmwareWifiSsid.trim() || 'SCHOOL_WIFI_NAME');
              const safeWifiPassLiteral = escapeCpp(
                firmwareWifiPass.trim() || 'SCHOOL_WIFI_PASSWORD'
              );
              const safePin = Math.max(0, Math.min(39, Math.round(Number(firmwareRelayPin || 2))));
              const relayOnVal = firmwareRelayActiveLow ? 'LOW' : 'HIGH';
              const relayOffVal = firmwareRelayActiveLow ? 'HIGH' : 'LOW';
              const relayModeLabel = firmwareRelayActiveLow ? 'Active-LOW' : 'Active-HIGH';
              const sketch = `/*
  ============================================================
  BellCraft Automatic School Bell
  ESP32 FIRMWARE V2.10 - 0.9S LIVE PRESENCE (1-3S OFFLINE) + INSTANT COMMAND + EEPROM

  Features:
  - Direct Firebase Realtime Database HTTPS (Zero 302 Redirects)
  - Real-Time 0.9s Keep-Alive Presence Ping: Reuses open TLS socket (~90ms)
    so Dashboard detects ESP32 power/network loss within ~1-3 seconds
  - First-Boot Instant Response: Polls cloud command BEFORE heartbeat & schedule
    sync, and never holds 2 TLS sockets open simultaneously (zero heap exhaustion)
  - Immediate Manual/Test Execution: Manual commands never wait 12s for NTP sync
  - Command Delivery ACK & Chunked Binary Flash NVS/EEPROM (up to 40 slots)
  - Auto-Timezone Sync & Pre-Flight Guard: Checks clock, profile, and expiry
  - Works Offline AND Even When Browser Is Closed
  - School Identification (${rawSchoolName || 'Unassigned'})
  - ${relayModeLabel} Relay (${relayOnVal} = ON, ${relayOffVal} = OFF)
  ============================================================
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <time.h>

// 1. WIFI CONFIGURATION
const char* WIFI_SSID = "${safeWifiSsidLiteral}";
const char* WIFI_PASS = "${safeWifiPassLiteral}";

// 2. FIREBASE RTDB CONFIGURATION (Public HTTPS, Zero 302)
const char* RTDB_URL    = "${REALTIME_DB_URL}";
const char* SCHOOL_NAME = "${safeSchoolNameLiteral}";
const char* FW_VERSION  = "2.10";

// 3. RELAY & OPTIONAL MANUAL BUTTON CONFIGURATION
int activeRelayPin = ${safePin};
#define RELAY_ON  ${relayOnVal}
#define RELAY_OFF ${relayOffVal}
#define MANUAL_BTN_PIN -1  // Optional: set GPIO (e.g. 4) wired to GND for offline manual ring

// 4. TIMING CONFIGURATION (0.9s Live Presence + Cold-TLS Safe + Zero-Lag)
const unsigned long POLL_INTERVAL_MS          = 250;
const unsigned long FAST_RETRY_INTERVAL_MS    = 350;
const unsigned long OFFLINE_POLL_RETRY_MS     = 10000;
const int OFFLINE_FAIL_THRESHOLD              = 8;
const unsigned long PRESENCE_PING_INTERVAL_MS = 900;
const unsigned long TLS_REFRESH_INTERVAL_MS   = 90000;
const unsigned long HEARTBEAT_INTERVAL_MS     = 30000;
const unsigned long WIFI_RETRY_MS             = 8000;
const unsigned long HTTP_TIMEOUT_MS           = 4500;
const unsigned long HTTP_CONNECT_TIMEOUT_MS   = 4500;
const int DEFAULT_DURATION_SEC              = 5;
const int MAX_DURATION_SEC                  = 300;
#define MAX_OFFLINE_SLOTS 40
#define NVS_CHUNK_SLOTS   10

struct OfflineBellSlot {
  char id[40];
  char title[38];
  char time[6];
  char endTime[6];
  char profile[12];
  char examDate[12];
  uint8_t dayMask;
  int32_t durationSec;
  uint8_t enabled;
};

// 5. SYSTEM & OFFLINE FAILOVER VARIABLES
OfflineBellSlot offlineSlots[MAX_OFFLINE_SLOTS];
int offlineSlotCount               = 0;
String chipIdHex                   = "";
String activeSchoolKey             = "";
String lastCommandId               = "";
String lastLinkedSchool            = "";
String lastPollUrl                 = "";
String cachedActiveProfile         = "Studying";
String lastOfflineTriggerKey       = "";
String lastOnlineTriggerMinute     = "";
String pendingAckCmdId             = "";
bool deviceAssigned                = true;
bool ringing                       = false;
bool wifiStarted                   = false;
bool ntpConfigured                 = false;
bool ntpSyncedLogged               = false;
bool offlineAutoRing               = true;
bool relayGlobalEnabled            = true;
bool pendingScheduleSync           = true;
bool wasOfflineMode                = false;
bool nvsVerified                   = false;
bool firstPollAttempted            = false;
int timezoneOffsetMin              = ${-new Date().getTimezoneOffset()};
int consecutivePollFails           = 0;
double lastSyncedScheduleTs        = 0.0;
unsigned long ringStopAtMs         = 0;
unsigned long lastPollMs           = 0;
unsigned long lastHeartbeatMs      = 0;
unsigned long lastWifiRetryMs      = 0;
unsigned long lastSuccessfulPollMs = 0;
unsigned long lastTlsRefreshMs     = 0;
unsigned long lastOfflineCheckMs   = 0;
unsigned long lastOfflineLogMs     = 0;
unsigned long lastSchedSyncTryMs   = 0;
unsigned long lastPresencePingMs   = 0;
Preferences preferences;
HTTPClient pollHttp;

String getEsp32ChipId() {
  uint64_t mac = ESP.getEfuseMac();
  char buf[13];
  snprintf(buf, sizeof(buf), "%012llx", (unsigned long long)(mac & 0xFFFFFFFFFFFFULL));
  return String(buf);
}

String normalizeSchoolKey(const String& name) {
  String key = "";
  bool lastUnderscore = true;
  for (size_t i = 0; i < name.length(); i++) {
    char c = name.charAt(i);
    if (isAlphaNumeric(c)) {
      key += (char)toupper(c);
      lastUnderscore = false;
    } else if (!lastUnderscore) {
      key += '_';
      lastUnderscore = true;
    }
  }
  if (key.endsWith("_")) key.remove(key.length() - 1);
  return key;
}

bool isValidRelayPin(int pin) {
  if (pin < 0 || pin > 39) return false;
  if (pin >= 6 && pin <= 11) return false;   // Flash pins
  if (pin >= 34 && pin <= 39) return false;  // Input-only GPIOs
  if (pin == 1 || pin == 3) return false;    // UART Serial pins
  if (pin == 20 || pin == 24) return false;  // Reserved pins
  return true;
}

void initializeRelay() {
  digitalWrite(activeRelayPin, RELAY_OFF);
  pinMode(activeRelayPin, OUTPUT);
  digitalWrite(activeRelayPin, RELAY_OFF);
  ringing = false;
  Serial.print("Relay initialized on GPIO: ");
  Serial.println(activeRelayPin);
}

void setRelay(bool turnOn) {
  digitalWrite(activeRelayPin, turnOn ? RELAY_ON : RELAY_OFF);
  ringing = turnOn;
  Serial.println(turnOn ? "BELL STATUS: ON" : "BELL STATUS: OFF");
}

void updateRelayPin(int newPin) {
  if (!isValidRelayPin(newPin) || newPin == activeRelayPin) return;
  setRelay(false);
  digitalWrite(newPin, RELAY_OFF);
  pinMode(newPin, OUTPUT);
  digitalWrite(newPin, RELAY_OFF);
  activeRelayPin = newPin;
  Serial.print("New relay GPIO: ");
  Serial.println(activeRelayPin);
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  wifiStarted = true;
  lastWifiRetryMs = millis();
  Serial.println("Connecting to school WiFi...");
}

void maintainWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    WiFi.setSleep(false);
    return;
  }
  if (!wifiStarted) { connectWiFi(); return; }
  if (millis() - lastWifiRetryMs >= WIFI_RETRY_MS) {
    lastWifiRetryMs = millis();
    Serial.println("WiFi offline - Offline EEPROM Failover active.");
    WiFi.setSleep(false);
    WiFi.reconnect();
  }
}

String getCurrentClockStamp() {
  time_t nowEpoch = time(nullptr);
  if (nowEpoch < 1700000000L) return "";
  struct tm t;
  localtime_r(&nowEpoch, &t);
  char buf[20];
  snprintf(buf, sizeof(buf), "%04d-%02d-%02d %02d:%02d",
           t.tm_year + 1900, t.tm_mon + 1, t.tm_mday, t.tm_hour, t.tm_min);
  return String(buf);
}

void syncNtpClock(bool forceReconfig = false) {
  if (WiFi.status() != WL_CONNECTED) return;
  if (!ntpConfigured || forceReconfig) {
    configTime((long)timezoneOffsetMin * 60L, 0, "pool.ntp.org", "time.google.com", "time.nist.gov");
    ntpConfigured = true;
    ntpSyncedLogged = false;
    Serial.println("NTP clock sync configured (TZ offset min: " + String(timezoneOffsetMin) + ")");
  }
  if (!ntpSyncedLogged && time(nullptr) >= 1700000000L) {
    ntpSyncedLogged = true;
    Serial.println("Clock synced: " + getCurrentClockStamp());
  }
}

bool isDuplicateCommand(const String& commandId) {
  return (commandId.length() > 0 && commandId == lastCommandId);
}

void saveCommandId(const String& commandId) {
  lastCommandId = commandId;
  preferences.putString("lastCmd", commandId);
}

void startBell(String commandId, int durationSec) {
  if (commandId.length() == 0 || isDuplicateCommand(commandId)) return;
  if (durationSec < 1) durationSec = DEFAULT_DURATION_SEC;
  if (durationSec > MAX_DURATION_SEC) durationSec = MAX_DURATION_SEC;
  Serial.println("NEW BELL COMMAND: " + commandId + " (" + String(durationSec) + "s)");
  saveCommandId(commandId);
  setRelay(true);
  ringStopAtMs = millis() + ((unsigned long)durationSec * 1000UL);
}

void stopBell() {
  if (ringing) {
    Serial.println("BELL STOPPED.");
    setRelay(false);
  }
}

void checkRingDuration() {
  if (ringing && (int32_t)(millis() - ringStopAtMs) >= 0) {
    Serial.println("Ring duration completed.");
    stopBell();
  }
}

void checkManualButton() {
#if MANUAL_BTN_PIN >= 0
  static int lastBtnState = HIGH;
  static unsigned long lastDebounceMs = 0;
  if (MANUAL_BTN_PIN == activeRelayPin) return;
  int reading = digitalRead(MANUAL_BTN_PIN);
  if (reading != lastBtnState && (millis() - lastDebounceMs) > 60) {
    lastDebounceMs = millis();
    lastBtnState = reading;
    if (reading == LOW) {
      String btnCmd = "btn-" + String(millis());
      Serial.println("[MANUAL BUTTON] Local offline bell triggered!");
      startBell(btnCmd, DEFAULT_DURATION_SEC);
    }
  }
#endif
}

String sanitizeJsonText(String s) {
  s.replace("\\\\", "");
  s.replace("\\"", "'");
  s.replace("\\n", " ");
  s.replace("\\r", " ");
  return s;
}

void printOfflineSlots() {
  Serial.println("--- EEPROM/NVS ACTIVITIES (" + String(offlineSlotCount) + ") [Profile: " + cachedActiveProfile + " | Auto: " + String(offlineAutoRing ? "ON" : "OFF") + " | EEPROM: " + String(nvsVerified ? "VERIFIED" : "RAM") + "] ---");
  static const char* DAY_NAMES[7] = {"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"};
  for (int i = 0; i < offlineSlotCount; i++) {
    const OfflineBellSlot& s = offlineSlots[i];
    String whenStr = "";
    if (strlen(s.examDate) > 0) {
      whenStr = "Date:" + String(s.examDate);
    } else {
      whenStr = "Days:";
      bool first = true;
      for (int d = 0; d < 7; d++) {
        if (s.dayMask & (1 << d)) {
          if (!first) whenStr += ",";
          whenStr += DAY_NAMES[d];
          first = false;
        }
      }
    }
    Serial.println("  " + String(i + 1) + ". [" + String(s.profile) + "] " + String(s.title) + " | " + String(s.time) + "-" + String(s.endTime) + " | " + whenStr + " | " + String(s.enabled ? "ON" : "PAUSED"));
  }
  Serial.println("------------------------------------------------------------");
}

bool saveOfflineSlotsToNvs() {
  preferences.putInt("slotCnt", offlineSlotCount);
  int chunks = (offlineSlotCount + NVS_CHUNK_SLOTS - 1) / NVS_CHUNK_SLOTS;
  bool allOk = true;
  for (int c = 0; c < chunks; c++) {
    int startIdx = c * NVS_CHUNK_SLOTS;
    int cnt = offlineSlotCount - startIdx;
    if (cnt > NVS_CHUNK_SLOTS) cnt = NVS_CHUNK_SLOTS;
    size_t byteLen = (size_t)cnt * sizeof(OfflineBellSlot);
    String key = "slots" + String(c);
    size_t written = preferences.putBytes(key.c_str(), &offlineSlots[startIdx], byteLen);
    if (written != byteLen) allOk = false;
  }
  int verifyCnt = preferences.getInt("slotCnt", -1);
  if (verifyCnt != offlineSlotCount) allOk = false;
  preferences.putBool("nvsOk", allOk);
  nvsVerified = allOk;
  return allOk;
}

void loadOfflineSlotsFromNvs() {
  offlineSlotCount = 0;
  int storedCnt = preferences.getInt("slotCnt", 0);
  if (storedCnt < 0) storedCnt = 0;
  if (storedCnt > MAX_OFFLINE_SLOTS) storedCnt = MAX_OFFLINE_SLOTS;
  int chunks = (storedCnt + NVS_CHUNK_SLOTS - 1) / NVS_CHUNK_SLOTS;
  bool readOk = (storedCnt == 0) ? true : preferences.getBool("nvsOk", false);
  for (int c = 0; c < chunks; c++) {
    int startIdx = c * NVS_CHUNK_SLOTS;
    int cnt = storedCnt - startIdx;
    if (cnt > NVS_CHUNK_SLOTS) cnt = NVS_CHUNK_SLOTS;
    size_t expectedBytes = (size_t)cnt * sizeof(OfflineBellSlot);
    String key = "slots" + String(c);
    size_t got = preferences.getBytes(key.c_str(), &offlineSlots[startIdx], expectedBytes);
    if (got != expectedBytes) {
      readOk = false;
      storedCnt = startIdx;
      break;
    }
  }
  offlineSlotCount = storedCnt;
  nvsVerified = readOk;
}

String buildSyncedSummaryFromSlots() {
  String summary = "";
  int limit = offlineSlotCount > 8 ? 8 : offlineSlotCount;
  for (int i = 0; i < limit; i++) {
    if (i > 0) summary += ", ";
    summary += sanitizeJsonText(String(offlineSlots[i].title)) + " (" + String(offlineSlots[i].time) + ")";
  }
  if (offlineSlotCount > 8) {
    summary += ", +" + String(offlineSlotCount - 8) + " more";
  }
  return offlineSlotCount == 0 ? String("None") : summary;
}

// Close persistent poll TLS socket before opening any secondary HTTPS client (single-TLS heap rule)
void closePollSocket() {
  pollHttp.end();
  lastPollUrl = "";
  lastTlsRefreshMs = 0;
}

void sendCommandAck(const String& cmdId) {
  if (WiFi.status() != WL_CONNECTED || chipIdHex.length() < 4 || cmdId.length() == 0) return;
  closePollSocket();
  HTTPClient ackCmdHttp;
  String devUrl = String(RTDB_URL) + "/esp32Bridge/devices/" + chipIdHex + ".json";
  ackCmdHttp.setConnectTimeout(HTTP_CONNECT_TIMEOUT_MS);
  ackCmdHttp.setTimeout(HTTP_TIMEOUT_MS);
  if (ackCmdHttp.begin(devUrl)) {
    ackCmdHttp.addHeader("Content-Type", "application/json");
    String payload = "{\\"lastAckCommandId\\":\\"" + sanitizeJsonText(cmdId) + "\\","
                   + "\\"lastAckAtMs\\":{\\".sv\\":\\"timestamp\\"},"
                   + "\\"lastSeenMs\\":{\\".sv\\":\\"timestamp\\"}}";
    int code = ackCmdHttp.PATCH(payload);
    ackCmdHttp.end();
    lastPresencePingMs = millis();
    Serial.println("[ACK] Command " + cmdId + " -> HTTP " + String(code));
  }
}

// Fast 0.9s presence ping reusing pollHttp's open keep-alive TLS socket (~90ms, zero heap spike)
void sendFastPresencePing() {
  if (WiFi.status() != WL_CONNECTED || chipIdHex.length() < 4 || consecutivePollFails >= 1) return;
  String devUrl = String(RTDB_URL) + "/esp32Bridge/devices/" + chipIdHex + ".json";
  pollHttp.setReuse(true);
  pollHttp.setConnectTimeout(HTTP_CONNECT_TIMEOUT_MS);
  pollHttp.setTimeout(HTTP_TIMEOUT_MS);
  if (pollHttp.begin(devUrl)) {
    pollHttp.addHeader("Content-Type", "application/json");
    int code = pollHttp.PATCH("{\\"lastSeenMs\\":{\\".sv\\":\\"timestamp\\"}}");
    if (code > 0) {
      pollHttp.getString();
    } else {
      closePollSocket();
    }
  } else {
    closePollSocket();
  }
}

void reportSyncedSchedulesToDashboard(int itemCount, const String& summaryText) {
  if (WiFi.status() != WL_CONNECTED || chipIdHex.length() < 4) return;
  closePollSocket();
  HTTPClient ackHttp;
  String devUrl = String(RTDB_URL) + "/esp32Bridge/devices/" + chipIdHex + ".json";
  ackHttp.setConnectTimeout(HTTP_CONNECT_TIMEOUT_MS);
  ackHttp.setTimeout(HTTP_TIMEOUT_MS);
  if (ackHttp.begin(devUrl)) {
    ackHttp.addHeader("Content-Type", "application/json");
    String clk = getCurrentClockStamp();
    String payload = "{\\"syncedActivityCount\\":" + String(itemCount) + ","
                   + "\\"syncedActivitiesSummary\\":\\"" + sanitizeJsonText(summaryText) + "\\","
                   + "\\"nvsSaved\\":" + String(nvsVerified ? "true" : "false") + ","
                   + "\\"espTimezoneOffsetMin\\":" + String(timezoneOffsetMin) + ","
                   + (clk.length() > 0 ? "\\"espClockStamp\\":\\"" + clk + "\\"," : "")
                   + "\\"lastScheduleSyncMs\\":{\\".sv\\":\\"timestamp\\"},"
                   + "\\"lastSeenMs\\":{\\".sv\\":\\"timestamp\\"}}";
    ackHttp.PATCH(payload);
    ackHttp.end();
    lastPresencePingMs = millis();
  }
}

// Checks dashboard Assign/Unassign/Pin changes & updates heartbeat every 45s
void syncDeviceHeartbeat() {
  if (WiFi.status() != WL_CONNECTED || consecutivePollFails >= 1) return;
  closePollSocket();

  HTTPClient hbHttp;
  String devUrl = String(RTDB_URL) + "/esp32Bridge/devices/" + chipIdHex + ".json";
  hbHttp.setConnectTimeout(HTTP_CONNECT_TIMEOUT_MS);
  hbHttp.setTimeout(HTTP_TIMEOUT_MS);

  if (hbHttp.begin(devUrl)) {
    int getCode = hbHttp.GET();
    if (getCode == HTTP_CODE_OK) {
      String body = hbHttp.getString();
      if (body != "null") {
        DynamicJsonDocument doc(1024);
        if (!deserializeJson(doc, body)) {
          bool manualUnassigned = doc["manualUnassigned"] | false;
          String assignedKey    = doc["schoolKey"] | "";
          String assignedName   = doc["schoolName"] | "";
          int serverPin         = doc["relayPin"] | activeRelayPin;
          if (serverPin != activeRelayPin) updateRelayPin(serverPin);

          if (manualUnassigned) {
            deviceAssigned = false;
            activeSchoolKey = "";
            stopBell();
          } else if (doc.containsKey("assigned") && !(doc["assigned"] | false)) {
            deviceAssigned = false;
            activeSchoolKey = "";
            stopBell();
          } else if (assignedKey.length() >= 2) {
            deviceAssigned = true;
            if (assignedKey != activeSchoolKey) {
              activeSchoolKey = assignedKey;
              lastPollMs = 0; // Immediately poll newly linked school feed
            }
            if (assignedName.length() > 0 && assignedName != lastLinkedSchool) {
              lastLinkedSchool = assignedName;
              Serial.println("Linked exclusively to school: " + assignedName);
            }
          }
        }
      }
    }
    hbHttp.end();
  }

  if (hbHttp.begin(devUrl)) {
    hbHttp.addHeader("Content-Type", "application/json");
    String reqKey = normalizeSchoolKey(String(SCHOOL_NAME));
    String clk = getCurrentClockStamp();
    String payload = "{\\"chipId\\":\\"" + chipIdHex + "\\","
                   + "\\"requestedSchoolName\\":\\"" + String(SCHOOL_NAME) + "\\","
                   + "\\"requestedSchoolKey\\":\\"" + reqKey + "\\","
                   + "\\"relayPin\\":" + String(activeRelayPin) + ","
                   + "\\"firmwareVersion\\":\\"" + String(FW_VERSION) + "\\","
                   + "\\"nvsSaved\\":" + String(nvsVerified ? "true" : "false") + ","
                   + "\\"syncedActivityCount\\":" + String(offlineSlotCount) + ","
                   + "\\"espTimezoneOffsetMin\\":" + String(timezoneOffsetMin) + ","
                   + (clk.length() > 0 ? "\\"espClockStamp\\":\\"" + clk + "\\"," : "")
                   + "\\"lastSeenMs\\":{\\".sv\\":\\"timestamp\\"}}";
    hbHttp.PATCH(payload);
    hbHttp.end();
  }

  if (activeSchoolKey.length() < 2 && strlen(SCHOOL_NAME) > 0 && deviceAssigned) {
    activeSchoolKey = normalizeSchoolKey(String(SCHOOL_NAME));
  }
}

void parseSchedulesIntoSlots(JsonArray items) {
  static const char* DAY_NAMES[7] = {"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"};
  offlineSlotCount = 0;
  for (JsonObject item : items) {
    if (offlineSlotCount >= MAX_OFFLINE_SLOTS) break;
    OfflineBellSlot& s = offlineSlots[offlineSlotCount];
    memset(&s, 0, sizeof(OfflineBellSlot));
    strlcpy(s.id, item["id"] | "sched", sizeof(s.id));
    strlcpy(s.title, item["title"] | "Activity", sizeof(s.title));
    strlcpy(s.time, item["time"] | "", sizeof(s.time));
    strlcpy(s.endTime, item["endTime"] | "", sizeof(s.endTime));
    strlcpy(s.profile, item["profile"] | "Studying", sizeof(s.profile));
    strlcpy(s.examDate, item["examDate"] | "", sizeof(s.examDate));
    s.durationSec = (int32_t)(item["durationSec"] | DEFAULT_DURATION_SEC);
    s.enabled     = (item["enabled"] | true) ? 1 : 0;
    s.dayMask     = 0;
    JsonArray days = item["days"].as<JsonArray>();
    for (JsonVariant d : days) {
      const char* dStr = d.as<const char*>();
      if (!dStr) continue;
      for (int i = 0; i < 7; i++) {
        if (strcmp(dStr, DAY_NAMES[i]) == 0) {
          s.dayMask |= (1 << i);
          break;
        }
      }
    }
    offlineSlotCount++;
  }
}

// Downloads & saves full school timetable directly to verified ESP32 Flash NVS/EEPROM
void syncOfflineScheduleCache() {
  if (WiFi.status() != WL_CONNECTED || !deviceAssigned || activeSchoolKey.length() < 2) return;
  closePollSocket();

  HTTPClient schedHttp;
  String schedUrl = String(RTDB_URL) + "/esp32Bridge/schools/" + activeSchoolKey + "/schedules.json";
  schedHttp.setConnectTimeout(HTTP_CONNECT_TIMEOUT_MS);
  schedHttp.setTimeout(HTTP_TIMEOUT_MS);

  if (schedHttp.begin(schedUrl)) {
    int code = schedHttp.GET();
    if (code == HTTP_CODE_OK) {
      String body = schedHttp.getString();
      if (body != "null" && body.length() > 10) {
        DynamicJsonDocument schedDoc(16384);
        if (!deserializeJson(schedDoc, body) && (schedDoc.containsKey("schedules") || schedDoc.containsKey("updatedAtMs"))) {
          bool autoEn   = schedDoc["autoRingEnabled"] | offlineAutoRing;
          int tzMin     = schedDoc["timezoneOffsetMinutes"] | timezoneOffsetMin;
          String prof   = schedDoc["activeProfile"] | cachedActiveProfile;
          double updTs  = schedDoc["updatedAtMs"] | 0.0;
          JsonArray items = schedDoc["schedules"].as<JsonArray>();
          int itemCount = items.isNull() ? 0 : (int)items.size();

          if (autoEn != offlineAutoRing) {
            offlineAutoRing = autoEn;
            preferences.putBool("autoRing", offlineAutoRing);
          }
          if (prof != cachedActiveProfile) {
            cachedActiveProfile = prof;
            preferences.putString("activeProf", cachedActiveProfile);
          }
          if (tzMin != timezoneOffsetMin) {
            timezoneOffsetMin = tzMin;
            preferences.putInt("tzOffset", timezoneOffsetMin);
            syncNtpClock(true);
          }

          bool tsChanged = (updTs > 0.0 && updTs != lastSyncedScheduleTs) || !nvsVerified;
          if (tsChanged || itemCount != offlineSlotCount) {
            if (!items.isNull()) {
              parseSchedulesIntoSlots(items);
            } else {
              offlineSlotCount = 0;
            }
            bool savedOk = saveOfflineSlotsToNvs();
            if (updTs > 0.0) {
              lastSyncedScheduleTs = updTs;
              preferences.putDouble("schedTs", updTs);
            }
            Serial.println("Schedule saved (" + String(offlineSlotCount) + " activities, EEPROM NVS=" + String(savedOk ? "VERIFIED" : "FAIL") + ").");
            printOfflineSlots();
          }

          if (tsChanged || lastSyncedScheduleTs == 0.0) {
            String summary = buildSyncedSummaryFromSlots();
            reportSyncedSchedulesToDashboard(offlineSlotCount, summary);
          }
          pendingScheduleSync = false;
        }
      }
    }
    schedHttp.end();
  }
}

void pollSchoolBell() {
  if (!deviceAssigned || activeSchoolKey.length() < 2) {
    stopBell();
    return;
  }
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  String url = String(RTDB_URL) + "/esp32Bridge/schools/" + activeSchoolKey + "/live.json";
  unsigned long nowPollMs = millis();
  // Proactively recycle HTTPS keep-alive every 45s BEFORE router NAT or Firebase closes the idle socket
  if (lastPollUrl != url || (lastTlsRefreshMs > 0 && nowPollMs - lastTlsRefreshMs >= TLS_REFRESH_INTERVAL_MS)) {
    pollHttp.end();
    lastPollUrl = url;
    lastTlsRefreshMs = nowPollMs;
  }
  if (lastTlsRefreshMs == 0) lastTlsRefreshMs = nowPollMs;
  pollHttp.setReuse(true);
  pollHttp.setConnectTimeout(HTTP_CONNECT_TIMEOUT_MS);
  pollHttp.setTimeout(HTTP_TIMEOUT_MS);

  if (!pollHttp.begin(url)) {
    consecutivePollFails++;
    pollHttp.end();
    return;
  }
  int httpCode = pollHttp.GET();

  if (httpCode == HTTP_CODE_OK) {
    lastSuccessfulPollMs = millis();
    consecutivePollFails = 0;

    String response = pollHttp.getString();
    if (response == "null") return;

    DynamicJsonDocument doc(3072);
    DeserializationError jsonErr = deserializeJson(doc, response);
    if (jsonErr) {
      Serial.println("Live JSON parse error: " + String(jsonErr.c_str()));
      return;
    }

    bool enabled        = doc["enabled"] | true;
    bool autoEn         = doc["autoRingEnabled"] | offlineAutoRing;
    int tzMin           = doc["timezoneOffsetMinutes"] | timezoneOffsetMin;
    String prof         = doc["activeProfile"] | cachedActiveProfile;
    double schedTs      = doc["schedulesUpdatedAtMs"] | 0.0;
    String linkedSchool = doc["schoolName"] | "";
    int serverPin       = doc["relayPin"] | activeRelayPin;

    if (enabled != relayGlobalEnabled) {
      relayGlobalEnabled = enabled;
      preferences.putBool("relayEn", relayGlobalEnabled);
    }
    if (autoEn != offlineAutoRing) {
      offlineAutoRing = autoEn;
      preferences.putBool("autoRing", offlineAutoRing);
    }
    if (prof != cachedActiveProfile) {
      cachedActiveProfile = prof;
      preferences.putString("activeProf", cachedActiveProfile);
    }
    if (tzMin != timezoneOffsetMin) {
      timezoneOffsetMin = tzMin;
      preferences.putInt("tzOffset", timezoneOffsetMin);
      syncNtpClock(true);
    }
    if (schedTs > 0.0 && schedTs != lastSyncedScheduleTs) {
      pendingScheduleSync = true;
    }

    if (!enabled) {
      stopBell();
      return;
    }
    if (linkedSchool.length() > 0 && linkedSchool != lastLinkedSchool) {
      lastLinkedSchool = linkedSchool;
      Serial.println("Linked exclusively to school: " + linkedSchool);
    }
    if (serverPin != activeRelayPin) updateRelayPin(serverPin);

    JsonObject cmd   = doc["command"];
    bool ringNow     = cmd["ringNow"] | false;
    String commandId = cmd["commandId"] | "";
    String trigType  = cmd["triggerType"] | "Automatic";
    int duration     = cmd["durationSec"] | DEFAULT_DURATION_SEC;

    if (ringNow && commandId.length() > 0 && !isDuplicateCommand(commandId)) {
      time_t nowEpoch = time(nullptr);
      bool isManualOrTest = (trigType == "Manual" || trigType == "Test");
      // Manual & Test commands execute immediately even during early boot before NTP replies
      if (!isManualOrTest && nowEpoch < 1700000000L && millis() < 12000) {
        return;
      }
      double cmdExpiryMs = cmd["expiresAtMs"] | 0.0;
      if (cmdExpiryMs < 1700000000000.0 && cmd.containsKey("triggeredAtMs")) {
        double trigMs = cmd["triggeredAtMs"] | 0.0;
        if (trigMs > 1700000000000.0) {
          cmdExpiryMs = trigMs + ((double)duration * 1000.0);
        }
      }
      if (nowEpoch >= 1700000000L && cmdExpiryMs > 1700000000000.0) {
        double nowEpochMs = (double)nowEpoch * 1000.0;
        double graceMs = isManualOrTest ? 45000.0 : 35000.0;
        if (nowEpochMs > (cmdExpiryMs + graceMs)) {
          saveCommandId(commandId);
          Serial.println("[PRE-FLIGHT] Skipped expired cloud command: " + commandId);
          return;
        }
      }
      startBell(commandId, duration);
      pendingAckCmdId = commandId;
      String curStamp = getCurrentClockStamp();
      if (curStamp.length() >= 16) lastOnlineTriggerMinute = curStamp;
    } else if (!ringNow && ringing && commandId.startsWith("stop-")) {
      stopBell();
    }
  } else {
    consecutivePollFails++;
    closePollSocket();
    if (consecutivePollFails == 1 || consecutivePollFails % 4 == 0) {
      Serial.print("HTTP poll retry (Code ");
      Serial.print(httpCode);
      if (consecutivePollFails >= OFFLINE_FAIL_THRESHOLD) {
        Serial.println(") - Autonomous EEPROM Failover armed");
      } else {
        Serial.println(")");
      }
    }
  }
}

// Pre-flight autonomous timetable engine: runs immediately offline AND backs up closed browsers online
void checkOfflineSchedule() {
  unsigned long nowMs = millis();
  if (nowMs - lastOfflineCheckMs < 400) return;
  lastOfflineCheckMs = nowMs;

  if (!deviceAssigned || activeSchoolKey.length() < 2) return;
  if (!relayGlobalEnabled || !offlineAutoRing || offlineSlotCount == 0) return;

  bool networkDown = (WiFi.status() != WL_CONNECTED)
                  || (consecutivePollFails >= 1)
                  || (lastSuccessfulPollMs == 0 && nowMs > 8000)
                  || (lastSuccessfulPollMs > 0 && nowMs - lastSuccessfulPollMs > 5000);

  time_t nowEpoch = time(nullptr);
  if (nowEpoch < 1700000000L) {
    if (networkDown && (!wasOfflineMode || nowMs - lastOfflineLogMs >= 15000)) {
      wasOfflineMode = true;
      lastOfflineLogMs = nowMs;
      Serial.println("[OFFLINE MODE] Waiting for first NTP clock sync (connect WiFi once while powered on).");
    }
    return;
  }

  struct tm t;
  localtime_r(&nowEpoch, &t);

  static const char* DAY_NAMES[7] = {"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"};
  String todayDay = String(DAY_NAMES[t.tm_wday]);

  char dateBuf[11];
  snprintf(dateBuf, sizeof(dateBuf), "%04d-%02d-%02d", t.tm_year + 1900, t.tm_mon + 1, t.tm_mday);

  char hmBuf[6];
  snprintf(hmBuf, sizeof(hmBuf), "%02d:%02d", t.tm_hour, t.tm_min);

  char hmsBuf[9];
  snprintf(hmsBuf, sizeof(hmsBuf), "%02d:%02d:%02d", t.tm_hour, t.tm_min, t.tm_sec);

  if (networkDown) {
    if (!wasOfflineMode || nowMs - lastOfflineLogMs >= 15000) {
      wasOfflineMode = true;
      lastOfflineLogMs = nowMs;
      Serial.println("[OFFLINE MODE] Armed | Clock: " + String(dateBuf) + " " + String(hmsBuf) + " (" + todayDay + ") | Profile: " + cachedActiveProfile + " | Slots: " + String(offlineSlotCount));
    }
  } else {
    wasOfflineMode = false;
  }

  // Only fire within the active minute window (0..45s); if online, give dashboard 0..5s priority first
  if (t.tm_sec > 45) return;
  if (!networkDown && t.tm_sec < 6) return;

  String curStamp = String(dateBuf) + " " + String(hmBuf);
  if (curStamp == lastOnlineTriggerMinute) return; // Already fired via cloud command this minute

  String activeProfile = cachedActiveProfile.length() > 0 ? cachedActiveProfile : String("Studying");

  for (int i = 0; i < offlineSlotCount; i++) {
    const OfflineBellSlot& s = offlineSlots[i];
    if (!s.enabled) continue;
    if (strcmp(s.profile, activeProfile.c_str()) != 0) continue;

    // Pre-flight date/day verification: expired exam dates are strictly ignored
    bool dayMatches = false;
    if (strlen(s.examDate) > 0) {
      dayMatches = (strcmp(s.examDate, dateBuf) == 0);
    } else {
      dayMatches = ((s.dayMask & (1 << t.tm_wday)) != 0);
    }
    if (!dayMatches) continue;

    const char* triggerKind = "";
    if (strcmp(s.time, hmBuf) == 0) {
      triggerKind = "start";
    } else if (strlen(s.endTime) == 5 && strcmp(s.endTime, s.time) != 0 && strcmp(s.endTime, hmBuf) == 0) {
      triggerKind = "end";
    }

    if (triggerKind[0] != '\\0') {
      String trigKey = String(dateBuf) + "-" + String(hmBuf) + "-" + String(s.id) + "-" + String(triggerKind);
      if (trigKey != lastOfflineTriggerKey) {
        lastOfflineTriggerKey = trigKey;
        String offCmd = String(networkDown ? "offline-" : "auto-esp-") + trigKey;
        Serial.println(String(networkDown ? "[OFFLINE EEPROM] " : "[AUTONOMOUS] ") + "Verified bell trigger -> " + String(s.title) + " at " + String(hmBuf) + " (" + String(triggerKind) + ")");
        startBell(offCmd, (int)s.durationSec);
        break;
      }
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("BellCraft Automatic School Bell - ESP32 Firmware V2.10 (0.9s Live Presence + Instant Command + Single-TLS)");
  initializeRelay();
#if MANUAL_BTN_PIN >= 0
  if (MANUAL_BTN_PIN != activeRelayPin) {
    pinMode(MANUAL_BTN_PIN, INPUT_PULLUP);
  }
#endif
  chipIdHex = getEsp32ChipId();
  Serial.println("Detected ESP32 Chip ID: " + chipIdHex);
  Serial.println("Configured School: " + String(SCHOOL_NAME));
  activeSchoolKey = normalizeSchoolKey(String(SCHOOL_NAME));
  if (preferences.begin("bellcraft", false)) {
    lastCommandId        = preferences.getString("lastCmd", "");
    cachedActiveProfile  = preferences.getString("activeProf", "Studying");
    offlineAutoRing      = preferences.getBool("autoRing", true);
    relayGlobalEnabled   = preferences.getBool("relayEn", true);
    timezoneOffsetMin    = preferences.getInt("tzOffset", timezoneOffsetMin);
    lastSyncedScheduleTs = preferences.getDouble("schedTs", 0.0);
    loadOfflineSlotsFromNvs();
    if (offlineSlotCount > 0) {
      Serial.println("Offline schedule loaded from Flash EEPROM/NVS (" + String(offlineSlotCount) + " slots, NVS=" + String(nvsVerified ? "VERIFIED" : "WARN") + ").");
      printOfflineSlots();
    }
  }
  connectWiFi();
}

void loop() {
  checkRingDuration();
  checkManualButton();
  checkOfflineSchedule();
  maintainWiFi();
  unsigned long nowMs = millis();
  if (WiFi.status() == WL_CONNECTED) {
    syncNtpClock(false);
    unsigned long pollInterval = (consecutivePollFails >= OFFLINE_FAIL_THRESHOLD)
      ? OFFLINE_POLL_RETRY_MS
      : (consecutivePollFails > 0 ? FAST_RETRY_INTERVAL_MS : POLL_INTERVAL_MS);
    bool ranHeavySyncThisPass = false;
    if (!firstPollAttempted || (nowMs - lastPollMs >= pollInterval)) {
      firstPollAttempted = true;
      lastPollMs = nowMs;
      pollSchoolBell();
      checkOfflineSchedule();
    }
    if (pendingAckCmdId.length() > 0 && !ringing && consecutivePollFails == 0) {
      String ackId = pendingAckCmdId;
      pendingAckCmdId = "";
      sendCommandAck(ackId);
      ranHeavySyncThisPass = true;
    }
    if (!ranHeavySyncThisPass && !ringing && consecutivePollFails == 0 && (lastHeartbeatMs == 0 || nowMs - lastHeartbeatMs >= HEARTBEAT_INTERVAL_MS)) {
      lastHeartbeatMs = nowMs;
      syncDeviceHeartbeat();
      lastPresencePingMs = millis();
      if (lastSyncedScheduleTs == 0.0 || !nvsVerified) {
        pendingScheduleSync = true;
      }
      ranHeavySyncThisPass = true;
    }
    if (!ranHeavySyncThisPass && !ringing && pendingScheduleSync && consecutivePollFails == 0 && (lastSchedSyncTryMs == 0 || nowMs - lastSchedSyncTryMs >= 5000)) {
      lastSchedSyncTryMs = nowMs;
      syncOfflineScheduleCache();
      lastPresencePingMs = millis();
      ranHeavySyncThisPass = true;
    }
    if (!ranHeavySyncThisPass && consecutivePollFails == 0 && (nowMs - lastPresencePingMs >= PRESENCE_PING_INTERVAL_MS)) {
      lastPresencePingMs = nowMs;
      sendFastPresencePing();
    }
  }
  checkRingDuration();
}`;
              return (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 text-slate-100 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-cyan-300 truncate">
                      Feed: {REALTIME_DB_URL}/esp32Bridge/schools/
                      {targetSchoolKeyPreview || '<SCHOOL_KEY>'}/live.json
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyValue('esp32-sketch', sketch)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white cursor-pointer shrink-0"
                    >
                      {copiedKeyLabel === 'esp32-sketch' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Sketch</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-4 text-[11px] font-mono leading-relaxed overflow-x-auto text-slate-200">
                    {sketch}
                  </pre>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
