import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Eye,
  FileEdit,
  Layers,
  Lock,
  Send,
  Sparkles,
  Trash2,
  Turtle,
  Volume2,
} from 'lucide-react';
import type { Lesson, LessonNote, SrsCardProgress } from '@/types/domain';
import { useAuth } from '@/contexts/AuthContext';
import { useClassContext } from '@/contexts/ClassContext';
import {
  deleteLesson,
  getLessonById,
  getLessonTeacherNote,
  getStudentSrsStates,
  saveAssignment,
  saveLessonWithTeacherNote,
  saveStudentSrsStates,
} from '@/services/studyNestService';
import { addDaysToDateStr, formatDateInTimezone } from '@/lib/date';
import {
  classifySrsCardBucket,
  inferDefaultTtsLang,
  makeSrsCardKey,
  speakTextWithTts,
} from '@/lib/studyAiAndSrs';
import {
  FlashcardStudyModal,
  SrsStatusBadge,
} from '@/components/study/InteractiveStudyModals';

export function LessonDetailPage() {
  const { lessonId = '' } = useParams<{ lessonId: string }>();
  const { user } = useAuth();
  const { studyClass, role, isInstructorOrOwner } = useClassContext();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [teacherNote, setTeacherNote] = useState<LessonNote | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>('');
  const [srsStates, setSrsStates] = useState<Record<string, SrsCardProgress>>(
    {}
  );
  const [showFlashcardPlayer, setShowFlashcardPlayer] =
    useState<boolean>(false);
  const [assignMessage, setAssignMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingNote, setSavingNote] = useState<boolean>(false);

  const loadDetail = useCallback(async () => {
    if (!studyClass || !role || !lessonId || !user) return;
    setLoading(true);
    try {
      const [les, srs] = await Promise.all([
        getLessonById(studyClass.id, lessonId, role),
        getStudentSrsStates(studyClass.id, user.uid),
      ]);
      setLesson(les);
      setSrsStates(srs);
      if (les && isInstructorOrOwner) {
        const note = await getLessonTeacherNote(studyClass.id, lessonId, role);
        setTeacherNote(note);
        setNoteDraft(note?.content || '');
      }
    } finally {
      setLoading(false);
    }
  }, [studyClass, role, lessonId, user, isInstructorOrOwner]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  if (!studyClass || !user || !role) return null;

  if (loading) {
    return (
      <div className="h-64 animate-pulse rounded-3xl bg-slate-200/70 dark:bg-slate-800/60" />
    );
  }

  if (!lesson) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
          Không tìm thấy bài học hoặc bài học chưa được công bố
        </h2>
        <Link
          to={`/app/classes/${studyClass.id}/lessons`}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại Thư viện bài học
        </Link>
      </div>
    );
  }

  const todayStr = formatDateInTimezone(new Date(), studyClass.timezone);
  const lessonTtsLang = inferDefaultTtsLang(lesson.subject, lesson.ttsLang);

  const handleTogglePublish = async () => {
    const nextStatus = lesson.status === 'published' ? 'draft' : 'published';
    setSavingNote(true);
    try {
      const updated = await saveLessonWithTeacherNote(studyClass.id, user.uid, {
        id: lesson.id,
        subject: lesson.subject,
        unitTitle: lesson.unitTitle,
        ttsLang: lesson.ttsLang,
        title: lesson.title,
        goal: lesson.goal,
        keywords: lesson.keywords,
        explanation: lesson.explanation,
        resourceUrl: lesson.resourceUrl,
        status: nextStatus,
        teacherNoteContent: noteDraft,
      });
      setLesson(updated);
    } finally {
      setSavingNote(false);
    }
  };

  const handleSaveTeacherNote = async () => {
    setSavingNote(true);
    try {
      await saveLessonWithTeacherNote(studyClass.id, user.uid, {
        id: lesson.id,
        subject: lesson.subject,
        unitTitle: lesson.unitTitle,
        ttsLang: lesson.ttsLang,
        title: lesson.title,
        goal: lesson.goal,
        keywords: lesson.keywords,
        explanation: lesson.explanation,
        resourceUrl: lesson.resourceUrl,
        status: lesson.status,
        teacherNoteContent: noteDraft,
      });
      await loadDetail();
    } finally {
      setSavingNote(false);
    }
  };

  const handleAssignFlashcardDeck = async () => {
    if (lesson.keywords.length === 0) return;
    setSavingNote(true);
    try {
      await saveAssignment(studyClass.id, user.uid, {
        sessionId: null,
        lessonId: lesson.id,
        title: `Học Flashcard: ${lesson.unitTitle ? `${lesson.unitTitle} - ` : ''}${lesson.title}`,
        description: `Ôn tập ${lesson.keywords.length} thẻ ghi nhớ trong bài "${lesson.title}" (${lesson.subject}).`,
        dueDate: addDaysToDateStr(todayStr, 1),
        assignedStudentUids: ['ALL'],
        starsReward: 3,
        taskType: 'flashcard',
        subject: lesson.subject,
        unitTitle: lesson.unitTitle,
        ttsLang: lessonTtsLang,
        flashcards: lesson.keywords,
      });
      setAssignMessage(
        'Đã giao bộ Flashcard này vào danh sách Nhiệm vụ của học sinh!'
      );
      setTimeout(() => setAssignMessage(null), 3500);
    } finally {
      setSavingNote(false);
    }
  };

  const handleDelete = async () => {
    await deleteLesson(studyClass.id, lesson.id);
    navigate(`/app/classes/${studyClass.id}/lessons`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={`/app/classes/${studyClass.id}/lessons`}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại Giáo trình & Bài học
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {lesson.keywords.length > 0 && (
            <button
              type="button"
              onClick={() => setShowFlashcardPlayer(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
            >
              <Layers className="h-4 w-4" />
              Lật thẻ học bài này ({lesson.keywords.length} thẻ)
            </button>
          )}

          {isInstructorOrOwner && lesson.keywords.length > 0 && (
            <button
              type="button"
              disabled={savingNote}
              onClick={() => void handleAssignFlashcardDeck()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
            >
              <Send className="h-3.5 w-3.5" />
              Giao Flashcard cho học sinh
            </button>
          )}

          {isInstructorOrOwner && (
            <>
              <button
                type="button"
                disabled={savingNote}
                onClick={() => void handleTogglePublish()}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  lesson.status === 'published'
                    ? 'border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                {lesson.status === 'published' ? (
                  <>
                    <FileEdit className="h-3.5 w-3.5" /> Chuyển về Bản nháp
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5" /> Công bố cho học sinh
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => void handleDelete()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Xóa bài
              </button>
            </>
          )}
        </div>
      </div>

      {assignMessage && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-bold text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          {assignMessage}
        </div>
      )}

      {/* Nội dung bài học chính */}
      <article className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              Giáo trình: {lesson.subject}
            </span>
            {lesson.unitTitle && (
              <span className="rounded-lg bg-violet-100 px-3 py-1 text-xs font-extrabold text-violet-800 dark:bg-violet-950 dark:text-violet-300">
                {lesson.unitTitle}
              </span>
            )}
            {lessonTtsLang && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                <Volume2 className="h-3.5 w-3.5" /> Phát âm: {lessonTtsLang}
              </span>
            )}
          </div>

          <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white leading-snug">
            {lesson.title}
          </h1>

          {lesson.goal && (
            <div className="mt-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-4 text-sm sm:text-base text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
              <strong className="font-bold">🎯 Mục tiêu bài học:</strong>{' '}
              {lesson.goal}
            </div>
          )}
        </div>

        {/* Bộ thẻ Flashcards (Từ mới / Mẫu câu / Khái niệm) */}
        {lesson.keywords.length > 0 && (
          <section aria-labelledby="lesson-keywords-heading">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2
                id="lesson-keywords-heading"
                className="flex items-center gap-2 text-base sm:text-lg font-extrabold text-slate-900 dark:text-white"
              >
                <Sparkles className="h-5 w-5 text-amber-500" />
                Bộ thẻ Flashcard cần nhớ ({lesson.keywords.length} thẻ)
              </h2>

              <button
                type="button"
                onClick={() => setShowFlashcardPlayer(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
              >
                <Layers className="h-3.5 w-3.5" />
                Mở chế độ Lật thẻ & Tự đánh giá
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {lesson.keywords.map((kw, idx) => {
                const key = makeSrsCardKey(lesson.id, kw.term);
                const srs = srsStates[key];
                const bucket = classifySrsCardBucket(srs, todayStr);
                const cardLang =
                  kw.ttsLang !== undefined ? kw.ttsLang : lessonTtsLang;

                return (
                  <div
                    key={idx}
                    className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-4 space-y-2 dark:border-slate-800 dark:bg-slate-800/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-base font-extrabold text-emerald-700 dark:text-emerald-400">
                          {kw.term}
                        </div>
                        {kw.pronunciation && (
                          <div className="text-xs font-mono text-slate-500">
                            {kw.pronunciation}
                          </div>
                        )}
                      </div>

                      <SrsStatusBadge
                        bucket={bucket}
                        nextReviewDate={srs?.nextReviewDate}
                      />
                    </div>

                    {cardLang && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            speakTextWithTts(kw.term, cardLang, false)
                          }
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300"
                        >
                          <Volume2 className="h-3.5 w-3.5" /> Nghe phát âm
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            speakTextWithTts(kw.term, cardLang, true)
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                        >
                          <Turtle className="h-3.5 w-3.5" /> Đọc chậm
                        </button>
                      </div>
                    )}

                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      {kw.meaning}
                    </p>

                    {kw.example && (
                      <p className="rounded-xl bg-white p-2.5 text-xs text-slate-600 border border-slate-200/60 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300">
                        <strong>Ví dụ / Ghi chú:</strong> {kw.example}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Nội dung giải thích chi tiết */}
        <section aria-labelledby="lesson-explanation-heading">
          <h2
            id="lesson-explanation-heading"
            className="flex items-center gap-2 text-base sm:text-lg font-extrabold text-slate-900 dark:text-white"
          >
            <BookOpen className="h-5 w-5 text-emerald-600" />
            Hướng dẫn & Ghi chú ngữ pháp / kiến thức
          </h2>
          <div className="mt-3 whitespace-pre-line rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 text-base leading-relaxed text-slate-800 dark:border-slate-800 dark:bg-slate-800/30 dark:text-slate-200">
            {lesson.explanation || 'Chưa có nội dung giải thích chi tiết.'}
          </div>
        </section>

        {lesson.resourceUrl && (
          <div className="flex items-center justify-between rounded-2xl border border-sky-200 bg-sky-50/70 p-4 dark:border-sky-900/50 dark:bg-sky-950/30">
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                Tài liệu tham khảo / Phiếu bài tập PDF
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 truncate max-w-md">
                {lesson.resourceUrl}
              </div>
            </div>
            <a
              href={lesson.resourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-700"
            >
              Mở tài liệu <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
      </article>

      {/* Khu vực Ghi chú riêng chỉ dành cho Owner / Instructor */}
      {isInstructorOrOwner && (
        <section className="rounded-3xl border border-amber-300 bg-amber-50/80 p-6 shadow-xs dark:border-amber-900/60 dark:bg-amber-950/30">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-700 dark:text-amber-400" />
              <h2 className="text-base font-extrabold text-amber-950 dark:text-amber-200">
                Ghi chú sư phạm riêng tư (Chỉ Người hướng dẫn & Chủ lớp thấy)
              </h2>
            </div>
            <span className="rounded-md bg-amber-200/80 px-2 py-0.5 text-[11px] font-bold text-amber-950">
              Bảo mật bởi Firestore Rules
            </span>
          </div>

          <textarea
            rows={3}
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Nhập ghi chú phương pháp kèm, lỗi học sinh hay gặp..."
            className="mt-3 w-full rounded-2xl border border-amber-300 bg-white p-3.5 text-sm text-slate-900 dark:border-amber-800 dark:bg-slate-900 dark:text-white"
          />

          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-amber-800 dark:text-amber-300">
              {teacherNote ? 'Đã lưu trong lessonNotes' : 'Chưa có ghi chú riêng'}
            </span>
            <button
              type="button"
              disabled={savingNote}
              onClick={() => void handleSaveTeacherNote()}
              className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {savingNote ? 'Đang lưu...' : 'Cập nhật ghi chú giáo viên'}
            </button>
          </div>
        </section>
      )}

      {/* Modal học Flashcard tương tác */}
      {showFlashcardPlayer && (
        <FlashcardStudyModal
          title={lesson.title}
          cards={lesson.keywords.map((kw) => ({
            lessonId: lesson.id,
            subject: lesson.subject,
            unitTitle: lesson.unitTitle || 'Chung',
            keyword: kw,
            ttsLang: kw.ttsLang !== undefined ? kw.ttsLang : lessonTtsLang,
          }))}
          srsStates={srsStates}
          todayStr={todayStr}
          onClose={() => setShowFlashcardPlayer(false)}
          onSaveProgress={async ({ updatedSrsPatch }) => {
            const merged = await saveStudentSrsStates({
              classId: studyClass.id,
              studentUid: user.uid,
              studentName: user.displayName,
              todayDateStr: todayStr,
              srsStates: updatedSrsPatch,
            });
            setSrsStates(merged);
          }}
        />
      )}
    </div>
  );
}
