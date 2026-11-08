import React, { useCallback, useEffect, useState } from 'react';
import {
  Backpack,
  Calendar,
  CalendarOff,
  CheckSquare,
  Plus,
  Square,
  Trash2,
} from 'lucide-react';
import type {
  ScheduleException,
  ScheduleItem,
  ScheduleType,
  SessionOfDay,
} from '@/types/domain';
import { useAuth } from '@/contexts/AuthContext';
import { useClassContext } from '@/contexts/ClassContext';
import {
  deleteScheduleException,
  deleteScheduleItem,
  listScheduleExceptions,
  listSchedules,
  saveScheduleException,
  saveScheduleItem,
} from '@/services/studyNestService';
import {
  DAY_OF_WEEK_LABELS,
  formatVietnameseDate,
  getTodayAndTomorrow,
  ORDERED_DAYS_OF_WEEK,
} from '@/lib/date';

const SESSION_OF_DAY_LABELS: Record<SessionOfDay, string> = {
  morning: 'Buổi sáng',
  afternoon: 'Buổi chiều',
  evening: 'Buổi tối',
};

export function SchedulePage() {
  const { user } = useAuth();
  const { studyClass, isInstructorOrOwner } = useClassContext();

  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [exceptions, setExceptions] = useState<ScheduleException[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<'all' | ScheduleType>('all');

  // Checklist chuẩn bị sách vở ngày mai (lưu trạng thái tick ở client)
  const [packedItems, setPackedItems] = useState<Record<string, boolean>>({});

  // Form thêm tiết học
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [dayOfWeek, setDayOfWeek] = useState<number>(1);
  const [sessionOfDay, setSessionOfDay] = useState<SessionOfDay>('evening');
  const [periodNumber, setPeriodNumber] = useState<number>(1);
  const [subject, setSubject] = useState<string>('');
  const [type, setType] = useState<ScheduleType>('tutoring');
  const [teacherName, setTeacherName] = useState<string>('');
  const [materialsNote, setMaterialsNote] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('19:30');
  const [endTime, setEndTime] = useState<string>('20:30');

  // Form thêm ngày nghỉ ngoại lệ
  const [exDate, setExDate] = useState<string>('');
  const [exReason, setExReason] = useState<string>('');

  const loadScheduleData = useCallback(async () => {
    if (!studyClass) return;
    setLoading(true);
    try {
      const [sch, exc] = await Promise.all([
        listSchedules(studyClass.id),
        listScheduleExceptions(studyClass.id),
      ]);
      setSchedules(sch);
      setExceptions(exc);
    } finally {
      setLoading(false);
    }
  }, [studyClass]);

  useEffect(() => {
    void loadScheduleData();
  }, [loadScheduleData]);

  if (!studyClass || !user) return null;

  const { tomorrow, tomorrowDayOfWeek } = getTodayAndTomorrow(
    new Date(),
    studyClass.timezone
  );

  const tomorrowItems = schedules.filter(
    (s) => s.dayOfWeek === tomorrowDayOfWeek
  );

  const filteredSchedules = schedules.filter((s) =>
    filterType === 'all' ? true : s.type === filterType
  );

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;
    await saveScheduleItem(studyClass.id, user.uid, {
      dayOfWeek,
      sessionOfDay,
      periodNumber,
      subject,
      type,
      teacherName,
      materialsNote,
      startTime,
      endTime,
    });
    setSubject('');
    setMaterialsNote('');
    setShowAddModal(false);
    await loadScheduleData();
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    await deleteScheduleItem(studyClass.id, scheduleId);
    await loadScheduleData();
  };

  const handleAddException = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exDate || !exReason.trim()) return;
    await saveScheduleException(studyClass.id, user.uid, {
      date: exDate,
      reason: exReason,
      isDayOff: true,
    });
    setExDate('');
    setExReason('');
    await loadScheduleData();
  };

  const handleDeleteException = async (id: string) => {
    await deleteScheduleException(studyClass.id, id);
    await loadScheduleData();
  };

  const togglePacked = (id: string) => {
    setPackedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-8">
      {/* Checklist Ngày mai học gì & Chuẩn bị sách vở */}
      <section className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-6 shadow-xs dark:border-emerald-900/50 dark:bg-emerald-950/20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white">
              <Backpack className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Ngày mai học gì? • Checklist soạn cặp ({DAY_OF_WEEK_LABELS[tomorrowDayOfWeek]},{' '}
                {formatVietnameseDate(tomorrow, false)})
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Đánh dấu từng môn sau khi đã bỏ đầy đủ sách giáo khoa, vở bài tập và dụng cụ vào cặp.
              </p>
            </div>
          </div>
        </div>

        {tomorrowItems.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-white/80 p-4 text-sm text-slate-600 dark:bg-slate-900/70 dark:text-slate-300">
            Ngày mai ({DAY_OF_WEEK_LABELS[tomorrowDayOfWeek]}) không có tiết học cố định.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tomorrowItems.map((item) => {
              const checked = Boolean(packedItems[item.id]);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => togglePacked(item.id)}
                  className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${
                    checked
                      ? 'border-emerald-500 bg-emerald-100/70 dark:border-emerald-700 dark:bg-emerald-900/40'
                      : 'border-slate-200 bg-white hover:border-emerald-300 dark:border-slate-800 dark:bg-slate-900'
                  }`}
                >
                  {checked ? (
                    <CheckSquare className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Square className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-bold ${
                          checked
                            ? 'line-through text-slate-500'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        Tiết {item.periodNumber}: {item.subject}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {SESSION_OF_DAY_LABELS[item.sessionOfDay]} •{' '}
                      {item.type === 'tutoring' ? 'Kèm tại nhà' : 'Chính khóa'}
                    </div>
                    {item.materialsNote && (
                      <div className="mt-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                        Sách vở: {item.materialsNote}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Bộ lọc & nút thêm Thời khóa biểu */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
              filterType === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'border border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
            }`}
          >
            Tất cả lịch ({schedules.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('regular')}
            className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
              filterType === 'regular'
                ? 'bg-sky-600 text-white'
                : 'border border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
            }`}
          >
            Lịch chính khóa ở trường
          </button>
          <button
            type="button"
            onClick={() => setFilterType('tutoring')}
            className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
              filterType === 'tutoring'
                ? 'bg-emerald-600 text-white'
                : 'border border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
            }`}
          >
            Lịch kèm học tại nhà
          </button>
        </div>

        {isInstructorOrOwner && (
          <button
            type="button"
            onClick={() => setShowAddModal((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Thêm tiết học vào thời khóa biểu
          </button>
        )}
      </div>

      {/* Form tạo tiết học (cho Owner / Instructor) */}
      {isInstructorOrOwner && showAddModal && (
        <form
          onSubmit={(e) => void handleAddSchedule(e)}
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md space-y-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
            Thêm tiết học mới
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label
                htmlFor="sch-dow"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Thứ trong tuần
              </label>
              <select
                id="sch-dow"
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                {ORDERED_DAYS_OF_WEEK.map((d) => (
                  <option key={d} value={d}>
                    {DAY_OF_WEEK_LABELS[d]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="sch-session"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Buổi
              </label>
              <select
                id="sch-session"
                value={sessionOfDay}
                onChange={(e) => setSessionOfDay(e.target.value as SessionOfDay)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="morning">Buổi sáng</option>
                <option value="afternoon">Buổi chiều</option>
                <option value="evening">Buổi tối</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="sch-period"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Thứ tự tiết (1 - 12)
              </label>
              <input
                id="sch-period"
                type="number"
                min={1}
                max={12}
                value={periodNumber}
                onChange={(e) => setPeriodNumber(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label
                htmlFor="sch-type"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Phân loại lịch
              </label>
              <select
                id="sch-type"
                value={type}
                onChange={(e) => setType(e.target.value as ScheduleType)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="tutoring">Kèm học tại nhà</option>
                <option value="regular">Chính khóa ở trường</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="sch-subject"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Môn học / Nội dung *
              </label>
              <input
                id="sch-subject"
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="VD: Toán, Tiếng Việt, Kèm 60p..."
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label
                htmlFor="sch-teacher"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Giáo viên / Người hướng dẫn (Tùy chọn)
              </label>
              <input
                id="sch-teacher"
                type="text"
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                placeholder="VD: Cô Thu Hà / Anh Hai"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="sch-start"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  Giờ bắt đầu
                </label>
                <input
                  id="sch-start"
                  type="text"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  placeholder="19:30"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label
                  htmlFor="sch-end"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  Giờ kết thúc
                </label>
                <input
                  id="sch-end"
                  type="text"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  placeholder="20:30"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>
          </div>

          <div>
            <label
              htmlFor="sch-materials"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300"
            >
              Sách vở & Dụng cụ cần chuẩn bị (Hiển thị trong Checklist soạn cặp)
            </label>
            <input
              id="sch-materials"
              type="text"
              value={materialsNote}
              onChange={(e) => setMaterialsNote(e.target.value)}
              placeholder="VD: SGK Toán tập 1, vở ô ly, thước thẳng..."
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
            >
              Đóng
            </button>
            <button
              type="submit"
              className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700"
            >
              Lưu vào thời khóa biểu
            </button>
          </div>
        </form>
      )}

      {/* Lưới Thời khóa biểu theo các thứ trong tuần */}
      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/60" />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ORDERED_DAYS_OF_WEEK.map((dow) => {
            const dayItems = filteredSchedules.filter((s) => s.dayOfWeek === dow);
            return (
              <div
                key={dow}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                    <span className="flex items-center gap-2 text-base font-extrabold text-slate-900 dark:text-white">
                      <Calendar className="h-4 w-4 text-emerald-600" />
                      {DAY_OF_WEEK_LABELS[dow]}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">
                      {dayItems.length} tiết
                    </span>
                  </div>

                  {dayItems.length === 0 ? (
                    <p className="py-6 text-center text-xs text-slate-400">
                      Không có tiết học
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2.5">
                      {dayItems.map((item) => (
                        <li
                          key={item.id}
                          className="group relative rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span
                                className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                                  item.type === 'tutoring'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                                }`}
                              >
                                {SESSION_OF_DAY_LABELS[item.sessionOfDay]} • Tiết{' '}
                                {item.periodNumber} (
                                {item.type === 'tutoring' ? 'Kèm học' : 'Chính khóa'})
                              </span>
                              <div className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                                {item.subject}
                              </div>
                            </div>

                            {isInstructorOrOwner && (
                              <button
                                type="button"
                                onClick={() => void handleDeleteSchedule(item.id)}
                                aria-label={`Xóa tiết ${item.subject}`}
                                className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>

                          {(item.startTime || item.teacherName) && (
                            <div className="mt-1 text-xs text-slate-500">
                              {item.startTime && `${item.startTime} - ${item.endTime}`}{' '}
                              {item.teacherName && `• GV: ${item.teacherName}`}
                            </div>
                          )}

                          {item.materialsNote && (
                            <div className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">
                              <strong>Chuẩn bị:</strong> {item.materialsNote}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quản lý Ngày nghỉ / Ngoại lệ (Không làm đứt chuỗi Streak) */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2.5">
          <CalendarOff className="h-5 w-5 text-amber-500" />
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Ngày nghỉ lễ / Ngoại lệ ({exceptions.length})
            </h2>
            <p className="text-xs text-slate-500">
              Các ngày được đánh dấu nghỉ ngoại lệ sẽ tự động được bỏ qua khi tính chuỗi
              ngày học liên tiếp (không làm đứt Streak của học sinh).
            </p>
          </div>
        </div>

        {isInstructorOrOwner && (
          <form
            onSubmit={(e) => void handleAddException(e)}
            className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div>
              <label
                htmlFor="ex-date-input"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Ngày nghỉ (YYYY-MM-DD)
              </label>
              <input
                id="ex-date-input"
                type="date"
                required
                value={exDate}
                onChange={(e) => setExDate(e.target.value)}
                className="mt-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div className="flex-1">
              <label
                htmlFor="ex-reason-input"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Lý do nghỉ
              </label>
              <input
                id="ex-reason-input"
                type="text"
                required
                value={exReason}
                onChange={(e) => setExReason(e.target.value)}
                placeholder="VD: Nghỉ lễ / Gia đình đi công tác / Em bị ốm..."
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <button
              type="submit"
              className="rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-600"
            >
              Thêm ngày nghỉ
            </button>
          </form>
        )}

        {exceptions.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {exceptions.map((ex) => (
              <div
                key={ex.id}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
              >
                <span>
                  {formatVietnameseDate(ex.date, false)}: {ex.reason}
                </span>
                {isInstructorOrOwner && (
                  <button
                    type="button"
                    onClick={() => void handleDeleteException(ex.id)}
                    aria-label={`Xóa ngày nghỉ ${ex.date}`}
                    className="text-amber-700 hover:text-rose-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

