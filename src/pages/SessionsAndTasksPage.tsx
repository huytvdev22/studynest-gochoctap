import React, { useCallback, useEffect, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Eye,
  Layers,
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
  SrsCardProgress,
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
  saveAssignment,
  saveStudentSrsStates,
  submitStudentCompletion,
} from '@/services/studyNestService';
import { validateAssignmentInput } from '@/lib/validation';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { formatDateInTimezone, formatVietnameseDate } from '@/lib/date';
import { EmptyState, UserAvatar } from '@/components/ui/ThemeBadges';
import {
  FlashcardStudyModal,
  QuizTakeModal,
} from '@/components/study/InteractiveStudyModals';
import { inferDefaultTtsLang } from '@/lib/studyAiAndSrs';
import { SubmissionDetailModal } from '@/components/study/SubmissionDetailModal';

export function SessionsAndTasksPage() {
  const { user } = useAuth();
  const { studyClass, role, isInstructorOrOwner, isStudent } = useClassContext();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [records, setRecords] = useState<LearningRecord[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<ClassMember[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal tạo nhiệm vụ (Assignment)
  const [showTaskModal, setShowTaskModal] = useState<boolean>(false);
  const [taskTitle, setTaskTitle] = useState<string>('');
  const [taskDesc, setTaskDesc] = useState<string>('');
  const [taskDueDate, setTaskDueDate] = useState<string>('');
  const [taskStars, setTaskStars] = useState<number>(3);
  const [taskLessonId, setTaskLessonId] = useState<string>('');
  const [taskAssignedUids, setTaskAssignedUids] = useState<string[]>(['ALL']);
  const [taskError, setTaskError] = useState<string | null>(null);

  // Học sinh nộp bài
  const [studentNotes, setStudentNotes] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [srsStates, setSrsStates] = useState<Record<string, SrsCardProgress>>({});
  const [activeFlashcardTask, setActiveFlashcardTask] =
    useState<Assignment | null>(null);
  const [activeQuizTask, setActiveQuizTask] = useState<Assignment | null>(null);

  // Xem chi tiết bài làm của học sinh
  const [viewingRecord, setViewingRecord] = useState<LearningRecord | null>(null);
  const [viewingTask, setViewingTask] = useState<Assignment | null>(null);
  const [viewingStudent, setViewingStudent] = useState<ClassMember | null>(null);

  const viewingLesson = viewingTask?.lessonId
    ? lessons.find((l) => l.id === viewingTask.lessonId)
    : viewingRecord
    ? lessons.find((l) =>
        viewingRecord.title.toLowerCase().includes(l.title.toLowerCase())
      )
    : null;

  const loadAll = useCallback(async () => {
    if (!studyClass || !user || !role) return;
    setLoading(true);
    try {
      const today = formatDateInTimezone(new Date(), studyClass.timezone);
      setTaskDueDate((prev) => prev || today);

      const [asg, rec, les, mems, srsMap] = await Promise.all([
        listAssignments(studyClass.id, user.uid, role),
        listLearningRecords(studyClass.id, user.uid, role, 80),
        listLessons(studyClass.id, role),
        listClassMembers(studyClass.id),
        getStudentSrsStates(studyClass.id, user.uid),
      ]);
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

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/60"
          />
        ))}
      </div>
    );
  }

  const today = formatDateInTimezone(new Date(), studyClass.timezone);

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

    const chosenLesson = lessons.find((l) => l.id === taskLessonId);
    await saveAssignment(studyClass.id, user.uid, {
      sessionId: null,
      lessonId: taskLessonId || null,
      title: taskTitle.trim(),
      description: taskDesc.trim(),
      dueDate: taskDueDate,
      assignedStudentUids: taskAssignedUids,
      starsReward: taskStars,
      taskType:
        chosenLesson && chosenLesson.keywords.length > 0
          ? 'flashcard'
          : 'standard',
      subject: chosenLesson?.subject || '',
      unitTitle: chosenLesson?.unitTitle || '',
      ttsLang: chosenLesson
        ? inferDefaultTtsLang(chosenLesson.subject, chosenLesson.ttsLang)
        : '',
      flashcards: chosenLesson?.keywords || [],
    });
    setTaskTitle('');
    setTaskDesc('');
    setTaskLessonId('');
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
    } catch (err) {
      console.error('Lỗi khi nộp bài:', err);
      alert('Không thể gửi báo cáo hoàn thành. Vui lòng kiểm tra lại kết nối mạng!');
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
    } catch (err) {
      console.error('Lỗi khi duyệt bài:', err);
      alert('Không thể xác nhận bài nộp. Vui lòng thử lại!');
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Danh sách Nhiệm vụ & Bài tập */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
              Nhiệm vụ & Bài tập ({assignments.length})
            </h2>
            <p className="text-xs text-slate-500">
              Giao bài học, bài tập về nhà hoặc đề kiểm tra. Học sinh hoàn thành và gửi báo cáo để cộng sao & chuỗi ngày học.
            </p>
          </div>

          {isInstructorOrOwner && (
            <button
              type="button"
              onClick={() => setShowTaskModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-emerald-700"
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
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            <BookOpen className="h-3 w-3 text-slate-500" />
                            {task.subject}
                            {task.unitTitle ? ` • ${task.unitTitle}` : ''}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2.5 py-0.5 text-xs font-extrabold text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                          Thưởng {task.starsReward} sao
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
                                className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 text-xs transition ${
                                  confirmed
                                    ? 'border-emerald-200/80 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-950/20'
                                    : submitted
                                    ? 'border-amber-200 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/20'
                                    : 'border-slate-200/80 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/40'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <UserAvatar
                                    name={st.displayName}
                                    avatarUrl={
                                      st.avatarUrl ||
                                      (st.uid === user.uid ? user.photoURL : '')
                                    }
                                    size="sm"
                                  />
                                  <div className="min-w-0">
                                    <div className="font-bold text-slate-900 dark:text-white truncate">
                                      {st.displayName}
                                    </div>
                                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                                      {confirmed ? (
                                        <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
                                          <CheckCircle2 className="h-3 w-3" />
                                          Đã xác nhận (+{rec?.starsAwarded} sao)
                                          {typeof rec?.quizScore === 'number' &&
                                            typeof rec?.quizTotal === 'number' && (
                                              <span className="text-violet-600 dark:text-violet-400">
                                                • Điểm: {rec.quizScore}/{rec.quizTotal}
                                              </span>
                                            )}
                                        </span>
                                      ) : submitted ? (
                                        <span className="inline-flex items-center gap-1 font-bold text-amber-700 dark:text-amber-400">
                                          <Clock className="h-3 w-3" />
                                          Đã nộp (Chờ duyệt)
                                          {typeof rec?.quizScore === 'number' &&
                                            typeof rec?.quizTotal === 'number' && (
                                              <span>
                                                • {rec.quizScore}/{rec.quizTotal} câu đúng
                                              </span>
                                            )}
                                        </span>
                                      ) : (
                                        <span className="text-slate-400 font-medium">
                                          Chưa nộp bài
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Nút thao tác theo trạng thái nộp */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {/* Cho phép xem bài làm nếu học sinh đã nộp hoặc đã được xác nhận */}
                                  {rec && (submitted || confirmed) && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setViewingRecord(rec);
                                        setViewingTask(task);
                                        setViewingStudent(st);
                                      }}
                                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition"
                                      title="Xem chi tiết bài làm, câu hỏi, điểm số hoặc bộ thẻ Flashcard"
                                    >
                                      <Eye className="h-3 w-3" />
                                      <span>Xem bài</span>
                                    </button>
                                  )}

                                  {/* CHỈ cho phép giáo viên xác nhận & tặng sao KHI HỌC SINH ĐÃ NỘP BÀI (chống tặng sao khống) */}
                                  {submitted && !confirmed && rec && (
                                    <button
                                      type="button"
                                      disabled={
                                        submittingId === `${task.id}_${st.uid}`
                                      }
                                      onClick={() =>
                                        void handleQuickConfirmTask(task, st, rec)
                                      }
                                      className="inline-flex items-center gap-1 shrink-0 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 transition shadow-2xs disabled:opacity-50"
                                      title="Xác nhận hoàn thành và tặng sao cho học sinh"
                                    >
                                      <Star className="h-3 w-3 fill-amber-300 text-amber-300" />
                                      <span>
                                        {submittingId === `${task.id}_${st.uid}`
                                          ? 'Đang lưu...'
                                          : `Xác nhận +${task.starsReward} sao`}
                                      </span>
                                    </button>
                                  )}
                                </div>
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

      {/* Modal giao nhiệm vụ mới */}
      {isInstructorOrOwner && showTaskModal && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4"
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

              {/* Gắn bài học từ Thư viện */}
              {lessons.length > 0 && (
                <div>
                  <label
                    htmlFor="tsk-lesson"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    Chọn bài học từ Thư viện (Tùy chọn)
                  </label>
                  <select
                    id="tsk-lesson"
                    value={taskLessonId}
                    onChange={(e) => {
                      const lid = e.target.value;
                      setTaskLessonId(lid);
                      const chosen = lessons.find((l) => l.id === lid);
                      if (chosen) {
                        if (!taskTitle) setTaskTitle(`Học bài: ${chosen.title}`);
                        if (!taskDesc && chosen.goal) setTaskDesc(chosen.goal);
                      }
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="">Nhiệm vụ tự do (không gắn bài học)</option>
                    {lessons.map((l) => (
                      <option key={l.id} value={l.id}>
                        [{l.subject}] {l.title}
                      </option>
                    ))}
                  </select>
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        </ModalPortal>
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
            await loadAll();
          }}
        />
      )}

      {/* Modal xem chi tiết bài làm học sinh */}
      {viewingRecord && studyClass && (
        <SubmissionDetailModal
          record={viewingRecord}
          studyClass={studyClass}
          assignment={viewingTask}
          lesson={viewingLesson}
          student={viewingStudent}
          isInstructorOrOwner={isInstructorOrOwner}
          onClose={() => {
            setViewingRecord(null);
            setViewingTask(null);
            setViewingStudent(null);
          }}
          onConfirm={async (rec, stars, comment) => {
            setSubmittingId(rec.id);
            try {
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
              await loadAll();
              setViewingRecord(null);
              setViewingTask(null);
              setViewingStudent(null);
            } finally {
              setSubmittingId(null);
            }
          }}
          isConfirming={submittingId === viewingRecord.id}
        />
      )}
    </div>
  );
}

