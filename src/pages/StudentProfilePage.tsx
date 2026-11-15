import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  Award,
  BookOpen,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  Clock,
  Flame,
  Layers,
  Sparkles,
  Star,
  Trophy,
  UserRound,
  X,
} from 'lucide-react';
import type {
  Assignment,
  ClassMember,
  LearningRecord,
  Lesson,
  ScheduleException,
  SrsCardProgress,
} from '@/types/domain';
import { useAuth } from '@/contexts/AuthContext';
import { useClassContext } from '@/contexts/ClassContext';
import {
  getStudentSrsStates,
  listAssignments,
  listClassMembers,
  listLessons,
  listScheduleExceptions,
  listStudentLearningRecordsByDateRange,
} from '@/services/studyNestService';
import { formatDateInTimezone, formatVietnameseDate } from '@/lib/date';
import { calculateStudentProgressAndStreak } from '@/lib/streak';
import {
  buildLearningContributionCalendar,
  buildMonthlyContributionActivity,
  computeStudentAchievements,
  type AchievementIconKey,
  type ContributionDayCell,
  type MonthlyMilestoneItem,
  type ProfilePeriodFilter,
  type StudentAchievement,
} from '@/lib/learningProfile';
import { EmptyState, RoleBadge, UserAvatar } from '@/components/ui/ThemeBadges';

const HEATMAP_CELL_CLASSES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-slate-100 border-slate-200/80 dark:bg-slate-800/80 dark:border-slate-700/70',
  1: 'bg-emerald-200 border-emerald-300/80 dark:bg-emerald-950 dark:border-emerald-900',
  2: 'bg-emerald-400 border-emerald-500/70 dark:bg-emerald-800 dark:border-emerald-700',
  3: 'bg-emerald-500 border-emerald-600/70 dark:bg-emerald-600 dark:border-emerald-500',
  4: 'bg-emerald-700 border-emerald-800/80 dark:bg-emerald-400 dark:border-emerald-300',
};

const ACHIEVEMENT_TONE_CLASSES: Record<
  StudentAchievement['accentTone'],
  { unlockedWrap: string; iconBox: string; bar: string }
> = {
  emerald: {
    unlockedWrap:
      'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/25',
    iconBox: 'bg-emerald-600 text-white',
    bar: 'bg-emerald-500',
  },
  amber: {
    unlockedWrap:
      'border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/25',
    iconBox: 'bg-amber-500 text-white',
    bar: 'bg-amber-500',
  },
  sky: {
    unlockedWrap:
      'border-sky-200 bg-sky-50/60 dark:border-sky-900/60 dark:bg-sky-950/25',
    iconBox: 'bg-sky-600 text-white',
    bar: 'bg-sky-500',
  },
  violet: {
    unlockedWrap:
      'border-violet-200 bg-violet-50/60 dark:border-violet-900/60 dark:bg-violet-950/25',
    iconBox: 'bg-violet-600 text-white',
    bar: 'bg-violet-500',
  },
};

function AchievementIcon({
  name,
  className = 'h-4 w-4',
}: {
  name: AchievementIconKey;
  className?: string;
}) {
  switch (name) {
    case 'sparkles':
      return <Sparkles className={className} />;
    case 'flame':
      return <Flame className={className} />;
    case 'trophy':
      return <Trophy className={className} />;
    case 'star':
      return <Star className={className} />;
    case 'layers':
      return <Layers className={className} />;
    case 'check_circle':
      return <CheckCircle2 className={className} />;
    case 'calendar':
    default:
      return <Calendar className={className} />;
  }
}

function buildDayAriaLabel(cell: ContributionDayCell): string {
  const dateLabel = formatVietnameseDate(cell.date);
  if (cell.activityCount === 0) {
    if (cell.isDayOff) {
      return `${dateLabel}: Không có hoạt động (${cell.dayOffReason || 'Ngày nghỉ ngoại lệ'})`;
    }
    return `${dateLabel}: Chưa ghi nhận hoạt động học tập`;
  }
  const parts: string[] = [];
  if (cell.confirmedCount > 0) {
    parts.push(`${cell.confirmedCount} mục đã xác nhận`);
  }
  if (cell.pendingCount > 0) {
    parts.push(`${cell.pendingCount} mục chờ xác nhận`);
  }
  if (cell.flashcardCount > 0) {
    parts.push(`${cell.flashcardCount} lượt ôn Flashcard`);
  }
  if (cell.starsAwarded > 0) {
    parts.push(`+${cell.starsAwarded} sao`);
  }
  return `${dateLabel}: ${cell.activityCount} hoạt động (${parts.join(', ')})`;
}

export function StudentProfilePage() {
  const { user } = useAuth();
  const { studyClass, role, isInstructorOrOwner, isStudent } = useClassContext();
  const { studentUid: routeStudentUid } = useParams<{ studentUid?: string }>();
  const navigate = useNavigate();

  const [students, setStudents] = useState<ClassMember[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [exceptions, setExceptions] = useState<ScheduleException[]>([]);
  const [records, setRecords] = useState<LearningRecord[]>([]);
  const [srsStates, setSrsStates] = useState<Record<string, SrsCardProgress>>(
    {}
  );

  const [loadingBase, setLoadingBase] = useState<boolean>(true);
  const [loadingStudent, setLoadingStudent] = useState<boolean>(true);

  const [selectedPeriod, setSelectedPeriod] =
    useState<ProfilePeriodFilter>('last_year');
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [visibleMonthsCount, setVisibleMonthsCount] = useState<number>(3);

  // Bảo vệ phân quyền theo firestore.rules: học sinh chỉ xem được hồ sơ của chính mình
  useEffect(() => {
    if (!studyClass || !user || !isStudent) return;
    if (routeStudentUid && routeStudentUid !== user.uid) {
      navigate(`/app/classes/${studyClass.id}/profile`, { replace: true });
    }
  }, [studyClass, user, isStudent, routeStudentUid, navigate]);

  const loadBaseContext = useCallback(async () => {
    if (!studyClass || !user || !role) return;
    setLoadingBase(true);
    try {
      const [mems, les, asgs, excs] = await Promise.all([
        listClassMembers(studyClass.id),
        listLessons(studyClass.id, role),
        listAssignments(studyClass.id, user.uid, role),
        listScheduleExceptions(studyClass.id),
      ]);
      setStudents(mems.filter((m) => m.role === 'student'));
      setLessons(les);
      setAssignments(asgs);
      setExceptions(excs);
    } finally {
      setLoadingBase(false);
    }
  }, [studyClass, user, role]);

  useEffect(() => {
    void loadBaseContext();
  }, [loadBaseContext]);

  const resolvedStudentUid = useMemo(() => {
    if (!user) return '';
    if (isStudent) return user.uid;
    if (routeStudentUid && students.some((s) => s.uid === routeStudentUid)) {
      return routeStudentUid;
    }
    return students[0]?.uid || '';
  }, [user, isStudent, routeStudentUid, students]);

  useEffect(() => {
    setSelectedDate(null);
    setHoveredDate(null);
    setVisibleMonthsCount(3);
  }, [resolvedStudentUid, selectedPeriod]);

  const loadStudentHistory = useCallback(async () => {
    if (!studyClass || !resolvedStudentUid) {
      setRecords([]);
      setSrsStates({});
      setLoadingStudent(false);
      return;
    }
    setLoadingStudent(true);
    try {
      const [recs, srs] = await Promise.all([
        listStudentLearningRecordsByDateRange({
          classId: studyClass.id,
          studentUid: resolvedStudentUid,
          maxRecords: 800,
        }),
        getStudentSrsStates(studyClass.id, resolvedStudentUid),
      ]);
      setRecords(recs);
      setSrsStates(srs);
    } finally {
      setLoadingStudent(false);
    }
  }, [studyClass, resolvedStudentUid]);

  useEffect(() => {
    void loadStudentHistory();
  }, [loadStudentHistory]);

  const today = studyClass
    ? formatDateInTimezone(new Date(), studyClass.timezone)
    : '2026-11-15';

  const dayOffDates = useMemo(
    () => exceptions.filter((e) => e.isDayOff).map((e) => e.date),
    [exceptions]
  );

  const streakSummary = useMemo(
    () =>
      calculateStudentProgressAndStreak({
        records,
        todayDateStr: today,
        studyDaysOfWeek: studyClass?.studyDaysOfWeek,
        dayOffDates,
      }),
    [records, today, studyClass?.studyDaysOfWeek, dayOffDates]
  );

  const calendar = useMemo(
    () =>
      buildLearningContributionCalendar({
        records,
        srsStates,
        lessons,
        assignments,
        todayDateStr: today,
        selectedPeriod,
        studyDaysOfWeek: studyClass?.studyDaysOfWeek,
        scheduleExceptions: exceptions,
      }),
    [
      records,
      srsStates,
      lessons,
      assignments,
      today,
      selectedPeriod,
      studyClass?.studyDaysOfWeek,
      exceptions,
    ]
  );

  const monthlyActivity = useMemo(
    () =>
      buildMonthlyContributionActivity({
        calendar,
        allTimeRecords: records,
        srsStates,
        lessons,
        assignments,
      }),
    [calendar, records, srsStates, lessons, assignments]
  );

  const achievements = useMemo(
    () =>
      computeStudentAchievements({
        longestStreak: streakSummary.longestStreak,
        totalStars: streakSummary.totalStars,
        confirmedDaysCount: streakSummary.confirmedDaysCount,
        records,
        srsStates,
        totalYearlyActivities: calendar.totalActivities,
      }),
    [
      streakSummary.longestStreak,
      streakSummary.totalStars,
      streakSummary.confirmedDaysCount,
      records,
      srsStates,
      calendar.totalActivities,
    ]
  );

  if (!studyClass || !user || !role) return null;

  const activeStudent = students.find((s) => s.uid === resolvedStudentUid);
  const displayName =
    activeStudent?.displayName ||
    (isStudent ? user.displayName || 'Học sinh' : 'Học sinh');
  const displayAvatar =
    activeStudent?.avatarUrl ||
    (resolvedStudentUid === user.uid ? user.photoURL : '') ||
    '';

  const inspectedCell =
    (hoveredDate && calendar.dayLookup[hoveredDate]) ||
    (selectedDate && calendar.dayLookup[selectedDate]) ||
    calendar.dayLookup[today] ||
    null;

  const selectedDayCell = selectedDate ? calendar.dayLookup[selectedDate] : null;
  const visibleMonths = monthlyActivity.slice(0, visibleMonthsCount);
  const hasMoreMonths = monthlyActivity.length > visibleMonthsCount;
  const isLoading = loadingBase || loadingStudent;

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <div className="space-y-6">
      <h1 className="visually-hidden">Hồ sơ học tập</h1>

      {/* Thanh chọn học sinh (Dành cho Giáo viên / Chủ lớp) */}
      {isInstructorOrOwner && (
        <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
              Hồ sơ học tập &amp; Nhịp độ 365 ngày
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Chọn học sinh để xem biểu đồ hoạt động cả năm, dòng thời gian theo giáo trình và huy hiệu.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {students.map((st) => {
              const isSelected = st.uid === resolvedStudentUid;
              return (
                <button
                  key={st.uid}
                  type="button"
                  onClick={() =>
                    navigate(`/app/classes/${studyClass.id}/profile/${st.uid}`)
                  }
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    isSelected
                      ? 'bg-brand-600 text-white shadow-xs'
                      : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <UserAvatar
                    name={st.displayName}
                    avatarUrl={
                      st.avatarUrl || (st.uid === user.uid ? user.photoURL : '')
                    }
                    size="xs"
                  />
                  {st.displayName}
                </button>
              );
            })}
            <Link
              to={`/app/classes/${studyClass.id}/progress`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Award className="h-3.5 w-3.5 text-amber-500" />
              Xác nhận &amp; Tặng sao
            </Link>
          </div>
        </div>
      )}

      {!loadingBase && !resolvedStudentUid ? (
        <EmptyState
          icon={<UserRound className="h-6 w-6" />}
          title="Lớp chưa có học sinh nào"
          description="Mời học sinh tham gia lớp để bắt đầu theo dõi biểu đồ hoạt động học tập 365 ngày và huy hiệu thành tích."
          action={
            <Link
              to={`/app/classes/${studyClass.id}/members`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white hover:bg-brand-700"
            >
              Đi tới Thành viên &amp; Mời vào lớp
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[296px_minmax(0,1fr)] lg:items-start">
          {/* =============================================================== */}
          {/* CỘT TRÁI: THẺ HỒ SƠ CÁ NHÂN + CHỈ SỐ + HUY HIỆU THÀNH TÍCH     */}
          {/* =============================================================== */}
          <aside className="space-y-5">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-4 lg:flex-col lg:items-start">
                <UserAvatar
                  name={displayName}
                  avatarUrl={displayAvatar}
                  size="xl"
                  className="ring-4 ring-slate-100 dark:ring-slate-800"
                />
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-extrabold text-slate-900 dark:text-white">
                    {displayName}
                  </h2>
                  <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Workspace: {studyClass.name}
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <RoleBadge role="student" />
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      <CalendarCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                      {streakSummary.confirmedDaysCount} ngày xác nhận
                    </span>
                  </div>
                </div>
              </div>

              {/* 4 Chỉ số tổng quan */}
              <div className="mt-5 grid grid-cols-2 gap-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
                <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 p-3 dark:border-amber-900/50 dark:bg-amber-950/25">
                  <div className="flex items-center justify-between text-[11px] font-bold text-amber-800 dark:text-amber-300">
                    <span>Tổng sao</span>
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                  </div>
                  <div className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white">
                    {streakSummary.totalStars}
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/25">
                  <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                    <span>Streak</span>
                    <Flame className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white">
                    {streakSummary.currentStreak} ngày
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-800/50">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    <span>Kỷ lục</span>
                    <Trophy className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                  </div>
                  <div className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">
                    {streakSummary.longestStreak} ngày
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-800/50">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    <span>Chờ duyệt</span>
                    <Clock className="h-3.5 w-3.5 text-amber-500" />
                  </div>
                  <div className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">
                    {streakSummary.pendingConfirmationCount} mục
                  </div>
                </div>
              </div>
            </section>

            {/* Cụm Huy hiệu thành tích (Achievements) */}
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-900 dark:text-white">
                  <Award className="h-4 w-4 text-amber-500" />
                  Huy hiệu thành tích
                </h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {unlockedCount}/{achievements.length}
                </span>
              </div>

              <div className="mt-3.5 space-y-2.5">
                {achievements.map((ach) => {
                  const tone = ACHIEVEMENT_TONE_CLASSES[ach.accentTone];
                  const pct = Math.min(
                    100,
                    Math.round(
                      (ach.currentValue / Math.max(1, ach.targetValue)) * 100
                    )
                  );
                  return (
                    <div
                      key={ach.id}
                      className={`rounded-2xl border p-3 transition ${
                        ach.unlocked
                          ? tone.unlockedWrap
                          : 'border-slate-200/80 bg-slate-50/60 opacity-80 dark:border-slate-800 dark:bg-slate-800/30'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                            ach.unlocked
                              ? tone.iconBox
                              : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          <AchievementIcon name={ach.icon} className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs font-extrabold text-slate-900 dark:text-white">
                              {ach.title}
                            </span>
                            <span className="shrink-0 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                              {ach.unlocked ? 'Đã đạt' : ach.progressLabel}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] leading-snug text-slate-600 dark:text-slate-400">
                            {ach.description}
                          </p>
                          {!ach.unlocked && (
                            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                              <div
                                className={`h-full rounded-full ${tone.bar}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </aside>

          {/* =============================================================== */}
          {/* CỘT PHẢI: HEATMAP 365 NGÀY + DÒNG HOẠT ĐỘNG THEO THÁNG          */}
          {/* =============================================================== */}
          <div className="space-y-6 min-w-0">
            {/* KHỐI 1: BIỂU ĐỒ HOẠT ĐỘNG TRONG NĂM */}
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                    {calendar.totalActivities} hoạt động học tập{' '}
                    {selectedPeriod === 'last_year'
                      ? 'trong năm qua'
                      : `trong năm ${selectedPeriod}`}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {calendar.activeDaysCount} ngày có học •{' '}
                    {calendar.totalFlashcardsReviewed} lượt ôn Flashcard •{' '}
                    {calendar.confirmedDaysCount} ngày được GV xác nhận (+
                    {calendar.totalConfirmedStars} sao)
                  </p>
                </div>

                {/* Bộ chọn năm (Mobile / Tablet nằm gọn trên header, Desktop hiển thị cột dọc bên phải giống GitHub) */}
                <div className="flex flex-wrap items-center gap-1.5 lg:hidden">
                  <button
                    type="button"
                    onClick={() => setSelectedPeriod('last_year')}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                      selectedPeriod === 'last_year'
                        ? 'bg-brand-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    12 tháng qua
                  </button>
                  {calendar.availableYears.map((yr) => (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => setSelectedPeriod(yr)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                        selectedPeriod === yr
                          ? 'bg-brand-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {yr}
                    </button>
                  ))}
                </div>
              </div>

              {isLoading ? (
                <div className="mt-4 h-44 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/60" />
              ) : (
                <div className="mt-4 flex gap-4">
                  <div className="min-w-0 flex-1 rounded-2xl border border-slate-200/90 bg-slate-50/40 p-3.5 sm:p-4 dark:border-slate-800 dark:bg-slate-950/40">
                    {/* Lưới cuộn ngang trên màn hình nhỏ */}
                    <div className="overflow-x-auto pb-1">
                      <div className="inline-flex min-w-[660px] w-full flex-col gap-1.5">
                        {/* Hàng nhãn tháng */}
                        <div className="flex items-center gap-2 pl-7">
                          <div
                            className="grid flex-1 gap-[3px] text-[10px] font-bold text-slate-500 dark:text-slate-400"
                            style={{
                              gridTemplateColumns: `repeat(${calendar.weeks.length}, minmax(10px, 1fr))`,
                            }}
                          >
                            {calendar.monthLabels.map((m) => (
                              <span
                                key={`${m.columnIndex}_${m.label}`}
                                style={{ gridColumnStart: m.columnIndex + 1 }}
                                className="whitespace-nowrap leading-none"
                              >
                                {m.label}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Thân Heatmap: Trục thứ (T2..CN) + 53 cột tuần */}
                        <div className="flex items-stretch gap-2">
                          <div
                            aria-hidden="true"
                            className="grid w-5 shrink-0 grid-rows-7 gap-[3px] text-[10px] font-semibold text-slate-400 dark:text-slate-500"
                          >
                            <span className="flex items-center">T2</span>
                            <span />
                            <span className="flex items-center">T4</span>
                            <span />
                            <span className="flex items-center">T6</span>
                            <span />
                            <span className="flex items-center">CN</span>
                          </div>

                          <div
                            aria-label="Lưới hoạt động học tập theo từng ngày"
                            className="grid flex-1 gap-[3px]"
                            style={{
                              gridTemplateColumns: `repeat(${calendar.weeks.length}, minmax(10px, 1fr))`,
                            }}
                          >
                            {calendar.weeks.map((week, wIdx) => (
                              <div
                                key={wIdx}
                                className="grid grid-rows-7 gap-[3px]"
                              >
                                {week.map((cell) => {
                                  if (!cell.inSelectedRange || cell.isFuture) {
                                    return (
                                      <span
                                        key={cell.date}
                                        aria-hidden="true"
                                        className="aspect-square w-full rounded-[3px] opacity-0"
                                      />
                                    );
                                  }

                                  const isSelected = selectedDate === cell.date;
                                  const isToday = cell.date === today;

                                  return (
                                    <button
                                      key={cell.date}
                                      type="button"
                                      aria-pressed={isSelected}
                                      aria-label={buildDayAriaLabel(cell)}
                                      title={buildDayAriaLabel(cell)}
                                      onMouseEnter={() => setHoveredDate(cell.date)}
                                      onMouseLeave={() => setHoveredDate(null)}
                                      onFocus={() => setHoveredDate(cell.date)}
                                      onBlur={() => setHoveredDate(null)}
                                      onClick={() =>
                                        setSelectedDate((prev) =>
                                          prev === cell.date ? null : cell.date
                                        )
                                      }
                                      className={`aspect-square w-full rounded-[3px] border transition ${
                                        HEATMAP_CELL_CLASSES[cell.intensityLevel]
                                      } ${
                                        isSelected
                                          ? 'ring-2 ring-brand-600 ring-offset-1 dark:ring-brand-400 dark:ring-offset-slate-950'
                                          : isToday
                                          ? 'ring-1 ring-slate-500/70 dark:ring-slate-300/60'
                                          : 'hover:ring-1 hover:ring-slate-400 dark:hover:ring-slate-500'
                                      }`}
                                    />
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Thanh chân biểu đồ: Thông tin ngày đang trỏ + Chú giải màu */}
                    <div className="mt-3 flex flex-col gap-2 border-t border-slate-200/70 pt-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
                      <div className="min-h-[20px] text-xs text-slate-600 dark:text-slate-300">
                        {inspectedCell ? (
                          <span>
                            <strong className="text-slate-900 dark:text-white">
                              {formatVietnameseDate(inspectedCell.date)}:
                            </strong>{' '}
                            {inspectedCell.activityCount > 0 ? (
                              <>
                                {inspectedCell.activityCount} hoạt động (
                                {[
                                  inspectedCell.confirmedCount > 0
                                    ? `${inspectedCell.confirmedCount} đã xác nhận`
                                    : null,
                                  inspectedCell.pendingCount > 0
                                    ? `${inspectedCell.pendingCount} chờ duyệt`
                                    : null,
                                  inspectedCell.flashcardCount > 0
                                    ? `${inspectedCell.flashcardCount} thẻ Flashcard`
                                    : null,
                                  inspectedCell.starsAwarded > 0
                                    ? `+${inspectedCell.starsAwarded} sao`
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join(' • ')}
                                )
                              </>
                            ) : inspectedCell.isDayOff ? (
                              <span>
                                Chưa có hoạt động •{' '}
                                {inspectedCell.dayOffReason || 'Ngày nghỉ'}
                              </span>
                            ) : (
                              'Chưa có hoạt động học tập'
                            )}
                          </span>
                        ) : (
                          <span>
                            Di chuột hoặc chạm vào một ô ngày để xem chi tiết
                          </span>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>Ít</span>
                        {([0, 1, 2, 3, 4] as const).map((lvl) => (
                          <span
                            key={lvl}
                            aria-hidden="true"
                            className={`h-3 w-3 rounded-[3px] border ${HEATMAP_CELL_CLASSES[lvl]}`}
                          />
                        ))}
                        <span>Nhiều</span>
                      </div>
                    </div>
                  </div>

                  {/* Cột chọn năm bên phải (Desktop) giống GitHub Profile */}
                  <div className="hidden lg:flex w-28 shrink-0 flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedPeriod('last_year')}
                      className={`rounded-xl px-3 py-2 text-left text-xs font-bold transition ${
                        selectedPeriod === 'last_year'
                          ? 'bg-brand-600 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                    >
                      12 tháng qua
                    </button>
                    {calendar.availableYears.map((yr) => (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => setSelectedPeriod(yr)}
                        className={`rounded-xl px-3 py-2 text-left text-xs font-bold transition ${
                          selectedPeriod === yr
                            ? 'bg-brand-600 text-white shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                      >
                        {yr}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <p className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400">
                Màu xanh thể hiện nhịp học hàng ngày (bài nộp, bài kiểm tra, buổi học và lượt ôn Flashcard). Riêng chuỗi Streak và Sao thưởng vẫn áp dụng quy tắc cần được người hướng dẫn xác nhận.
              </p>
            </section>

            {/* KHỐI 2: CONTRIBUTION ACTIVITY (DÒNG THỜI GIAN THEO THÁNG HOẶC NGÀY ĐÃ CHỌN) */}
            <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                    Hoạt động học tập
                  </h2>
                </div>

                {selectedDayCell && (
                  <button
                    type="button"
                    onClick={() => setSelectedDate(null)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-950/60 dark:text-brand-300"
                  >
                    <span>
                      Đang lọc: {formatVietnameseDate(selectedDayCell.date, false)}
                    </span>
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {isLoading ? (
                <div className="mt-4 h-48 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/60" />
              ) : selectedDayCell ? (
                <SelectedDayActivityPanel
                  cell={selectedDayCell}
                  onClearSelection={() => setSelectedDate(null)}
                />
              ) : monthlyActivity.length === 0 ? (
                <div className="mt-4">
                  <EmptyState
                    icon={<Calendar className="h-6 w-6" />}
                    title="Chưa có hoạt động trong khoảng thời gian này"
                    description="Khi học sinh làm bài tập, ôn thẻ Flashcard hoặc được giáo viên xác nhận buổi học, toàn bộ lịch sử sẽ hiển thị theo từng tháng tại đây."
                  />
                </div>
              ) : (
                <div className="mt-5 space-y-8">
                  {visibleMonths.map((bucket) => (
                    <div key={bucket.monthKey} className="space-y-4">
                      {/* Tiêu đề tháng kiểu GitHub */}
                      <div className="flex items-center gap-3">
                        <span className="shrink-0 text-xs font-extrabold text-slate-900 dark:text-white">
                          {bucket.label}
                        </span>
                        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                        <span className="shrink-0 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          {bucket.totalRecords} bài/buổi • {bucket.totalFlashcards}{' '}
                          thẻ SRS
                          {bucket.totalStars > 0
                            ? ` • +${bucket.totalStars} sao`
                            : ''}
                        </span>
                      </div>

                      {/* Trục timeline dọc trong tháng */}
                      <div className="ml-3 space-y-5 border-l-2 border-slate-200 pl-5 dark:border-slate-800">
                        {/* Nhóm 1: Hoàn thành bài tập, kiểm tra & buổi học theo giáo trình */}
                        {bucket.totalRecords > 0 && (
                          <div className="relative space-y-2.5">
                            <span
                              aria-hidden="true"
                              className="absolute -left-[31px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            >
                              <BookOpen className="h-3 w-3" />
                            </span>

                            <div className="text-sm font-bold text-slate-900 dark:text-white">
                              Hoàn thành {bucket.totalRecords} nhiệm vụ, kiểm tra
                              &amp; buổi học trong {bucket.subjectGroups.length}{' '}
                              giáo trình
                            </div>

                            <div className="space-y-2">
                              {bucket.subjectGroups.map((grp) => (
                                <details
                                  key={grp.subject}
                                  className="group rounded-2xl border border-slate-200/90 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/30"
                                >
                                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2.5 text-xs hover:bg-slate-100/70 dark:hover:bg-slate-800/70">
                                    <div className="flex min-w-0 items-center gap-2">
                                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200 -rotate-90 group-open:rotate-0 motion-reduce:transition-none" />
                                      <span className="truncate font-extrabold text-brand-700 dark:text-brand-400">
                                        {grp.subject}
                                      </span>
                                      <span className="shrink-0 font-semibold text-slate-500 dark:text-slate-400">
                                        {grp.totalItems} mục
                                      </span>
                                      {grp.starsEarned > 0 && (
                                        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-950/60 dark:text-amber-300">
                                          <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                                          +{grp.starsEarned}
                                        </span>
                                      )}
                                    </div>

                                    <div className="hidden w-32 shrink-0 sm:block">
                                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                                        <div
                                          className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400"
                                          style={{ width: `${grp.barPercent}%` }}
                                        />
                                      </div>
                                    </div>
                                  </summary>

                                  <div className="divide-y divide-slate-200/70 border-t border-slate-200/70 px-3.5 py-2 dark:divide-slate-800 dark:border-slate-800">
                                    {grp.records.map((rec) => (
                                      <div
                                        key={rec.id}
                                        className="flex flex-col justify-between gap-1.5 py-2 text-xs sm:flex-row sm:items-center"
                                      >
                                        <div className="min-w-0">
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="font-semibold text-slate-500 dark:text-slate-400">
                                              {formatVietnameseDate(
                                                rec.date,
                                                false
                                              )}
                                            </span>
                                            <span className="text-slate-300 dark:text-slate-600">
                                              •
                                            </span>
                                            <span className="font-bold text-slate-900 dark:text-white">
                                              {rec.title}
                                            </span>
                                            {rec.quizTotal && rec.quizTotal > 0 ? (
                                              <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-800 dark:bg-violet-950/60 dark:text-violet-300">
                                                Quiz: {rec.quizScore ?? 0}/
                                                {rec.quizTotal}
                                              </span>
                                            ) : null}
                                          </div>
                                          {rec.instructorComment && (
                                            <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                                              Nhận xét GV: “{rec.instructorComment}”
                                            </p>
                                          )}
                                        </div>

                                        <div className="shrink-0">
                                          {rec.isConfirmed ? (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                              <CheckCircle2 className="h-3 w-3" />
                                              Đã xác nhận (+{rec.starsAwarded} sao)
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                              Chờ xác nhận
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </details>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Nhóm 2: Ôn tập Flashcard (SRS) */}
                        {bucket.totalFlashcards > 0 && (
                          <div className="relative space-y-2.5">
                            <span
                              aria-hidden="true"
                              className="absolute -left-[31px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            >
                              <Layers className="h-3 w-3" />
                            </span>

                            <div className="text-sm font-bold text-slate-900 dark:text-white">
                              Luyện tập {bucket.totalFlashcards} lượt thẻ
                              Flashcard (SRS) trong {bucket.flashcardGroups.length}{' '}
                              giáo trình
                            </div>

                            <div className="space-y-1.5">
                              {bucket.flashcardGroups.map((fg) => (
                                <div
                                  key={fg.subject}
                                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-900"
                                >
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-extrabold text-slate-900 dark:text-white">
                                        {fg.subject}
                                      </span>
                                      <span className="font-semibold text-slate-500 dark:text-slate-400">
                                        {fg.reviewCount} lượt thẻ
                                      </span>
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-bold">
                                      {fg.easyCount > 0 && (
                                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                          {fg.easyCount} Nhớ kỹ
                                        </span>
                                      )}
                                      {fg.goodCount > 0 && (
                                        <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                          {fg.goodCount} Tạm nhớ
                                        </span>
                                      )}
                                      {fg.forgotCount > 0 && (
                                        <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-400">
                                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                          {fg.forgotCount} Cần ôn lại
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="hidden w-32 shrink-0 sm:block">
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                                      <div
                                        className="h-full rounded-full bg-emerald-500/80 dark:bg-emerald-400/80"
                                        style={{ width: `${fg.barPercent}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Nhóm 3: Cột mốc nổi bật trong tháng */}
                        {bucket.milestones.length > 0 && (
                          <div className="relative space-y-2">
                            <span
                              aria-hidden="true"
                              className="absolute -left-[31px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            >
                              <Trophy className="h-3 w-3" />
                            </span>

                            <div className="text-sm font-bold text-slate-900 dark:text-white">
                              {bucket.milestones.length} cột mốc nổi bật
                            </div>

                            <div className="space-y-1.5">
                              {bucket.milestones.map((ms: MonthlyMilestoneItem) => (
                                <div
                                  key={ms.id}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800/30"
                                >
                                  <div>
                                    <span className="font-bold text-slate-900 dark:text-white">
                                      {ms.title}
                                    </span>
                                    <span className="ml-2 text-[11px] text-slate-500 dark:text-slate-400">
                                      {ms.subtitle}
                                    </span>
                                  </div>
                                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                    {formatVietnameseDate(ms.date, false)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {hasMoreMonths && (
                    <button
                      type="button"
                      onClick={() => setVisibleMonthsCount((prev) => prev + 3)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-bold text-brand-700 transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/50 dark:text-brand-400 dark:hover:bg-slate-800"
                    >
                      Xem thêm hoạt động tháng trước
                    </button>
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function SelectedDayActivityPanel({
  cell,
  onClearSelection,
}: {
  cell: ContributionDayCell;
  onClearSelection: () => void;
}) {
  const srsBySubject = useMemo(() => {
    const map = new Map<string, number>();
    for (const srs of cell.srsReviews) {
      map.set(srs.subject, (map.get(srs.subject) || 0) + 1);
    }
    return Array.from(map.entries());
  }, [cell.srsReviews]);

  if (cell.activityCount === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-6 text-center dark:border-slate-700 dark:bg-slate-800/30">
        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
          {formatVietnameseDate(cell.date)}: Chưa có hoạt động học tập
        </p>
        {cell.isDayOff && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Ngày nghỉ ngoại lệ ({cell.dayOffReason || 'Không làm đứt Streak'}).
          </p>
        )}
        <button
          type="button"
          onClick={onClearSelection}
          className="mt-3 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          Xem lại theo tháng
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-extrabold text-slate-900 dark:text-white">
            {formatVietnameseDate(cell.date)}
          </span>
          <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
            {cell.activityCount} hoạt động
            {cell.starsAwarded > 0 ? ` • +${cell.starsAwarded} sao` : ''}
          </span>
        </div>
      </div>

      {cell.records.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Nhiệm vụ, kiểm tra &amp; buổi học ({cell.records.length})
          </h3>
          {cell.records.map((rec) => (
            <div
              key={rec.id}
              className="flex flex-col justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-3.5 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {rec.subject}
                  </span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    {rec.title}
                  </span>
                </div>
                {rec.instructorComment && (
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    Nhận xét GV: “{rec.instructorComment}”
                  </p>
                )}
              </div>

              {rec.isConfirmed ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  +{rec.starsAwarded} sao
                </span>
              ) : (
                <span className="inline-flex shrink-0 items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                  Chờ GV xác nhận
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {cell.srsReviews.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Thẻ Flashcard đã luyện tập ({cell.srsReviews.length} thẻ)
          </h3>
          <div className="flex flex-wrap gap-2">
            {srsBySubject.map(([sub, count]) => (
              <span
                key={sub}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200"
              >
                <Layers className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                {sub}: {count} thẻ
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {cell.srsReviews.slice(0, 24).map((s, idx) => (
              <span
                key={`${s.term}_${idx}`}
                className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
                  s.rating === 'easy'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : s.rating === 'forgot'
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                }`}
              >
                {s.term}
              </span>
            ))}
            {cell.srsReviews.length > 24 && (
              <span className="px-2 py-1 text-[11px] font-semibold text-slate-500">
                +{cell.srsReviews.length - 24} thẻ khác
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
