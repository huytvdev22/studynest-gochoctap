import React from 'react';
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
import { LoginPage } from '@/pages/LoginPage';
import { MyClassesPage } from '@/pages/MyClassesPage';
import { JoinClassPage } from '@/pages/JoinClassPage';
import { ClassDashboardPage } from '@/pages/ClassDashboardPage';
import { SchedulePage } from '@/pages/SchedulePage';
import { LessonsPage } from '@/pages/LessonsPage';
import { LessonDetailPage } from '@/pages/LessonDetailPage';
import { SessionsAndTasksPage } from '@/pages/SessionsAndTasksPage';
import { SessionDetailPage } from '@/pages/SessionDetailPage';
import { ProgressPage } from '@/pages/ProgressPage';
import { MembersAndSettingsPage } from '@/pages/MembersAndSettingsPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
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
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

