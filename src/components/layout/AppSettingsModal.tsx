import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Info,
  RefreshCw,
  RotateCcw,
  Settings,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react';
import { ModalPortal } from '@/components/ui/ModalPortal';
import {
  checkForUpdates,
  forceClearCacheAndReload,
  getCurrentVersionInfo,
  type UpdateCheckResult,
} from '@/services/versionService';

export function AppSettingsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const versionInfo = getCurrentVersionInfo();
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isPwa =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true);

  useEffect(() => {
    if (isOpen) {
      setUpdateResult(null);
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateResult(null);
    setErrorMessage(null);
    try {
      const result = await checkForUpdates();
      setUpdateResult(result);
    } catch {
      setErrorMessage(
        'Không thể kết nối máy chủ để kiểm tra bản cập nhật. Vui lòng kiểm tra lại kết nối mạng.'
      );
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleClearCacheAndReload = async () => {
    setClearingCache(true);
    await forceClearCacheAndReload();
  };

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label="Cài đặt & Cập nhật ứng dụng"
      >
        <div className="my-6 w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-150">
          {/* Header Modal */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <Settings className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  Cài đặt & Cập nhật ứng dụng
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Dành cho ứng dụng PWA và trình duyệt
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              aria-label="Đóng"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-5 space-y-4">
            {/* Khối thông tin phiên bản */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-2.5 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Phiên bản hiện tại
                </span>
                <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                  v{versionInfo.version} (#{versionInfo.commitHash})
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Thời gian đóng gói
                </span>
                <span className="text-xs text-slate-700 dark:text-slate-300">
                  {versionInfo.formattedBuildTime || versionInfo.buildTime}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Môi trường chạy
                </span>
                {isPwa ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    <Smartphone className="h-3 w-3" /> PWA Standalone (Đã cài đặt)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    <Info className="h-3 w-3" /> Trình duyệt Web
                  </span>
                )}
              </div>
            </div>

            {/* Trạng thái sau khi bấm kiểm tra */}
            {updateResult && (
              <div
                className={`p-3.5 rounded-2xl text-xs flex items-center justify-between gap-3 animate-in fade-in duration-200 ${
                  updateResult.hasUpdate
                    ? 'border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200'
                    : 'border border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {updateResult.hasUpdate ? (
                    <Sparkles className="h-4 w-4 text-amber-600 shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  )}
                  <span className="font-bold truncate">
                    {updateResult.hasUpdate
                      ? `Phát hiện bản mới (#${updateResult.remoteHash})!`
                      : 'Ứng dụng của bạn đang ở phiên bản mới nhất.'}
                  </span>
                </div>

                {updateResult.hasUpdate && (
                  <button
                    type="button"
                    onClick={() => void handleClearCacheAndReload()}
                    disabled={clearingCache}
                    className="shrink-0 rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 active:scale-95 transition"
                  >
                    {clearingCache ? 'Đang cập nhật...' : 'Cập nhật ngay'}
                  </button>
                )}
              </div>
            )}

            {errorMessage && (
              <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
                {errorMessage}
              </div>
            )}

            {/* Nút hành động kiểm tra cập nhật */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => void handleCheckUpdate()}
                disabled={checkingUpdate}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-xs sm:text-sm font-bold text-white flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    checkingUpdate ? 'animate-spin' : ''
                  }`}
                />
                <span>
                  {checkingUpdate ? 'Đang kiểm tra cập nhật...' : 'Kiểm tra bản cập nhật'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => void handleClearCacheAndReload()}
                disabled={clearingCache}
                className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 active:scale-98 text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-750 transition"
              >
                <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                <span>
                  {clearingCache
                    ? 'Đang xóa bộ nhớ đệm...'
                    : 'Xóa cache & Tải lại ứng dụng'}
                </span>
              </button>
            </div>

            <p className="text-[11px] text-center text-slate-400 dark:text-slate-500 leading-relaxed">
              Tính năng này cho phép ứng dụng PWA đã cài đặt trên thiết bị tự động xóa bộ nhớ đệm và tải mã nguồn mới nhất từ máy chủ mà không cần mở trình duyệt web.
            </p>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
