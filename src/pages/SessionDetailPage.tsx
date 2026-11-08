import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  CheckSquare,
  Pause,
  Play,
  RotateCcw,
  Square,
  Star,
  Target,
  Timer,
  Trash2,
} from 'lucide-react';
import type { Lesson, StudySession } from '@/types/domain';
import { useAuth } from '@/contexts/AuthContext';
import { useClassContext } from '@/contexts/ClassContext';
import {
  confirmOrReviewLearningRecord,
  deleteSession,
  getSessionById,
  listLessons,
  saveSession,
  submitStudentCompletion,
} from '@/services/studyNestService';
import { formatVietnameseDate } from '@/lib/date';

export function SessionDetailPage() {
  const { sessionId = '' } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  const { studyClass, role, isInstructorOrOwner, isStudent } = useClassContext();
  const navigate = useNavigate();

  const [session, setSession] = useState<StudySession | null>(null);
  const [attachedLessons, setAttachedLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [sessionCompletedMessage, setSessionCompletedMessage] = useState<
    string | null
  >(null);

  // Client-side Focus Timer (Không ghi Firestore liên tục mỗi giây để tiết kiệm quota Spark)
  const [secondsLeft, setSecondsLeft] = useState<number>(60 * 60);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const [activePresetMinutes, setActivePresetMinutes] = useState<number>(60);

  const loadSessionDetail = useCallback(async () => {
    if (!studyClass || !role || !sessionId) return;
    setLoading(true);
    try {
      const [ses, allLessons] = await Promise.all([
        getSessionById(studyClass.id, sessionId),
        listLessons(studyClass.id, role),
      ]);
      setSession(ses);
      if (ses) {
        setSecondsLeft(ses.durationMinutes * 60);
        setActivePresetMinutes(ses.durationMinutes);
        setAttachedLessons(
          allLessons.filter((l) => ses.lessonIds.includes(l.id))
        );
      }
    } finally {
      setLoading(false);
    }
  }, [studyClass, role, sessionId]);

  useEffect(() => {
    void loadSessionDetail();
  }, [loadSessionDetail]);

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning]);

  if (!studyClass || !user || !role) return null;

  if (loading) {
    return (
      <div className="h-64 animate-pulse rounded-3xl bg-slate-200/70 dark:bg-slate-800/60" />
    );
  }

  if (!session) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
          Không tìm thấy buổi học này
        </h2>
        <Link
          to={`/app/classes/${studyClass.id}/sessions`}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại danh sách buổi học
        </Link>
      </div>
    );
  }

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const formattedTimer = `${String(mins).padStart(2, '0')}:${String(
    secs
  ).padStart(2, '0')}`;

  const selectTimerPreset = (minutes: number) => {
    setTimerRunning(false);
    setActivePresetMinutes(minutes);
    setSecondsLeft(minutes * 60);
  };

  const toggleChecklistStep = async (itemId: string) => {
    const nextChecklist = session.checklist.map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    setSession({ ...session, checklist: nextChecklist });

    if (isInstructorOrOwner) {
      const allDone = nextChecklist.every((c) => c.completed);
      await saveSession(studyClass.id, user.uid, {
        id: session.id,
        date: session.date,
        title: session.title,
        goal: session.goal,
        durationMinutes: session.durationMinutes,
        lessonIds: session.lessonIds,
        checklist: nextChecklist,
        status: allDone ? 'completed' : 'in_progress',
        summaryNote: session.summaryNote,
      });
    }
  };

  const handleStudentReportSessionDone = async () => {
    await submitStudentCompletion({
      classId: studyClass.id,
      studentUid: user.uid,
      studentName: user.displayName,
      type: 'session',
      assignmentId: null,
      sessionId: session.id,
      title: session.title,
      date: session.date,
      studentNote: 'Em đã hoàn thành buổi học 60 phút hôm nay ạ!',
    });
    setSessionCompletedMessage(
      'Đã gửi báo cáo hoàn thành buổi học! Chờ người hướng dẫn xác nhận để cộng sao & tính Streak nhé.'
    );
  };

  const handleInstructorCompleteSession = async () => {
    await saveSession(studyClass.id, user.uid, {
      id: session.id,
      date: session.date,
      title: session.title,
      goal: session.goal,
      durationMinutes: session.durationMinutes,
      lessonIds: session.lessonIds,
      checklist: session.checklist.map((c) => ({ ...c, completed: true })),
      status: 'completed',
      summaryNote: session.summaryNote,
    });
    await confirmOrReviewLearningRecord({
      classId: studyClass.id,
      instructorUid: user.uid,
      recordId: `session_${session.id}_${user.uid}`,
      studentUid: user.uid,
      studentName: 'Hoàn thành buổi học',
      type: 'session',
      assignmentId: null,
      sessionId: session.id,
      title: session.title,
      date: session.date,
      instructorStatus: 'confirmed',
      starsAwarded: 5,
      instructorComment: 'Đã hoàn thành trọn vẹn buổi học 60 phút!',
    });
    setSessionCompletedMessage(
      'Đã đánh dấu hoàn thành buổi học 60 phút! Bạn có thể sang mục Sao & Chuỗi ngày học để tặng sao cho từng học sinh.'
    );
    await loadSessionDetail();
  };

  const handleDelete = async () => {
    await deleteSession(studyClass.id, session.id);
    navigate(`/app/classes/${studyClass.id}/sessions`);
  };

  const completedSteps = session.checklist.filter((c) => c.completed).length;
  const totalSteps = session.checklist.length || 1;
  const progressPercent = Math.round((completedSteps / totalSteps) * 100);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={`/app/classes/${studyClass.id}/sessions`}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại danh sách buổi học
        </Link>

        {isInstructorOrOwner && (
          <button
            type="button"
            onClick={() => void handleDelete()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Xóa buổi học
          </button>
        )}
      </div>

      {sessionCompletedMessage && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <span>{sessionCompletedMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Cột trái: Đồng hồ Focus Mode phía Client */}
        <div className="lg:col-span-5">
          <div className="rounded-3xl border border-emerald-200 bg-gradient-to-b from-emerald-900 to-slate-900 p-6 sm:p-8 text-center text-white shadow-xl">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300">
              <Timer className="h-4 w-4" />
              Chế độ học tập trung (Focus Timer)
            </div>

            <div
              className="my-6 font-mono text-5xl sm:text-6xl font-extrabold tracking-wider text-white"
              aria-live="off"
            >
              {formattedTimer}
            </div>

            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {[
                { label: 'Tổng 60p', min: 60 },
                { label: 'Bài cũ 15p', min: 15 },
                { label: 'Bài mới 30p', min: 30 },
                { label: 'Soạn cặp 10p', min: 10 },
                { label: 'Tổng kết 5p', min: 5 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => selectTimerPreset(preset.min)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    activePresetMinutes === preset.min
                      ? 'bg-emerald-500 text-white'
                      : 'bg-white/10 text-slate-200 hover:bg-white/20'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setTimerRunning((r) => !r)}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-extrabold text-white shadow-md hover:bg-emerald-400"
              >
                {timerRunning ? (
                  <>
                    <Pause className="h-4 w-4" /> Tạm dừng
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" /> Bắt đầu đếm giờ
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => selectTimerPreset(activePresetMinutes)}
                aria-label="Đặt lại đồng hồ"
                className="inline-flex items-center justify-center rounded-2xl bg-white/10 p-3 text-white hover:bg-white/20"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-4 text-[11px] text-slate-300">
              Đồng hồ chạy mượt trên trình duyệt, không ghi dữ liệu mỗi giây lên Firestore để tiết kiệm tuyệt đối hạn mức Spark.
            </p>
          </div>
        </div>

        {/* Cột phải: Checklist 4 bước & Bài học gắn kèm */}
        <div className="space-y-6 lg:col-span-7">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                {formatVietnameseDate(session.date)} • {session.durationMinutes} phút
              </span>
              <span className="text-xs font-bold text-slate-500">
                Tiến độ: {progressPercent}% ({completedSteps}/{totalSteps})
              </span>
            </div>

            <h1 className="mt-1 text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
              {session.title}
            </h1>
            {session.goal && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                <Target className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>Mục tiêu: {session.goal}</span>
              </p>
            )}

            {/* Checklist */}
            <div className="mt-5 space-y-2.5">
              {session.checklist.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void toggleChecklistStep(item.id)}
                  className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${
                    item.completed
                      ? 'border-emerald-400 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/30'
                      : 'border-slate-200 bg-slate-50/60 hover:border-emerald-300 dark:border-slate-800 dark:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {item.completed ? (
                      <CheckSquare className="h-5 w-5 shrink-0 text-emerald-600" />
                    ) : (
                      <Square className="h-5 w-5 shrink-0 text-slate-400" />
                    )}
                    <span
                      className={`text-sm font-bold ${
                        item.completed
                          ? 'line-through text-slate-500'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>

                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      selectTimerPreset(item.durationMinutes);
                    }}
                    className="rounded-lg bg-white px-2.5 py-1 text-xs font-extrabold text-emerald-700 shadow-2xs hover:bg-emerald-50 dark:bg-slate-900 dark:text-emerald-400"
                  >
                    Hẹn {item.durationMinutes}p
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              {isStudent ? (
                <button
                  type="button"
                  onClick={() => void handleStudentReportSessionDone()}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-emerald-700"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Em đã hoàn thành buổi học hôm nay
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleInstructorCompleteSession()}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-emerald-700"
                >
                  <Star className="h-4 w-4" />
                  Chốt hoàn thành buổi học 60 phút
                </button>
              )}
            </div>
          </div>

          {/* Bài học gắn với buổi học này */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900 dark:text-white">
              <BookOpen className="h-5 w-5 text-emerald-600" />
              Bài học trong buổi tối nay ({attachedLessons.length})
            </h2>

            {attachedLessons.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                Buổi học này chưa gắn bài học cụ thể nào từ thư viện.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {attachedLessons.map((les) => (
                  <Link
                    key={les.id}
                    to={`/app/classes/${studyClass.id}/lessons/${les.id}`}
                    className="block rounded-2xl border border-slate-200 p-4 transition hover:border-emerald-400 dark:border-slate-800"
                  >
                    <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      {les.subject}
                    </span>
                    <div className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                      {les.title}
                    </div>
                    {les.goal && (
                      <p className="mt-1 text-xs text-slate-500">{les.goal}</p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

