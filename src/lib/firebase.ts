import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({
  prompt: 'select_account',
});

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the access token in memory only.
let cachedAccessToken: string | null = null;

export function formatAuthError(error: any): string {
  const code = error?.code || '';
  switch (code) {
    case 'auth/popup-blocked':
      return 'Sign-in popup was blocked by your browser. Please allow popups or open the app in a new tab.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in was closed before completion. Please try again.';
    case 'auth/unauthorized-domain':
      return 'This web domain is not yet authorized in Firebase Console for OAuth.';
    case 'auth/cancelled-popup-request':
      return 'Another sign-in window is already active. Please finish signing in there or close it and retry.';
    case 'auth/network-request-failed':
      return 'Network error. Please verify your connection.';
    default:
      return error?.message || 'Failed to sign in with Google account.';
  }
}

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onUserDetectedWithoutToken?: (user: User) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else {
        // User profile is preserved by Firebase, but access token needs interactive refresh
        if (onUserDetectedWithoutToken) {
          onUserDetectedWithoutToken(user);
        } else if (onAuthFailure) {
          onAuthFailure();
        }
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Google Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};
