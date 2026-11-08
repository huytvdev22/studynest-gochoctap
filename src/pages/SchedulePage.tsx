import React, { useCallback, useEffect, useState } from 'react';
import {
  Backpack,
  CalendarOff,
  Check,
  CheckSquare,
  Clock,
  Edit3,
  Plus,
  Sparkles,
  Square,
  Trash2,
  X,
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
  DAY_OF_WEEK_SHORT_LABELS,
  formatVietnameseDate,
  getTodayAndTomorrow,
  ORDERED_DAYS_OF_WEEK,
} from '@/lib/date';

interface TimeSlotRow {
  sessionOfDay: SessionOfDay;
  periodNumber: number;
  label: string;
  defaultStart: string;
  defaultEnd: string;
  defaultType: ScheduleType;
}

const OUTLOOK_TIME_SLOTS: TimeSlotRow[] = [
  // Buổi sáng
  {
    sessionOfDay: 'morning',
    periodNumber: 1,
    label: 'Sáng • Tiết 1',
    defaultStart: '07:30',
    defaultEnd: '08:05',
    defaultType: 'regular',
  },
  {
    sessionOfDay: 'morning',
    periodNumber: 2,
    label: 'Sáng • Tiết 2',
    defaultStart: '08:15',
    defaultEnd: '08:50',
    defaultType: 'regular',
  },
  {
    sessionOfDay: 'morning',
    periodNumber: 3,
    label: 'Sáng • Tiết 3',
    defaultStart: '09:05',
    defaultEnd: '09:40',
    defaultType: 'regular',
  },
  {
    sessionOfDay: 'morning',
    periodNumber: 4,
    label: 'Sáng • Tiết 4',
    defaultStart: '09:50',
    defaultEnd: '10:25',
    defaultType: 'regular',
  },
  {
    sessionOfDay: 'morning',
    periodNumber: 5,
    label: 'Sáng • Tiết 5',
    defaultStart: '10:30',
    defaultEnd: '11:05',
    defaultType: 'regular',
  },
  // Buổi chiều
  {
    sessionOfDay: 'afternoon',
    periodNumber: 1,
    label: 'Chiều • Tiết 1',
    defaultStart: '14:00',
    defaultEnd: '14:35',
    defaultType: 'regular',
  },
  {
    sessionOfDay: 'afternoon',
    periodNumber: 2,
    label: 'Chiều • Tiết 2',
    defaultStart: '14:45',
    defaultEnd: '15:20',
    defaultType: 'regular',
  },
  {
    sessionOfDay: 'afternoon',
    periodNumber: 3,
    label: 'Chiều • Tiết 3',
    defaultStart: '15:35',
    defaultEnd: '16:10',
    defaultType: 'regular',
  },
  // Buổi tối (Góc học tập tại nhà)
  {
    sessionOfDay: 'evening',
    periodNumber: 1,
    label: 'Tối • Ca 1 (60p)',
    defaultStart: '19:30',
    defaultEnd: '20:30',
    defaultType: 'tutoring',
  },
  {
    sessionOfDay: 'evening',
    periodNumber: 2,
    label: 'Tối • Ca 2 (Soạn cặp)',
    defaultStart: '20:30',
    defaultEnd: '20:50',
    defaultType: 'tutoring',
  },
];

const QUICK_SUBJECT_PRESETS: Array<{
  subject: string;
  materials: string;
  colorClass: string;
  type?: ScheduleType;
}> = [
  {
    subject: 'Toán',
    materials: 'SGK Toán 3, vở bài tập Toán, thước kẻ',
    colorClass: 'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950/70 dark:text-sky-200 dark:border-sky-800',
  },
  {
    subject: 'Tiếng Việt',
    materials: 'SGK Tiếng Việt 3, vở chính tả, vở Tập làm văn',
    colorClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-800',
  },
  {
    subject: 'Tiếng Anh',
    materials: 'Sách Tiếng Anh Global Success 3, vở từ vựng',
    colorClass: 'bg-violet-100 text-violet-900 border-violet-300 dark:bg-violet-950/70 dark:text-violet-200 dark:border-violet-800',
  },
  {
    subject: 'Tự nhiên & Xã hội',
    materials: 'SGK Tự nhiên & Xã hội 3',
    colorClass: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-800',
  },
  {
    subject: 'Tin học & Công nghệ',
    materials: 'SGK Tin học & Công nghệ 3',
    colorClass: 'bg-cyan-100 text-cyan-900 border-cyan-300 dark:bg-cyan-950/70 dark:text-cyan-200 dark:border-cyan-800',
  },
  {
    subject: 'Đạo đức',
    materials: 'SGK Đạo đức 3',
    colorClass: 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/70 dark:text-rose-200 dark:border-rose-800',
  },
  {
    subject: 'Mỹ thuật / Âm nhạc',
    materials: 'Vở vẽ, hộp bút màu / SGK Âm nhạc',
    colorClass: 'bg-pink-100 text-pink-900 border-pink-300 dark:bg-pink-950/70 dark:text-pink-200 dark:border-pink-800',
  },
  {
    subject: 'Giáo dục thể chất',
    materials: 'Đồng phục thể dục, giày thể thao, bình nước',
    colorClass: 'bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950/70 dark:text-orange-200 dark:border-orange-800',
  },
  {
    subject: 'Kèm Toán & Tiếng Việt (60p)',
    materials: 'Vở ô ly rèn chữ, vở bài tập Toán, bút mực',
    colorClass: 'bg-emerald-600 text-white border-emerald-700',
    type: 'tutoring',
  },
];

function getSubjectCardColor(subject: string, type: ScheduleType): string {
  if (type === 'tutoring') {
    return 'border-emerald-300 bg-emerald-50/90 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100';
  }
  const lower = subject.toLowerCase();
  if (lower.includes('toán')) {
    return 'border-sky-300 bg-sky-50/90 text-sky-950 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-100';
  }
  if (lower.includes('việt') || lower.includes('văn') || lower.includes('chính tả')) {
    return 'border-teal-300 bg-teal-50/90 text-teal-950 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-100';
  }
  if (lower.includes('anh')) {
    return 'border-violet-300 bg-violet-50/90 text-violet-950 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-100';
  }
  if (lower.includes('tự nhiên') || lower.includes('khoa học')) {
    return 'border-amber-300 bg-amber-50/90 text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100';
  }
  return 'border-slate-300 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
}

interface ActiveCellState {
  dayOfWeek: number;
  slot: TimeSlotRow;
  existingItem?: ScheduleItem;
}

export function SchedulePage() {
  const { user } = useAuth();
  const { studyClass, isInstructorOrOwner } = useClassContext();

  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [exceptions, setExceptions] = useState<ScheduleException[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<'all' | ScheduleType>('all');

  // Chế độ "Cọ điền nhanh 1 chạm" (Quick Stamp): Chọn môn ở trên rồi bấm vào ô bất kỳ để điền ngay
  const [quickStampSubject, setQuickStampSubject] = useState<{
    subject: string;
    materials: string;
    type?: ScheduleType;
  } | null>(null);

  // Ô đang được click để thêm/sửa trực tiếp giống Outlook Calendar
  const [activeCell, setActiveCell] = useState<ActiveCellState | null>(null);
  const [cellSubject, setCellSubject] = useState<string>('');
  const [cellMaterials, setCellMaterials] = useState<string>('');
  const [cellTeacher, setCellTeacher] = useState<string>('');
  const [cellStart, setCellStart] = useState<string>('');
  const [cellEnd, setCellEnd] = useState<string>('');
  const [cellType, setCellType] = useState<ScheduleType>('regular');
  const [savingCell, setSavingCell] = useState<boolean>(false);

  // Checklist chuẩn bị sách vở ngày mai
  const [packedItems, setPackedItems] = useState<Record<string, boolean>>({});

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

  const { todayDayOfWeek, tomorrow, tomorrowDayOfWeek } = getTodayAndTomorrow(
    new Date(),
    studyClass.timezone
  );

  const tomorrowItems = schedules.filter(
    (s) => s.dayOfWeek === tomorrowDayOfWeek
  );

  const filteredSchedules = schedules.filter((s) =>
    filterType === 'all' ? true : s.type === filterType
  );

  // Mở popup chỉnh sửa/thêm nhanh ngay khi bấm vào một ô trên lịch tuần
  const handleCellClick = async (
    dayOfWeek: number,
    slot: TimeSlotRow,
    existingItem?: ScheduleItem
  ) => {
    if (!isInstructorOrOwner) return;

    // Nếu đang bật "Chế độ điền nhanh 1 chạm" (Quick Stamp) và bấm vào ô
    if (quickStampSubject && !existingItem) {
      setSavingCell(true);
      try {
        await saveScheduleItem(studyClass.id, user.uid, {
          dayOfWeek,
          sessionOfDay: slot.sessionOfDay,
          periodNumber: slot.periodNumber,
          subject: quickStampSubject.subject,
          type: quickStampSubject.type || slot.defaultType,
          teacherName: '',
          materialsNote: quickStampSubject.materials,
          startTime: slot.defaultStart,
          endTime: slot.defaultEnd,
        });
        await loadScheduleData();
      } finally {
        setSavingCell(false);
      }
      return;
    }

    setActiveCell({ dayOfWeek, slot, existingItem });
    setCellSubject(existingItem?.subject || '');
    setCellMaterials(existingItem?.materialsNote || '');
    setCellTeacher(existingItem?.teacherName || '');
    setCellStart(existingItem?.startTime || slot.defaultStart);
    setCellEnd(existingItem?.endTime || slot.defaultEnd);
    setCellType(existingItem?.type || slot.defaultType);
  };

  // Lưu ngay khi chọn 1 chip môn học trong popup hoặc bấm Lưu
  const handleSaveCell = async (
    e?: React.FormEvent,
    overridePreset?: { subject: string; materials: string; type?: ScheduleType }
  ) => {
    if (e) e.preventDefault();
    if (!activeCell) return;

    const finalSubject = (overridePreset?.subject ?? cellSubject).trim();
    if (!finalSubject) return;

    const finalMaterials =
      overridePreset && !cellMaterials.trim()
        ? overridePreset.materials
        : cellMaterials.trim();
    const finalType = overridePreset?.type || cellType;

    setSavingCell(true);
    try {
      await saveScheduleItem(studyClass.id, user.uid, {
        id: activeCell.existingItem?.id,
        dayOfWeek: activeCell.dayOfWeek,
        sessionOfDay: activeCell.slot.sessionOfDay,
        periodNumber: activeCell.slot.periodNumber,
        subject: finalSubject,
        type: finalType,
        teacherName: cellTeacher.trim(),
        materialsNote: finalMaterials,
        startTime: cellStart.trim(),
        endTime: cellEnd.trim(),
      });
      setActiveCell(null);
      await loadScheduleData();
    } finally {
      setSavingCell(false);
    }
  };

  const handleDeleteSchedule = async (
    scheduleId: string,
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();
    setSavingCell(true);
    try {
      await deleteScheduleItem(studyClass.id, scheduleId);
      if (activeCell?.existingItem?.id === scheduleId) {
        setActiveCell(null);
      }
      await loadScheduleData();
    } finally {
      setSavingCell(false);
    }
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
    <div className="space-y-6">
      {/* Thanh công cụ Điền nhanh 1 chạm (Giống lịch tuần Outlook + Gợi ý môn tiểu học) */}
      {isInstructorOrOwner && (
        <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                  Lịch tuần trực quan (Bấm trực tiếp vào bất kỳ ô trống nào trên bảng để thêm tiết học)
                </h2>
                <p className="text-xs text-slate-500">
                  Mẹo: Chọn một <strong>Thẻ môn học điền nhanh</strong> bên dưới rồi click liên tiếp vào các ô trên bảng để xếp thời khóa biểu chỉ trong vài giây!
                </p>
              </div>
            </div>

            {quickStampSubject && (
              <button
                type="button"
                onClick={() => setQuickStampSubject(null)}
                className="inline-flex items-center gap-1.5 self-start rounded-xl bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-800 hover:bg-rose-200 dark:bg-rose-950 dark:text-rose-200"
              >
                <X className="h-3.5 w-3.5" />
                Tắt cọ điền nhanh ({quickStampSubject.subject})
              </button>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 mr-1">
              Cọ điền nhanh 1 chạm:
            </span>
            {QUICK_SUBJECT_PRESETS.map((preset) => {
              const isSelected =
                quickStampSubject?.subject === preset.subject;
              return (
                <button
                  key={preset.subject}
                  type="button"
                  onClick={() =>
                    setQuickStampSubject(isSelected ? null : preset)
                  }
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                    isSelected
                      ? 'ring-2 ring-slate-900 ring-offset-2 scale-105 shadow-xs dark:ring-white ' +
                        preset.colorClass
                      : preset.colorClass + ' opacity-85 hover:opacity-100'
                  }`}
                >
                  {isSelected && <Check className="h-3.5 w-3.5" />}
                  {preset.subject}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Bộ lọc hiển thị */}
      <div className="flex flex-wrap items-center justify-between gap-3">
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

        <div className="text-xs text-slate-500">
          {quickStampSubject ? (
            <span className="font-bold text-emerald-700 dark:text-emerald-400">
              👉 Đang chọn cọ “{quickStampSubject.subject}” – Hãy bấm vào các ô trống bên dưới để điền ngay!
            </span>
          ) : (
            <span>Bấm vào ô bất kỳ để thêm hoặc sửa môn học</span>
          )}
        </div>
      </div>

      {/* BẢNG LỊCH TUẦN KIỂU OUTLOOK CALENDAR (7 CỘT THỨ x CÁC HÀNG TIẾT HỌC) */}
      {loading ? (
        <div className="h-96 animate-pulse rounded-3xl bg-slate-200/70 dark:bg-slate-800/60" />
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full min-w-[920px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90 dark:border-slate-800 dark:bg-slate-800/60">
                <th className="w-36 border-r border-slate-200 px-3 py-3.5 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  Tiết / Khung giờ
                </th>
                {ORDERED_DAYS_OF_WEEK.map((dow) => {
                  const isToday = dow === todayDayOfWeek;
                  const isTomorrow = dow === tomorrowDayOfWeek;
                  return (
                    <th
                      key={dow}
                      className={`border-r border-slate-200 px-3 py-3 text-center last:border-r-0 dark:border-slate-800 ${
                        isToday
                          ? 'bg-emerald-50/90 dark:bg-emerald-950/40'
                          : ''
                      }`}
                    >
                      <div className="flex flex-col items-center">
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                          {DAY_OF_WEEK_LABELS[dow]}
                        </span>
                        {isToday && (
                          <span className="mt-0.5 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                            Hôm nay
                          </span>
                        )}
                        {!isToday && isTomorrow && (
                          <span className="mt-0.5 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                            Ngày mai
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {OUTLOOK_TIME_SLOTS.map((slot, slotIdx) => {
                const prevSession =
                  slotIdx > 0
                    ? OUTLOOK_TIME_SLOTS[slotIdx - 1].sessionOfDay
                    : null;
                const isNewSection = prevSession !== slot.sessionOfDay;

                const sectionBannerTitle =
                  slot.sessionOfDay === 'morning'
                    ? '☀️ BUỔI SÁNG (Lịch học trên trường / ở nhà)'
                    : slot.sessionOfDay === 'afternoon'
                    ? '🌤️ BUỔI CHIỀU'
                    : '🌙 BUỔI TỐI – GÓC HỌC TẬP 60 PHÚT TẠI NHÀ';

                return (
                  <React.Fragment
                    key={`${slot.sessionOfDay}_${slot.periodNumber}`}
                  >
                    {isNewSection && (
                      <tr className="bg-slate-100/80 dark:bg-slate-800/80">
                        <td
                          colSpan={8}
                          className="px-4 py-1.5 text-[11px] font-extrabold tracking-wider text-slate-600 dark:text-slate-300"
                        >
                          {sectionBannerTitle}
                        </td>
                      </tr>
                    )}

                    <tr className="group/row hover:bg-slate-50/40 dark:hover:bg-slate-800/20">
                      {/* Cột nhãn Tiết & Giờ */}
                      <td className="border-r border-slate-200 bg-slate-50/40 px-3 py-2.5 align-top dark:border-slate-800 dark:bg-slate-900/50">
                        <div className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                          {slot.label}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                          <Clock className="h-3 w-3" />
                          {slot.defaultStart} - {slot.defaultEnd}
                        </div>
                      </td>

                      {/* 7 Ô tương ứng Thứ Hai -> Chủ Nhật */}
                      {ORDERED_DAYS_OF_WEEK.map((dow) => {
                        const cellItems = filteredSchedules.filter(
                          (item) =>
                            item.dayOfWeek === dow &&
                            item.sessionOfDay === slot.sessionOfDay &&
                            item.periodNumber === slot.periodNumber
                        );
                        const primaryItem = cellItems[0];
                        const isToday = dow === todayDayOfWeek;

                        return (
                          <td
                            key={dow}
                            onClick={() =>
                              void handleCellClick(dow, slot, primaryItem)
                            }
                            className={`relative h-20 min-w-[115px] border-r border-slate-200 p-1.5 align-top transition last:border-r-0 dark:border-slate-800 ${
                              isInstructorOrOwner ? 'cursor-pointer' : ''
                            } ${
                              isToday
                                ? 'bg-emerald-50/20 dark:bg-emerald-950/10'
                                : ''
                            } ${
                              !primaryItem && isInstructorOrOwner
                                ? 'hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30'
                                : ''
                            }`}
                          >
                            {primaryItem ? (
                              <div
                                className={`group/card relative flex h-full flex-col justify-between rounded-xl border p-2 shadow-2xs transition hover:shadow-md ${getSubjectCardColor(
                                  primaryItem.subject,
                                  primaryItem.type
                                )}`}
                              >
                                <div>
                                  <div className="flex items-start justify-between gap-1">
                                    <span className="text-xs font-extrabold leading-tight">
                                      {primaryItem.subject}
                                    </span>

                                    {isInstructorOrOwner && (
                                      <button
                                        type="button"
                                        onClick={(e) =>
                                          void handleDeleteSchedule(
                                            primaryItem.id,
                                            e
                                          )
                                        }
                                        title="Xóa tiết học này"
                                        className="opacity-0 group-hover/card:opacity-100 rounded-md p-0.5 text-slate-500 hover:bg-rose-100 hover:text-rose-700 transition"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </div>

                                  {primaryItem.materialsNote && (
                                    <p className="mt-1 line-clamp-2 text-[10px] opacity-80 leading-snug">
                                      🎒 {primaryItem.materialsNote}
                                    </p>
                                  )}
                                </div>

                                <div className="mt-1 flex items-center justify-between text-[10px] opacity-70">
                                  <span>
                                    {primaryItem.startTime || slot.defaultStart}
                                  </span>
                                  {primaryItem.teacherName && (
                                    <span className="truncate max-w-[65px]">
                                      {primaryItem.teacherName}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              isInstructorOrOwner && (
                                <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-transparent opacity-0 transition group-hover/row:border-slate-200 hover:!border-emerald-400 hover:!opacity-100 dark:group-hover/row:border-slate-800">
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                    <Plus className="h-3.5 w-3.5" />
                                    {quickStampSubject
                                      ? quickStampSubject.subject
                                      : 'Thêm'}
                                  </span>
                                </div>
                              )
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Hộp thoại nhỏ (Quick Popover Modal) khi click trực tiếp vào 1 ô trên lịch tuần */}
      {isInstructorOrOwner && activeCell && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <span className="rounded-lg bg-emerald-100 px-2.5 py-0.5 text-xs font-extrabold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {DAY_OF_WEEK_LABELS[activeCell.dayOfWeek]} •{' '}
                  {activeCell.slot.label}
                </span>
                <h3 className="mt-1.5 text-base font-extrabold text-slate-900 dark:text-white">
                  {activeCell.existingItem
                    ? 'Chỉnh sửa tiết học'
                    : 'Chọn nhanh hoặc nhập môn học'}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setActiveCell(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 1-Click chọn môn học phổ biến (Bấm là lưu luôn!) */}
            <div className="mt-4">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                ⚡ Chạm 1 lần để điền nhanh môn học vào ô này:
              </span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {QUICK_SUBJECT_PRESETS.map((preset) => (
                  <button
                    key={preset.subject}
                    type="button"
                    disabled={savingCell}
                    onClick={() => void handleSaveCell(undefined, preset)}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition hover:scale-105 ${preset.colorClass}`}
                  >
                    {preset.subject}
                  </button>
                ))}
              </div>
            </div>

            <form
              onSubmit={(e) => void handleSaveCell(e)}
              className="mt-4 space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800"
            >
              <div>
                <label
                  htmlFor="cell-subject-input"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  Hoặc tự nhập tên môn / nội dung *
                </label>
                <input
                  id="cell-subject-input"
                  type="text"
                  required
                  autoFocus
                  value={cellSubject}
                  onChange={(e) => setCellSubject(e.target.value)}
                  placeholder="Nhập tên môn rồi nhấn Enter..."
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="cell-materials-input"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  Sách vở & dụng cụ cần mang (Hiện ở Checklist soạn cặp)
                </label>
                <input
                  id="cell-materials-input"
                  type="text"
                  value={cellMaterials}
                  onChange={(e) => setCellMaterials(e.target.value)}
                  placeholder="VD: SGK Toán 3, vở bài tập, thước kẻ..."
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label
                    htmlFor="cell-start-input"
                    className="block text-[11px] font-bold text-slate-600 dark:text-slate-400"
                  >
                    Bắt đầu
                  </label>
                  <input
                    id="cell-start-input"
                    type="text"
                    value={cellStart}
                    onChange={(e) => setCellStart(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label
                    htmlFor="cell-end-input"
                    className="block text-[11px] font-bold text-slate-600 dark:text-slate-400"
                  >
                    Kết thúc
                  </label>
                  <input
                    id="cell-end-input"
                    type="text"
                    value={cellEnd}
                    onChange={(e) => setCellEnd(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label
                    htmlFor="cell-type-input"
                    className="block text-[11px] font-bold text-slate-600 dark:text-slate-400"
                  >
                    Loại lịch
                  </label>
                  <select
                    id="cell-type-input"
                    value={cellType}
                    onChange={(e) => setCellType(e.target.value as ScheduleType)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="regular">Ở trường</option>
                    <option value="tutoring">Kèm tại nhà</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="cell-teacher-input"
                  className="block text-[11px] font-bold text-slate-600 dark:text-slate-400"
                >
                  Giáo viên / Người hướng dẫn (Tùy chọn)
                </label>
                <input
                  id="cell-teacher-input"
                  type="text"
                  value={cellTeacher}
                  onChange={(e) => setCellTeacher(e.target.value)}
                  placeholder="VD: Cô Thu Hà / Anh Hai"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="flex items-center justify-between pt-3">
                {activeCell.existingItem ? (
                  <button
                    type="button"
                    onClick={() =>
                      void handleDeleteSchedule(activeCell.existingItem!.id)
                    }
                    className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Xóa tiết này
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveCell(null)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    disabled={savingCell}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    {savingCell ? 'Đang lưu...' : 'Lưu vào ô'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Checklist Ngày mai học gì & Chuẩn bị sách vở */}
      <section className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-6 shadow-xs dark:border-emerald-900/50 dark:bg-emerald-950/20">
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
              Tự động tổng hợp từ cột <strong>{DAY_OF_WEEK_SHORT_LABELS[tomorrowDayOfWeek]}</strong> trên bảng lịch tuần. Đánh dấu từng môn sau khi đã chuẩn bị xong sách vở.
            </p>
          </div>
        </div>

        {tomorrowItems.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-white/80 p-4 text-sm text-slate-600 dark:bg-slate-900/70 dark:text-slate-300">
            Ngày mai ({DAY_OF_WEEK_LABELS[tomorrowDayOfWeek]}) chưa có tiết học nào. Hãy bấm trực tiếp vào cột <strong>{DAY_OF_WEEK_LABELS[tomorrowDayOfWeek]}</strong> trên bảng lịch phía trên để thêm môn học!
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
                    <span
                      className={`text-sm font-bold ${
                        checked
                          ? 'line-through text-slate-500'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      Tiết {item.periodNumber}: {item.subject}
                    </span>
                    {item.materialsNote && (
                      <div className="mt-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                        🎒 {item.materialsNote}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Quản lý Ngày nghỉ / Ngoại lệ */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2.5">
          <CalendarOff className="h-5 w-5 text-amber-500" />
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Ngày nghỉ lễ / Ngoại lệ ({exceptions.length})
            </h2>
            <p className="text-xs text-slate-500">
              Các ngày được đánh dấu nghỉ ngoại lệ sẽ tự động được bỏ qua khi tính chuỗi ngày học liên tiếp (không làm đứt Streak của học sinh).
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
                Ngày nghỉ
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
