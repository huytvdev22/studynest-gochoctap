import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Backpack,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Flame,
  Layers,
  Plus,
  Send,
  Sparkles,
  Star,
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
import { inferDefaultTtsLang } from '@/lib/studyAiAndSrs';
import { UserAvatar } from '@/components/ui/ThemeBadges';
import {
  FlashcardStudyModal,
  QuizTakeModal,
} from '@/components/study/InteractiveStudyModals';

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

  // State cho instructor xác nhận nhanh
  const [confirmingRecordId, setConfirmingRecordId] = useState<string | null>(
    null
  );
  const [reviewComments, setReviewComments] = useState<Record<string, string>>(
    {}
  );
  const [reviewStars, setReviewStars] = useState<Record<string, number>>({});

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

  const dayOffDates = exceptions.filter((e) => e.isDayOff).map((e) => e.date);

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
    } finally {
      setSubmittingTaskId(null);
    }
  };

  const handleInstructorConfirm = async (rec: LearningRecord) => {
    setConfirmingRecordId(rec.id);
    try {
      const stars = reviewStars[rec.id] ?? 3;
      const comment =
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
      <div className="space-y-6">
        {/* Hàng thẻ chỉ số Sao & Streak cho học sinh */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-5 dark:border-amber-900/50 dark:bg-amber-950/30">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-sm">
              <Star className="h-6 w-6 fill-white" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Tổng sao thưởng
              </div>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {streakSummary.totalStars} sao
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Do người hướng dẫn xác nhận
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 dark:border-emerald-900/50 dark:bg-emerald-950/30">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
              <Flame className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Chuỗi ngày học (Streak)
              </div>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {streakSummary.currentStreak} ngày liên tiếp
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Kỷ lục: {streakSummary.longestStreak} ngày
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-sky-200 bg-sky-50/80 p-5 dark:border-sky-900/50 dark:bg-sky-950/30">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-sm">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-sky-800 dark:text-sky-300">
                Hôm nay ({DAY_OF_WEEK_LABELS[todayDayOfWeek]})
              </div>
              <div className="text-base font-extrabold text-slate-900 dark:text-white">
                {formatVietnameseDate(today, false)}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                {streakSummary.isTodayConfirmed
                  ? 'Đã hoàn thành & được xác nhận!'
                  : 'Hãy hoàn thành bài học tối nay nhé!'}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Cột chính: Hôm nay học gì & Nhiệm vụ của em */}
          <div className="space-y-6 lg:col-span-7">
            {/* Hôm nay học gì? */}
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="h-5 w-5 text-emerald-600" />
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    Hôm nay học gì?
                  </h2>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {todayTasks.length} bài học & nhiệm vụ
                </span>
              </div>

              {todayTasks.length > 0 ? (
                <div className="space-y-3">
                  {todayTasks.map((task) => {
                    const rec = records.find(
                      (r) =>
                        r.assignmentId === task.id && r.studentUid === user.uid
                    );
                    const isConfirmed = rec?.instructorStatus === 'confirmed';
                    const isSubmitted = rec?.studentStatus === 'submitted';

                    return (
                      <div
                        key={task.id}
                        className={`rounded-2xl border p-4.5 transition ${
                          isConfirmed
                            ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20'
                            : isSubmitted
                            ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20'
                            : 'border-emerald-200/80 bg-white hover:border-emerald-400 dark:border-slate-800 dark:bg-slate-900'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {task.subject && (
                                <span className="rounded-lg bg-emerald-100 px-2.5 py-0.5 text-xs font-extrabold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                  {task.subject}
                                </span>
                              )}
                              {task.unitTitle && (
                                <span className="rounded-lg bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                  {task.unitTitle}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                                <Star className="h-3.5 w-3.5 fill-amber-400" />
                                +{task.starsReward} sao
                              </span>
                            </div>
                            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                              {task.title}
                            </h3>
                            {task.description && (
                              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                                {task.description}
                              </p>
                            )}
                          </div>

                          {isConfirmed ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Đã hoàn thành (+{rec.starsAwarded} sao)
                            </span>
                          ) : isSubmitted ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-white">
                              <Clock className="h-3.5 w-3.5" />
                              Đã nộp bài (Chờ duyệt)
                            </span>
                          ) : null}
                        </div>

                        {/* Các nút hành động: Học Flashcard / Làm Quiz / Xem bài / Nộp bài */}
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                          <div className="flex flex-wrap items-center gap-2">
                            {task.taskType === 'flashcard' && task.flashcards && task.flashcards.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setActiveFlashcardTask(task)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
                              >
                                <Layers className="h-3.5 w-3.5" />
                                Học {task.flashcards.length} Flashcard
                              </button>
                            )}

                            {task.taskType === 'quiz' && task.quizQuestions && task.quizQuestions.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setActiveQuizTask(task)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-violet-700"
                              >
                                <ClipboardCheck className="h-3.5 w-3.5" />
                                Làm bài kiểm tra ({task.quizQuestions.length} câu)
                              </button>
                            )}

                            {task.lessonId && (
                              <Link
                                to={`/app/classes/${studyClass.id}/lessons/${task.lessonId}`}
                                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                              >
                                <BookOpen className="h-3.5 w-3.5" />
                                Vào học bài này
                              </Link>
                            )}
                          </div>

                          {!isConfirmed && (
                            <button
                              type="button"
                              disabled={submittingTaskId === task.id}
                              onClick={() => void handleStudentSubmitTask(task)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                            >
                              <Send className="h-3.5 w-3.5" />
                              {submittingTaskId === task.id
                                ? 'Đang gửi...'
                                : isSubmitted
                                ? 'Nộp lại báo cáo'
                                : 'Báo đã hoàn thành'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center dark:border-slate-800 dark:bg-slate-800/40">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Hôm nay chưa có bài học nào được chỉ định.
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Em có thể vào Thư viện bài học để tự ôn luyện từ vựng và xem bài học mới nhé!
                  </p>
                  <div className="mt-4 flex justify-center gap-2">
                    <Link
                      to={`/app/classes/${studyClass.id}/lessons`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
                    >
                      <BookOpen className="h-4 w-4" />
                      Mở Thư viện bài học
                    </Link>
                  </div>
                </div>
              )}

              {/* Thời khóa biểu hôm nay */}
              {todaySchedules.length > 0 && (
                <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Thời khóa biểu hôm nay ({DAY_OF_WEEK_LABELS[todayDayOfWeek]})
                  </h3>
                  {todaySchedules.map((sch) => (
                    <div
                      key={sch.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50/70 px-3.5 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-800/40"
                    >
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white">
                          Tiết {sch.periodNumber}: {sch.subject}
                        </span>
                        {sch.startTime && (
                          <span className="ml-2 text-xs text-slate-500">
                            ({sch.startTime} - {sch.endTime})
                          </span>
                        )}
                      </div>
                      <span
                        className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${
                          sch.type === 'tutoring'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {sch.type === 'tutoring' ? 'Kèm tại nhà' : 'Chính khóa'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Nhiệm vụ khác (nếu có bài tập hạn khác hôm nay) */}
            {otherTasks.length > 0 && (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    Nhiệm vụ khác ({otherTasks.length})
                  </h2>
                  <Link
                    to={`/app/classes/${studyClass.id}/sessions`}
                    className="text-xs font-bold text-emerald-700 hover:underline dark:text-emerald-400"
                  >
                    Xem tất cả
                  </Link>
                </div>

                <div className="mt-4 space-y-4">
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
                        className={`rounded-2xl border p-4 transition ${
                          isConfirmed
                            ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-950/20'
                            : isSubmitted
                            ? 'border-amber-200 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/20'
                            : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">
                              {task.title}
                            </h3>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                              {task.description}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                              <span>Hạn: {formatVietnameseDate(task.dueDate, false)}</span>
                              <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                                <Star className="h-3.5 w-3.5 fill-amber-400" />
                                Thưởng tối đa {task.starsReward} sao
                              </span>
                            </div>
                          </div>

                          {isConfirmed ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Đã xác nhận (+{rec.starsAwarded} sao)
                            </span>
                          ) : isSubmitted ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-white">
                              <Clock className="h-3.5 w-3.5" />
                              Đã nộp • Chờ xác nhận
                            </span>
                          ) : null}
                        </div>

                        {rec?.instructorComment && (
                          <div className="mt-3 rounded-xl bg-white/80 p-3 text-xs text-slate-700 border border-emerald-200 dark:bg-slate-900 dark:border-emerald-800 dark:text-slate-200">
                            <strong>Nhận xét của người hướng dẫn:</strong>{' '}
                            {rec.instructorComment}
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
          <div className="space-y-6 lg:col-span-5">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2.5">
                <Backpack className="h-5 w-5 text-sky-600" />
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  Ngày mai học gì? ({DAY_OF_WEEK_LABELS[tomorrowDayOfWeek]})
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Checklist chuẩn bị sách vở tối nay trước khi đi ngủ:
              </p>

              {tomorrowSchedules.length === 0 ? (
                <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  Ngày mai không có tiết học trong thời khóa biểu.
                </p>
              ) : (
                <ul className="mt-4 space-y-2.5">
                  {tomorrowSchedules.map((sch) => (
                    <li
                      key={sch.id}
                      className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/50"
                    >
                      <div className="flex items-center justify-between text-sm font-bold text-slate-900 dark:text-white">
                        <span>
                          Tiết {sch.periodNumber}: {sch.subject}
                        </span>
                        <span className="text-xs font-medium text-slate-500">
                          {sch.type === 'tutoring' ? 'Kèm học' : 'Ở trường'}
                        </span>
                      </div>
                      {sch.materialsNote && (
                        <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                          Chuẩn bị: {sch.materialsNote}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-violet-600" />
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    Bài học của lớp ({lessons.length})
                  </h2>
                </div>
                <Link
                  to={`/app/classes/${studyClass.id}/lessons`}
                  className="text-xs font-bold text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  Thư viện
                </Link>
              </div>
              <div className="mt-4 space-y-2.5">
                {lessons.slice(0, 4).map((l) => (
                  <Link
                    key={l.id}
                    to={`/app/classes/${studyClass.id}/lessons/${l.id}`}
                    className="block rounded-xl border border-slate-200/80 p-3 transition hover:border-emerald-400 dark:border-slate-800 dark:hover:border-emerald-700"
                  >
                    <span className="inline-block rounded-md bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-800 dark:bg-violet-950 dark:text-violet-300">
                      {l.subject}
                    </span>
                    <div className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                      {l.title}
                    </div>
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
                assignmentId: activeFlashcardTask.id,
                sessionId: activeFlashcardTask.sessionId,
                title: activeFlashcardTask.title,
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
                assignmentId: activeQuizTask.id,
                sessionId: activeQuizTask.sessionId,
                title: activeQuizTask.title,
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
                                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                                  {rec.title}
                                </h3>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
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
                              className={`mt-3 rounded-xl p-3 text-xs ${
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

                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-extrabold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                              +{rec.starsAwarded} sao
                            </span>
                          </div>

                          <div className="text-sm font-bold text-slate-900 dark:text-white">
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
          {todaySchedules.length > 0 && (
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
                {todaySchedules.map((sch) => (
                  <div
                    key={sch.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800/40"
                  >
                    <span className="font-bold text-slate-900 dark:text-white">
                      Tiết {sch.periodNumber}: {sch.subject}
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
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
