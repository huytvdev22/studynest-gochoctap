import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Backpack,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  CloudSun,
  Eye,
  Flame,
  Layers,
  Moon,
  PartyPopper,
  Plus,
  RotateCw,
  Send,
  Sparkles,
  Star,
  Sun,
  UserPlus,
  Users,
} from 'lucide-react';
import type {
  Assignment,
  ClassMember,
  JoinRequest,
  LearningRecord,
  Lesson,
  ScheduleException,
  ScheduleItem,
  SrsCardProgress,
} from '@/types/domain';
import { useAuth } from '@/contexts/AuthContext';
import { useClassContext } from '@/contexts/ClassContext';
import {
  confirmOrReviewLearningRecord,
  getStudentSrsStates,
  listAssignments,
  listClassMembers,
  listJoinRequests,
  listLearningRecords,
  listLessons,
  listScheduleExceptions,
  listSchedules,
  saveStudentSrsStates,
  submitStudentCompletion,
} from '@/services/studyNestService';
import {
  DAY_OF_WEEK_LABELS,
  formatVietnameseDate,
  getTodayAndTomorrow,
} from '@/lib/date';
import { calculateStudentProgressAndStreak } from '@/lib/streak';
import { inferDefaultTtsLang, makeSrsCardKey } from '@/lib/studyAiAndSrs';
import { UserAvatar } from '@/components/ui/ThemeBadges';
import {
  FlashcardStudyModal,
  QuizTakeModal,
} from '@/components/study/InteractiveStudyModals';
import { SubmissionDetailModal } from '@/components/study/SubmissionDetailModal';

export function ClassDashboardPage() {
  const { user } = useAuth();
  const { studyClass, role, isOwner, isInstructorOrOwner } =
    useClassContext();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [records, setRecords] = useState<LearningRecord[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [exceptions, setExceptions] = useState<ScheduleException[]>([]);
  const [pendingRequests, setPendingRequests] = useState<JoinRequest[]>([]);
  const [students, setStudents] = useState<ClassMember[]>([]);
  const [selectedStudentUid, setSelectedStudentUid] = useState<string>('');
  const [reviewTab, setReviewTab] = useState<'pending' | 'reviewed'>('pending');
  const [loading, setLoading] = useState<boolean>(true);

  // State cho học sinh nộp bài nhanh & làm Flashcard / Quiz
  const [submittingTaskId, setSubmittingTaskId] = useState<string | null>(null);
  const [srsStates, setSrsStates] = useState<Record<string, SrsCardProgress>>(
    {}
  );
  const [activeFlashcardTask, setActiveFlashcardTask] =
    useState<Assignment | null>(null);
  const [activeQuizTask, setActiveQuizTask] = useState<Assignment | null>(null);
  const [todayTaskFilter, setTodayTaskFilter] = useState<
    'all' | 'pending' | 'completed'
  >('all');
  const [tomorrowSessionTab, setTomorrowSessionTab] = useState<
    'all' | 'morning' | 'afternoon' | 'evening'
  >('all');

  // State cho instructor xác nhận nhanh
  const [confirmingRecordId, setConfirmingRecordId] = useState<string | null>(
    null
  );
  const [reviewComments, setReviewComments] = useState<Record<string, string>>(
    {}
  );
  const [reviewStars, setReviewStars] = useState<Record<string, number>>({});
  const [viewingRecord, setViewingRecord] = useState<LearningRecord | null>(null);

  const loadDashboardData = useCallback(async () => {
    if (!studyClass || !user || !role) return;
    setLoading(true);
    try {
      const [asg, rec, les, sch, exc, srs, mems] = await Promise.all([
        listAssignments(studyClass.id, user.uid, role),
        listLearningRecords(studyClass.id, user.uid, role, 80),
        listLessons(studyClass.id, role),
        listSchedules(studyClass.id),
        listScheduleExceptions(studyClass.id),
        getStudentSrsStates(studyClass.id, user.uid),
        listClassMembers(studyClass.id),
      ]);
      setAssignments(asg);
      setRecords(rec);
      setLessons(les);
      setSchedules(sch);
      setExceptions(exc);
      setSrsStates(srs);
      setStudents(mems.filter((m) => m.role === 'student'));

      if (isOwner) {
        const reqs = await listJoinRequests(studyClass.id);
        setPendingRequests(reqs.filter((r) => r.status === 'pending'));
      }
    } finally {
      setLoading(false);
    }
  }, [studyClass, user, role, isOwner]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  if (!studyClass || !user || !role) return null;

  const { today, todayDayOfWeek, tomorrowDayOfWeek } =
    getTodayAndTomorrow(new Date(), studyClass.timezone);

  // Các bài học & nhiệm vụ được chỉ định cho HÔM NAY (dueDate === today)
  const todayTasks = assignments.filter((a) => a.dueDate === today);
  // Các nhiệm vụ khác (có hạn ngày khác)
  const otherTasks = assignments.filter((a) => a.dueDate !== today);

  const tomorrowSchedules = schedules.filter(
    (s) => s.dayOfWeek === tomorrowDayOfWeek
  );
  const todaySchedules = schedules.filter((s) => s.dayOfWeek === todayDayOfWeek);

  const sortScheduleItemsByPeriod = (items: ScheduleItem[]) => {
    return [...items].sort((a, b) => (a.periodNumber || 0) - (b.periodNumber || 0));
  };

  const tomorrowMorningSchedules = sortScheduleItemsByPeriod(
    tomorrowSchedules.filter((s) => s.sessionOfDay === 'morning')
  );
  const tomorrowAfternoonSchedules = sortScheduleItemsByPeriod(
    tomorrowSchedules.filter((s) => s.sessionOfDay === 'afternoon')
  );
  const tomorrowEveningSchedules = sortScheduleItemsByPeriod(
    tomorrowSchedules.filter((s) => s.sessionOfDay === 'evening')
  );
  const tomorrowOtherSchedules = sortScheduleItemsByPeriod(
    tomorrowSchedules.filter(
      (s) => !['morning', 'afternoon', 'evening'].includes(s.sessionOfDay)
    )
  );

  const hasMultipleTomorrowSessions =
    [
      tomorrowMorningSchedules.length > 0,
      tomorrowAfternoonSchedules.length > 0,
      tomorrowEveningSchedules.length > 0,
    ].filter(Boolean).length > 1;

  const sessionSortWeight: Record<string, number> = {
    morning: 1,
    afternoon: 2,
    evening: 3,
  };
  const sortedTodaySchedules = [...todaySchedules].sort((a, b) => {
    const wA = sessionSortWeight[a.sessionOfDay] || 4;
    const wB = sessionSortWeight[b.sessionOfDay] || 4;
    if (wA !== wB) return wA - wB;
    return (a.periodNumber || 0) - (b.periodNumber || 0);
  });

  const dayOffDates = exceptions.filter((e) => e.isDayOff).map((e) => e.date);

  // Hàm tìm bản ghi hoàn thành của học sinh cho 1 bài học / nhiệm vụ
  const findTaskRecord = (task: Assignment) => {
    return records.find((r) => {
      if (r.studentUid !== user.uid) return false;
      if (r.assignmentId && r.assignmentId === task.id) return true;
      if (task.lessonId && r.assignmentId === task.lessonId) return true;
      if (task.title && r.title && r.date === today) {
        const cleanTaskTitle = task.title.trim().toLowerCase();
        const cleanRecTitle = r.title.trim().toLowerCase();
        if (cleanTaskTitle === cleanRecTitle) return true;
        if (
          cleanRecTitle.includes(cleanTaskTitle) ||
          cleanTaskTitle.includes(cleanRecTitle)
        ) {
          return true;
        }
      }
      return false;
    });
  };

  const completedTodayTasksCount = todayTasks.filter((t) => {
    const r = findTaskRecord(t);
    return r?.instructorStatus === 'confirmed';
  }).length;

  const allTodayTasksCompleted =
    todayTasks.length > 0 && completedTodayTasksCount === todayTasks.length;

  // Sắp xếp ưu tiên: Chưa nộp / Chưa hoàn thành lên trên -> Đã nộp chờ duyệt -> Đã hoàn thành xuống dưới
  const sortedTodayTasks = [...todayTasks].sort((a, b) => {
    const recA = findTaskRecord(a);
    const recB = findTaskRecord(b);

    const isConfirmedA = recA?.instructorStatus === 'confirmed';
    const isConfirmedB = recB?.instructorStatus === 'confirmed';
    const isSubmittedA = recA?.studentStatus === 'submitted';
    const isSubmittedB = recB?.studentStatus === 'submitted';

    // 0: Chưa nộp / Cần làm
    // 1: Đã nộp / Chờ duyệt
    // 2: Đã hoàn thành / Đã xác nhận
    const prioA = isConfirmedA ? 2 : isSubmittedA ? 1 : 0;
    const prioB = isConfirmedB ? 2 : isSubmittedB ? 1 : 0;

    return prioA - prioB;
  });

  // Lọc theo thẻ chip: Tất cả | Cần làm | Đã hoàn thành
  const displayedTodayTasks =
    todayTaskFilter === 'completed'
      ? sortedTodayTasks.filter(
          (t) => findTaskRecord(t)?.instructorStatus === 'confirmed'
        )
      : todayTaskFilter === 'pending'
      ? sortedTodayTasks.filter(
          (t) => findTaskRecord(t)?.instructorStatus !== 'confirmed'
        )
      : sortedTodayTasks;

  const streakSummary = calculateStudentProgressAndStreak({
    records,
    todayDateStr: today,
    studyDaysOfWeek: studyClass.studyDaysOfWeek,
    dayOffDates,
  });

  // Danh sách bài nộp chờ duyệt và bài đã đánh giá gần đây
  const unverifiedRecords = records.filter(
    (r) => r.studentStatus === 'submitted' && r.instructorStatus === 'unverified'
  );
  const reviewedRecords = records.filter(
    (r) => r.instructorStatus === 'confirmed'
  );

  const displayedUnverified = selectedStudentUid
    ? unverifiedRecords.filter((r) => r.studentUid === selectedStudentUid)
    : unverifiedRecords;

  const displayedReviewed = selectedStudentUid
    ? reviewedRecords.filter((r) => r.studentUid === selectedStudentUid)
    : reviewedRecords;

  const handleStudentSubmitTask = async (task: Assignment) => {
    setSubmittingTaskId(task.id);
    try {
      await submitStudentCompletion({
        classId: studyClass.id,
        studentUid: user.uid,
        studentName: user.displayName,
        type: 'assignment',
        assignmentId: task.id,
        sessionId: task.sessionId,
        title: task.title,
        date: today,
        studentNote: 'Em đã hoàn thành nhiệm vụ này ạ!',
      });
      await loadDashboardData();
    } catch (err) {
      console.error('Lỗi khi nộp bài:', err);
      alert('Không thể gửi báo cáo hoàn thành. Vui lòng kiểm tra lại kết nối mạng!');
    } finally {
      setSubmittingTaskId(null);
    }
  };

  const handleInstructorConfirm = async (
    rec: LearningRecord,
    customStars?: number,
    customComment?: string
  ) => {
    setConfirmingRecordId(rec.id);
    try {
      const stars = customStars ?? reviewStars[rec.id] ?? 3;
      const comment =
        customComment?.trim() ||
        reviewComments[rec.id]?.trim() ||
        'Hoàn thành tốt nhiệm vụ! Tiếp tục phát huy nhé!';
      await confirmOrReviewLearningRecord({
        classId: studyClass.id,
        instructorUid: user.uid,
        recordId: rec.id,
        studentUid: rec.studentUid,
        studentName: rec.studentName,
        type: rec.type,
        assignmentId: rec.assignmentId,
        sessionId: rec.sessionId,
        title: rec.title,
        date: rec.date,
        instructorStatus: 'confirmed',
        starsAwarded: stars,
        instructorComment: comment,
      });
      await loadDashboardData();
    } catch (err) {
      console.error('Lỗi khi duyệt bài:', err);
      alert('Không thể xác nhận bài nộp. Vui lòng thử lại!');
    } finally {
      setConfirmingRecordId(null);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-44 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/60"
          />
        ))}
      </div>
    );
  }

  // =========================================================================
  // STUDENT DASHBOARD ("Góc học hôm nay" - Dành riêng cho học sinh)
  // Nếu là Người hướng dẫn hoặc Chủ lớp, bỏ hoàn toàn giao diện này!
  // =========================================================================
  if (!isInstructorOrOwner) {
    return (
      <div className="space-y-4 sm:space-y-5">
        {/* Hàng thẻ chỉ số Sao & Streak cho học sinh (Compact) */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <div className="flex items-center gap-3.5 rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5 sm:p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs">
              <Star className="h-5 w-5 fill-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Tổng sao thưởng
              </div>
              <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white leading-tight">
                {streakSummary.totalStars} sao
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                Do người hướng dẫn xác nhận
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3.5 sm:p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
              <Flame className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Chuỗi ngày học (Streak)
              </div>
              <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white leading-tight">
                {streakSummary.currentStreak} ngày liên tiếp
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                Kỷ lục: {streakSummary.longestStreak} ngày
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-2xl border border-sky-200 bg-sky-50/80 p-3.5 sm:p-4 dark:border-sky-900/50 dark:bg-sky-950/30">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-xs">
              <Calendar className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-sky-800 dark:text-sky-300">
                Hôm nay ({DAY_OF_WEEK_LABELS[todayDayOfWeek]})
              </div>
              <div className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-tight">
                {formatVietnameseDate(today, false)}
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                {streakSummary.isTodayConfirmed
                  ? 'Đã hoàn thành & được xác nhận!'
                  : 'Hãy hoàn thành bài học tối nay nhé!'}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
          {/* Cột chính: Hôm nay học gì & Nhiệm vụ của em */}
          <div className="space-y-4 lg:col-span-7">
            {/* Hôm nay học gì? */}
            <section className="rounded-3xl border border-slate-200 bg-white p-3.5 sm:p-4.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                    Hôm nay học gì?
                  </h2>
                </div>
                {allTodayTasksCompleted ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-black text-white shadow-2xs">
                    <CheckCircle2 className="h-3 w-3" />
                    Đã hoàn thành tất cả ({completedTodayTasksCount}/{todayTasks.length})
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {completedTodayTasksCount > 0
                      ? `Đã xong ${completedTodayTasksCount}/${todayTasks.length} bài`
                      : `${todayTasks.length} bài học & nhiệm vụ`}
                  </span>
                )}
              </div>

              {/* Thẻ chip lọc bài học hôm nay (Tất cả / Cần làm / Đã hoàn thành) */}
              {todayTasks.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setTodayTaskFilter('all')}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold transition active:scale-95 ${
                      todayTaskFilter === 'all'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-750'
                    }`}
                  >
                    <span>Tất cả</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                        todayTaskFilter === 'all'
                          ? 'bg-white/20'
                          : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                    >
                      {todayTasks.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTodayTaskFilter('pending')}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold transition active:scale-95 ${
                      todayTaskFilter === 'pending'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-750'
                    }`}
                  >
                    <span>Cần làm</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                        todayTaskFilter === 'pending'
                          ? 'bg-white/20'
                          : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                    >
                      {todayTasks.length - completedTodayTasksCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTodayTaskFilter('completed')}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold transition active:scale-95 ${
                      todayTaskFilter === 'completed'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-750'
                    }`}
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Đã hoàn thành</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                        todayTaskFilter === 'completed'
                          ? 'bg-white/20'
                          : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                    >
                      {completedTodayTasksCount}
                    </span>
                  </button>
                </div>
              )}

              {allTodayTasksCompleted && todayTaskFilter !== 'pending' && (
                <div className="rounded-2xl border border-emerald-300 bg-gradient-to-r from-emerald-100/70 via-teal-50 to-white px-3 py-2 flex items-center gap-2.5 shadow-2xs dark:border-emerald-800 dark:from-emerald-950/50 dark:to-slate-900">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-2xs">
                    <PartyPopper className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs sm:text-sm font-extrabold text-emerald-950 dark:text-emerald-200">
                      Xuất sắc! Em đã hoàn thành toàn bộ bài học hôm nay
                    </div>
                  </div>
                </div>
              )}

              {displayedTodayTasks.length > 0 ? (
                /* Khung cuộn nội bộ có chiều cao tối đa (Cách 2) để trang không bị kéo dài vô tận */
                <div className="max-h-[480px] sm:max-h-[520px] overflow-y-auto pr-1 sm:pr-1.5 space-y-2 focus:outline-none">
                  {displayedTodayTasks.map((task) => {
                    const rec = findTaskRecord(task);
                    const isConfirmed = rec?.instructorStatus === 'confirmed';
                    const isSubmitted = rec?.studentStatus === 'submitted';

                    const lessonKeywords =
                      task.flashcards ||
                      lessons.find((l) => l.id === task.lessonId)?.keywords ||
                      [];
                    const reviewedKeywordsTodayCount = lessonKeywords.filter(
                      (kw) => {
                        const key = makeSrsCardKey(
                          task.lessonId || task.id,
                          kw.term
                        );
                        const srs = srsStates[key];
                        return (
                          srs &&
                          (srs.level > 0 || srs.lastReviewedDate === today)
                        );
                      }
                    ).length;
                    const isPartiallyStudied =
                      !isConfirmed &&
                      !isSubmitted &&
                      reviewedKeywordsTodayCount > 0;

                    const hasStudyFlow =
                      (task.taskType === 'flashcard' &&
                        task.flashcards &&
                        task.flashcards.length > 0) ||
                      (task.taskType === 'quiz' &&
                        task.quizQuestions &&
                        task.quizQuestions.length > 0) ||
                      Boolean(task.lessonId);

                    return (
                      /* Thẻ bài học Compact (Cách 4) gọn gàng, tinh tế */
                      <div
                        key={task.id}
                        className={`rounded-2xl border p-2.5 sm:p-3 transition shadow-2xs hover:shadow-xs ${
                          isConfirmed
                            ? 'border-emerald-300 bg-emerald-50/35 dark:border-emerald-800 dark:bg-emerald-950/20'
                            : isSubmitted
                            ? 'border-amber-300 bg-amber-50/35 dark:border-amber-800 dark:bg-amber-950/20'
                            : 'border-emerald-300/80 bg-white hover:border-emerald-400 dark:border-emerald-900/50 dark:bg-slate-900'
                        }`}
                      >
                        {/* Dòng 1: Icon trạng thái + Chips môn, Unit, Sao, SRS + Badge hoàn thành */}
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                            {isConfirmed ? (
                              <span
                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white shadow-2xs"
                                title="Đã hoàn thành bài học này"
                              >
                                <Check className="h-3 w-3 stroke-[3]" />
                              </span>
                            ) : isSubmitted ? (
                              <span
                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-amber-500 text-white shadow-2xs"
                                title="Đã nộp bài, đang chờ giáo viên xác nhận"
                              >
                                <Clock className="h-3 w-3" />
                              </span>
                            ) : (
                              <span
                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                                title="Chưa học"
                              >
                                <BookOpen className="h-3 w-3" />
                              </span>
                            )}

                            {task.subject && (
                              <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                {task.subject}
                              </span>
                            )}
                            {task.unitTitle && (
                              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300 truncate max-w-[140px]">
                                {task.unitTitle}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                              <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-500" />
                              +{task.starsReward} sao
                            </span>
                            {isPartiallyStudied && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-teal-100 px-1.5 py-0.5 text-[10px] font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                                <Layers className="h-2.5 w-2.5" />
                                {reviewedKeywordsTodayCount}/{lessonKeywords.length} thẻ
                              </span>
                            )}
                          </div>

                          <div className="shrink-0">
                            {isConfirmed ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white shadow-2xs">
                                <CheckCircle2 className="h-2.5 w-2.5" />
                                Đã xong (+{rec.starsAwarded}★)
                              </span>
                            ) : isSubmitted ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-2xs">
                                <Clock className="h-2.5 w-2.5" />
                                Chờ duyệt
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                Chưa làm
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Dòng 2: Tiêu đề bài học + Các nút hành động */}
                        <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-slate-100/80 pt-2 dark:border-slate-800/60">
                          <div className="min-w-0 flex-1">
                            <h3
                              className={`text-xs sm:text-sm font-bold leading-snug truncate ${
                                isConfirmed
                                  ? 'text-emerald-950 dark:text-emerald-100'
                                  : 'text-slate-900 dark:text-white'
                              }`}
                              title={task.title}
                            >
                              {task.title}
                            </h3>

                            {isConfirmed && rec?.instructorComment && (
                              <p className="mt-0.5 text-[11px] text-emerald-800 font-medium dark:text-emerald-300 truncate">
                                Lời khen: “{rec.instructorComment}”
                              </p>
                            )}

                            {isSubmitted && !isConfirmed && (
                              <p className="mt-0.5 text-[11px] text-amber-800 font-medium dark:text-amber-300 truncate">
                                {rec?.studentNote || 'Em đã nộp bài và gửi báo cáo!'}
                              </p>
                            )}
                          </div>

                          {/* Các nút hành động Compact */}
                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            {task.taskType === 'flashcard' &&
                              task.flashcards &&
                              task.flashcards.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setActiveFlashcardTask(task)}
                                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition active:scale-95 ${
                                    isConfirmed
                                      ? 'border border-emerald-300 bg-white text-emerald-800 shadow-2xs hover:bg-emerald-50 dark:border-emerald-700 dark:bg-slate-800 dark:text-emerald-300'
                                      : isSubmitted
                                      ? 'border border-amber-300 bg-white text-amber-800 shadow-2xs hover:bg-amber-50 dark:border-amber-700 dark:bg-slate-800 dark:text-amber-300'
                                      : 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700'
                                  }`}
                                >
                                  {isConfirmed ? (
                                    <>
                                      <RotateCw className="h-3 w-3 text-emerald-600" />
                                      Ôn lại ({task.flashcards.length})
                                    </>
                                  ) : isSubmitted ? (
                                    <>
                                      <RotateCw className="h-3 w-3 text-amber-600" />
                                      Học thêm ({task.flashcards.length})
                                    </>
                                  ) : (
                                    <>
                                      <Layers className="h-3 w-3" />
                                      Học {task.flashcards.length} thẻ
                                    </>
                                  )}
                                </button>
                              )}

                            {task.taskType === 'quiz' &&
                              task.quizQuestions &&
                              task.quizQuestions.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setActiveQuizTask(task)}
                                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition active:scale-95 ${
                                    isConfirmed
                                      ? 'border border-violet-300 bg-white text-violet-800 shadow-2xs hover:bg-violet-50 dark:border-violet-700 dark:bg-slate-800 dark:text-violet-300'
                                      : 'bg-violet-600 text-white shadow-xs hover:bg-violet-700'
                                  }`}
                                >
                                  {isConfirmed ? (
                                    <>
                                      <RotateCw className="h-3 w-3 text-violet-600" />
                                      Làm lại ({task.quizQuestions.length} câu)
                                    </>
                                  ) : (
                                    <>
                                      <ClipboardCheck className="h-3 w-3" />
                                      Làm trắc nghiệm ({task.quizQuestions.length} câu)
                                    </>
                                  )}
                                </button>
                              )}

                            {task.lessonId && (
                              <Link
                                to={`/app/classes/${studyClass.id}/lessons/${task.lessonId}`}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition"
                              >
                                <BookOpen className="h-3 w-3" />
                                {isConfirmed ? 'Xem bài' : 'Vào bài'}
                              </Link>
                            )}

                            {!hasStudyFlow && !isConfirmed && (
                              <button
                                type="button"
                                disabled={submittingTaskId === task.id}
                                onClick={() => void handleStudentSubmitTask(task)}
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 active:scale-95 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 transition"
                              >
                                <Send className="h-3 w-3" />
                                {submittingTaskId === task.id
                                  ? 'Đang gửi...'
                                  : isSubmitted
                                  ? 'Nộp lại'
                                  : 'Báo xong'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {displayedTodayTasks.length > 5 && (
                    <div className="pt-1 text-center text-[11px] font-medium text-slate-400">
                      Đang hiển thị {displayedTodayTasks.length} bài • Cuộn bên trong khung để xem tiếp
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-3.5 text-center dark:border-slate-800 dark:bg-slate-800/40">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {todayTaskFilter === 'completed'
                      ? 'Chưa có bài học nào được hoàn thành hôm nay.'
                      : todayTaskFilter === 'pending'
                      ? 'Tuyệt vời! Không còn bài nào cần hoàn thành hôm nay.'
                      : 'Hôm nay chưa có bài học nào được chỉ định.'}
                  </p>
                  {todayTaskFilter === 'all' && (
                    <div className="mt-2 flex justify-center">
                      <Link
                        to={`/app/classes/${studyClass.id}/lessons`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        Vào Thư viện tự ôn tập
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {/* Thời khóa biểu hôm nay (Compact & Khung cuộn) */}
              {sortedTodaySchedules.length > 0 && (
                <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Thời khóa biểu hôm nay ({DAY_OF_WEEK_LABELS[todayDayOfWeek]})
                    </h3>
                    <span className="text-[10px] font-medium text-slate-400">
                      {sortedTodaySchedules.length} tiết
                    </span>
                  </div>
                  <div className="max-h-[170px] overflow-y-auto pr-1 space-y-1.5">
                    {sortedTodaySchedules.map((sch) => {
                      const sessionName =
                        sch.sessionOfDay === 'morning'
                          ? 'Sáng'
                          : sch.sessionOfDay === 'afternoon'
                          ? 'Chiều'
                          : sch.sessionOfDay === 'evening'
                          ? 'Tối'
                          : '';
                      return (
                        <div
                          key={sch.id}
                          className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-800/40"
                        >
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {sessionName ? `${sessionName} • ` : ''}Tiết {sch.periodNumber}: {sch.subject}
                            </span>
                            {sch.startTime && (
                              <span className="ml-1.5 text-[11px] text-slate-500">
                                ({sch.startTime} - {sch.endTime})
                              </span>
                            )}
                          </div>
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                              sch.type === 'tutoring'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                            }`}
                          >
                            {sch.type === 'tutoring' ? 'Kèm tại nhà' : 'Chính khóa'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            {/* Nhiệm vụ khác (Compact & Khung cuộn) */}
            {otherTasks.length > 0 && (
              <section className="rounded-3xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                    Nhiệm vụ khác ({otherTasks.length})
                  </h2>
                  <Link
                    to={`/app/classes/${studyClass.id}/sessions`}
                    className="text-[11px] font-bold text-emerald-700 hover:underline dark:text-emerald-400"
                  >
                    Xem tất cả
                  </Link>
                </div>

                <div className="mt-2.5 max-h-[220px] overflow-y-auto pr-1 space-y-2">
                  {otherTasks.map((task) => {
                    const rec = records.find(
                      (r) =>
                        r.assignmentId === task.id && r.studentUid === user.uid
                    );
                    const isConfirmed = rec?.instructorStatus === 'confirmed';
                    const isSubmitted = rec?.studentStatus === 'submitted';

                    return (
                      <div
                        key={task.id}
                        className={`rounded-xl border p-2.5 sm:p-3 transition ${
                          isConfirmed
                            ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-950/20'
                            : isSubmitted
                            ? 'border-amber-200 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/20'
                            : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-1.5">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                              {task.title}
                            </h3>
                            {task.description && (
                              <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300 line-clamp-1">
                                {task.description}
                              </p>
                            )}
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                              <span>Hạn: {formatVietnameseDate(task.dueDate, false)}</span>
                              <span className="inline-flex items-center gap-0.5 font-bold text-amber-600 dark:text-amber-400">
                                <Star className="h-2.5 w-2.5 fill-amber-400" />
                                Thưởng {task.starsReward} sao
                              </span>
                            </div>
                          </div>

                          {isConfirmed ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              Đã xác nhận (+{rec.starsAwarded}★)
                            </span>
                          ) : isSubmitted ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                              <Clock className="h-2.5 w-2.5" />
                              Chờ duyệt
                            </span>
                          ) : null}
                        </div>

                        {rec?.instructorComment && (
                          <div className="mt-1.5 rounded-lg bg-white/80 p-1.5 text-[11px] text-slate-700 border border-emerald-200 dark:bg-slate-900 dark:border-emerald-800 dark:text-slate-200">
                            <strong>Nhận xét:</strong> {rec.instructorComment}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          {/* Cột phụ: Soạn cặp ngày mai & Bài học đã công bố */}
          <div className="space-y-4 lg:col-span-5">
            {/* Khối Ngày mai học gì? (Compact & Khung cuộn nội bộ đồng bộ chiều cao) */}
            <section className="rounded-3xl border border-slate-200 bg-white p-3.5 sm:p-4.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                    <Backpack className="h-3.5 w-3.5" />
                  </span>
                  <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                    Ngày mai học gì? ({DAY_OF_WEEK_LABELS[tomorrowDayOfWeek]})
                  </h2>
                </div>
                <span className="text-[11px] font-bold text-sky-700 dark:text-sky-400">
                  {tomorrowSchedules.length} tiết
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Checklist chuẩn bị sách vở tối nay trước khi đi ngủ:
              </p>

              {/* Thẻ chip lọc buổi */}
              {hasMultipleTomorrowSessions && (
                <div className="mt-2 flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => setTomorrowSessionTab('all')}
                    className={`rounded-lg px-2 py-0.5 text-[11px] font-bold transition ${
                      tomorrowSessionTab === 'all'
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    Tất cả ({tomorrowSchedules.length})
                  </button>
                  {tomorrowMorningSchedules.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setTomorrowSessionTab('morning')}
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-bold transition ${
                        tomorrowSessionTab === 'morning'
                          ? 'bg-amber-500 text-white shadow-2xs'
                          : 'bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300'
                      }`}
                    >
                      <Sun className="h-2.5 w-2.5" />
                      Sáng ({tomorrowMorningSchedules.length})
                    </button>
                  )}
                  {tomorrowAfternoonSchedules.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setTomorrowSessionTab('afternoon')}
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-bold transition ${
                        tomorrowSessionTab === 'afternoon'
                          ? 'bg-sky-500 text-white shadow-2xs'
                          : 'bg-sky-50 text-sky-800 hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-300'
                      }`}
                    >
                      <CloudSun className="h-2.5 w-2.5" />
                      Chiều ({tomorrowAfternoonSchedules.length})
                    </button>
                  )}
                  {tomorrowEveningSchedules.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setTomorrowSessionTab('evening')}
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-bold transition ${
                        tomorrowSessionTab === 'evening'
                          ? 'bg-indigo-500 text-white shadow-2xs'
                          : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300'
                      }`}
                    >
                      <Moon className="h-2.5 w-2.5" />
                      Tối ({tomorrowEveningSchedules.length})
                    </button>
                  )}
                </div>
              )}

              {tomorrowSchedules.length === 0 ? (
                <p className="mt-2.5 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  Ngày mai không có tiết học trong thời khóa biểu.
                </p>
              ) : (
                /* Khung cuộn nội bộ đồng bộ chiều cao với khối bài học bên trái */
                <div className="mt-2.5 max-h-[480px] sm:max-h-[520px] overflow-y-auto pr-1 space-y-2.5 focus:outline-none">
                  {(tomorrowSessionTab === 'all' ||
                    tomorrowSessionTab === 'morning') &&
                    tomorrowMorningSchedules.length > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 pt-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                          <Sun className="h-3 w-3 text-amber-500" />
                          <span>Buổi Sáng ({tomorrowMorningSchedules.length} tiết)</span>
                        </div>
                        <ul className="space-y-1">
                          {tomorrowMorningSchedules.map((sch) => (
                            <li
                              key={sch.id}
                              className="rounded-xl border border-amber-200/70 bg-amber-50/40 px-2.5 py-1.5 sm:px-3 sm:py-2 transition hover:shadow-2xs dark:border-amber-900/40 dark:bg-amber-950/20"
                            >
                              <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                <span>
                                  Tiết {sch.periodNumber}: {sch.subject}
                                </span>
                                <span className="text-[10px] font-medium text-slate-500">
                                  {sch.type === 'tutoring' ? 'Kèm học' : 'Ở trường'}
                                </span>
                              </div>
                              {sch.materialsNote && (
                                <p className="mt-0.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                                  Chuẩn bị: {sch.materialsNote}
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                  {(tomorrowSessionTab === 'all' ||
                    tomorrowSessionTab === 'afternoon') &&
                    tomorrowAfternoonSchedules.length > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 pt-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400">
                          <CloudSun className="h-3 w-3 text-sky-500" />
                          <span>Buổi Chiều ({tomorrowAfternoonSchedules.length} tiết)</span>
                        </div>
                        <ul className="space-y-1">
                          {tomorrowAfternoonSchedules.map((sch) => (
                            <li
                              key={sch.id}
                              className="rounded-xl border border-sky-200/70 bg-sky-50/40 px-2.5 py-1.5 sm:px-3 sm:py-2 transition hover:shadow-2xs dark:border-sky-900/40 dark:bg-sky-950/20"
                            >
                              <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                <span>
                                  Tiết {sch.periodNumber}: {sch.subject}
                                </span>
                                <span className="text-[10px] font-medium text-slate-500">
                                  {sch.type === 'tutoring' ? 'Kèm học' : 'Ở trường'}
                                </span>
                              </div>
                              {sch.materialsNote && (
                                <p className="mt-0.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                                  Chuẩn bị: {sch.materialsNote}
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                  {(tomorrowSessionTab === 'all' ||
                    tomorrowSessionTab === 'evening') &&
                    tomorrowEveningSchedules.length > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 pt-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                          <Moon className="h-3 w-3 text-indigo-500" />
                          <span>Buổi Tối ({tomorrowEveningSchedules.length} tiết)</span>
                        </div>
                        <ul className="space-y-1">
                          {tomorrowEveningSchedules.map((sch) => (
                            <li
                              key={sch.id}
                              className="rounded-xl border border-indigo-200/70 bg-indigo-50/40 px-2.5 py-1.5 sm:px-3 sm:py-2 transition hover:shadow-2xs dark:border-indigo-900/40 dark:bg-indigo-950/20"
                            >
                              <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                <span>
                                  Tiết {sch.periodNumber}: {sch.subject}
                                </span>
                                <span className="text-[10px] font-medium text-slate-500">
                                  {sch.type === 'tutoring' ? 'Kèm học' : 'Ở trường'}
                                </span>
                              </div>
                              {sch.materialsNote && (
                                <p className="mt-0.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                                  Chuẩn bị: {sch.materialsNote}
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                  {tomorrowSessionTab === 'all' &&
                    tomorrowOtherSchedules.length > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 pt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                          <Clock className="h-3 w-3 text-slate-500" />
                          <span>Tiết học khác ({tomorrowOtherSchedules.length} tiết)</span>
                        </div>
                        <ul className="space-y-1">
                          {tomorrowOtherSchedules.map((sch) => (
                            <li
                              key={sch.id}
                              className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-2.5 py-1.5 sm:px-3 sm:py-2 transition hover:shadow-2xs dark:border-slate-800 dark:bg-slate-800/50"
                            >
                              <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                <span>
                                  Tiết {sch.periodNumber}: {sch.subject}
                                </span>
                                <span className="text-[10px] font-medium text-slate-500">
                                  {sch.type === 'tutoring' ? 'Kèm học' : 'Ở trường'}
                                </span>
                              </div>
                              {sch.materialsNote && (
                                <p className="mt-0.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                                  Chuẩn bị: {sch.materialsNote}
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              )}
            </section>

            {/* Khối Bài học của lớp (Compact) */}
            <section className="rounded-3xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                    <BookOpen className="h-3.5 w-3.5" />
                  </span>
                  <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                    Bài học của lớp ({lessons.length})
                  </h2>
                </div>
                <Link
                  to={`/app/classes/${studyClass.id}/lessons`}
                  className="text-[11px] font-bold text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  Thư viện
                </Link>
              </div>
              <div className="mt-2.5 space-y-1.5">
                {lessons.slice(0, 4).map((l) => (
                  <Link
                    key={l.id}
                    to={`/app/classes/${studyClass.id}/lessons/${l.id}`}
                    className="flex items-center justify-between rounded-xl border border-slate-200/80 px-2.5 py-1.5 transition hover:border-emerald-400 dark:border-slate-800 dark:hover:border-emerald-700"
                  >
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate pr-2">
                      {l.title}
                    </span>
                    <span className="shrink-0 rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-800 dark:bg-violet-950 dark:text-violet-300">
                      {l.subject}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </div>

        {activeFlashcardTask && activeFlashcardTask.flashcards && (
          <FlashcardStudyModal
            title={activeFlashcardTask.title}
            cards={activeFlashcardTask.flashcards.map((kw) => ({
              lessonId: activeFlashcardTask.lessonId || activeFlashcardTask.id,
              subject: activeFlashcardTask.subject || 'Giáo trình',
              unitTitle: activeFlashcardTask.unitTitle || 'Chung',
              keyword: kw,
              ttsLang:
                kw.ttsLang !== undefined
                  ? kw.ttsLang
                  : inferDefaultTtsLang(
                      activeFlashcardTask.subject || '',
                      activeFlashcardTask.ttsLang
                    ),
            }))}
            srsStates={srsStates}
            todayStr={today}
            onClose={() => setActiveFlashcardTask(null)}
            onSaveProgress={async ({ updatedSrsPatch, summaryNote }) => {
              const currentTask = activeFlashcardTask;
              setActiveFlashcardTask(null);
              await saveStudentSrsStates({
                classId: studyClass.id,
                studentUid: user.uid,
                studentName: user.displayName,
                todayDateStr: today,
                srsStates: updatedSrsPatch,
              });
              await submitStudentCompletion({
                classId: studyClass.id,
                studentUid: user.uid,
                studentName: user.displayName,
                type: 'assignment',
                assignmentId: currentTask.id,
                sessionId: currentTask.sessionId,
                title: currentTask.title,
                date: today,
                studentNote: summaryNote,
              });
              await loadDashboardData();
            }}
          />
        )}

        {activeQuizTask && activeQuizTask.quizQuestions && (
          <QuizTakeModal
            title={activeQuizTask.title}
            subject={activeQuizTask.subject || 'Giáo trình'}
            unitTitle={activeQuizTask.unitTitle}
            ttsLang={activeQuizTask.ttsLang}
            questions={activeQuizTask.quizQuestions}
            lessons={lessons}
            srsStates={srsStates}
            todayStr={today}
            onClose={() => setActiveQuizTask(null)}
            onSubmitQuizResult={async ({
              score,
              total,
              studentNote,
              updatedSrsPatch,
            }) => {
              const currentTask = activeQuizTask;
              setActiveQuizTask(null);
              if (Object.keys(updatedSrsPatch).length > 0) {
                await saveStudentSrsStates({
                  classId: studyClass.id,
                  studentUid: user.uid,
                  studentName: user.displayName,
                  todayDateStr: today,
                  srsStates: updatedSrsPatch,
                });
              }
              await submitStudentCompletion({
                classId: studyClass.id,
                studentUid: user.uid,
                studentName: user.displayName,
                type: 'assignment',
                assignmentId: currentTask.id,
                sessionId: currentTask.sessionId,
                title: currentTask.title,
                date: today,
                studentNote,
                quizScore: score,
                quizTotal: total,
              });
              await loadDashboardData();
            }}
          />
        )}
      </div>
    );
  }

  // =========================================================================
  // INSTRUCTOR / OWNER DASHBOARD (Giao diện dành riêng cho Người hướng dẫn & Chủ lớp)
  // Bỏ hoàn toàn chế độ "Góc học tập (Mặc định)" cho giáo viên theo yêu cầu
  // =========================================================================
  const activeSelectedStudent = students.find((s) => s.uid === selectedStudentUid);

  const viewingAssignment = viewingRecord?.assignmentId
    ? assignments.find((a) => a.id === viewingRecord.assignmentId)
    : null;
  const viewingLesson = viewingAssignment?.lessonId
    ? lessons.find((l) => l.id === viewingAssignment.lessonId)
    : lessons.find(
        (l) =>
          viewingRecord &&
          l.title &&
          viewingRecord.title.toLowerCase().includes(l.title.toLowerCase())
      );
  const viewingStudent = viewingRecord
    ? students.find((s) => s.uid === viewingRecord.studentUid)
    : null;

  return (
    <div className="space-y-6">
      {/* Thống kê nhanh cho người hướng dẫn */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Bài học hôm nay ({formatVietnameseDate(today, false)})
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
            {todayTasks.length} bài đã giao
          </div>
          <div className="mt-2">
            <Link
              to={`/app/classes/${studyClass.id}/lessons`}
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline dark:text-emerald-400"
            >
              Chọn thêm từ Thư viện
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-xs dark:border-amber-900/50 dark:bg-amber-950/20">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
            Bài nộp chờ xác nhận
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
            {unverifiedRecords.length} bài nộp
          </div>
          <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Xác nhận để cộng sao & tính chuỗi ngày học cho em
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Thư viện bài học
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
            {lessons.filter((l) => l.status === 'published').length} đã công bố
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {lessons.filter((l) => l.status === 'draft').length} bản nháp riêng tư
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Yêu cầu tham gia lớp
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
            {pendingRequests.length} chờ duyệt
          </div>
          <div className="mt-2">
            <Link
              to={`/app/classes/${studyClass.id}/members`}
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline dark:text-emerald-400"
            >
              Quản lý thành viên & mã mời
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Thao tác nhanh cho Instructor / Owner */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Thao tác nhanh:
        </span>
        <Link
          to={`/app/classes/${studyClass.id}/lessons`}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700"
        >
          <Plus className="h-3.5 w-3.5" />
          Soạn bài học mới
        </Link>
        <Link
          to={`/app/classes/${studyClass.id}/sessions`}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
        >
          <ClipboardCheck className="h-3.5 w-3.5" />
          Giao nhiệm vụ mới
        </Link>
        <Link
          to={`/app/classes/${studyClass.id}/schedule`}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
        >
          <Calendar className="h-3.5 w-3.5" />
          Cập nhật thời khóa biểu
        </Link>
        {isOwner && (
          <Link
            to={`/app/classes/${studyClass.id}/members`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Tạo link mời học sinh
          </Link>
        )}
      </div>

      {/* Thanh lọc theo từng học sinh trong lớp */}
      {students.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-500">
              <Users className="h-3.5 w-3.5 text-emerald-600" />
              Theo dõi & Đánh giá theo từng học sinh ({students.length}):
            </span>
            {activeSelectedStudent && (
              <button
                type="button"
                onClick={() => setSelectedStudentUid('')}
                className="text-xs font-bold text-emerald-700 hover:underline dark:text-emerald-400"
              >
                Xem tất cả học sinh
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setSelectedStudentUid('')}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                selectedStudentUid === ''
                  ? 'bg-slate-900 text-white shadow-xs dark:bg-white dark:text-slate-900'
                  : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              <span>Tất cả</span>
              <span className="rounded-full bg-slate-200/80 px-1.5 py-0.2 text-[10px] font-extrabold text-slate-800 dark:bg-slate-700 dark:text-slate-200">
                {students.length}
              </span>
              {unverifiedRecords.length > 0 && (
                <span className="rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] font-extrabold text-white">
                  {unverifiedRecords.length} bài chờ
                </span>
              )}
            </button>

            {students.map((st) => {
              const pendingCount = unverifiedRecords.filter(
                (r) => r.studentUid === st.uid
              ).length;
              const isSelected = selectedStudentUid === st.uid;
              return (
                <button
                  key={st.uid}
                  type="button"
                  onClick={() => setSelectedStudentUid(st.uid)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                  }`}
                >
                  <UserAvatar
                    name={st.displayName}
                    avatarUrl={st.avatarUrl}
                    size="xs"
                  />
                  <span>{st.displayName}</span>
                  {pendingCount > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                        isSelected
                          ? 'bg-white text-emerald-800'
                          : 'bg-amber-500 text-white'
                      }`}
                    >
                      {pendingCount} bài chờ
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Cột trái: Duyệt & Đánh giá bài nộp của học sinh */}
        <div className="space-y-6 lg:col-span-7">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  Duyệt & Đánh giá bài nộp{' '}
                  {activeSelectedStudent ? (
                    <span className="text-emerald-700 dark:text-emerald-400">
                      • {activeSelectedStudent.displayName}
                    </span>
                  ) : (
                    `(${displayedUnverified.length} chờ duyệt)`
                  )}
                </h2>
                <p className="text-xs text-slate-500">
                  Xem kết quả Flashcard, bài làm trắc nghiệm & tặng sao cho học sinh.
                </p>
              </div>

              {/* Tab chuyển đổi giữa Chờ xác nhận và Đã đánh giá */}
              <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setReviewTab('pending')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    reviewTab === 'pending'
                      ? 'bg-white text-amber-700 shadow-2xs dark:bg-slate-900 dark:text-amber-400'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>Chờ xác nhận</span>
                  <span className="rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] font-extrabold text-white">
                    {displayedUnverified.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setReviewTab('reviewed')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    reviewTab === 'reviewed'
                      ? 'bg-white text-emerald-700 shadow-2xs dark:bg-slate-900 dark:text-emerald-400'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Đã đánh giá</span>
                  <span className="rounded-full bg-slate-200 px-1.5 py-0.2 text-[10px] font-extrabold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                    {displayedReviewed.length}
                  </span>
                </button>
              </div>
            </div>

            {/* DANH SÁCH BÀI NỘP: TAB CHỜ XÁC NHẬN */}
            {reviewTab === 'pending' && (
              <div className="mt-4">
                {displayedUnverified.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-slate-800">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2 opacity-80" />
                    <p className="font-bold text-slate-700 dark:text-slate-300">
                      Tất cả bài nộp đã được xác nhận!
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {activeSelectedStudent
                        ? `${activeSelectedStudent.displayName} không có bài nộp nào đang chờ duyệt.`
                        : 'Hiện không có học sinh nào đang có bài chờ xác nhận.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {displayedUnverified.map((rec) => {
                      const isFlashcard =
                        rec.title.toLowerCase().includes('flashcard') ||
                        rec.studentNote.toLowerCase().includes('flashcard') ||
                        rec.studentNote.toLowerCase().includes('thẻ');
                      const isQuiz =
                        typeof rec.quizScore === 'number' ||
                        rec.title.toLowerCase().includes('trắc nghiệm') ||
                        rec.title.toLowerCase().includes('quiz');

                      const studentMember = students.find(
                        (s) => s.uid === rec.studentUid
                      );

                      return (
                        <div
                          key={rec.id}
                          className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4.5 dark:border-amber-900/50 dark:bg-amber-950/20"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <UserAvatar
                                name={rec.studentName}
                                avatarUrl={studentMember?.avatarUrl}
                                size="sm"
                              />
                              <div>
                                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                                  {rec.studentName} • {formatVietnameseDate(rec.date, false)}
                                </span>
                                <h3
                                  onClick={() => setViewingRecord(rec)}
                                  className="text-base font-extrabold text-slate-900 hover:text-emerald-700 hover:underline cursor-pointer dark:text-white dark:hover:text-emerald-400 transition"
                                  title="Bấm để xem chi tiết bài làm"
                                >
                                  {rec.title}
                                </h3>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setViewingRecord(rec)}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-2.5 py-1 text-xs font-bold text-amber-900 shadow-2xs hover:bg-amber-100 dark:border-amber-700 dark:bg-slate-800 dark:text-amber-200 transition"
                                title="Xem toàn bộ câu hỏi, từ vựng hoặc nội dung học sinh đã nộp"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                <span>Xem bài làm</span>
                              </button>
                              {isFlashcard ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                                  <Layers className="h-3 w-3" />
                                  Bộ Flashcard
                                </span>
                              ) : isQuiz ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-800 dark:bg-violet-950/80 dark:text-violet-300">
                                  <ClipboardCheck className="h-3 w-3" />
                                  Trắc nghiệm
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-bold text-sky-800 dark:bg-sky-950/80 dark:text-sky-300">
                                  <BookOpen className="h-3 w-3" />
                                  Nhiệm vụ
                                </span>
                              )}
                              <span className="rounded-full bg-amber-200/80 px-2.5 py-0.5 text-xs font-bold text-amber-950">
                                Chờ xác nhận
                              </span>
                            </div>
                          </div>

                          {/* Chi tiết nội dung kết quả làm bài */}
                          {rec.studentNote && (
                            <div
                              onClick={() => setViewingRecord(rec)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setViewingRecord(rec);
                                }
                              }}
                              title="Bấm để xem chi tiết bài làm"
                              className={`mt-3 rounded-xl p-3 text-xs cursor-pointer hover:shadow-xs transition ${
                                isFlashcard
                                  ? 'border border-emerald-200/80 bg-emerald-50/70 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200'
                                  : isQuiz
                                  ? 'border border-violet-200/80 bg-violet-50/70 text-violet-950 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-200'
                                  : 'border border-slate-200/80 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                              }`}
                            >
                              <div className="font-bold flex items-center gap-1.5 mb-1">
                                <Sparkles className="h-3.5 w-3.5" />
                                <span>Kết quả báo cáo của học sinh:</span>
                              </div>
                              <p className="leading-relaxed">“{rec.studentNote}”</p>
                              {typeof rec.quizScore === 'number' && typeof rec.quizTotal === 'number' && (
                                <div className="mt-1.5 font-bold text-violet-700 dark:text-violet-300">
                                  Điểm đạt: {rec.quizScore}/{rec.quizTotal} câu đúng (
                                  {Math.round((rec.quizScore / (rec.quizTotal || 1)) * 100)}%)
                                </div>
                              )}
                            </div>
                          )}

                          {/* Form chấm điểm & nhận xét của giáo viên */}
                          <div className="mt-3.5 grid grid-cols-1 gap-2 sm:grid-cols-12 items-center">
                            <div className="sm:col-span-3">
                              <label
                                htmlFor={`stars-${rec.id}`}
                                className="sr-only"
                              >
                                Số sao thưởng
                              </label>
                              <select
                                id={`stars-${rec.id}`}
                                value={reviewStars[rec.id] ?? 3}
                                onChange={(e) =>
                                  setReviewStars((prev) => ({
                                    ...prev,
                                    [rec.id]: Number(e.target.value),
                                  }))
                                }
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                              >
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <option key={s} value={s}>
                                    Thưởng +{s} sao
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="sm:col-span-6">
                              <input
                                type="text"
                                aria-label="Nhận xét của người hướng dẫn"
                                value={reviewComments[rec.id] ?? ''}
                                onChange={(e) =>
                                  setReviewComments((prev) => ({
                                    ...prev,
                                    [rec.id]: e.target.value,
                                  }))
                                }
                                placeholder="Nhận xét khích lệ em (VD: Làm bài rất tốt, tiếp tục phát huy nhé!)..."
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                              />
                            </div>

                            <div className="sm:col-span-3">
                              <button
                                type="button"
                                disabled={confirmingRecordId === rec.id}
                                onClick={() => void handleInstructorConfirm(rec)}
                                className="w-full rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 shadow-xs"
                              >
                                {confirmingRecordId === rec.id
                                  ? 'Đang lưu...'
                                  : 'Xác nhận & Tặng sao'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* DANH SÁCH BÀI NỘP: TAB ĐÃ ĐÁNH GIÁ GẦN ĐÂY */}
            {reviewTab === 'reviewed' && (
              <div className="mt-4">
                {displayedReviewed.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-slate-800">
                    Chưa có bài nộp nào được đánh giá gần đây.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {displayedReviewed.slice(0, 15).map((rec) => {
                      const studentMember = students.find(
                        (s) => s.uid === rec.studentUid
                      );
                      return (
                        <div
                          key={rec.id}
                          className="rounded-2xl border border-emerald-200/80 bg-emerald-50/20 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/10 space-y-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <UserAvatar
                                name={rec.studentName}
                                avatarUrl={studentMember?.avatarUrl}
                                size="xs"
                              />
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                {rec.studentName}
                              </span>
                              <span className="text-xs text-slate-400">•</span>
                              <span className="text-xs text-slate-500">
                                {formatVietnameseDate(rec.date, false)}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setViewingRecord(rec)}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-2.5 py-1 text-xs font-bold text-emerald-800 shadow-2xs hover:bg-emerald-50 dark:border-emerald-800 dark:bg-slate-800 dark:text-emerald-300 transition"
                                title="Xem toàn bộ câu hỏi, từ vựng hoặc nội dung học sinh đã nộp"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                <span>Xem bài làm</span>
                              </button>
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-extrabold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                                +{rec.starsAwarded} sao
                              </span>
                            </div>
                          </div>

                          <div
                            onClick={() => setViewingRecord(rec)}
                            className="text-sm font-bold text-slate-900 hover:text-emerald-700 hover:underline cursor-pointer dark:text-white dark:hover:text-emerald-400 transition"
                            title="Bấm để xem chi tiết bài làm"
                          >
                            {rec.title}
                          </div>

                          {rec.studentNote && (
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              Học sinh báo cáo: “{rec.studentNote}”
                            </p>
                          )}

                          {rec.instructorComment && (
                            <div className="rounded-xl border border-emerald-200 bg-white/90 p-2.5 text-xs text-emerald-950 dark:border-emerald-900 dark:bg-slate-900 dark:text-emerald-300">
                              <strong>Nhận xét của bạn:</strong> “{rec.instructorComment}”
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Cột phải: Bài học & Nhiệm vụ hôm nay */}
        <div className="space-y-6 lg:col-span-5">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Bài học & Nhiệm vụ hôm nay ({todayTasks.length})
              </h2>
              <Link
                to={`/app/classes/${studyClass.id}/lessons`}
                className="text-xs font-bold text-emerald-700 hover:underline dark:text-emerald-400"
              >
                + Thêm từ Thư viện
              </Link>
            </div>

            {todayTasks.length > 0 ? (
              <div className="mt-4 space-y-3">
                {todayTasks.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-extrabold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {task.subject || 'Tổng hợp'}
                      </span>
                      <span className="text-xs font-bold text-amber-600">
                        +{task.starsReward} sao
                      </span>
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      {task.title}
                    </div>
                    {task.description && (
                      <p className="text-xs text-slate-500 line-clamp-2">
                        {task.description}
                      </p>
                    )}
                  </div>
                ))}
                <Link
                  to={`/app/classes/${studyClass.id}/sessions`}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  Quản lý tất cả nhiệm vụ
                </Link>
              </div>
            ) : (
              <div className="mt-4 text-sm text-slate-500 space-y-3">
                <p>Chưa giao bài học hoặc nhiệm vụ nào cho ngày hôm nay.</p>
                <div className="flex flex-col gap-2">
                  <Link
                    to={`/app/classes/${studyClass.id}/lessons`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    <BookOpen className="h-4 w-4" />
                    Chọn bài từ Thư viện để học hôm nay
                  </Link>
                  <Link
                    to={`/app/classes/${studyClass.id}/sessions`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Giao bài tập mới
                  </Link>
                </div>
              </div>
            )}
          </section>

          {/* Thời khóa biểu hôm nay & ngày mai của lớp */}
          {sortedTodaySchedules.length > 0 && (
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Thời khóa biểu hôm nay ({DAY_OF_WEEK_LABELS[todayDayOfWeek]})
                </h3>
                <Link
                  to={`/app/classes/${studyClass.id}/schedule`}
                  className="text-xs font-bold text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  Xem cả tuần
                </Link>
              </div>
              <div className="mt-3 space-y-2">
                {sortedTodaySchedules.map((sch) => {
                  const sessionName =
                    sch.sessionOfDay === 'morning'
                      ? 'Sáng'
                      : sch.sessionOfDay === 'afternoon'
                      ? 'Chiều'
                      : sch.sessionOfDay === 'evening'
                      ? 'Tối'
                      : '';
                  return (
                    <div
                      key={sch.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800/40"
                    >
                      <span className="font-bold text-slate-900 dark:text-white">
                        {sessionName ? `${sessionName} • ` : ''}Tiết {sch.periodNumber}: {sch.subject}
                      </span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                          sch.type === 'tutoring'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {sch.type === 'tutoring' ? 'Kèm tại nhà' : 'Chính khóa'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Modal xem chi tiết bài làm học sinh */}
      {viewingRecord && studyClass && (
        <SubmissionDetailModal
          record={viewingRecord}
          studyClass={studyClass}
          assignment={viewingAssignment}
          lesson={viewingLesson}
          student={viewingStudent}
          isInstructorOrOwner={isInstructorOrOwner}
          onClose={() => setViewingRecord(null)}
          onConfirm={async (rec, stars, comment) => {
            setReviewStars((prev) => ({ ...prev, [rec.id]: stars }));
            setReviewComments((prev) => ({ ...prev, [rec.id]: comment }));
            await handleInstructorConfirm(rec, stars, comment);
            setViewingRecord(null);
          }}
          isConfirming={confirmingRecordId === viewingRecord.id}
        />
      )}
    </div>
  );
}
