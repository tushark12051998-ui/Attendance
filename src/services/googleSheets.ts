import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { initializeApp, getApps, getApp } from 'firebase/app';

// Reuse the Firebase configuration from Vite env or fallback
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
};

// Ensure Firebase is initialized
let firebaseApp: any = null;
try {
  if (getApps().length === 0) {
    firebaseApp = initializeApp(firebaseConfig);
  } else {
    firebaseApp = getApp();
  }
} catch (error) {
  console.warn("Failed to initialize Firebase in Google Sheets service:", error);
}

const auth = firebaseApp ? getAuth(firebaseApp) : null;
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');

let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const initGoogleAuth = (
  onAuthSuccess: (user: User, token: string) => void,
  onAuthFailure: () => void
) => {
  if (!auth) {
    onAuthFailure();
    return () => {};
  }
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Since Firebase doesn't persist the provider's access token inside onAuthStateChanged,
        // we'll require the user to sign in or we'll trigger token retrieval.
        // For a seamless UX in SPAs, we can request a login if needed.
        onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (!auth) {
    throw new Error("Firebase Auth is not initialized. Please configure VITE_FIREBASE credentials.");
  }
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

export const googleSignOut = async (): Promise<void> => {
  if (auth) {
    await auth.signOut();
  }
  cachedAccessToken = null;
};

export const getGoogleAccessToken = (): string | null => {
  return cachedAccessToken;
};

/**
 * Creates a brand new Spreadsheet with predefined sheets
 */
export async function createSpreadsheet(accessToken: string, title: string): Promise<string> {
  const url = 'https://sheets.googleapis.com/v4/spreadsheets';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        title: title || 'M-Track Attendance Logs'
      },
      sheets: [
        {
          properties: {
            title: 'Attendance Logs'
          }
        },
        {
          properties: {
            title: 'Capacity Plans'
          }
        },
        {
          properties: {
            title: 'Associates'
          }
        }
      ]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to create spreadsheet: ${errText}`);
  }

  const data = await response.json();
  const spreadsheetId = data.spreadsheetId;

  // Initialize spreadsheet with headers
  await Promise.all([
    appendRowToSheet(accessToken, spreadsheetId, 'Attendance Logs!A1', [
      'Timestamp', 'Date', 'Shift', 'Associate ID', 'Name', 'Department', 'Station', 'Is Present', 'Overtime Hours'
    ]),
    appendRowToSheet(accessToken, spreadsheetId, 'Capacity Plans!A1', [
      'Timestamp', 'Date', 'Shift', 'Planned Headcount', 'Actual Headcount', 'Variance', 'Notes'
    ]),
    appendRowToSheet(accessToken, spreadsheetId, 'Associates!A1', [
      'Timestamp', 'Associate ID', 'Name', 'Department', 'Station', 'Skill', 'Status'
    ])
  ]);

  return spreadsheetId;
}

/**
 * Append a generic row to a spreadsheet range
 */
export async function appendRowToSheet(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  rowValues: any[]
): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values: [rowValues]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`Error appending to Google Sheet range ${range}:`, errText);
    throw new Error(`Failed to append row to spreadsheet: ${errText}`);
  }
}
