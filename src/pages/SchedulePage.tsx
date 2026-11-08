import React, { useCallback, useEffect, useState } from 'react';
import {
  Backpack,
  Bot,
  CalendarOff,
  Check,
  CheckSquare,
  ClipboardPaste,
  CloudSun,
  Copy,
  Edit3,
  Eye,
  Moon,
  Plus,
  Sparkles,
  Square,
  Sun,
  Trash2,
  X,
  Zap,
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
import {
  AI_TIMETABLE_PROMPT,
  parseScheduleJsonFromAiResponse,
  type ParsedScheduleDraft,
} from '@/lib/scheduleAiParser';

interface TimeSlotRow {
  sessionOfDay: SessionOfDay;
  periodNumber: number;
  label: string;
  defaultType: ScheduleType;
}

const OUTLOOK_TIME_SLOTS: TimeSlotRow[] = [
  // Buổi sáng (5 tiết)
  {
    sessionOfDay: 'morning',
    periodNumber: 1,
    label: 'Sáng • Tiết 1',
    defaultType: 'regular',
  },
  {
    sessionOfDay: 'morning',
    periodNumber: 2,
    label: 'Sáng • Tiết 2',
    defaultType: 'regular',
  },
  {
    sessionOfDay: 'morning',
    periodNumber: 3,
    label: 'Sáng • Tiết 3',
    defaultType: 'regular',
  },
  {
    sessionOfDay: 'morning',
    periodNumber: 4,
    label: 'Sáng • Tiết 4',
    defaultType: 'regular',
  },
  {
    sessionOfDay: 'morning',
    periodNumber: 5,
    label: 'Sáng • Tiết 5',
    defaultType: 'regular',
  },
  // Buổi chiều (5 tiết)
  {
    sessionOfDay: 'afternoon',
    periodNumber: 1,
    label: 'Chiều • Tiết 1',
    defaultType: 'regular',
  },
  {
    sessionOfDay: 'afternoon',
    periodNumber: 2,
    label: 'Chiều • Tiết 2',
    defaultType: 'regular',
  },
  {
    sessionOfDay: 'afternoon',
    periodNumber: 3,
    label: 'Chiều • Tiết 3',
    defaultType: 'regular',
  },
  {
    sessionOfDay: 'afternoon',
    periodNumber: 4,
    label: 'Chiều • Tiết 4',
    defaultType: 'regular',
  },
  {
    sessionOfDay: 'afternoon',
    periodNumber: 5,
    label: 'Chiều • Tiết 5',
    defaultType: 'regular',
  },
  // Buổi tối (Góc học tập tại nhà - không ghi giờ cố định)
  {
    sessionOfDay: 'evening',
    periodNumber: 1,
    label: 'Tối • Tiết 1 (Học bài)',
    defaultType: 'tutoring',
  },
  {
    sessionOfDay: 'evening',
    periodNumber: 2,
    label: 'Tối • Tiết 2 (Soạn cặp)',
    defaultType: 'tutoring',
  },
];

interface SubjectBrushItem {
  subject: string;
  materials: string;
  teacherName: string;
  colorClass: string;
  type: ScheduleType;
  count: number;
}

const SUBJECT_COLOR_PALETTE: string[] = [
  'border-sky-300 bg-sky-50/95 text-sky-950 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-100',
  'border-emerald-300 bg-emerald-50/95 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-100',
  'border-violet-300 bg-violet-50/95 text-violet-950 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-100',
  'border-amber-300 bg-amber-50/95 text-amber-950 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-100',
  'border-cyan-300 bg-cyan-50/95 text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-100',
  'border-rose-300 bg-rose-50/95 text-rose-950 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-100',
  'border-pink-300 bg-pink-50/95 text-pink-950 dark:border-pink-800 dark:bg-pink-950/60 dark:text-pink-100',
  'border-orange-300 bg-orange-50/95 text-orange-950 dark:border-orange-800 dark:bg-orange-950/60 dark:text-orange-100',
  'border-indigo-300 bg-indigo-50/95 text-indigo-950 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-100',
  'border-teal-300 bg-teal-50/95 text-teal-950 dark:border-teal-800 dark:bg-teal-950/60 dark:text-teal-100',
];

function getSubjectCardColor(subject: string, type: ScheduleType): string {
  const lower = subject.trim().toLowerCase();
  if (lower.includes('toán')) return SUBJECT_COLOR_PALETTE[0];
  if (
    lower.includes('việt') ||
    lower.includes('văn') ||
    lower.includes('chính tả')
  ) {
    return SUBJECT_COLOR_PALETTE[1];
  }
  if (lower.includes('anh')) return SUBJECT_COLOR_PALETTE[2];
  if (lower.includes('tự nhiên') || lower.includes('khoa học')) {
    return SUBJECT_COLOR_PALETTE[3];
  }
  if (lower.includes('tin học') || lower.includes('công nghệ')) {
    return SUBJECT_COLOR_PALETTE[4];
  }
  if (lower.includes('đạo đức') || lower.includes('đời sống')) {
    return SUBJECT_COLOR_PALETTE[5];
  }
  if (lower.includes('mỹ thuật') || lower.includes('âm nhạc') || lower.includes('nghệ thuật')) {
    return SUBJECT_COLOR_PALETTE[6];
  }
  if (lower.includes('thể chất') || lower.includes('thể dục')) {
    return SUBJECT_COLOR_PALETTE[7];
  }
  if (lower.includes('trải nghiệm') || lower.includes('thực hành')) {
    return SUBJECT_COLOR_PALETTE[8];
  }
  if (lower.includes('đọc sách') || lower.includes('thư viện')) {
    return SUBJECT_COLOR_PALETTE[9];
  }
  if (type === 'tutoring') {
    return SUBJECT_COLOR_PALETTE[1];
  }

  let hash = 0;
  for (let i = 0; i < lower.length; i += 1) {
    hash = (hash * 31 + lower.charCodeAt(i)) >>> 0;
  }
  return SUBJECT_COLOR_PALETTE[hash % SUBJECT_COLOR_PALETTE.length];
}

function deriveSubjectBrushesFromSchedules(
  schedules: ScheduleItem[]
): SubjectBrushItem[] {
  const map = new Map<string, SubjectBrushItem>();

  for (const item of schedules) {
    const cleanSubject = item.subject.trim();
    if (!cleanSubject) continue;
    const key = cleanSubject.toLowerCase();
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        subject: cleanSubject,
        materials: item.materialsNote?.trim() || '',
        teacherName: item.teacherName?.trim() || '',
        colorClass: getSubjectCardColor(cleanSubject, item.type),
        type: item.type,
        count: 1,
      });
    } else {
      existing.count += 1;
      if (!existing.materials && item.materialsNote?.trim()) {
        existing.materials = item.materialsNote.trim();
      }
      if (!existing.teacherName && item.teacherName?.trim()) {
        existing.teacherName = item.teacherName.trim();
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

const SAMPLE_AI_RESPONSE = `\`\`\`json
[
  {
    "dayOfWeek": 1,
    "sessionOfDay": "morning",
    "periodNumber": 1,
    "subject": "Toán",
    "type": "regular",
    "teacherName": "Cô Thu Hà",
    "materialsNote": "SGK Toán 3, vở bài tập Toán, thước kẻ"
  },
  {
    "dayOfWeek": 1,
    "sessionOfDay": "morning",
    "periodNumber": 2,
    "subject": "Tiếng Việt",
    "type": "regular",
    "teacherName": "Cô Thu Hà",
    "materialsNote": "SGK Tiếng Việt 3, vở chính tả"
  },
  {
    "dayOfWeek": 2,
    "sessionOfDay": "morning",
    "periodNumber": 1,
    "subject": "Tiếng Anh",
    "type": "regular",
    "teacherName": "Thầy Nam",
    "materialsNote": "Sách Tiếng Anh Global Success 3, vở từ vựng"
  },
  {
    "dayOfWeek": 3,
    "sessionOfDay": "afternoon",
    "periodNumber": 1,
    "subject": "Tin học & Công nghệ",
    "type": "regular",
    "teacherName": "",
    "materialsNote": "SGK Tin học & Công nghệ 3"
  }
]
\`\`\``;

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

  // Bộ lọc theo môn học trong Thời khóa biểu
  const [filterSubject, setFilterSubject] = useState<string | null>(null);

  // Ô đang được click để thêm/sửa trực tiếp giống Outlook Calendar
  const [activeCell, setActiveCell] = useState<ActiveCellState | null>(null);
  const [cellSubject, setCellSubject] = useState<string>('');
  const [cellMaterials, setCellMaterials] = useState<string>('');
  const [cellTeacher, setCellTeacher] = useState<string>('');
  const [cellType, setCellType] = useState<ScheduleType>('regular');
  const [savingCell, setSavingCell] = useState<boolean>(false);

  // Modal Nhập TKB từ Ảnh qua AI (Copy Prompt -> Dán JSON -> Preview & Edit -> Lưu)
  const [showAiImportModal, setShowAiImportModal] = useState<boolean>(false);
  const [promptCopied, setPromptCopied] = useState<boolean>(false);
  const [showPromptDetail, setShowPromptDetail] = useState<boolean>(false);
  const [rawAiInput, setRawAiInput] = useState<string>('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [previewDrafts, setPreviewDrafts] = useState<ParsedScheduleDraft[]>([]);
  const [replaceAllExisting, setReplaceAllExisting] = useState<boolean>(false);
  const [importingBulk, setImportingBulk] = useState<boolean>(false);

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

  const filteredSchedules = schedules.filter((s) => {
    if (filterType !== 'all' && s.type !== filterType) return false;
    if (
      filterSubject &&
      s.subject.trim().toLowerCase() !== filterSubject.toLowerCase()
    ) {
      return false;
    }
    return true;
  });

  // Danh sách môn học được tổng hợp trực tiếp từ các môn hiện có trong Thời khóa biểu
  const subjectBrushes = deriveSubjectBrushesFromSchedules(schedules);

  // Mở popup chỉnh sửa/thêm nhanh ngay khi bấm vào một ô trên lịch tuần
  const handleCellClick = (
    dayOfWeek: number,
    slot: TimeSlotRow,
    existingItem?: ScheduleItem
  ) => {
    if (!isInstructorOrOwner) return;

    setActiveCell({ dayOfWeek, slot, existingItem });
    setCellSubject(existingItem?.subject || '');
    setCellMaterials(existingItem?.materialsNote || '');
    setCellTeacher(existingItem?.teacherName || '');
    setCellType(existingItem?.type || slot.defaultType);
  };

  const handleSaveCell = async (
    e?: React.FormEvent,
    overrideBrush?: SubjectBrushItem
  ) => {
    if (e) e.preventDefault();
    if (!activeCell) return;

    const finalSubject = (overrideBrush?.subject ?? cellSubject).trim();
    if (!finalSubject) return;

    const finalMaterials =
      overrideBrush && !cellMaterials.trim()
        ? overrideBrush.materials
        : cellMaterials.trim();
    const finalTeacher =
      overrideBrush && !cellTeacher.trim()
        ? overrideBrush.teacherName
        : cellTeacher.trim();
    const finalType = overrideBrush?.type || cellType;

    setSavingCell(true);
    try {
      await saveScheduleItem(studyClass.id, user.uid, {
        id: activeCell.existingItem?.id,
        dayOfWeek: activeCell.dayOfWeek,
        sessionOfDay: activeCell.slot.sessionOfDay,
        periodNumber: activeCell.slot.periodNumber,
        subject: finalSubject,
        type: finalType,
        teacherName: finalTeacher,
        materialsNote: finalMaterials,
        startTime: '',
        endTime: '',
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

  // =========================================================================
  // Xử lý Copy Prompt AI -> Parse JSON -> Preview & Edit -> Lưu hàng loạt
  // =========================================================================
  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(AI_TIMETABLE_PROMPT);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2500);
    } catch {
      setShowPromptDetail(true);
    }
  };

  const handleParseAiResponse = (customText?: string) => {
    setParseError(null);
    const source = customText !== undefined ? customText : rawAiInput;
    const { items, error } = parseScheduleJsonFromAiResponse(source);
    if (error) {
      setParseError(error);
      return;
    }
    setPreviewDrafts(items);
  };

  const handleUpdateDraftField = <K extends keyof ParsedScheduleDraft>(
    tempId: string,
    field: K,
    value: ParsedScheduleDraft[K]
  ) => {
    setPreviewDrafts((prev) =>
      prev.map((d) => (d.tempId === tempId ? { ...d, [field]: value } : d))
    );
  };

  const handleRemoveDraftRow = (tempId: string) => {
    setPreviewDrafts((prev) => prev.filter((d) => d.tempId !== tempId));
  };

  const handleAddBlankDraftRow = () => {
    setPreviewDrafts((prev) => [
      ...prev,
      {
        tempId: `draft_manual_${Date.now()}`,
        dayOfWeek: 1,
        sessionOfDay: 'morning',
        periodNumber: 1,
        subject: 'Toán',
        type: 'regular',
        teacherName: '',
        materialsNote: 'SGK Toán, vở bài tập',
        startTime: '',
        endTime: '',
      },
    ]);
  };

  const handleSaveAllPreviewDrafts = async () => {
    if (previewDrafts.length === 0) return;
    setImportingBulk(true);
    setParseError(null);
    try {
      if (replaceAllExisting) {
        for (const existing of schedules) {
          await deleteScheduleItem(studyClass.id, existing.id);
        }
      }

      for (const draft of previewDrafts) {
        if (!draft.subject.trim()) continue;
        // Tìm xem đã có tiết học nào trùng Thứ + Buổi + Tiết chưa để cập nhật đè vào đúng ô đó
        const matchingSlotItem = !replaceAllExisting
          ? schedules.find(
              (s) =>
                s.dayOfWeek === draft.dayOfWeek &&
                s.sessionOfDay === draft.sessionOfDay &&
                s.periodNumber === draft.periodNumber
            )
          : undefined;

        await saveScheduleItem(studyClass.id, user.uid, {
          id: matchingSlotItem?.id,
          dayOfWeek: draft.dayOfWeek,
          sessionOfDay: draft.sessionOfDay,
          periodNumber: draft.periodNumber,
          subject: draft.subject.trim(),
          type: draft.type,
          teacherName: draft.teacherName.trim(),
          materialsNote: draft.materialsNote.trim(),
          startTime: draft.startTime.trim(),
          endTime: draft.endTime.trim(),
        });
      }

      setShowAiImportModal(false);
      setPreviewDrafts([]);
      setRawAiInput('');
      await loadScheduleData();
    } catch (err: unknown) {
      setParseError(
        err instanceof Error
          ? err.message
          : 'Có lỗi khi lưu danh sách tiết học.'
      );
    } finally {
      setImportingBulk(false);
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
      {/* Thanh công cụ Nhập từ Ảnh bằng AI + Bộ lọc theo môn học */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        {isInstructorOrOwner && (
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-slate-100 pb-3.5 mb-3.5 dark:border-slate-800">
            <div className="flex items-start gap-2.5">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                  Lịch tuần trực quan (Bấm trực tiếp vào ô trên bảng hoặc Nhập tự động từ ảnh chụp TKB)
                </h2>
                <p className="text-xs text-slate-500">
                  Bấm vào ô bất kỳ trên bảng để thêm/sửa tiết học, hoặc dùng công cụ <strong>Nhập TKB từ ảnh bằng AI</strong> để nhập cả tuần cùng lúc.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopyPrompt}
                className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-2 text-xs font-extrabold text-violet-900 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-200"
              >
                {promptCopied ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-600" />
                    Đã Copy Prompt cho AI!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 text-violet-600" />
                    Copy Prompt gửi kèm ảnh TKB
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowAiImportModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-extrabold text-white shadow-xs hover:bg-violet-700"
              >
                <Bot className="h-4 w-4" />
                Dán JSON từ AI & Preview
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500 mr-1">
            Lọc theo môn học ({subjectBrushes.length} môn):
          </span>
          {subjectBrushes.length === 0 ? (
            <span className="text-xs italic text-slate-400">
              Chưa có môn học nào trong lịch.
            </span>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setFilterSubject(null)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                  filterSubject === null
                    ? 'border-slate-900 bg-slate-900 text-white shadow-xs dark:border-white dark:bg-white dark:text-slate-900'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                Tất cả môn
              </button>

              {subjectBrushes.map((brush) => {
                const isSelected =
                  filterSubject?.toLowerCase() ===
                  brush.subject.toLowerCase();
                return (
                  <button
                    key={brush.subject}
                    type="button"
                    onClick={() =>
                      setFilterSubject(isSelected ? null : brush.subject)
                    }
                    title={`Lọc môn ${brush.subject} (${brush.count} tiết)`}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                      isSelected
                        ? 'ring-2 ring-slate-900 ring-offset-2 scale-105 shadow-xs dark:ring-white ' +
                          brush.colorClass
                        : brush.colorClass + ' opacity-85 hover:opacity-100'
                    }`}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5" />}
                    <span>{brush.subject}</span>
                    <span className="rounded-md bg-black/10 px-1.5 py-0.2 text-[10px] font-extrabold dark:bg-white/15">
                      {brush.count}
                    </span>
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>

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
          {filterSubject ? (
            <span className="inline-flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-400">
              <span>Đang lọc môn: “{filterSubject}”</span>
              <button
                type="button"
                onClick={() => setFilterSubject(null)}
                className="underline hover:text-rose-600"
              >
                Bỏ lọc
              </button>
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
                  Buổi / Tiết
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

                const sectionBanner =
                  slot.sessionOfDay === 'morning' ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Sun className="h-3.5 w-3.5 text-amber-500" />
                      BUỔI SÁNG (5 tiết)
                    </span>
                  ) : slot.sessionOfDay === 'afternoon' ? (
                    <span className="inline-flex items-center gap-1.5">
                      <CloudSun className="h-3.5 w-3.5 text-amber-600" />
                      BUỔI CHIỀU (5 tiết)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <Moon className="h-3.5 w-3.5 text-sky-500" />
                      BUỔI TỐI – GÓC HỌC TẬP TẠI NHÀ
                    </span>
                  );

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
                          {sectionBanner}
                        </td>
                      </tr>
                    )}

                    <tr className="group/row hover:bg-slate-50/40 dark:hover:bg-slate-800/20">
                      <td className="border-r border-slate-200 bg-slate-50/40 px-3 py-3 align-middle dark:border-slate-800 dark:bg-slate-900/50">
                        <div className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                          {slot.label}
                        </div>
                      </td>

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
                            className={`relative h-16 min-w-[115px] border-r border-slate-200 p-1.5 align-top transition last:border-r-0 dark:border-slate-800 ${
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
                                </div>

                                {primaryItem.teacherName && (
                                  <div className="mt-1 flex items-center justify-end text-[10px] opacity-70">
                                    <span className="truncate max-w-[90px]">
                                      {primaryItem.teacherName}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              isInstructorOrOwner && (
                                <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-transparent opacity-0 transition group-hover/row:border-slate-200 hover:!border-emerald-400 hover:!opacity-100 dark:group-hover/row:border-slate-800">
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                    <Plus className="h-3.5 w-3.5" />
                                    Thêm
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

      {/* MODAL 1: Hộp thoại nhỏ khi click trực tiếp vào 1 ô trên lịch tuần */}
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

            {subjectBrushes.length > 0 && (
              <div className="mt-4">
                <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <Zap className="h-3 w-3 text-amber-500" />
                  Chọn nhanh môn có sẵn trong thời khóa biểu ({subjectBrushes.length} môn):
                </span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {subjectBrushes.map((brush) => (
                    <button
                      key={brush.subject}
                      type="button"
                      disabled={savingCell}
                      onClick={() => void handleSaveCell(undefined, brush)}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition hover:scale-105 ${brush.colorClass}`}
                    >
                      {brush.subject}
                    </button>
                  ))}
                </div>
              </div>
            )}

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

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="regular">Ở trường</option>
                    <option value="tutoring">Kèm tại nhà</option>
                  </select>
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

      {/* MODAL 2: Nhập Thời khóa biểu từ Ảnh chụp thông qua AI (Copy Prompt -> Dán JSON -> Preview & Edit -> Lưu) */}
      {isInstructorOrOwner && showAiImportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-ai-import-title"
        >
          <div className="my-8 w-full max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[92vh] overflow-y-auto space-y-5">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-sm">
                  <Bot className="h-6 w-6" />
                </div>
                <div>
                  <h2
                    id="modal-ai-import-title"
                    className="text-lg font-extrabold text-slate-900 dark:text-white"
                  >
                    Nhập Thời khóa biểu từ Ảnh chụp bằng công cụ AI
                  </h2>
                  <p className="text-xs text-slate-500">
                    Bước 1: Copy câu lệnh mẫu gửi kèm ảnh TKB cho ChatGPT/Gemini • Bước 2: Dán kết quả JSON vào đây • Bước 3: Kiểm tra & Lưu
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAiImportModal(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* BƯỚC 1: COPY PROMPT */}
            <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900/50 dark:bg-violet-950/20">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-violet-800 dark:text-violet-300">
                    Bước 1: Copy câu lệnh (Prompt) và gửi kèm ảnh chụp TKB vào ChatGPT / Gemini / Claude
                  </span>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                    Câu lệnh đã định nghĩa sẵn cấu trúc JSON chuẩn của StudyNest để AI trả về chính xác Thứ, Buổi, Tiết và gợi ý sách vở.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPromptDetail((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-xl border border-violet-300 bg-white px-3 py-1.5 text-xs font-bold text-violet-800 hover:bg-violet-100 dark:border-violet-700 dark:bg-slate-900 dark:text-violet-200"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {showPromptDetail ? 'Ẩn câu lệnh' : 'Xem câu lệnh'}
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleCopyPrompt()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-1.5 text-xs font-extrabold text-white hover:bg-violet-700"
                  >
                    {promptCopied ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> Đã Copy Prompt!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> Copy Prompt
                      </>
                    )}
                  </button>
                </div>
              </div>

              {showPromptDetail && (
                <pre className="mt-3 max-h-44 overflow-y-auto whitespace-pre-wrap rounded-xl border border-violet-200 bg-white p-3 font-mono text-[11px] text-slate-700 dark:border-violet-800 dark:bg-slate-900 dark:text-slate-200">
                  {AI_TIMETABLE_PROMPT}
                </pre>
              )}
            </div>

            {/* BƯỚC 2: DÁN KẾT QUẢ JSON TỪ AI */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="ai-json-textarea"
                  className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                >
                  Bước 2: Dán câu trả lời của AI (Hỗ trợ cả khối ```json ... ``` hoặc JSON thuần)
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setRawAiInput(SAMPLE_AI_RESPONSE);
                    handleParseAiResponse(SAMPLE_AI_RESPONSE);
                  }}
                  className="text-xs font-bold text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  + Thử với dữ liệu JSON mẫu
                </button>
              </div>

              <textarea
                id="ai-json-textarea"
                rows={4}
                value={rawAiInput}
                onChange={(e) => setRawAiInput(e.target.value)}
                placeholder={'Dán nguyên đoạn codeblock ```json [ ... ] ``` mà ChatGPT / Gemini trả về vào đây...'}
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 p-3.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => handleParseAiResponse()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-extrabold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
                >
                  <ClipboardPaste className="h-3.5 w-3.5" />
                  Đọc dữ liệu & Hiển thị bảng Preview
                </button>
              </div>

              {parseError && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200"
                >
                  {parseError}
                </div>
              )}
            </div>

            {/* BƯỚC 3: BẢNG PREVIEW, CHỈNH SỬA TRỰC TIẾP & LƯU */}
            {previewDrafts.length > 0 && (
              <div className="space-y-4 border-t border-slate-200 pt-4 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                      Bước 3: Xem trước & Chỉnh sửa ({previewDrafts.length} tiết học)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Bạn có thể sửa trực tiếp Thứ, Buổi, Tiết, Tên môn hoặc Sách vở ngay trên bảng dưới đây trước khi bấm Lưu.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddBlankDraftRow}
                    className="inline-flex items-center gap-1 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Thêm 1 dòng
                  </button>
                </div>

                <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="sticky top-0 bg-slate-100 text-[11px] font-extrabold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      <tr>
                        <th className="p-2.5">Thứ</th>
                        <th className="p-2.5">Buổi</th>
                        <th className="p-2.5 w-16">Tiết</th>
                        <th className="p-2.5">Môn học *</th>
                        <th className="p-2.5">Sách vở chuẩn bị</th>
                        <th className="p-2.5 w-28">Phân loại</th>
                        <th className="p-2.5 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {previewDrafts.map((draft) => (
                        <tr
                          key={draft.tempId}
                          className="bg-white hover:bg-slate-50/80 dark:bg-slate-900"
                        >
                          <td className="p-2">
                            <select
                              aria-label="Thứ"
                              value={draft.dayOfWeek}
                              onChange={(e) =>
                                handleUpdateDraftField(
                                  draft.tempId,
                                  'dayOfWeek',
                                  Number(e.target.value)
                                )
                              }
                              className="rounded-lg border border-slate-300 bg-white px-2 py-1 font-bold dark:border-slate-700 dark:bg-slate-800"
                            >
                              {ORDERED_DAYS_OF_WEEK.map((d) => (
                                <option key={d} value={d}>
                                  {DAY_OF_WEEK_LABELS[d]}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="p-2">
                            <select
                              aria-label="Buổi"
                              value={draft.sessionOfDay}
                              onChange={(e) =>
                                handleUpdateDraftField(
                                  draft.tempId,
                                  'sessionOfDay',
                                  e.target.value as SessionOfDay
                                )
                              }
                              className="rounded-lg border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-800"
                            >
                              <option value="morning">Sáng</option>
                              <option value="afternoon">Chiều</option>
                              <option value="evening">Tối</option>
                            </select>
                          </td>

                          <td className="p-2">
                            <input
                              type="number"
                              aria-label="Tiết"
                              min={1}
                              max={10}
                              value={draft.periodNumber}
                              onChange={(e) =>
                                handleUpdateDraftField(
                                  draft.tempId,
                                  'periodNumber',
                                  Number(e.target.value)
                                )
                              }
                              className="w-14 rounded-lg border border-slate-300 bg-white px-2 py-1 text-center font-bold dark:border-slate-700 dark:bg-slate-800"
                            />
                          </td>

                          <td className="p-2">
                            <input
                              type="text"
                              aria-label="Tên môn học"
                              value={draft.subject}
                              onChange={(e) =>
                                handleUpdateDraftField(
                                  draft.tempId,
                                  'subject',
                                  e.target.value
                                )
                              }
                              className="w-full min-w-[120px] rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-bold dark:border-slate-700 dark:bg-slate-800"
                            />
                          </td>

                          <td className="p-2">
                            <input
                              type="text"
                              aria-label="Sách vở"
                              value={draft.materialsNote}
                              onChange={(e) =>
                                handleUpdateDraftField(
                                  draft.tempId,
                                  'materialsNote',
                                  e.target.value
                                )
                              }
                              placeholder="SGK, vở..."
                              className="w-full min-w-[150px] rounded-lg border border-slate-300 bg-white px-2.5 py-1 dark:border-slate-700 dark:bg-slate-800"
                            />
                          </td>

                          <td className="p-2">
                            <select
                              aria-label="Phân loại"
                              value={draft.type}
                              onChange={(e) =>
                                handleUpdateDraftField(
                                  draft.tempId,
                                  'type',
                                  e.target.value as ScheduleType
                                )
                              }
                              className="rounded-lg border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-800"
                            >
                              <option value="regular">Ở trường</option>
                              <option value="tutoring">Kèm tại nhà</option>
                            </select>
                          </td>

                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveDraftRow(draft.tempId)}
                              aria-label="Xóa dòng này"
                              className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={replaceAllExisting}
                      onChange={(e) => setReplaceAllExisting(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600"
                    />
                    <span>
                      Xóa toàn bộ thời khóa biểu cũ trước khi lưu danh sách mới này
                    </span>
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAiImportModal(false)}
                      className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      disabled={importingBulk}
                      onClick={() => void handleSaveAllPreviewDrafts()}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs sm:text-sm font-extrabold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" />
                      {importingBulk
                        ? 'Đang lưu vào Thời khóa biểu...'
                        : `Lưu tất cả ${previewDrafts.length} tiết học`}
                    </button>
                  </div>
                </div>
              </div>
            )}
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
                      <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                        <Backpack className="h-3 w-3 text-emerald-600 shrink-0" />
                        <span>{item.materialsNote}</span>
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
