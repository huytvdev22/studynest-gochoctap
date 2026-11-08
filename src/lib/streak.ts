import type { InstructorReviewStatus, StudentSubmissionStatus } from '@/types/domain';
import { addDaysToDateString, getDayOfWeekFromDateString, isValidDateString } from './date';

export interface MinimalLearningRecord {
  date: string; // YYYY-MM-DD
  studentStatus: StudentSubmissionStatus;
  instructorStatus: InstructorReviewStatus;
  starsAwarded: number;
}

export interface StreakCalculationInput {
  records: MinimalLearningRecord[];
  todayDateStr: string; // YYYY-MM-DD theo múi giờ lớp
  studyDaysOfWeek?: number[]; // Mặc định [1, 2, 3, 4, 5] (Thứ 2 -> Thứ 6)
  dayOffDates?: string[]; // Các ngày nghỉ lễ / ngoại lệ YYYY-MM-DD
}

export interface StudentProgressSummary {
  currentStreak: number;
  longestStreak: number;
  totalStars: number;
  confirmedDaysCount: number;
  confirmedRecordsCount: number;
  pendingConfirmationCount: number;
  confirmedDates: string[]; // Sorted ascending YYYY-MM-DD
  isTodayConfirmed: boolean;
}

/**
 * Kiểm tra xem một ngày YYYY-MM-DD có phải là ngày nghỉ theo cấu hình lớp hoặc lịch ngoại lệ hay không.
 * Lưu ý: Nếu học sinh vẫn học và được xác nhận vào ngày nghỉ, ngày đó vẫn được cộng vào chuỗi streak!
 */
export function isScheduledStudyDay(
  dateStr: string,
  studyDaysOfWeek: number[] = [1, 2, 3, 4, 5],
  dayOffSet: ReadonlySet<string> = new Set()
): boolean {
  if (dayOffSet.has(dateStr)) {
    return false;
  }
  const dow = getDayOfWeekFromDateString(dateStr);
  return studyDaysOfWeek.includes(dow);
}

/**
 * Tính toán tiến độ, tổng số sao và chuỗi ngày học (streak) từ danh sách learningRecords.
 * Quy tắc cốt lõi:
 * 1. Chỉ tính ngày học hợp lệ khi có ít nhất 1 record với `instructorStatus === 'confirmed'`.
 *    Việc học sinh chỉ bấm "Đã làm" (`studentStatus === 'submitted'`, `instructorStatus === 'unverified'`)
 *    TUYỆT ĐỐI KHÔNG làm tăng streak hay số sao.
 * 2. Ngày không có trong `studyDaysOfWeek` (ví dụ cuối tuần) hoặc nằm trong `dayOffDates` (ngày nghỉ lễ)
 *    không làm đứt chuỗi streak.
 * 3. Nếu học sinh học vượt lịch vào ngày nghỉ và được giáo viên xác nhận, ngày đó vẫn được tính +1 vào streak.
 */
export function calculateStudentProgressAndStreak(
  input: StreakCalculationInput
): StudentProgressSummary {
  const {
    records,
    todayDateStr,
    studyDaysOfWeek = [1, 2, 3, 4, 5],
    dayOffDates = [],
  } = input;

  const validStudyDays =
    studyDaysOfWeek.length > 0 ? studyDaysOfWeek : [1, 2, 3, 4, 5, 6, 0];
  const dayOffSet = new Set(dayOffDates.filter(isValidDateString));

  let totalStars = 0;
  let confirmedRecordsCount = 0;
  let pendingConfirmationCount = 0;
  const confirmedDateSet = new Set<string>();

  for (const rec of records) {
    if (!isValidDateString(rec.date)) continue;

    if (rec.instructorStatus === 'confirmed') {
      confirmedRecordsCount += 1;
      totalStars += Math.max(0, Math.floor(rec.starsAwarded || 0));
      confirmedDateSet.add(rec.date);
    } else if (
      rec.studentStatus === 'submitted' &&
      rec.instructorStatus === 'unverified'
    ) {
      pendingConfirmationCount += 1;
    }
  }

  const confirmedDates = Array.from(confirmedDateSet).sort();
  const isTodayConfirmed = confirmedDateSet.has(todayDateStr);

  if (confirmedDates.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalStars,
      confirmedDaysCount: 0,
      confirmedRecordsCount,
      pendingConfirmationCount,
      confirmedDates: [],
      isTodayConfirmed: false,
    };
  }

  // Tính longestStreak bằng cách duyệt từ ngày xác nhận đầu tiên đến ngày cuối cùng
  const firstDate = confirmedDates[0];
  const lastConfirmedDate = confirmedDates[confirmedDates.length - 1];
  const endScanDate =
    lastConfirmedDate > todayDateStr ? lastConfirmedDate : todayDateStr;

  let longestStreak = 0;
  let runningStreak = 0;
  let cursor = firstDate;
  let safetyCounter = 0;

  while (cursor <= endScanDate && safetyCounter < 3650) {
    safetyCounter += 1;
    if (confirmedDateSet.has(cursor)) {
      runningStreak += 1;
      if (runningStreak > longestStreak) {
        longestStreak = runningStreak;
      }
    } else if (isScheduledStudyDay(cursor, validStudyDays, dayOffSet)) {
      // Nếu là ngày có lịch học (và không phải hôm nay đang diễn ra) mà không có xác nhận -> đứt streak
      if (cursor < todayDateStr) {
        runningStreak = 0;
      }
    }
    cursor = addDaysToDateString(cursor, 1);
  }

  // Tính currentStreak lùi từ hôm nay về quá khứ
  let currentStreak = 0;
  let backCursor = todayDateStr;
  let backSafety = 0;

  while (backCursor >= firstDate && backSafety < 3650) {
    backSafety += 1;
    if (confirmedDateSet.has(backCursor)) {
      currentStreak += 1;
    } else if (backCursor === todayDateStr) {
      // Hôm nay chưa được xác nhận thì chưa làm đứt streak của các ngày trước đó
    } else if (isScheduledStudyDay(backCursor, validStudyDays, dayOffSet)) {
      // Bỏ lỡ một ngày học bắt buộc trong quá khứ -> dừng chuỗi hiện tại
      break;
    }
    backCursor = addDaysToDateString(backCursor, -1);
  }

  return {
    currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak),
    totalStars,
    confirmedDaysCount: confirmedDates.length,
    confirmedRecordsCount,
    pendingConfirmationCount,
    confirmedDates,
    isTodayConfirmed,
  };
}

