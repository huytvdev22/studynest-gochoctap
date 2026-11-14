import React, { Suspense, lazy } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { ClassLayout } from '@/components/layout/ClassLayout';
import { GlobalAlertDialogHost } from '@/components/ui/ModalPortal';

const LoginPage = lazy(() =>
  import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage }))
);
const MyClassesPage = lazy(() =>
  import('@/pages/MyClassesPage').then((m) => ({ default: m.MyClassesPage }))
);
const JoinClassPage = lazy(() =>
  import('@/pages/JoinClassPage').then((m) => ({ default: m.JoinClassPage }))
);
const ClassDashboardPage = lazy(() =>
  import('@/pages/ClassDashboardPage').then((m) => ({
    default: m.ClassDashboardPage,
  }))
);
const SchedulePage = lazy(() =>
  import('@/pages/SchedulePage').then((m) => ({ default: m.SchedulePage }))
);
const LessonsPage = lazy(() =>
  import('@/pages/LessonsPage').then((m) => ({ default: m.LessonsPage }))
);
const LessonDetailPage = lazy(() =>
  import('@/pages/LessonDetailPage').then((m) => ({
    default: m.LessonDetailPage,
  }))
);
const SessionsAndTasksPage = lazy(() =>
  import('@/pages/SessionsAndTasksPage').then((m) => ({
    default: m.SessionsAndTasksPage,
  }))
);
const SessionDetailPage = lazy(() =>
  import('@/pages/SessionDetailPage').then((m) => ({
    default: m.SessionDetailPage,
  }))
);
const ProgressPage = lazy(() =>
  import('@/pages/ProgressPage').then((m) => ({ default: m.ProgressPage }))
);
const MembersAndSettingsPage = lazy(() =>
  import('@/pages/MembersAndSettingsPage').then((m) => ({
    default: m.MembersAndSettingsPage,
  }))
);

function RouteLoadingFallback() {
  return (
    <div
      className="flex min-h-[40vh] items-center justify-center p-8"
      role="status"
      aria-live="polite"
    >
      <div className="h-9 w-9 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
      <span className="sr-only">Đang tải nội dung trang...</span>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950"
        role="status"
        aria-live="polite"
      >
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        <span className="sr-only">Đang kiểm tra phiên đăng nhập...</span>
      </div>
    );
  }

  if (!user) {
    const redirect = `${location.pathname}${location.search}`;
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(redirect)}`}
        replace
      />
    );
  }

  return <>{children}</>;
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            {/* Route tham gia lớp bằng lời mời */}
            <Route
              path="/join/:token"
              element={
                <RequireAuth>
                  <AppLayout>
                    <JoinClassPage />
                  </AppLayout>
                </RequireAuth>
              }
            />

            {/* Các route ứng dụng chính */}
            <Route
              path="/app"
              element={
                <RequireAuth>
                  <AppLayout />
                </RequireAuth>
              }
            >
              <Route index element={<Navigate to="/app/classes" replace />} />
              <Route path="classes" element={<MyClassesPage />} />

              <Route path="classes/:classId" element={<ClassLayout />}>
                <Route index element={<ClassDashboardPage />} />
                <Route path="schedule" element={<SchedulePage />} />
                <Route path="lessons" element={<LessonsPage />} />
                <Route path="lessons/:lessonId" element={<LessonDetailPage />} />
                <Route path="sessions" element={<SessionsAndTasksPage />} />
                <Route
                  path="sessions/:sessionId"
                  element={<SessionDetailPage />}
                />
                <Route path="progress" element={<ProgressPage />} />
                <Route path="members" element={<MembersAndSettingsPage />} />
              </Route>
            </Route>

            {/* Mặc định điều hướng về /app/classes */}
            <Route path="*" element={<Navigate to="/app/classes" replace />} />
          </Routes>
        </Suspense>
        <GlobalAlertDialogHost />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

