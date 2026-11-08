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
} from 'lucide-react';
import type {
  Assignment,
  JoinRequest,
  LearningRecord,
  Lesson,
  ScheduleException,
  ScheduleItem,
  SrsCardProgress,
  StudySession,
} from '@/types/domain';
import { useAuth } from '@/contexts/AuthContext';
import { useClassContext } from '@/contexts/ClassContext';
import {
  confirmOrReviewLearningRecord,
  getStudentSrsStates,
  listAssignments,
  listJoinRequests,
  listLearningRecords,
  listLessons,
  listScheduleExceptions,
  listSchedules,
  listSessions,
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
import {
  FlashcardStudyModal,
  QuizTakeModal,
} from '@/components/study/InteractiveStudyModals';

export function ClassDashboardPage() {
  const { user } = useAuth();
  const { studyClass, role, isOwner, isInstructorOrOwner, isStudent } =
    useClassContext();

  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [records, setRecords] = useState<LearningRecord[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [exceptions, setExceptions] = useState<ScheduleException[]>([]);
  const [pendingRequests, setPendingRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  // Mặc định mọi thành viên vào lớp đều hiển thị giao diện Góc học tập (giống học sinh);
  // Người hướng dẫn / Chủ lớp có thể chuyển sang tab Quản lý lớp khi cần.
  const [dashboardMode, setDashboardMode] = useState<'learning' | 'managing'>(
    'learning'
  );

  // State cho học sinh nộp bài nhanh & làm Flashcard / Quiz
  const [submittingTaskId, setSubmittingTaskId] = useState<string | null>(null);
  const [studentNotes, setStudentNotes] = useState<Record<string, string>>({});
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
      const [ses, asg, rec, les, sch, exc, srs] = await Promise.all([
        listSessions(studyClass.id, 15),
        listAssignments(studyClass.id, user.uid, role),
        listLearningRecords(studyClass.id, user.uid, role, 60),
        listLessons(studyClass.id, role),
        listSchedules(studyClass.id),
        listScheduleExceptions(studyClass.id),
        getStudentSrsStates(studyClass.id, user.uid),
      ]);
      setSessions(ses);
      setAssignments(asg);
      setRecords(rec);
      setLessons(les);
      setSchedules(sch);
      setExceptions(exc);
      setSrsStates(srs);

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

  const todaySession = sessions.find((s) => s.date === today) || null;
  const nextSession =
    sessions
      .filter((s) => s.date > today)
      .sort((a, b) => a.date.localeCompare(b.date))[0] || null;

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

  const unverifiedRecords = records.filter(
    (r) => r.studentStatus === 'submitted' && r.instructorStatus === 'unverified'
  );

  const handleStudentSubmitTask = async (task: Assignment) => {
    setSubmittingTaskId(task.id);
    try {
      const note =
        studentNotes[task.id]?.trim() || 'Em đã hoàn thành nhiệm vụ này ạ!';
      await submitStudentCompletion({
        classId: studyClass.id,
        studentUid: user.uid,
        studentName: user.displayName,
        type: 'assignment',
        assignmentId: task.id,
        sessionId: task.sessionId,
        title: task.title,
        date: today,
        studentNote: note,
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

  const pendingActionCount = unverifiedRecords.length + pendingRequests.length;
  const modeToggleBar = isInstructorOrOwner ? (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-2.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
        Chế độ hiển thị trang tổng quan:
      </span>
      <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        <button
          type="button"
          onClick={() => setDashboardMode('learning')}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
            dashboardMode === 'learning'
              ? 'bg-white text-emerald-700 shadow-xs dark:bg-slate-900 dark:text-emerald-400'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
          }`}
        >
          Góc học tập (Mặc định)
        </button>
        <button
          type="button"
          onClick={() => setDashboardMode('managing')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
            dashboardMode === 'managing'
              ? 'bg-white text-emerald-700 shadow-xs dark:bg-slate-900 dark:text-emerald-400'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
          }`}
        >
          <span>Dành cho người hướng dẫn</span>
          {pendingActionCount > 0 && (
            <span className="rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] font-extrabold text-white">
              {pendingActionCount}
            </span>
          )}
        </button>
      </div>
    </div>
  ) : null;

  // =========================================================================
  // STUDENT DASHBOARD ("Hôm nay học gì?" - Mặc định cho mọi thành viên trong lớp)
  // =========================================================================
  if (isStudent || dashboardMode === 'learning') {
    return (
      <div className="space-y-6">
        {modeToggleBar}
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
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="h-5 w-5 text-emerald-600" />
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    Hôm nay học gì?
                  </h2>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  60 phút buổi tối
                </span>
              </div>

              {todaySession ? (
                <div className="mt-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {todaySession.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Mục tiêu: {todaySession.goal}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Link
                      to={`/app/classes/${studyClass.id}/sessions/${todaySession.id}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs sm:text-sm font-bold text-white hover:bg-emerald-700"
                    >
                      <Clock className="h-4 w-4" />
                      Mở chế độ học tập trung ({todaySession.durationMinutes} phút)
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-slate-200/70 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                  Hôm nay chưa có buổi học riêng được tạo. Em hãy xem các nhiệm vụ bên dưới và ôn bài trong Thư viện bài học nhé!
                </div>
              )}

              {todaySchedules.length > 0 && (
                <div className="mt-4 space-y-2">
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

            {/* Nhiệm vụ của em */}
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  Nhiệm vụ của em ({assignments.length})
                </h2>
                <Link
                  to={`/app/classes/${studyClass.id}/sessions`}
                  className="text-xs font-bold text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  Xem tất cả
                </Link>
              </div>

              {assignments.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  Hiện tại em chưa có nhiệm vụ nào được giao.
                </p>
              ) : (
                <div className="mt-4 space-y-4">
                  {assignments.map((task) => {
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

                        {/* Nút mở tương tác nếu là nhiệm vụ Flashcard hoặc Bài kiểm tra Trắc nghiệm */}
                        {task.taskType === 'flashcard' &&
                          (task.flashcards?.length || 0) > 0 && (
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-900 dark:text-emerald-200">
                                <Layers className="h-3.5 w-3.5 text-emerald-600" />
                                Bộ Flashcard: {task.flashcards?.length} thẻ
                                {task.subject ? ` (${task.subject})` : ''}
                              </span>
                              <button
                                type="button"
                                onClick={() => setActiveFlashcardTask(task)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
                              >
                                <Layers className="h-3.5 w-3.5" />
                                {isSubmitted
                                  ? 'Lật ôn lại bộ Flashcard'
                                  : 'Bắt đầu học Flashcard'}
                              </button>
                            </div>
                          )}

                        {task.taskType === 'quiz' &&
                          (task.quizQuestions?.length || 0) > 0 && (
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-violet-200 bg-violet-50/60 p-3 dark:border-violet-900/50 dark:bg-violet-950/30">
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-900 dark:text-violet-200">
                                <ClipboardCheck className="h-3.5 w-3.5 text-violet-600" />
                                Đề trắc nghiệm: {task.quizQuestions?.length} câu
                                {rec?.quizTotal
                                  ? ` • Đã đạt: ${rec.quizScore}/${rec.quizTotal} câu đúng`
                                  : ''}
                              </span>
                              <button
                                type="button"
                                onClick={() => setActiveQuizTask(task)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-violet-700"
                              >
                                <ClipboardCheck className="h-3.5 w-3.5" />
                                {isSubmitted
                                  ? 'Làm lại bài kiểm tra'
                                  : 'Làm bài kiểm tra ngay'}
                              </button>
                            </div>
                          )}

                        {!isConfirmed &&
                          task.taskType !== 'flashcard' &&
                          task.taskType !== 'quiz' && (
                            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                              <input
                                type="text"
                                aria-label={`Ghi chú hoàn thành cho ${task.title}`}
                                value={
                                  studentNotes[task.id] ??
                                  rec?.studentNote ??
                                  ''
                                }
                                onChange={(e) =>
                                  setStudentNotes((prev) => ({
                                    ...prev,
                                    [task.id]: e.target.value,
                                  }))
                                }
                                placeholder="Ghi chú của em (VD: Em đã làm xong vào vở ô ly ạ)..."
                                className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                              />
                              <button
                                type="button"
                                disabled={submittingTaskId === task.id}
                                onClick={() =>
                                  void handleStudentSubmitTask(task)
                                }
                                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs sm:text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                <Send className="h-3.5 w-3.5" />
                                {isSubmitted
                                  ? 'Cập nhật báo cáo'
                                  : 'Em đã làm xong'}
                              </button>
                            </div>
                          )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
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
  // INSTRUCTOR / OWNER DASHBOARD
  // =========================================================================
  return (
    <div className="space-y-6">
      {modeToggleBar}
      {/* Thống kê nhanh cho người hướng dẫn */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Buổi học hôm nay ({formatVietnameseDate(today, false)})
          </div>
          <div className="mt-2 text-lg font-extrabold text-slate-900 dark:text-white">
            {todaySession ? todaySession.title : 'Chưa tạo buổi học hôm nay'}
          </div>
          <div className="mt-2">
            <Link
              to={
                todaySession
                  ? `/app/classes/${studyClass.id}/sessions/${todaySession.id}`
                  : `/app/classes/${studyClass.id}/sessions`
              }
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline dark:text-emerald-400"
            >
              {todaySession ? 'Mở buổi học 60 phút' : 'Tạo buổi học ngay'}
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
      {isInstructorOrOwner && (
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
            <Clock className="h-3.5 w-3.5" />
            Tạo buổi học 60 phút / Giao bài
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
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Cột trái: Duyệt nhanh bài nộp của học sinh */}
        <div className="space-y-6 lg:col-span-7">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Học sinh báo cáo hoàn thành ({unverifiedRecords.length})
              </h2>
              <Link
                to={`/app/classes/${studyClass.id}/progress`}
                className="text-xs font-bold text-emerald-700 hover:underline dark:text-emerald-400"
              >
                Xem toàn bộ nhật ký
              </Link>
            </div>

            {unverifiedRecords.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-800">
                Hiện không có bài nộp nào đang chờ xác nhận.
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {unverifiedRecords.map((rec) => (
                  <div
                    key={rec.id}
                    className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 dark:border-amber-900/50 dark:bg-amber-950/20"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                          {rec.studentName} • Ngày {formatVietnameseDate(rec.date, false)}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          {rec.title}
                        </h3>
                      </div>
                      <span className="rounded-full bg-amber-200/80 px-2.5 py-0.5 text-xs font-bold text-amber-950">
                        Chờ xác nhận
                      </span>
                    </div>

                    {rec.studentNote && (
                      <p className="mt-2 rounded-xl bg-white p-3 text-xs text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                        <strong>Học sinh nhắn:</strong> “{rec.studentNote}”
                      </p>
                    )}

                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-12 items-center">
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
                          placeholder="Nhận xét khích lệ em..."
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <button
                          type="button"
                          disabled={confirmingRecordId === rec.id}
                          onClick={() => void handleInstructorConfirm(rec)}
                          className="w-full rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {confirmingRecordId === rec.id
                            ? 'Đang lưu...'
                            : 'Xác nhận & Tặng sao'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Cột phải: Checklist buổi học hôm nay & Buổi kế tiếp */}
        <div className="space-y-6 lg:col-span-5">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Kế hoạch buổi học 60 phút
            </h2>

            {todaySession ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl bg-emerald-50/70 p-4 dark:bg-emerald-950/30">
                  <div className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-400">
                    Hôm nay • {todaySession.durationMinutes} phút
                  </div>
                  <div className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                    {todaySession.title}
                  </div>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    {todaySession.goal}
                  </p>
                </div>

                <ul className="space-y-2">
                  {todaySession.checklist.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200/80 px-3.5 py-2 text-xs dark:border-slate-800"
                    >
                      <span
                        className={
                          item.completed
                            ? 'line-through text-slate-400'
                            : 'font-semibold text-slate-800 dark:text-slate-200'
                        }
                      >
                        {item.label}
                      </span>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {item.durationMinutes}p
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  to={`/app/classes/${studyClass.id}/sessions/${todaySession.id}`}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  <Clock className="h-4 w-4" />
                  Bắt đầu / Điều phối buổi học hôm nay
                </Link>
              </div>
            ) : (
              <div className="mt-4 text-sm text-slate-500">
                Chưa có buổi học cho ngày hôm nay.{' '}
                <Link
                  to={`/app/classes/${studyClass.id}/sessions`}
                  className="font-bold text-emerald-600 underline"
                >
                  Tạo buổi học 60 phút ngay
                </Link>
              </div>
            )}

            {nextSession && (
              <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Buổi học kế tiếp ({formatVietnameseDate(nextSession.date, false)})
                </div>
                <div className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-200">
                  {nextSession.title}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
