import type {
  Assignment,
  LearningRecord,
  Lesson,
  ScheduleException,
  SrsCardProgress,
} from '@/types/domain';
import {
  addDaysToDateString,
  getDayOfWeekFromDateString,
  isValidDateString,
} from './date';
import { isScheduledStudyDay } from './streak';

export type ProfilePeriodFilter = 'last_year' | number;

export interface DailyRecordSummary {
  id: string;
  title: string;
  subject: string;
  unitTitle: string;
  taskType: 'standard' | 'flashcard' | 'quiz' | 'session';
  date: string;
  isConfirmed: boolean;
  isSubmitted: boolean;
  starsAwarded: number;
  quizScore?: number;
  quizTotal?: number;
  studentNote: string;
  instructorComment: string;
}

export interface DailySrsReviewSummary {
  subject: string;
  unitTitle: string;
  term: string;
  rating: 'forgot' | 'good' | 'easy';
}

export interface ContributionDayCell {
  date: string;
  monthKey: string; // YYYY-MM
  inSelectedRange: boolean;
  isFuture: boolean;
  isScheduledDay: boolean;
  isDayOff: boolean;
  dayOffReason: string;
  activityCount: number; // Tổng số hoạt động = nhiệm vụ/buổi học + lượt ôn Flashcard
  confirmedCount: number;
  pendingCount: number;
  flashcardCount: number;
  starsAwarded: number;
  intensityLevel: 0 | 1 | 2 | 3 | 4;
  records: DailyRecordSummary[];
  srsReviews: DailySrsReviewSummary[];
}

export interface ContributionMonthLabel {
  columnIndex: number;
  label: string;
}

export interface ContributionCalendarData {
  rangeStart: string;
  rangeEnd: string;
  totalActivities: number;
  confirmedDaysCount: number;
  activeDaysCount: number;
  totalFlashcardsReviewed: number;
  totalConfirmedStars: number;
  availableYears: number[];
  weeks: ContributionDayCell[][]; // [col 0..52][row 0..6] (T2 -> CN)
  monthLabels: ContributionMonthLabel[];
  dayLookup: Record<string, ContributionDayCell>;
}

export interface MonthlySubjectGroup {
  subject: string;
  totalItems: number;
  confirmedItems: number;
  pendingItems: number;
  starsEarned: number;
  barPercent: number;
  records: DailyRecordSummary[];
}

export interface MonthlyFlashcardSubjectGroup {
  subject: string;
  reviewCount: number;
  easyCount: number;
  goodCount: number;
  forgotCount: number;
  barPercent: number;
  unitTitles: string[];
}

export interface MonthlyMilestoneItem {
  id: string;
  kind: 'new_subject' | 'perfect_quiz';
  title: string;
  subtitle: string;
  date: string;
}

export interface MonthlyActivityBucket {
  monthKey: string; // YYYY-MM
  label: string; // VD: "Tháng 11 / 2026"
  totalRecords: number;
  totalFlashcards: number;
  totalStars: number;
  subjectGroups: MonthlySubjectGroup[];
  flashcardGroups: MonthlyFlashcardSubjectGroup[];
  milestones: MonthlyMilestoneItem[];
}

export type AchievementIconKey =
  | 'sparkles'
  | 'flame'
  | 'trophy'
  | 'star'
  | 'layers'
  | 'check_circle'
  | 'calendar';

export interface StudentAchievement {
  id: string;
  title: string;
  description: string;
  icon: AchievementIconKey;
  unlocked: boolean;
  currentValue: number;
  targetValue: number;
  progressLabel: string;
  accentTone: 'emerald' | 'amber' | 'sky' | 'violet';
}

interface ExtractedSrsEvent {
  date: string;
  subject: string;
  unitTitle: string;
  term: string;
  rating: 'forgot' | 'good' | 'easy';
}

const SHORT_MONTH_LABELS = [
  'Th1',
  'Th2',
  'Th3',
  'Th4',
  'Th5',
  'Th6',
  'Th7',
  'Th8',
  'Th9',
  'Th10',
  'Th11',
  'Th12',
];

function formatMonthBucketTitle(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const monthNum = Number(month);
  if (!Number.isFinite(monthNum)) return monthKey;
  return `Tháng ${monthNum} / ${year}`;
}

/** Chuyển ngày trong tuần (0=CN..6=T7) sang chỉ số hàng T2=0..CN=6. */
function getMondayAnchoredRowIndex(dateStr: string): number {
  const dow = getDayOfWeekFromDateString(dateStr);
  return (dow + 6) % 7;
}

/** Tính cường độ màu Heatmap 5 mức (0..4) từ tổng số hoạt động trong ngày. */
export function computeContributionIntensityLevel(
  activityCount: number
): 0 | 1 | 2 | 3 | 4 {
  if (activityCount <= 0) return 0;
  if (activityCount <= 2) return 1;
  if (activityCount <= 5) return 2;
  if (activityCount <= 11) return 3;
  return 4;
}

function buildRecordLookup(
  assignments: Assignment[],
  lessons: Lesson[]
): {
  assignmentById: Map<string, Assignment>;
  lessonById: Map<string, Lesson>;
} {
  return {
    assignmentById: new Map(assignments.map((a) => [a.id, a])),
    lessonById: new Map(lessons.map((l) => [l.id, l])),
  };
}

function enrichLearningRecord(
  rec: LearningRecord,
  assignmentById: Map<string, Assignment>,
  lessonById: Map<string, Lesson>
): DailyRecordSummary {
  const asg = rec.assignmentId ? assignmentById.get(rec.assignmentId) : undefined;
  const linkedLesson = asg?.lessonId ? lessonById.get(asg.lessonId) : undefined;
  const isConfirmed = rec.instructorStatus === 'confirmed';
  const isSubmitted = rec.studentStatus === 'submitted' || isConfirmed;

  let subject = 'Buổi học & Rèn luyện';
  if (asg) {
    subject =
      asg.subject?.trim() ||
      linkedLesson?.subject?.trim() ||
      'Nhiệm vụ & Bài tập';
  }

  return {
    id: rec.id,
    title: rec.title,
    subject,
    unitTitle: asg?.unitTitle?.trim() || linkedLesson?.unitTitle?.trim() || '',
    taskType: rec.type === 'session' ? 'session' : asg?.taskType || 'standard',
    date: rec.date,
    isConfirmed,
    isSubmitted,
    starsAwarded: isConfirmed
      ? Math.max(0, Math.floor(rec.starsAwarded || 0))
      : 0,
    quizScore: rec.quizScore,
    quizTotal: rec.quizTotal,
    studentNote: rec.studentNote || '',
    instructorComment: rec.instructorComment || '',
  };
}

function extractSrsReviewEvents(
  srsStates: Record<string, SrsCardProgress>
): ExtractedSrsEvent[] {
  const events: ExtractedSrsEvent[] = [];

  for (const card of Object.values(srsStates)) {
    if (!card) continue;
    const subject = (card.subject || '').trim() || 'Giáo trình chung';
    const unitTitle = (card.unitTitle || '').trim();
    const seenDates = new Set<string>();

    if (Array.isArray(card.history)) {
      for (const entry of card.history) {
        if (!entry || !isValidDateString(entry.date)) continue;
        if (seenDates.has(entry.date)) continue;
        seenDates.add(entry.date);
        events.push({
          date: entry.date,
          subject,
          unitTitle,
          term: card.term,
          rating: entry.rating,
        });
      }
    }

    // Tương thích ngược với thẻ cũ mới chỉ lưu lastReviewedDate
    if (
      isValidDateString(card.lastReviewedDate) &&
      !seenDates.has(card.lastReviewedDate)
    ) {
      const fallbackRating: 'forgot' | 'good' | 'easy' =
        card.lastRating ||
        (card.level === 3 ? 'easy' : card.level === 1 ? 'forgot' : 'good');
      events.push({
        date: card.lastReviewedDate,
        subject,
        unitTitle,
        term: card.term,
        rating: fallbackRating,
      });
    }
  }

  return events;
}

/**
 * Xây dựng dữ liệu lưới Heatmap 365 ngày (hoặc theo năm chọn) kiểu GitHub Profile.
 */
export function buildLearningContributionCalendar(params: {
  records: LearningRecord[];
  srsStates: Record<string, SrsCardProgress>;
  lessons: Lesson[];
  assignments: Assignment[];
  todayDateStr: string;
  selectedPeriod: ProfilePeriodFilter;
  studyDaysOfWeek?: number[];
  scheduleExceptions?: ScheduleException[];
}): ContributionCalendarData {
  const {
    records,
    srsStates,
    lessons,
    assignments,
    todayDateStr,
    selectedPeriod,
    studyDaysOfWeek = [1, 2, 3, 4, 5],
    scheduleExceptions = [],
  } = params;

  const { assignmentById, lessonById } = buildRecordLookup(assignments, lessons);
  const srsEvents = extractSrsReviewEvents(srsStates);

  // Gom ngày nghỉ ngoại lệ
  const dayOffReasonByDate = new Map<string, string>();
  const dayOffSet = new Set<string>();
  for (const ex of scheduleExceptions) {
    if (ex.isDayOff && isValidDateString(ex.date)) {
      dayOffSet.add(ex.date);
      dayOffReasonByDate.set(ex.date, ex.reason || 'Ngày nghỉ ngoại lệ');
    }
  }

  // Gom các năm có dữ liệu thực + năm hiện tại
  const currentYear = Number(todayDateStr.slice(0, 4)) || 2026;
  const yearSet = new Set<number>([currentYear]);

  // Chỉ số hóa toàn bộ LearningRecord & SRS theo ngày
  const recordsByDate = new Map<string, DailyRecordSummary[]>();
  for (const rawRec of records) {
    if (!isValidDateString(rawRec.date)) continue;
    const enriched = enrichLearningRecord(rawRec, assignmentById, lessonById);
    if (!enriched.isSubmitted && !enriched.isConfirmed) continue;
    yearSet.add(Number(rawRec.date.slice(0, 4)));
    const bucket = recordsByDate.get(rawRec.date) || [];
    bucket.push(enriched);
    recordsByDate.set(rawRec.date, bucket);
  }

  const srsByDate = new Map<string, DailySrsReviewSummary[]>();
  for (const ev of srsEvents) {
    yearSet.add(Number(ev.date.slice(0, 4)));
    const bucket = srsByDate.get(ev.date) || [];
    bucket.push({
      subject: ev.subject,
      unitTitle: ev.unitTitle,
      term: ev.term,
      rating: ev.rating,
    });
    srsByDate.set(ev.date, bucket);
  }

  // Xác định khung lưới tuần (T2 -> CN)
  let rangeStart = '';
  let rangeEnd = '';
  let gridStartMonday = '';
  let gridEndSunday = '';

  if (selectedPeriod === 'last_year') {
    const todayDowOffset = getMondayAnchoredRowIndex(todayDateStr);
    gridEndSunday = addDaysToDateString(todayDateStr, 6 - todayDowOffset);
    gridStartMonday = addDaysToDateString(gridEndSunday, -(52 * 7 + 6));
    rangeStart = gridStartMonday;
    rangeEnd = todayDateStr;
  } else {
    const yearStart = `${selectedPeriod}-01-01`;
    const yearEnd = `${selectedPeriod}-12-31`;
    gridStartMonday = addDaysToDateString(
      yearStart,
      -getMondayAnchoredRowIndex(yearStart)
    );
    gridEndSunday = addDaysToDateString(
      yearEnd,
      6 - getMondayAnchoredRowIndex(yearEnd)
    );
    rangeStart = yearStart;
    rangeEnd = yearEnd < todayDateStr ? yearEnd : todayDateStr;
  }

  const weeks: ContributionDayCell[][] = [];
  const monthLabels: ContributionMonthLabel[] = [];
  const dayLookup: Record<string, ContributionDayCell> = {};

  let totalActivities = 0;
  let confirmedDaysCount = 0;
  let activeDaysCount = 0;
  let totalFlashcardsReviewed = 0;
  let totalConfirmedStars = 0;

  let cursor = gridStartMonday;
  let currentWeek: ContributionDayCell[] = [];
  let lastLabeledMonth = '';
  let lastLabelCol = -10;

  while (cursor <= gridEndSunday) {
    const isFuture = cursor > todayDateStr;
    const inSelectedRange =
      selectedPeriod === 'last_year'
        ? cursor >= rangeStart && cursor <= gridEndSunday
        : cursor.startsWith(`${selectedPeriod}-`);

    const dayRecords = recordsByDate.get(cursor) || [];
    const daySrs = srsByDate.get(cursor) || [];
    const confirmedCount = dayRecords.filter((r) => r.isConfirmed).length;
    const pendingCount = dayRecords.length - confirmedCount;
    const flashcardCount = daySrs.length;
    const activityCount =
      inSelectedRange && !isFuture ? dayRecords.length + flashcardCount : 0;
    const starsAwarded =
      inSelectedRange && !isFuture
        ? dayRecords.reduce((acc, r) => acc + r.starsAwarded, 0)
        : 0;

    const cell: ContributionDayCell = {
      date: cursor,
      monthKey: cursor.slice(0, 7),
      inSelectedRange,
      isFuture,
      isScheduledDay: isScheduledStudyDay(cursor, studyDaysOfWeek, dayOffSet),
      isDayOff: dayOffSet.has(cursor),
      dayOffReason: dayOffReasonByDate.get(cursor) || '',
      activityCount,
      confirmedCount: inSelectedRange && !isFuture ? confirmedCount : 0,
      pendingCount: inSelectedRange && !isFuture ? pendingCount : 0,
      flashcardCount: inSelectedRange && !isFuture ? flashcardCount : 0,
      starsAwarded,
      intensityLevel: computeContributionIntensityLevel(activityCount),
      records: inSelectedRange && !isFuture ? dayRecords : [],
      srsReviews: inSelectedRange && !isFuture ? daySrs : [],
    };

    if (inSelectedRange && !isFuture) {
      dayLookup[cursor] = cell;
      totalActivities += activityCount;
      totalFlashcardsReviewed += flashcardCount;
      totalConfirmedStars += starsAwarded;
      if (activityCount > 0) activeDaysCount += 1;
      if (confirmedCount > 0) confirmedDaysCount += 1;
    }

    currentWeek.push(cell);

    if (currentWeek.length === 7) {
      const colIdx = weeks.length;
      weeks.push(currentWeek);

      // Đặt nhãn tháng tại cột chứa ngày đầu tiên trong tháng (hoặc cột đầu có mặt tháng mới)
      const representativeCell =
        currentWeek.find((d) => d.inSelectedRange && d.date.endsWith('-01')) ||
        (colIdx === 0 ? currentWeek.find((d) => d.inSelectedRange) : undefined) ||
        currentWeek.find(
          (d) =>
            d.inSelectedRange &&
            d.monthKey !== lastLabeledMonth &&
            Number(d.date.slice(8, 10)) <= 7
        );

      if (representativeCell && representativeCell.monthKey !== lastLabeledMonth) {
        const monthNum = Number(representativeCell.monthKey.slice(5, 7));
        if (colIdx - lastLabelCol >= 2 && monthNum >= 1 && monthNum <= 12) {
          monthLabels.push({
            columnIndex: colIdx,
            label: SHORT_MONTH_LABELS[monthNum - 1],
          });
          lastLabeledMonth = representativeCell.monthKey;
          lastLabelCol = colIdx;
        }
      }

      currentWeek = [];
    }

    cursor = addDaysToDateString(cursor, 1);
  }

  const availableYears = Array.from(yearSet)
    .filter((y) => y <= currentYear && y >= 2020)
    .sort((a, b) => b - a);

  return {
    rangeStart,
    rangeEnd,
    totalActivities,
    confirmedDaysCount,
    activeDaysCount,
    totalFlashcardsReviewed,
    totalConfirmedStars,
    availableYears,
    weeks,
    monthLabels,
    dayLookup,
  };
}

/**
 * Gom hoạt động học tập theo từng tháng (Contribution Activity) để hiển thị dòng thời gian.
 */
export function buildMonthlyContributionActivity(params: {
  calendar: ContributionCalendarData;
  allTimeRecords: LearningRecord[];
  srsStates: Record<string, SrsCardProgress>;
  lessons: Lesson[];
  assignments: Assignment[];
}): MonthlyActivityBucket[] {
  const { calendar, allTimeRecords, srsStates, lessons, assignments } = params;
  const { assignmentById, lessonById } = buildRecordLookup(assignments, lessons);

  // Tìm tháng đầu tiên học sinh chạm vào từng giáo trình (để gắn cột mốc "Bắt đầu giáo trình mới")
  const earliestSubjectDate = new Map<string, string>();
  for (const rawRec of allTimeRecords) {
    if (!isValidDateString(rawRec.date)) continue;
    const enriched = enrichLearningRecord(rawRec, assignmentById, lessonById);
    if (!enriched.isSubmitted && !enriched.isConfirmed) continue;
    const prevDate = earliestSubjectDate.get(enriched.subject);
    if (!prevDate || enriched.date < prevDate) {
      earliestSubjectDate.set(enriched.subject, enriched.date);
    }
  }
  for (const ev of extractSrsReviewEvents(srsStates)) {
    const prevDate = earliestSubjectDate.get(ev.subject);
    if (!prevDate || ev.date < prevDate) {
      earliestSubjectDate.set(ev.subject, ev.date);
    }
  }

  // Gom các ngày trong khung đang chọn theo tháng
  const daysByMonth = new Map<string, ContributionDayCell[]>();
  for (const cell of Object.values(calendar.dayLookup)) {
    if (cell.activityCount === 0) continue;
    const list = daysByMonth.get(cell.monthKey) || [];
    list.push(cell);
    daysByMonth.set(cell.monthKey, list);
  }

  const monthKeys = Array.from(daysByMonth.keys()).sort((a, b) =>
    b.localeCompare(a)
  );

  return monthKeys.map((monthKey) => {
    const monthDays = (daysByMonth.get(monthKey) || []).sort((a, b) =>
      b.date.localeCompare(a.date)
    );

    const recordMap = new Map<string, DailyRecordSummary[]>();
    const srsMap = new Map<
      string,
      {
        reviewCount: number;
        easyCount: number;
        goodCount: number;
        forgotCount: number;
        unitSet: Set<string>;
      }
    >();
    const milestones: MonthlyMilestoneItem[] = [];

    let totalRecords = 0;
    let totalFlashcards = 0;
    let totalStars = 0;

    for (const day of monthDays) {
      totalStars += day.starsAwarded;

      for (const rec of day.records) {
        totalRecords += 1;
        const list = recordMap.get(rec.subject) || [];
        list.push(rec);
        recordMap.set(rec.subject, list);

        if (
          rec.quizTotal &&
          rec.quizTotal > 0 &&
          rec.quizScore === rec.quizTotal
        ) {
          milestones.push({
            id: `quiz100_${rec.id}`,
            kind: 'perfect_quiz',
            title: `Đạt điểm tuyệt đối ${rec.quizScore}/${rec.quizTotal}`,
            subtitle: `${rec.title} (${rec.subject})`,
            date: rec.date,
          });
        }
      }

      for (const srs of day.srsReviews) {
        totalFlashcards += 1;
        const cur = srsMap.get(srs.subject) || {
          reviewCount: 0,
          easyCount: 0,
          goodCount: 0,
          forgotCount: 0,
          unitSet: new Set<string>(),
        };
        cur.reviewCount += 1;
        if (srs.rating === 'easy') cur.easyCount += 1;
        else if (srs.rating === 'forgot') cur.forgotCount += 1;
        else cur.goodCount += 1;
        if (srs.unitTitle) cur.unitSet.add(srs.unitTitle);
        srsMap.set(srs.subject, cur);
      }
    }

    // Kiểm tra cột mốc bắt đầu giáo trình mới trong tháng này
    for (const [subject, firstDate] of earliestSubjectDate.entries()) {
      if (firstDate.startsWith(`${monthKey}-`)) {
        milestones.push({
          id: `new_sub_${monthKey}_${subject}`,
          kind: 'new_subject',
          title: `Bắt đầu giáo trình "${subject}"`,
          subtitle: 'Ghi nhận hoạt động học tập đầu tiên',
          date: firstDate,
        });
      }
    }

    const maxRecordCount = Math.max(
      1,
      ...Array.from(recordMap.values()).map((items) => items.length)
    );
    const subjectGroups: MonthlySubjectGroup[] = Array.from(
      recordMap.entries()
    )
      .map(([subject, items]) => {
        const sortedItems = [...items].sort((a, b) =>
          b.date.localeCompare(a.date)
        );
        const confirmedItems = sortedItems.filter((i) => i.isConfirmed).length;
        return {
          subject,
          totalItems: sortedItems.length,
          confirmedItems,
          pendingItems: sortedItems.length - confirmedItems,
          starsEarned: sortedItems.reduce((sum, i) => sum + i.starsAwarded, 0),
          barPercent: Math.max(
            12,
            Math.round((sortedItems.length / maxRecordCount) * 100)
          ),
          records: sortedItems,
        };
      })
      .sort((a, b) => b.totalItems - a.totalItems);

    const maxFlashcardCount = Math.max(
      1,
      ...Array.from(srsMap.values()).map((v) => v.reviewCount)
    );
    const flashcardGroups: MonthlyFlashcardSubjectGroup[] = Array.from(
      srsMap.entries()
    )
      .map(([subject, stat]) => ({
        subject,
        reviewCount: stat.reviewCount,
        easyCount: stat.easyCount,
        goodCount: stat.goodCount,
        forgotCount: stat.forgotCount,
        barPercent: Math.max(
          12,
          Math.round((stat.reviewCount / maxFlashcardCount) * 100)
        ),
        unitTitles: Array.from(stat.unitSet),
      }))
      .sort((a, b) => b.reviewCount - a.reviewCount);

    milestones.sort((a, b) => b.date.localeCompare(a.date));

    return {
      monthKey,
      label: formatMonthBucketTitle(monthKey),
      totalRecords,
      totalFlashcards,
      totalStars,
      subjectGroups,
      flashcardGroups,
      milestones,
    };
  });
}

/**
 * Tự động đánh giá và mở khóa các Huy hiệu thành tích của học sinh từ dữ liệu thực.
 */
export function computeStudentAchievements(params: {
  longestStreak: number;
  totalStars: number;
  confirmedDaysCount: number;
  records: LearningRecord[];
  srsStates: Record<string, SrsCardProgress>;
  totalYearlyActivities: number;
}): StudentAchievement[] {
  const {
    longestStreak,
    totalStars,
    confirmedDaysCount,
    records,
    srsStates,
    totalYearlyActivities,
  } = params;

  const masteredCards = Object.values(srsStates).filter(
    (s) => s && s.level === 3
  ).length;
  const perfectQuizCount = records.filter(
    (r) => r.quizTotal && r.quizTotal > 0 && r.quizScore === r.quizTotal
  ).length;

  return [
    {
      id: 'first_day',
      title: 'Khởi hành vững vàng',
      description: 'Có ít nhất 1 ngày học được người hướng dẫn xác nhận.',
      icon: 'sparkles',
      unlocked: confirmedDaysCount >= 1,
      currentValue: Math.min(confirmedDaysCount, 1),
      targetValue: 1,
      progressLabel: `${Math.min(confirmedDaysCount, 1)}/1 ngày`,
      accentTone: 'emerald',
    },
    {
      id: 'streak_7',
      title: 'Bền bỉ 7 ngày',
      description: 'Duy trì chuỗi học tập liên tiếp từ 7 ngày trở lên.',
      icon: 'flame',
      unlocked: longestStreak >= 7,
      currentValue: Math.min(longestStreak, 7),
      targetValue: 7,
      progressLabel: `${Math.min(longestStreak, 7)}/7 ngày`,
      accentTone: 'emerald',
    },
    {
      id: 'streak_30',
      title: 'Chiến binh 30 ngày',
      description: 'Đạt kỷ lục chuỗi học liên tiếp 30 ngày.',
      icon: 'trophy',
      unlocked: longestStreak >= 30,
      currentValue: Math.min(longestStreak, 30),
      targetValue: 30,
      progressLabel: `${Math.min(longestStreak, 30)}/30 ngày`,
      accentTone: 'amber',
    },
    {
      id: 'stars_50',
      title: 'Kho báu 50 sao',
      description: 'Tích lũy đủ 50 sao thưởng từ người hướng dẫn.',
      icon: 'star',
      unlocked: totalStars >= 50,
      currentValue: Math.min(totalStars, 50),
      targetValue: 50,
      progressLabel: `${Math.min(totalStars, 50)}/50 sao`,
      accentTone: 'amber',
    },
    {
      id: 'mastered_50',
      title: 'Bậc thầy từ vựng',
      description: 'Ghi nhớ kỹ (Mức 3) từ 50 thẻ Flashcard trở lên.',
      icon: 'layers',
      unlocked: masteredCards >= 50,
      currentValue: Math.min(masteredCards, 50),
      targetValue: 50,
      progressLabel: `${Math.min(masteredCards, 50)}/50 thẻ`,
      accentTone: 'sky',
    },
    {
      id: 'perfect_quiz',
      title: 'Thủ khoa Trắc nghiệm',
      description: 'Hoàn thành ít nhất 1 bài trắc nghiệm đạt 100% số câu đúng.',
      icon: 'check_circle',
      unlocked: perfectQuizCount >= 1,
      currentValue: Math.min(perfectQuizCount, 1),
      targetValue: 1,
      progressLabel: `${Math.min(perfectQuizCount, 1)}/1 bài`,
      accentTone: 'violet',
    },
    {
      id: 'yearly_100',
      title: 'Nhịp học đều cả năm',
      description: 'Đạt 100 hoạt động học tập trong khung thời gian đang xem.',
      icon: 'calendar',
      unlocked: totalYearlyActivities >= 100,
      currentValue: Math.min(totalYearlyActivities, 100),
      targetValue: 100,
      progressLabel: `${Math.min(totalYearlyActivities, 100)}/100 hoạt động`,
      accentTone: 'emerald',
    },
  ];
}

