import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Award,
  BookOpen,
  Calendar,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Flame,
  HelpCircle,
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
  0: 'bg-slate-100 border-black/5 dark:bg-slate-800/90 dark:border-white/5',
  1: 'bg-emerald-200 border-emerald-500/20 dark:bg-emerald-950 dark:border-emerald-800/60',
  2: 'bg-emerald-400 border-emerald-600/25 dark:bg-emerald-800 dark:border-emerald-700/70',
  3: 'bg-emerald-500 border-emerald-700/25 dark:bg-emerald-600 dark:border-emerald-500/70',
  4: 'bg-emerald-700 border-emerald-900/30 dark:bg-emerald-400 dark:border-emerald-300/70',
};

const ACHIEVEMENT_TONE_CLASSES: Record<
  StudentAchievement['accentTone'],
  { medallion: string; ring: string; badgeText: string; bar: string }
> = {
  emerald: {
    medallion:
      'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-sm',
    ring: 'ring-emerald-400/70 dark:ring-emerald-500/60',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    bar: 'bg-emerald-500',
  },
  amber: {
    medallion:
      'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-sm',
    ring: 'ring-amber-400/70 dark:ring-amber-500/60',
    badgeText: 'text-amber-700 dark:text-amber-300',
    bar: 'bg-amber-500',
  },
  sky: {
    medallion:
      'bg-gradient-to-br from-sky-400 to-sky-600 text-white shadow-sm',
    ring: 'ring-sky-400/70 dark:ring-sky-500/60',
    badgeText: 'text-sky-700 dark:text-sky-300',
    bar: 'bg-sky-500',
  },
  violet: {
    medallion:
      'bg-gradient-to-br from-violet-400 to-violet-600 text-white shadow-sm',
    ring: 'ring-violet-400/70 dark:ring-violet-500/60',
    badgeText: 'text-violet-700 dark:text-violet-300',
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
  const [showRuleInfo, setShowRuleInfo] = useState<boolean>(false);
  const [activeBadgeId, setActiveBadgeId] = useState<string | null>(null);

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
    null;

  const selectedDayCell = selectedDate ? calendar.dayLookup[selectedDate] : null;
  const visibleMonths = monthlyActivity.slice(0, visibleMonthsCount);
  const hasMoreMonths = monthlyActivity.length > visibleMonthsCount;
  const isLoading = loadingBase || loadingStudent;

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const defaultBadge =
    [...achievements].reverse().find((a) => a.unlocked) ||
    achievements[0] ||
    null;
  const inspectedBadge =
    achievements.find((a) => a.id === activeBadgeId) || defaultBadge;

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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[264px_minmax(0,1fr)] lg:items-start">
          {/* =============================================================== */}
          {/* CỘT TRÁI: HỒ SƠ HỌC SINH KIỂU GITHUB + CHỈ SỐ + HUY HIỆU TRÒN   */}
          {/* =============================================================== */}
          <aside className="space-y-4">
            <div className="flex items-center gap-4 lg:flex-col lg:items-start lg:gap-3">
              <UserAvatar
                name={displayName}
                avatarUrl={displayAvatar}
                size="2xl"
                className="ring-1 ring-slate-200 shadow-xs dark:ring-slate-700"
              />
              <div className="min-w-0">
                <h2 className="truncate text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  {displayName}
                </h2>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  {studyClass.name}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <RoleBadge role="student" />
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    <CalendarCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    {streakSummary.confirmedDaysCount} ngày học
                  </span>
                </div>
              </div>
            </div>

            {/* Nút hành động toàn chiều rộng giống nút Edit profile trên GitHub */}
            <Link
              to={
                isInstructorOrOwner
                  ? `/app/classes/${studyClass.id}/progress`
                  : `/app/classes/${studyClass.id}`
              }
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {isInstructorOrOwner ? 'Chấm sao & Xác nhận' : 'Về Góc học hôm nay'}
            </Link>

            {/* 4 Chỉ số tổng quan gọn gàng */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-amber-200/80 bg-white px-3 py-2 dark:border-amber-900/50 dark:bg-slate-900">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <span>Tổng sao</span>
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                </div>
                <div className="mt-0.5 text-lg font-extrabold text-slate-900 dark:text-white">
                  {streakSummary.totalStars}
                </div>
              </div>

              <div className="rounded-xl border border-emerald-200/80 bg-white px-3 py-2 dark:border-emerald-900/50 dark:bg-slate-900">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <span>Streak</span>
                  <Flame className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="mt-0.5 text-lg font-extrabold text-slate-900 dark:text-white">
                  {streakSummary.currentStreak} ngày
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <span>Kỷ lục</span>
                  <Trophy className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                </div>
                <div className="mt-0.5 text-base font-extrabold text-slate-900 dark:text-white">
                  {streakSummary.longestStreak} ngày
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <span>Chờ duyệt</span>
                  <Clock className="h-3.5 w-3.5 text-amber-500" />
                </div>
                <div className="mt-0.5 text-base font-extrabold text-slate-900 dark:text-white">
                  {streakSummary.pendingConfirmationCount} mục
                </div>
              </div>
            </div>

            {/* Cụm Huy hiệu thành tích kiểu huy chương tròn GitHub */}
            <section className="border-t border-slate-200 pt-4 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Huy hiệu thành tích
                </h2>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {unlockedCount}/{achievements.length}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2.5">
                {achievements.map((ach) => {
                  const tone = ACHIEVEMENT_TONE_CLASSES[ach.accentTone];
                  const isActive = inspectedBadge?.id === ach.id;
                  return (
                    <button
                      key={ach.id}
                      type="button"
                      onClick={() => setActiveBadgeId(ach.id)}
                      onMouseEnter={() => setActiveBadgeId(ach.id)}
                      onFocus={() => setActiveBadgeId(ach.id)}
                      aria-label={`${ach.title}: ${ach.unlocked ? 'Đã đạt' : ach.progressLabel}`}
                      aria-pressed={isActive}
                      title={`${ach.title} (${ach.unlocked ? 'Đã đạt' : ach.progressLabel})`}
                      className={`relative flex h-12 w-12 items-center justify-center rounded-full transition ${
                        ach.unlocked
                          ? `${tone.medallion} ${isActive ? `ring-2 ring-offset-2 ${tone.ring} dark:ring-offset-slate-950` : 'hover:scale-105'}`
                          : `border border-dashed border-slate-300 bg-slate-100 text-slate-400 opacity-60 hover:opacity-90 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-500 ${
                              isActive
                                ? 'opacity-95 ring-2 ring-slate-400 ring-offset-2 dark:ring-slate-500 dark:ring-offset-slate-950'
                                : ''
                            }`
                      }`}
                    >
                      <AchievementIcon name={ach.icon} className="h-5 w-5" />
                      {ach.unlocked && (
                        <span
                          aria-hidden="true"
                          className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-emerald-600 text-white dark:border-slate-950"
                        >
                          <Check className="h-2.5 w-2.5 stroke-[3]" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {inspectedBadge && (
                <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-2xs dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {inspectedBadge.title}
                    </span>
                    <span
                      className={`shrink-0 text-[11px] font-bold ${
                        inspectedBadge.unlocked
                          ? ACHIEVEMENT_TONE_CLASSES[inspectedBadge.accentTone]
                              .badgeText
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {inspectedBadge.unlocked
                        ? 'Đã đạt'
                        : inspectedBadge.progressLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-slate-600 dark:text-slate-400">
                    {inspectedBadge.description}
                  </p>
                  {!inspectedBadge.unlocked && (
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className={`h-full rounded-full ${
                          ACHIEVEMENT_TONE_CLASSES[inspectedBadge.accentTone]
                            .bar
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              (inspectedBadge.currentValue /
                                Math.max(1, inspectedBadge.targetValue)) *
                                100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </section>
          </aside>

          {/* =============================================================== */}
          {/* CỘT PHẢI: HEATMAP 365 NGÀY + DÒNG HOẠT ĐỘNG THEO THÁNG          */}
          {/* =============================================================== */}
          <div className="min-w-0 space-y-6">
            {/* KHỐI 1: BIỂU ĐỒ HOẠT ĐỘNG TRONG NĂM */}
            <section className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm sm:text-base font-medium text-slate-900 dark:text-white">
                  <span className="font-extrabold">
                    {calendar.totalActivities}
                  </span>{' '}
                  hoạt động học tập{' '}
                  {selectedPeriod === 'last_year'
                    ? 'trong năm qua'
                    : `trong năm ${selectedPeriod}`}
                </h2>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Bộ chọn năm (Mobile / Tablet nằm gọn trên header) */}
                  <div className="flex flex-wrap items-center gap-1 lg:hidden">
                    <button
                      type="button"
                      onClick={() => setSelectedPeriod('last_year')}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                        selectedPeriod === 'last_year'
                          ? 'bg-brand-600 text-white shadow-2xs'
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
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                          selectedPeriod === yr
                            ? 'bg-brand-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                      >
                        {yr}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    aria-expanded={showRuleInfo}
                    onClick={() => setShowRuleInfo((prev) => !prev)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  >
                    <span>Cách tính hoạt động</span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${
                        showRuleInfo ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                </div>
              </div>

              {showRuleInfo && (
                <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-600 shadow-2xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                  <div className="font-semibold text-slate-800 dark:text-white">
                    {calendar.activeDaysCount} ngày có học •{' '}
                    {calendar.totalFlashcardsReviewed} lượt ôn Flashcard •{' '}
                    {calendar.confirmedDaysCount} ngày được GV xác nhận (+
                    {calendar.totalConfirmedStars} sao)
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Ô màu xanh ghi nhận mọi nỗ lực học tập trong ngày (bài nộp,
                    bài kiểm tra, buổi học và lượt ôn Flashcard SRS). Riêng
                    chuỗi Streak và Sao thưởng chỉ cộng khi được người hướng dẫn
                    xác nhận.
                  </p>
                </div>
              )}

              {isLoading ? (
                <div className="h-40 animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800/60" />
              ) : (
                <div className="flex items-start gap-3">
                  {/* Khung viền Heatmap chuẩn GitHub */}
                  <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
                    <div className="overflow-x-auto pb-0.5">
                      <div className="w-full min-w-[460px] sm:min-w-0">
                        {/* Hàng nhãn tháng căn chuẩn theo 53 cột */}
                        <div className="relative mb-1 ml-6 h-4 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          {calendar.monthLabels.map((m, mIdx) => {
                            const isLastEdge =
                              mIdx === calendar.monthLabels.length - 1 &&
                              m.columnIndex >= calendar.weeks.length - 3;
                            return (
                              <span
                                key={`${m.columnIndex}_${m.label}`}
                                style={
                                  isLastEdge
                                    ? { right: 0 }
                                    : {
                                        left: `${
                                          (m.columnIndex /
                                            calendar.weeks.length) *
                                          100
                                        }%`,
                                      }
                                }
                                className="absolute top-0 whitespace-nowrap leading-none"
                              >
                                {m.label}
                              </span>
                            );
                          })}
                        </div>

                        {/* Thân Heatmap: Trục T2/T4/T6 + 53 cột tuần */}
                        <div className="flex items-stretch gap-1.5">
                          <div
                            aria-hidden="true"
                            className="grid w-5 shrink-0 grid-rows-7 gap-[2px] xl:gap-[3px] text-[10px] font-medium text-slate-500 dark:text-slate-400"
                          >
                            <span className="flex items-center leading-none">
                              T2
                            </span>
                            <span />
                            <span className="flex items-center leading-none">
                              T4
                            </span>
                            <span />
                            <span className="flex items-center leading-none">
                              T6
                            </span>
                            <span />
                            <span />
                          </div>

                          <div
                            aria-label="Lưới hoạt động học tập theo từng ngày"
                            className="grid flex-1 gap-[2px] xl:gap-[3px]"
                            style={{
                              gridTemplateColumns: `repeat(${calendar.weeks.length}, minmax(0, 1fr))`,
                            }}
                          >
                            {calendar.weeks.map((week, wIdx) => (
                              <div
                                key={wIdx}
                                className="grid grid-rows-7 gap-[2px] xl:gap-[3px]"
                              >
                                {week.map((cell) => {
                                  if (!cell.inSelectedRange || cell.isFuture) {
                                    return (
                                      <span
                                        key={cell.date}
                                        aria-hidden="true"
                                        className="aspect-square w-full rounded-[2px] opacity-0"
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
                                      onMouseEnter={() =>
                                        setHoveredDate(cell.date)
                                      }
                                      onMouseLeave={() => setHoveredDate(null)}
                                      onFocus={() => setHoveredDate(cell.date)}
                                      onBlur={() => setHoveredDate(null)}
                                      onClick={() =>
                                        setSelectedDate((prev) =>
                                          prev === cell.date ? null : cell.date
                                        )
                                      }
                                      className={`aspect-square w-full rounded-[2px] border transition ${
                                        HEATMAP_CELL_CLASSES[
                                          cell.intensityLevel
                                        ]
                                      } ${
                                        isSelected
                                          ? 'ring-2 ring-slate-900 ring-offset-1 dark:ring-white dark:ring-offset-slate-900'
                                          : isToday
                                          ? 'ring-1 ring-emerald-600/80 dark:ring-emerald-400/80'
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

                    {/* Thanh chân bên trong khung Heatmap giống GitHub */}
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <div className="min-w-0">
                        {inspectedCell ? (
                          <span className="inline-flex flex-wrap items-center gap-1.5 text-slate-600 dark:text-slate-300">
                            <strong className="text-slate-900 dark:text-white">
                              {formatVietnameseDate(inspectedCell.date)}:
                            </strong>
                            <span>
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
                                `Chưa có hoạt động • ${inspectedCell.dayOffReason || 'Ngày nghỉ'}`
                              ) : (
                                'Chưa có hoạt động học tập'
                              )}
                            </span>
                            {selectedDate === inspectedCell.date && (
                              <button
                                type="button"
                                onClick={() => setSelectedDate(null)}
                                className="font-semibold text-brand-700 hover:underline dark:text-brand-400"
                              >
                                Bỏ chọn
                              </button>
                            )}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowRuleInfo((prev) => !prev)}
                            className="inline-flex items-center gap-1 text-slate-500 transition hover:text-brand-700 hover:underline dark:text-slate-400 dark:hover:text-brand-400"
                          >
                            <HelpCircle className="h-3 w-3" />
                            <span>Tìm hiểu cách tính hoạt động</span>
                          </button>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <span className="mr-0.5">Ít</span>
                        {([0, 1, 2, 3, 4] as const).map((lvl) => (
                          <span
                            key={lvl}
                            aria-hidden="true"
                            className={`h-[10px] w-[10px] rounded-[2px] border ${HEATMAP_CELL_CLASSES[lvl]}`}
                          />
                        ))}
                        <span className="ml-0.5">Nhiều</span>
                      </div>
                    </div>
                  </div>

                  {/* Cột chọn năm bên phải (Desktop) giống hệt GitHub */}
                  <div className="hidden w-20 xl:w-24 shrink-0 flex-col gap-1 lg:flex">
                    <button
                      type="button"
                      onClick={() => setSelectedPeriod('last_year')}
                      className={`rounded-lg px-3 py-1.5 text-left text-xs font-semibold transition ${
                        selectedPeriod === 'last_year'
                          ? 'bg-brand-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                      }`}
                    >
                      12 tháng
                    </button>
                    {calendar.availableYears.map((yr) => (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => setSelectedPeriod(yr)}
                        className={`rounded-lg px-3 py-1.5 text-left text-xs font-semibold transition ${
                          selectedPeriod === yr
                            ? 'bg-brand-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                        }`}
                      >
                        {yr}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* KHỐI 2: CONTRIBUTION ACTIVITY (DÒNG THỜI GIAN PHẲNG GIỐNG GITHUB) */}
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm sm:text-base font-medium text-slate-900 dark:text-white">
                  Hoạt động học tập
                </h2>

                {selectedDayCell && (
                  <button
                    type="button"
                    onClick={() => setSelectedDate(null)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-950/60 dark:text-brand-300"
                  >
                    <span>
                      Đang lọc: {formatVietnameseDate(selectedDayCell.date, false)}
                    </span>
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {isLoading ? (
                <div className="h-44 animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800/60" />
              ) : selectedDayCell ? (
                <SelectedDayActivityPanel
                  cell={selectedDayCell}
                  onClearSelection={() => setSelectedDate(null)}
                />
              ) : monthlyActivity.length === 0 ? (
                <EmptyState
                  icon={<Calendar className="h-6 w-6" />}
                  title="Chưa có hoạt động trong khoảng thời gian này"
                  description="Khi học sinh làm bài tập, ôn thẻ Flashcard hoặc được giáo viên xác nhận buổi học, toàn bộ lịch sử sẽ hiển thị theo từng tháng tại đây."
                />
              ) : (
                <div className="space-y-7">
                  {visibleMonths.map((bucket) => (
                    <div key={bucket.monthKey} className="space-y-3">
                      {/* Tiêu đề tháng + đường kẻ ngang kiểu GitHub */}
                      <div className="flex items-center gap-3">
                        <span className="shrink-0 text-xs font-bold text-slate-900 dark:text-white">
                          {bucket.label}
                        </span>
                        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                        <span className="shrink-0 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          {bucket.totalRecords} bài • {bucket.totalFlashcards}{' '}
                          thẻ SRS
                          {bucket.totalStars > 0
                            ? ` • +${bucket.totalStars} sao`
                            : ''}
                        </span>
                      </div>

                      {/* Trục timeline dọc mảnh trong tháng */}
                      <div className="ml-3.5 space-y-5 border-l border-slate-200 pl-6 dark:border-slate-800">
                        {/* Nhóm 1: Hoàn thành bài tập, kiểm tra & buổi học theo giáo trình */}
                        {bucket.totalRecords > 0 && (
                          <div className="relative space-y-2">
                            <span
                              aria-hidden="true"
                              className="absolute -left-[38px] top-0 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-600 ring-4 ring-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-950"
                            >
                              <BookOpen className="h-3.5 w-3.5" />
                            </span>

                            <div className="pt-0.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                              Hoàn thành {bucket.totalRecords} nhiệm vụ, kiểm tra
                              &amp; buổi học trong {bucket.subjectGroups.length}{' '}
                              giáo trình
                            </div>

                            <div className="space-y-1">
                              {bucket.subjectGroups.map((grp) => (
                                <details
                                  key={grp.subject}
                                  className="group rounded-lg"
                                >
                                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg py-1.5 pr-1 text-xs transition hover:bg-slate-100/70 dark:hover:bg-slate-800/50 [&::-webkit-details-marker]:hidden">
                                    <div className="flex min-w-0 items-center gap-2">
                                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-90 motion-reduce:transition-none" />
                                      <span className="truncate font-semibold text-brand-700 group-hover:underline dark:text-brand-400">
                                        {grp.subject}
                                      </span>
                                      <span className="shrink-0 text-slate-500 underline decoration-slate-300 underline-offset-2 dark:text-slate-400 dark:decoration-slate-700">
                                        {grp.totalItems} mục
                                      </span>
                                      {grp.starsEarned > 0 && (
                                        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-100/80 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-950/60 dark:text-amber-300">
                                          <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                                          +{grp.starsEarned}
                                        </span>
                                      )}
                                    </div>

                                    <div className="hidden w-32 sm:w-44 shrink-0 sm:block">
                                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                        <div
                                          className="h-full rounded-full bg-emerald-600 dark:bg-emerald-500"
                                          style={{ width: `${grp.barPercent}%` }}
                                        />
                                      </div>
                                    </div>
                                  </summary>

                                  <div className="mt-1 ml-5 divide-y divide-slate-200/70 border-l border-slate-200 pl-3 dark:divide-slate-800 dark:border-slate-800">
                                    {grp.records.map((rec) => (
                                      <div
                                        key={rec.id}
                                        className="flex flex-col justify-between gap-1 py-2 text-xs sm:flex-row sm:items-center"
                                      >
                                        <div className="min-w-0">
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="font-medium text-slate-500 dark:text-slate-400">
                                              {formatVietnameseDate(
                                                rec.date,
                                                false
                                              )}
                                            </span>
                                            <span className="text-slate-300 dark:text-slate-600">
                                              •
                                            </span>
                                            <span className="font-semibold text-slate-900 dark:text-white">
                                              {rec.title}
                                            </span>
                                            {rec.quizTotal &&
                                            rec.quizTotal > 0 ? (
                                              <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-800 dark:bg-violet-950/60 dark:text-violet-300">
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
                                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                              <CheckCircle2 className="h-3 w-3" />
                                              +{rec.starsAwarded} sao
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
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
                          <div className="relative space-y-2">
                            <span
                              aria-hidden="true"
                              className="absolute -left-[38px] top-0 flex h-7 w-7 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 ring-4 ring-slate-50 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-slate-950"
                            >
                              <Layers className="h-3.5 w-3.5" />
                            </span>

                            <div className="pt-0.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                              Luyện tập {bucket.totalFlashcards} lượt thẻ
                              Flashcard (SRS) trong {bucket.flashcardGroups.length}{' '}
                              giáo trình
                            </div>

                            <div className="space-y-1.5">
                              {bucket.flashcardGroups.map((fg) => (
                                <div
                                  key={fg.subject}
                                  className="flex items-center justify-between gap-4 py-1 text-xs"
                                >
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-semibold text-brand-700 dark:text-brand-400">
                                        {fg.subject}
                                      </span>
                                      <span className="text-slate-500 underline decoration-slate-300 underline-offset-2 dark:text-slate-400 dark:decoration-slate-700">
                                        {fg.reviewCount} lượt thẻ
                                      </span>
                                    </div>
                                    <div className="mt-0.5 flex flex-wrap items-center gap-2.5 text-[11px] font-medium">
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

                                  <div className="hidden w-32 sm:w-44 shrink-0 sm:block">
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                      <div
                                        className="h-full rounded-full bg-emerald-500/85 dark:bg-emerald-400/80"
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
                              className="absolute -left-[38px] top-0 flex h-7 w-7 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-700 ring-4 ring-slate-50 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300 dark:ring-slate-950"
                            >
                              <Trophy className="h-3.5 w-3.5" />
                            </span>

                            <div className="pt-0.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                              {bucket.milestones.length} cột mốc nổi bật
                            </div>

                            <div className="space-y-1.5">
                              {bucket.milestones.map((ms: MonthlyMilestoneItem) => (
                                <div
                                  key={ms.id}
                                  className="flex flex-wrap items-center justify-between gap-2 py-1 text-xs"
                                >
                                  <div className="min-w-0">
                                    <span className="font-semibold text-brand-700 dark:text-brand-400">
                                      {ms.title}
                                    </span>
                                    <span className="ml-2 text-[11px] text-slate-500 dark:text-slate-400">
                                      {ms.subtitle}
                                    </span>
                                  </div>
                                  <span className="shrink-0 text-[11px] font-medium text-slate-500 dark:text-slate-400">
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
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 text-xs font-semibold text-brand-700 shadow-2xs transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-brand-400 dark:hover:bg-slate-800"
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
