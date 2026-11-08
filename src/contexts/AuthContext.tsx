import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import type { UserProfile } from '@/types/domain';
import { getFirebaseServices, isFirebaseConfigured, isUsingEmulator } from '@/lib/firebase';
import { ensureUserProfile } from '@/services/studyNestService';
import {
  DEMO_PERSONAS,
  getActiveDemoUid,
  resetDemoState,
  setActiveDemoUid,
  type DemoPersona,
} from '@/services/demoStore';

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  isDemoMode: boolean;
  isEmulatorMode: boolean;
  demoPersonas: DemoPersona[];
  signInWithGoogle: () => Promise<void>;
  signInAsDemoPersona: (uid: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetDemoData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      const savedUid = getActiveDemoUid() || DEMO_PERSONAS[0].uid;
      const persona =
        DEMO_PERSONAS.find((p) => p.uid === savedUid) || DEMO_PERSONAS[0];
      setActiveDemoUid(persona.uid);
      ensureUserProfile({
        uid: persona.uid,
        displayName: persona.displayName,
        photoURL: persona.photoURL,
      })
        .then((profile) => {
          setUser(profile);
          setLoading(false);
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Lỗi khởi tạo hồ sơ');
          setLoading(false);
        });
      return;
    }

    const { auth } = getFirebaseServices();
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (!fbUser) {
          setUser(null);
          setLoading(false);
          return;
        }
        const profile = await ensureUserProfile({
          uid: fbUser.uid,
          displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Người dùng',
          photoURL: fbUser.photoURL || '',
        });
        setUser(profile);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Không thể tải hồ sơ người dùng');
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    if (!isFirebaseConfigured) {
      const defaultPersona = DEMO_PERSONAS[0];
      setActiveDemoUid(defaultPersona.uid);
      const profile = await ensureUserProfile({
        uid: defaultPersona.uid,
        displayName: defaultPersona.displayName,
        photoURL: defaultPersona.photoURL,
      });
      setUser(profile);
      return;
    }

    try {
      const { auth, googleProvider } = getFirebaseServices();
      const cred = await signInWithPopup(auth, googleProvider);
      const profile = await ensureUserProfile({
        uid: cred.user.uid,
        displayName:
          cred.user.displayName || cred.user.email?.split('@')[0] || 'Người dùng',
        photoURL: cred.user.photoURL || '',
      });
      setUser(profile);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Đăng nhập Google không thành công. Vui lòng kiểm tra cấu hình Firebase.'
      );
      throw err;
    }
  }, []);

  const signInAsDemoPersona = useCallback(async (uid: string) => {
    setError(null);
    const persona = DEMO_PERSONAS.find((p) => p.uid === uid);
    if (!persona) return;
    setActiveDemoUid(persona.uid);
    const profile = await ensureUserProfile({
      uid: persona.uid,
      displayName: persona.displayName,
      photoURL: persona.photoURL,
    });
    setUser(profile);
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    if (!isFirebaseConfigured) {
      setActiveDemoUid(null);
      setUser(null);
      return;
    }
    const { auth } = getFirebaseServices();
    await firebaseSignOut(auth);
    setUser(null);
  }, []);

  const resetDemoData = useCallback(async () => {
    resetDemoState();
    const currentUid = user?.uid || DEMO_PERSONAS[0].uid;
    const persona =
      DEMO_PERSONAS.find((p) => p.uid === currentUid) || DEMO_PERSONAS[0];
    setActiveDemoUid(persona.uid);
    const profile = await ensureUserProfile({
      uid: persona.uid,
      displayName: persona.displayName,
      photoURL: persona.photoURL,
    });
    setUser({ ...profile });
  }, [user?.uid]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        isDemoMode: !isFirebaseConfigured,
        isEmulatorMode: isUsingEmulator,
        demoPersonas: DEMO_PERSONAS,
        signInWithGoogle,
        signInAsDemoPersona,
        signOut,
        resetDemoData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth phải được sử dụng bên trong AuthProvider');
  }
  return ctx;
}

