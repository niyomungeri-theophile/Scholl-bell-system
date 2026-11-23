import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.resolve(ROOT_DIR, 'database', 'data');
const HARDWARE_STORE_PATH = path.resolve(DATA_DIR, 'hardware-bridge.json');
const DEVICES_STORE_PATH = path.resolve(DATA_DIR, 'esp32-devices.json');
const SCHOOLS_REGISTRY_PATH = path.resolve(DATA_DIR, 'schools-registry.json');
const RTDB_BASE_URL = 'https://schoolbellsystem-8c6fe-default-rtdb.firebaseio.com';
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

interface SyncedScheduleSlot {
  id: string;
  title: string;
  time: string;
  endTime: string;
  profile: 'Studying' | 'Exams';
  tone: string;
  durationSec: number;
  days: string[];
  examDate?: string;
  enabled: boolean;
}

interface StoredHardwareCommand {
  commandId: string;
  ringNow: boolean;
  title: string;
  tone: string;
  durationSec: number;
  triggerType: 'Automatic' | 'Manual' | 'Test';
  triggeredAtMs: number;
  expiresAtMs: number;
}

interface StoredHardwareStatus {
  lastHeartbeatMs: number | null;
  relayState: 'IDLE' | 'RINGING';
  ipAddress?: string;
  firmwareVersion?: string;
  lastAckCommandId?: string;
  lastAckAtMs?: number | null;
}

interface StoredSchoolHardwareRecord {
  schoolId: string;
  schoolName: string;
  activeProfile: 'Studying' | 'Exams';
  autoRingEnabled: boolean;
  config: {
    deviceId: string;
    deviceKey: string;
    enabled: boolean;
    relayPin: number;
    defaultDurationSec: number;
    timezoneOffsetMinutes: number;
    updatedAtMs: number;
  };
  schedules: SyncedScheduleSlot[];
  command: StoredHardwareCommand | null;
  status: StoredHardwareStatus;
  lastSyncedAtMs: number;
}

interface StoredEsp32Device {
  id: string;
  serialNumber: string;
  chipId: string;
  status: 'linked' | 'awaiting_assignment';
  schoolId: string | null;
  schoolName: string | null;
  schoolEmail: string | null;
  requestedSchoolName?: string | null;
  manualUnassigned?: boolean;
  relayPin: number;
  firstSeenMs: number;
  lastSeenMs: number | null;
  lastPushMs: number | null;
  firmwareVersion?: string;
}

interface RegisteredSchoolMeta {
  id: string;
  schoolName: string;
  campusLocation: string;
  primaryEmail?: string | null;
}

const hardwareStore = new Map<string, StoredSchoolHardwareRecord>();
const deviceStore = new Map<string, StoredEsp32Device>();
const schoolRegistry = new Map<string, RegisteredSchoolMeta>();
const firedMinuteKeys = new Set<string>();
let persistHardwareScheduled = false;
let persistDevicesScheduled = false;
let persistSchoolsScheduled = false;

function normalizeSchoolNameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function findMatchingRegisteredSchool(rawSchoolName: string): RegisteredSchoolMeta | null {
  const key = normalizeSchoolNameKey(rawSchoolName);
  if (!key) return null;

  for (const school of schoolRegistry.values()) {
    if (normalizeSchoolNameKey(school.schoolName) === key) {
      return school;
    }
  }

  for (const record of hardwareStore.values()) {
    if (normalizeSchoolNameKey(record.schoolName) === key) {
      return {
        id: record.schoolId,
        schoolName: record.schoolName,
        campusLocation: 'Main Campus',
        primaryEmail: null,
      };
    }
  }

  return null;
}

async function loadStores(): Promise<void> {
  try {
    const raw = await fs.readFile(HARDWARE_STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, StoredSchoolHardwareRecord>;
    if (parsed && typeof parsed === 'object') {
      Object.entries(parsed).forEach(([schoolId, record]) => {
        if (record && record.schoolId) {
          hardwareStore.set(schoolId, record);
        }
      });
    }
  } catch {
    // Store initialized on first sync
  }

  try {
    const rawDevices = await fs.readFile(DEVICES_STORE_PATH, 'utf8');
    const parsedDevices = JSON.parse(rawDevices) as Record<string, StoredEsp32Device>;
    if (parsedDevices && typeof parsedDevices === 'object') {
      Object.entries(parsedDevices).forEach(([id, device]) => {
        if (device && device.id) {
          deviceStore.set(id, device);
        }
      });
    }
  } catch {
    // Device store initialized on first check-in or registration
  }

  try {
    const rawSchools = await fs.readFile(SCHOOLS_REGISTRY_PATH, 'utf8');
    const parsedSchools = JSON.parse(rawSchools) as Record<string, RegisteredSchoolMeta>;
    if (parsedSchools && typeof parsedSchools === 'object') {
      Object.entries(parsedSchools).forEach(([id, school]) => {
        if (school && school.id && school.schoolName) {
          schoolRegistry.set(id, school);
        }
      });
    }
  } catch {
    // School registry initialized on first console sync
  }
}

function schedulePersistHardware(): void {
  if (persistHardwareScheduled) return;
  persistHardwareScheduled = true;
  setTimeout(async () => {
    persistHardwareScheduled = false;
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const snapshot: Record<string, StoredSchoolHardwareRecord> = {};
      hardwareStore.forEach((value, key) => {
        snapshot[key] = value;
      });
      await fs.writeFile(HARDWARE_STORE_PATH, JSON.stringify(snapshot, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to persist hardware bridge state:', err);
    }
  }, 400);
}

function schedulePersistDevices(): void {
  if (persistDevicesScheduled) return;
  persistDevicesScheduled = true;
  setTimeout(async () => {
    persistDevicesScheduled = false;
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const snapshot: Record<string, StoredEsp32Device> = {};
      deviceStore.forEach((value, key) => {
        snapshot[key] = value;
      });
      await fs.writeFile(DEVICES_STORE_PATH, JSON.stringify(snapshot, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to persist ESP32 devices store:', err);
    }
  }, 300);
}

function schedulePersistSchoolsRegistry(): void {
  if (persistSchoolsScheduled) return;
  persistSchoolsScheduled = true;
  setTimeout(async () => {
    persistSchoolsScheduled = false;
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const snapshot: Record<string, RegisteredSchoolMeta> = {};
      schoolRegistry.forEach((value, key) => {
        snapshot[key] = value;
      });
      await fs.writeFile(SCHOOLS_REGISTRY_PATH, JSON.stringify(snapshot, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to persist schools registry:', err);
    }
  }, 300);
}

function markSchoolDevicesPushed(schoolId: string, nowMs: number): void {
  let updated = false;
  deviceStore.forEach((device) => {
    if (device.schoolId === schoolId) {
      device.lastPushMs = nowMs;
      updated = true;
    }
  });
  if (updated) {
    schedulePersistDevices();
  }
}

async function mirrorCommandToFirebaseFeed(
  deviceKey: string,
  command: StoredHardwareCommand
): Promise<void> {
  if (!deviceKey || deviceKey.length < 16) return;
  try {
    await fetch(`${RTDB_BASE_URL}/hardwareFeeds/${encodeURIComponent(deviceKey)}/command.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
    });
  } catch {
    // Best-effort mirror to RTDB feed
  }
}

function evaluateAutomaticSchedules(): void {
  const nowMs = Date.now();
  hardwareStore.forEach((record) => {
    if (!record.config.enabled || !record.autoRingEnabled) return;

    const tzOffsetMin = Number.isFinite(record.config.timezoneOffsetMinutes)
      ? record.config.timezoneOffsetMinutes
      : 120;
    const localDate = new Date(nowMs + tzOffsetMin * 60_000);
    const sec = localDate.getUTCSeconds();
    if (sec > 3) return;

    const hh = String(localDate.getUTCHours()).padStart(2, '0');
    const mm = String(localDate.getUTCMinutes()).padStart(2, '0');
    const hhmm = `${hh}:${mm}`;
    const todayISO = `${localDate.getUTCFullYear()}-${String(localDate.getUTCMonth() + 1).padStart(
      2,
      '0'
    )}-${String(localDate.getUTCDate()).padStart(2, '0')}`;
    const todayWeekday = WEEKDAY_NAMES[localDate.getUTCDay()];

    const matchingSlots = record.schedules.filter(
      (slot) =>
        slot.enabled &&
        slot.profile === record.activeProfile &&
        (slot.examDate ? slot.examDate === todayISO : slot.days.includes(todayWeekday))
    );

    matchingSlots.forEach((slot) => {
      let titleToRing: string | null = null;
      let dedupeKey: string | null = null;

      if (slot.time === hhmm) {
        titleToRing = slot.title;
        dedupeKey = `${record.schoolId}-${todayISO}-${slot.id}-start-${hhmm}`;
      } else if (slot.endTime && slot.endTime === hhmm && slot.endTime !== slot.time) {
        titleToRing = `${slot.title} (End)`;
        dedupeKey = `${record.schoolId}-${todayISO}-${slot.id}-end-${hhmm}`;
      }

      if (!titleToRing || !dedupeKey || firedMinuteKeys.has(dedupeKey)) return;
      firedMinuteKeys.add(dedupeKey);
      if (firedMinuteKeys.size > 2000) {
        firedMinuteKeys.clear();
        firedMinuteKeys.add(dedupeKey);
      }

      const durationSec = Math.min(
        60,
        Math.max(1, Number(slot.durationSec || record.config.defaultDurationSec || 5))
      );
      const command: StoredHardwareCommand = {
        commandId: `cmd-${nowMs}-${Math.random().toString(36).slice(2, 8)}`,
        ringNow: true,
        title: titleToRing,
        tone: slot.tone || 'brass-bell',
        durationSec,
        triggerType: 'Automatic',
        triggeredAtMs: nowMs,
        expiresAtMs: nowMs + durationSec * 1000,
      };

      record.command = command;
      schedulePersistHardware();
      markSchoolDevicesPushed(record.schoolId, nowMs);
      void mirrorCommandToFirebaseFeed(record.config.deviceKey, command);
    });
  });
}

async function startServer() {
  await loadStores();

  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, database: 'firebase-realtime-database', hardwareBridge: true });
  });

  // =========================================================================
  // SCHOOL REGISTRY SYNC (Maps ESP32 SCHOOL_NAME to Isolated schoolId)
  // =========================================================================

  app.post('/api/schools/registry', (req, res) => {
    const body = (req.body || {}) as {
      schools?: Array<{
        id?: string;
        schoolName?: string;
        campusLocation?: string;
        primaryEmail?: string | null;
      }>;
    };

    if (!Array.isArray(body.schools)) {
      res.status(400).json({ ok: false, error: 'schools array is required.' });
      return;
    }

    const incomingIds = new Set<string>();
    body.schools.forEach((s) => {
      const id = String(s?.id || '').trim();
      const schoolName = String(s?.schoolName || '').trim();
      if (!id || !schoolName) return;
      incomingIds.add(id);
      schoolRegistry.set(id, {
        id,
        schoolName,
        campusLocation: String(s?.campusLocation || 'Main Campus').trim() || 'Main Campus',
        primaryEmail: s?.primaryEmail ? String(s.primaryEmail).trim() : null,
      });
    });

    if (incomingIds.size > 0) {
      Array.from(schoolRegistry.keys()).forEach((existingId) => {
        if (!incomingIds.has(existingId)) {
          schoolRegistry.delete(existingId);
        }
      });
    }
    schedulePersistSchoolsRegistry();

    // Auto-link any waiting ESP32 boards whose configured SCHOOL_NAME matches a registered school
    let autoLinkedCount = 0;
    let updatedDevices = false;
    deviceStore.forEach((device) => {
      if (device.status === 'linked' && device.schoolId) {
        const meta = schoolRegistry.get(device.schoolId);
        if (meta) {
          if (
            device.schoolName !== meta.schoolName ||
            (!device.schoolEmail && (meta.primaryEmail || meta.campusLocation))
          ) {
            device.schoolName = meta.schoolName;
            device.schoolEmail = meta.primaryEmail || meta.campusLocation;
            updatedDevices = true;
          }
        }
        return;
      }

      if (!device.manualUnassigned && device.requestedSchoolName) {
        const match = findMatchingRegisteredSchool(device.requestedSchoolName);
        if (match) {
          device.status = 'linked';
          device.schoolId = match.id;
          device.schoolName = match.schoolName;
          device.schoolEmail = match.primaryEmail || match.campusLocation;
          autoLinkedCount += 1;
          updatedDevices = true;
        }
      }
    });

    if (updatedDevices) {
      schedulePersistDevices();
    }

    res.json({ ok: true, count: schoolRegistry.size, autoLinkedCount });
  });

  // =========================================================================
  // ESP32 DEVICE MANAGEMENT API
  // =========================================================================

  app.get('/api/devices', (req, res) => {
    const schoolIdFilter = String(req.query.schoolId || '').trim();
    const list = Array.from(deviceStore.values())
      .filter((d) => (!schoolIdFilter ? true : d.schoolId === schoolIdFilter))
      .sort((a, b) => b.firstSeenMs - a.firstSeenMs);
    res.json({ ok: true, devices: list });
  });

  app.post('/api/devices', (req, res) => {
    const body = (req.body || {}) as {
      serialNumber?: string;
      chipId?: string;
      relayPin?: number;
      schoolId?: string | null;
      schoolName?: string | null;
      schoolEmail?: string | null;
      firmwareVersion?: string;
    };

    const chipId = String(body.chipId || '').trim().toLowerCase();
    const serialNumber = String(body.serialNumber || '').trim().toUpperCase();
    if (!chipId || chipId.length < 4) {
      res.status(400).json({ ok: false, error: 'ESP32 Chip ID is required (min 4 characters).' });
      return;
    }

    const existingByChip = Array.from(deviceStore.values()).find(
      (d) => d.chipId.toLowerCase() === chipId
    );
    const nowMs = Date.now();
    const cleanSerial =
      serialNumber ||
      existingByChip?.serialNumber ||
      `BC-${String(deviceStore.size + 1).padStart(2, '0')}-ESP`;

    const schoolId = body.schoolId ? String(body.schoolId).trim() : null;
    const device: StoredEsp32Device = {
      id: existingByChip?.id || `dev-${chipId.replace(/[^a-z0-9]/g, '')}`,
      serialNumber: cleanSerial,
      chipId,
      status: schoolId ? 'linked' : existingByChip?.status || 'awaiting_assignment',
      schoolId: schoolId || existingByChip?.schoolId || null,
      schoolName: schoolId
        ? String(body.schoolName || existingByChip?.schoolName || 'Registered School')
        : existingByChip?.schoolName || null,
      schoolEmail: schoolId
        ? body.schoolEmail
          ? String(body.schoolEmail)
          : existingByChip?.schoolEmail || null
        : existingByChip?.schoolEmail || null,
      relayPin: Math.max(0, Math.min(48, Number(body.relayPin ?? existingByChip?.relayPin ?? 2))),
      firstSeenMs: existingByChip?.firstSeenMs ?? nowMs,
      lastSeenMs: existingByChip?.lastSeenMs ?? null,
      lastPushMs: existingByChip?.lastPushMs ?? null,
      firmwareVersion: body.firmwareVersion || existingByChip?.firmwareVersion,
    };

    deviceStore.set(device.id, device);
    schedulePersistDevices();
    res.json({ ok: true, device });
  });

  app.post('/api/devices/:id/assign', (req, res) => {
    const id = String(req.params.id || '').trim();
    const device = deviceStore.get(id);
    if (!device) {
      res.status(404).json({ ok: false, error: 'ESP32 device not found.' });
      return;
    }
    const body = (req.body || {}) as {
      schoolId?: string;
      schoolName?: string;
      schoolEmail?: string | null;
    };
    const schoolId = String(body.schoolId || '').trim();
    if (!schoolId) {
      res.status(400).json({ ok: false, error: 'schoolId is required.' });
      return;
    }

    device.schoolId = schoolId;
    device.schoolName = String(body.schoolName || 'Registered School').trim();
    device.schoolEmail = body.schoolEmail ? String(body.schoolEmail).trim() : null;
    device.requestedSchoolName = null;
    device.manualUnassigned = false;
    device.status = 'linked';
    deviceStore.set(device.id, device);
    schedulePersistDevices();
    res.json({ ok: true, device });
  });

  app.post('/api/devices/:id/unassign', (req, res) => {
    const id = String(req.params.id || '').trim();
    const device = deviceStore.get(id);
    if (!device) {
      res.status(404).json({ ok: false, error: 'ESP32 device not found.' });
      return;
    }
    device.schoolId = null;
    device.schoolName = null;
    device.schoolEmail = null;
    device.manualUnassigned = true;
    device.status = 'awaiting_assignment';
    deviceStore.set(device.id, device);
    schedulePersistDevices();
    res.json({ ok: true, device });
  });

  app.delete('/api/devices/:id', (req, res) => {
    const id = String(req.params.id || '').trim();
    if (!deviceStore.has(id)) {
      res.status(404).json({ ok: false, error: 'ESP32 device not found.' });
      return;
    }
    deviceStore.delete(id);
    schedulePersistDevices();
    res.json({ ok: true });
  });

  // ESP32 Hardware Board Auto-Check-In & Poll Endpoint
  // Reads Chip ID + configured SCHOOL_NAME from firmware to bind strictly to that school's isolated data
  app.get('/api/esp32/poll', (req, res) => {
    const chipId = String(req.query.chipId || req.headers['x-chip-id'] || '')
      .trim()
      .toLowerCase();
    const serialQuery = String(req.query.serial || req.headers['x-serial-number'] || '')
      .trim()
      .toUpperCase();
    const requestedSchoolNameRaw = String(
      req.query.schoolName || req.headers['x-school-name'] || ''
    ).trim();
    const requestedPinRaw = req.query.pin !== undefined ? Number(req.query.pin) : NaN;
    const firmwareVersion = String(req.query.fw || '').trim() || undefined;

    if (!chipId || chipId.length < 4) {
      res.status(400).json({ ok: false, ringNow: false, error: 'chipId query parameter required.' });
      return;
    }

    const nowMs = Date.now();
    let device = Array.from(deviceStore.values()).find((d) => d.chipId.toLowerCase() === chipId);

    const matchedSchool = requestedSchoolNameRaw
      ? findMatchingRegisteredSchool(requestedSchoolNameRaw)
      : null;

    if (!device) {
      const initialPin =
        Number.isFinite(requestedPinRaw) && requestedPinRaw >= 0 && requestedPinRaw <= 48
          ? Math.round(requestedPinRaw)
          : 2;

      device = {
        id: `dev-${chipId.replace(/[^a-z0-9]/g, '')}`,
        serialNumber: serialQuery || `BC-${String(deviceStore.size + 1).padStart(2, '0')}-ESP`,
        chipId,
        status: matchedSchool ? 'linked' : 'awaiting_assignment',
        schoolId: matchedSchool ? matchedSchool.id : null,
        schoolName: matchedSchool ? matchedSchool.schoolName : null,
        schoolEmail: matchedSchool
          ? matchedSchool.primaryEmail || matchedSchool.campusLocation
          : null,
        requestedSchoolName: requestedSchoolNameRaw || null,
        manualUnassigned: false,
        relayPin: initialPin,
        firstSeenMs: nowMs,
        lastSeenMs: nowMs,
        lastPushMs: null,
        firmwareVersion,
      };
      deviceStore.set(device.id, device);
      schedulePersistDevices();
    } else {
      device.lastSeenMs = nowMs;
      if (firmwareVersion) device.firmwareVersion = firmwareVersion;
      if (serialQuery && device.serialNumber.startsWith('BC-')) {
        device.serialNumber = serialQuery;
      }

      if (requestedSchoolNameRaw) {
        const previousReq = normalizeSchoolNameKey(device.requestedSchoolName || '');
        const nextReq = normalizeSchoolNameKey(requestedSchoolNameRaw);
        if (nextReq && nextReq !== previousReq) {
          device.manualUnassigned = false;
        }
        device.requestedSchoolName = requestedSchoolNameRaw;

        // If board is awaiting assignment (and not manually unassigned under same schoolName)
        // OR if a newly flashed SCHOOL_NAME targets a different registered school, auto-route strictly to that school
        if (
          matchedSchool &&
          ((device.status !== 'linked' && !device.manualUnassigned) ||
            (nextReq !== previousReq && matchedSchool.id !== device.schoolId))
        ) {
          device.status = 'linked';
          device.schoolId = matchedSchool.id;
          device.schoolName = matchedSchool.schoolName;
          device.schoolEmail = matchedSchool.primaryEmail || matchedSchool.campusLocation;
          device.manualUnassigned = false;
        }
      }

      schedulePersistDevices();
    }

    if (!device.schoolId || device.status !== 'linked') {
      res.json({
        ok: true,
        assigned: false,
        status: 'awaiting_assignment',
        serialNumber: device.serialNumber,
        chipId: device.chipId,
        requestedSchoolName: device.requestedSchoolName || '',
        ringNow: false,
        relayPin: device.relayPin,
        serverTimeMs: nowMs,
      });
      return;
    }

    // Strict per-school isolation: only ever read hardwareStore for this device's exact linked schoolId
    const record = hardwareStore.get(device.schoolId);
    const cmd = record?.command || null;
    const activeRing = Boolean(
      record && record.config.enabled && cmd && cmd.ringNow && nowMs < cmd.expiresAtMs
    );

    if (record) {
      record.status = {
        ...record.status,
        lastHeartbeatMs: nowMs,
        relayState: activeRing ? 'RINGING' : 'IDLE',
      };
    }

    res.json({
      ok: true,
      assigned: true,
      status: 'linked',
      serialNumber: device.serialNumber,
      chipId: device.chipId,
      schoolId: device.schoolId,
      schoolName: device.schoolName || record?.schoolName || 'Assigned School',
      autoRingEnabled: record?.autoRingEnabled ?? true,
      activeProfile: record?.activeProfile ?? 'Studying',
      relayPin: typeof device.relayPin === 'number' ? device.relayPin : record?.config.relayPin ?? 2,
      ringNow: activeRing,
      commandId: cmd?.commandId || '',
      title: cmd?.title || '',
      tone: cmd?.tone || 'brass-bell',
      durationSec: cmd?.durationSec || record?.config.defaultDurationSec || 5,
      triggerType: cmd?.triggerType || 'Automatic',
      remainingMs: activeRing && cmd ? Math.max(0, cmd.expiresAtMs - nowMs) : 0,
      serverTimeMs: nowMs,
    });
  });

  // =========================================================================
  // SCHOOL HARDWARE BRIDGE SYNC & COMMAND DISPATCH
  // =========================================================================

  app.post('/api/hardware/:schoolId/sync', (req, res) => {
    const schoolId = String(req.params.schoolId || '').trim();
    if (!schoolId) {
      res.status(400).json({ ok: false, error: 'schoolId is required.' });
      return;
    }

    const body = (req.body || {}) as Partial<StoredSchoolHardwareRecord> & {
      config?: Partial<StoredSchoolHardwareRecord['config']>;
    };
    const existing = hardwareStore.get(schoolId);
    const nowMs = Date.now();

    const nextConfig = {
      deviceId: String(
        body.config?.deviceId || existing?.config.deviceId || `HW-${schoolId.slice(-6).toUpperCase()}`
      ),
      deviceKey: String(body.config?.deviceKey || existing?.config.deviceKey || ''),
      enabled:
        typeof body.config?.enabled === 'boolean'
          ? body.config.enabled
          : existing?.config.enabled ?? true,
      relayPin: Math.max(
        0,
        Math.min(48, Number(body.config?.relayPin ?? existing?.config.relayPin ?? 2))
      ),
      defaultDurationSec: Math.max(
        1,
        Math.min(
          60,
          Number(body.config?.defaultDurationSec ?? existing?.config.defaultDurationSec ?? 5)
        )
      ),
      timezoneOffsetMinutes: Number.isFinite(Number(body.config?.timezoneOffsetMinutes))
        ? Number(body.config?.timezoneOffsetMinutes)
        : existing?.config.timezoneOffsetMinutes ?? 120,
      updatedAtMs: nowMs,
    };

    const nextSchedules: SyncedScheduleSlot[] = Array.isArray(body.schedules)
      ? body.schedules.map((s) => ({
          id: String(s.id || ''),
          title: String(s.title || 'Period'),
          time: String(s.time || '08:00'),
          endTime: String(s.endTime || s.time || '08:00'),
          profile: s.profile === 'Exams' ? 'Exams' : 'Studying',
          tone: String(s.tone || 'brass-bell'),
          durationSec: Math.max(1, Math.min(60, Number(s.durationSec ?? 5))),
          days: Array.isArray(s.days) ? s.days.map(String) : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
          examDate: typeof s.examDate === 'string' ? s.examDate : '',
          enabled: Boolean(s.enabled ?? true),
        }))
      : existing?.schedules || [];

    const record: StoredSchoolHardwareRecord = {
      schoolId,
      schoolName: String(body.schoolName || existing?.schoolName || 'Registered School'),
      activeProfile: body.activeProfile === 'Exams' ? 'Exams' : existing?.activeProfile || 'Studying',
      autoRingEnabled:
        typeof body.autoRingEnabled === 'boolean'
          ? body.autoRingEnabled
          : existing?.autoRingEnabled ?? true,
      config: nextConfig,
      schedules: nextSchedules,
      command: existing?.command ?? null,
      status: existing?.status ?? {
        lastHeartbeatMs: null,
        relayState: 'IDLE',
      },
      lastSyncedAtMs: nowMs,
    };

    hardwareStore.set(schoolId, record);
    schedulePersistHardware();
    res.json({ ok: true, schoolId, lastSyncedAtMs: nowMs, scheduleCount: nextSchedules.length });
  });

  app.post('/api/hardware/:schoolId/command', (req, res) => {
    const schoolId = String(req.params.schoolId || '').trim();
    const record = hardwareStore.get(schoolId);
    const body = (req.body || {}) as {
      commandId?: string;
      title?: string;
      tone?: string;
      durationSec?: number;
      triggerType?: 'Automatic' | 'Manual' | 'Test';
      deviceKey?: string;
    };

    const nowMs = Date.now();
    const durationSec = Math.max(
      1,
      Math.min(60, Number(body.durationSec ?? record?.config.defaultDurationSec ?? 5))
    );
    const command: StoredHardwareCommand = {
      commandId: String(
        body.commandId || `cmd-${nowMs}-${Math.random().toString(36).slice(2, 8)}`
      ),
      ringNow: true,
      title: String(body.title || 'School Bell'),
      tone: String(body.tone || 'brass-bell'),
      durationSec,
      triggerType:
        body.triggerType === 'Manual' || body.triggerType === 'Test'
          ? body.triggerType
          : 'Automatic',
      triggeredAtMs: nowMs,
      expiresAtMs: nowMs + durationSec * 1000,
    };

    if (record) {
      record.command = command;
      schedulePersistHardware();
      void mirrorCommandToFirebaseFeed(body.deviceKey || record.config.deviceKey, command);
    } else {
      hardwareStore.set(schoolId, {
        schoolId,
        schoolName: 'Registered School',
        activeProfile: 'Studying',
        autoRingEnabled: true,
        config: {
          deviceId: `HW-${schoolId.slice(-6).toUpperCase()}`,
          deviceKey: body.deviceKey || '',
          enabled: true,
          relayPin: 2,
          defaultDurationSec: durationSec,
          timezoneOffsetMinutes: 120,
          updatedAtMs: nowMs,
        },
        schedules: [],
        command,
        status: { lastHeartbeatMs: null, relayState: 'RINGING' },
        lastSyncedAtMs: nowMs,
      });
      schedulePersistHardware();
    }

    markSchoolDevicesPushed(schoolId, nowMs);
    res.json({ ok: true, command });
  });

  app.post('/api/hardware/:schoolId/stop', (req, res) => {
    const schoolId = String(req.params.schoolId || '').trim();
    const record = hardwareStore.get(schoolId);
    const nowMs = Date.now();
    const stopCommand: StoredHardwareCommand = {
      commandId: `stop-${nowMs}`,
      ringNow: false,
      title: 'Bell Stopped',
      tone: 'brass-bell',
      durationSec: 0,
      triggerType: 'Manual',
      triggeredAtMs: nowMs,
      expiresAtMs: nowMs,
    };

    if (record) {
      record.command = stopCommand;
      record.status = {
        ...record.status,
        relayState: 'IDLE',
      };
      schedulePersistHardware();
      void mirrorCommandToFirebaseFeed(record.config.deviceKey, stopCommand);
    }

    res.json({ ok: true, command: stopCommand });
  });

  app.get('/api/hardware/:schoolId/command', (req, res) => {
    const schoolId = String(req.params.schoolId || '').trim();
    const key = String(req.query.key || req.headers['x-hardware-key'] || '').trim();
    const record = hardwareStore.get(schoolId);

    if (!record) {
      res.status(404).json({
        ok: false,
        ringNow: false,
        error: 'School hardware bridge not synced yet.',
      });
      return;
    }

    if (!key || !record.config.deviceKey || key !== record.config.deviceKey) {
      res.status(401).json({ ok: false, ringNow: false, error: 'Invalid hardware key.' });
      return;
    }

    const nowMs = Date.now();
    const cmd = record.command;
    const activeRing = Boolean(
      record.config.enabled && cmd && cmd.ringNow && nowMs < cmd.expiresAtMs
    );

    record.status = {
      ...record.status,
      lastHeartbeatMs: nowMs,
      relayState: activeRing ? 'RINGING' : 'IDLE',
      ipAddress:
        record.status.ipAddress ||
        String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || ''),
    };

    res.json({
      ok: true,
      schoolId: record.schoolId,
      schoolName: record.schoolName,
      deviceId: record.config.deviceId,
      hardwareEnabled: record.config.enabled,
      autoRingEnabled: record.autoRingEnabled,
      activeProfile: record.activeProfile,
      relayPin: record.config.relayPin,
      ringNow: activeRing,
      commandId: cmd?.commandId || '',
      title: cmd?.title || '',
      tone: cmd?.tone || 'brass-bell',
      durationSec: cmd?.durationSec || record.config.defaultDurationSec,
      triggerType: cmd?.triggerType || 'Automatic',
      triggeredAtMs: cmd?.triggeredAtMs || 0,
      expiresAtMs: cmd?.expiresAtMs || 0,
      remainingMs: activeRing && cmd ? Math.max(0, cmd.expiresAtMs - nowMs) : 0,
      serverTimeMs: nowMs,
      timezoneOffsetMinutes: record.config.timezoneOffsetMinutes,
      schedules: record.schedules.filter((s) => s.enabled && s.profile === record.activeProfile),
    });
  });

  app.post('/api/hardware/:schoolId/heartbeat', (req, res) => {
    const schoolId = String(req.params.schoolId || '').trim();
    const body = (req.body || {}) as {
      key?: string;
      relayState?: 'IDLE' | 'RINGING';
      ipAddress?: string;
      firmwareVersion?: string;
      ackCommandId?: string;
    };
    const key = String(body.key || req.query.key || req.headers['x-hardware-key'] || '').trim();
    const record = hardwareStore.get(schoolId);

    if (!record) {
      res.status(404).json({ ok: false, error: 'School hardware not registered.' });
      return;
    }
    if (!key || !record.config.deviceKey || key !== record.config.deviceKey) {
      res.status(401).json({ ok: false, error: 'Invalid hardware key.' });
      return;
    }

    const nowMs = Date.now();
    record.status = {
      lastHeartbeatMs: nowMs,
      relayState: body.relayState === 'RINGING' ? 'RINGING' : 'IDLE',
      ipAddress: body.ipAddress || record.status.ipAddress,
      firmwareVersion: body.firmwareVersion || record.status.firmwareVersion,
      lastAckCommandId: body.ackCommandId || record.status.lastAckCommandId,
      lastAckAtMs: body.ackCommandId ? nowMs : record.status.lastAckAtMs ?? null,
    };
    schedulePersistHardware();

    res.json({ ok: true, serverTimeMs: nowMs, online: true });
  });

  app.get('/api/hardware/:schoolId/status', (req, res) => {
    const schoolId = String(req.params.schoolId || '').trim();
    const record = hardwareStore.get(schoolId);
    if (!record) {
      res.json({
        ok: true,
        status: { online: false, lastHeartbeatMs: null, relayState: 'IDLE' },
        command: null,
        lastSyncedAtMs: null,
      });
      return;
    }

    const nowMs = Date.now();
    const online = Boolean(
      record.status.lastHeartbeatMs && nowMs - record.status.lastHeartbeatMs < 120_000
    );
    res.json({
      ok: true,
      status: {
        ...record.status,
        online,
      },
      command: record.command,
      lastSyncedAtMs: record.lastSyncedAtMs,
    });
  });

  setInterval(evaluateAutomaticSchedules, 1000);

  // Vite / Static Frontend Serving
  if (process.env.NODE_ENV !== 'production') {
    const vitePromise = import('vite')
      .then(({ createServer: createViteServer }) =>
        createViteServer({
          server: {
            middlewareMode: true,
            hmr: false,
            ws: false,
            watch: null,
          },
          appType: 'spa',
        })
      )
      .catch((err) => {
        console.error('Failed to initialize Vite middleware:', err);
        throw err;
      });

    app.use(async (req, res, next) => {
      try {
        const vite = await vitePromise;
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distDir = path.resolve(ROOT_DIR, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BellCraft School Bell server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
