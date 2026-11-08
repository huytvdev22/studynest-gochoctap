import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Bot,
  Check,
  ClipboardCheck,
  Copy,
  ExternalLink,
  Eye,
  FileEdit,
  Layers,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import type {
  Assignment,
  ClassMember,
  Lesson,
  LessonKeyword,
  LessonStatus,
  QuizQuestion,
  SrsCardProgress,
  SupportedTtsLang,
} from '@/types/domain';
import { useAuth } from '@/contexts/AuthContext';
import { useClassContext } from '@/contexts/ClassContext';
import {
  getStudentSrsStates,
  listAssignments,
  listClassMembers,
  listLessons,
  saveAssignment,
  saveLessonWithTeacherNote,
  saveStudentSrsStates,
  submitStudentCompletion,
} from '@/services/studyNestService';
import { validateLessonInput } from '@/lib/validation';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { addDaysToDateStr, formatDateInTimezone } from '@/lib/date';
import {
  buildCurriculumSrsOverview,
  buildFlashcardAiPrompt,
  buildQuizAiPrompt,
  inferDefaultTtsLang,
  parseFlashcardAiResponse,
  parseQuizAiResponse,
  speakTextWithTts,
  TTS_LANGUAGE_OPTIONS,
} from '@/lib/studyAiAndSrs';
import {
  FlashcardStudyModal,
  SrsStatusBadge,
  type StudyDeckCard,
} from '@/components/study/InteractiveStudyModals';
import { EmptyState } from '@/components/ui/ThemeBadges';

export function LessonsPage() {
  const { user } = useAuth();
  const { studyClass, role, isInstructorOrOwner, isStudent } =
    useClassContext();
  const navigate = useNavigate();

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<ClassMember[]>([]);
  const [selectedSrsStudentUid, setSelectedSrsStudentUid] =
    useState<string>('');
  const [srsStates, setSrsStates] = useState<Record<string, SrsCardProgress>>(
    {}
  );
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [addingLessonId, setAddingLessonId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Bộ lọc Giáo trình (subject) & Unit
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');
  const [unitFilter, setUnitFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | LessonStatus>('ALL');

  // Modal luyện tập Flashcard tương tác
  const [activeStudyDeck, setActiveStudyDeck] = useState<{
    title: string;
    cards: StudyDeckCard[];
  } | null>(null);

  // Modal Tạo bài học thủ công / thông qua AI Flashcard
  const [showLessonModal, setShowLessonModal] = useState<boolean>(false);
  const [lessonCreationMode, setLessonCreationMode] = useState<'ai' | 'manual'>(
    'ai'
  );
  const [subjectInputMode, setSubjectInputMode] = useState<'select' | 'custom'>(
    'select'
  );
  const [unitInputMode, setUnitInputMode] = useState<'select' | 'custom'>(
    'select'
  );
  const [subject, setSubject] = useState<string>('Everybody Up');
  const [unitTitle, setUnitTitle] = useState<string>('Unit 1: First Day');
  const [title, setTitle] = useState<string>('Lesson 1: School Supplies');
  const [ttsLang, setTtsLang] = useState<SupportedTtsLang>('en-US');
  const [goal, setGoal] = useState<string>('');
  const [explanation, setExplanation] = useState<string>('');
  const [resourceUrl] = useState<string>('');
  const [status] = useState<LessonStatus>('published');
  const [teacherNoteContent] = useState<string>('');
  const [keywords, setKeywords] = useState<LessonKeyword[]>([
    { term: '', pronunciation: '', meaning: '', example: '' },
  ]);
  const [assignFlashcardImmediately, setAssignFlashcardImmediately] =
    useState<boolean>(true);
  const [assignStars, setAssignStars] = useState<number>(3);

  // Trạng thái AI Flashcard trong Modal
  const [aiRawNotes, setAiRawNotes] = useState<string>('');
  const [aiPastedJson, setAiPastedJson] = useState<string>('');
  const [copiedFlashcardPrompt, setCopiedFlashcardPrompt] =
    useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // Modal Tạo Đề Trắc Nghiệm bằng AI (Theo Unit hoặc Theo Đường cong quên lãng)
  const [showQuizAiModal, setShowQuizAiModal] = useState<boolean>(false);
  const [quizSubject, setQuizSubject] = useState<string>('ALL');
  const [quizSourceMode, setQuizSourceMode] = useState<'unit' | 'srs_due'>(
    'unit'
  );
  const [quizUnitTitle, setQuizUnitTitle] = useState<string>('ALL');
  const [quizQuestionCount, setQuizQuestionCount] = useState<number>(10);
  const [quizExtraNotes] = useState<string>('');
  const [copiedQuizPrompt, setCopiedQuizPrompt] = useState<boolean>(false);
  const [quizPastedJson, setQuizPastedJson] = useState<string>('');
  const [quizTitle, setQuizTitle] = useState<string>('');
  const [quizDescription, setQuizDescription] = useState<string>('');
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizStarsReward, setQuizStarsReward] = useState<number>(5);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [savingQuiz, setSavingQuiz] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    if (!studyClass || !user || !role) return;
    setLoading(true);
    try {
      const [les, mems, asgs] = await Promise.all([
        listLessons(studyClass.id, role),
        listClassMembers(studyClass.id),
        listAssignments(studyClass.id, user.uid, role),
      ]);
      setLessons(les);
      setAssignments(asgs);
      const studentList = mems.filter((m) => m.role === 'student');
      setStudents(studentList);

      const targetUid = isStudent
        ? user.uid
        : selectedSrsStudentUid || studentList[0]?.uid || user.uid;
      if (!selectedSrsStudentUid && targetUid) {
        setSelectedSrsStudentUid(targetUid);
      }

      const srs = await getStudentSrsStates(studyClass.id, targetUid);
      setSrsStates(srs);
    } finally {
      setLoading(false);
    }
  }, [studyClass, user, role, isStudent, selectedSrsStudentUid]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Danh sách các Giáo trình độc lập (subjects) và các Unit trong giáo trình đang chọn
  const curriculums = useMemo(
    () => Array.from(new Set(lessons.map((l) => l.subject))).sort(),
    [lessons]
  );

  const unitsInSelectedCurriculum = useMemo(() => {
    const base =
      subjectFilter === 'ALL'
        ? lessons
        : lessons.filter((l) => l.subject === subjectFilter);
    return Array.from(
      new Set(base.map((l) => l.unitTitle?.trim() || 'Chưa phân Unit'))
    );
  }, [lessons, subjectFilter]);

  // Danh sách Unit đã tồn tại của Giáo trình đang chọn trong Modal tạo bài mới
  const unitsInModalSubject = useMemo(() => {
    const list = lessons
      .filter((l) => l.subject === subject)
      .map((l) => (l.unitTitle || '').trim())
      .filter(Boolean);
    return Array.from(new Set(list));
  }, [lessons, subject]);

  const openCreateLessonModal = (defaultSubject?: string, defaultUnit?: string) => {
    setLessonCreationMode('ai');
    setFormError(null);
    const chosenSubject =
      defaultSubject && defaultSubject !== 'ALL'
        ? defaultSubject
        : subjectFilter !== 'ALL'
        ? subjectFilter
        : curriculums[0] || 'Everybody Up';
    handleSubjectInputChange(chosenSubject);
    setSubjectInputMode(curriculums.length > 0 ? 'select' : 'custom');

    const existingUnits = Array.from(
      new Set(
        lessons
          .filter((l) => l.subject === chosenSubject)
          .map((l) => (l.unitTitle || '').trim())
          .filter(Boolean)
      )
    );
    const chosenUnit =
      defaultUnit && defaultUnit !== 'ALL'
        ? defaultUnit
        : unitFilter !== 'ALL'
        ? unitFilter
        : existingUnits[0] || 'Unit 1: First Day';
    setUnitTitle(chosenUnit);
    setUnitInputMode(existingUnits.length > 0 ? 'select' : 'custom');
    setShowLessonModal(true);
  };

  const todayStr = studyClass
    ? formatDateInTimezone(new Date(), studyClass.timezone)
    : '2026-11-08';

  const handleAddLessonToToday = async (targetLesson: Lesson) => {
    if (!studyClass || !user) return;
    setAddingLessonId(targetLesson.id);
    try {
      const lang = inferDefaultTtsLang(targetLesson.subject, targetLesson.ttsLang);
      const newAsg = await saveAssignment(studyClass.id, user.uid, {
        sessionId: null,
        lessonId: targetLesson.id,
        title: `Học bài: ${targetLesson.title}`,
        description:
          targetLesson.goal ||
          `Học và luyện tập từ vựng bài "${targetLesson.title}" (${targetLesson.subject}).`,
        dueDate: todayStr,
        assignedStudentUids: ['ALL'],
        starsReward: 2,
        taskType: targetLesson.keywords.length > 0 ? 'flashcard' : 'standard',
        subject: targetLesson.subject,
        unitTitle: targetLesson.unitTitle || '',
        ttsLang: lang,
        flashcards: targetLesson.keywords,
      });
      setAssignments((prev) => [
        ...prev.filter((a) => a.id !== newAsg.id),
        newAsg,
      ]);
    } finally {
      setAddingLessonId(null);
    }
  };

  // Các thẻ nguồn dùng để tạo Đề kiểm tra trắc nghiệm AI
  const quizSourceCards = useMemo(() => {
    const overview = buildCurriculumSrsOverview({
      lessons,
      srsStates,
      todayStr,
      subjectFilter: quizSubject,
      unitFilter: quizSourceMode === 'unit' ? quizUnitTitle : 'ALL',
    });
    if (quizSourceMode === 'srs_due') {
      return overview.reviewDueCards;
    }
    return overview.allCards;
  }, [
    lessons,
    srsStates,
    todayStr,
    quizSubject,
    quizSourceMode,
    quizUnitTitle,
  ]);

  if (!studyClass || !user || !role) return null;

  const filteredLessons = lessons.filter((l) => {
    if (subjectFilter !== 'ALL' && l.subject !== subjectFilter) return false;
    const u = l.unitTitle?.trim() || 'Chưa phân Unit';
    if (unitFilter !== 'ALL' && u !== unitFilter) return false;
    if (statusFilter !== 'ALL' && l.status !== statusFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchTitle = l.title.toLowerCase().includes(q);
      const matchUnit = (l.unitTitle || '').toLowerCase().includes(q);
      const matchSubject = l.subject.toLowerCase().includes(q);
      const matchKw = l.keywords.some(
        (k) =>
          k.term.toLowerCase().includes(q) ||
          k.meaning.toLowerCase().includes(q)
      );
      if (!matchTitle && !matchUnit && !matchSubject && !matchKw) return false;
    }
    return true;
  });

  // Gom nhóm các bài học theo Giáo trình + Unit
  const groupedByUnit = filteredLessons.reduce<Record<string, Lesson[]>>(
    (acc, les) => {
      const groupKey = `${les.subject} — ${les.unitTitle?.trim() || 'Bài học chung'}`;
      if (!acc[groupKey]) acc[groupKey] = [];
      acc[groupKey].push(les);
      return acc;
    },
    {}
  );

  // Toàn bộ Flashcard trong các bài học đang hiển thị theo bộ lọc
  const allCardsInView: StudyDeckCard[] = filteredLessons.flatMap((les) => {
    const lang = inferDefaultTtsLang(les.subject, les.ttsLang);
    return les.keywords.map((kw) => ({
      lessonId: les.id,
      subject: les.subject,
      unitTitle: les.unitTitle || 'Chung',
      keyword: kw,
      ttsLang: kw.ttsLang !== undefined ? kw.ttsLang : lang,
    }));
  });

  const handleSubjectInputChange = (val: string) => {
    setSubject(val);
    setTtsLang(inferDefaultTtsLang(val));
  };

  const handleCopyFlashcardPrompt = async () => {
    const prompt = buildFlashcardAiPrompt({
      subject,
      unitTitle,
      lessonTitle: title,
      ttsLang,
      rawNotes: aiRawNotes,
    });
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedFlashcardPrompt(true);
      setTimeout(() => setCopiedFlashcardPrompt(false), 2500);
    } catch {
      // Ignore
    }
  };

  const handleParseAiFlashcardJson = () => {
    setFormError(null);
    const parsed = parseFlashcardAiResponse(aiPastedJson, subject, unitTitle);
    if (parsed.error) {
      setFormError(parsed.error);
      return;
    }
    setSubject(parsed.subject);
    setUnitTitle(parsed.unitTitle);
    setTitle(parsed.title);
    setTtsLang(parsed.ttsLang);
    setGoal(parsed.goal);
    setExplanation(parsed.explanation);
    setKeywords(parsed.keywords);
  };

  const handleAddKeywordRow = () => {
    setKeywords((prev) => [
      ...prev,
      { term: '', pronunciation: '', meaning: '', example: '', ttsLang },
    ]);
  };

  const handleRemoveKeywordRow = (index: number) => {
    setKeywords((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleKeywordChange = (
    index: number,
    field: keyof LessonKeyword,
    value: string
  ) => {
    setKeywords((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, [field]: value } : item
      )
    );
  };

  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const validation = validateLessonInput({
      title,
      subject,
      goal,
      explanation,
      resourceUrl,
    });
    if (!validation.valid) {
      setFormError(validation.error || 'Dữ liệu bài học không hợp lệ.');
      return;
    }

    const cleanedKeywords: LessonKeyword[] = keywords
      .map((k) => ({
        term: k.term.trim(),
        pronunciation: (k.pronunciation || '').trim(),
        meaning: k.meaning.trim(),
        example: k.example.trim(),
        cardType: k.cardType || 'vocab',
        ttsLang,
      }))
      .filter((k) => k.term.length > 0 && k.meaning.length > 0);

    setSaving(true);
    try {
      const created = await saveLessonWithTeacherNote(studyClass.id, user.uid, {
        subject,
        unitTitle,
        ttsLang,
        title,
        goal,
        keywords: cleanedKeywords,
        explanation,
        resourceUrl,
        status,
        teacherNoteContent,
      });

      // Nếu bật "Giao luôn bộ Flashcard làm nhiệm vụ cho học sinh"
      if (assignFlashcardImmediately && cleanedKeywords.length > 0) {
        await saveAssignment(studyClass.id, user.uid, {
          sessionId: null,
          lessonId: created.id,
          title: `Học Flashcard: ${unitTitle ? `${unitTitle} - ` : ''}${title}`,
          description: `Lật ôn ${cleanedKeywords.length} thẻ ghi nhớ trong giáo trình ${subject} và tự đánh giá mức độ thuộc bài.`,
          dueDate: addDaysToDateStr(todayStr, 1),
          assignedStudentUids: ['ALL'],
          starsReward: assignStars,
          taskType: 'flashcard',
          subject,
          unitTitle,
          ttsLang,
          flashcards: cleanedKeywords,
        });
      }

      setShowLessonModal(false);
      await loadData();
      navigate(`/app/classes/${studyClass.id}/lessons/${created.id}`);
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : 'Không thể lưu bài học.'
      );
    } finally {
      setSaving(false);
    }
  };

  // Xử lý tạo Đề Trắc Nghiệm AI
  const openQuizGeneratorModal = (defaultSub = subjectFilter, defaultUnit = unitFilter) => {
    const resolvedSub =
      defaultSub !== 'ALL' ? defaultSub : curriculums[0] || 'Everybody Up';
    setQuizSubject(resolvedSub);
    setQuizUnitTitle(defaultUnit);
    setQuizSourceMode('unit');
    setQuizPastedJson('');
    setQuizQuestions([]);
    setQuizError(null);
    setShowQuizAiModal(true);
  };

  const handleCopyQuizPrompt = async () => {
    const scopeLabel =
      quizSourceMode === 'srs_due'
        ? 'Ôn tập các từ Hay quên & Sắp quên (Đường cong quên lãng)'
        : quizUnitTitle === 'ALL'
        ? `Tổng hợp giáo trình ${quizSubject}`
        : quizUnitTitle;

    const prompt = buildQuizAiPrompt({
      subject: quizSubject === 'ALL' ? 'Tổng hợp' : quizSubject,
      unitTitle: scopeLabel,
      questionCount: quizQuestionCount,
      cards: quizSourceCards.map((c) => ({
        term: c.keyword.term,
        meaning: c.keyword.meaning,
        example: c.keyword.example,
        pronunciation: c.keyword.pronunciation,
        bucket: c.bucket,
      })),
      extraNotes: quizExtraNotes,
    });

    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedQuizPrompt(true);
      setTimeout(() => setCopiedQuizPrompt(false), 2500);
    } catch {
      // Ignore
    }
  };

  const handleParseQuizJson = () => {
    setQuizError(null);
    const scopeLabel =
      quizUnitTitle !== 'ALL' ? quizUnitTitle : quizSubject;
    const parsed = parseQuizAiResponse(
      quizPastedJson,
      `Kiểm tra trắc nghiệm: ${scopeLabel}`
    );
    if (parsed.error) {
      setQuizError(parsed.error);
      return;
    }
    setQuizTitle(parsed.title);
    setQuizDescription(parsed.description);
    setQuizQuestions(parsed.questions);
  };

  const handleSaveAndAssignQuiz = async () => {
    if (quizQuestions.length === 0) {
      setQuizError('Vui lòng phân tích JSON hoặc thêm ít nhất 1 câu hỏi.');
      return;
    }
    setSavingQuiz(true);
    setQuizError(null);
    try {
      const targetSubject =
        quizSubject === 'ALL' ? curriculums[0] || 'Tổng hợp' : quizSubject;
      await saveAssignment(studyClass.id, user.uid, {
        sessionId: null,
        lessonId: null,
        title: quizTitle.trim() || `Bài kiểm tra trắc nghiệm (${quizQuestions.length} câu)`,
        description:
          quizDescription.trim() ||
          `Hoàn thành ${quizQuestions.length} câu hỏi trắc nghiệm giáo trình ${targetSubject}.`,
        dueDate: addDaysToDateStr(todayStr, 2),
        assignedStudentUids: ['ALL'],
        starsReward: quizStarsReward,
        taskType: 'quiz',
        subject: targetSubject,
        unitTitle: quizUnitTitle === 'ALL' ? 'Tổng hợp' : quizUnitTitle,
        ttsLang: inferDefaultTtsLang(targetSubject),
        quizQuestions,
      });
      setShowQuizAiModal(false);
      navigate(`/app/classes/${studyClass.id}/sessions`);
    } catch (err: unknown) {
      setQuizError(
        err instanceof Error ? err.message : 'Không thể lưu đề kiểm tra.'
      );
    } finally {
      setSavingQuiz(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Thư viện & Bộ lọc trực quan, tinh gọn */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <BookOpen className="h-4 w-4" />
              </span>
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                Thư viện Giáo trình & Bài học
              </h1>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {curriculums.length} giáo trình • {filteredLessons.length} bài
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Tra cứu bài học theo từng giáo trình, ôn luyện từ vựng qua bộ thẻ Flashcard.
            </p>
          </div>

          {isInstructorOrOwner && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => openCreateLessonModal()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" />
                Thêm Bài học & Flashcard (AI)
              </button>

              <button
                type="button"
                onClick={() => openQuizGeneratorModal()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-violet-700"
              >
                <ClipboardCheck className="h-4 w-4" />
                Tạo Đề Trắc Nghiệm (AI)
              </button>
            </div>
          )}
        </div>

        {/* Thanh công cụ lọc & tìm kiếm gọn gàng 1 hàng */}
        <div className="flex flex-wrap items-center gap-2.5 border-t border-slate-100 pt-3.5 dark:border-slate-800">
          {/* Ô tìm kiếm */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="search"
              aria-label="Tìm bài học hoặc từ vựng"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm bài học, từ vựng..."
              className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-9 pr-3.5 py-2 text-xs text-slate-900 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Droplist chọn Giáo trình */}
          <select
            aria-label="Chọn Giáo trình"
            value={subjectFilter}
            onChange={(e) => {
              setSubjectFilter(e.target.value);
              setUnitFilter('ALL');
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="ALL">
              Tất cả giáo trình ({lessons.length} bài)
            </option>
            {curriculums.map((cur) => {
              const count = lessons.filter((l) => l.subject === cur).length;
              return (
                <option key={cur} value={cur}>
                  {cur} ({count} bài)
                </option>
              );
            })}
          </select>

          {/* Droplist chọn Unit */}
          <select
            aria-label="Lọc theo Unit / Chương"
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="ALL">Tất cả Unit / Chương</option>
            {unitsInSelectedCurriculum.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>

          {/* Droplist Trạng thái (cho Instructor) */}
          {isInstructorOrOwner && (
            <select
              aria-label="Lọc theo trạng thái bài học"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'ALL' | LessonStatus)
              }
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="ALL">Mọi trạng thái</option>
              <option value="published">Đã công bố</option>
              <option value="draft">Bản nháp</option>
            </select>
          )}

          {/* Nút lật toàn bộ Flashcard trong giáo trình/kết quả lọc */}
          {allCardsInView.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setActiveStudyDeck({
                  title: `Bộ Flashcard: ${
                    subjectFilter === 'ALL'
                      ? 'Tất cả giáo trình'
                      : subjectFilter
                  }${unitFilter !== 'ALL' ? ` • ${unitFilter}` : ''}`,
                  cards: allCardsInView,
                })
              }
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50/80 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 shrink-0"
            >
              <Layers className="h-3.5 w-3.5" />
              Lật toàn bộ ({allCardsInView.length} thẻ)
            </button>
          )}

          {/* Nút xóa nhanh bộ lọc nếu đang lọc */}
          {(searchTerm ||
            subjectFilter !== 'ALL' ||
            unitFilter !== 'ALL' ||
            statusFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSubjectFilter('ALL');
                setUnitFilter('ALL');
                setStatusFilter('ALL');
              }}
              title="Đặt lại bộ lọc"
              className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 shrink-0"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* 3. Danh sách bài học gom nhóm theo Giáo trình & Unit */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/60"
            />
          ))}
        </div>
      ) : filteredLessons.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-6 w-6" />}
          title="Chưa có bài học nào trong giáo trình này"
          description={
            isInstructorOrOwner
              ? 'Bấm nút "Tạo Bài học & Flashcard (AI)" để nhập ghi chú buổi học hoặc ảnh chụp trang sách và tạo bộ Flashcard tự động.'
              : 'Người hướng dẫn chưa công bố bài học nào trong mục này.'
          }
        />
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedByUnit).map(([groupHeader, unitLessons]) => {
            const firstLes = unitLessons[0];
            const unitCards: StudyDeckCard[] = unitLessons.flatMap((les) => {
              const lang = inferDefaultTtsLang(les.subject, les.ttsLang);
              return les.keywords.map((kw) => ({
                lessonId: les.id,
                subject: les.subject,
                unitTitle: les.unitTitle || 'Chung',
                keyword: kw,
                ttsLang: kw.ttsLang !== undefined ? kw.ttsLang : lang,
              }));
            });

            return (
              <section key={groupHeader} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-slate-100/80 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-emerald-600 px-2.5 py-0.5 text-xs font-extrabold text-white">
                      {firstLes.subject}
                    </span>
                    <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                      {firstLes.unitTitle?.trim() || 'Các bài học chung'} (
                      {unitLessons.length} bài • {unitCards.length} thẻ)
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {isInstructorOrOwner && (
                      <button
                        type="button"
                        onClick={() =>
                          openCreateLessonModal(
                            firstLes.subject,
                            firstLes.unitTitle?.trim() || 'Unit 1: First Day'
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Thêm bài vào Unit này
                      </button>
                    )}

                    {unitCards.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setActiveStudyDeck({
                            title: `Ôn Flashcard: ${groupHeader}`,
                            cards: unitCards,
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 shadow-2xs hover:bg-emerald-50 dark:bg-slate-900 dark:text-emerald-300"
                      >
                        <Layers className="h-3.5 w-3.5" />
                        Ôn cả Unit ({unitCards.length} thẻ)
                      </button>
                    )}

                    {isInstructorOrOwner && unitCards.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          openQuizGeneratorModal(
                            firstLes.subject,
                            firstLes.unitTitle?.trim() || 'ALL'
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700"
                      >
                        <ClipboardCheck className="h-3.5 w-3.5" />
                        Tạo đề kiểm tra Unit này
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {unitLessons.map((lesson) => {
                    const lessonLang = inferDefaultTtsLang(
                      lesson.subject,
                      lesson.ttsLang
                    );
                    const isAddedToToday = assignments.some(
                      (a) => a.lessonId === lesson.id && a.dueDate === todayStr
                    );
                    return (
                      <div
                        key={lesson.id}
                        className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-emerald-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded-lg bg-emerald-100 px-2.5 py-0.5 text-xs font-extrabold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                {lesson.subject}
                              </span>
                              {lesson.unitTitle && (
                                <span className="rounded-lg bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                  {lesson.unitTitle}
                                </span>
                              )}
                              {lessonLang && (
                                <span className="inline-flex items-center gap-1 rounded-lg bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                                  <Volume2 className="h-3 w-3" /> {lessonLang}
                                </span>
                              )}
                            </div>

                            {isInstructorOrOwner && (
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                  lesson.status === 'published'
                                    ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                }`}
                              >
                                {lesson.status === 'published' ? (
                                  <>
                                    <Eye className="h-3 w-3" /> Đã công bố
                                  </>
                                ) : (
                                  <>
                                    <FileEdit className="h-3 w-3" /> Bản nháp
                                  </>
                                )}
                              </span>
                            )}
                          </div>

                          <Link
                            to={`/app/classes/${studyClass.id}/lessons/${lesson.id}`}
                            className="mt-3 block text-lg font-extrabold text-slate-900 group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-400"
                          >
                            {lesson.title}
                          </Link>

                          {lesson.goal && (
                            <p className="mt-1 line-clamp-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                              {lesson.goal}
                            </p>
                          )}

                          {lesson.keywords.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {lesson.keywords.slice(0, 6).map((kw, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                >
                                  {kw.term}
                                  {lessonLang && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        speakTextWithTts(
                                          kw.term,
                                          lessonLang,
                                          false
                                        );
                                      }}
                                      title={`Nghe phát âm: ${kw.term}`}
                                      className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400"
                                    >
                                      <Volume2 className="h-3 w-3" />
                                    </button>
                                  )}
                                </span>
                              ))}
                              {lesson.keywords.length > 6 && (
                                <span className="text-xs font-bold text-slate-400">
                                  +{lesson.keywords.length - 6} thẻ
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800">
                          <div className="flex flex-wrap items-center gap-2">
                            {lesson.keywords.length > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveStudyDeck({
                                    title: `${lesson.title}`,
                                    cards: lesson.keywords.map((kw) => ({
                                      lessonId: lesson.id,
                                      subject: lesson.subject,
                                      unitTitle: lesson.unitTitle || 'Chung',
                                      keyword: kw,
                                      ttsLang:
                                        kw.ttsLang !== undefined
                                          ? kw.ttsLang
                                          : lessonLang,
                                    })),
                                  })
                                }
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300"
                              >
                                <Layers className="h-3.5 w-3.5" />
                                Học {lesson.keywords.length} Flashcard
                              </button>
                            )}

                            {isInstructorOrOwner && (
                              isAddedToToday ? (
                                <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                  <Check className="h-3.5 w-3.5" /> Đã thêm vào hôm nay
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={addingLessonId === lesson.id}
                                  onClick={() => void handleAddLessonToToday(lesson)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  {addingLessonId === lesson.id ? 'Đang thêm...' : 'Thêm vào hôm nay'}
                                </button>
                              )
                            )}

                            {lesson.resourceUrl && (
                              <span className="inline-flex items-center gap-1 text-sky-600">
                                <ExternalLink className="h-3 w-3" /> Tài liệu
                              </span>
                            )}
                          </div>

                          <Link
                            to={`/app/classes/${studyClass.id}/lessons/${lesson.id}`}
                            className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:underline dark:text-emerald-400"
                          >
                            {isInstructorOrOwner
                              ? 'Xem & Chỉnh sửa'
                              : 'Vào học bài này'}{' '}
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Modal học Flashcard tương tác */}
      {activeStudyDeck && (
        <FlashcardStudyModal
          title={activeStudyDeck.title}
          cards={activeStudyDeck.cards}
          srsStates={srsStates}
          todayStr={todayStr}
          onClose={() => setActiveStudyDeck(null)}
          onSaveProgress={async ({ updatedSrsPatch, summaryNote }) => {
            const targetUid = isStudent
              ? user.uid
              : selectedSrsStudentUid || user.uid;
            const targetName =
              students.find((s) => s.uid === targetUid)?.displayName ||
              user.displayName;
            const merged = await saveStudentSrsStates({
              classId: studyClass.id,
              studentUid: targetUid,
              studentName: targetName,
              todayDateStr: todayStr,
              srsStates: updatedSrsPatch,
            });
            setSrsStates(merged);

            if (isStudent) {
              await submitStudentCompletion({
                classId: studyClass.id,
                studentUid: user.uid,
                studentName: user.displayName,
                type: 'assignment',
                assignmentId: null,
                sessionId: null,
                title: activeStudyDeck.title,
                date: todayStr,
                studentNote: summaryNote,
              });
            }
          }}
        />
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: TẠO BÀI HỌC & FLASHCARD BẰNG AI HOẶC THỦ CÔNG                 */}
      {/* ===================================================================== */}
      {isInstructorOrOwner && showLessonModal && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-lesson-title"
          >
            <div className="my-6 w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <div>
                <h2
                  id="modal-lesson-title"
                  className="text-lg font-extrabold text-slate-900 dark:text-white"
                >
                  Tạo Bài học & Bộ thẻ Flashcard
                </h2>
                <p className="text-xs text-slate-500">
                  Hỗ trợ tạo nhanh bằng AI từ ghi chú buổi học / ảnh chụp trang sách hoặc nhập thủ công.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowLessonModal(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Chuyển chế độ AI vs Thủ công */}
            <div className="mt-4 inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setLessonCreationMode('ai')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                  lessonCreationMode === 'ai'
                    ? 'bg-white text-emerald-700 shadow-xs dark:bg-slate-900 dark:text-emerald-400'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <Bot className="h-3.5 w-3.5" />
                Tạo nhanh bằng AI (Copy Prompt & Dán JSON)
              </button>
              <button
                type="button"
                onClick={() => setLessonCreationMode('manual')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                  lessonCreationMode === 'manual'
                    ? 'bg-white text-emerald-700 shadow-xs dark:bg-slate-900 dark:text-emerald-400'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <Plus className="h-3.5 w-3.5" />
                Soạn thủ công
              </button>
            </div>

            <form
              onSubmit={(e) => void handleCreateLesson(e)}
              className="mt-4 space-y-4"
            >
              {formError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                  {formError}
                </div>
              )}

              {/* Thông tin Giáo trình (Droplist), Unit (Droplist), Tên bài & Ngôn ngữ đọc âm thanh */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="les-subject"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    Chọn Giáo trình / Môn học *
                  </label>
                  {subjectInputMode === 'select' && curriculums.length > 0 ? (
                    <div className="mt-1 flex gap-2">
                      <select
                        id="les-subject"
                        value={
                          curriculums.includes(subject)
                            ? subject
                            : curriculums[0]
                        }
                        onChange={(e) => {
                          if (e.target.value === '__NEW_CURRICULUM__') {
                            setSubjectInputMode('custom');
                            setSubject('');
                            setUnitInputMode('custom');
                            setUnitTitle('Unit 1: First Day');
                          } else {
                            const nextSub = e.target.value;
                            handleSubjectInputChange(nextSub);
                            const nextUnits = lessons
                              .filter((l) => l.subject === nextSub)
                              .map((l) => (l.unitTitle || '').trim())
                              .filter(Boolean);
                            if (nextUnits.length > 0) {
                              setUnitInputMode('select');
                              setUnitTitle(nextUnits[0]);
                            } else {
                              setUnitInputMode('custom');
                            }
                          }
                        }}
                        className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold dark:border-slate-700 dark:bg-slate-800"
                      >
                        {curriculums.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                        <option value="__NEW_CURRICULUM__">
                          + Tạo giáo trình mới...
                        </option>
                      </select>
                    </div>
                  ) : (
                    <div className="mt-1 flex gap-2">
                      <input
                        id="les-subject"
                        type="text"
                        required
                        value={subject}
                        onChange={(e) => handleSubjectInputChange(e.target.value)}
                        placeholder="Nhập tên giáo trình mới (VD: Everybody Up 1, Toán Lớp 3...)"
                        className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                      />
                      {curriculums.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSubjectInputMode('select');
                            handleSubjectInputChange(curriculums[0]);
                          }}
                          className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                        >
                          Chọn có sẵn
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="les-unit"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    Chọn Unit / Chương
                  </label>
                  {unitInputMode === 'select' && unitsInModalSubject.length > 0 ? (
                    <div className="mt-1 flex gap-2">
                      <select
                        id="les-unit"
                        value={
                          unitsInModalSubject.includes(unitTitle)
                            ? unitTitle
                            : unitsInModalSubject[0]
                        }
                        onChange={(e) => {
                          if (e.target.value === '__NEW_UNIT__') {
                            setUnitInputMode('custom');
                            setUnitTitle('');
                          } else {
                            setUnitTitle(e.target.value);
                          }
                        }}
                        className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold dark:border-slate-700 dark:bg-slate-800"
                      >
                        {unitsInModalSubject.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                        <option value="__NEW_UNIT__">
                          + Thêm Unit / Chương mới...
                        </option>
                      </select>
                    </div>
                  ) : (
                    <div className="mt-1 flex gap-2">
                      <input
                        id="les-unit"
                        type="text"
                        value={unitTitle}
                        onChange={(e) => setUnitTitle(e.target.value)}
                        placeholder="VD: Unit 1: First Day, Unit 2: Art Class..."
                        className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                      />
                      {unitsInModalSubject.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setUnitInputMode('select');
                            setUnitTitle(unitsInModalSubject[0]);
                          }}
                          className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                        >
                          Chọn Unit có sẵn
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="les-title"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    Tên bài học (Lesson) *
                  </label>
                  <input
                    id="les-title"
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="VD: Lesson 1: School Supplies"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label
                    htmlFor="les-tts-lang"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    Chế độ Loa đọc phát âm trên Flashcard
                  </label>
                  <select
                    id="les-tts-lang"
                    value={ttsLang}
                    onChange={(e) =>
                      setTtsLang(e.target.value as SupportedTtsLang)
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

              {/* Khối trợ lý AI (khi chọn chế độ AI) */}
              {lessonCreationMode === 'ai' && (
                <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 space-y-3 dark:border-violet-900/50 dark:bg-violet-950/20">
                  <div>
                    <label
                      htmlFor="ai-lesson-notes"
                      className="block text-xs font-extrabold text-violet-950 dark:text-violet-200"
                    >
                      Bước 1: Nhập nhanh từ mới / mẫu câu vừa học (hoặc để trống nếu bạn gửi kèm ảnh chụp trang sách cho AI)
                    </label>
                    <textarea
                      id="ai-lesson-notes"
                      rows={2}
                      value={aiRawNotes}
                      onChange={(e) => setAiRawNotes(e.target.value)}
                      placeholder="VD: Từ mới: pen, pencil, eraser, ruler, pencil case, backpack. Mẫu câu: What is it? It's a pen. / It's an eraser."
                      className="mt-1.5 w-full rounded-xl border border-violet-300 bg-white px-3 py-2 text-xs sm:text-sm dark:border-violet-800 dark:bg-slate-900"
                    />
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] text-violet-800 dark:text-violet-300">
                        Bấm Copy Prompt rồi dán vào ChatGPT / Gemini (có thể đính kèm ảnh chụp trang sách).
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleCopyFlashcardPrompt()}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-violet-700"
                      >
                        {copiedFlashcardPrompt ? (
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
                    <label
                      htmlFor="ai-lesson-json"
                      className="block text-xs font-extrabold text-violet-950 dark:text-violet-200"
                    >
                      Bước 2: Dán kết quả JSON từ AI vào đây để xem Preview & Chỉnh sửa
                    </label>
                    <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                      <textarea
                        id="ai-lesson-json"
                        rows={2}
                        value={aiPastedJson}
                        onChange={(e) => setAiPastedJson(e.target.value)}
                        placeholder='Dán codeblock ```json { "keywords": [...] } ``` từ AI vào đây...'
                        className="flex-1 rounded-xl border border-violet-300 bg-white px-3 py-2 font-mono text-xs dark:border-violet-800 dark:bg-slate-900"
                      />
                      <button
                        type="button"
                        onClick={handleParseAiFlashcardJson}
                        className="shrink-0 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
                      >
                        Đọc JSON & Xem Preview
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Preview & Chỉnh sửa danh sách thẻ Flashcard */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Bộ thẻ Flashcard trong bài ({keywords.length} thẻ)
                  </span>
                  <button
                    type="button"
                    onClick={handleAddKeywordRow}
                    className="text-xs font-bold text-emerald-700 hover:underline dark:text-emerald-400"
                  >
                    + Thêm thẻ mới
                  </button>
                </div>

                <div className="mt-3 space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {keywords.map((kw, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-1 gap-2 sm:grid-cols-12 items-start rounded-xl border border-slate-200/80 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900"
                    >
                      <input
                        type="text"
                        placeholder="Mặt trước (Từ mới / Mẫu câu / Câu hỏi)"
                        value={kw.term}
                        onChange={(e) =>
                          handleKeywordChange(index, 'term', e.target.value)
                        }
                        className="sm:col-span-3 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                      />
                      <input
                        type="text"
                        placeholder="Phiên âm (IPA/Pinyin)"
                        value={kw.pronunciation || ''}
                        onChange={(e) =>
                          handleKeywordChange(
                            index,
                            'pronunciation',
                            e.target.value
                          )
                        }
                        className="sm:col-span-2 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                      />
                      <input
                        type="text"
                        placeholder="Mặt sau (Nghĩa TV / Đáp án)"
                        value={kw.meaning}
                        onChange={(e) =>
                          handleKeywordChange(index, 'meaning', e.target.value)
                        }
                        className="sm:col-span-3 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                      />
                      <input
                        type="text"
                        placeholder="Câu ví dụ / Ghi chú"
                        value={kw.example}
                        onChange={(e) =>
                          handleKeywordChange(index, 'example', e.target.value)
                        }
                        className="sm:col-span-3 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                      />
                      <div className="sm:col-span-1 flex items-center justify-end gap-1">
                        {ttsLang && kw.term && (
                          <button
                            type="button"
                            onClick={() =>
                              speakTextWithTts(kw.term, ttsLang, false)
                            }
                            title="Nghe thử"
                            className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50"
                          >
                            <Volume2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveKeywordRow(index)}
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

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="les-goal"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    Mục tiêu bài học
                  </label>
                  <input
                    id="les-goal"
                    type="text"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="VD: Thuộc 6 đồ dùng học tập và mẫu câu What is it?"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label
                    htmlFor="les-explanation"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    Tóm tắt ngữ pháp / kiến thức cần nhớ
                  </label>
                  <input
                    id="les-explanation"
                    type="text"
                    value={explanation}
                    onChange={(e) => setExplanation(e.target.value)}
                    placeholder="VD: Dùng 'an' trước nguyên âm (an eraser), 'a' trước phụ âm (a pen)..."
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              {/* Tùy chọn giao luôn bộ Flashcard làm nhiệm vụ cho em */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                <label className="flex items-center gap-2.5 text-xs sm:text-sm font-bold text-emerald-950 cursor-pointer dark:text-emerald-200">
                  <input
                    type="checkbox"
                    checked={assignFlashcardImmediately}
                    onChange={(e) =>
                      setAssignFlashcardImmediately(e.target.checked)
                    }
                    className="h-4 w-4 rounded border-emerald-400 text-emerald-600"
                  />
                  Giao luôn bộ Flashcard này vào danh sách Nhiệm vụ của học sinh
                </label>

                {assignFlashcardImmediately && (
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <span>Thưởng:</span>
                    <select
                      aria-label="Số sao thưởng nhiệm vụ Flashcard"
                      value={assignStars}
                      onChange={(e) => setAssignStars(Number(e.target.value))}
                      className="rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-xs font-bold dark:border-emerald-800 dark:bg-slate-900"
                    >
                      {[1, 2, 3, 4, 5].map((s) => (
                        <option key={s} value={s}>
                          +{s} sao
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowLessonModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving
                    ? 'Đang lưu...'
                    : assignFlashcardImmediately
                    ? 'Lưu bài học & Giao Flashcard cho em'
                    : 'Lưu bài học'}
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: TẠO ĐỀ KIỂM TRA TRẮC NGHIỆM BẰNG AI (REVIEW & EDIT)          */}
      {/* ===================================================================== */}
      {isInstructorOrOwner && showQuizAiModal && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-quiz-ai-title"
          >
            <div className="my-6 w-full max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[92vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <div>
                <h2
                  id="modal-quiz-ai-title"
                  className="text-lg font-extrabold text-slate-900 dark:text-white"
                >
                  Tạo Đề Kiểm Tra Trắc Nghiệm bằng AI (Theo Unit / Từ sắp quên)
                </h2>
                <p className="text-xs text-slate-500">
                  Hệ thống tự động gom các từ vựng, mẫu câu hoặc kiến thức đã học trong Unit để tạo Prompt cho AI.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowQuizAiModal(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {quizError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                {quizError}
              </div>
            )}

            {/* Bước 1: Chọn Giáo trình & Phạm vi từ vựng/kiến thức */}
            <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4 space-y-3 dark:border-violet-900/50 dark:bg-violet-950/20">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Giáo trình / Môn học
                  </label>
                  <select
                    value={quizSubject}
                    onChange={(e) => {
                      setQuizSubject(e.target.value);
                      setQuizUnitTitle('ALL');
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="ALL">Tất cả giáo trình</option>
                    {curriculums.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Nguồn kiến thức kiểm tra
                  </label>
                  <select
                    value={quizSourceMode}
                    onChange={(e) =>
                      setQuizSourceMode(e.target.value as 'unit' | 'srs_due')
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="unit">Theo Unit / Chương đã học</option>
                    <option value="srs_due">
                      Theo Đường cong quên lãng (Từ Hay quên / Sắp quên)
                    </option>
                  </select>
                </div>

                {quizSourceMode === 'unit' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Chọn Unit
                    </label>
                    <select
                      value={quizUnitTitle}
                      onChange={(e) => setQuizUnitTitle(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="ALL">Tất cả Unit của giáo trình</option>
                      {Array.from(
                        new Set(
                          lessons
                            .filter(
                              (l) =>
                                quizSubject === 'ALL' ||
                                l.subject === quizSubject
                            )
                            .map((l) => l.unitTitle?.trim() || 'Chưa phân Unit')
                        )
                      ).map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Số lượng câu hỏi
                  </label>
                  <select
                    value={quizQuestionCount}
                    onChange={(e) =>
                      setQuizQuestionCount(Number(e.target.value))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                  >
                    {[5, 8, 10, 12, 15, 20].map((n) => (
                      <option key={n} value={n}>
                        {n} câu trắc nghiệm
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="text-xs font-semibold text-violet-900 dark:text-violet-200">
                  Đã gom tự động{' '}
                  <strong>{quizSourceCards.length} từ mới / mẫu câu</strong> từ
                  các bài học đã chọn vào Prompt.
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopyQuizPrompt()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-700"
                >
                  {copiedQuizPrompt ? (
                    <>
                      <Check className="h-4 w-4" /> Đã Copy Prompt Đề Thi!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" /> Bước 1: Copy Prompt gửi AI
                    </>
                  )}
                </button>
              </div>

              <div className="border-t border-violet-200/80 pt-3 dark:border-violet-800/60">
                <label className="block text-xs font-extrabold text-violet-950 dark:text-violet-200">
                  Bước 2: Dán JSON đề kiểm tra từ AI trả về vào đây
                </label>
                <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                  <textarea
                    rows={2}
                    value={quizPastedJson}
                    onChange={(e) => setQuizPastedJson(e.target.value)}
                    placeholder='Dán codeblock ```json { "title": "...", "questions": [...] } ``` vào đây...'
                    className="flex-1 rounded-xl border border-violet-300 bg-white px-3 py-2 font-mono text-xs dark:border-violet-800 dark:bg-slate-900"
                  />
                  <button
                    type="button"
                    onClick={handleParseQuizJson}
                    className="shrink-0 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
                  >
                    Review & Chỉnh sửa đề thi
                  </button>
                </div>
              </div>
            </div>

            {/* Bước 3: Review & Edit từng câu hỏi trước khi giao cho học sinh */}
            {quizQuestions.length > 0 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Tiêu đề bài kiểm tra
                    </label>
                    <input
                      type="text"
                      value={quizTitle}
                      onChange={(e) => setQuizTitle(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Sao thưởng khi hoàn thành
                    </label>
                    <select
                      value={quizStarsReward}
                      onChange={(e) =>
                        setQuizStarsReward(Number(e.target.value))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold dark:border-slate-700 dark:bg-slate-800"
                    >
                      {[2, 3, 5, 8, 10].map((s) => (
                        <option key={s} value={s}>
                          Thưởng +{s} sao
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {quizQuestions.map((q, qIdx) => (
                    <div
                      key={q.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-2.5 dark:border-slate-800 dark:bg-slate-800/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
                          Câu {qIdx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setQuizQuestions((prev) =>
                              prev.filter((_, i) => i !== qIdx)
                            )
                          }
                          className="text-xs font-bold text-rose-600 hover:underline"
                        >
                          Xóa câu này
                        </button>
                      </div>

                      <input
                        type="text"
                        value={q.question}
                        onChange={(e) =>
                          setQuizQuestions((prev) =>
                            prev.map((item, i) =>
                              i === qIdx
                                ? { ...item, question: e.target.value }
                                : item
                            )
                          )
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm font-bold dark:border-slate-700 dark:bg-slate-900"
                      />

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {q.options.map((opt, oIdx) => (
                          <div key={oIdx} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`correct-${q.id}`}
                              checked={q.correctIndex === oIdx}
                              onChange={() =>
                                setQuizQuestions((prev) =>
                                  prev.map((item, i) =>
                                    i === qIdx
                                      ? { ...item, correctIndex: oIdx }
                                      : item
                                  )
                                )
                              }
                              title="Chọn làm đáp án đúng"
                            />
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) =>
                                setQuizQuestions((prev) =>
                                  prev.map((item, i) => {
                                    if (i !== qIdx) return item;
                                    const nextOpts = [...item.options];
                                    nextOpts[oIdx] = e.target.value;
                                    return { ...item, options: nextOpts };
                                  })
                                )
                              }
                              className={`flex-1 rounded-lg border px-2.5 py-1.5 text-xs ${
                                q.correctIndex === oIdx
                                  ? 'border-emerald-500 bg-emerald-50 font-bold text-emerald-950 dark:bg-emerald-950/50 dark:text-emerald-200'
                                  : 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900'
                              }`}
                            />
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <input
                          type="text"
                          placeholder="Giải thích đáp án"
                          value={q.explanation}
                          onChange={(e) =>
                            setQuizQuestions((prev) =>
                              prev.map((item, i) =>
                                i === qIdx
                                  ? { ...item, explanation: e.target.value }
                                  : item
                              )
                            )
                          }
                          className="sm:col-span-2 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                        />
                        <input
                          type="text"
                          placeholder="Từ liên kết SRS (relatedTerm)"
                          value={q.relatedTerm || ''}
                          onChange={(e) =>
                            setQuizQuestions((prev) =>
                              prev.map((item, i) =>
                                i === qIdx
                                  ? { ...item, relatedTerm: e.target.value }
                                  : item
                              )
                            )
                          }
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowQuizAiModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={savingQuiz || quizQuestions.length === 0}
                onClick={() => void handleSaveAndAssignQuiz()}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {savingQuiz
                  ? 'Đang lưu & giao bài...'
                  : `Lưu & Giao đề thi (${quizQuestions.length} câu)`}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
}
export { SrsStatusBadge, Sparkles };
