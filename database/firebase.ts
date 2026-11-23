import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase, onValue, ref } from 'firebase/database';
import rawFirebaseConfig from '../firebase-applet-config.json';

export const REALTIME_DB_URL = 'https://schoolbellsystem-8c6fe-default-rtdb.firebaseio.com';

export const firebaseConfig = {
  apiKey: rawFirebaseConfig.apiKey,
  authDomain: rawFirebaseConfig.authDomain,
  databaseURL: REALTIME_DB_URL,
  projectId: rawFirebaseConfig.projectId,
  storageBucket: rawFirebaseConfig.storageBucket,
  messagingSenderId: rawFirebaseConfig.messagingSenderId,
  appId: rawFirebaseConfig.appId,
};

const app = initializeApp(firebaseConfig);
export const rtdb = getDatabase(app);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface DatabaseErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleDatabaseError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const isPermissionDenied = rawMessage.toLowerCase().includes('permission_denied') ||
    rawMessage.toLowerCase().includes('permission denied');

  const friendlyError = isPermissionDenied
    ? `Realtime Database permission denied at "${path}". Update Realtime Database Rules in Firebase Console (${REALTIME_DB_URL}) to allow authenticated users.`
    : rawMessage;

  const errInfo: DatabaseErrorInfo = {
    error: friendlyError,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firebase Database Error: ', JSON.stringify(errInfo));
  throw new Error(friendlyError);
}

export const handleFirestoreError = handleDatabaseError;

export function testRealtimeDbConnection(): void {
  try {
    const connectedRef = ref(rtdb, '.info/connected');
    onValue(
      connectedRef,
      () => {},
      (err) => {
        console.error('Realtime Database connection check error:', err);
      }
    );
  } catch (err) {
    console.error('Failed to initialize Realtime Database connection check:', err);
  }
}

testRealtimeDbConnection();
