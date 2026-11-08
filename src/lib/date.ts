export const DEFAULT_CLASS_TIMEZONE = 'Asia/Ho_Chi_Minh';

export const DAY_OF_WEEK_LABELS: Record<number, string> = {
  1: 'Thứ Hai',
  2: 'Thứ Ba',
  3: 'Thứ Tư',
  4: 'Thứ Năm',
  5: 'Thứ Sáu',
  6: 'Thứ Bảy',
  0: 'Chủ Nhật',
};

export const DAY_OF_WEEK_SHORT_LABELS: Record<number, string> = {
  1: 'T2',
  2: 'T3',
  3: 'T4',
  4: 'T5',
  5: 'T6',
  6: 'T7',
  0: 'CN',
};

export const ORDERED_DAYS_OF_WEEK = [1, 2, 3, 4, 5, 6, 0] as const;

/**
 * Chuyển một đối tượng Date thành chuỗi YYYY-MM-DD theo múi giờ chỉ định (mặc định Asia/Ho_Chi_Minh).
 */
export function formatDateInTimezone(
  date: Date = new Date(),
  timezone: string = DEFAULT_CLASS_TIMEZONE
): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

/**
 * Kiểm tra chuỗi có đúng định dạng YYYY-MM-DD hợp lệ hay không.
 */
export function isValidDateString(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  return (
    utc.getUTCFullYear() === y &&
    utc.getUTCMonth() === m - 1 &&
    utc.getUTCDate() === d
  );
}

/**
 * Trả về thứ trong tuần (0 = Chủ nhật .. 6 = Thứ bảy) của một chuỗi ngày YYYY-MM-DD.
 */
export function getDayOfWeekFromDateString(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  return utc.getUTCDay();
}

/**
 * Cộng hoặc trừ số ngày từ chuỗi YYYY-MM-DD, trả về YYYY-MM-DD mới.
 */
export function addDaysToDateString(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const year = utc.getUTCFullYear();
  const month = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const day = String(utc.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Trả về ngày hôm nay (YYYY-MM-DD) và ngày mai (YYYY-MM-DD) theo múi giờ lớp.
 */
export function getTodayAndTomorrow(
  now: Date = new Date(),
  timezone: string = DEFAULT_CLASS_TIMEZONE
): { today: string; tomorrow: string; todayDayOfWeek: number; tomorrowDayOfWeek: number } {
  const today = formatDateInTimezone(now, timezone);
  const tomorrow = addDaysToDateString(today, 1);
  return {
    today,
    tomorrow,
    todayDayOfWeek: getDayOfWeekFromDateString(today),
    tomorrowDayOfWeek: getDayOfWeekFromDateString(tomorrow),
  };
}

/**
 * Định dạng hiển thị tiếng Việt thân thiện từ YYYY-MM-DD, ví dụ: "Thứ Bảy, 07/11/2026".
 */
export function formatVietnameseDate(dateStr: string, includeWeekday = true): string {
  if (!isValidDateString(dateStr)) return dateStr;
  const [y, m, d] = dateStr.split('-');
  const formatted = `${d}/${m}/${y}`;
  if (!includeWeekday) return formatted;
  const dow = getDayOfWeekFromDateString(dateStr);
  return `${DAY_OF_WEEK_LABELS[dow]}, ${formatted}`;
}

