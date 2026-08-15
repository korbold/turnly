import { initializeApp, getApps } from 'firebase/app';
import { GoogleAuthProvider, getAuth, signInWithPopup } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function app() {
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
}

/** The web build has a Firebase config but no auth wiring — this adds it. */
export function isGoogleSignInConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain);
}

/**
 * Signs in with Google and returns the Firebase ID token.
 *
 * The API verifies it with the Firebase Admin SDK, which accepts a token
 * from any OAuth client of the project (web, iOS, Android) — so no extra
 * client id is needed beyond the Firebase config already in place.
 */
export async function signInWithGoogle(): Promise<string> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  const credential = await signInWithPopup(getAuth(app()), provider);
  return credential.user.getIdToken();
}
