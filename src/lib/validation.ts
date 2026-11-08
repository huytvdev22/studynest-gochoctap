import type { ClassThemeColor, ClassThemeIcon, SessionChecklistItem } from '@/types/domain';
import { isValidDateString } from './date';

export const ALLOWED_CLASS_COLORS: ClassThemeColor[] = [
  'emerald',
  'sky',
  'amber',
  'violet',
  'rose',
];

export const ALLOWED_CLASS_ICONS: ClassThemeIcon[] = [
  'book-open',
  'star',
  'compass',
  'sparkles',
  'graduation-cap',
];

export const DEFAULT_SESSION_CHECKLIST: SessionChecklistItem[] = [
  {
    id: 'step-review',
    label: 'Kiểm tra bài cũ & ôn từ khóa hôm trước',
    durationMinutes: 15,
    completed: false,
  },
  {
    id: 'step-new-lesson',
    label: 'Học bài mới & làm bài tập thực hành',
    durationMinutes: 30,
    completed: false,
  },
  {
    id: 'step-pack-bag',
    label: 'Soạn cặp sách vở theo thời khóa biểu ngày mai',
    durationMinutes: 10,
    completed: false,
  },
  {
    id: 'step-wrap-up',
    label: 'Tổng kết buổi học, nhận xét & thưởng sao',
    durationMinutes: 5,
    completed: false,
  },
];

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateClassInput(input: {
  name: string;
  description: string;
  color: ClassThemeColor;
  icon: ClassThemeIcon;
  studyDaysOfWeek: number[];
}): ValidationResult {
  const name = input.name.trim();
  const description = input.description.trim();

  if (name.length < 2 || name.length > 100) {
    return { valid: false, error: 'Tên lớp cần từ 2 đến 100 ký tự.' };
  }
  if (description.length > 500) {
    return { valid: false, error: 'Mô tả lớp không vượt quá 500 ký tự.' };
  }
  if (!ALLOWED_CLASS_COLORS.includes(input.color)) {
    return { valid: false, error: 'Màu chủ đề không hợp lệ.' };
  }
  if (!ALLOWED_CLASS_ICONS.includes(input.icon)) {
    return { valid: false, error: 'Biểu tượng lớp không hợp lệ.' };
  }
  if (
    !Array.isArray(input.studyDaysOfWeek) ||
    input.studyDaysOfWeek.length < 1 ||
    input.studyDaysOfWeek.length > 7 ||
    input.studyDaysOfWeek.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
  ) {
    return {
      valid: false,
      error: 'Vui lòng chọn ít nhất 1 ngày học cố định trong tuần.',
    };
  }
  return { valid: true };
}

export function validateLessonInput(input: {
  title: string;
  subject: string;
  goal: string;
  explanation: string;
  resourceUrl?: string;
}): ValidationResult {
  const title = input.title.trim();
  const subject = input.subject.trim();

  if (title.length < 2 || title.length > 150) {
    return { valid: false, error: 'Tiêu đề bài học cần từ 2 đến 150 ký tự.' };
  }
  if (subject.length < 1 || subject.length > 80) {
    return { valid: false, error: 'Môn học cần từ 1 đến 80 ký tự.' };
  }
  if (input.goal.trim().length > 500) {
    return { valid: false, error: 'Mục tiêu bài học tối đa 500 ký tự.' };
  }
  if (input.explanation.trim().length > 10000) {
    return { valid: false, error: 'Nội dung giải thích tối đa 10.000 ký tự.' };
  }
  if (input.resourceUrl && input.resourceUrl.trim().length > 0) {
    try {
      const url = new URL(input.resourceUrl.trim());
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return { valid: false, error: 'Link tài liệu chỉ hỗ trợ http hoặc https.' };
      }
    } catch {
      return { valid: false, error: 'Link tài liệu không đúng định dạng URL.' };
    }
  }
  return { valid: true };
}

export function validateSessionInput(input: {
  title: string;
  date: string;
  durationMinutes: number;
}): ValidationResult {
  if (input.title.trim().length < 2 || input.title.trim().length > 150) {
    return { valid: false, error: 'Tiêu đề buổi học cần từ 2 đến 150 ký tự.' };
  }
  if (!isValidDateString(input.date)) {
    return { valid: false, error: 'Ngày buổi học không hợp lệ (YYYY-MM-DD).' };
  }
  if (
    !Number.isInteger(input.durationMinutes) ||
    input.durationMinutes < 5 ||
    input.durationMinutes > 300
  ) {
    return {
      valid: false,
      error: 'Thời lượng buổi học cần nằm trong khoảng 5 đến 300 phút.',
    };
  }
  return { valid: true };
}

export function validateAssignmentInput(input: {
  title: string;
  dueDate: string;
  starsReward: number;
  assignedStudentUids: string[];
}): ValidationResult {
  if (input.title.trim().length < 2 || input.title.trim().length > 150) {
    return { valid: false, error: 'Tiêu đề nhiệm vụ cần từ 2 đến 150 ký tự.' };
  }
  if (!isValidDateString(input.dueDate)) {
    return { valid: false, error: 'Hạn hoàn thành không hợp lệ (YYYY-MM-DD).' };
  }
  if (
    !Number.isInteger(input.starsReward) ||
    input.starsReward < 1 ||
    input.starsReward > 10
  ) {
    return { valid: false, error: 'Số sao thưởng phải từ 1 đến 10.' };
  }
  if (!Array.isArray(input.assignedStudentUids) || input.assignedStudentUids.length === 0) {
    return { valid: false, error: 'Cần chọn ít nhất một học sinh hoặc Cả lớp.' };
  }
  return { valid: true };
}

