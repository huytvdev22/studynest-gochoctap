const SAFE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TOKEN_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Tạo chuỗi token ngẫu nhiên đủ mạnh (mặc định 24 ký tự ~ 142 bits entropy) bằng Web Crypto API.
 */
export function generateRandomToken(length = 24): string {
  const randomBytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(randomBytes);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += TOKEN_ALPHABET[randomBytes[i] % TOKEN_ALPHABET.length];
  }
  return out;
}

/**
 * Tạo mã tham gia lớp gồm 6 ký tự chữ hoa + số rõ ràng (loại bỏ 0/O, 1/I để học sinh/phụ huynh dễ nhập).
 */
export function generateJoinCode(length = 6): string {
  const randomBytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(randomBytes);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += SAFE_ALPHABET[randomBytes[i] % SAFE_ALPHABET.length];
  }
  return out;
}

/**
 * Chuẩn hóa mã tham gia do người dùng nhập (trim + uppercase).
 */
export function normalizeJoinCode(rawCode: string): string {
  return rawCode.trim().toUpperCase();
}

/**
 * Tính SHA-256 hex chữ thường cho `${invitationId}:${normalizedCode}`.
 * Khớp chính xác với biểu thức trong firestore.rules:
 * `hashing.sha256((invitationId + ':' + submittedCode).toUtf8()).toHexString().lower()`
 */
export async function computeInvitationCodeHash(
  invitationId: string,
  joinCode: string
): Promise<string> {
  const normalized = normalizeJoinCode(joinCode);
  const payload = `${invitationId}:${normalized}`;
  const encoded = new TextEncoder().encode(payload);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Đóng gói classId và invitationId vào một chuỗi URL token duy nhất `/join/:token`
 * để trang tham gia lớp có thể truy vấn trực tiếp `getDoc` tới `classes/{classId}/invitations/{invitationId}`
 * mà không cần quyền `list` toàn cục.
 */
export function encodeCompositeInviteToken(
  classId: string,
  invitationId: string
): string {
  return `${classId}.${invitationId}`;
}

/**
 * Giải mã chuỗi token trên URL `/join/:token` thành `{ classId, invitationId }`.
 */
export function decodeCompositeInviteToken(
  compositeToken: string
): { classId: string; invitationId: string } | null {
  const trimmed = compositeToken.trim();
  const dotIdx = trimmed.indexOf('.');
  if (dotIdx <= 0 || dotIdx >= trimmed.length - 1) {
    return null;
  }
  const classId = trimmed.slice(0, dotIdx);
  const invitationId = trimmed.slice(dotIdx + 1);
  if (!/^[a-zA-Z0-9_-]{4,64}$/.test(classId)) return null;
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(invitationId)) return null;
  return { classId, invitationId };
}

