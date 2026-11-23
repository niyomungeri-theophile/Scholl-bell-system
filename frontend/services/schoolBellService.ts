import { deleteApp, initializeApp } from 'firebase/app';
import {
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  getAuth,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
  verifyBeforeUpdateEmail,
  type User,
} from 'firebase/auth';
import { get, goOnline, limitToLast, onValue, push, query, ref, remove, set, update } from 'firebase/database';
import {
  auth,
  firebaseConfig,
  handleDatabaseError,
  OperationType,
  REALTIME_DB_URL,
  rtdb,
} from '../../database/firebase';
import {
  AnnouncementAudience,
  AnnouncementItem,
  AuthUser,
  BellSchedule,
  BellTone,
  CampusZone,
  ContactInquiry,
  DATE_PATTERN,
  Esp32Device,
  HardwareCommand,
  HardwareStatus,
  MAX_SCHOOL_NAME_LEN,
  MAX_TITLE_LEN,
  MAX_USERS_PER_SCHOOL,
  RingLog,
  ScheduleProfile,
  SchoolConfig,
  SchoolHardwareConfig,
  SchoolHardwareState,
  SchoolUserAccount,
  TIME_PATTERN,
  WEEKDAYS,
  Weekday,
} from '../types';

const COMPANY_ADMIN_EMAIL = 'niyomungeritheophile02@gmail.com';
const CACHE_PREFIX = 'bellcraft_cache_v1';

function safeStorageGet<T>(key: string): T | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(`${CACHE_PREFIX}:${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeStorageSet(key: string, value: unknown): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(`${CACHE_PREFIX}:${key}`, JSON.stringify(value));
  } catch {
    // Ignore quota/private-mode storage errors
  }
}

function safeStorageRemovePrefix(prefix: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const fullPrefix = `${CACHE_PREFIX}:${prefix}`;
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(fullPrefix)) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // Ignore storage errors
  }
}

export function getCachedAuthUser(uid: string): AuthUser | null {
  return safeStorageGet<AuthUser>(`auth:${uid}`);
}

export function getCachedSchoolsList(uid: string): SchoolConfig[] | null {
  const data = safeStorageGet<SchoolConfig[]>(`schools:${uid}`);
  return Array.isArray(data) ? data : null;
}

export function getCachedWorkspace(schoolId: string): SchoolWorkspaceData | null {
  const data = safeStorageGet<SchoolWorkspaceData>(`ws:${schoolId}`);
  return data && data.school ? data : null;
}

/**
 * Fast Firebase RTDB reader over HTTPS REST (bypasses cold 3-10s WebSocket handshake on initial load/wake),
 * falling back cleanly to the RTDB SDK if needed.
 */
async function fastRtdbGet<T = unknown>(
  path: string,
  options?: {
    shallow?: boolean;
    limitToLast?: number;
    publicRead?: boolean;
    timeoutMs?: number;
  }
): Promise<{ exists: boolean; val: T | null }> {
  const cleanPath = path.replace(/^\/+|\/+$/g, '');
  const timeoutMs = options?.timeoutMs ?? 4000;
  const current = auth.currentUser;

  const buildUrl = (token: string | null): string => {
    const params = new URLSearchParams();
    if (options?.shallow) {
      params.set('shallow', 'true');
    } else if (typeof options?.limitToLast === 'number') {
      params.set('orderBy', '"$key"');
      params.set('limitToLast', String(options.limitToLast));
    }
    if (token) {
      params.set('auth', token);
    }
    const qs = params.toString();
    return `${REALTIME_DB_URL}/${cleanPath}.json${qs ? `?${qs}` : ''}`;
  };

  if (current || options?.publicRead) {
    try {
      let token = current ? await current.getIdToken(false) : null;
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? window.setTimeout(() => controller.abort(), timeoutMs) : null;
      let res = await fetch(buildUrl(token), {
        cache: 'no-store',
        ...(controller ? { signal: controller.signal } : {}),
      });
      if (timer) window.clearTimeout(timer);

      if (res.status === 401 && current) {
        token = await current.getIdToken(true);
        const retryController = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const retryTimer = retryController
          ? window.setTimeout(() => retryController.abort(), timeoutMs)
          : null;
        res = await fetch(buildUrl(token), {
          cache: 'no-store',
          ...(retryController ? { signal: retryController.signal } : {}),
        });
        if (retryTimer) window.clearTimeout(retryTimer);
      }

      if (res.ok) {
        const data = (await res.json()) as T | null;
        return {
          exists: data !== null && data !== undefined,
          val: data ?? null,
        };
      }
      if (res.status === 401 || res.status === 403) {
        throw new Error('Permission denied');
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'Permission denied') {
        throw err;
      }
      // Fall back to Firebase RTDB SDK below
    }
  }

  const dbQuery =
    typeof options?.limitToLast === 'number'
      ? query(ref(rtdb, cleanPath), limitToLast(options.limitToLast))
      : ref(rtdb, cleanPath);
  const snap = await get(dbQuery);
  return {
    exists: snap.exists(),
    val: snap.exists() ? (snap.val() as T) : null,
  };
}

function createDeviceId(schoolId: string): string {
  const clean = schoolId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const suffix = (clean.slice(-6) || 'SCHOOL').padStart(6, '0');
  return `HW-${suffix}`;
}

function createDeviceKey(): string {
  return `bc_hw_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
}

function normalizeHardwareState(schoolId: string, raw: unknown): SchoolHardwareState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const hw = raw as Record<string, unknown>;
  const cfgRaw = (hw.config && typeof hw.config === 'object' ? hw.config : {}) as Record<string, unknown>;
  const cmdRaw = (hw.command && typeof hw.command === 'object' ? hw.command : null) as Record<
    string,
    unknown
  > | null;
  const stRaw = (hw.status && typeof hw.status === 'object' ? hw.status : {}) as Record<
    string,
    unknown
  >;

  const deviceKey = typeof cfgRaw.deviceKey === 'string' ? cfgRaw.deviceKey.trim() : '';
  if (!deviceKey) return undefined;

  const config: SchoolHardwareConfig = {
    deviceId: clampString(cfgRaw.deviceId || createDeviceId(schoolId), 40) || createDeviceId(schoolId),
    deviceKey,
    enabled: Boolean(cfgRaw.enabled ?? true),
    relayPin: Math.max(0, Math.min(48, Math.round(Number(cfgRaw.relayPin ?? 2)))),
    defaultDurationSec: Math.max(1, Math.min(60, Math.round(Number(cfgRaw.defaultDurationSec ?? 5)))),
    timezoneOffsetMinutes: Number.isFinite(Number(cfgRaw.timezoneOffsetMinutes))
      ? Number(cfgRaw.timezoneOffsetMinutes)
      : 120,
    updatedAtMs: Number(cfgRaw.updatedAtMs ?? Date.now()),
  };

  const command: HardwareCommand | null = cmdRaw
    ? {
        commandId: String(cmdRaw.commandId || ''),
        ringNow: Boolean(cmdRaw.ringNow),
        title: String(cmdRaw.title || 'School Bell'),
        tone: normalizeTone(cmdRaw.tone, 'Studying'),
        durationSec: Math.max(0, Math.min(60, Number(cmdRaw.durationSec ?? 5))),
        triggerType:
          cmdRaw.triggerType === 'Manual' || cmdRaw.triggerType === 'Test'
            ? cmdRaw.triggerType
            : 'Automatic',
        triggeredAtMs: Number(cmdRaw.triggeredAtMs ?? 0),
        expiresAtMs: Number(cmdRaw.expiresAtMs ?? 0),
      }
    : null;

  const lastHeartbeatMs =
    typeof stRaw.lastHeartbeatMs === 'number' ? stRaw.lastHeartbeatMs : null;
  const status: HardwareStatus = {
    online: Boolean(lastHeartbeatMs && Date.now() - lastHeartbeatMs < 120_000),
    lastHeartbeatMs,
    relayState: stRaw.relayState === 'RINGING' ? 'RINGING' : 'IDLE',
    ipAddress: typeof stRaw.ipAddress === 'string' ? stRaw.ipAddress : undefined,
    firmwareVersion: typeof stRaw.firmwareVersion === 'string' ? stRaw.firmwareVersion : undefined,
    lastAckCommandId:
      typeof stRaw.lastAckCommandId === 'string' ? stRaw.lastAckCommandId : undefined,
    lastAckAtMs: typeof stRaw.lastAckAtMs === 'number' ? stRaw.lastAckAtMs : null,
  };

  return {
    config,
    command,
    status,
    lastSyncedAtMs: typeof hw.lastSyncedAtMs === 'number' ? hw.lastSyncedAtMs : undefined,
    ...(typeof hw.connectedChipId === 'string' && hw.connectedChipId
      ? { connectedChipId: hw.connectedChipId }
      : {}),
    ...(typeof hw.connectedSerial === 'string' && hw.connectedSerial
      ? { connectedSerial: hw.connectedSerial }
      : {}),
  };
}

function clampString(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function normalizeDays(raw: unknown): Weekday[] {
  if (!Array.isArray(raw)) return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const filtered = raw.filter(
    (d): d is Weekday => typeof d === 'string' && WEEKDAYS.includes(d as Weekday)
  );
  return filtered.length > 0 ? filtered.slice(0, 7) : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
}

function normalizeTone(tone: unknown, profile: ScheduleProfile): BellTone {
  if (
    tone === 'brass-bell' ||
    tone === 'westminster-chime' ||
    tone === 'gentle-tone' ||
    tone === 'emergency-alert'
  ) {
    return tone;
  }
  return profile === 'Exams' ? 'gentle-tone' : 'brass-bell';
}

function createDocId(prefix: string): string {
  const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  return `${prefix}-${rand}`;
}

async function waitForFirebaseAuth(): Promise<User | null> {
  if (auth.currentUser) return auth.currentUser;
  await auth.authStateReady();
  return auth.currentUser;
}

async function requireAuthenticatedUser(): Promise<User> {
  await auth.authStateReady();
  const current = auth.currentUser;
  if (!current) {
    throw new Error('Please sign in with your assigned credentials.');
  }
  return current;
}

function isFirebaseAdmin(firebaseUser: User | null): boolean {
  return Boolean(firebaseUser?.email && firebaseUser.email.toLowerCase() === COMPANY_ADMIN_EMAIL);
}

async function resolveAssignedUserProfile(firebaseUser: User): Promise<AuthUser | null> {
  const uid = firebaseUser.uid;
  const userPath = `users/${uid}`;
  const now = Date.now();

  if (isFirebaseAdmin(firebaseUser)) {
    const displayName =
      clampString(firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Company Admin', 120) ||
      'Company Admin';
    const email = clampString(firebaseUser.email || '', 200);
    void (async () => {
      try {
        const userSnap = await fastRtdbGet<Record<string, unknown>>(userPath);
        if (!userSnap.exists) {
          await set(ref(rtdb, userPath), {
            uid,
            displayName,
            email,
            role: 'company_admin',
            createdAtMs: now,
            updatedAtMs: now,
          });
        } else {
          await update(ref(rtdb, userPath), {
            displayName,
            email,
            updatedAtMs: now,
          });
        }
      } catch {
        // Allow admin Auth session even if RTDB rules have not been updated yet
      }
    })();
    const adminUser: AuthUser = {
      id: uid,
      username: displayName,
      role: 'company_admin',
      schoolId: null,
    };
    safeStorageSet(`auth:${uid}`, adminUser);
    return adminUser;
  }

  try {
    const userSnap = await fastRtdbGet<Record<string, unknown>>(userPath);
    if (!userSnap.exists || !userSnap.val) {
      return null;
    }
    const d = userSnap.val;
    const schoolId = typeof d.schoolId === 'string' && d.schoolId.trim() ? d.schoolId.trim() : null;
    if (!schoolId) {
      return null;
    }
    const displayName =
      clampString(d.displayName || firebaseUser.displayName || firebaseUser.email?.split('@')[0], 120) ||
      'School Staff';
    const resolved: AuthUser = {
      id: uid,
      username: displayName,
      role: 'school_user',
      schoolId,
    };
    safeStorageSet(`auth:${uid}`, resolved);
    return resolved;
  } catch (error) {
    handleDatabaseError(error, OperationType.GET, userPath);
  }
}

function formatFirebaseAuthError(error: unknown): Error {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';

  switch (code) {
    case 'auth/operation-not-allowed':
    case 'auth/admin-restricted-operation':
      return new Error(
        'Email/Password sign-in is not enabled yet in Firebase Console. Open Firebase Console -> Authentication -> Sign-in method -> Email/Password and click Enable.'
      );
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return new Error('Invalid email or password. Use the credentials issued by BellCraft Company.');
    case 'auth/email-already-in-use':
      return new Error('This email address is already registered in Firebase Authentication.');
    case 'auth/weak-password':
      return new Error('Password must be at least 6 characters.');
    case 'auth/invalid-email':
      return new Error('Please enter a valid email address.');
    case 'auth/expired-action-code':
    case 'auth/invalid-action-code':
      return new Error(
        'This reset link has expired or was already consumed. Create or reset the user directly in Firebase Console -> Authentication -> Users -> Add user.'
      );
    case 'auth/too-many-requests':
      return new Error('Too many failed attempts. Please wait a moment and try again.');
    default:
      return error instanceof Error ? error : new Error('Authentication failed.');
  }
}

export async function loginWithEmailPassword(email: string, password: string): Promise<AuthUser> {
  const cleanEmail = clampString(email, 200);
  const cleanPassword = password;
  if (!cleanEmail || !cleanPassword) {
    throw new Error('Please enter both email and password.');
  }
  try {
    const credential = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
    const assignedUser = await resolveAssignedUserProfile(credential.user);
    if (!assignedUser) {
      await signOut(auth);
      throw new Error(
        'This account is not assigned to any school by BellCraft Company. Contact your administrator.'
      );
    }
    return assignedUser;
  } catch (error) {
    throw formatFirebaseAuthError(error);
  }
}

export async function sendPasswordReset(email: string): Promise<void> {
  const cleanEmail = clampString(email, 200).toLowerCase();
  if (!cleanEmail) {
    throw new Error('Enter your email address.');
  }
  if (cleanEmail !== COMPANY_ADMIN_EMAIL) {
    throw new Error(
      'Ask Admin for supporting it. School accounts cannot use Forgot Password — contact BellCraft Company Admin.'
    );
  }
  try {
    await sendPasswordResetEmail(auth, cleanEmail);
  } catch (error) {
    throw formatFirebaseAuthError(error);
  }
}

export async function sendSchoolUserPasswordReset(email: string): Promise<void> {
  const current = await requireAuthenticatedUser();
  if (!isFirebaseAdmin(current)) {
    throw new Error('Ask Admin for supporting it. Only BellCraft Company Admin can reset school user passwords.');
  }
  const cleanEmail = clampString(email, 200).toLowerCase();
  if (!cleanEmail) {
    throw new Error('School user has no email address assigned.');
  }
  try {
    await sendPasswordResetEmail(auth, cleanEmail);
  } catch (error) {
    throw formatFirebaseAuthError(error);
  }
}

export async function confirmPasswordResetWithLink(
  linkOrCode: string,
  newPassword: string
): Promise<void> {
  const raw = linkOrCode.trim();
  if (!raw) {
    throw new Error('Paste the reset link or oobCode from your email.');
  }
  let oobCode = raw;
  if (raw.includes('oobCode=')) {
    try {
      const parsed = new URL(raw.startsWith('http') ? raw : `https://example.com/?${raw}`);
      oobCode = parsed.searchParams.get('oobCode') || raw;
    } catch {
      const match = raw.match(/oobCode=([^&]+)/);
      if (match?.[1]) {
        oobCode = decodeURIComponent(match[1]);
      }
    }
  }
  if (newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters.');
  }
  try {
    await confirmPasswordReset(auth, oobCode.trim(), newPassword);
  } catch (error) {
    throw formatFirebaseAuthError(error);
  }
}

export async function sendAdminVerificationEmail(): Promise<void> {
  const current = await requireAuthenticatedUser();
  try {
    await sendEmailVerification(current);
  } catch (error) {
    throw formatFirebaseAuthError(error);
  }
}

export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const current = await requireAuthenticatedUser();
  if (!isFirebaseAdmin(current)) {
    throw new Error(
      'Ask Admin for supporting it. Only BellCraft Company Admin can change passwords directly.'
    );
  }
  if (!current.email) {
    throw new Error('No email address found for this account.');
  }
  if (newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters.');
  }
  try {
    const credential = EmailAuthProvider.credential(current.email, currentPassword);
    await reauthenticateWithCredential(current, credential);
    await updatePassword(current, newPassword);
  } catch (error) {
    throw formatFirebaseAuthError(error);
  }
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const firebaseUser = await waitForFirebaseAuth();
  if (!firebaseUser) return null;

  const cached = getCachedAuthUser(firebaseUser.uid);
  if (cached && cached.id === firebaseUser.uid) {
    // Revalidate assignment asynchronously without blocking app boot
    void resolveAssignedUserProfile(firebaseUser)
      .then((fresh) => {
        if (!fresh) {
          safeStorageRemovePrefix(`auth:${firebaseUser.uid}`);
          void signOut(auth).catch(() => {});
        }
      })
      .catch(() => {});
    return cached;
  }

  try {
    const assignedUser = await resolveAssignedUserProfile(firebaseUser);
    if (!assignedUser) {
      await signOut(auth);
      return null;
    }
    return assignedUser;
  } catch {
    return null;
  }
}

export async function logoutSession(): Promise<void> {
  safeStorageRemovePrefix('');
  try {
    if (auth.currentUser) {
      await signOut(auth);
    }
  } catch {
    // Ignore Firebase signOut errors
  }
}

export async function initializeRealtimeDatabaseTables(): Promise<{
  schoolCount: number;
  databaseUrl: string;
}> {
  const current = await requireAuthenticatedUser();
  await resolveAssignedUserProfile(current);
  const schools = await listSchools();
  return {
    schoolCount: schools.length,
    databaseUrl: REALTIME_DB_URL,
  };
}

export async function listSchools(): Promise<SchoolConfig[]> {
  const current = await requireAuthenticatedUser();
  const uid = current.uid;
  const isAdmin = isFirebaseAdmin(current);
  const assignedProfile = isAdmin
    ? null
    : getCachedAuthUser(uid) ?? (await resolveAssignedUserProfile(current));
  const assignedSchoolId = assignedProfile?.schoolId || null;
  const path = isAdmin ? 'schools' : assignedSchoolId ? `schools/${assignedSchoolId}` : `users/${uid}`;

  try {
    const rawMap: Record<string, Record<string, unknown>> = {};
    if (isAdmin) {
      const snap = await fastRtdbGet<Record<string, Record<string, unknown>>>('schools');
      if (snap.exists && snap.val) {
        Object.assign(rawMap, snap.val);
      }
    } else if (assignedSchoolId) {
      const snap = await fastRtdbGet<Record<string, unknown>>(`schools/${assignedSchoolId}`);
      if (snap.exists && snap.val) {
        rawMap[assignedSchoolId] = snap.val;
      }
    }

    const schools = await Promise.all(
      Object.entries(rawMap)
        .filter(([, d]) => Boolean(d))
        .map(async ([schoolId, d]): Promise<SchoolConfig> => {
          let scheduleCount = 0;
          let userCount = 0;
          let primaryEmail: string | undefined;
          try {
            const [schSnap, staffSnap] = await Promise.all([
              fastRtdbGet<Record<string, unknown>>(`schedules/${schoolId}`, { shallow: true }),
              isAdmin
                ? fastRtdbGet<Record<string, { email?: unknown }>>(`schoolUsers/${schoolId}`)
                : Promise.resolve(null),
            ]);
            if (schSnap.exists && schSnap.val) {
              scheduleCount = Object.keys(schSnap.val).length;
            }
            if (staffSnap && staffSnap.exists && staffSnap.val) {
              const staffEntries = Object.values(staffSnap.val);
              userCount = staffEntries.length;
              const match = staffEntries.find(
                (u) => typeof u?.email === 'string' && u.email.trim().length > 0
              );
              if (match && typeof match.email === 'string') {
                primaryEmail = match.email.trim();
              }
            }
          } catch {
            // Counts are optional metadata
          }

          return {
            id: schoolId,
            ownerId: String(d.ownerId || uid),
            schoolName: String(d.schoolName || ''),
            campusLocation: String(d.campusLocation || ''),
            activeProfile: d.activeProfile === 'Exams' ? 'Exams' : 'Studying',
            autoRingEnabled: Boolean(d.autoRingEnabled ?? true),
            masterVolume: Number(d.masterVolume ?? 85),
            scheduleCount,
            userCount,
            ...(primaryEmail ? { primaryEmail } : {}),
            hardware: normalizeHardwareState(schoolId, d.hardware),
          };
        })
    );

    safeStorageSet(`schools:${uid}`, schools);
    return schools;
  } catch (error) {
    if (!auth.currentUser) return [];
    handleDatabaseError(error, OperationType.LIST, path);
  }
}

export async function createSchool(
  schoolName: string,
  campusLocation: string
): Promise<SchoolConfig> {
  const current = await requireAuthenticatedUser();
  const uid = current.uid;
  const cleanName = clampString(schoolName, MAX_SCHOOL_NAME_LEN);
  const cleanLocation = clampString(campusLocation, MAX_SCHOOL_NAME_LEN) || 'Main Campus';
  if (cleanName.length < 2) {
    throw new Error('School name must be at least 2 characters.');
  }

  const schoolId = isFirebaseAdmin(current) ? createDocId('school') : uid;
  const path = `schools/${schoolId}`;
  const now = Date.now();
  const initialHardwareConfig: SchoolHardwareConfig = {
    deviceId: createDeviceId(schoolId),
    deviceKey: createDeviceKey(),
    enabled: true,
    relayPin: 2,
    defaultDurationSec: 5,
    timezoneOffsetMinutes: 120,
    updatedAtMs: now,
  };

  try {
    await set(ref(rtdb, path), {
      id: schoolId,
      ownerId: uid,
      schoolName: cleanName,
      campusLocation: cleanLocation.length >= 2 ? cleanLocation : 'Main Campus',
      activeProfile: 'Studying',
      autoRingEnabled: true,
      masterVolume: 85,
      hardware: {
        config: initialHardwareConfig,
        status: {
          relayState: 'IDLE',
        },
        lastSyncedAtMs: now,
      },
      createdAtMs: now,
      updatedAtMs: now,
    });

    return {
      id: schoolId,
      ownerId: uid,
      schoolName: cleanName,
      campusLocation: cleanLocation.length >= 2 ? cleanLocation : 'Main Campus',
      activeProfile: 'Studying',
      autoRingEnabled: true,
      masterVolume: 85,
      scheduleCount: 0,
      userCount: 0,
      hardware: {
        config: initialHardwareConfig,
        command: null,
        status: { online: false, lastHeartbeatMs: null, relayState: 'IDLE' },
        lastSyncedAtMs: now,
      },
    };
  } catch (error) {
    handleDatabaseError(error, OperationType.CREATE, path);
  }
}

export async function deleteSchool(schoolId: string): Promise<void> {
  await requireAuthenticatedUser();
  const path = `schools/${schoolId}`;
  try {
    await Promise.all([
      remove(ref(rtdb, `schedules/${schoolId}`)),
      remove(ref(rtdb, `zones/${schoolId}`)),
      remove(ref(rtdb, `logs/${schoolId}`)),
      remove(ref(rtdb, `schoolUsers/${schoolId}`)),
      remove(ref(rtdb, path)),
    ]);
  } catch (error) {
    handleDatabaseError(error, OperationType.DELETE, path);
  }
}

export interface SchoolWorkspaceData {
  school: SchoolConfig | null;
  schedules: BellSchedule[];
  zones: CampusZone[];
  logs: RingLog[];
  users: SchoolUserAccount[];
}

export async function fetchSchoolWorkspace(schoolId: string): Promise<SchoolWorkspaceData> {
  const current = await requireAuthenticatedUser();
  const uid = current.uid;
  const resolvedSchoolId = schoolId || uid;
  const schoolPath = `schools/${resolvedSchoolId}`;
  const schedulesPath = `schedules/${resolvedSchoolId}`;
  const logsPath = `logs/${resolvedSchoolId}`;
  const staffPath = `schoolUsers/${resolvedSchoolId}`;

  try {
    const [schoolSnap, schedulesSnap, logsSnap, staffSnap] = await Promise.all([
      fastRtdbGet<Record<string, unknown>>(schoolPath),
      fastRtdbGet<Record<string, Record<string, unknown>>>(schedulesPath),
      fastRtdbGet<Record<string, Record<string, unknown>>>(logsPath, { limitToLast: 5 }),
      isFirebaseAdmin(current)
        ? fastRtdbGet<Record<string, Record<string, unknown>>>(staffPath)
        : Promise.resolve(null),
    ]);

    if (!schoolSnap.exists || !schoolSnap.val) {
      return {
        school: null,
        schedules: [],
        zones: [],
        logs: [],
        users: [],
      };
    }

    const sd = schoolSnap.val;
    const school: SchoolConfig = {
      id: resolvedSchoolId,
      ownerId: String(sd.ownerId || uid),
      schoolName: String(sd.schoolName || ''),
      campusLocation: String(sd.campusLocation || ''),
      activeProfile: sd.activeProfile === 'Exams' ? 'Exams' : 'Studying',
      autoRingEnabled: Boolean(sd.autoRingEnabled ?? true),
      masterVolume: Number(sd.masterVolume ?? 85),
      hardware: normalizeHardwareState(resolvedSchoolId, sd.hardware),
    };

    let schedules: BellSchedule[] = [];
    if (schedulesSnap.exists && schedulesSnap.val) {
      const val = schedulesSnap.val;
      schedules = Object.entries(val)
        .filter(([, d]) => Boolean(d))
        .map(([id, d]): BellSchedule => {
          const profile: ScheduleProfile = d.profile === 'Exams' ? 'Exams' : 'Studying';
          return {
            id,
            ownerId: String(d.ownerId || uid),
            title: String(d.title || ''),
            time: String(d.time || '08:00'),
            endTime: String(d.endTime || d.time || '08:00'),
            profile,
            zone: String(d.zone || 'All Campus'),
            tone: normalizeTone(d.tone, profile),
            durationSec: Number(d.durationSec ?? 5),
            days: normalizeDays(d.days),
            examDate: typeof d.examDate === 'string' ? d.examDate : '',
            teacherName: typeof d.teacherName === 'string' ? d.teacherName : '',
            enabled: Boolean(d.enabled ?? true),
          };
        })
        .sort((a, b) => a.time.localeCompare(b.time));
    }

    let logs: RingLog[] = [];
    if (logsSnap.exists && logsSnap.val) {
      const val = logsSnap.val;
      logs = Object.entries(val)
        .filter(([, d]) => Boolean(d))
        .map(([id, d]): RingLog => ({
          id,
          ownerId: String(d.ownerId || uid),
          title: String(d.title || 'School Bell'),
          zone: String(d.zone || 'All Campus'),
          tone: normalizeTone(d.tone, 'Studying'),
          triggerType: d.triggerType === 'Automatic' ? 'Automatic' : 'Manual',
          triggeredAtMs: Number(d.triggeredAtMs ?? Date.now()),
        }))
        .sort((a, b) => b.triggeredAtMs - a.triggeredAtMs);
    }

    let users: SchoolUserAccount[] = [];
    if (staffSnap && staffSnap.exists && staffSnap.val) {
      const val = staffSnap.val;
      users = Object.entries(val)
        .filter(([, d]) => Boolean(d))
        .map(([id, d]): SchoolUserAccount => ({
          id,
          username: String(d.username || ''),
          email: typeof d.email === 'string' ? d.email : undefined,
          role: 'school_user',
          schoolId: resolvedSchoolId,
          createdAtMs: Number(d.createdAtMs ?? Date.now()),
        }));
    }

    const result: SchoolWorkspaceData = {
      school,
      schedules,
      zones: [],
      logs,
      users,
    };
    safeStorageSet(`ws:${resolvedSchoolId}`, result);
    schoolMetaCache.set(resolvedSchoolId, {
      id: resolvedSchoolId,
      schoolName: school.schoolName,
      campusLocation: school.campusLocation,
      primaryEmail: school.primaryEmail ?? null,
    });
    return result;
  } catch (error) {
    if (!auth.currentUser) {
      throw new Error('Session signed out. Please sign in again.');
    }
    return handleDatabaseError(error, OperationType.GET, schoolPath);
  }
}

export async function updateSchoolSettings(
  schoolId: string,
  patch: Partial<
    Pick<
      SchoolConfig,
      'schoolName' | 'campusLocation' | 'activeProfile' | 'autoRingEnabled' | 'masterVolume'
    >
  >
): Promise<SchoolConfig> {
  const current = await requireAuthenticatedUser();
  const path = `schools/${schoolId}`;
  const updatePayload: Record<string, unknown> = {
    updatedAtMs: Date.now(),
  };
  if (patch.schoolName !== undefined) {
    const name = clampString(patch.schoolName, MAX_SCHOOL_NAME_LEN);
    if (name.length < 2) throw new Error('School name must be at least 2 characters.');
    updatePayload.schoolName = name;
  }
  if (patch.campusLocation !== undefined) {
    const loc = clampString(patch.campusLocation, MAX_SCHOOL_NAME_LEN);
    if (loc.length < 2) throw new Error('Campus location must be at least 2 characters.');
    updatePayload.campusLocation = loc;
  }
  if (patch.activeProfile !== undefined) {
    updatePayload.activeProfile = patch.activeProfile === 'Exams' ? 'Exams' : 'Studying';
  }
  if (patch.autoRingEnabled !== undefined) {
    updatePayload.autoRingEnabled = Boolean(patch.autoRingEnabled);
  }
  if (patch.masterVolume !== undefined) {
    const vol = Number(patch.masterVolume);
    if (!Number.isNaN(vol)) {
      updatePayload.masterVolume = Math.min(100, Math.max(0, Math.round(vol)));
    }
  }

  try {
    try {
      goOnline(rtdb);
    } catch {
      // Ignore if already online
    }
    await update(ref(rtdb, path), updatePayload);
    const updated = await get(ref(rtdb, path));
    const d = (updated.val() || {}) as Record<string, unknown>;
    return {
      id: schoolId,
      ownerId: String(d.ownerId || current.uid),
      schoolName: String(d.schoolName || ''),
      campusLocation: String(d.campusLocation || ''),
      activeProfile: d.activeProfile === 'Exams' ? 'Exams' : 'Studying',
      autoRingEnabled: Boolean(d.autoRingEnabled ?? true),
      masterVolume: Number(d.masterVolume ?? 85),
      hardware: normalizeHardwareState(schoolId, d.hardware),
    };
  } catch (error) {
    handleDatabaseError(error, OperationType.UPDATE, path);
  }
}

export async function createSchoolUser(
  schoolId: string,
  username: string,
  email: string,
  password: string,
  options?: { allowExtra?: boolean }
): Promise<SchoolUserAccount> {
  const current = await requireAuthenticatedUser();
  if (!isFirebaseAdmin(current)) {
    throw new Error('Only BellCraft Company administrators can create school accounts.');
  }
  const uid = current.uid;
  const cleanUsername = clampString(username, 50);
  const cleanEmail = clampString(email, 200).toLowerCase();
  const cleanPassword = password;
  if (cleanUsername.length < 2) {
    throw new Error('Staff name must be at least 2 characters.');
  }
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Please enter a valid login email for this school user.');
  }
  if (cleanPassword.length < 6) {
    throw new Error('Assigned password must be at least 6 characters.');
  }

  const colPath = `schoolUsers/${schoolId}`;
  const secondaryAppName = `staff-provision-${Date.now()}`;
  let secondaryApp: ReturnType<typeof initializeApp> | null = null;

  try {
    const existingSnap = await get(ref(rtdb, colPath));
    const existingMap = existingSnap.exists()
      ? (existingSnap.val() as Record<string, { username?: string; email?: string }>)
      : {};
    const existingEntries = Object.values(existingMap);
    if (!options?.allowExtra && existingEntries.length >= MAX_USERS_PER_SCHOOL) {
      throw new Error(
        `Standard limit of ${MAX_USERS_PER_SCHOOL} user accounts reached. Use "Add Additional User" to assign another account.`
      );
    }
    const duplicate = existingEntries.some(
      (u) =>
        String(u.username || '').toLowerCase() === cleanUsername.toLowerCase() ||
        (u.email && String(u.email).toLowerCase() === cleanEmail)
    );
    if (duplicate) {
      throw new Error(`Name or email "${cleanEmail}" is already assigned to this school.`);
    }

    secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);
    const credential = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, cleanPassword);
    await updateProfile(credential.user, { displayName: cleanUsername });
    const staffUid = credential.user.uid;
    await signOut(secondaryAuth);

    const now = Date.now();
    await Promise.all([
      set(ref(rtdb, `users/${staffUid}`), {
        uid: staffUid,
        displayName: cleanUsername,
        email: cleanEmail,
        role: 'school_user',
        schoolId,
        createdAtMs: now,
        updatedAtMs: now,
      }),
      set(ref(rtdb, `schoolUsers/${schoolId}/${staffUid}`), {
        id: staffUid,
        ownerId: uid,
        schoolId,
        username: cleanUsername,
        email: cleanEmail,
        role: 'school_user',
        createdAtMs: now,
        updatedAtMs: now,
      }),
    ]);

    return {
      id: staffUid,
      username: cleanUsername,
      email: cleanEmail,
      role: 'school_user',
      schoolId,
      createdAtMs: now,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('Maximum') ||
        error.message.includes('Standard limit') ||
        error.message.includes('already'))
    ) {
      throw error;
    }
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      String((error as { code?: unknown }).code || '').startsWith('auth/')
    ) {
      throw formatFirebaseAuthError(error);
    }
    return handleDatabaseError(error, OperationType.CREATE, colPath);
  } finally {
    if (secondaryApp) {
      await deleteApp(secondaryApp).catch(() => {});
    }
  }
}

export async function updateSchoolUser(
  schoolId: string,
  userId: string,
  patch: {
    username?: string;
    email?: string;
    currentPassword?: string;
    newPassword?: string;
  }
): Promise<SchoolUserAccount> {
  const current = await requireAuthenticatedUser();
  if (!isFirebaseAdmin(current)) {
    throw new Error('Only BellCraft Company administrators can update school credentials.');
  }

  const path = `schoolUsers/${schoolId}/${userId}`;
  const now = Date.now();
  const existingSnap = await get(ref(rtdb, path));
  if (!existingSnap.exists()) {
    throw new Error('School user account not found.');
  }
  const existing = existingSnap.val() as Record<string, unknown>;
  const oldUsername = String(existing.username || '').trim();
  const oldEmail = typeof existing.email === 'string' ? existing.email.trim().toLowerCase() : '';
  const createdAtMs = Number(existing.createdAtMs ?? now);

  const cleanUsername =
    patch.username !== undefined ? clampString(patch.username, 50) : oldUsername;
  if (cleanUsername.length < 2) {
    throw new Error('Staff name must be at least 2 characters.');
  }

  const cleanNewEmail =
    patch.email !== undefined ? clampString(patch.email, 200).toLowerCase() : oldEmail;
  if (cleanNewEmail && !cleanNewEmail.includes('@')) {
    throw new Error('Please enter a valid login email.');
  }

  const currentPassword = patch.currentPassword || '';
  const newPassword = patch.newPassword || '';
  if (newPassword && newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters.');
  }

  const emailChanged = Boolean(cleanNewEmail && cleanNewEmail !== oldEmail);
  const hasNewPassword = Boolean(newPassword);

  // Simple name-only update
  if (!emailChanged && !hasNewPassword) {
    try {
      await update(ref(rtdb, path), {
        username: cleanUsername,
        updatedAtMs: now,
      });
      const userSnap = await get(ref(rtdb, `users/${userId}`));
      if (userSnap.exists()) {
        await update(ref(rtdb, `users/${userId}`), {
          displayName: cleanUsername,
          updatedAtMs: now,
        });
      }
      return {
        id: userId,
        username: cleanUsername,
        email: oldEmail || undefined,
        role: 'school_user',
        schoolId,
        createdAtMs,
      };
    } catch (error) {
      return handleDatabaseError(error, OperationType.UPDATE, path);
    }
  }

  const secondaryAppName = `staff-edit-${Date.now()}`;
  let secondaryApp: ReturnType<typeof initializeApp> | null = null;

  try {
    secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);

    // Case A: Email changed and New Password provided -> provision new login & revoke old UID
    if (emailChanged && hasNewPassword) {
      const credential = await createUserWithEmailAndPassword(
        secondaryAuth,
        cleanNewEmail,
        newPassword
      );
      await updateProfile(credential.user, { displayName: cleanUsername });
      const newUid = credential.user.uid;
      await signOut(secondaryAuth);

      await Promise.all([
        set(ref(rtdb, `users/${newUid}`), {
          uid: newUid,
          displayName: cleanUsername,
          email: cleanNewEmail,
          role: 'school_user',
          schoolId,
          createdAtMs,
          updatedAtMs: now,
        }),
        set(ref(rtdb, `schoolUsers/${schoolId}/${newUid}`), {
          id: newUid,
          ownerId: current.uid,
          schoolId,
          username: cleanUsername,
          email: cleanNewEmail,
          role: 'school_user',
          createdAtMs,
          updatedAtMs: now,
        }),
      ]);

      await Promise.all([
        remove(ref(rtdb, path)).catch(() => {}),
        remove(ref(rtdb, `users/${userId}`)).catch(() => {}),
      ]);

      return {
        id: newUid,
        username: cleanUsername,
        email: cleanNewEmail,
        role: 'school_user',
        schoolId,
        createdAtMs,
      };
    }

    // Case B: Changing password on the same email (or changing email without new password) requires Current Password
    if (!oldEmail) {
      throw new Error(
        'This legacy account has no email yet. Enter both a new Login Email and a New Password (6+ chars) to activate it.'
      );
    }
    if (!currentPassword) {
      throw new Error(
        emailChanged
          ? 'Enter a New Password (6+ chars) to assign a new login email immediately, or provide the Current Password.'
          : `To change the password for ${oldEmail}, enter the Current Password, or assign a new Login Email + New Password, or click "Send Reset Link".`
      );
    }

    const signedIn = await signInWithEmailAndPassword(secondaryAuth, oldEmail, currentPassword);
    if (cleanUsername !== oldUsername) {
      await updateProfile(signedIn.user, { displayName: cleanUsername });
    }
    if (hasNewPassword) {
      await updatePassword(signedIn.user, newPassword);
    }
    if (emailChanged) {
      await verifyBeforeUpdateEmail(signedIn.user, cleanNewEmail);
    }
    await signOut(secondaryAuth);

    const effectiveEmail = emailChanged ? cleanNewEmail : oldEmail;
    await Promise.all([
      update(ref(rtdb, path), {
        username: cleanUsername,
        email: effectiveEmail,
        updatedAtMs: now,
      }),
      update(ref(rtdb, `users/${userId}`), {
        displayName: cleanUsername,
        email: effectiveEmail,
        updatedAtMs: now,
      }),
    ]);

    return {
      id: userId,
      username: cleanUsername,
      email: effectiveEmail,
      role: 'school_user',
      schoolId,
      createdAtMs,
    };
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      String((error as { code?: unknown }).code || '').startsWith('auth/')
    ) {
      throw formatFirebaseAuthError(error);
    }
    return handleDatabaseError(error, OperationType.UPDATE, path);
  } finally {
    if (secondaryApp) {
      await deleteApp(secondaryApp).catch(() => {});
    }
  }
}

export async function deleteSchoolUser(schoolId: string, userId: string): Promise<void> {
  await requireAuthenticatedUser();
  const path = `schoolUsers/${schoolId}/${userId}`;
  try {
    await Promise.all([
      remove(ref(rtdb, path)),
      remove(ref(rtdb, `users/${userId}`)).catch(() => {}),
    ]);
  } catch (error) {
    handleDatabaseError(error, OperationType.DELETE, path);
  }
}

export async function createBellSchedule(
  schoolId: string,
  input: Omit<BellSchedule, 'id' | 'ownerId'>
): Promise<BellSchedule> {
  const current = await requireAuthenticatedUser();
  const uid = current.uid;
  const title = clampString(input.title, MAX_TITLE_LEN);
  const time = clampString(input.time, 5);
  const endTime = clampString(input.endTime, 5) || time;
  const profile: ScheduleProfile = input.profile === 'Exams' ? 'Exams' : 'Studying';
  const zone = clampString(input.zone, 80) || 'All Campus';
  const tone = normalizeTone(input.tone, profile);
  const durationSec = Math.min(60, Math.max(1, Math.round(Number(input.durationSec ?? 5))));
  const days = normalizeDays(input.days);
  const examDate = profile === 'Exams' ? clampString(input.examDate || '', 10) : '';
  const teacherName = profile === 'Exams' ? clampString(input.teacherName || '', 100) : '';

  if (title.length < 2) throw new Error('Activity or exam name must be at least 2 characters.');
  if (!TIME_PATTERN.test(time) || !TIME_PATTERN.test(endTime)) {
    throw new Error('Start and End times must follow HH:MM format.');
  }
  if (examDate && !DATE_PATTERN.test(examDate)) {
    throw new Error('Exam date must follow YYYY-MM-DD format.');
  }

  const newRef = push(ref(rtdb, `schedules/${schoolId}`));
  const newId = newRef.key || createDocId('sch');
  const path = `schedules/${schoolId}/${newId}`;
  const now = Date.now();

  try {
    await set(ref(rtdb, path), {
      id: newId,
      schoolId,
      ownerId: uid,
      title,
      time,
      endTime,
      profile,
      zone: zone.length >= 2 ? zone : 'All Campus',
      tone,
      durationSec,
      days,
      examDate,
      teacherName,
      enabled: Boolean(input.enabled ?? true),
      createdAtMs: now,
      updatedAtMs: now,
    });
    return {
      id: newId,
      ownerId: uid,
      title,
      time,
      endTime,
      profile,
      zone: zone.length >= 2 ? zone : 'All Campus',
      tone,
      durationSec,
      days,
      examDate,
      teacherName,
      enabled: Boolean(input.enabled ?? true),
    };
  } catch (error) {
    handleDatabaseError(error, OperationType.CREATE, path);
  }
}

export async function updateBellSchedule(
  schoolId: string,
  scheduleId: string,
  input: Omit<BellSchedule, 'id' | 'ownerId'>
): Promise<BellSchedule> {
  const current = await requireAuthenticatedUser();
  const uid = current.uid;
  const title = clampString(input.title, MAX_TITLE_LEN);
  const time = clampString(input.time, 5);
  const endTime = clampString(input.endTime, 5) || time;
  const profile: ScheduleProfile = input.profile === 'Exams' ? 'Exams' : 'Studying';
  const zone = clampString(input.zone, 80) || 'All Campus';
  const tone = normalizeTone(input.tone, profile);
  const durationSec = Math.min(60, Math.max(1, Math.round(Number(input.durationSec ?? 5))));
  const days = normalizeDays(input.days);
  const examDate = profile === 'Exams' ? clampString(input.examDate || '', 10) : '';
  const teacherName = profile === 'Exams' ? clampString(input.teacherName || '', 100) : '';

  if (title.length < 2) throw new Error('Title must be at least 2 characters.');
  if (!TIME_PATTERN.test(time) || !TIME_PATTERN.test(endTime)) {
    throw new Error('Start and End times must follow HH:MM format.');
  }
  if (examDate && !DATE_PATTERN.test(examDate)) {
    throw new Error('Exam date must follow YYYY-MM-DD format.');
  }

  const path = `schedules/${schoolId}/${scheduleId}`;
  try {
    await update(ref(rtdb, path), {
      title,
      time,
      endTime,
      profile,
      zone: zone.length >= 2 ? zone : 'All Campus',
      tone,
      durationSec,
      days,
      examDate,
      teacherName,
      enabled: Boolean(input.enabled ?? true),
      updatedAtMs: Date.now(),
    });
    return {
      id: scheduleId,
      ownerId: uid,
      title,
      time,
      endTime,
      profile,
      zone: zone.length >= 2 ? zone : 'All Campus',
      tone,
      durationSec,
      days,
      examDate,
      teacherName,
      enabled: Boolean(input.enabled ?? true),
    };
  } catch (error) {
    handleDatabaseError(error, OperationType.UPDATE, path);
  }
}

export async function toggleBellScheduleEnabled(
  schoolId: string,
  scheduleId: string,
  enabled: boolean
): Promise<void> {
  await requireAuthenticatedUser();
  const path = `schedules/${schoolId}/${scheduleId}`;
  try {
    await update(ref(rtdb, path), {
      enabled: Boolean(enabled),
      updatedAtMs: Date.now(),
    });
  } catch (error) {
    handleDatabaseError(error, OperationType.UPDATE, path);
  }
}

export async function deleteBellSchedule(schoolId: string, scheduleId: string): Promise<void> {
  await requireAuthenticatedUser();
  const path = `schedules/${schoolId}/${scheduleId}`;
  try {
    await remove(ref(rtdb, path));
  } catch (error) {
    handleDatabaseError(error, OperationType.DELETE, path);
  }
}

export async function createRingLog(
  schoolId: string,
  entry: { title: string; zone: string; tone: BellTone; triggerType: 'Automatic' | 'Manual' }
): Promise<RingLog> {
  const current = await requireAuthenticatedUser();
  const uid = current.uid;
  const title = clampString(entry.title, MAX_TITLE_LEN) || 'Manual School Bell';
  const zone = clampString(entry.zone, 80) || 'All Campus';
  const tone = normalizeTone(entry.tone, 'Studying');
  const triggerType = entry.triggerType === 'Automatic' ? 'Automatic' : 'Manual';
  const newRef = push(ref(rtdb, `logs/${schoolId}`));
  const newId = newRef.key || createDocId('log');
  const path = `logs/${schoolId}/${newId}`;
  const now = Date.now();

  try {
    await set(ref(rtdb, path), {
      id: newId,
      schoolId,
      ownerId: uid,
      title: title.length >= 2 ? title : 'School Bell',
      zone: zone.length >= 2 ? zone : 'All Campus',
      tone,
      triggerType,
      triggeredAtMs: now,
    });
    return {
      id: newId,
      ownerId: uid,
      title: title.length >= 2 ? title : 'School Bell',
      zone: zone.length >= 2 ? zone : 'All Campus',
      tone,
      triggerType,
      triggeredAtMs: now,
    };
  } catch (error) {
    handleDatabaseError(error, OperationType.CREATE, path);
  }
}

export async function createCampusZone(
  schoolId: string,
  input: { name: string; building: string; speakerCount: number }
): Promise<CampusZone> {
  const current = await requireAuthenticatedUser();
  const uid = current.uid;
  const name = clampString(input.name, 80);
  const building = clampString(input.building, 100) || 'Main Campus';
  const speakerCount = Math.min(500, Math.max(1, Math.round(Number(input.speakerCount || 1))));
  if (name.length < 2) {
    throw new Error('Zone name must be at least 2 characters.');
  }

  const newRef = push(ref(rtdb, `zones/${schoolId}`));
  const newId = newRef.key || createDocId('zone');
  const path = `zones/${schoolId}/${newId}`;
  const now = Date.now();

  try {
    await set(ref(rtdb, path), {
      id: newId,
      schoolId,
      ownerId: uid,
      name,
      building,
      speakerCount,
      enabled: true,
      createdAtMs: now,
      updatedAtMs: now,
    });
    return {
      id: newId,
      ownerId: uid,
      name,
      building,
      speakerCount,
      enabled: true,
    };
  } catch (error) {
    handleDatabaseError(error, OperationType.CREATE, path);
  }
}

export async function toggleCampusZoneEnabled(
  schoolId: string,
  zoneId: string,
  enabled: boolean
): Promise<void> {
  await requireAuthenticatedUser();
  const path = `zones/${schoolId}/${zoneId}`;
  try {
    await update(ref(rtdb, path), {
      enabled: Boolean(enabled),
      updatedAtMs: Date.now(),
    });
  } catch (error) {
    handleDatabaseError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCampusZone(schoolId: string, zoneId: string): Promise<void> {
  await requireAuthenticatedUser();
  const path = `zones/${schoolId}/${zoneId}`;
  try {
    await remove(ref(rtdb, path));
  } catch (error) {
    handleDatabaseError(error, OperationType.DELETE, path);
  }
}

function normalizeAnnouncementAudience(
  raw: unknown,
  fallback: AnnouncementAudience = 'schools'
): AnnouncementAudience {
  if (raw === 'public' || raw === 'schools' || raw === 'all') {
    return raw;
  }
  return fallback;
}

function mapAnnouncementSnapshot(
  rawVal: unknown,
  fallbackAudience: AnnouncementAudience
): AnnouncementItem[] {
  if (!rawVal || typeof rawVal !== 'object') return [];
  const val = rawVal as Record<string, Record<string, unknown>>;
  return Object.entries(val)
    .filter(([, d]) => Boolean(d && typeof d === 'object'))
    .map(([id, d]): AnnouncementItem => ({
      id,
      tag: String(d.tag || 'Notice'),
      title: String(d.title || ''),
      detail: String(d.detail || ''),
      audience: normalizeAnnouncementAudience(d.audience, fallbackAudience),
      createdAtMs: Number(d.createdAtMs ?? Date.now()),
    }));
}

function mergeAnnouncementsById(lists: AnnouncementItem[][]): AnnouncementItem[] {
  const byId = new Map<string, AnnouncementItem>();
  for (const list of lists) {
    for (const item of list) {
      if (!item.title && !item.detail) continue;
      const existing = byId.get(item.id);
      if (!existing) {
        byId.set(item.id, item);
      } else if (existing.audience !== 'all' && item.audience === 'all') {
        byId.set(item.id, item);
      }
    }
  }
  return Array.from(byId.values()).sort((a, b) => b.createdAtMs - a.createdAtMs);
}

/**
 * Public Website Announcements & Promotions (visible to everyone & new visitors without login).
 * Strictly excludes registered-school-only announcements (`audience === 'schools'` or untagged legacy items).
 */
export async function listPublicAnnouncements(): Promise<AnnouncementItem[]> {
  const [publicSnapResult, legacySnapResult] = await Promise.all([
    fastRtdbGet('publicAnnouncements', { publicRead: true }).catch(() => null),
    fastRtdbGet('announcements').catch(() => null),
  ]);

  const fromPublicNode =
    publicSnapResult && publicSnapResult.exists
      ? mapAnnouncementSnapshot(publicSnapResult.val, 'public').filter(
          (item) => item.audience === 'public' || item.audience === 'all'
        )
      : [];

  const fromLegacyNode =
    legacySnapResult && legacySnapResult.exists
      ? mapAnnouncementSnapshot(legacySnapResult.val, 'schools').filter(
          (item) => item.audience === 'public' || item.audience === 'all'
        )
      : [];

  return mergeAnnouncementsById([fromPublicNode, fromLegacyNode]);
}

/**
 * Registered School Announcements (visible ONLY to logged-in registered schools & Admin).
 */
export async function listSchoolAnnouncements(): Promise<AnnouncementItem[]> {
  await requireAuthenticatedUser();
  const [schoolSnapResult, publicSnapResult] = await Promise.all([
    fastRtdbGet('announcements').catch(() => null),
    fastRtdbGet('publicAnnouncements', { publicRead: true }).catch(() => null),
  ]);

  const fromSchoolNode =
    schoolSnapResult && schoolSnapResult.exists
      ? mapAnnouncementSnapshot(schoolSnapResult.val, 'schools').filter(
          (item) => item.audience === 'schools' || item.audience === 'all'
        )
      : [];

  const fromPublicNode =
    publicSnapResult && publicSnapResult.exists
      ? mapAnnouncementSnapshot(publicSnapResult.val, 'public').filter(
          (item) => item.audience === 'schools' || item.audience === 'all'
        )
      : [];

  return mergeAnnouncementsById([fromSchoolNode, fromPublicNode]);
}

/**
 * Admin-only view of all announcements across Public Promotions and Registered Schools.
 */
export async function listAllAnnouncements(): Promise<AnnouncementItem[]> {
  const current = await requireAuthenticatedUser();
  if (!isFirebaseAdmin(current)) {
    return listSchoolAnnouncements();
  }

  const [schoolSnapResult, publicSnapResult] = await Promise.all([
    fastRtdbGet('announcements').catch(() => null),
    fastRtdbGet('publicAnnouncements', { publicRead: true }).catch(() => null),
  ]);

  const fromSchoolNode =
    schoolSnapResult && schoolSnapResult.exists
      ? mapAnnouncementSnapshot(schoolSnapResult.val, 'schools')
      : [];

  const fromPublicNode =
    publicSnapResult && publicSnapResult.exists
      ? mapAnnouncementSnapshot(publicSnapResult.val, 'public')
      : [];

  return mergeAnnouncementsById([fromPublicNode, fromSchoolNode]);
}

export async function listAnnouncements(): Promise<AnnouncementItem[]> {
  return listSchoolAnnouncements();
}

export async function createAnnouncement(input: {
  tag: string;
  title: string;
  detail: string;
  audience?: AnnouncementAudience;
}): Promise<AnnouncementItem> {
  const current = await requireAuthenticatedUser();
  if (!isFirebaseAdmin(current)) {
    throw new Error('Only Company Admin can publish announcements.');
  }
  const tag = clampString(input.tag, 60) || 'Notice';
  const title = clampString(input.title, MAX_TITLE_LEN);
  const detail = clampString(input.detail, 500);
  const audience = normalizeAnnouncementAudience(input.audience, 'schools');
  if (title.length < 2 || detail.length < 2) {
    throw new Error('Announcement title and details are required.');
  }

  const keySource = audience === 'public' ? 'publicAnnouncements' : 'announcements';
  const newRef = push(ref(rtdb, keySource));
  const newId = newRef.key || createDocId('ann');
  const now = Date.now();
  const payload = {
    id: newId,
    tag,
    title,
    detail,
    audience,
    createdAtMs: now,
  };

  if (audience === 'public') {
    const publicPath = `publicAnnouncements/${newId}`;
    try {
      await set(ref(rtdb, publicPath), payload);
    } catch (error) {
      // Fallback if live Firebase RTDB rules have not yet added `publicAnnouncements`
      const fallbackPath = `announcements/${newId}`;
      try {
        await set(ref(rtdb, fallbackPath), payload);
      } catch {
        handleDatabaseError(error, OperationType.CREATE, publicPath);
      }
    }
  } else if (audience === 'all') {
    const schoolPath = `announcements/${newId}`;
    const publicPath = `publicAnnouncements/${newId}`;
    try {
      await set(ref(rtdb, schoolPath), payload);
    } catch (error) {
      handleDatabaseError(error, OperationType.CREATE, schoolPath);
    }
    await set(ref(rtdb, publicPath), payload).catch(() => {});
  } else {
    const schoolPath = `announcements/${newId}`;
    try {
      await set(ref(rtdb, schoolPath), payload);
    } catch (error) {
      handleDatabaseError(error, OperationType.CREATE, schoolPath);
    }
  }

  return {
    id: newId,
    tag,
    title,
    detail,
    audience,
    createdAtMs: now,
  };
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const current = await requireAuthenticatedUser();
  if (!isFirebaseAdmin(current)) {
    throw new Error('Only Company Admin can delete announcements.');
  }
  const schoolPath = `announcements/${id}`;
  const publicPath = `publicAnnouncements/${id}`;
  const results = await Promise.allSettled([
    remove(ref(rtdb, schoolPath)),
    remove(ref(rtdb, publicPath)),
  ]);
  const bothRejected = results.every((r) => r.status === 'rejected');
  if (bothRejected) {
    const firstErr = (results[0] as PromiseRejectedResult).reason;
    handleDatabaseError(firstErr, OperationType.DELETE, schoolPath);
  }
}

export async function submitContactInquiry(input: {
  firstName: string;
  lastName: string;
  email: string;
  subject: string;
  message: string;
  schoolId?: string;
  schoolName?: string;
  senderRole?: string;
}): Promise<ContactInquiry> {
  const firstName = clampString(input.firstName, 60);
  const lastName = clampString(input.lastName, 60);
  const email = clampString(input.email, 160);
  const subject = clampString(input.subject, 120);
  const message = clampString(input.message, 1000);
  const schoolId = input.schoolId ? clampString(input.schoolId, 80) : '';
  const schoolName = input.schoolName ? clampString(input.schoolName, MAX_SCHOOL_NAME_LEN) : '';
  const senderRole = input.senderRole ? clampString(input.senderRole, 40) : '';
  if (!firstName || !lastName || !email || !subject || !message) {
    throw new Error('Please complete all fields before submitting.');
  }

  const newRef = push(ref(rtdb, 'inquiries'));
  const newId = newRef.key || createDocId('inq');
  const path = `inquiries/${newId}`;
  const now = Date.now();

  const payload: Record<string, unknown> = {
    id: newId,
    firstName,
    lastName,
    email,
    subject,
    message,
    createdAtMs: now,
  };
  if (schoolId) payload.schoolId = schoolId;
  if (schoolName) payload.schoolName = schoolName;
  if (senderRole) payload.senderRole = senderRole;

  try {
    await set(ref(rtdb, path), payload);
    return {
      id: newId,
      firstName,
      lastName,
      email,
      subject,
      message,
      ...(schoolId ? { schoolId } : {}),
      ...(schoolName ? { schoolName } : {}),
      ...(senderRole ? { senderRole } : {}),
      createdAtMs: now,
    };
  } catch (error) {
    handleDatabaseError(error, OperationType.CREATE, path);
  }
}

export async function listContactInquiries(): Promise<ContactInquiry[]> {
  const current = await requireAuthenticatedUser();
  if (!isFirebaseAdmin(current)) {
    throw new Error('Only Company Admin can view contact inquiries.');
  }
  const path = 'inquiries';
  try {
    const snap = await fastRtdbGet<Record<string, Record<string, unknown>>>(path);
    if (!snap.exists || !snap.val) return [];
    const val = snap.val;
    return Object.entries(val)
      .filter(([, d]) => Boolean(d))
      .map(([id, d]): ContactInquiry => ({
        id,
        firstName: String(d.firstName || ''),
        lastName: String(d.lastName || ''),
        email: String(d.email || ''),
        subject: String(d.subject || ''),
        message: String(d.message || ''),
        ...(typeof d.schoolId === 'string' && d.schoolId ? { schoolId: d.schoolId } : {}),
        ...(typeof d.schoolName === 'string' && d.schoolName ? { schoolName: d.schoolName } : {}),
        ...(typeof d.senderRole === 'string' && d.senderRole ? { senderRole: d.senderRole } : {}),
        createdAtMs: Number(d.createdAtMs ?? Date.now()),
      }))
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  } catch (error) {
    handleDatabaseError(error, OperationType.LIST, path);
  }
}

export async function deleteContactInquiry(id: string): Promise<void> {
  const current = await requireAuthenticatedUser();
  if (!isFirebaseAdmin(current)) {
    throw new Error('Only Company Admin can delete contact inquiries.');
  }
  const path = `inquiries/${id}`;
  try {
    await remove(ref(rtdb, path));
  } catch (error) {
    handleDatabaseError(error, OperationType.DELETE, path);
  }
}

export async function ensureSchoolHardwareInitialized(
  school: SchoolConfig
): Promise<SchoolHardwareState> {
  if (school.hardware?.config?.deviceKey) {
    return school.hardware;
  }
  await requireAuthenticatedUser();
  const now = Date.now();
  const config: SchoolHardwareConfig = {
    deviceId: createDeviceId(school.id),
    deviceKey: createDeviceKey(),
    enabled: true,
    relayPin: 2,
    defaultDurationSec: 5,
    timezoneOffsetMinutes: -new Date().getTimezoneOffset(),
    updatedAtMs: now,
  };
  await update(ref(rtdb, `schools/${school.id}/hardware`), {
    config,
    lastSyncedAtMs: now,
  });
  await set(ref(rtdb, `hardwareFeeds/${config.deviceKey}/config`), {
    schoolId: school.id,
    schoolName: school.schoolName,
    deviceId: config.deviceId,
    enabled: config.enabled,
    relayPin: config.relayPin,
    defaultDurationSec: config.defaultDurationSec,
    timezoneOffsetMinutes: config.timezoneOffsetMinutes,
  }).catch(() => {});

  return {
    config,
    command: null,
    status: { online: false, lastHeartbeatMs: null, relayState: 'IDLE' },
    lastSyncedAtMs: now,
  };
}

export async function saveSchoolHardwareConfig(
  schoolId: string,
  currentConfig: SchoolHardwareConfig | undefined,
  patch: Partial<SchoolHardwareConfig>,
  regenerateKey = false
): Promise<SchoolHardwareState> {
  await requireAuthenticatedUser();
  const now = Date.now();
  const nextConfig: SchoolHardwareConfig = {
    deviceId:
      clampString(patch.deviceId ?? currentConfig?.deviceId ?? createDeviceId(schoolId), 40) ||
      createDeviceId(schoolId),
    deviceKey: regenerateKey
      ? createDeviceKey()
      : currentConfig?.deviceKey || createDeviceKey(),
    enabled: patch.enabled !== undefined ? Boolean(patch.enabled) : (currentConfig?.enabled ?? true),
    relayPin: Math.max(
      0,
      Math.min(48, Math.round(Number(patch.relayPin ?? currentConfig?.relayPin ?? 2)))
    ),
    defaultDurationSec: Math.max(
      1,
      Math.min(
        60,
        Math.round(Number(patch.defaultDurationSec ?? currentConfig?.defaultDurationSec ?? 5))
      )
    ),
    timezoneOffsetMinutes: Number.isFinite(Number(patch.timezoneOffsetMinutes))
      ? Number(patch.timezoneOffsetMinutes)
      : (currentConfig?.timezoneOffsetMinutes ?? 120),
    updatedAtMs: now,
  };

  try {
    await update(ref(rtdb, `schools/${schoolId}/hardware`), {
      config: nextConfig,
      lastSyncedAtMs: now,
    });
    await set(ref(rtdb, `hardwareFeeds/${nextConfig.deviceKey}/config`), {
      schoolId,
      deviceId: nextConfig.deviceId,
      enabled: nextConfig.enabled,
      relayPin: nextConfig.relayPin,
      defaultDurationSec: nextConfig.defaultDurationSec,
      timezoneOffsetMinutes: nextConfig.timezoneOffsetMinutes,
      updatedAtMs: now,
    }).catch(() => {});

    return {
      config: nextConfig,
      command: null,
      status: { online: false, lastHeartbeatMs: null, relayState: 'IDLE' },
      lastSyncedAtMs: now,
    };
  } catch (error) {
    handleDatabaseError(error, OperationType.UPDATE, `schools/${schoolId}/hardware`);
  }
}

const schoolMetaCache = new Map<
  string,
  { id: string; schoolName: string; campusLocation: string; primaryEmail?: string | null }
>();

export function toSchoolBridgeKey(schoolName: string): string {
  const normalized = schoolName
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || 'SCHOOL';
}

let activeWakePromise: Promise<void> | null = null;

/**
 * Immediately wakes Firebase RTDB WebSocket (`goOnline`) and ensures the Auth ID token is fresh
 * so commands fired after long periods of browser inactivity execute with zero cold-start delay.
 */
export async function wakeRealtimeConnection(forceTokenRefresh = false): Promise<void> {
  try {
    goOnline(rtdb);
  } catch {
    // Ignore if already online
  }
  const current = auth.currentUser;
  if (!current) return;
  if (activeWakePromise && !forceTokenRefresh) {
    return activeWakePromise;
  }
  activeWakePromise = (async () => {
    try {
      const tokenResult = await current.getIdTokenResult(false);
      const expMs = Date.parse(tokenResult.expirationTime);
      const expiresSoon = !Number.isFinite(expMs) || expMs - Date.now() < 5 * 60 * 1000;
      if (forceTokenRefresh || expiresSoon) {
        await current.getIdToken(true);
      }
    } catch {
      try {
        await current.getIdToken(true);
      } catch {
        // Ignore transient offline errors
      }
    } finally {
      activeWakePromise = null;
    }
  })();
  return activeWakePromise;
}

async function patchRtdbRest(path: string, body: Record<string, unknown>): Promise<boolean> {
  const current = auth.currentUser;
  if (!current) return false;
  try {
    let token = await current.getIdToken(false);
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? window.setTimeout(() => controller.abort(), 3500) : null;
    let res = await fetch(`${REALTIME_DB_URL}/${path}.json?auth=${encodeURIComponent(token)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
      ...(controller ? { signal: controller.signal } : {}),
    });
    if (timeoutId) window.clearTimeout(timeoutId);
    if (res.status === 401) {
      token = await current.getIdToken(true);
      res = await fetch(`${REALTIME_DB_URL}/${path}.json?auth=${encodeURIComponent(token)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
      });
    }
    return res.ok;
  } catch {
    return false;
  }
}

async function resolveSchoolKeyForBridge(
  schoolId: string,
  explicitSchoolName?: string
): Promise<string | null> {
  const fromExplicit = explicitSchoolName?.trim();
  if (fromExplicit) {
    return toSchoolBridgeKey(fromExplicit);
  }
  const cached = schoolMetaCache.get(schoolId);
  if (cached?.schoolName) {
    return toSchoolBridgeKey(cached.schoolName);
  }
  if (auth.currentUser) {
    try {
      const snap = await fastRtdbGet<string>(`schools/${schoolId}/schoolName`, {
        timeoutMs: 2500,
      });
      if (snap.exists && typeof snap.val === 'string') {
        const name = String(snap.val).trim();
        if (name) {
          schoolMetaCache.set(schoolId, {
            id: schoolId,
            schoolName: name,
            campusLocation: 'Main Campus',
          });
          return toSchoolBridgeKey(name);
        }
      }
    } catch {
      // Ignore lookup failures
    }
  }
  return null;
}

export async function checkEsp32RtdbBridgeStatus(): Promise<{ ready: boolean; status: number }> {
  try {
    const res = await fetch(`${REALTIME_DB_URL}/esp32Bridge/health.json`, { cache: 'no-store' });
    return { ready: res.status === 200, status: res.status };
  } catch {
    return { ready: false, status: 0 };
  }
}

export interface HardwareSyncResult {
  updatedAtMs: number;
  schoolKey: string;
  timezoneOffsetMinutes: number;
  dbSynced: boolean;
}

export async function syncHardwareScheduleSnapshot(
  school: SchoolConfig,
  schedules: BellSchedule[]
): Promise<HardwareSyncResult> {
  schoolMetaCache.set(school.id, {
    id: school.id,
    schoolName: school.schoolName,
    campusLocation: school.campusLocation,
    primaryEmail: school.primaryEmail ?? null,
  });

  const browserTzOffsetMin = -new Date().getTimezoneOffset();
  const hw = school.hardware?.config?.deviceKey
    ? school.hardware
    : await ensureSchoolHardwareInitialized(school).catch(() => null);
  const config: SchoolHardwareConfig = hw?.config ?? {
    deviceId: createDeviceId(school.id),
    deviceKey: '',
    enabled: true,
    relayPin: 2,
    defaultDurationSec: 5,
    timezoneOffsetMinutes: browserTzOffsetMin,
    updatedAtMs: Date.now(),
  };

  const resolvedTzOffset = browserTzOffsetMin;
  const now = Date.now();
  const schoolKey = toSchoolBridgeKey(school.schoolName);
  const sanitizedSchedules = schedules.map((s) => ({
    id: s.id,
    title: s.title,
    time: s.time,
    endTime: s.endTime || s.time,
    profile: s.profile,
    tone: s.tone,
    durationSec: s.durationSec,
    days: s.days,
    examDate: s.examDate || '',
    enabled: s.enabled,
  }));

  // 1. Sync to Express Server Hardware Bridge
  fetch(`/api/hardware/${encodeURIComponent(school.id)}/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolName: school.schoolName,
      activeProfile: school.activeProfile,
      autoRingEnabled: school.autoRingEnabled,
      config: { ...config, timezoneOffsetMinutes: resolvedTzOffset },
      schedules: sanitizedSchedules,
    }),
  }).catch(() => {});

  // 2. Persist snapshot in RTDB (write schedules BEFORE live.schedulesUpdatedAtMs to avoid read race)
  let dbSynced = false;
  if (auth.currentUser) {
    try {
      update(ref(rtdb, `schools/${school.id}/hardware`), {
        lastSyncedAtMs: now,
        'config/timezoneOffsetMinutes': resolvedTzOffset,
      }).catch(() => {});

      await set(ref(rtdb, `esp32Bridge/schools/${schoolKey}/schedules`), {
        activeProfile: school.activeProfile,
        autoRingEnabled: school.autoRingEnabled,
        timezoneOffsetMinutes: resolvedTzOffset,
        updatedAtMs: now,
        schedules: sanitizedSchedules.map((s) => ({
          id: s.id,
          title: clampString(s.title, 36),
          time: s.time,
          endTime: s.endTime,
          profile: s.profile,
          durationSec: s.durationSec,
          days: s.days,
          examDate: s.examDate,
          enabled: s.enabled,
        })),
      });

      await update(ref(rtdb, `esp32Bridge/schools/${schoolKey}/live`), {
        schoolId: school.id,
        schoolName: school.schoolName,
        schoolKey,
        activeProfile: school.activeProfile,
        autoRingEnabled: school.autoRingEnabled,
        enabled: config.enabled,
        relayPin: config.relayPin,
        timezoneOffsetMinutes: resolvedTzOffset,
        schedulesUpdatedAtMs: now,
        updatedAtMs: now,
      });

      dbSynced = true;
    } catch {
      dbSynced = false;
    }

    if (isFirebaseAdmin(auth.currentUser)) {
      set(ref(rtdb, 'esp32Bridge/health'), { ok: true, bridge: 'firebase-rtdb', updatedAtMs: now }).catch(
        () => {}
      );
    }
    if (config.deviceKey) {
      set(ref(rtdb, `hardwareFeeds/${config.deviceKey}/scheduleSync`), {
        schoolId: school.id,
        schoolName: school.schoolName,
        activeProfile: school.activeProfile,
        autoRingEnabled: school.autoRingEnabled,
        timezoneOffsetMinutes: resolvedTzOffset,
        updatedAtMs: now,
        schedules: sanitizedSchedules,
      }).catch(() => {});
    }
  }

  return {
    updatedAtMs: now,
    schoolKey,
    timezoneOffsetMinutes: resolvedTzOffset,
    dbSynced,
  };
}

export async function dispatchHardwareRingCommand(
  schoolId: string,
  input: {
    title: string;
    tone: BellTone;
    durationSec: number;
    triggerType: 'Automatic' | 'Manual' | 'Test';
    deviceKey?: string;
    schoolName?: string;
    commandId?: string;
  }
): Promise<HardwareCommand> {
  const now = Date.now();
  const durationSec = Math.max(1, Math.min(60, Math.round(Number(input.durationSec || 5))));
  const safeCustomId = input.commandId
    ? input.commandId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)
    : '';
  const command: HardwareCommand = {
    commandId: safeCustomId || `cmd-${now}-${Math.random().toString(36).slice(2, 8)}`,
    ringNow: true,
    title: clampString(input.title, MAX_TITLE_LEN) || 'School Bell',
    tone: normalizeTone(input.tone, 'Studying'),
    durationSec,
    triggerType: input.triggerType,
    triggeredAtMs: now,
    expiresAtMs: now + durationSec * 1000,
  };

  // 1. Send to Express Hardware Bridge immediately
  fetch(`/api/hardware/${encodeURIComponent(schoolId)}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...command,
      deviceKey: input.deviceKey,
    }),
  }).catch(() => {});

  // 2. Wake dormant Firebase RTDB socket & persist via BOTH fast direct REST PATCH + SDK in parallel
  if (auth.currentUser) {
    try {
      goOnline(rtdb);
    } catch {
      // Ignore
    }

    const cachedMeta = schoolMetaCache.get(schoolId);
    const syncSchoolKey = input.schoolName?.trim()
      ? toSchoolBridgeKey(input.schoolName)
      : cachedMeta?.schoolName
      ? toSchoolBridgeKey(cachedMeta.schoolName)
      : null;

    const schoolKey = syncSchoolKey ?? (await resolveSchoolKeyForBridge(schoolId, input.schoolName));
    const resolvedSchoolName = input.schoolName || cachedMeta?.schoolName || schoolKey || 'School';

    const bridgeChecks: Promise<boolean>[] = [];
    const fallbackChecks: Promise<boolean>[] = [
      update(ref(rtdb, `schools/${schoolId}/hardware`), {
        command,
        lastSyncedAtMs: now,
      })
        .then(() => true)
        .catch(() => false),
    ];

    if (schoolKey) {
      const livePayload = {
        schoolId,
        schoolName: resolvedSchoolName,
        schoolKey,
        enabled: true,
        command,
        updatedAtMs: now,
      };
      // Direct HTTPS PATCH bypasses idle WebSocket reconnection latency on initial start
      bridgeChecks.push(
        patchRtdbRest(`esp32Bridge/schools/${schoolKey}/live`, livePayload)
      );
      bridgeChecks.push(
        update(ref(rtdb, `esp32Bridge/schools/${schoolKey}/live`), livePayload)
          .then(() => true)
          .catch(() => false)
      );
    }

    if (input.deviceKey) {
      void patchRtdbRest(`hardwareFeeds/${input.deviceKey}`, { command }).catch(() => false);
      void set(ref(rtdb, `hardwareFeeds/${input.deviceKey}/command`), command).catch(() => {});
    }

    const activeChecks = bridgeChecks.length > 0 ? bridgeChecks : fallbackChecks;
    if (bridgeChecks.length > 0) {
      void Promise.all(fallbackChecks);
    }

    // Resolve immediately as soon as any primary bridge write succeeds, or wait up to 4s if both fail
    const delivered = await new Promise<boolean>((resolve) => {
      let settled = 0;
      let resolved = false;
      activeChecks.forEach((p) => {
        p.then((ok) => {
          settled += 1;
          if (!resolved && (ok || settled === activeChecks.length)) {
            resolved = true;
            resolve(ok);
          }
        }).catch(() => {
          settled += 1;
          if (!resolved && settled === activeChecks.length) {
            resolved = true;
            resolve(false);
          }
        });
      });
      window.setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      }, 4000);
    });

    if (!delivered) {
      throw new Error('Could not reach Firebase RTDB to deliver bell command. Check internet connection.');
    }

    // Record lastPushMs on linked ESP32 devices asynchronously using fast REST read
    if (schoolKey) {
      fastRtdbGet<Record<string, RtdbEsp32BridgeDeviceEntry>>('esp32Bridge/devices', {
        timeoutMs: 3000,
      })
        .then((snap) => {
          if (!snap.exists || !snap.val) return;
          const all = snap.val;
          Object.entries(all).forEach(([chipKey, entry]) => {
            if (!entry || entry.manualUnassigned === true) return;
            const matchesSchool =
              entry.schoolId === schoolId ||
              entry.schoolKey === schoolKey ||
              (entry.schoolName && toSchoolBridgeKey(entry.schoolName) === schoolKey);
            if (!matchesSchool) return;
            const chipId = String(entry.chipId || chipKey).trim().toLowerCase();
            if (!chipId) return;
            void patchRtdbRest(`esp32Bridge/devices/${chipId}`, { lastPushMs: now });
            if (auth.currentUser && isFirebaseAdmin(auth.currentUser)) {
              const devId = `dev-${chipId.replace(/[^a-z0-9]/g, '')}`;
              update(ref(rtdb, `devices/${devId}`), {
                lastPushMs: now,
              }).catch(() => {});
            }
          });
        })
        .catch(() => {});
    }

    // Keep ringNow=true long enough for booting/reconnecting ESP32 boards (NVS dedupe prevents replay)
    if (schoolKey) {
      const cleanupDelayMs = (Math.max(durationSec, 5) + 15) * 1000;
      window.setTimeout(() => {
        if (!auth.currentUser) return;
        fastRtdbGet<string>(`esp32Bridge/schools/${schoolKey}/live/command/commandId`, {
          timeoutMs: 3000,
        })
          .then((snap) => {
            if (snap.exists && snap.val === command.commandId) {
              void patchRtdbRest(`esp32Bridge/schools/${schoolKey}/live/command`, {
                ringNow: false,
              });
              return update(ref(rtdb, `esp32Bridge/schools/${schoolKey}/live/command`), {
                ringNow: false,
              });
            }
            return undefined;
          })
          .catch(() => {});
      }, cleanupDelayMs);
    }
  }

  return command;
}

export async function stopHardwareRingCommand(
  schoolId: string,
  deviceKey?: string,
  schoolName?: string
): Promise<void> {
  const now = Date.now();
  const stopCommand: HardwareCommand = {
    commandId: `stop-${now}`,
    ringNow: false,
    title: 'Bell Stopped',
    tone: 'brass-bell',
    durationSec: 0,
    triggerType: 'Manual',
    triggeredAtMs: now,
    expiresAtMs: now,
  };

  fetch(`/api/hardware/${encodeURIComponent(schoolId)}/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }).catch(() => {});

  if (auth.currentUser) {
    try {
      goOnline(rtdb);
    } catch {
      // Ignore
    }
    const cachedMeta = schoolMetaCache.get(schoolId);
    const syncSchoolKey = schoolName?.trim()
      ? toSchoolBridgeKey(schoolName)
      : cachedMeta?.schoolName
      ? toSchoolBridgeKey(cachedMeta.schoolName)
      : null;
    const schoolKey = syncSchoolKey ?? (await resolveSchoolKeyForBridge(schoolId, schoolName));

    const writes: Promise<unknown>[] = [
      update(ref(rtdb, `schools/${schoolId}/hardware`), {
        command: stopCommand,
      }).catch(() => {}),
    ];
    if (schoolKey) {
      const stopLive = { command: stopCommand, updatedAtMs: now };
      writes.push(patchRtdbRest(`esp32Bridge/schools/${schoolKey}/live`, stopLive));
      writes.push(update(ref(rtdb, `esp32Bridge/schools/${schoolKey}/live`), stopLive).catch(() => {}));
    }
    if (deviceKey) {
      writes.push(patchRtdbRest(`hardwareFeeds/${deviceKey}`, { command: stopCommand }).catch(() => false));
      writes.push(set(ref(rtdb, `hardwareFeeds/${deviceKey}/command`), stopCommand).catch(() => {}));
    }
    await Promise.all(writes);
  }
}

export async function fetchLiveHardwareStatus(schoolId: string): Promise<{
  status: HardwareStatus;
  command: HardwareCommand | null;
  lastSyncedAtMs: number | null;
}> {
  try {
    const res = await fetch(`/api/hardware/${encodeURIComponent(schoolId)}/status`);
    if (res.ok) {
      const data = (await res.json()) as {
        status?: HardwareStatus;
        command?: HardwareCommand | null;
        lastSyncedAtMs?: number | null;
      };
      return {
        status: data.status || { online: false, lastHeartbeatMs: null, relayState: 'IDLE' },
        command: data.command ?? null,
        lastSyncedAtMs: data.lastSyncedAtMs ?? null,
      };
    }
  } catch {
    // Ignore transient status fetch errors
  }
  return {
    status: { online: false, lastHeartbeatMs: null, relayState: 'IDLE' },
    command: null,
    lastSyncedAtMs: null,
  };
}

interface RtdbEsp32BridgeDeviceEntry {
  chipId?: string;
  serialNumber?: string;
  requestedSchoolName?: string;
  requestedSchoolKey?: string;
  assigned?: boolean;
  manualUnassigned?: boolean;
  schoolId?: string | null;
  schoolName?: string | null;
  schoolKey?: string | null;
  schoolEmail?: string | null;
  relayPin?: number;
  firstSeenMs?: number;
  lastSeenMs?: number | null;
  lastPushMs?: number | null;
  firmwareVersion?: string;
  syncedActivityCount?: number | null;
  syncedActivitiesSummary?: string | null;
  lastScheduleSyncMs?: number | null;
  nvsSaved?: boolean | null;
  espClockStamp?: string | null;
  espTimezoneOffsetMin?: number | null;
}

export async function listEsp32Devices(schoolId?: string): Promise<Esp32Device[]> {
  const merged = new Map<string, Esp32Device>();

  // 1. Load Express Bridge devices
  try {
    const queryStr = schoolId ? `?schoolId=${encodeURIComponent(schoolId)}` : '';
    const res = await fetch(`/api/devices${queryStr}`);
    if (res.ok) {
      const data = (await res.json()) as { devices?: Esp32Device[] };
      if (Array.isArray(data.devices)) {
        data.devices.forEach((d) => {
          if (d && d.id) merged.set(d.id, d);
        });
      }
    }
  } catch {
    // Ignore local Express unavailable
  }

  // 2. Load & merge RTDB admin devices + live esp32Bridge/devices check-ins
  if (auth.currentUser && isFirebaseAdmin(auth.currentUser)) {
    const [savedSnap, bridgeSnap] = await Promise.all([
      fastRtdbGet<Record<string, Esp32Device>>('devices').catch(() => null),
      fastRtdbGet<Record<string, RtdbEsp32BridgeDeviceEntry>>('esp32Bridge/devices').catch(() => null),
    ]);

    if (savedSnap && savedSnap.exists && savedSnap.val) {
      Object.values(savedSnap.val).forEach((d) => {
        if (!d || !d.id) return;
        const prev = merged.get(d.id);
        merged.set(d.id, prev ? { ...d, ...prev, lastSeenMs: prev.lastSeenMs ?? d.lastSeenMs } : d);
      });
    }

    if (bridgeSnap && bridgeSnap.exists && bridgeSnap.val) {
      const bridgeVal = bridgeSnap.val;
      const entries = Object.entries(bridgeVal);
      for (const [chipKey, raw] of entries) {
        if (!raw) continue;
        const chipId = String(raw.chipId || chipKey).trim().toLowerCase();
        if (!chipId) continue;
        const devId = `dev-${chipId.replace(/[^a-z0-9]/g, '')}`;
        const existing = merged.get(devId);
        const nowMs = Date.now();

        const reqSchoolName = raw.requestedSchoolName?.trim() || existing?.requestedSchoolName || null;
        let matchedMeta: {
          id: string;
          schoolName: string;
          campusLocation: string;
          primaryEmail?: string | null;
        } | null = null;
        if (reqSchoolName && !raw.manualUnassigned) {
          const reqKey = toSchoolBridgeKey(reqSchoolName);
          for (const meta of schoolMetaCache.values()) {
            if (toSchoolBridgeKey(meta.schoolName) === reqKey) {
              matchedMeta = meta;
              break;
            }
          }
        }

        const resolvedSchoolId =
          raw.manualUnassigned === true
            ? null
            : raw.schoolId || existing?.schoolId || matchedMeta?.id || null;
        const resolvedSchoolName =
          raw.manualUnassigned === true
            ? null
            : raw.schoolName || existing?.schoolName || matchedMeta?.schoolName || null;
        const resolvedSchoolEmail =
          raw.manualUnassigned === true
            ? null
            : raw.schoolEmail ||
              existing?.schoolEmail ||
              matchedMeta?.primaryEmail ||
              matchedMeta?.campusLocation ||
              null;
        const isLinked = Boolean(resolvedSchoolId && raw.manualUnassigned !== true);

        const serialNumber =
          raw.serialNumber ||
          existing?.serialNumber ||
          `BC-${String(merged.size + 1).padStart(2, '0')}-ESP`;
        const firstSeenMs = raw.firstSeenMs || existing?.firstSeenMs || raw.lastSeenMs || nowMs;
        const lastSeenMs =
          Math.max(Number(raw.lastSeenMs || 0), Number(existing?.lastSeenMs || 0)) || null;

        const deviceObj: Esp32Device = {
          id: devId,
          serialNumber,
          chipId,
          status: isLinked ? 'linked' : 'awaiting_assignment',
          schoolId: resolvedSchoolId,
          schoolName: resolvedSchoolName,
          schoolEmail: resolvedSchoolEmail,
          requestedSchoolName: reqSchoolName,
          relayPin:
            typeof raw.relayPin === 'number'
              ? raw.relayPin
              : existing?.relayPin ?? 2,
          firstSeenMs,
          lastSeenMs,
          lastPushMs: raw.lastPushMs ?? existing?.lastPushMs ?? null,
          firmwareVersion: raw.firmwareVersion || existing?.firmwareVersion,
          syncedActivityCount:
            typeof raw.syncedActivityCount === 'number'
              ? raw.syncedActivityCount
              : existing?.syncedActivityCount ?? null,
          syncedActivitiesSummary:
            raw.syncedActivitiesSummary ?? existing?.syncedActivitiesSummary ?? null,
          lastScheduleSyncMs:
            raw.lastScheduleSyncMs ?? existing?.lastScheduleSyncMs ?? null,
          nvsSaved:
            typeof raw.nvsSaved === 'boolean'
              ? raw.nvsSaved
              : existing?.nvsSaved ?? null,
          espClockStamp:
            typeof raw.espClockStamp === 'string' && raw.espClockStamp.length > 0
              ? raw.espClockStamp
              : existing?.espClockStamp ?? null,
          espTimezoneOffsetMin:
            typeof raw.espTimezoneOffsetMin === 'number'
              ? raw.espTimezoneOffsetMin
              : existing?.espTimezoneOffsetMin ?? null,
        };
        merged.set(devId, deviceObj);

        // If RTDB auto-linked or initialized a brand-new ESP32 check-in, persist assigned metadata back
        if (isLinked && (!raw.assigned || !raw.schoolId || !raw.serialNumber || !raw.firstSeenMs)) {
          const targetKey = resolvedSchoolName ? toSchoolBridgeKey(resolvedSchoolName) : null;
          update(ref(rtdb, `esp32Bridge/devices/${chipId}`), {
            assigned: true,
            manualUnassigned: false,
            serialNumber,
            firstSeenMs,
            schoolId: resolvedSchoolId,
            schoolName: resolvedSchoolName,
            schoolKey: targetKey,
            schoolEmail: resolvedSchoolEmail,
          }).catch(() => {});
          set(ref(rtdb, `devices/${devId}`), deviceObj).catch(() => {});
          if (resolvedSchoolId) {
            update(ref(rtdb, `schools/${resolvedSchoolId}/hardware`), {
              connectedDeviceId: devId,
              connectedChipId: chipId,
              connectedSerial: serialNumber,
            }).catch(() => {});
          }
          if (targetKey) {
            update(ref(rtdb, `esp32Bridge/schools/${targetKey}/live`), {
              connectedDeviceId: devId,
              connectedChipId: chipId,
              connectedSerial: serialNumber,
            }).catch(() => {});
          }
        } else if (!raw.serialNumber || !raw.firstSeenMs) {
          update(ref(rtdb, `esp32Bridge/devices/${chipId}`), {
            serialNumber,
            firstSeenMs,
          }).catch(() => {});
        }
      }
    }
  }

  return Array.from(merged.values())
    .filter((d) => !schoolId || d.schoolId === schoolId)
    .sort((a, b) => b.firstSeenMs - a.firstSeenMs);
}

export const ESP32_ONLINE_WINDOW_MS = 3_200;

let rtdbServerOffsetMs = 0;

if (typeof window !== 'undefined') {
  try {
    onValue(
      ref(rtdb, '.info/serverTimeOffset'),
      (snap) => {
        const val = snap.val();
        if (typeof val === 'number' && Number.isFinite(val)) {
          rtdbServerOffsetMs = val;
        }
      },
      () => {}
    );
  } catch {
    // Ignore early offset listener errors
  }
}

export function getServerSyncedNowMs(): number {
  return Date.now() + rtdbServerOffsetMs;
}

export function isEsp32DeviceOnline(
  lastSeenMs: number | null | undefined,
  nowMs = getServerSyncedNowMs()
): boolean {
  return Boolean(
    typeof lastSeenMs === 'number' &&
      lastSeenMs > 0 &&
      nowMs - lastSeenMs < ESP32_ONLINE_WINDOW_MS
  );
}

export function subscribeRealtimeConnection(onChange: (connected: boolean) => void): () => void {
  try {
    const connectedRef = ref(rtdb, '.info/connected');
    const offsetRef = ref(rtdb, '.info/serverTimeOffset');
    const unsubConn = onValue(
      connectedRef,
      (snap) => {
        onChange(Boolean(snap.val()));
      },
      () => {
        onChange(false);
      }
    );
    const unsubOffset = onValue(
      offsetRef,
      (snap) => {
        const val = snap.val();
        if (typeof val === 'number' && Number.isFinite(val)) {
          rtdbServerOffsetMs = val;
        }
      },
      () => {}
    );
    return () => {
      unsubConn();
      unsubOffset();
    };
  } catch {
    return () => {};
  }
}

export async function checkCloudConnectivity(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? window.setTimeout(() => controller.abort(), 3000) : null;
    const res = await fetch(`${REALTIME_DB_URL}/esp32Bridge/health.json`, {
      cache: 'no-store',
      ...(controller ? { signal: controller.signal } : {}),
    });
    if (timer) window.clearTimeout(timer);
    return res.ok || res.status === 401 || res.status === 403;
  } catch {
    return false;
  }
}

export interface SchoolEsp32LiveStatus {
  linked: boolean;
  online: boolean;
  serialNumber?: string;
  chipId?: string;
  lastSeenMs: number | null;
  firmwareVersion?: string;
}

export async function fetchSchoolEsp32LiveStatus(
  school: SchoolConfig | null
): Promise<SchoolEsp32LiveStatus> {
  if (!school) {
    return { linked: false, online: false, lastSeenMs: null };
  }

  let chipId = school.hardware?.connectedChipId?.trim().toLowerCase() || '';
  let serialNumber = school.hardware?.connectedSerial?.trim() || '';

  if (!chipId && school.schoolName) {
    try {
      const schoolKey = toSchoolBridgeKey(school.schoolName);
      const liveSnap = await fastRtdbGet<{
        connectedChipId?: unknown;
        connectedSerial?: unknown;
      }>(`esp32Bridge/schools/${schoolKey}/live`, { timeoutMs: 2500 });
      if (liveSnap.exists && liveSnap.val) {
        if (typeof liveSnap.val.connectedChipId === 'string') {
          chipId = liveSnap.val.connectedChipId.trim().toLowerCase();
        }
        if (typeof liveSnap.val.connectedSerial === 'string') {
          serialNumber = liveSnap.val.connectedSerial.trim();
        }
      }
    } catch {
      // Ignore bridge lookup errors
    }
  }

  if (chipId) {
    try {
      const devSnap = await fastRtdbGet<RtdbEsp32BridgeDeviceEntry>(`esp32Bridge/devices/${chipId}`, {
        timeoutMs: 2500,
      });
      if (devSnap.exists && devSnap.val) {
        const entry = devSnap.val;
        if (entry.manualUnassigned === true) {
          return { linked: false, online: false, lastSeenMs: null };
        }
        const lastSeenMs = typeof entry.lastSeenMs === 'number' ? entry.lastSeenMs : null;
        return {
          linked: true,
          online: isEsp32DeviceOnline(lastSeenMs),
          serialNumber: entry.serialNumber || serialNumber || undefined,
          chipId,
          lastSeenMs,
          firmwareVersion: entry.firmwareVersion,
        };
      }
    } catch {
      // Fall back to Express API below
    }
  }

  try {
    const res = await fetch(`/api/devices?schoolId=${encodeURIComponent(school.id)}`, {
      cache: 'no-store',
    });
    if (res.ok) {
      const data = (await res.json()) as { devices?: Esp32Device[] };
      const linked = Array.isArray(data.devices)
        ? data.devices.find((d) => d.status === 'linked' && d.schoolId === school.id)
        : undefined;
      if (linked) {
        return {
          linked: true,
          online: isEsp32DeviceOnline(linked.lastSeenMs),
          serialNumber: linked.serialNumber,
          chipId: linked.chipId,
          lastSeenMs: linked.lastSeenMs,
          firmwareVersion: linked.firmwareVersion,
        };
      }
    }
  } catch {
    // Ignore local bridge errors
  }

  if (chipId) {
    return {
      linked: true,
      online: false,
      serialNumber: serialNumber || undefined,
      chipId,
      lastSeenMs: null,
    };
  }

  return { linked: false, online: false, lastSeenMs: null };
}

export async function verifyEsp32OnlineBeforeCommand(school: SchoolConfig | null): Promise<{
  ready: boolean;
  linked: boolean;
  online: boolean;
  serialNumber?: string;
  chipId?: string;
  lastSeenMs: number | null;
  reason?: string;
}> {
  if (!school) {
    return {
      ready: false,
      linked: false,
      online: false,
      lastSeenMs: null,
      reason: 'Select a school first before sending bell commands.',
    };
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      ready: false,
      linked: false,
      online: false,
      lastSeenMs: null,
      reason: 'System is OFFLINE. Reconnect to the internet before sending commands.',
    };
  }

  const live = await fetchSchoolEsp32LiveStatus(school);
  if (!live.linked) {
    return {
      ...live,
      ready: false,
      reason:
        'No ESP32 controller is linked to this school. Connect and assign an ESP32 device first.',
    };
  }

  if (!live.online) {
    const label = live.serialNumber ? ` (${live.serialNumber})` : '';
    return {
      ...live,
      ready: false,
      reason: `ESP32${label} is OFFLINE (no power or Wi-Fi). Power on ESP32 and wait for ESP32: ONLINE before sending commands.`,
    };
  }

  return {
    ...live,
    ready: true,
  };
}

export function subscribeSchoolEsp32LiveStatus(
  school: SchoolConfig | null,
  onChange: (status: SchoolEsp32LiveStatus) => void
): () => void {
  if (!school) {
    onChange({ linked: false, online: false, lastSeenMs: null });
    return () => {};
  }

  let active = true;
  let unsubDevice: (() => void) | null = null;
  let unsubBridgeLive: (() => void) | null = null;
  let currentChipId = school.hardware?.connectedChipId?.trim().toLowerCase() || '';
  let fallbackSerial = school.hardware?.connectedSerial?.trim() || '';

  const attachDeviceListener = (chipId: string) => {
    if (!active || !chipId || chipId.length < 4) return;
    if (unsubDevice) {
      unsubDevice();
      unsubDevice = null;
    }
    try {
      const devRef = ref(rtdb, `esp32Bridge/devices/${chipId}`);
      unsubDevice = onValue(
        devRef,
        (snap) => {
          if (!active) return;
          if (!snap.exists()) return;
          const entry = snap.val() as RtdbEsp32BridgeDeviceEntry;
          if (entry?.manualUnassigned === true) {
            onChange({ linked: false, online: false, lastSeenMs: null });
            return;
          }
          const lastSeenMs = typeof entry.lastSeenMs === 'number' ? entry.lastSeenMs : null;
          onChange({
            linked: true,
            online: isEsp32DeviceOnline(lastSeenMs),
            serialNumber: entry.serialNumber || fallbackSerial || undefined,
            chipId,
            lastSeenMs,
            firmwareVersion: entry.firmwareVersion,
          });
        },
        () => {}
      );
    } catch {
      // Ignore listener setup failures; REST fallback continues
    }
  };

  if (currentChipId) {
    attachDeviceListener(currentChipId);
  } else if (school.schoolName) {
    try {
      const schoolKey = toSchoolBridgeKey(school.schoolName);
      unsubBridgeLive = onValue(
        ref(rtdb, `esp32Bridge/schools/${schoolKey}/live`),
        (snap) => {
          if (!active || !snap.exists()) return;
          const val = snap.val() as { connectedChipId?: unknown; connectedSerial?: unknown };
          const foundChip =
            typeof val.connectedChipId === 'string'
              ? val.connectedChipId.trim().toLowerCase()
              : '';
          if (typeof val.connectedSerial === 'string' && val.connectedSerial.trim()) {
            fallbackSerial = val.connectedSerial.trim();
          }
          if (foundChip && foundChip !== currentChipId) {
            currentChipId = foundChip;
            attachDeviceListener(foundChip);
          }
        },
        () => {}
      );
    } catch {
      // Ignore
    }
  }

  return () => {
    active = false;
    if (unsubDevice) unsubDevice();
    if (unsubBridgeLive) unsubBridgeLive();
  };
}

export async function registerEsp32Device(input: {
  serialNumber?: string;
  chipId: string;
  relayPin?: number;
  schoolId?: string | null;
  schoolName?: string | null;
  schoolEmail?: string | null;
}): Promise<Esp32Device> {
  const chipId = clampString(input.chipId, 64).toLowerCase();
  if (!chipId || chipId.length < 4) {
    throw new Error('ESP32 Chip ID is required (at least 4 characters).');
  }
  const cleanSerial =
    input.serialNumber?.trim().toUpperCase() || `BC-${chipId.slice(-4).toUpperCase()}-ESP`;
  const relayPin = Number.isFinite(Number(input.relayPin))
    ? Math.max(0, Math.min(48, Math.round(Number(input.relayPin))))
    : 2;
  const now = Date.now();
  const isLinked = Boolean(input.schoolId && input.schoolName);

  let registeredDevice: Esp32Device | null = null;
  try {
    const res = await fetch('/api/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serialNumber: cleanSerial,
        chipId,
        relayPin,
        schoolId: input.schoolId || null,
        schoolName: input.schoolName || null,
        schoolEmail: input.schoolEmail || null,
      }),
    });
    const data = (await res.json()) as { ok?: boolean; device?: Esp32Device; error?: string };
    if (res.ok && data.device) {
      registeredDevice = data.device;
    } else if (res.status === 400 && data.error) {
      throw new Error(data.error);
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('Chip ID')) {
      throw err;
    }
    // Continue to direct Firebase RTDB persistence when Express is unavailable
  }

  const cleanId = `dev-${chipId.replace(/[^a-z0-9]/g, '')}`;
  const dev: Esp32Device = registeredDevice || {
    id: cleanId,
    serialNumber: cleanSerial,
    chipId,
    status: isLinked ? 'linked' : 'awaiting_assignment',
    schoolId: isLinked ? input.schoolId || null : null,
    schoolName: isLinked ? input.schoolName || null : null,
    schoolEmail: isLinked ? input.schoolEmail || null : null,
    relayPin,
    firstSeenMs: now,
    lastSeenMs: null,
    lastPushMs: null,
  };

  if (auth.currentUser && isFirebaseAdmin(auth.currentUser)) {
    const targetKey = dev.schoolName ? toSchoolBridgeKey(dev.schoolName) : null;
    const writes: Promise<unknown>[] = [
      set(ref(rtdb, `devices/${dev.id}`), dev).catch(() => {}),
      update(ref(rtdb, `esp32Bridge/devices/${dev.chipId}`), {
        chipId: dev.chipId,
        serialNumber: dev.serialNumber,
        assigned: dev.status === 'linked',
        connected: dev.status === 'linked',
        manualUnassigned: false,
        schoolId: dev.schoolId,
        schoolName: dev.schoolName,
        schoolKey: targetKey,
        schoolEmail: dev.schoolEmail,
        relayPin: dev.relayPin,
        firstSeenMs: dev.firstSeenMs,
      }).catch(() => {}),
    ];

    if (dev.status === 'linked' && dev.schoolId && dev.schoolName && targetKey) {
      writes.push(
        update(ref(rtdb, `esp32Bridge/schools/${targetKey}/live`), {
          schoolId: dev.schoolId,
          schoolName: dev.schoolName,
          schoolKey: targetKey,
          enabled: true,
          relayPin: dev.relayPin,
          connectedDeviceId: dev.id,
          connectedChipId: dev.chipId,
          connectedSerial: dev.serialNumber,
          updatedAtMs: now,
        }).catch(() => {}),
        update(ref(rtdb, `schools/${dev.schoolId}/hardware`), {
          connectedDeviceId: dev.id,
          connectedChipId: dev.chipId,
          connectedSerial: dev.serialNumber,
          relayPin: dev.relayPin,
          linkedAtMs: now,
          lastSyncedAtMs: now,
        }).catch(() => {}),
        set(ref(rtdb, 'esp32Bridge/health'), {
          ok: true,
          bridge: 'firebase-rtdb',
          updatedAtMs: now,
        }).catch(() => {})
      );
    }

    await Promise.all(writes);
  }
  return dev;
}

export async function assignEsp32DeviceToSchool(
  deviceId: string,
  school: { id: string; schoolName: string; email?: string | null }
): Promise<Esp32Device> {
  let device: Esp32Device | null = null;
  try {
    const res = await fetch(`/api/devices/${encodeURIComponent(deviceId)}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schoolId: school.id,
        schoolName: school.schoolName,
        schoolEmail: school.email ?? null,
      }),
    });
    const data = (await res.json()) as { ok?: boolean; device?: Esp32Device; error?: string };
    if (res.ok && data.device) {
      device = data.device;
    }
  } catch {
    // Fallback to RTDB assignment if not in Express memory
  }

  const now = Date.now();
  const chipId = device?.chipId || deviceId.replace(/^dev-/, '');
  const updatedDevice: Esp32Device = device || {
    id: deviceId,
    serialNumber: `BC-ESP-${chipId.slice(-4).toUpperCase()}`,
    chipId,
    status: 'linked',
    schoolId: school.id,
    schoolName: school.schoolName,
    schoolEmail: school.email ?? null,
    relayPin: 2,
    firstSeenMs: now,
    lastSeenMs: null,
    lastPushMs: null,
  };

  if (auth.currentUser && isFirebaseAdmin(auth.currentUser)) {
    const schoolKey = toSchoolBridgeKey(school.schoolName);
    await Promise.all([
      set(ref(rtdb, `devices/${updatedDevice.id}`), updatedDevice).catch(() => {}),
      update(ref(rtdb, `esp32Bridge/devices/${chipId}`), {
        chipId,
        serialNumber: updatedDevice.serialNumber,
        assigned: true,
        connected: true,
        manualUnassigned: false,
        schoolId: school.id,
        schoolName: school.schoolName,
        schoolKey,
        schoolEmail: school.email ?? null,
      }).catch(() => {}),
      update(ref(rtdb, `esp32Bridge/schools/${schoolKey}/live`), {
        schoolId: school.id,
        schoolName: school.schoolName,
        schoolKey,
        connectedDeviceId: updatedDevice.id,
        connectedChipId: chipId,
        connectedSerial: updatedDevice.serialNumber,
        updatedAtMs: now,
      }).catch(() => {}),
      update(ref(rtdb, `schools/${school.id}/hardware`), {
        connectedDeviceId: updatedDevice.id,
        connectedChipId: chipId,
        connectedSerial: updatedDevice.serialNumber,
        relayPin: updatedDevice.relayPin,
        linkedAtMs: now,
      }).catch(() => {}),
    ]);
  }
  return updatedDevice;
}

export async function unassignEsp32Device(deviceId: string): Promise<Esp32Device> {
  let device: Esp32Device | null = null;
  try {
    const res = await fetch(`/api/devices/${encodeURIComponent(deviceId)}/unassign`, {
      method: 'POST',
    });
    const data = (await res.json()) as { ok?: boolean; device?: Esp32Device; error?: string };
    if (res.ok && data.device) {
      device = data.device;
    }
  } catch {
    // Fallback to RTDB
  }

  const chipId = device?.chipId || deviceId.replace(/^dev-/, '');
  const updatedDevice: Esp32Device = device || {
    id: deviceId,
    serialNumber: `BC-ESP-${chipId.slice(-4).toUpperCase()}`,
    chipId,
    status: 'awaiting_assignment',
    schoolId: null,
    schoolName: null,
    schoolEmail: null,
    relayPin: 2,
    firstSeenMs: Date.now(),
    lastSeenMs: null,
    lastPushMs: null,
  };

  if (auth.currentUser && isFirebaseAdmin(auth.currentUser)) {
    await Promise.all([
      set(ref(rtdb, `devices/${updatedDevice.id}`), updatedDevice).catch(() => {}),
      update(ref(rtdb, `esp32Bridge/devices/${chipId}`), {
        assigned: false,
        manualUnassigned: true,
        schoolId: null,
        schoolName: null,
        schoolKey: null,
        schoolEmail: null,
      }).catch(() => {}),
    ]);
  }
  return updatedDevice;
}

export async function syncSchoolsRegistryToBridge(schools: SchoolConfig[]): Promise<number> {
  if (!Array.isArray(schools) || schools.length === 0) return 0;

  schools.forEach((s) => {
    schoolMetaCache.set(s.id, {
      id: s.id,
      schoolName: s.schoolName,
      campusLocation: s.campusLocation,
      primaryEmail: s.primaryEmail ?? null,
    });
  });

  if (auth.currentUser) {
    const now = Date.now();
    if (isFirebaseAdmin(auth.currentUser)) {
      set(ref(rtdb, 'esp32Bridge/health'), { ok: true, bridge: 'firebase-rtdb', updatedAtMs: now }).catch(
        () => {}
      );
    }
    schools.forEach((s) => {
      const schoolKey = toSchoolBridgeKey(s.schoolName);
      update(ref(rtdb, `esp32Bridge/schools/${schoolKey}/live`), {
        schoolId: s.id,
        schoolName: s.schoolName,
        schoolKey,
        activeProfile: s.activeProfile,
        autoRingEnabled: s.autoRingEnabled,
        enabled: s.hardware?.config?.enabled ?? true,
        relayPin: s.hardware?.config?.relayPin ?? 2,
        updatedAtMs: now,
      }).catch(() => {});
    });
  }

  try {
    const res = await fetch('/api/schools/registry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schools: schools.map((s) => ({
          id: s.id,
          schoolName: s.schoolName,
          campusLocation: s.campusLocation,
          primaryEmail: s.primaryEmail ?? null,
        })),
      }),
    });
    if (!res.ok) return 0;
    const data = (await res.json()) as { autoLinkedCount?: number };
    return Number(data.autoLinkedCount ?? 0);
  } catch {
    return 0;
  }
}

export async function deleteEsp32Device(deviceId: string): Promise<void> {
  const res = await fetch(`/api/devices/${encodeURIComponent(deviceId)}`, {
    method: 'DELETE',
  }).catch(() => null);
  const chipId = deviceId.replace(/^dev-/, '');
  if (auth.currentUser && isFirebaseAdmin(auth.currentUser)) {
    await Promise.all([
      remove(ref(rtdb, `devices/${deviceId}`)).catch(() => {}),
      remove(ref(rtdb, `esp32Bridge/devices/${chipId}`)).catch(() => {}),
    ]);
  } else if (res && !res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'Unable to delete ESP32 device.');
  }
}

export type { ScheduleProfile };
