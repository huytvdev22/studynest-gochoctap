import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  ExternalLink,
  Eye,
  FileEdit,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { Lesson, LessonKeyword, LessonStatus } from '@/types/domain';
import { useAuth } from '@/contexts/AuthContext';
import { useClassContext } from '@/contexts/ClassContext';
import {
  listLessons,
  saveLessonWithTeacherNote,
} from '@/services/studyNestService';
import { validateLessonInput } from '@/lib/validation';
import { EmptyState } from '@/components/ui/ThemeBadges';

export function LessonsPage() {
  const { user } = useAuth();
  const { studyClass, role, isInstructorOrOwner } = useClassContext();
  const navigate = useNavigate();

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Bộ lọc
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | LessonStatus>('ALL');

  // Form tạo bài học mới
  const [showModal, setShowModal] = useState<boolean>(false);
  const [subject, setSubject] = useState<string>('Toán');
  const [title, setTitle] = useState<string>('');
  const [goal, setGoal] = useState<string>('');
  const [explanation, setExplanation] = useState<string>('');
  const [resourceUrl, setResourceUrl] = useState<string>('');
  const [status, setStatus] = useState<LessonStatus>('published');
  const [teacherNoteContent, setTeacherNoteContent] = useState<string>('');
  const [keywords, setKeywords] = useState<LessonKeyword[]>([
    { term: '', meaning: '', example: '' },
  ]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  const loadLessons = useCallback(async () => {
    if (!studyClass || !role) return;
    setLoading(true);
    try {
      const data = await listLessons(studyClass.id, role);
      setLessons(data);
    } finally {
      setLoading(false);
    }
  }, [studyClass, role]);

  useEffect(() => {
    void loadLessons();
  }, [loadLessons]);

  if (!studyClass || !user || !role) return null;

  const subjects = Array.from(new Set(lessons.map((l) => l.subject))).sort();

  const filteredLessons = lessons.filter((l) => {
    if (subjectFilter !== 'ALL' && l.subject !== subjectFilter) return false;
    if (statusFilter !== 'ALL' && l.status !== statusFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchTitle = l.title.toLowerCase().includes(q);
      const matchSubject = l.subject.toLowerCase().includes(q);
      const matchKw = l.keywords.some((k) =>
        k.term.toLowerCase().includes(q)
      );
      if (!matchTitle && !matchSubject && !matchKw) return false;
    }
    return true;
  });

  const handleAddKeywordRow = () => {
    setKeywords((prev) => [...prev, { term: '', meaning: '', example: '' }]);
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

    const cleanedKeywords = keywords
      .map((k) => ({
        term: k.term.trim(),
        meaning: k.meaning.trim(),
        example: k.example.trim(),
      }))
      .filter((k) => k.term.length > 0);

    setSaving(true);
    try {
      const created = await saveLessonWithTeacherNote(studyClass.id, user.uid, {
        subject,
        title,
        goal,
        keywords: cleanedKeywords,
        explanation,
        resourceUrl,
        status,
        teacherNoteContent,
      });
      setShowModal(false);
      navigate(`/app/classes/${studyClass.id}/lessons/${created.id}`);
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : 'Không thể lưu bài học.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Thanh công cụ & Bộ lọc */}
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="search"
              aria-label="Tìm bài học theo tên hoặc từ khóa"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên bài, môn hoặc từ khóa..."
              className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-9 pr-3.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <select
            aria-label="Lọc theo môn học"
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="ALL">Tất cả môn học</option>
            {subjects.map((sub) => (
              <option key={sub} value={sub}>
                Môn: {sub}
              </option>
            ))}
          </select>

          {isInstructorOrOwner && (
            <select
              aria-label="Lọc theo trạng thái bài học"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'ALL' | LessonStatus)
              }
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="ALL">Mọi trạng thái</option>
              <option value="published">Đã công bố (Published)</option>
              <option value="draft">Bản nháp (Draft)</option>
            </select>
          )}
        </div>

        {isInstructorOrOwner && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Soạn bài học mới
          </button>
        )}
      </div>

      {/* Danh sách bài học */}
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
          title="Chưa có bài học nào khớp với bộ lọc"
          description={
            isInstructorOrOwner
              ? 'Hãy tạo bài học mới với từ khóa, giải thích dễ hiểu và ghi chú sư phạm riêng tư.'
              : 'Người hướng dẫn chưa công bố bài học nào trong mục này.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {filteredLessons.map((lesson) => (
            <Link
              key={lesson.id}
              to={`/app/classes/${studyClass.id}/lessons/${lesson.id}`}
              className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-extrabold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {lesson.subject}
                  </span>

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
                          <FileEdit className="h-3 w-3" /> Bản nháp (Học sinh không thấy)
                        </>
                      )}
                    </span>
                  )}
                </div>

                <h2 className="mt-3 text-lg font-extrabold text-slate-900 group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-400">
                  {lesson.title}
                </h2>
                {lesson.goal && (
                  <p className="mt-1.5 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
                    <strong>Mục tiêu:</strong> {lesson.goal}
                  </p>
                )}

                {lesson.keywords.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {lesson.keywords.slice(0, 4).map((kw, idx) => (
                      <span
                        key={idx}
                        className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {kw.term}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800">
                <span>
                  {lesson.keywords.length} từ khóa
                  {lesson.resourceUrl && (
                    <span className="ml-2 inline-flex items-center gap-1 text-sky-600">
                      <ExternalLink className="h-3 w-3" /> Có tài liệu đính kèm
                    </span>
                  )}
                </span>
                <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
                  Xem bài học <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Modal tạo bài học mới */}
      {isInstructorOrOwner && showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-lesson-title"
        >
          <div className="my-8 w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <h2
                id="modal-lesson-title"
                className="text-lg font-extrabold text-slate-900 dark:text-white"
              >
                Soạn bài học mới
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={(e) => void handleCreateLesson(e)} className="mt-4 space-y-4">
              {formError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="les-subject"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    Môn học *
                  </label>
                  <input
                    id="les-subject"
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Toán, Tiếng Việt..."
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="les-title"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    Tiêu đề bài học *
                  </label>
                  <input
                    id="les-title"
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="VD: Nhân số có ba chữ số với số có một chữ số"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="les-goal"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  Mục tiêu cần đạt
                </label>
                <input
                  id="les-goal"
                  type="text"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="Học sinh nắm được quy tắc đặt tính và nhân từ phải sang trái..."
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              {/* Từ khóa (term, meaning, example) */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Từ khóa trọng tâm ({keywords.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddKeywordRow}
                    className="text-xs font-bold text-emerald-700 hover:underline dark:text-emerald-400"
                  >
                    + Thêm từ khóa
                  </button>
                </div>

                <div className="mt-3 space-y-3">
                  {keywords.map((kw, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-1 gap-2 sm:grid-cols-12 items-start"
                    >
                      <input
                        type="text"
                        placeholder="Từ khóa (Term)"
                        value={kw.term}
                        onChange={(e) =>
                          handleKeywordChange(index, 'term', e.target.value)
                        }
                        className="sm:col-span-3 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                      />
                      <input
                        type="text"
                        placeholder="Giải nghĩa dễ hiểu (Meaning)"
                        value={kw.meaning}
                        onChange={(e) =>
                          handleKeywordChange(index, 'meaning', e.target.value)
                        }
                        className="sm:col-span-4 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                      />
                      <input
                        type="text"
                        placeholder="Ví dụ minh họa (Example)"
                        value={kw.example}
                        onChange={(e) =>
                          handleKeywordChange(index, 'example', e.target.value)
                        }
                        className="sm:col-span-4 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveKeywordRow(index)}
                        aria-label="Xóa từ khóa"
                        className="sm:col-span-1 flex justify-center rounded-lg p-1.5 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="les-explanation"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  Nội dung giải thích cho học sinh
                </label>
                <textarea
                  id="les-explanation"
                  rows={4}
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Viết từng bước ngắn gọn, rõ chữ để học sinh lớp 3 dễ đọc..."
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="les-url"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    Link tài liệu PDF / Học liệu ngoài (URL)
                  </label>
                  <input
                    id="les-url"
                    type="url"
                    value={resourceUrl}
                    onChange={(e) => setResourceUrl(e.target.value)}
                    placeholder="https://example.com/phieu-bai-tap.pdf"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label
                    htmlFor="les-status"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    Trạng thái hiển thị
                  </label>
                  <select
                    id="les-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as LessonStatus)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="published">
                      Công bố ngay (Học sinh nhìn thấy)
                    </option>
                    <option value="draft">
                      Lưu bản nháp (Chỉ giáo viên thấy)
                    </option>
                  </select>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                <label
                  htmlFor="les-teacher-note"
                  className="block text-xs font-bold text-amber-900 dark:text-amber-300"
                >
                  🔒 Ghi chú riêng cho người hướng dẫn (Bảo vệ bởi Firestore Rules – Học sinh không bao giờ đọc được)
                </label>
                <textarea
                  id="les-teacher-note"
                  rows={2}
                  value={teacherNoteContent}
                  onChange={(e) => setTeacherNoteContent(e.target.value)}
                  placeholder="Lưu ý các lỗi sai học sinh hay mắc phải, mẹo giảng bài..."
                  className="mt-1.5 w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm dark:border-amber-800 dark:bg-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving ? 'Đang lưu...' : 'Lưu bài học'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

