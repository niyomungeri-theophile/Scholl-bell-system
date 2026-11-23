export type BellTone = 'brass-bell' | 'westminster-chime' | 'gentle-tone' | 'emergency-alert';
export type ScheduleProfile = 'Studying' | 'Exams';
export type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export type UserRole = 'company_admin' | 'school_user';

export type AppView =
  | 'home'
  | 'about'
  | 'contact'
  | 'campuses'
  | 'announcements'
  | 'login'
  | 'console';

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
  schoolId: string | null;
}

export interface SchoolUserAccount {
  id: string;
  username: string;
  email?: string;
  role: 'school_user';
  schoolId: string;
  createdAtMs: number;
}

export const WEEKDAYS: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const SCHOOL_WEEKDAYS: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export const BELL_TONE_LABELS: Record<BellTone, { name: string; description: string }> = {
  'brass-bell': {
    name: 'Classic Brass Bell',
    description: 'Resonant metallic strike ideal for class transitions and courtyard speakers.',
  },
  'westminster-chime': {
    name: 'Clocktower Chime',
    description: 'Four-note melodic chime suited for morning assembly and main bell towers.',
  },
  'gentle-tone': {
    name: 'Gentle Academic Tone',
    description: 'Soft dual-harmonic chime designed for libraries and examination halls.',
  },
  'emergency-alert': {
    name: 'Campus Alert Signal',
    description: 'High-clarity rhythmic tone for urgent announcements and safety drills.',
  },
};

export interface HardwareCommand {
  commandId: string;
  ringNow: boolean;
  title: string;
  tone: BellTone;
  durationSec: number;
  triggerType: 'Automatic' | 'Manual' | 'Test';
  triggeredAtMs: number;
  expiresAtMs: number;
}

export interface HardwareStatus {
  online: boolean;
  lastHeartbeatMs: number | null;
  relayState: 'IDLE' | 'RINGING';
  ipAddress?: string;
  firmwareVersion?: string;
  lastAckCommandId?: string;
  lastAckAtMs?: number | null;
}

export interface SchoolHardwareConfig {
  deviceId: string;
  deviceKey: string;
  enabled: boolean;
  relayPin: number;
  defaultDurationSec: number;
  timezoneOffsetMinutes: number;
  updatedAtMs: number;
}

export interface SchoolHardwareState {
  config: SchoolHardwareConfig;
  command: HardwareCommand | null;
  status: HardwareStatus;
  lastSyncedAtMs?: number;
  connectedChipId?: string;
  connectedSerial?: string;
}

export interface Esp32Device {
  id: string;
  serialNumber: string;
  chipId: string;
  status: 'linked' | 'awaiting_assignment';
  schoolId: string | null;
  schoolName: string | null;
  schoolEmail: string | null;
  requestedSchoolName?: string | null;
  relayPin: number;
  firstSeenMs: number;
  lastSeenMs: number | null;
  lastPushMs: number | null;
  firmwareVersion?: string;
  syncedActivityCount?: number | null;
  syncedActivitiesSummary?: string | null;
  lastScheduleSyncMs?: number | null;
  nvsSaved?: boolean | null;
  espClockStamp?: string | null;
  espTimezoneOffsetMin?: number | null;
}

export interface SchoolConfig {
  id: string;
  ownerId: string;
  schoolName: string;
  campusLocation: string;
  activeProfile: ScheduleProfile;
  autoRingEnabled: boolean;
  masterVolume: number;
  scheduleCount?: number;
  userCount?: number;
  primaryEmail?: string;
  hardware?: SchoolHardwareState;
}

export interface BellSchedule {
  id: string;
  ownerId: string;
  title: string;
  time: string; // Start time HH:MM (24h)
  endTime: string; // End time HH:MM (24h)
  profile: ScheduleProfile;
  zone: string;
  tone: BellTone;
  durationSec: number;
  days: Weekday[];
  examDate?: string; // Optional YYYY-MM-DD date for Exams
  teacherName?: string;
  enabled: boolean;
}

export interface CampusZone {
  id: string;
  ownerId: string;
  name: string;
  building: string;
  speakerCount: number;
  enabled: boolean;
}

export interface RingLog {
  id: string;
  ownerId: string;
  title: string;
  zone: string;
  tone: BellTone;
  triggerType: 'Automatic' | 'Manual';
  triggeredAtMs: number;
}

export interface CampusShowcasePhoto {
  id: string;
  title: string;
  campusArea: string;
  zoneTag: string;
  tone: BellTone;
  description: string;
  imageSrc: string;
  imageAlt: string;
}

export type AnnouncementAudience = 'public' | 'schools' | 'all';

export interface AnnouncementItem {
  id: string;
  tag: string;
  title: string;
  detail: string;
  audience: AnnouncementAudience;
  createdAtMs: number;
}

export interface ContactInquiry {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  subject: string;
  message: string;
  schoolId?: string;
  schoolName?: string;
  senderRole?: string;
  createdAtMs: number;
}

export const TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_TITLE_LEN = 100;
export const MAX_SCHOOL_NAME_LEN = 140;
export const MAX_USERS_PER_SCHOOL = 2;
