import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  type Auth,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from 'firebase/firestore';

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined;
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined;
const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined;
const appId = import.meta.env.VITE_FIREBASE_APP_ID as string | undefined;
const useEmulator =
  (import.meta.env.VITE_USE_FIREBASE_EMULATOR as string | undefined) === 'true';

/**
 * Kiểm tra xem biến môi trường Firebase đã được cấu hình thực tế hay chưa.
 */
export const isFirebaseConfigured: boolean = Boolean(
  useEmulator ||
    (apiKey &&
      projectId &&
      apiKey !== 'AIzaSyYourApiKeyHere' &&
      projectId !== 'your-project-id')
);

export const isUsingEmulator: boolean = useEmulator;

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let emulatorsConnected = false;

export function getFirebaseServices(): {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  googleProvider: GoogleAuthProvider;
} {
  if (!appInstance) {
    const config = {
      apiKey: apiKey || 'demo-api-key',
      authDomain: authDomain || 'demo-studynest.firebaseapp.com',
      projectId: projectId || 'demo-studynest',
      storageBucket: storageBucket || 'demo-studynest.appspot.com',
      messagingSenderId: messagingSenderId || '000000000000',
      appId: appId || '1:000000000000:web:demo',
    };
    appInstance = getApps().length > 0 ? getApps()[0] : initializeApp(config);
    authInstance = getAuth(appInstance);
    dbInstance = getFirestore(appInstance);

    if (useEmulator && !emulatorsConnected) {
      connectAuthEmulator(authInstance, 'http://127.0.0.1:9099', {
        disableWarnings: true,
      });
      connectFirestoreEmulator(dbInstance, '127.0.0.1', 8080);
      emulatorsConnected = true;
    }
  }

  const googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });

  return {
    app: appInstance!,
    auth: authInstance!,
    db: dbInstance!,
    googleProvider,
  };
}

