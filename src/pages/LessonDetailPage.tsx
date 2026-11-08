import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Bot,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  FileEdit,
  Layers,
  Lock,
  Pencil,
  Plus,
  Save,
  Send,
  Sparkles,
  Target,
  Trash2,
  Turtle,
  Volume2,
  X,
} from 'lucide-react';
import type {
  Lesson,
  LessonKeyword,
  LessonNote,
  SrsCardProgress,
  SupportedTtsLang,
} from '@/types/domain';
import { useAuth } from '@/contexts/AuthContext';
import { useClassContext } from '@/contexts/ClassContext';
import {
  deleteLesson,
  getLessonById,
  getLessonTeacherNote,
  getStudentSrsStates,
  listLessons,
  saveAssignment,
  saveLessonWithTeacherNote,
  saveStudentSrsStates,
} from '@/services/studyNestService';
import { addDaysToDateStr, formatDateInTimezone } from '@/lib/date';
import {
  TTS_LANGUAGE_OPTIONS,
  buildFlashcardAiPrompt,
  classifySrsCardBucket,
  inferDefaultTtsLang,
  makeSrsCardKey,
  parseFlashcardAiResponse,
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
  const [allLessons, setAllLessons] = useState<Lesson[]>([]);
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

  // State Chỉnh sửa bài học & Flashcard
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editSubjectMode, setEditSubjectMode] = useState<'select' | 'custom'>(
    'select'
  );
  const [editUnitMode, setEditUnitMode] = useState<'select' | 'custom'>(
    'select'
  );
  const [editSubject, setEditSubject] = useState<string>('');
  const [editUnitTitle, setEditUnitTitle] = useState<string>('');
  const [editTitle, setEditTitle] = useState<string>('');
  const [editTtsLang, setEditTtsLang] = useState<SupportedTtsLang>('en-US');
  const [editGoal, setEditGoal] = useState<string>('');
  const [editExplanation, setEditExplanation] = useState<string>('');
  const [editResourceUrl, setEditResourceUrl] = useState<string>('');
  const [editKeywords, setEditKeywords] = useState<LessonKeyword[]>([]);
  const [showAiHelperInEdit, setShowAiHelperInEdit] = useState<boolean>(false);
  const [aiRawNotes, setAiRawNotes] = useState<string>('');
  const [aiPastedJson, setAiPastedJson] = useState<string>('');
  const [copiedAiPrompt, setCopiedAiPrompt] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  const syncEditFormFromLesson = useCallback((les: Lesson) => {
    setEditSubject(les.subject);
    setEditUnitTitle(les.unitTitle || 'Unit 1: First Day');
    setEditTitle(les.title);
    setEditTtsLang(inferDefaultTtsLang(les.subject, les.ttsLang));
    setEditGoal(les.goal || '');
    setEditExplanation(les.explanation || '');
    setEditResourceUrl(les.resourceUrl || '');
    setEditKeywords(
      les.keywords.length > 0
        ? les.keywords
        : [{ term: '', pronunciation: '', meaning: '', example: '' }]
    );
    setEditSubjectMode('select');
    setEditUnitMode('select');
    setEditError(null);
  }, []);

  const loadDetail = useCallback(async () => {
    if (!studyClass || !role || !lessonId || !user) return;
    setLoading(true);
    try {
      const [les, srs, lessonList] = await Promise.all([
        getLessonById(studyClass.id, lessonId, role),
        getStudentSrsStates(studyClass.id, user.uid),
        listLessons(studyClass.id, role),
      ]);
      setLesson(les);
      setSrsStates(srs);
      setAllLessons(lessonList);
      if (les) {
        syncEditFormFromLesson(les);
      }
      if (les && isInstructorOrOwner) {
        const note = await getLessonTeacherNote(studyClass.id, lessonId, role);
        setTeacherNote(note);
        setNoteDraft(note?.content || '');
      }
    } finally {
      setLoading(false);
    }
  }, [
    studyClass,
    role,
    lessonId,
    user,
    isInstructorOrOwner,
    syncEditFormFromLesson,
  ]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const existingCurriculums = useMemo(() => {
    const set = new Set(allLessons.map((l) => l.subject.trim()).filter(Boolean));
    if (lesson?.subject) set.add(lesson.subject.trim());
    return Array.from(set).sort();
  }, [allLessons, lesson]);

  const existingUnitsForSubject = useMemo(() => {
    const set = new Set(
      allLessons
        .filter((l) => l.subject === editSubject)
        .map((l) => (l.unitTitle || '').trim())
        .filter(Boolean)
    );
    if (editUnitTitle.trim()) set.add(editUnitTitle.trim());
    return Array.from(set);
  }, [allLessons, editSubject, editUnitTitle]);

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
      if (nextStatus === 'draft') {
        syncEditFormFromLesson(updated);
        setIsEditing(true);
      }
    } finally {
      setSavingNote(false);
    }
  };

  const handleSaveEditedLesson = async (publishAfterSave = false) => {
    setEditError(null);
    if (!editSubject.trim() || !editTitle.trim()) {
      setEditError('Vui lòng nhập đầy đủ Tên giáo trình và Tên bài học.');
      return;
    }

    const cleanedKeywords: LessonKeyword[] = editKeywords
      .map((k) => ({
        term: k.term.trim(),
        pronunciation: (k.pronunciation || '').trim(),
        meaning: k.meaning.trim(),
        example: k.example.trim(),
        cardType: k.cardType || 'vocab',
        ttsLang: editTtsLang,
      }))
      .filter((k) => k.term.length > 0 && k.meaning.length > 0);

    setSavingNote(true);
    try {
      const nextStatus = publishAfterSave ? 'published' : lesson.status;
      const updated = await saveLessonWithTeacherNote(studyClass.id, user.uid, {
        id: lesson.id,
        subject: editSubject.trim(),
        unitTitle: editUnitTitle.trim() || 'Unit 1: First Day',
        ttsLang: editTtsLang,
        title: editTitle.trim(),
        goal: editGoal.trim(),
        keywords: cleanedKeywords,
        explanation: editExplanation.trim(),
        resourceUrl: editResourceUrl.trim(),
        status: nextStatus,
        teacherNoteContent: noteDraft,
      });
      setLesson(updated);
      setIsEditing(false);
      setAssignMessage(
        publishAfterSave
          ? 'Đã lưu chỉnh sửa và công bố bài học cho học sinh!'
          : 'Đã lưu cập nhật bài học & bộ thẻ Flashcard!'
      );
      setTimeout(() => setAssignMessage(null), 3500);
      await loadDetail();
    } catch (err: unknown) {
      setEditError(
        err instanceof Error ? err.message : 'Không thể lưu chỉnh sửa bài học.'
      );
    } finally {
      setSavingNote(false);
    }
  };

  const handleCopyEditAiPrompt = async () => {
    const prompt = buildFlashcardAiPrompt({
      subject: editSubject,
      unitTitle: editUnitTitle,
      lessonTitle: editTitle,
      ttsLang: editTtsLang,
      rawNotes: aiRawNotes,
    });
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedAiPrompt(true);
      setTimeout(() => setCopiedAiPrompt(false), 2500);
    } catch {
      // Ignore
    }
  };

  const handleParseEditAiJson = () => {
    setEditError(null);
    const parsed = parseFlashcardAiResponse(
      aiPastedJson,
      editSubject,
      editUnitTitle
    );
    if (parsed.error) {
      setEditError(parsed.error);
      return;
    }
    setEditSubject(parsed.subject);
    setEditUnitTitle(parsed.unitTitle);
    setEditTitle(parsed.title);
    setEditTtsLang(parsed.ttsLang);
    if (parsed.goal) setEditGoal(parsed.goal);
    if (parsed.explanation) setEditExplanation(parsed.explanation);
    setEditKeywords(parsed.keywords);
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
                onClick={() => {
                  syncEditFormFromLesson(lesson);
                  setIsEditing((prev) => !prev);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
              >
                <Pencil className="h-3.5 w-3.5" />
                {isEditing ? 'Đóng chỉnh sửa' : 'Chỉnh sửa bài học & Flashcard'}
              </button>

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
                    <FileEdit className="h-3.5 w-3.5" /> Chuyển về Bản nháp & Sửa
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

      {/* Thanh nhắc khi bài học đang ở Bản nháp hoặc chưa có thẻ Flashcard */}
      {isInstructorOrOwner && !isEditing && lesson.status === 'draft' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50/90 p-4 text-xs sm:text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="font-semibold flex items-center gap-2">
            <FileEdit className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              Bài học này đang ở trạng thái <strong>Bản nháp</strong> (Học sinh chưa nhìn thấy). Bạn có thể chỉnh sửa nội dung, bổ sung thẻ Flashcard bằng AI rồi bấm Công bố.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              syncEditFormFromLesson(lesson);
              setIsEditing(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700"
          >
            <Pencil className="h-3.5 w-3.5" />
            Mở khung chỉnh sửa ngay
          </button>
        </div>
      )}

      {/* Khung Chỉnh sửa bài học & Bộ thẻ Flashcard trực tiếp */}
      {isInstructorOrOwner && isEditing && (
        <section className="rounded-3xl border-2 border-emerald-400 bg-white p-6 shadow-md space-y-5 dark:border-emerald-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4 dark:border-slate-800">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900 dark:text-white">
                <Pencil className="h-5 w-5 text-emerald-600" />
                Chỉnh sửa Bài học & Bộ thẻ Flashcard
              </h2>
              <p className="text-xs text-slate-500">
                Chọn Giáo trình / Unit từ danh sách có sẵn, cập nhật thẻ Flashcard thủ công hoặc dùng AI.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAiHelperInEdit((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-violet-100 px-3.5 py-1.5 text-xs font-bold text-violet-800 hover:bg-violet-200 dark:bg-violet-950 dark:text-violet-300"
              >
                <Bot className="h-3.5 w-3.5" />
                {showAiHelperInEdit
                  ? 'Ẩn trợ lý AI'
                  : 'Dùng AI tạo / cập nhật Flashcard'}
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {editError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800">
              {editError}
            </div>
          )}

          {/* 4 trường: Giáo trình (Droplist), Unit (Droplist), Tên bài học, Loa đọc phát âm */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Giáo trình / Môn học *
              </label>
              {editSubjectMode === 'select' && existingCurriculums.length > 0 ? (
                <div className="mt-1 flex gap-2">
                  <select
                    value={editSubject}
                    onChange={(e) => {
                      if (e.target.value === '__NEW__') {
                        setEditSubjectMode('custom');
                        setEditSubject('');
                      } else {
                        setEditSubject(e.target.value);
                        setEditTtsLang(inferDefaultTtsLang(e.target.value));
                      }
                    }}
                    className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold dark:border-slate-700 dark:bg-slate-800"
                  >
                    {existingCurriculums.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value="__NEW__">+ Tạo giáo trình mới...</option>
                  </select>
                </div>
              ) : (
                <div className="mt-1 flex gap-2">
                  <input
                    type="text"
                    value={editSubject}
                    onChange={(e) => {
                      setEditSubject(e.target.value);
                      setEditTtsLang(inferDefaultTtsLang(e.target.value));
                    }}
                    placeholder="Nhập tên giáo trình mới (VD: Everybody Up)..."
                    className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                  {existingCurriculums.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditSubjectMode('select');
                        setEditSubject(existingCurriculums[0]);
                      }}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                    >
                      Chọn có sẵn
                    </button>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Unit / Chương
              </label>
              {editUnitMode === 'select' && existingUnitsForSubject.length > 0 ? (
                <div className="mt-1 flex gap-2">
                  <select
                    value={editUnitTitle}
                    onChange={(e) => {
                      if (e.target.value === '__NEW_UNIT__') {
                        setEditUnitMode('custom');
                        setEditUnitTitle('');
                      } else {
                        setEditUnitTitle(e.target.value);
                      }
                    }}
                    className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold dark:border-slate-700 dark:bg-slate-800"
                  >
                    {existingUnitsForSubject.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                    <option value="__NEW_UNIT__">+ Thêm Unit / Chương mới...</option>
                  </select>
                </div>
              ) : (
                <div className="mt-1 flex gap-2">
                  <input
                    type="text"
                    value={editUnitTitle}
                    onChange={(e) => setEditUnitTitle(e.target.value)}
                    placeholder="VD: Unit 1: First Day, Unit 2: Art Class..."
                    className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                  {existingUnitsForSubject.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditUnitMode('select');
                        setEditUnitTitle(existingUnitsForSubject[0]);
                      }}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                    >
                      Chọn có sẵn
                    </button>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Tên bài học (Lesson) *
              </label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="VD: Lesson 1: School Supplies"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Chế độ Loa đọc phát âm
              </label>
              <select
                value={editTtsLang}
                onChange={(e) =>
                  setEditTtsLang(e.target.value as SupportedTtsLang)
                }
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                {TTS_LANGUAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Khối AI hỗ trợ tạo / cập nhật nhanh trong lúc sửa bài */}
          {showAiHelperInEdit && (
            <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 space-y-3 dark:border-violet-900/50 dark:bg-violet-950/20">
              <div>
                <label className="block text-xs font-extrabold text-violet-950 dark:text-violet-200">
                  Bước 1: Nhập ghi chú từ mới / mẫu câu (hoặc để trống nếu gửi kèm ảnh trang sách cho AI)
                </label>
                <textarea
                  rows={2}
                  value={aiRawNotes}
                  onChange={(e) => setAiRawNotes(e.target.value)}
                  placeholder="VD: pen, pencil, eraser, ruler, pencil case, backpack. Mẫu câu: What is it? It's a pen."
                  className="mt-1.5 w-full rounded-xl border border-violet-300 bg-white px-3 py-2 text-xs sm:text-sm dark:border-violet-800 dark:bg-slate-900"
                />
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => void handleCopyEditAiPrompt()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-violet-700"
                  >
                    {copiedAiPrompt ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> Đã Copy Prompt!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> Copy Prompt tạo Flashcard
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="border-t border-violet-200/80 pt-3 dark:border-violet-800/60">
                <label className="block text-xs font-extrabold text-violet-950 dark:text-violet-200">
                  Bước 2: Dán JSON từ AI vào đây để điền bộ thẻ Flashcard & Kiến thức
                </label>
                <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                  <textarea
                    rows={2}
                    value={aiPastedJson}
                    onChange={(e) => setAiPastedJson(e.target.value)}
                    placeholder='Dán codeblock ```json { "keywords": [...] } ``` vào đây...'
                    className="flex-1 rounded-xl border border-violet-300 bg-white px-3 py-2 font-mono text-xs dark:border-violet-800 dark:bg-slate-900"
                  />
                  <button
                    type="button"
                    onClick={handleParseEditAiJson}
                    className="shrink-0 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
                  >
                    Đọc JSON & Điền vào bài
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Danh sách thẻ Flashcard */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Bộ thẻ Flashcard trong bài ({editKeywords.length} thẻ)
              </span>
              <button
                type="button"
                onClick={() =>
                  setEditKeywords((prev) => [
                    ...prev,
                    {
                      term: '',
                      pronunciation: '',
                      meaning: '',
                      example: '',
                      ttsLang: editTtsLang,
                    },
                  ])
                }
                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline dark:text-emerald-400"
              >
                <Plus className="h-3.5 w-3.5" /> Thêm thẻ mới
              </button>
            </div>

            <div className="mt-3 space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {editKeywords.map((kw, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-12 items-start rounded-xl border border-slate-200/80 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900"
                >
                  <input
                    type="text"
                    placeholder="Mặt trước (Từ mới / Mẫu câu)"
                    value={kw.term}
                    onChange={(e) =>
                      setEditKeywords((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, term: e.target.value } : item
                        )
                      )
                    }
                    className="sm:col-span-3 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                  <input
                    type="text"
                    placeholder="Phiên âm (IPA/Pinyin)"
                    value={kw.pronunciation || ''}
                    onChange={(e) =>
                      setEditKeywords((prev) =>
                        prev.map((item, i) =>
                          i === index
                            ? { ...item, pronunciation: e.target.value }
                            : item
                        )
                      )
                    }
                    className="sm:col-span-2 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                  />
                  <input
                    type="text"
                    placeholder="Mặt sau (Nghĩa TV / Đáp án)"
                    value={kw.meaning}
                    onChange={(e) =>
                      setEditKeywords((prev) =>
                        prev.map((item, i) =>
                          i === index
                            ? { ...item, meaning: e.target.value }
                            : item
                        )
                      )
                    }
                    className="sm:col-span-3 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                  <input
                    type="text"
                    placeholder="Câu ví dụ / Ghi chú"
                    value={kw.example}
                    onChange={(e) =>
                      setEditKeywords((prev) =>
                        prev.map((item, i) =>
                          i === index
                            ? { ...item, example: e.target.value }
                            : item
                        )
                      )
                    }
                    className="sm:col-span-3 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                  <div className="sm:col-span-1 flex items-center justify-end gap-1">
                    {editTtsLang && kw.term && (
                      <button
                        type="button"
                        onClick={() =>
                          speakTextWithTts(kw.term, editTtsLang, false)
                        }
                        title="Nghe thử"
                        className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50"
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setEditKeywords((prev) =>
                          prev.filter((_, i) => i !== index)
                        )
                      }
                      aria-label="Xóa thẻ"
                      className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mục tiêu & Nội dung giải thích ngữ pháp */}
          <div className="space-y-3">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                <Target className="h-3.5 w-3.5 text-emerald-600" />
                Mục tiêu bài học
              </label>
              <input
                type="text"
                value={editGoal}
                onChange={(e) => setEditGoal(e.target.value)}
                placeholder="VD: Thuộc 6 đồ dùng học tập và mẫu câu hỏi đáp What is it?"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                <BookOpen className="h-3.5 w-3.5 text-emerald-600" />
                Hướng dẫn & Ghi chú ngữ pháp / kiến thức chi tiết
              </label>
              <textarea
                rows={4}
                value={editExplanation}
                onChange={(e) => setEditExplanation(e.target.value)}
                placeholder="Nhập tóm tắt ngữ pháp, mẫu câu quan trọng hoặc hướng dẫn làm bài cho học sinh..."
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={savingNote}
              onClick={() => void handleSaveEditedLesson(false)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
            >
              <Save className="h-3.5 w-3.5" />
              Lưu thay đổi
            </button>
            {lesson.status === 'draft' && (
              <button
                type="button"
                disabled={savingNote}
                onClick={() => void handleSaveEditedLesson(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700"
              >
                <Eye className="h-3.5 w-3.5" />
                Lưu & Công bố cho học sinh
              </button>
            )}
          </div>
        </section>
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
              <strong className="inline-flex items-center gap-1.5 font-bold">
                <Target className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                Mục tiêu bài học:
              </strong>{' '}
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
