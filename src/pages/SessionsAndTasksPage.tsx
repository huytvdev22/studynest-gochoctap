import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Layers,
  Play,
  Plus,
  Send,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import type {
  Assignment,
  ClassMember,
  LearningRecord,
  Lesson,
  SessionChecklistItem,
  SrsCardProgress,
  StudySession,
} from '@/types/domain';
import { useAuth } from '@/contexts/AuthContext';
import { useClassContext } from '@/contexts/ClassContext';
import {
  confirmOrReviewLearningRecord,
  deleteAssignment,
  getStudentSrsStates,
  listAssignments,
  listClassMembers,
  listLearningRecords,
  listLessons,
  listSessions,
  saveAssignment,
  saveSession,
  saveStudentSrsStates,
  submitStudentCompletion,
} from '@/services/studyNestService';
import {
  DEFAULT_SESSION_CHECKLIST,
  validateAssignmentInput,
  validateSessionInput,
} from '@/lib/validation';
import { formatDateInTimezone, formatVietnameseDate } from '@/lib/date';
import { EmptyState, UserAvatar } from '@/components/ui/ThemeBadges';
import {
  FlashcardStudyModal,
  QuizTakeModal,
} from '@/components/study/InteractiveStudyModals';
import { inferDefaultTtsLang } from '@/lib/studyAiAndSrs';

export function SessionsAndTasksPage() {
  const { user } = useAuth();
  const { studyClass, role, isInstructorOrOwner, isStudent } = useClassContext();
  const navigate = useNavigate();

  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [records, setRecords] = useState<LearningRecord[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<ClassMember[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal tạo buổi học 60 phút
  const [showSessionModal, setShowSessionModal] = useState<boolean>(false);
  const [sesDate, setSesDate] = useState<string>('');
  const [sesTitle, setSesTitle] = useState<string>(
    'Buổi học 60 phút buổi tối'
  );
  const [sesGoal, setSesGoal] = useState<string>('');
  const [sesDuration, setSesDuration] = useState<number>(60);
  const [sesLessonIds, setSesLessonIds] = useState<string[]>([]);
  const [sesChecklist, setSesChecklist] = useState<SessionChecklistItem[]>(
    DEFAULT_SESSION_CHECKLIST
  );
  const [sesError, setSesError] = useState<string | null>(null);

  // Modal tạo nhiệm vụ (Assignment)
  const [showTaskModal, setShowTaskModal] = useState<boolean>(false);
  const [taskTitle, setTaskTitle] = useState<string>('');
  const [taskDesc, setTaskDesc] = useState<string>('');
  const [taskDueDate, setTaskDueDate] = useState<string>('');
  const [taskStars, setTaskStars] = useState<number>(3);
  const [taskSessionId, setTaskSessionId] = useState<string>('');
  const [taskAssignedUids, setTaskAssignedUids] = useState<string[]>(['ALL']);
  const [taskError, setTaskError] = useState<string | null>(null);

  // Học sinh nộp bài
  const [studentNotes, setStudentNotes] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [srsStates, setSrsStates] = useState<Record<string, SrsCardProgress>>({});
  const [activeFlashcardTask, setActiveFlashcardTask] =
    useState<Assignment | null>(null);
  const [activeQuizTask, setActiveQuizTask] = useState<Assignment | null>(null);

  const loadAll = useCallback(async () => {
    if (!studyClass || !user || !role) return;
    setLoading(true);
    try {
      const today = formatDateInTimezone(new Date(), studyClass.timezone);
      setSesDate((prev) => prev || today);
      setTaskDueDate((prev) => prev || today);

      const [ses, asg, rec, les, mems, srsMap] = await Promise.all([
        listSessions(studyClass.id, 30),
        listAssignments(studyClass.id, user.uid, role),
        listLearningRecords(studyClass.id, user.uid, role, 80),
        listLessons(studyClass.id, role),
        listClassMembers(studyClass.id),
        getStudentSrsStates(studyClass.id, user.uid),
      ]);
      setSessions(ses);
      setAssignments(asg);
      setRecords(rec);
      setLessons(les);
      setStudents(mems.filter((m) => m.role === 'student'));
      setSrsStates(srsMap);
    } finally {
      setLoading(false);
    }
  }, [studyClass, user, role]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  if (!studyClass || !user || !role) return null;

  const today = formatDateInTimezone(new Date(), studyClass.timezone);

  const toggleLessonSelection = (lessonId: string) => {
    setSesLessonIds((prev) =>
      prev.includes(lessonId)
        ? prev.filter((id) => id !== lessonId)
        : [...prev, lessonId]
    );
  };

  const handleChecklistItemChange = (
    idx: number,
    field: 'label' | 'durationMinutes',
    val: string | number
  ) => {
    setSesChecklist((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: val } : item))
    );
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setSesError(null);
    const v = validateSessionInput({
      title: sesTitle,
      date: sesDate,
      durationMinutes: sesDuration,
    });
    if (!v.valid) {
      setSesError(v.error || 'Dữ liệu buổi học không hợp lệ.');
      return;
    }

    const created = await saveSession(studyClass.id, user.uid, {
      date: sesDate,
      title: sesTitle,
      goal: sesGoal,
      durationMinutes: sesDuration,
      lessonIds: sesLessonIds,
      checklist: sesChecklist,
      status: 'planned',
      summaryNote: '',
    });
    setShowSessionModal(false);
    navigate(`/app/classes/${studyClass.id}/sessions/${created.id}`);
  };

  const toggleStudentTarget = (uid: string) => {
    if (uid === 'ALL') {
      setTaskAssignedUids(['ALL']);
      return;
    }
    setTaskAssignedUids((prev) => {
      const withoutAll = prev.filter((x) => x !== 'ALL');
      if (withoutAll.includes(uid)) {
        const next = withoutAll.filter((x) => x !== uid);
        return next.length === 0 ? ['ALL'] : next;
      }
      return [...withoutAll, uid];
    });
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setTaskError(null);
    const v = validateAssignmentInput({
      title: taskTitle,
      dueDate: taskDueDate,
      starsReward: taskStars,
      assignedStudentUids: taskAssignedUids,
    });
    if (!v.valid) {
      setTaskError(v.error || 'Dữ liệu nhiệm vụ không hợp lệ.');
      return;
    }

    await saveAssignment(studyClass.id, user.uid, {
      sessionId: taskSessionId || null,
      lessonId: null,
      title: taskTitle,
      description: taskDesc,
      dueDate: taskDueDate,
      assignedStudentUids: taskAssignedUids,
      starsReward: taskStars,
    });
    setTaskTitle('');
    setTaskDesc('');
    setShowTaskModal(false);
    await loadAll();
  };

  const handleDeleteTask = async (assignmentId: string) => {
    await deleteAssignment(studyClass.id, assignmentId);
    await loadAll();
  };

  const handleStudentSubmit = async (task: Assignment) => {
    setSubmittingId(task.id);
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
        studentNote:
          studentNotes[task.id]?.trim() || 'Em đã hoàn thành nhiệm vụ ạ!',
      });
      await loadAll();
    } finally {
      setSubmittingId(null);
    }
  };

  const handleQuickConfirmTask = async (
    task: Assignment,
    student: { uid: string; displayName: string },
    existingRec?: LearningRecord
  ) => {
    const recId = existingRec?.id || `${task.id}_${student.uid}`;
    setSubmittingId(recId);
    try {
      await confirmOrReviewLearningRecord({
        classId: studyClass.id,
        instructorUid: user.uid,
        recordId: recId,
        studentUid: student.uid,
        studentName: student.displayName,
        type: 'assignment',
        assignmentId: task.id,
        sessionId: task.sessionId,
        title: task.title,
        date: existingRec?.date || today,
        instructorStatus: 'confirmed',
        starsAwarded: task.starsReward,
        instructorComment: 'Đã kiểm tra bài làm, hoàn thành rất tốt!',
      });
      await loadAll();
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Phần 1: Các buổi học 60 phút */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
              Lịch các buổi học kèm ({sessions.length})
            </h2>
            <p className="text-xs text-slate-500">
              Mỗi buổi học được thiết kế chuẩn 60 phút với checklist 4 bước và đồng hồ tập trung.
            </p>
          </div>

          {isInstructorOrOwner && (
            <button
              type="button"
              onClick={() => setShowSessionModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              Tạo buổi học 60 phút
            </button>
          )}
        </div>

        {loading ? (
          <div className="h-40 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/60" />
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={<Clock className="h-6 w-6" />}
            title="Chưa có buổi học nào được tạo"
            description="Hãy tạo buổi học 60 phút với checklist mẫu để bắt đầu giờ học buổi tối."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {sessions.map((ses) => {
              const doneSteps = ses.checklist.filter((c) => c.completed).length;
              const totalSteps = ses.checklist.length || 1;
              const pct = Math.round((doneSteps / totalSteps) * 100);

              return (
                <div
                  key={ses.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {formatVietnameseDate(ses.date)}
                      </span>
                      <span className="text-xs font-bold text-slate-500">
                        {ses.durationMinutes} phút • {doneSteps}/{totalSteps} mục
                      </span>
                    </div>

                    <h3 className="mt-3 text-lg font-extrabold text-slate-900 dark:text-white">
                      {ses.title}
                    </h3>
                    {ses.goal && (
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        Mục tiêu: {ses.goal}
                      </p>
                    )}

                    {/* Thanh tiến độ checklist */}
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                    <span className="text-xs text-slate-500">
                      Gắn {ses.lessonIds.length} bài học
                    </span>
                    <Link
                      to={`/app/classes/${studyClass.id}/sessions/${ses.id}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Vào chế độ học tập trung
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Phần 2: Danh sách Nhiệm vụ (Assignments) */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
              Nhiệm vụ & Bài tập ({assignments.length})
            </h2>
            <p className="text-xs text-slate-500">
              Học sinh tự đánh dấu hoàn thành; người hướng dẫn xác nhận để cộng sao thưởng và chuỗi ngày học.
            </p>
          </div>

          {isInstructorOrOwner && (
            <button
              type="button"
              onClick={() => setShowTaskModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
            >
              <Plus className="h-4 w-4" />
              Giao nhiệm vụ mới
            </button>
          )}
        </div>

        {assignments.length === 0 ? (
          <EmptyState
            icon={<Star className="h-6 w-6" />}
            title="Chưa có nhiệm vụ nào"
            description="Người hướng dẫn có thể giao bài tập ngắn theo buổi học để học sinh rèn luyện."
          />
        ) : (
          <div className="space-y-4">
            {assignments.map((task) => {
              const taskRecords = records.filter(
                (r) => r.assignmentId === task.id
              );
              const myRecord = taskRecords.find(
                (r) => r.studentUid === user.uid
              );

              return (
                <div
                  key={task.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        {task.taskType === 'flashcard' && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2.5 py-0.5 text-xs font-extrabold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                            <Layers className="h-3.5 w-3.5" />
                            Thẻ Flashcard ({task.flashcards?.length || 0} thẻ)
                          </span>
                        )}
                        {task.taskType === 'quiz' && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-violet-100 px-2.5 py-0.5 text-xs font-extrabold text-violet-900 dark:bg-violet-950 dark:text-violet-300">
                            <ClipboardCheck className="h-3.5 w-3.5" />
                            Bài kiểm tra ({task.quizQuestions?.length || 0} câu)
                          </span>
                        )}
                        {task.subject && (
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            📚 {task.subject}
                            {task.unitTitle ? ` • ${task.unitTitle}` : ''}
                          </span>
                        )}
                        <span className="rounded-md bg-amber-100 px-2.5 py-0.5 text-xs font-extrabold text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                          ⭐ Thưởng {task.starsReward} sao
                        </span>
                        <span className="text-xs text-slate-500">
                          Hạn: {formatVietnameseDate(task.dueDate, false)}
                        </span>
                        <span className="text-xs text-slate-500">
                          • Giao cho:{' '}
                          {task.assignedStudentUids.includes('ALL')
                            ? 'Cả lớp'
                            : `${task.assignedStudentUids.length} học sinh`}
                        </span>
                      </div>

                      <h3 className="mt-2 text-base font-extrabold text-slate-900 dark:text-white">
                        {task.title}
                      </h3>
                      {task.description && (
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                          {task.description}
                        </p>
                      )}

                      {task.taskType === 'flashcard' &&
                        (task.flashcards?.length || 0) > 0 && (
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() => setActiveFlashcardTask(task)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                            >
                              <Layers className="h-3.5 w-3.5" />
                              Vào học bộ Flashcard ({task.flashcards?.length} thẻ)
                            </button>
                          </div>
                        )}
                      {task.taskType === 'quiz' &&
                        (task.quizQuestions?.length || 0) > 0 && (
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() => setActiveQuizTask(task)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-violet-700"
                            >
                              <ClipboardCheck className="h-3.5 w-3.5" />
                              Làm bài trắc nghiệm ({task.quizQuestions?.length} câu)
                            </button>
                          </div>
                        )}
                    </div>

                    {isInstructorOrOwner && (
                      <button
                        type="button"
                        onClick={() => void handleDeleteTask(task.id)}
                        aria-label={`Xóa nhiệm vụ ${task.title}`}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Khu vực nộp bài cho Học sinh */}
                  {isStudent && (
                    <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                      {myRecord?.instructorStatus === 'confirmed' ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                          <span className="inline-flex items-center gap-1.5">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            Đã được xác nhận hoàn thành (+{myRecord.starsAwarded} sao)
                          </span>
                          {myRecord.instructorComment && (
                            <span>Nhận xét: “{myRecord.instructorComment}”</span>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <input
                            type="text"
                            aria-label="Ghi chú hoàn thành của em"
                            value={
                              studentNotes[task.id] ?? myRecord?.studentNote ?? ''
                            }
                            onChange={(e) =>
                              setStudentNotes((prev) => ({
                                ...prev,
                                [task.id]: e.target.value,
                              }))
                            }
                            placeholder="Nhập ghi chú kết quả làm bài của em..."
                            className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm dark:border-slate-700 dark:bg-slate-800"
                          />
                          <button
                            type="button"
                            disabled={submittingId === task.id}
                            onClick={() => void handleStudentSubmit(task)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            <Send className="h-3.5 w-3.5" />
                            {myRecord?.studentStatus === 'submitted'
                              ? 'Cập nhật báo cáo (Đang chờ duyệt)'
                              : 'Đánh dấu đã làm xong'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Khu vực theo dõi & xác nhận theo từng học sinh cho Instructor/Owner */}
                  {isInstructorOrOwner && (
                    <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                      <div className="text-xs font-bold text-slate-500 mb-2">
                        Tiến độ theo học sinh:
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {students
                          .filter(
                            (st) =>
                              task.assignedStudentUids.includes('ALL') ||
                              task.assignedStudentUids.includes(st.uid)
                          )
                          .map((st) => {
                            const rec = taskRecords.find(
                              (r) => r.studentUid === st.uid
                            );
                            const confirmed =
                              rec?.instructorStatus === 'confirmed';
                            const submitted = rec?.studentStatus === 'submitted';

                            return (
                              <div
                                key={st.uid}
                                className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800/40"
                              >
                                <div className="flex items-center gap-2.5">
                                  <UserAvatar
                                    name={st.displayName}
                                    avatarUrl={
                                      st.avatarUrl ||
                                      (st.uid === user.uid ? user.photoURL : '')
                                    }
                                    size="sm"
                                  />
                                  <div>
                                    <div className="font-bold text-slate-900 dark:text-white">
                                      {st.displayName}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      {confirmed
                                        ? `Đã xác nhận (+${rec.starsAwarded} sao)${
                                            typeof rec.quizScore === 'number' &&
                                            typeof rec.quizTotal === 'number'
                                              ? ` • Điểm: ${rec.quizScore}/${rec.quizTotal}`
                                              : ''
                                          }`
                                        : submitted
                                        ? `Đã nộp${
                                            typeof rec.quizScore === 'number' &&
                                            typeof rec.quizTotal === 'number'
                                              ? ` (${rec.quizScore}/${rec.quizTotal} câu đúng)`
                                              : ''
                                          }: “${rec.studentNote || 'Đã làm xong'}”`
                                        : 'Chưa nộp'}
                                    </div>
                                  </div>
                                </div>

                                {!confirmed && (
                                  <button
                                    type="button"
                                    disabled={
                                      submittingId === `${task.id}_${st.uid}`
                                    }
                                    onClick={() =>
                                      void handleQuickConfirmTask(task, st, rec)
                                    }
                                    className="shrink-0 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700"
                                  >
                                    Xác nhận +{task.starsReward}⭐
                                  </button>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Modal tạo buổi học 60 phút */}
      {isInstructorOrOwner && showSessionModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="my-8 w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Tạo buổi học kèm 60 phút
              </h3>
              <button
                type="button"
                onClick={() => setShowSessionModal(false)}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => void handleCreateSession(e)}
              className="mt-4 space-y-4"
            >
              {sesError && (
                <div className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-800">
                  {sesError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="ses-date"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    Ngày học *
                  </label>
                  <input
                    id="ses-date"
                    type="date"
                    required
                    value={sesDate}
                    onChange={(e) => setSesDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label
                    htmlFor="ses-duration"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    Thời lượng dự kiến (phút)
                  </label>
                  <input
                    id="ses-duration"
                    type="number"
                    min={5}
                    max={300}
                    value={sesDuration}
                    onChange={(e) => setSesDuration(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label
                    htmlFor="ses-title"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    Tiêu đề buổi học *
                  </label>
                  <input
                    id="ses-title"
                    type="text"
                    required
                    value={sesTitle}
                    onChange={(e) => setSesTitle(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="ses-goal"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  Mục tiêu buổi học
                </label>
                <input
                  id="ses-goal"
                  type="text"
                  value={sesGoal}
                  onChange={(e) => setSesGoal(e.target.value)}
                  placeholder="VD: Thuộc bảng nhân 8 và hoàn thành bài tập Tiếng Việt..."
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              {/* Checklist mẫu có thể chỉnh sửa */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                <span className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Checklist phân bổ thời gian (Mặc định 15p - 30p - 10p - 5p)
                </span>
                <div className="mt-3 space-y-2">
                  {sesChecklist.map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item.label}
                        onChange={(e) =>
                          handleChecklistItemChange(idx, 'label', e.target.value)
                        }
                        className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                      />
                      <input
                        type="number"
                        min={1}
                        max={180}
                        value={item.durationMinutes}
                        onChange={(e) =>
                          handleChecklistItemChange(
                            idx,
                            'durationMinutes',
                            Number(e.target.value)
                          )
                        }
                        className="w-20 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-center font-bold dark:border-slate-700 dark:bg-slate-900"
                      />
                      <span className="text-xs text-slate-500">phút</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Gắn bài học từ thư viện */}
              <div>
                <span className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Gắn bài học từ thư viện ({sesLessonIds.length} đã chọn)
                </span>
                <div className="mt-2 max-h-36 overflow-y-auto space-y-1.5 rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                  {lessons.map((l) => (
                    <label
                      key={l.id}
                      className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={sesLessonIds.includes(l.id)}
                        onChange={() => toggleLessonSelection(l.id)}
                        className="rounded border-slate-300 text-emerald-600"
                      />
                      <span>
                        [{l.subject}] {l.title}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSessionModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  Tạo buổi học
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal giao nhiệm vụ mới */}
      {isInstructorOrOwner && showTaskModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Giao nhiệm vụ mới
              </h3>
              <button
                type="button"
                onClick={() => setShowTaskModal(false)}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => void handleCreateTask(e)}
              className="mt-4 space-y-4"
            >
              {taskError && (
                <div className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-800">
                  {taskError}
                </div>
              )}

              <div>
                <label
                  htmlFor="tsk-title"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  Tiêu đề nhiệm vụ *
                </label>
                <input
                  id="tsk-title"
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="VD: Làm 5 bài toán nhân trang 42"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label
                  htmlFor="tsk-desc"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  Mô tả / Hướng dẫn làm bài
                </label>
                <textarea
                  id="tsk-desc"
                  rows={2}
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  placeholder="Viết rõ yêu cầu để học sinh dễ thực hiện..."
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="tsk-due"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    Hạn hoàn thành
                  </label>
                  <input
                    id="tsk-due"
                    type="date"
                    required
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label
                    htmlFor="tsk-stars"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    Sao thưởng (1-10)
                  </label>
                  <input
                    id="tsk-stars"
                    type="number"
                    min={1}
                    max={10}
                    value={taskStars}
                    onChange={(e) => setTaskStars(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label
                    htmlFor="tsk-session"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    Thuộc buổi học
                  </label>
                  <select
                    id="tsk-session"
                    value={taskSessionId}
                    onChange={(e) => setTaskSessionId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="">Không gắn buổi cụ thể</option>
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.date} – {s.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <span className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Giao cho học sinh
                </span>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => toggleStudentTarget('ALL')}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
                      taskAssignedUids.includes('ALL')
                        ? 'bg-emerald-600 text-white'
                        : 'border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    Tất cả học sinh trong lớp
                  </button>
                  {students.map((st) => (
                    <button
                      key={st.uid}
                      type="button"
                      onClick={() => toggleStudentTarget(st.uid)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
                        taskAssignedUids.includes(st.uid)
                          ? 'bg-emerald-600 text-white'
                          : 'border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {st.displayName}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  Giao nhiệm vụ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal luyện tập Flashcard được giao */}
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
            await loadAll();
          }}
        />
      )}

      {/* Modal làm Bài kiểm tra Trắc nghiệm được giao */}
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
            await loadAll();
          }}
        />
      )}
    </div>
  );
}

