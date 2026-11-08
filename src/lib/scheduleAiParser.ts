import type { ScheduleType, SessionOfDay } from '@/types/domain';

export interface ParsedScheduleDraft {
  tempId: string;
  dayOfWeek: number; // 0 = CN, 1 = Thứ 2 .. 6 = Thứ 7
  sessionOfDay: SessionOfDay;
  periodNumber: number; // 1..12
  subject: string;
  type: ScheduleType;
  teacherName: string;
  materialsNote: string;
  startTime: string;
  endTime: string;
}

export const AI_TIMETABLE_PROMPT = `Bạn là trợ lý trích xuất dữ liệu Thời khóa biểu học sinh tiểu học.
Hãy đọc hình ảnh thời khóa biểu tôi đính kèm và trả về DUY NHẤT một khối mã JSON (trong cặp dấu \`\`\`json ... \`\`\`) là một mảng các tiết học theo đúng cấu trúc sau:

\`\`\`json
[
  {
    "dayOfWeek": 1,
    "sessionOfDay": "morning",
    "periodNumber": 1,
    "subject": "Toán",
    "type": "regular",
    "teacherName": "",
    "materialsNote": "SGK Toán, vở bài tập Toán, thước kẻ",
    "startTime": "07:30",
    "endTime": "08:05"
  }
]
\`\`\`

Quy tắc bắt buộc khi trích xuất:
1. "dayOfWeek" (kiểu số nguyên):
   - 1 = Thứ Hai
   - 2 = Thứ Ba
   - 3 = Thứ Tư
   - 4 = Thứ Năm
   - 5 = Thứ Sáu
   - 6 = Thứ Bảy
   - 0 = Chủ Nhật
2. "sessionOfDay": chỉ nhận 1 trong 3 giá trị:
   - "morning" (Buổi sáng)
   - "afternoon" (Buổi chiều)
   - "evening" (Buổi tối / học kèm ở nhà)
3. "periodNumber" (kiểu số nguyên từ 1 đến 5): thứ tự tiết trong buổi đó (ví dụ Tiết 1 buổi chiều thì sessionOfDay = "afternoon" và periodNumber = 1; nếu ảnh ghi Tiết 6, 7, 8 của buổi chiều thì quy đổi thành periodNumber 1, 2, 3 của "afternoon").
4. "subject": Tên môn học rõ ràng bằng tiếng Việt (VD: "Toán", "Tiếng Việt", "Tiếng Anh", "Tự nhiên & Xã hội", "Tin học", "Đạo đức", "Giáo dục thể chất", "Âm nhạc", "Mỹ thuật", "Hoạt động trải nghiệm"...). Bỏ qua các ô trống hoặc tiết "Chào cờ / Sinh hoạt" nếu không cần thiết, hoặc giữ lại nếu có trong bảng.
5. "type": "regular" (lịch học chính khóa ở trường) hoặc "tutoring" (lịch học kèm buổi tối tại nhà).
6. "materialsNote": Tự động gợi ý ngắn gọn sách vở/dụng cụ học sinh cần mang theo cho môn đó (VD: "SGK Toán, vở ô ly, thước kẻ").
7. "startTime" và "endTime": Nếu trên ảnh có ghi giờ thì lấy theo ảnh, nếu không có thì điền giờ chuẩn:
   - Sáng: Tiết 1 (07:30-08:05), Tiết 2 (08:15-08:50), Tiết 3 (09:05-09:40), Tiết 4 (09:50-10:25), Tiết 5 (10:30-11:05)
   - Chiều: Tiết 1 (14:00-14:35), Tiết 2 (14:45-15:20), Tiết 3 (15:35-16:10)
   - Tối: Tiết 1 (19:30-20:30)

Chỉ trả về khối \`\`\`json ... \`\`\`, không cần giải thích dài dòng.`;

const DEFAULT_SLOT_TIMES: Record<
  SessionOfDay,
  Record<number, { start: string; end: string }>
> = {
  morning: {
    1: { start: '07:30', end: '08:05' },
    2: { start: '08:15', end: '08:50' },
    3: { start: '09:05', end: '09:40' },
    4: { start: '09:50', end: '10:25' },
    5: { start: '10:30', end: '11:05' },
  },
  afternoon: {
    1: { start: '14:00', end: '14:35' },
    2: { start: '14:45', end: '15:20' },
    3: { start: '15:35', end: '16:10' },
  },
  evening: {
    1: { start: '19:30', end: '20:30' },
    2: { start: '20:30', end: '20:50' },
  },
};

function normalizeDayOfWeek(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isInteger(raw)) {
    if (raw >= 0 && raw <= 6) return raw;
    if (raw === 7 || raw === 8) return 0; // Chủ nhật
  }
  if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase();
    if (s === '0' || s === 'cn' || s.includes('chủ nhật') || s.includes('chu nhat') || s === 'sunday') {
      return 0;
    }
    if (s === '1' || s === 't2' || s.includes('thứ hai') || s.includes('thu hai') || s.includes('thứ 2') || s === 'monday') {
      return 1;
    }
    if (s === '2' || s === 't3' || s.includes('thứ ba') || s.includes('thu ba') || s.includes('thứ 3') || s === 'tuesday') {
      return 2;
    }
    if (s === '3' || s === 't4' || s.includes('thứ tư') || s.includes('thu tu') || s.includes('thứ 4') || s === 'wednesday') {
      return 3;
    }
    if (s === '4' || s === 't5' || s.includes('thứ năm') || s.includes('thu nam') || s.includes('thứ 5') || s === 'thursday') {
      return 4;
    }
    if (s === '5' || s === 't6' || s.includes('thứ sáu') || s.includes('thu sau') || s.includes('thứ 6') || s === 'friday') {
      return 5;
    }
    if (s === '6' || s === 't7' || s.includes('thứ bảy') || s.includes('thu bay') || s.includes('thứ 7') || s === 'saturday') {
      return 6;
    }
  }
  return null;
}

function normalizeSessionOfDay(raw: unknown): SessionOfDay {
  if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase();
    if (s === 'afternoon' || s.includes('chiều') || s.includes('chieu')) {
      return 'afternoon';
    }
    if (s === 'evening' || s.includes('tối') || s.includes('toi')) {
      return 'evening';
    }
  }
  return 'morning';
}

function defaultMaterialsForSubject(subject: string): string {
  const s = subject.toLowerCase();
  if (s.includes('toán')) return 'SGK Toán, vở bài tập Toán, thước kẻ';
  if (s.includes('tiếng việt') || s.includes('chính tả') || s.includes('tập làm văn')) {
    return 'SGK Tiếng Việt, vở chính tả, vở bài tập';
  }
  if (s.includes('tiếng anh') || s.includes('anh')) {
    return 'Sách Tiếng Anh, vở từ vựng';
  }
  if (s.includes('tự nhiên') || s.includes('khoa học')) {
    return 'SGK Tự nhiên & Xã hội';
  }
  if (s.includes('tin học') || s.includes('công nghệ')) {
    return 'SGK Tin học & Công nghệ';
  }
  if (s.includes('thể chất') || s.includes('thể dục')) {
    return 'Đồng phục thể dục, giày thể thao, bình nước';
  }
  if (s.includes('mỹ thuật') || s.includes('vẽ')) {
    return 'Vở vẽ, hộp bút màu';
  }
  if (s.includes('đạo đức')) {
    return 'SGK Đạo đức';
  }
  return '';
}

/**
 * Trích xuất và chuẩn hóa danh sách tiết học từ văn bản trả về của AI (có thể chứa ```json ... ``` hoặc JSON thuần).
 */
export function parseScheduleJsonFromAiResponse(rawText: string): {
  items: ParsedScheduleDraft[];
  error?: string;
} {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { items: [], error: 'Vui lòng dán nội dung JSON do AI trả về.' };
  }

  // 1. Ưu tiên bóc nội dung bên trong codeblock ```json ... ``` hoặc ``` ... ```
  let jsonCandidate = trimmed;
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    jsonCandidate = codeBlockMatch[1].trim();
  } else {
    // Nếu không có codeblock, tìm dấu '[' đầu tiên đến ']' cuối cùng
    const firstBracket = trimmed.indexOf('[');
    const lastBracket = trimmed.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      jsonCandidate = trimmed.slice(firstBracket, lastBracket + 1);
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonCandidate);
  } catch {
    return {
      items: [],
      error:
        'Không đọc được định dạng JSON. Hãy đảm bảo bạn đã copy đúng khối ```json ... ``` mà AI trả về.',
    };
  }

  const rawList: unknown[] = Array.isArray(parsed)
    ? parsed
    : parsed &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as Record<string, unknown>).schedules)
    ? ((parsed as Record<string, unknown>).schedules as unknown[])
    : [];

  if (rawList.length === 0) {
    return {
      items: [],
      error: 'JSON hợp lệ nhưng không chứa tiết học nào (mảng rỗng).',
    };
  }

  const results: ParsedScheduleDraft[] = [];

  rawList.forEach((entry, idx) => {
    if (!entry || typeof entry !== 'object') return;
    const obj = entry as Record<string, unknown>;

    const subject =
      typeof obj.subject === 'string' ? obj.subject.trim() : '';
    if (!subject) return;

    const dow = normalizeDayOfWeek(obj.dayOfWeek);
    if (dow === null) return;

    let sessionOfDay = normalizeSessionOfDay(obj.sessionOfDay);
    let periodNumber = Number(obj.periodNumber) || 1;

    // Nếu AI trả về tiết 6, 7, 8 (ở buổi sáng hoặc buổi chiều) thì tự động quy đổi sang tiết 1, 2, 3 buổi chiều
    if (
      (sessionOfDay === 'morning' || sessionOfDay === 'afternoon') &&
      periodNumber >= 6 &&
      periodNumber <= 10
    ) {
      sessionOfDay = 'afternoon';
      periodNumber = periodNumber - 5;
    }
    periodNumber = Math.min(12, Math.max(1, Math.round(periodNumber)));

    const type: ScheduleType =
      obj.type === 'tutoring' || sessionOfDay === 'evening'
        ? 'tutoring'
        : 'regular';

    const fallbackTime = DEFAULT_SLOT_TIMES[sessionOfDay]?.[periodNumber] || {
      start: sessionOfDay === 'morning' ? '07:30' : sessionOfDay === 'afternoon' ? '14:00' : '19:30',
      end: sessionOfDay === 'morning' ? '08:05' : sessionOfDay === 'afternoon' ? '14:35' : '20:30',
    };

    const startTime =
      typeof obj.startTime === 'string' && obj.startTime.trim()
        ? obj.startTime.trim()
        : fallbackTime.start;
    const endTime =
      typeof obj.endTime === 'string' && obj.endTime.trim()
        ? obj.endTime.trim()
        : fallbackTime.end;

    const materialsNote =
      typeof obj.materialsNote === 'string' && obj.materialsNote.trim()
        ? obj.materialsNote.trim()
        : defaultMaterialsForSubject(subject);

    const teacherName =
      typeof obj.teacherName === 'string' ? obj.teacherName.trim() : '';

    results.push({
      tempId: `draft_${idx}_${dow}_${sessionOfDay}_${periodNumber}`,
      dayOfWeek: dow,
      sessionOfDay,
      periodNumber,
      subject,
      type,
      teacherName,
      materialsNote,
      startTime,
      endTime,
    });
  });

  if (results.length === 0) {
    return {
      items: [],
      error:
        'Không tìm thấy tiết học hợp lệ nào trong JSON (thiếu trường subject hoặc dayOfWeek).',
    };
  }

  return { items: results };
}
