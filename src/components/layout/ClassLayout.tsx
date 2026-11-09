import { useEffect, useState } from 'react';
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Check,
  ChevronsUpDown,
  ClipboardCheck,
  FolderKanban,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCw,
  Settings,
  ShieldAlert,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import type { ClassMember, StudyClass } from '@/types/domain';
import { useAuth } from '@/contexts/AuthContext';
import { ClassProvider, useClassContext } from '@/contexts/ClassContext';
import { listUserClassesWithMembership } from '@/services/studyNestService';
import {
  ClassIconView,
  RoleBadge,
  THEME_COLOR_STYLES,
} from '@/components/ui/ThemeBadges';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { AppSettingsModal } from '@/components/layout/AppSettingsModal';

interface WorkspaceNavItem {
  to: string;
  end: boolean;
  label: string;
  icon: typeof LayoutDashboard;
}

interface WorkspaceNavGroup {
  groupTitle: string;
  items: WorkspaceNavItem[];
}

function ClassLayoutInner() {
  const { user } = useAuth();
  const { studyClass, role, loading, error } = useClassContext();
  const location = useLocation();
  const navigate = useNavigate();

  // Trạng thái thu gọn sidebar trên màn hình lớn
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('studynest_sidebar_collapsed') === '1';
    } catch {
      return false;
    }
  });

  // Trạng thái mở drawer trên mobile
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Trạng thái mở bộ chuyển đổi Workspace (Workspace Switcher)
  const [switcherOpen, setSwitcherOpen] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [allWorkspaces, setAllWorkspaces] = useState<
    Array<{ studyClass: StudyClass; membership: ClassMember }>
  >([]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await new Promise((r) => setTimeout(r, 350));
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem(
        'studynest_sidebar_collapsed',
        collapsed ? '1' : '0'
      );
    } catch {
      // Ignore
    }
  }, [collapsed]);

  // Đóng menu mobile & switcher, reset vị trí cuộn lên đầu trang khi đổi route
  useEffect(() => {
    setMobileMenuOpen(false);
    setSwitcherOpen(false);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [location.pathname]);

  // Tải danh sách tất cả các lớp (workspaces) của user để chuyển nhanh
  useEffect(() => {
    if (!user) return;
    let active = true;
    listUserClassesWithMembership(user.uid)
      .then((list) => {
        if (active) setAllWorkspaces(list);
      })
      .catch(() => {
        // Bỏ qua lỗi phụ ở switcher
      });
    return () => {
      active = false;
    };
  }, [user, studyClass?.id]);

  if (loading) {
    return (
      <div
        className="flex flex-col gap-6 lg:flex-row"
        role="status"
        aria-live="polite"
      >
        <div className="h-20 w-full animate-pulse rounded-2xl bg-slate-200/70 lg:h-[calc(100vh-7rem)] lg:w-64 dark:bg-slate-800/60" />
        <div className="flex-1 space-y-4">
          <div className="h-16 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/60" />
          <div className="h-96 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/60" />
        </div>
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
          Không có quyền truy cập Workspace lớp học này
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
            Quay về danh sách Workspace
          </Link>
        </div>
      </div>
    );
  }

  const theme =
    THEME_COLOR_STYLES[studyClass.color] || THEME_COLOR_STYLES.emerald;
  const baseUrl = `/app/classes/${studyClass.id}`;

  const navGroups: WorkspaceNavGroup[] = [
    {
      groupTitle: 'Không gian học tập',
      items: [
        {
          to: baseUrl,
          end: true,
          label: 'Góc học hôm nay',
          icon: LayoutDashboard,
        },
        {
          to: `${baseUrl}/schedule`,
          end: false,
          label: 'Thời khóa biểu',
          icon: Calendar,
        },
        {
          to: `${baseUrl}/sessions`,
          end: false,
          label: 'Nhiệm vụ & Bài tập',
          icon: ClipboardCheck,
        },
        {
          to: `${baseUrl}/lessons`,
          end: false,
          label: 'Thư viện bài học',
          icon: BookOpen,
        },
      ],
    },
    {
      groupTitle: 'Động lực & Thành tích',
      items: [
        {
          to: `${baseUrl}/progress`,
          end: false,
          label: 'Sao & Chuỗi ngày học',
          icon: Trophy,
        },
      ],
    },
    {
      groupTitle: role === 'student' ? 'Thông tin lớp' : 'Quản trị Workspace',
      items: [
        {
          to: `${baseUrl}/members`,
          end: false,
          label: role === 'student' ? 'Thành viên lớp' : 'Thành viên & Cài đặt',
          icon: Users,
        },
      ],
    },
  ];

  const allNavItems = navGroups.flatMap((g) => g.items);
  const currentActiveItem =
    allNavItems.find((item) =>
      item.end
        ? location.pathname === item.to
        : location.pathname.startsWith(item.to)
    ) || allNavItems[0];

  // Khi chuyển sang Workspace (Lớp) khác, giữ nguyên phân khu đang mở (VD: đang ở /schedule thì sang lớp kia cũng mở /schedule)
  const handleSwitchWorkspace = (targetClassId: string) => {
    setSwitcherOpen(false);
    if (targetClassId === studyClass.id) return;

    const suffix = location.pathname.slice(baseUrl.length);
    const topLevelSection = suffix.split('/').filter(Boolean)[0];
    const allowedSections = [
      'schedule',
      'lessons',
      'sessions',
      'progress',
      'members',
    ];
    if (topLevelSection && allowedSections.includes(topLevelSection)) {
      navigate(`/app/classes/${targetClassId}/${topLevelSection}`);
    } else {
      navigate(`/app/classes/${targetClassId}`);
    }
  };

  const renderSidebarContent = (isMobileDrawer = false) => {
    const isMini = !isMobileDrawer && collapsed;

    return (
      <div className="flex h-full flex-col justify-between">
        {/* Phần trên: Workspace Switcher + Danh sách phân khu */}
        <div className="space-y-4">
          {/* 1. Bộ chuyển đổi Workspace (Workspace Switcher) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setSwitcherOpen((prev) => !prev)}
              title={`Workspace: ${studyClass.name} (Bấm để chuyển nhanh lớp học)`}
              className={`group flex items-center rounded-2xl border text-left transition shadow-xs ${theme.bgSoft} ${theme.border} hover:shadow-sm ${
                isMini
                  ? 'mx-auto h-11 w-11 justify-center p-0'
                  : 'w-full gap-3 p-2.5'
              }`}
            >
              <div
                className={`flex items-center justify-center rounded-xl shadow-xs ${theme.iconBg} ${
                  isMini ? 'h-9 w-9' : 'h-10 w-10 shrink-0'
                }`}
              >
                <ClassIconView
                  icon={studyClass.icon}
                  className={isMini ? 'h-4 w-4' : 'h-5 w-5'}
                />
              </div>

              {!isMini && (
                <>
                  <div className="min-w-0 flex-1">
                    <span className="block text-[10px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                      Workspace
                    </span>
                    <p className="truncate text-sm font-extrabold text-slate-900 dark:text-white">
                      {studyClass.name}
                    </p>
                  </div>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-500 transition group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-white" />
                </>
              )}
            </button>

            {/* Dropdown danh sách các Workspace (Lớp học) */}
            {switcherOpen && (
              <div
                className={`absolute z-50 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900 ${
                  isMini ? 'left-full top-0 ml-3' : 'left-0 right-0 mt-2'
                }`}
              >
                <div className="px-2.5 py-1.5 text-[11px] font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">
                  Chuyển nhanh Workspace ({allWorkspaces.length})
                </div>
                <div className="max-h-60 space-y-1 overflow-y-auto py-1">
                  {allWorkspaces.map(({ studyClass: cls, membership: mem }) => {
                    const isCurrent = cls.id === studyClass.id;
                    const clsTheme =
                      THEME_COLOR_STYLES[cls.color] ||
                      THEME_COLOR_STYLES.emerald;
                    return (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => handleSwitchWorkspace(cls.id)}
                        className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs transition ${
                          isCurrent
                            ? 'bg-emerald-50/90 font-bold text-emerald-950 dark:bg-emerald-950/50 dark:text-emerald-200'
                            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${clsTheme.iconBg}`}
                        >
                          <ClassIconView icon={cls.icon} className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-bold">{cls.name}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {mem.role === 'owner'
                              ? 'Chủ lớp'
                              : mem.role === 'instructor'
                              ? 'Người hướng dẫn'
                              : 'Học sinh'}
                          </div>
                        </div>
                        {isCurrent && (
                          <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-1 border-t border-slate-100 pt-1.5 dark:border-slate-800">
                  <Link
                    to="/app/classes"
                    className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                  >
                    <FolderKanban className="h-4 w-4" />
                    Danh sách góc học tập của tôi
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* 2. Danh sách điều hướng phân khu trong Workspace */}
          <nav
            aria-label="Điều hướng trong Workspace lớp học"
            className="space-y-4"
          >
            {navGroups.map((group) => (
              <div key={group.groupTitle} className="space-y-1">
                {!isMini && (
                  <div className="px-3 text-[11px] font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">
                    {group.groupTitle}
                  </div>
                )}
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        title={isMini ? item.label : undefined}
                        className={({ isActive }) =>
                          `group flex items-center rounded-xl text-sm transition ${
                            isMini
                              ? 'mx-auto h-10 w-10 justify-center p-0'
                              : 'gap-3 px-3 py-2.5'
                          } ${
                            isActive
                              ? 'bg-emerald-600 text-white font-bold shadow-xs dark:bg-emerald-600 dark:text-white'
                              : 'font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <Icon
                              className={`shrink-0 transition ${
                                isMini ? 'h-5 w-5' : 'h-4 w-4'
                              } ${
                                isActive
                                  ? 'text-white'
                                  : 'text-slate-500 group-hover:text-emerald-600 dark:text-slate-400 dark:group-hover:text-emerald-400'
                              }`}
                            />
                            {!isMini && (
                              <span className="truncate leading-tight">
                                {item.label}
                              </span>
                            )}
                          </>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Phần chân Sidebar: Nút Làm mới, Cài đặt/Cập nhật, quay về danh sách Workspace & thu gọn */}
        <div className="mt-6 border-t border-slate-200/80 pt-3 dark:border-slate-800 space-y-1">
          <button
            type="button"
            disabled={isRefreshing}
            onClick={() => void handleRefresh()}
            title="Làm mới trang và đồng bộ dữ liệu"
            aria-label="Làm mới trang và đồng bộ dữ liệu"
            className={`inline-flex items-center rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-emerald-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-emerald-400 transition ${
              isMini
                ? 'mx-auto h-9 w-9 justify-center p-0'
                : 'w-full gap-2 px-3 py-2 text-left'
            }`}
          >
            <RotateCw
              className={`h-4 w-4 shrink-0 transition-transform ${
                isRefreshing ? 'animate-spin text-emerald-600' : ''
              }`}
            />
            {!isMini && <span>Làm mới dữ liệu</span>}
          </button>

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            title="Cài đặt & Cập nhật ứng dụng (PWA)"
            aria-label="Cài đặt & Cập nhật ứng dụng (PWA)"
            className={`inline-flex items-center rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-emerald-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-emerald-400 transition ${
              isMini
                ? 'mx-auto h-9 w-9 justify-center p-0'
                : 'w-full gap-2 px-3 py-2 text-left'
            }`}
          >
            <Settings className="h-4 w-4 shrink-0" />
            {!isMini && <span>Cài đặt & Cập nhật</span>}
          </button>

          <div
            className={`flex items-center ${
              isMini
                ? 'flex-col justify-center gap-2'
                : 'justify-between gap-1'
            }`}
          >
            <Link
              to="/app/classes"
              title="Quay lại danh sách tất cả Workspace"
              className={`inline-flex items-center rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white ${
                isMini
                  ? 'h-9 w-9 justify-center p-0'
                  : 'flex-1 gap-2 px-3 py-2'
              }`}
            >
              <FolderKanban className="h-4 w-4 shrink-0" />
              {!isMini && <span>Tất cả Workspace</span>}
            </Link>

            {!isMobileDrawer && (
              <button
                type="button"
                onClick={() => setCollapsed((c) => !c)}
                title={
                  collapsed
                    ? 'Mở rộng thanh menu bên trái'
                    : 'Thu gọn thanh menu bên trái'
                }
                aria-label={
                  collapsed
                    ? 'Mở rộng thanh menu bên trái'
                    : 'Thu gọn thanh menu bên trái'
                }
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                {collapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      {/* Thanh điều khiển Workspace trên Mobile / Tablet (< lg) */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs lg:hidden dark:border-slate-800 dark:bg-slate-900">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Mở menu Workspace"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${theme.iconBg}`}
          >
            <ClassIconView icon={studyClass.icon} className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-extrabold text-slate-900 dark:text-white">
                {studyClass.name}
              </span>
              <RoleBadge role={role} />
            </div>
            <p className="truncate text-xs font-medium text-emerald-700 dark:text-emerald-400">
              {currentActiveItem?.label}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            disabled={isRefreshing}
            onClick={() => void handleRefresh()}
            aria-label="Làm mới trang"
            title="Làm mới trang và đồng bộ dữ liệu mới nhất"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-emerald-400 transition"
          >
            <RotateCw
              className={`h-4 w-4 transition-transform ${
                isRefreshing ? 'animate-spin text-emerald-600' : ''
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Cài đặt & Cập nhật ứng dụng (PWA)"
            title="Cài đặt & Cập nhật ứng dụng (PWA)"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <Settings className="h-4 w-4" />
          </button>

          <Link
            to="/app/classes"
            className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Đổi lớp
          </Link>
        </div>
      </div>

      {/* Drawer Sidebar trên Mobile (< lg) */}
      {mobileMenuOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] flex lg:hidden">
            <div
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative z-10 flex h-full w-80 max-w-[85vw] flex-col bg-white p-4 shadow-2xl dark:bg-slate-900">
              <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
                <span className="text-xs font-extrabold tracking-wider uppercase text-slate-400">
                  Menu Workspace
                </span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Đóng menu"
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {renderSidebarContent(true)}
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Left Sidebar cố định trên Desktop (>= lg) */}
      <aside
        aria-label="Thanh điều hướng Workspace bên trái"
        className={`hidden lg:block lg:sticky lg:top-[5.5rem] lg:h-[calc(100vh-7rem)] shrink-0 rounded-2xl border border-slate-200/90 bg-white shadow-xs transition-[width] duration-200 ease-in-out dark:border-slate-800 dark:bg-slate-900 ${
          collapsed ? 'lg:w-[68px] p-2.5' : 'lg:w-64 p-3.5'
        }`}
      >
        {renderSidebarContent(false)}
      </aside>

      {/* Vùng nội dung chính của Workspace bên phải */}
      <div className="min-w-0 flex-1 space-y-5 lg:min-h-[calc(100vh-7rem)]">
        {/* Thanh ngữ cảnh (Breadcrumb Bar) gọn gàng phía trên trang con */}
        <div className="hidden lg:flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-5 py-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2.5 text-sm">
            <span className="font-semibold text-slate-400 dark:text-slate-500">
              Workspace
            </span>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <span className="font-bold text-slate-700 dark:text-slate-200">
              {studyClass.name}
            </span>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              {currentActiveItem?.label}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {studyClass.description && (
              <span className="max-w-md truncate text-xs text-slate-500 dark:text-slate-400">
                {studyClass.description}
              </span>
            )}
            <RoleBadge role={role} />
          </div>
        </div>

        {/* Nội dung trang con */}
        <div>
          <Outlet />
        </div>
      </div>

      {/* Modal Cài đặt & Cập nhật ứng dụng (PWA & Web) */}
      <AppSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
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
