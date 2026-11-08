import { Link, NavLink, Outlet } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Clock,
  LayoutDashboard,
  ShieldAlert,
  Trophy,
  Users,
} from 'lucide-react';
import { ClassProvider, useClassContext } from '@/contexts/ClassContext';
import {
  ClassIconView,
  RoleBadge,
  THEME_COLOR_STYLES,
} from '@/components/ui/ThemeBadges';

function ClassLayoutInner() {
  const { studyClass, role, loading, error } = useClassContext();

  if (loading) {
    return (
      <div className="space-y-4 py-8" role="status" aria-live="polite">
        <div className="h-28 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/60" />
        <div className="h-12 animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800/60" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/60" />
      </div>
    );
  }

  if (error || !studyClass || !role) {
    return (
      <div className="mx-auto my-12 max-w-lg rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm dark:border-rose-900/60 dark:bg-slate-900">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          Không có quyền truy cập lớp học này
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {error ||
            'Bạn chưa phải là thành viên chính thức của lớp học này hoặc lớp học không tồn tại. Nếu bạn có mã mời, vui lòng mở đường link lời mời và chờ chủ lớp xác nhận.'}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            to="/app/classes"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay về Lớp của tôi
          </Link>
        </div>
      </div>
    );
  }

  const theme = THEME_COLOR_STYLES[studyClass.color] || THEME_COLOR_STYLES.emerald;
  const baseUrl = `/app/classes/${studyClass.id}`;

  const navItems = [
    {
      to: baseUrl,
      end: true,
      label: role === 'student' ? 'Góc học hôm nay' : 'Tổng quan lớp',
      icon: LayoutDashboard,
    },
    {
      to: `${baseUrl}/schedule`,
      end: false,
      label: 'Thời khóa biểu',
      icon: Calendar,
    },
    {
      to: `${baseUrl}/lessons`,
      end: false,
      label: 'Thư viện bài học',
      icon: BookOpen,
    },
    {
      to: `${baseUrl}/sessions`,
      end: false,
      label: 'Buổi học & Nhiệm vụ',
      icon: Clock,
    },
    {
      to: `${baseUrl}/progress`,
      end: false,
      label: 'Sao & Chuỗi ngày học',
      icon: Trophy,
    },
    {
      to: `${baseUrl}/members`,
      end: false,
      label: 'Thành viên & Cài đặt',
      icon: Users,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Lớp học */}
      <div
        className={`relative overflow-hidden rounded-2xl border p-5 sm:p-6 shadow-sm ${theme.bgSoft} ${theme.border}`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm ${theme.iconBg}`}
            >
              <ClassIconView icon={studyClass.icon} className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to="/app/classes"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Tất cả lớp
                </Link>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <RoleBadge role={role} />
              </div>
              <h1 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
                {studyClass.name}
              </h1>
              {studyClass.description && (
                <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
                  {studyClass.description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Thanh điều hướng con của lớp */}
        <nav
          aria-label="Điều hướng trong lớp học"
          className="mt-5 flex items-center gap-1.5 overflow-x-auto pb-1"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold transition ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
                      : 'bg-white/80 text-slate-700 hover:bg-white dark:bg-slate-900/70 dark:text-slate-300 dark:hover:bg-slate-900'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Nội dung trang con */}
      <div>
        <Outlet />
      </div>
    </div>
  );
}

export function ClassLayout() {
  return (
    <ClassProvider>
      <ClassLayoutInner />
    </ClassProvider>
  );
}

