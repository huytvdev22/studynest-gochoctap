import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { ClassMember, ClassRole, StudyClass } from '@/types/domain';
import { getClassContext } from '@/services/studyNestService';
import { useAuth } from './AuthContext';

interface ClassContextValue {
  studyClass: StudyClass | null;
  membership: ClassMember | null;
  role: ClassRole | null;
  isOwner: boolean;
  isInstructorOrOwner: boolean;
  isStudent: boolean;
  loading: boolean;
  error: string | null;
  refreshClass: () => Promise<void>;
}

const ClassContext = createContext<ClassContextValue | undefined>(undefined);

export function ClassProvider({ children }: { children: React.ReactNode }) {
  const { classId } = useParams<{ classId: string }>();
  const { user } = useAuth();
  const [studyClass, setStudyClass] = useState<StudyClass | null>(null);
  const [membership, setMembership] = useState<ClassMember | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadContext = useCallback(async () => {
    if (!classId || !user) {
      setStudyClass(null);
      setMembership(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const ctx = await getClassContext(classId, user.uid);
      if (!ctx) {
        setStudyClass(null);
        setMembership(null);
      } else {
        setStudyClass(ctx.studyClass);
        setMembership(ctx.membership);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không có quyền truy cập hoặc lớp học không tồn tại.'
      );
      setStudyClass(null);
      setMembership(null);
    } finally {
      setLoading(false);
    }
  }, [classId, user]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const role = membership?.role ?? null;
  const isOwner = role === 'owner';
  const isInstructorOrOwner = role === 'owner' || role === 'instructor';
  const isStudent = role === 'student';

  return (
    <ClassContext.Provider
      value={{
        studyClass,
        membership,
        role,
        isOwner,
        isInstructorOrOwner,
        isStudent,
        loading,
        error,
        refreshClass: loadContext,
      }}
    >
      {children}
    </ClassContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useClassContext(): ClassContextValue {
  const ctx = useContext(ClassContext);
  if (!ctx) {
    throw new Error('useClassContext phải được dùng bên trong ClassProvider');
  }
  return ctx;
}

