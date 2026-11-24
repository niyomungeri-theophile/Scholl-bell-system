import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BellSchedule, SCHOOL_WEEKDAYS, SchoolConfig, WEEKDAYS, Weekday } from '../types';
import { isOvernightTimeRange } from './scheduleTime';

type JsPdfWithAutoTable = jsPDF & {
  lastAutoTable?: {
    finalY: number;
  };
};

const WEEKDAY_FULL_NAMES: Record<Weekday, string> = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
  Sun: 'Sunday',
};

const JS_DAY_TO_WEEKDAY: Weekday[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function sanitizeFilename(name: string): string {
  return (
    name
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'School'
  );
}

function getScheduleTargetDays(item: BellSchedule): Weekday[] {
  if (item.profile === 'Exams' && item.examDate) {
    const parsed = new Date(`${item.examDate}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return [JS_DAY_TO_WEEKDAY[parsed.getDay()]];
    }
  }
  if (item.days && item.days.length > 0) {
    return item.days;
  }
  return SCHOOL_WEEKDAYS;
}

function getActiveDayColumns(schedules: BellSchedule[]): Weekday[] {
  const usedDays = new Set<Weekday>(SCHOOL_WEEKDAYS);
  schedules.forEach((item) => {
    getScheduleTargetDays(item).forEach((d) => usedDays.add(d));
  });
  return WEEKDAYS.filter((day) => usedDays.has(day));
}

function formatTimeRange(item: BellSchedule): string {
  const start = item.time || '--:--';
  const end = item.endTime && item.endTime !== item.time ? item.endTime : '';
  return end
    ? `${start} - ${end}${isOvernightTimeRange(start, end) ? ' (+1 day)' : ''}`
    : start;
}

function renderSchoolHeader(
  doc: jsPDF,
  school: SchoolConfig,
  schedules: BellSchedule[],
  generatedAt: string
): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Top Title Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 27, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(`${school.schoolName.toUpperCase()} — WEEKLY BELL CALENDAR`, 12, 11.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const subParts = [school.campusLocation, school.primaryEmail].filter(Boolean);
  doc.setTextColor(203, 213, 225);
  doc.text(subParts.join('  •  ') || 'BellCraft Automatic School Bell', 12, 18);
  doc.text(`Generated: ${generatedAt}`, pageWidth - 12, 18, { align: 'right' });

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  const activeProfileLabel = school.activeProfile === 'Exams' ? 'Exams' : 'Studying';
  const modeLabel = school.autoRingEnabled ? 'Automatic' : 'Manual';
  doc.text(
    `Active Profile: ${activeProfileLabel}   •   Bell Mode: ${modeLabel}   •   Total Activities: ${schedules.length}`,
    12,
    23.5
  );

  // Color Legend Bar
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(12, 30, pageWidth - 24, 10, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Day-by-Day Calendar (Each day ordered by its own start & end time)', 16, 36.3);

  const legendStartX = pageWidth - 78;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(148, 163, 184);
  doc.rect(legendStartX, 32.8, 4.5, 4.5, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text('Studying Activity', legendStartX + 6.5, 36.2);

  doc.setFillColor(255, 237, 213);
  doc.setDrawColor(234, 88, 12);
  doc.rect(legendStartX + 35, 32.8, 4.5, 4.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(154, 52, 18);
  doc.text('Exam (Ezame)', legendStartX + 41.5, 36.2);

  return 43;
}

function renderSchoolSection(
  doc: JsPdfWithAutoTable,
  school: SchoolConfig,
  schedules: BellSchedule[],
  generatedAt: string
): void {
  const startY = renderSchoolHeader(doc, school, schedules, generatedAt);

  if (schedules.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('No activities have been scheduled for this school yet.', 12, startY + 8);
    return;
  }

  const dayColumns = getActiveDayColumns(schedules);

  // Build an independent chronological list per day (handles differing times per day cleanly)
  const itemsByDay: Record<Weekday, BellSchedule[]> = {
    Mon: [],
    Tue: [],
    Wed: [],
    Thu: [],
    Fri: [],
    Sat: [],
    Sun: [],
  };

  schedules.forEach((item) => {
    getScheduleTargetDays(item).forEach((day) => {
      if (!itemsByDay[day].some((existing) => existing.id === item.id)) {
        itemsByDay[day].push(item);
      }
    });
  });

  dayColumns.forEach((day) => {
    itemsByDay[day].sort((a, b) => {
      const tCmp = (a.time || '').localeCompare(b.time || '');
      if (tCmp !== 0) return tCmp;
      return (a.endTime || '').localeCompare(b.endTime || '');
    });
  });

  const maxRows = Math.max(1, ...dayColumns.map((day) => itemsByDay[day].length));

  const cellKindMatrix: Array<Array<'no' | 'studying' | 'exam' | 'empty'>> = [];
  const bodyRows: string[][] = [];

  for (let rowIdx = 0; rowIdx < maxRows; rowIdx++) {
    const rowKinds: Array<'no' | 'studying' | 'exam' | 'empty'> = ['no'];
    const rowCells: string[] = [String(rowIdx + 1)];

    dayColumns.forEach((day) => {
      const item = itemsByDay[day][rowIdx];
      if (!item) {
        rowKinds.push('empty');
        rowCells.push('');
        return;
      }

      const isExam = item.profile === 'Exams';
      rowKinds.push(isExam ? 'exam' : 'studying');

      const timeRange = formatTimeRange(item);
      const pausedTag = item.enabled ? '' : ' (Paused)';
      if (isExam) {
        const dateTag = item.examDate ? ` • ${item.examDate}` : '';
        rowCells.push(`${timeRange}\n[EXAM${dateTag}] ${item.title}${pausedTag}`);
      } else {
        rowCells.push(`${timeRange}\n${item.title}${pausedTag}`);
      }
    });

    cellKindMatrix.push(rowKinds);
    bodyRows.push(rowCells);
  }

  const headRow = [
    'NO',
    ...dayColumns.map((d) => `${WEEKDAY_FULL_NAMES[d]} (${itemsByDay[d].length})`),
  ];

  // Landscape A4: 297mm width - 24mm margins = 273mm usable width
  const pageWidth = doc.internal.pageSize.getWidth();
  const printableWidth = pageWidth - 24;
  const noWidth = 11;
  const dayColWidth = (printableWidth - noWidth) / dayColumns.length;

  const columnStyles: Record<
    number,
    { cellWidth?: number; halign?: 'left' | 'center' | 'right'; fontStyle?: 'normal' | 'bold' }
  > = {
    0: { cellWidth: noWidth, halign: 'center', fontStyle: 'bold' },
  };
  dayColumns.forEach((_, idx) => {
    columnStyles[1 + idx] = { cellWidth: dayColWidth, halign: 'left' };
  });

  autoTable(doc, {
    startY,
    head: [headRow],
    body: bodyRows,
    theme: 'grid',
    showHead: 'everyPage',
    margin: { left: 12, right: 12, bottom: 14 },
    styles: {
      fontSize: 8.2,
      cellPadding: 2.8,
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.25,
      valign: 'top',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
      valign: 'middle',
    },
    columnStyles,
    didParseCell: (data) => {
      if (data.section !== 'body') return;

      const kind = cellKindMatrix[data.row.index]?.[data.column.index] ?? 'empty';
      if (kind === 'no') {
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.textColor = [51, 65, 85];
        data.cell.styles.valign = 'middle';
      } else if (kind === 'exam') {
        data.cell.styles.fillColor = [255, 237, 213];
        data.cell.styles.textColor = [154, 52, 18];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.lineColor = [251, 146, 60];
      } else if (kind === 'empty') {
        data.cell.styles.fillColor = [248, 250, 252];
      } else {
        data.cell.styles.fillColor = data.row.index % 2 === 1 ? [248, 250, 252] : [255, 255, 255];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = [15, 23, 42];
      }
    },
  });
}

function addPageFooters(doc: jsPDF): void {
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('BellCraft Automatic School Bell System', 12, pageHeight - 7);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 12, pageHeight - 7, { align: 'right' });
  }
}

export function downloadSchoolSchedulePdf(school: SchoolConfig, schedules: BellSchedule[]): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }) as JsPdfWithAutoTable;
  const generatedAt = new Date().toLocaleString();
  renderSchoolSection(doc, school, schedules, generatedAt);
  addPageFooters(doc);
  const fileName = `${sanitizeFilename(school.schoolName)}_Calendar_Timetable.pdf`;
  doc.save(fileName);
}

export function downloadAllSchoolsSchedulePdf(
  entries: Array<{ school: SchoolConfig; schedules: BellSchedule[] }>
): void {
  if (entries.length === 0) return;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }) as JsPdfWithAutoTable;
  const generatedAt = new Date().toLocaleString();

  entries.forEach((entry, idx) => {
    if (idx > 0) {
      doc.addPage();
    }
    renderSchoolSection(doc, entry.school, entry.schedules, generatedAt);
  });

  addPageFooters(doc);
  doc.save('BellCraft_All_Schools_Calendar_Timetable.pdf');
}
