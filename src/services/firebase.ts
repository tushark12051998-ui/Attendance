import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  Firestore,
  doc, 
  setDoc, 
  updateDoc,
  deleteDoc, 
  getDocs, 
  getDoc,
  collection, 
  onSnapshot,
  writeBatch,
  serverTimestamp,
  Unsubscribe
} from 'firebase/firestore';
import { 
  getAuth, 
  Auth,
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as firebaseAuthSignOut, 
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { 
  Associate, 
  AttendanceMap, 
  HeadcountPlanMap, 
  AttendanceRecordValue, 
  HeadcountPlanValue,
  Shift 
} from '../types';
import firebaseAppletConfig from '../../firebase-applet-config.json';

// Build Firebase configuration using applet config and Vite environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseAppletConfig.apiKey || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseAppletConfig.authDomain || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseAppletConfig.projectId || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseAppletConfig.storageBucket || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseAppletConfig.messagingSenderId || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseAppletConfig.appId || ""
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets');

/**
 * Initialize Firebase App
 */
export function getFirebaseApp(): FirebaseApp | null {
  if (app) return app;
  try {
    if (getApps().length === 0) {
      if (firebaseConfig.apiKey && firebaseConfig.projectId) {
        app = initializeApp(firebaseConfig);
      } else {
        console.warn("Firebase configuration credentials missing.");
        return null;
      }
    } else {
      app = getApp();
    }
    return app;
  } catch (err) {
    console.error("Failed to initialize Firebase App:", err);
    return null;
  }
}

/**
 * Initialize and get Firestore Database instance
 */
export function getFirebaseDb(): Firestore | null {
  if (db) return db;
  const currentApp = getFirebaseApp();
  if (!currentApp) return null;
  try {
    const databaseId = firebaseAppletConfig.firestoreDatabaseId || '(default)';
    db = getFirestore(currentApp, databaseId);
    return db;
  } catch (err) {
    console.error("Failed to initialize Firestore instance:", err);
    return null;
  }
}

/**
 * Initialize and get Firebase Auth instance
 */
export function getFirebaseAuth(): Auth | null {
  if (auth) return auth;
  const currentApp = getFirebaseApp();
  if (!currentApp) return null;
  try {
    auth = getAuth(currentApp);
    return auth;
  } catch (err) {
    console.error("Failed to initialize Firebase Auth instance:", err);
    return null;
  }
}

// -------------------------------------------------------------
// AUTHENTICATION CRUD & GOOGLE SIGN-IN
// -------------------------------------------------------------

/**
 * Listen to Firebase Auth state
 */
export function subscribeToAuthState(
  onUserChanged: (user: User | null, userDoc?: any) => void
): Unsubscribe {
  const authInstance = getFirebaseAuth();
  if (!authInstance) {
    onUserChanged(null);
    return () => {};
  }

  return onAuthStateChanged(authInstance, async (firebaseUser) => {
    if (firebaseUser) {
      const database = getFirebaseDb();
      let userDocData: any = null;
      if (database) {
        try {
          const userRef = doc(database, 'users', firebaseUser.uid);
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            userDocData = snap.data();
            // Update lastLoginAt
            await updateDoc(userRef, {
              lastLoginAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          } else {
            // First time registration
            userDocData = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'Manufacturing Engineer',
              email: firebaseUser.email || '',
              photoURL: firebaseUser.photoURL || '',
              role: 'admin', // default to admin for first authenticated workspace user
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              lastLoginAt: new Date().toISOString()
            };
            await setDoc(userRef, userDocData);
          }
        } catch (err) {
          console.error("Error reading/updating user profile from Firestore:", err);
        }
      }
      onUserChanged(firebaseUser, userDocData);
    } else {
      onUserChanged(null);
    }
  });
}

/**
 * Sign in with Google Popup
 */
export async function signInWithGoogle(): Promise<{ user: User; token?: string }> {
  const authInstance = getFirebaseAuth();
  if (!authInstance) {
    throw new Error("Firebase Auth is not available. Please check your credentials.");
  }
  const result = await signInWithPopup(authInstance, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const token = credential?.accessToken;

  // Record user profile in Firestore
  const database = getFirebaseDb();
  if (database && result.user) {
    const userRef = doc(database, 'users', result.user.uid);
    await setDoc(userRef, {
      uid: result.user.uid,
      name: result.user.displayName || result.user.email || 'User',
      email: result.user.email || '',
      photoURL: result.user.photoURL || '',
      role: 'admin',
      updatedAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    }, { merge: true });
  }

  return { user: result.user, token };
}

/**
 * Sign out of Firebase
 */
export async function firebaseSignOut(): Promise<void> {
  const authInstance = getFirebaseAuth();
  if (authInstance) {
    await firebaseAuthSignOut(authInstance);
  }
}

// -------------------------------------------------------------
// REAL-TIME FIRESTORE LISTENERS
// -------------------------------------------------------------

/**
 * Real-time subscription to Associates roster
 */
export function subscribeToAssociates(
  callback: (associates: Associate[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const database = getFirebaseDb();
  if (!database) {
    return () => {};
  }

  return onSnapshot(
    collection(database, 'associates'),
    (snapshot) => {
      const associates: Associate[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        associates.push({
          id: docSnap.id,
          name: data.name || '',
          department: data.department || '',
          station: data.station || '',
          status: data.status || 'Active',
          skill: data.skill || 'Operator'
        });
      });
      callback(associates);
    },
    (err) => {
      console.error("Firestore error on /associates listener:", err);
      if (onError) onError(err);
    }
  );
}

/**
 * Real-time subscription to Attendance records
 */
export function subscribeToAttendance(
  callback: (attendance: AttendanceMap) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const database = getFirebaseDb();
  if (!database) {
    return () => {};
  }

  return onSnapshot(
    collection(database, 'attendance'),
    (snapshot) => {
      const attendance: AttendanceMap = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        attendance[docSnap.id] = {
          isPresent: data.isPresent ?? true,
          overtimeHours: data.overtimeHours ?? 0
        };
      });
      callback(attendance);
    },
    (err) => {
      console.error("Firestore error on /attendance listener:", err);
      if (onError) onError(err);
    }
  );
}

/**
 * Real-time subscription to Capacity Plans
 */
export function subscribeToPlans(
  callback: (plans: HeadcountPlanMap) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const database = getFirebaseDb();
  if (!database) {
    return () => {};
  }

  return onSnapshot(
    collection(database, 'plans'),
    (snapshot) => {
      const plans: HeadcountPlanMap = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        plans[docSnap.id] = {
          plannedHeadcount: data.plannedHeadcount || 0,
          actualHeadcountOverride: data.actualHeadcountOverride,
          useOverride: data.useOverride || false,
          varianceNotes: data.varianceNotes || "",
          stationPlans: data.stationPlans || undefined
        };
      });
      callback(plans);
    },
    (err) => {
      console.error("Firestore error on /plans listener:", err);
      if (onError) onError(err);
    }
  );
}

/**
 * Real-time subscription to System Configuration
 */
export function subscribeToSystemConfig(
  callback: (config: {
    orgName: string;
    departments: string[];
    stations: string[];
    shifts: Shift[];
    credentials?: any;
  }) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const database = getFirebaseDb();
  if (!database) {
    return () => {};
  }

  return onSnapshot(
    doc(database, 'config', 'general'),
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        callback({
          orgName: data.orgName || 'PRECISION MFG CORP',
          departments: data.departments || ['Welding', 'Assembly', 'Machining', 'Quality Control'],
          stations: data.stations || ['Welding Station', 'Assembly Line', 'Machining Station', 'Quality Control Station'],
          shifts: data.shifts || [
            { id: 'ShiftA', name: 'Shift A', time: '06:00' },
            { id: 'ShiftB', name: 'Shift B', time: '14:00' },
            { id: 'ShiftC', name: 'Shift C', time: '22:00' }
          ],
          credentials: data.credentials || undefined
        });
      }
    },
    (err) => {
      console.error("Firestore error on /config/general listener:", err);
      if (onError) onError(err);
    }
  );
}

// -------------------------------------------------------------
// CRUD OPERATIONS: ASSOCIATES
// -------------------------------------------------------------

/**
 * Create or update an associate in Firestore
 */
export async function saveAssociateToDb(associate: Associate): Promise<void> {
  const database = getFirebaseDb();
  if (!database) return;
  const docRef = doc(database, 'associates', associate.id);
  const now = new Date().toISOString();
  await setDoc(docRef, {
    ...associate,
    updatedAt: now,
    createdAt: now
  }, { merge: true });
}

/**
 * Update an existing associate in Firestore
 */
export async function updateAssociateInDb(associate: Associate): Promise<void> {
  const database = getFirebaseDb();
  if (!database) return;
  const docRef = doc(database, 'associates', associate.id);
  await setDoc(docRef, {
    ...associate,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

/**
 * Delete an associate from Firestore
 */
export async function deleteAssociateFromDb(id: string): Promise<void> {
  const database = getFirebaseDb();
  if (!database) return;
  await deleteDoc(doc(database, 'associates', id));
}

/**
 * Bulk import associates in an atomic batch
 */
export async function bulkImportAssociatesToDb(associatesList: Associate[]): Promise<void> {
  const database = getFirebaseDb();
  if (!database || associatesList.length === 0) return;
  
  const batch = writeBatch(database);
  const now = new Date().toISOString();

  associatesList.forEach((assoc) => {
    const docRef = doc(database, 'associates', assoc.id);
    batch.set(docRef, {
      ...assoc,
      createdAt: now,
      updatedAt: now
    }, { merge: true });
  });

  await batch.commit();
}

// -------------------------------------------------------------
// CRUD OPERATIONS: ATTENDANCE
// -------------------------------------------------------------

/**
 * Save single attendance log
 */
export async function saveAttendanceToDb(
  date: string, 
  shift: string, 
  empId: string, 
  value: AttendanceRecordValue
): Promise<void> {
  const database = getFirebaseDb();
  if (!database) return;
  const docId = `${date}_${shift}_${empId}`;
  const docRef = doc(database, 'attendance', docId);
  const now = new Date().toISOString();
  await setDoc(docRef, {
    id: docId,
    date,
    shift,
    associateId: empId,
    isPresent: value.isPresent,
    overtimeHours: value.overtimeHours,
    updatedAt: now,
    createdAt: now
  }, { merge: true });
}

/**
 * Save batch attendance records atomically
 */
export async function saveAttendanceBatchToDb(
  date: string,
  shift: string,
  records: Record<string, AttendanceRecordValue>
): Promise<void> {
  const database = getFirebaseDb();
  if (!database) return;
  
  const batch = writeBatch(database);
  const now = new Date().toISOString();

  Object.entries(records).forEach(([empId, value]) => {
    const docId = `${date}_${shift}_${empId}`;
    const docRef = doc(database, 'attendance', docId);
    batch.set(docRef, {
      id: docId,
      date,
      shift,
      associateId: empId,
      isPresent: value.isPresent,
      overtimeHours: value.overtimeHours,
      updatedAt: now,
      createdAt: now
    }, { merge: true });
  });

  await batch.commit();
}

/**
 * Delete attendance log
 */
export async function deleteAttendanceFromDb(date: string, shift: string, empId: string): Promise<void> {
  const database = getFirebaseDb();
  if (!database) return;
  const docId = `${date}_${shift}_${empId}`;
  await deleteDoc(doc(database, 'attendance', docId));
}

// -------------------------------------------------------------
// CRUD OPERATIONS: CAPACITY / HEADCOUNT PLANS
// -------------------------------------------------------------

/**
 * Save headcount plan
 */
export async function savePlanToDb(date: string, shift: string, plan: HeadcountPlanValue): Promise<void> {
  const database = getFirebaseDb();
  if (!database) return;
  const docId = `${date}_${shift}`;
  const docRef = doc(database, 'plans', docId);
  const now = new Date().toISOString();
  await setDoc(docRef, {
    id: docId,
    date,
    shift,
    plannedHeadcount: plan.plannedHeadcount || 0,
    actualHeadcountOverride: plan.actualHeadcountOverride || null,
    useOverride: plan.useOverride || false,
    varianceNotes: plan.varianceNotes || "",
    stationPlans: plan.stationPlans || null,
    updatedAt: now,
    createdAt: now
  }, { merge: true });
}

/**
 * Delete headcount plan
 */
export async function deletePlanFromDb(date: string, shift: string): Promise<void> {
  const database = getFirebaseDb();
  if (!database) return;
  const docId = `${date}_${shift}`;
  await deleteDoc(doc(database, 'plans', docId));
}

// -------------------------------------------------------------
// CRUD OPERATIONS: SYSTEM CONFIG
// -------------------------------------------------------------

/**
 * Save general system configuration
 */
export async function saveSystemConfigToDb(
  orgName: string, 
  departments: string[], 
  stations: string[], 
  shifts: Shift[],
  credentials?: any
): Promise<void> {
  const database = getFirebaseDb();
  if (!database) return;
  const docRef = doc(database, 'config', 'general');
  const now = new Date().toISOString();
  await setDoc(docRef, {
    orgName,
    departments,
    stations,
    shifts,
    credentials: credentials || null,
    updatedAt: now,
    createdAt: now
  }, { merge: true });
}

// -------------------------------------------------------------
// SEEDING & INITIAL SYNCHRONIZATION
// -------------------------------------------------------------

/**
 * Seed initial default dataset if Firestore is empty on initial provisioning
 */
export async function seedInitialDataIfEmpty(
  initialAssociates: Associate[],
  initialAttendance: AttendanceMap,
  initialPlans: HeadcountPlanMap
): Promise<void> {
  const database = getFirebaseDb();
  if (!database) return;

  try {
    const associatesSnap = await getDocs(collection(database, 'associates'));
    if (associatesSnap.empty && initialAssociates.length > 0) {
      console.log("Seeding initial associates into Cloud Firestore...");
      await bulkImportAssociatesToDb(initialAssociates);
    }

    const attendanceSnap = await getDocs(collection(database, 'attendance'));
    if (attendanceSnap.empty && Object.keys(initialAttendance).length > 0) {
      console.log("Seeding initial attendance logs into Cloud Firestore...");
      const batch = writeBatch(database);
      const now = new Date().toISOString();
      Object.entries(initialAttendance).forEach(([key, val]) => {
        const parts = key.split('_');
        if (parts.length >= 3) {
          const date = parts[0];
          const shift = parts[1];
          const empId = parts.slice(2).join('_');
          const docRef = doc(database, 'attendance', key);
          batch.set(docRef, {
            id: key,
            date,
            shift,
            associateId: empId,
            isPresent: val.isPresent,
            overtimeHours: val.overtimeHours,
            createdAt: now,
            updatedAt: now
          });
        }
      });
      await batch.commit();
    }

    const plansSnap = await getDocs(collection(database, 'plans'));
    if (plansSnap.empty && Object.keys(initialPlans).length > 0) {
      console.log("Seeding initial headcount plans into Cloud Firestore...");
      const batch = writeBatch(database);
      const now = new Date().toISOString();
      Object.entries(initialPlans).forEach(([key, val]) => {
        const parts = key.split('_');
        if (parts.length >= 2) {
          const date = parts[0];
          const shift = parts[1];
          const docRef = doc(database, 'plans', key);
          batch.set(docRef, {
            id: key,
            date,
            shift,
            plannedHeadcount: val.plannedHeadcount || 0,
            actualHeadcountOverride: val.actualHeadcountOverride || null,
            useOverride: val.useOverride || false,
            varianceNotes: val.varianceNotes || "",
            stationPlans: val.stationPlans || null,
            createdAt: now,
            updatedAt: now
          });
        }
      });
      await batch.commit();
    }
  } catch (err) {
    console.error("Error checking or seeding initial data in Firestore:", err);
  }
}
