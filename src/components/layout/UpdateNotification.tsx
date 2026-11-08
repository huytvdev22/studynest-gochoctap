import React, { useEffect, useState } from 'react';
import { RefreshCw, Sparkles, X } from 'lucide-react';
import {
  checkForUpdates,
  forceClearCacheAndReload,
  type UpdateCheckResult,
} from '@/services/versionService';

export const UpdateNotification: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const performCheck = async () => {
      try {
        const result = await checkForUpdates();
        if (result.hasUpdate) {
          setUpdateInfo(result);
        }
      } catch {
        // Yên lặng bỏ qua lỗi mạng nền
      }
    };

    // Kiểm tra sau khi ứng dụng nạp xong 3 giây
    const timer = setTimeout(() => {
      void performCheck();
    }, 3000);

    // Tự động kiểm tra lại khi người dùng quay lại tab trình duyệt
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void performCheck();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  if (!updateInfo?.hasUpdate || isDismissed) {
    return null;
  }

  const handleUpdateNow = async () => {
    setIsUpdating(true);
    await forceClearCacheAndReload();
  };

  return (
    <aside
      aria-label="Thông báo bản cập nhật mới"
      className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 left-4 sm:left-auto sm:w-[380px] z-50 pointer-events-none animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="pointer-events-auto bg-slate-900 text-white border border-emerald-500/40 rounded-2xl p-4 shadow-2xl shadow-slate-950/50 flex flex-col gap-3 relative overflow-hidden dark:bg-slate-950 dark:border-emerald-600/50">
        {/* Điểm nhấn dải màu ngọc lục bảo Emerald trên đỉnh */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />

        {/* TẦNG 1: THÔNG TIN BẢN CẬP NHẬT & NÚT ĐÓNG */}
        <div className="flex items-start justify-between gap-3 pt-0.5">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800/80 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
              <RefreshCw
                className={`w-5 h-5 ${isUpdating ? 'animate-spin' : ''}`}
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h4 className="text-sm font-extrabold text-white tracking-tight flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Bản cập nhật mới
                </h4>
                {updateInfo.remoteHash && (
                  <span className="text-[10px] font-mono font-bold bg-emerald-950/90 border border-emerald-800 text-emerald-300 px-1.5 py-0.2 rounded-md">
                    #{updateInfo.remoteHash}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-1 truncate">
                {updateInfo.remoteFormattedBuildTime
                  ? `Đóng gói: ${updateInfo.remoteFormattedBuildTime}`
                  : 'Nâng cấp để nhận tính năng và bản vá mới nhất'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="w-8 h-8 -mr-1 -mt-1 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center shrink-0 transition"
            title="Bỏ qua thông báo"
            aria-label="Đóng thông báo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* TẦNG 2: NÚT THAO TÁC */}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            disabled={isUpdating}
            className="h-9 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition disabled:opacity-50"
          >
            Để sau
          </button>

          <button
            type="button"
            onClick={() => void handleUpdateNow()}
            disabled={isUpdating}
            className="flex-1 h-9 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 text-xs font-bold flex items-center justify-center gap-2 shadow-md transition disabled:opacity-75"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`}
            />
            <span>{isUpdating ? 'Đang làm mới cache...' : 'Cập nhật ngay'}</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
