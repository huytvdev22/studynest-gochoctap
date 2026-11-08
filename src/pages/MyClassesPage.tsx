import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  KeyRound,
  Plus,
  X,
} from 'lucide-react';
import type {
  ClassMember,
  ClassThemeColor,
  ClassThemeIcon,
  StudyClass,
} from '@/types/domain';
import { useAuth } from '@/contexts/AuthContext';
import {
  createClassWithOwnerAtomic,
  listUserClassesWithMembership,
} from '@/services/studyNestService';
import {
  ALLOWED_CLASS_COLORS,
  ALLOWED_CLASS_ICONS,
  validateClassInput,
} from '@/lib/validation';
import {
  DAY_OF_WEEK_SHORT_LABELS,
  DEFAULT_CLASS_TIMEZONE,
  ORDERED_DAYS_OF_WEEK,
} from '@/lib/date';
import {
  ClassIconView,
  EmptyState,
  RoleBadge,
  THEME_COLOR_STYLES,
} from '@/components/ui/ThemeBadges';
import { ModalPortal } from '@/components/ui/ModalPortal';

export function MyClassesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState<
    Array<{ studyClass: StudyClass; membership: ClassMember }>
  >([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Form tạo lớp mới (Chức năng phụ dành cho người hướng dẫn)
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<ClassThemeColor>('emerald');
  const [icon, setIcon] = useState<ClassThemeIcon>('book-open');
  const [studyDays, setStudyDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Ô nhập nhanh link / token tham gia lớp (Mặc định ẩn nếu đã có lớp để giao diện gọn cho học sinh)
  const [showJoinBox, setShowJoinBox] = useState<boolean>(false);
  const [joinInput, setJoinInput] = useState('');

  const loadClasses = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listUserClassesWithMembership(user.uid);
      setItems(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Không thể tải danh sách lớp học.'
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  const toggleStudyDay = (day: number) => {
    setStudyDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setFormError(null);

    const validation = validateClassInput({
      name,
      description,
      color,
      icon,
      studyDaysOfWeek: studyDays,
    });
    if (!validation.valid) {
      setFormError(validation.error || 'Dữ liệu không hợp lệ.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await createClassWithOwnerAtomic(
        user.uid,
        user.displayName,
        user.photoURL,
        {
          name,
          description,
          color,
          icon,
          timezone: DEFAULT_CLASS_TIMEZONE,
          studyDaysOfWeek: studyDays,
        }
      );
      setShowCreateModal(false);
      setName('');
      setDescription('');
      navigate(`/app/classes/${created.id}`);
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : 'Lỗi khi tạo lớp học mới.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickJoinNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = joinInput.trim();
    if (!raw) return;
    // Cho phép dán cả URL đầy đủ (https://.../join/cls.inv) hoặc chỉ token (cls.inv)
    const match = raw.match(/\/join\/([^/?#]+)/);
    const token = match ? match[1] : raw;
    navigate(`/join/${encodeURIComponent(token)}`);
  };

  const renderClassCard = ({
    studyClass,
    membership,
  }: {
    studyClass: StudyClass;
    membership: ClassMember;
  }) => {
    const theme =
      THEME_COLOR_STYLES[studyClass.color] || THEME_COLOR_STYLES.emerald;
    const studyDaysText = studyClass.studyDaysOfWeek
      .slice()
      .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
      .map((d) => DAY_OF_WEEK_SHORT_LABELS[d])
      .join(', ');

    return (
      <Link
        key={studyClass.id}
        to={`/app/classes/${studyClass.id}`}
        className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-700"
      >
        <div className={`absolute inset-x-0 top-0 h-1.5 ${theme.accentBar}`} />

        <div>
          <div className="flex items-start justify-between gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm ${theme.iconBg}`}
            >
              <ClassIconView icon={studyClass.icon} className="h-5 w-5" />
            </div>
            <RoleBadge role={membership.role} />
          </div>

          <h3 className="mt-4 text-lg font-extrabold text-slate-900 group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-400">
            {studyClass.name}
          </h3>
          <p className="mt-1.5 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
            {studyClass.description || 'Bấm vào để xem lịch học và bài tập hôm nay.'}
          </p>
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3.5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <span>Lịch học: {studyDaysText}</span>
          <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-3 py-1.5 font-bold text-emerald-700 transition group-hover:bg-emerald-600 group-hover:text-white dark:bg-emerald-950/60 dark:text-emerald-300 dark:group-hover:bg-emerald-600 dark:group-hover:text-white">
            Vào học ngay
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </Link>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header trang Góc học tập của bạn: Giao diện mặc định ưu tiên việc vào học */}
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            Góc học tập của tôi
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Chọn lớp học để xem thời khóa biểu, chuẩn bị sách vở và bắt đầu buổi học hôm nay.
          </p>
        </div>

        {/* Các hành động phụ: Nhập mã tham gia lớp khác & Tạo lớp mới (được làm dịu nhẹ) */}
        <div className="flex flex-wrap items-center gap-2">
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => setShowJoinBox((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <KeyRound className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              Nhập mã vào lớp khác
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            Tạo lớp mới
          </button>
        </div>
      </div>

      {/* Thanh tham gia lớp bằng đường link / token lời mời (Chỉ hiện khi chưa có lớp nào hoặc khi bấm nút "Nhập mã vào lớp khác") */}
      {(showJoinBox || (!loading && items.length === 0)) && (
        <form
          onSubmit={handleQuickJoinNavigate}
          className="flex flex-col gap-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-900/50 dark:bg-emerald-950/20"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <label
                htmlFor="quick-join-input"
                className="block text-sm font-bold text-slate-900 dark:text-white"
              >
                Tham gia lớp học bằng mã lời mời
              </label>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Dán đường link lời mời hoặc mã token được gửi từ người hướng dẫn để vào lớp.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="quick-join-input"
              type="text"
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value)}
              placeholder="Dán link lời mời hoặc token..."
              className="w-full sm:w-72 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
            <button
              type="submit"
              className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
            >
              Mở lời mời
            </button>
          </div>
        </form>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-48 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/60"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-6 w-6" />}
          title="Bạn chưa tham gia lớp học nào"
          description="Nếu bạn là học sinh, hãy dán đường link lời mời ở ô phía trên để vào lớp. Nếu bạn là phụ huynh hoặc người hướng dẫn, bạn có thể tạo góc học tập mới."
          action={
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Plus className="h-4 w-4" />
              Dành cho người hướng dẫn: Tạo lớp học mới
            </button>
          }
        />
      ) : (
        <section aria-label="Danh sách lớp học của tôi">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map(renderClassCard)}
          </div>
        </section>
      )}

      {/* Modal tạo lớp mới */}
      {showCreateModal && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-create-class-title"
          >
            <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <h2
                id="modal-create-class-title"
                className="text-lg font-extrabold text-slate-900 dark:text-white"
              >
                Tạo lớp học mới
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                aria-label="Đóng hộp thoại"
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={(e) => void handleCreateClass(e)} className="mt-4 space-y-4">
              {formError && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200"
                >
                  {formError}
                </div>
              )}

              <div>
                <label
                  htmlFor="class-name-input"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                >
                  Tên lớp học *
                </label>
                <input
                  id="class-name-input"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Góc học tập Lớp 3 – Bé An"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="class-desc-input"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                >
                  Mô tả ngắn
                </label>
                <textarea
                  id="class-desc-input"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Mục tiêu học tập, khung giờ kèm mỗi tối..."
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <span className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Màu chủ đề
                  </span>
                  <div className="mt-2 flex items-center gap-2">
                    {ALLOWED_CLASS_COLORS.map((c) => {
                      const st = THEME_COLOR_STYLES[c];
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setColor(c)}
                          aria-label={`Chọn màu ${c}`}
                          className={`h-8 w-8 rounded-full ${st.iconBg} flex items-center justify-center transition ${
                            color === c
                              ? 'ring-2 ring-slate-900 ring-offset-2 dark:ring-white'
                              : 'opacity-70 hover:opacity-100'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Biểu tượng
                  </span>
                  <div className="mt-2 flex items-center gap-1.5">
                    {ALLOWED_CLASS_ICONS.map((ic) => (
                      <button
                        key={ic}
                        type="button"
                        onClick={() => setIcon(ic)}
                        aria-label={`Chọn biểu tượng ${ic}`}
                        className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                          icon === ic
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400'
                        }`}
                      >
                        <ClassIconView icon={ic} className="h-4 w-4" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <span className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Các ngày học cố định trong tuần (Tính chuỗi Streak)
                </span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {ORDERED_DAYS_OF_WEEK.map((d) => {
                    const selected = studyDays.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleStudyDay(d)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                          selected
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {DAY_OF_WEEK_SHORT_LABELS[d]}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Những ngày không chọn sẽ được tính là ngày nghỉ cố định và không làm đứt streak.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submitting ? 'Đang tạo...' : 'Tạo lớp học'}
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
}
