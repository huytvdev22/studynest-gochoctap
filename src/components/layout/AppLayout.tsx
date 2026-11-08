import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  FolderKanban,
  LogOut,
  Moon,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Sun,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export function AppLayout({ children }: { children?: React.ReactNode }) {
  const {
    user,
    isDemoMode,
    isEmulatorMode,
    demoPersonas,
    signInAsDemoPersona,
    signOut,
    resetDemoData,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isWorkspaceRoute =
    location.pathname.startsWith('/app/classes/') &&
    location.pathname !== '/app/classes';
  const [dark, setDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem('studynest_theme') === 'dark';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
      try {
        localStorage.setItem('studynest_theme', 'dark');
      } catch {
        // Ignore
      }
    } else {
      root.classList.remove('dark');
      try {
        localStorage.setItem('studynest_theme', 'light');
      } catch {
        // Ignore
      }
    }
  }, [dark]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Banner thông báo chế độ môi trường */}
      {isDemoMode && (
        <div className="border-b border-amber-200 bg-amber-50/90 px-4 py-2 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-200">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                <strong>Chế độ Demo Local:</strong> Đang dùng dữ liệu mẫu trên trình duyệt
                (do chưa cấu hình <code>.env</code> Firebase). Bạn có thể chuyển nhanh vai trò để kiểm thử toàn bộ luồng:
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {demoPersonas.map((p) => {
                const active = user?.uid === p.uid;
                return (
                  <button
                    key={p.uid}
                    type="button"
                    onClick={() => void signInAsDemoPersona(p.uid)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      active
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-white text-slate-700 hover:bg-emerald-50 border border-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700'
                    }`}
                    title={p.roleHint}
                  >
                    {p.displayName}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => void resetDemoData()}
                className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-200"
                title="Khôi phục dữ liệu mẫu ban đầu"
              >
                <RotateCcw className="h-3 w-3" />
                Reset mẫu
              </button>
            </div>
          </div>
        </div>
      )}

      {isEmulatorMode && (
        <div className="border-b border-sky-200 bg-sky-50 px-4 py-1.5 text-center text-xs font-medium text-sky-900 dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-200">
          <ShieldAlert className="mr-1.5 inline h-3.5 w-3.5" />
          Đang kết nối với <strong>Firebase Local Emulator Suite</strong> (Auth: 9099, Firestore: 8080)
        </div>
      )}

      {/* Top Navigation */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div
          className={`mx-auto flex h-16 items-center justify-between px-4 sm:px-6 ${
            isWorkspaceRoute ? 'max-w-[1600px]' : 'max-w-6xl'
          }`}
        >
          <div className="flex items-center gap-4">
            <Link
              to="/app/classes"
              className="flex items-center gap-2.5 rounded-xl py-1 pr-2 font-extrabold tracking-tight text-slate-900 dark:text-white"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                <BookOpen className="h-5 w-5" />
              </span>
              <div>
                <span className="block text-base leading-none sm:text-lg">
                  StudyNest
                </span>
                <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Workspace học tập 60 phút
                </span>
              </div>
            </Link>

            <nav aria-label="Điều hướng chính" className="hidden sm:flex items-center gap-1">
              <Link
                to="/app/classes"
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <FolderKanban className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Tất cả Workspace
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setDark((d) => !d)}
              aria-label={dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {dark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
            </button>

            {user && (
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-1.5 dark:border-slate-800 dark:bg-slate-800/70">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                    {user.displayName.charAt(0).toUpperCase()}
                  </div>
                  <span className="max-w-[140px] truncate text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {user.displayName}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-rose-950/40"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Đăng xuất</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main
        className={`mx-auto w-full flex-1 ${
          isWorkspaceRoute
            ? 'max-w-[1600px] px-3 py-4 sm:px-6 sm:py-6'
            : 'max-w-6xl px-4 py-6 sm:px-6 sm:py-8'
        }`}
      >
        {children ?? <Outlet />}
      </main>

      <footer className="border-t border-slate-200/70 bg-white/60 py-4 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
        <div
          className={`mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 ${
            isWorkspaceRoute ? 'max-w-[1600px]' : 'max-w-6xl'
          }`}
        >
          <span>
            <strong>StudyNest – Workspace học tập</strong> • Thiết kế tối giản, an toàn dữ liệu cho học sinh nhỏ tuổi.
          </span>
          <span>Múi giờ mặc định: Asia/Ho_Chi_Minh • Không mạng xã hội / Không hồ sơ công khai</span>
        </div>
      </footer>
    </div>
  );
}

