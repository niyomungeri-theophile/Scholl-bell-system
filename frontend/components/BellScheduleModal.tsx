import { X } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import {
  BellSchedule,
  DATE_PATTERN,
  MAX_TITLE_LEN,
  SCHOOL_WEEKDAYS,
  ScheduleProfile,
  TIME_PATTERN,
  WEEKDAYS,
  Weekday,
} from '../types';
import { isOvernightTimeRange } from '../utils/scheduleTime';

interface BellScheduleModalProps {
  isOpen: boolean;
  editingItem: BellSchedule | null;
  defaultProfile: ScheduleProfile;
  onClose: () => void;
  onSave: (payload: Omit<BellSchedule, 'id' | 'ownerId'>, existingId?: string) => Promise<void>;
}

const JS_DAY_TO_WEEKDAY: Weekday[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getTodayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getCurrentLocalHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function weekdayFromDateISO(isoDate: string): Weekday | null {
  if (!DATE_PATTERN.test(isoDate)) return null;
  const parsed = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return JS_DAY_TO_WEEKDAY[parsed.getDay()];
}

export function BellScheduleModal({
  isOpen,
  editingItem,
  defaultProfile,
  onClose,
  onSave,
}: BellScheduleModalProps) {
  const [profile, setProfile] = useState<ScheduleProfile>(defaultProfile);
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('08:00');
  const [endTime, setEndTime] = useState('09:00');
  const [examDate, setExamDate] = useState<string>(() => getTodayLocalISO());
  const [days, setDays] = useState<Weekday[]>(SCHOOL_WEEKDAYS);
  const [teacherName, setTeacherName] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (editingItem) {
      setProfile(editingItem.profile);
      setTitle(editingItem.title);
      setTime(editingItem.time);
      setEndTime(editingItem.endTime || editingItem.time);
      setExamDate(editingItem.examDate || (editingItem.profile === 'Exams' ? getTodayLocalISO() : ''));
      setDays(editingItem.days.length > 0 ? editingItem.days : SCHOOL_WEEKDAYS);
      setTeacherName(editingItem.teacherName || '');
      setEnabled(editingItem.enabled);
    } else {
      const todayISO = getTodayLocalISO();
      const todayDay = weekdayFromDateISO(todayISO) ?? 'Mon';
      setProfile(defaultProfile);
      setTitle('');
      setTime('08:00');
      setEndTime('09:00');
      setExamDate(defaultProfile === 'Exams' ? todayISO : '');
      setDays(defaultProfile === 'Exams' ? [todayDay] : SCHOOL_WEEKDAYS);
      setTeacherName('');
      setEnabled(true);
    }
    setErrorMsg(null);
  }, [isOpen, editingItem, defaultProfile]);

  if (!isOpen) return null;

  const handleProfileSwitch = (nextProfile: ScheduleProfile) => {
    setProfile(nextProfile);
    if (nextProfile === 'Exams') {
      const targetDate = examDate || getTodayLocalISO();
      setExamDate(targetDate);
      const day = weekdayFromDateISO(targetDate);
      if (day) setDays([day]);
    } else if (days.length === 0) {
      setDays(SCHOOL_WEEKDAYS);
    }
  };

  const handleExamDateChange = (nextDate: string) => {
    setExamDate(nextDate);
    const day = weekdayFromDateISO(nextDate);
    if (day) {
      setDays([day]);
    }
  };

  const toggleDay = (day: Weekday) => {
    if (profile === 'Exams') {
      setExamDate('');
      setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
      return;
    }
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 2) {
      setErrorMsg(
        profile === 'Exams'
          ? 'Please enter the exam name (at least 2 characters).'
          : 'Please enter the activity name (at least 2 characters).'
      );
      return;
    }

    if (!TIME_PATTERN.test(time) || !TIME_PATTERN.test(endTime)) {
      setErrorMsg('Start and End times must follow 24-hour HH:MM format.');
      return;
    }

    if (endTime === time) {
      setErrorMsg('End time must be different from start time.');
      return;
    }

    const todayISO = getTodayLocalISO();
    const nowHHMM = getCurrentLocalHHMM();

    if (profile === 'Exams') {
      if (examDate && !DATE_PATTERN.test(examDate)) {
        setErrorMsg('Please select a valid exam date.');
        return;
      }
      if (!examDate && days.length === 0) {
        setErrorMsg('Select the exam date or at least one day for this exam.');
        return;
      }
      if (enabled && examDate) {
        if (examDate < todayISO) {
          setErrorMsg(
            `Expired exam date: ${examDate} has already passed (today is ${todayISO}). Choose today or a future date.`
          );
          return;
        }
        if (
          examDate === todayISO &&
          !isOvernightTimeRange(time, endTime) &&
          endTime <= nowHHMM
        ) {
          setErrorMsg(
            `Expired exam time: ${endTime} has already passed current time (${nowHHMM}). Choose a future time so expired activities do not trigger.`
          );
          return;
        }
      }
    } else if (days.length === 0) {
      setErrorMsg('Select at least one day for this activity.');
      return;
    }

    const trimmedTeacher = teacherName.trim();
    if (profile === 'Exams' && trimmedTeacher.length < 2) {
      setErrorMsg('Please enter the name of the teacher supervising this exam.');
      return;
    }

    const resolvedDays =
      profile === 'Exams' && examDate
        ? ([weekdayFromDateISO(examDate) ?? 'Mon'] as Weekday[])
        : days;

    setSaving(true);
    try {
      await onSave(
        {
          title: trimmedTitle.slice(0, MAX_TITLE_LEN),
          time,
          endTime,
          profile,
          zone: editingItem?.zone || 'All Campus',
          tone: profile === 'Exams' ? 'gentle-tone' : 'brass-bell',
          durationSec: 5,
          days: resolvedDays,
          examDate: profile === 'Exams' ? examDate : '',
          teacherName: profile === 'Exams' ? trimmedTeacher.slice(0, MAX_TITLE_LEN) : '',
          enabled,
        },
        editingItem?.id
      );
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save schedule.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={editingItem ? 'Edit Schedule' : 'Set Schedule'}
    >
      <div className="bg-white dark:bg-[#0B1224] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            {editingItem ? 'Edit Activity Schedule' : 'Set New Activity Schedule'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-200"
            >
              {errorMsg}
            </div>
          )}

          {/* Timetable Profile Switcher: For Studying OR Exams ONLY */}
          <div>
            <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
              Timetable Profile
            </span>
            <div
              role="group"
              aria-label="Timetable Profile"
              className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-slate-100 dark:bg-[#060B19] border border-slate-200 dark:border-slate-800"
            >
              <button
                type="button"
                onClick={() => handleProfileSwitch('Studying')}
                className={`py-2 px-3 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  profile === 'Studying'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                For Studying
              </button>
              <button
                type="button"
                onClick={() => handleProfileSwitch('Exams')}
                className={`py-2 px-3 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  profile === 'Exams'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Exams
              </button>
            </div>
          </div>

          {/* Name of Activity OR Exam Name */}
          <div>
            <label
              htmlFor="bell-title"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              {profile === 'Exams' ? 'Exam Name' : 'Name of Activity'}
            </label>
            <input
              id="bell-title"
              type="text"
              maxLength={MAX_TITLE_LEN}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                profile === 'Exams'
                  ? 'e.g., Mathematics National Exam'
                  : 'e.g., Morning Class Period 1'
              }
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#060B19] text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* When the Exam Takes Place (Exam Date + Day) when profile === 'Exams' */}
          {profile === 'Exams' && (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label
                    htmlFor="exam-date"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Exam Date (When It Will Take Place)
                  </label>
                  {examDate && (
                    <button
                      type="button"
                      onClick={() => setExamDate('')}
                      className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                    >
                      Clear Date
                    </button>
                  )}
                </div>
                <input
                  id="exam-date"
                  type="date"
                  value={examDate}
                  onChange={(e) => handleExamDateChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#060B19] text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Exam Day
                </span>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((day) => {
                    const active = days.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-white dark:bg-[#060B19] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Start Time and End Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="bell-time"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                {profile === 'Exams' ? 'Exam Start Time' : 'Activity Start From'}
              </label>
              <input
                id="bell-time"
                type="text"
                inputMode="numeric"
                maxLength={5}
                placeholder="23:00"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#060B19] text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                24-hour time, e.g. 23:00 (11:00 PM)
              </p>
            </div>

            <div>
              <label
                htmlFor="bell-end-time"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                {profile === 'Exams' ? 'Exam Ending Time' : 'End Time'}
              </label>
              <input
                id="bell-end-time"
                type="text"
                inputMode="numeric"
                maxLength={5}
                placeholder="23:00"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#060B19] text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>
          <p className="-mt-3 text-[11px] text-slate-500 dark:text-slate-400">
            If the end time is earlier than the start time, it ends the next day (e.g. 23:00–00:01).
          </p>

          {(() => {
            const todayISO = getTodayLocalISO();
            const nowHHMM = getCurrentLocalHHMM();
            if (
              profile === 'Exams' &&
              examDate &&
              (examDate < todayISO ||
                (examDate === todayISO &&
                  !isOvernightTimeRange(time, endTime) &&
                  endTime <= nowHHMM))
            ) {
              return (
                <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
                  Pre-flight time check: {examDate} ({time}–{endTime}) is already past current time ({nowHHMM}). Choose a future date/time before saving.
                </div>
              );
            }
            if (
              profile === 'Studying' &&
              TIME_PATTERN.test(endTime) &&
              !isOvernightTimeRange(time, endTime) &&
              endTime <= nowHHMM
            ) {
              return (
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  Note: {endTime} is already past today ({nowHHMM}) — it will not trigger today, and will ring on the next scheduled weekday.
                </p>
              );
            }
            return null;
          })()}

          {/* Conditional Section: Days (For Studying) OR Teacher Name (For Exams) */}
          {profile === 'Studying' ? (
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Select Days (Same Time Daily)
                </span>
                <button
                  type="button"
                  onClick={() => setDays(SCHOOL_WEEKDAYS)}
                  className="text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer"
                >
                  Monday – Friday
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((day) => {
                  const active = days.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white dark:bg-[#060B19] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div>
              <label
                htmlFor="exam-teacher"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Name of Teacher for This Exam
              </label>
              <input
                id="exam-teacher"
                type="text"
                maxLength={MAX_TITLE_LEN}
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                placeholder="e.g., Mr. Jean Bosco Habimana"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#060B19] text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          )}

          <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-4 h-4 accent-blue-600 rounded"
            />
            <span>Schedule active immediately</span>
          </label>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Saving...' : editingItem ? 'Save Changes' : 'Save Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
