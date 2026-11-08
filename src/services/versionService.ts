/**
 * Dịch vụ Quản lý Phiên bản, Kiểm tra Bản cập nhật và Xóa Cache Ứng dụng (StudyNest)
 * Đảm bảo ứng dụng luôn nhận code mới nhất sau khi deploy và giải phóng triệt để cache cũ của trình duyệt.
 */

export interface AppVersionInfo {
  version: string;
  commitHash: string;
  buildTime: string;
  formattedBuildTime: string;
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentHash: string;
  remoteHash: string;
  remoteVersion?: string;
  remoteBuildTime?: string;
  remoteFormattedBuildTime?: string;
}

/**
 * Định dạng thời gian build theo giờ Việt Nam (GMT+7, múi giờ Asia/Ho_Chi_Minh)
 * Ví dụ: 19:30:45 08/11/2026
 */
export function formatBuildTime(isoString: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour12: false,
    }).format(d);
  } catch {
    return isoString;
  }
}

/**
 * Lấy thông tin phiên bản hiện tại đang chạy trong ứng dụng
 */
export function getCurrentVersionInfo(): AppVersionInfo {
  const version =
    typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.0';
  const commitHash =
    typeof __COMMIT_HASH__ !== 'undefined' ? __COMMIT_HASH__ : 'dev';
  const buildTime =
    typeof __BUILD_TIME__ !== 'undefined'
      ? __BUILD_TIME__
      : new Date().toISOString();

  return {
    version,
    commitHash,
    buildTime,
    formattedBuildTime: formatBuildTime(buildTime),
  };
}

/**
 * Kiểm tra xem có bản cập nhật mới trên server hay không
 * - Yêu cầu tệp version.json độc lập với cache-control: no-cache
 * - Kích hoạt cập nhật Service Worker nếu trình duyệt hỗ trợ
 */
export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const current = getCurrentVersionInfo();

  // Kích hoạt kiểm tra Service Worker mới trong nền nếu trình duyệt có hỗ trợ
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.update();
      }
    } catch (swErr) {
      console.warn('Lỗi kiểm tra cập nhật Service Worker:', swErr);
    }
  }

  // Tải metadata phiên bản từ server với cache-busting timestamp
  const timestamp = Date.now();
  const res = await fetch(`/version.json?_t=${timestamp}`, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
    },
  });

  if (!res.ok) {
    throw new Error(
      `Không thể kết nối máy chủ để kiểm tra bản cập nhật (${res.status})`
    );
  }

  const data = await res.json();
  const remoteHash = (data.commitHash || '').trim();
  const remoteVersion = data.version;
  const remoteBuildTime = data.buildTime;

  // Bản cập nhật mới khi remoteHash khác currentHash (ngoại trừ môi trường dev)
  const isDev =
    current.commitHash === 'dev' || current.commitHash === 'unknown';
  const hasUpdate = Boolean(
    remoteHash &&
      remoteHash !== 'unknown' &&
      (!isDev ? remoteHash !== current.commitHash : false)
  );

  return {
    hasUpdate,
    currentHash: current.commitHash,
    remoteHash,
    remoteVersion,
    remoteBuildTime,
    remoteFormattedBuildTime: remoteBuildTime
      ? formatBuildTime(remoteBuildTime)
      : undefined,
  };
}

/**
 * Xóa sạch toàn bộ cache của trình duyệt và tải lại ứng dụng:
 * 1. Xóa toàn bộ Cache Storage (PWA Precache & Runtime Cache)
 * 2. Hủy đăng ký Service Worker cũ
 * 3. Xóa sessionStorage (giữ an toàn tuyệt đối localStorage và phiên đăng nhập Firebase)
 * 4. Tải lại trang với query cache-busting
 */
export async function forceClearCacheAndReload(): Promise<void> {
  // 1. Xóa toàn bộ Cache Storage
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    } catch (err) {
      console.warn('Lỗi khi dọn dẹp Cache Storage:', err);
    }
  }

  // 2. Hủy đăng ký tất cả Service Workers đang chạy
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((reg) => reg.unregister()));
    } catch (err) {
      console.warn('Lỗi khi hủy đăng ký Service Worker:', err);
    }
  }

  // 3. Xóa sessionStorage tạm thời
  try {
    sessionStorage.clear();
  } catch (err) {
    console.warn('Lỗi khi xóa sessionStorage:', err);
  }

  // 4. Chuyển hướng / Tải lại trang triệt để với tham số cache-busting
  const url = new URL(window.location.href);
  url.searchParams.set('_v', Date.now().toString());
  window.location.replace(url.toString());
}
