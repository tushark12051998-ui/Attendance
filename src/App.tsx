import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import DailyLog from './components/DailyLog';
import SummaryGrid from './components/SummaryGrid';
import ResourcePlanning from './components/ResourcePlanning';
import PlanActualOverview from './components/PlanActualOverview';
import ExportReport from './components/ExportReport';
import LoginScreen from './components/LoginScreen';
import SystemSettings from './components/SystemSettings';
import { 
  initGoogleAuth, 
  googleSignIn, 
  googleSignOut, 
  appendRowToSheet 
} from './services/googleSheets';

import { 
  Associate, 
  AttendanceMap, 
  HeadcountPlanMap, 
  AttendanceRecordValue, 
  HeadcountPlanValue, 
  Shift,
  SHIFTS,
  DEPARTMENTS
} from './types';
import { 
  INITIAL_ASSOCIATES, 
  INITIAL_ATTENDANCE, 
  INITIAL_HEADCOUNT_PLANS 
} from './mockData';
import {
  getFirebaseDb,
  subscribeToAuthState,
  firebaseSignOut,
  subscribeToAssociates,
  subscribeToAttendance,
  subscribeToPlans,
  subscribeToSystemConfig,
  saveAssociateToDb,
  deleteAssociateFromDb,
  saveAttendanceBatchToDb,
  savePlanToDb,
  saveSystemConfigToDb,
  seedInitialDataIfEmpty
} from './services/firebase';
import { Loader2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function App() {
  // Global loading state for initial Firestore sync
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [firebaseActive, setFirebaseActive] = useState(true);
  const [syncToast, setSyncToast] = useState<{ show: boolean; msg: string; type: 'success' | 'error' }>({
    show: false,
    msg: '',
    type: 'success'
  });

  const showSyncNotification = (msg: string, type: 'success' | 'error' = 'success') => {
    setSyncToast({ show: true, msg, type });
    setTimeout(() => {
      setSyncToast(prev => ({ ...prev, show: false }));
    }, 3500);
  };

  // Google Sheets Sync State
  const [sheetUser, setSheetUser] = useState<any>(null);
  const [sheetToken, setSheetToken] = useState<string | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState<string>(() => {
    return localStorage.getItem('mtrack_spreadsheet_id') || '';
  });
  const [sheetsSyncEnabled, setSheetsSyncEnabled] = useState<boolean>(() => {
    return localStorage.getItem('mtrack_sheets_sync_enabled') === 'true';
  });

  // Save sheet config to localStorage
  useEffect(() => {
    localStorage.setItem('mtrack_spreadsheet_id', spreadsheetId);
  }, [spreadsheetId]);

  useEffect(() => {
    localStorage.setItem('mtrack_sheets_sync_enabled', sheetsSyncEnabled ? 'true' : 'false');
  }, [sheetsSyncEnabled]);

  // Listen to Google Sheets OAuth flow updates
  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (user, token) => {
        setSheetUser(user);
        setSheetToken(token);
      },
      () => {
        setSheetUser(null);
        setSheetToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      const res = await googleSignIn();
      if (res) {
        setSheetUser(res.user);
        setSheetToken(res.accessToken);
      }
    } catch (err) {
      console.error('Google Sheets sign-in failure:', err);
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await googleSignOut();
      setSheetUser(null);
      setSheetToken(null);
    } catch (err) {
      console.error('Google Sheets sign-out failure:', err);
    }
  };

  // Authentication State
  const [currentUser, setCurrentUser] = useState<{ 
    name: string; 
    role: 'admin' | 'engineer';
    email?: string;
    photoURL?: string;
  } | null>(() => {
    const saved = localStorage.getItem('mtrack_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return null;
  });

  // Dynamic Stations (Floor Areas mentioned/created by Admin)
  const [stations, setStations] = useState<string[]>([
    'Welding Station', 
    'Assembly Line', 
    'Machining Station', 
    'Quality Control Station'
  ]);

  // Dynamic Departments
  const [departments, setDepartments] = useState<string[]>([
    'Welding', 
    'Assembly', 
    'Machining', 
    'Quality Control'
  ]);

  // Global View Navigation State
  const [activeTab, setActiveTab] = useState<string>('daily_log');

  // Master date defaults to current date
  const [currentDate, setCurrentDate] = useState<string>('2026-07-15');
  const [currentShift, setCurrentShift] = useState<string>('ShiftA');

  // 1. Associate Master Profile State (Roster List - backed by Cloud Firestore)
  const [associates, setAssociates] = useState<Associate[]>(INITIAL_ASSOCIATES);

  // 2. Attendance Map Database State (backed by Cloud Firestore)
  const [attendance, setAttendance] = useState<AttendanceMap>(INITIAL_ATTENDANCE);

  // 3. Headcount Planning State (backed by Cloud Firestore)
  const [plans, setPlans] = useState<HeadcountPlanMap>(INITIAL_HEADCOUNT_PLANS);

  // 4. Organisation Name Branding State
  const [orgName, setOrgName] = useState<string>('PRECISION MFG CORP');

  // 5. System Access Credentials State
  const [credentials, setCredentials] = useState({
    admin: { name: 'S. Kowalski (Admin)', password: 'admin' },
    engineer: { name: 'J. Carter (Engineer)', password: 'engineer' }
  });

  // 6. Dynamic Operating Shifts Configuration State
  const [shifts, setShifts] = useState<Shift[]>([
    { id: 'ShiftA', name: 'Shift A', time: '06:00' },
    { id: 'ShiftB', name: 'Shift B', time: '14:00' },
    { id: 'ShiftC', name: 'Shift C', time: '22:00' }
  ]);

  // Track initial bootstrap
  const isBootstrapped = useRef(false);

  // -------------------------------------------------------------------
  // FIRESTORE REAL-TIME SYNCHRONIZATION & SEEDING
  // -------------------------------------------------------------------
  useEffect(() => {
    let unsubs: Array<() => void> = [];

    async function initFirestoreSync() {
      try {
        const db = getFirebaseDb();
        if (!db) {
          console.warn("Firestore not available; running in local fallback mode.");
          setFirebaseActive(false);
          setIsInitialLoading(false);
          return;
        }

        setFirebaseActive(true);

        // Seed initial datasets if Firestore collection is blank
        if (!isBootstrapped.current) {
          isBootstrapped.current = true;
          await seedInitialDataIfEmpty(INITIAL_ASSOCIATES, INITIAL_ATTENDANCE, INITIAL_HEADCOUNT_PLANS);
        }

        // 1. Subscribe to /associates
        const unsubAssoc = subscribeToAssociates(
          (cloudAssociates) => {
            if (cloudAssociates.length > 0) {
              setAssociates(cloudAssociates);
            }
            setIsInitialLoading(false);
          },
          (err) => {
            console.error("Associates real-time sync error:", err);
            setIsInitialLoading(false);
          }
        );
        unsubs.push(unsubAssoc);

        // 2. Subscribe to /attendance
        const unsubAtt = subscribeToAttendance(
          (cloudAttendance) => {
            if (Object.keys(cloudAttendance).length > 0) {
              setAttendance(cloudAttendance);
            }
          },
          (err) => console.error("Attendance real-time sync error:", err)
        );
        unsubs.push(unsubAtt);

        // 3. Subscribe to /plans
        const unsubPlans = subscribeToPlans(
          (cloudPlans) => {
            if (Object.keys(cloudPlans).length > 0) {
              setPlans(cloudPlans);
            }
          },
          (err) => console.error("Plans real-time sync error:", err)
        );
        unsubs.push(unsubPlans);

        // 4. Subscribe to /config/general
        const unsubConfig = subscribeToSystemConfig(
          (cloudConfig) => {
            if (cloudConfig.orgName) setOrgName(cloudConfig.orgName);
            if (cloudConfig.departments && cloudConfig.departments.length > 0) {
              setDepartments(cloudConfig.departments);
            }
            if (cloudConfig.stations && cloudConfig.stations.length > 0) {
              setStations(cloudConfig.stations);
            }
            if (cloudConfig.shifts && cloudConfig.shifts.length > 0) {
              setShifts(cloudConfig.shifts);
            }
            if (cloudConfig.credentials) {
              setCredentials(cloudConfig.credentials);
            }
          },
          (err) => console.error("System config real-time sync error:", err)
        );
        unsubs.push(unsubConfig);

        // 5. Subscribe to Firebase Auth changes
        const unsubAuth = subscribeToAuthState((fbUser, userDoc) => {
          if (fbUser) {
            const role = userDoc?.role || 'admin';
            const authUser = {
              name: fbUser.displayName || fbUser.email || 'Authorized User',
              role: role,
              email: fbUser.email || undefined,
              photoURL: fbUser.photoURL || undefined
            };
            setCurrentUser(authUser);
            localStorage.setItem('mtrack_user', JSON.stringify(authUser));
          }
        });
        unsubs.push(unsubAuth);

      } catch (error) {
        console.error("Failed to initialize Firestore real-time listeners:", error);
        setIsInitialLoading(false);
      }
    }

    initFirestoreSync();

    return () => {
      unsubs.forEach(unsub => {
        try { unsub(); } catch (e) {}
      });
    };
  }, []);

  // --- DATABASE WRITE MUTATIONS (DIRECT CLOUD FIRESTORE CRUD) ---

  const changeOrgName = async (newName: string) => {
    setOrgName(newName);
    setIsSyncing(true);
    try {
      await saveSystemConfigToDb(newName, departments, stations, shifts, credentials);
      showSyncNotification('Organization name updated in Firestore.');
    } catch (err) {
      console.error('Error saving org name:', err);
      showSyncNotification('Failed to update organization name.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const updateCredentials = async (role: 'admin' | 'engineer', name: string, password: string) => {
    const updated = {
      ...credentials,
      [role]: { name, password }
    };
    setCredentials(updated);
    
    // If the currently logged in user matches the updated role, refresh their session name
    if (currentUser && currentUser.role === role) {
      const updatedUser = { ...currentUser, name, role };
      setCurrentUser(updatedUser);
      localStorage.setItem('mtrack_user', JSON.stringify(updatedUser));
    }

    setIsSyncing(true);
    try {
      await saveSystemConfigToDb(orgName, departments, stations, shifts, updated);
      showSyncNotification('Credentials updated in Firestore.');
    } catch (err) {
      console.error('Error updating credentials:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const addShift = async (name: string, time: string) => {
    const cleanId = 'Shift' + name.replace(/[^a-zA-Z0-9]/g, '');
    const uniqueId = shifts.some(s => s.id === cleanId) ? cleanId + Date.now().toString().slice(-4) : cleanId;
    const updated = [...shifts, { id: uniqueId, name, time }];
    setShifts(updated);
    setIsSyncing(true);
    try {
      await saveSystemConfigToDb(orgName, departments, stations, updated, credentials);
      showSyncNotification(`Shift "${name}" added to Firestore.`);
    } catch (err) {
      console.error('Error adding shift:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const updateShift = async (id: string, name: string, time: string) => {
    const updated = shifts.map(s => s.id === id ? { id, name, time } : s);
    setShifts(updated);
    setIsSyncing(true);
    try {
      await saveSystemConfigToDb(orgName, departments, stations, updated, credentials);
      showSyncNotification(`Shift "${name}" updated in Firestore.`);
    } catch (err) {
      console.error('Error updating shift:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const deleteShift = async (id: string) => {
    if (shifts.length <= 1) return;
    const updated = shifts.filter(s => s.id !== id);
    setShifts(updated);
    if (currentShift === id) {
      setCurrentShift(updated[0].id);
    }
    setIsSyncing(true);
    try {
      await saveSystemConfigToDb(orgName, departments, stations, updated, credentials);
      showSyncNotification('Shift removed from Firestore.');
    } catch (err) {
      console.error('Error deleting shift:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Associate CRUD Operations
  const deleteAssociate = async (id: string) => {
    setAssociates(prev => prev.filter(emp => emp.id !== id));
    setIsSyncing(true);
    try {
      await deleteAssociateFromDb(id);
      showSyncNotification(`Associate ${id} deleted from Firestore.`);
    } catch (err) {
      console.error('Error deleting associate:', err);
      showSyncNotification(`Failed to delete associate ${id}.`, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const addAssociate = async (id: string, name: string, department: string, station: string, skill: 'Operator' | 'Helper') => {
    const newAssoc: Associate = { id, name, department, station, skill, status: 'Active' };
    setAssociates(prev => {
      const filtered = prev.filter(a => a.id !== id);
      return [...filtered, newAssoc];
    });

    setIsSyncing(true);
    try {
      await saveAssociateToDb(newAssoc);
      showSyncNotification(`Associate ${name} (${id}) saved to Firestore.`);

      // Sync to Google Sheets if configured
      if (sheetsSyncEnabled && sheetToken && spreadsheetId) {
        appendRowToSheet(sheetToken, spreadsheetId, 'Associates!A1', [
          new Date().toISOString(),
          newAssoc.id,
          newAssoc.name,
          newAssoc.department,
          newAssoc.station || 'N/A',
          newAssoc.skill,
          newAssoc.status
        ]).catch(err => console.error('Error syncing associate to sheets:', err));
      }
    } catch (err) {
      console.error('Error saving associate to Firestore:', err);
      showSyncNotification(`Failed to save associate ${name} to Firestore.`, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Department CRUD
  const addDepartment = async (deptName: string) => {
    const trimmed = deptName.trim();
    if (!trimmed || departments.includes(trimmed)) return;
    const updated = [...departments, trimmed];
    setDepartments(updated);
    setIsSyncing(true);
    try {
      await saveSystemConfigToDb(orgName, updated, stations, shifts, credentials);
      showSyncNotification(`Department "${trimmed}" added.`);
    } catch (err) {
      console.error('Error adding department:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const deleteDepartment = async (deptName: string) => {
    const updated = departments.filter(d => d !== deptName);
    setDepartments(updated);
    const nextDefaultDept = updated[0] || '';
    
    // Update associates in deleted department
    const updatedAssocs = associates.map(emp => {
      if (emp.department === deptName) {
        const updatedEmp = { ...emp, department: nextDefaultDept };
        saveAssociateToDb(updatedEmp).catch(console.error);
        return updatedEmp;
      }
      return emp;
    });
    setAssociates(updatedAssocs);

    setIsSyncing(true);
    try {
      await saveSystemConfigToDb(orgName, updated, stations, shifts, credentials);
      showSyncNotification(`Department "${deptName}" deleted.`);
    } catch (err) {
      console.error('Error deleting department:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const updateDepartment = async (oldName: string, newName: string) => {
    const trimmedNew = newName.trim();
    if (!trimmedNew || oldName === trimmedNew) return;
    const updated = departments.map(d => d === oldName ? trimmedNew : d);
    setDepartments(updated);

    const updatedAssocs = associates.map(emp => {
      if (emp.department === oldName) {
        const updatedEmp = { ...emp, department: trimmedNew };
        saveAssociateToDb(updatedEmp).catch(console.error);
        return updatedEmp;
      }
      return emp;
    });
    setAssociates(updatedAssocs);

    setIsSyncing(true);
    try {
      await saveSystemConfigToDb(orgName, updated, stations, shifts, credentials);
      showSyncNotification(`Department renamed to "${trimmedNew}".`);
    } catch (err) {
      console.error('Error updating department:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Station CRUD
  const addStation = async (stationName: string) => {
    const trimmed = stationName.trim();
    if (!trimmed || stations.includes(trimmed)) return;
    const updated = [...stations, trimmed];
    setStations(updated);
    setIsSyncing(true);
    try {
      await saveSystemConfigToDb(orgName, departments, updated, shifts, credentials);
      showSyncNotification(`Station "${trimmed}" added.`);
    } catch (err) {
      console.error('Error adding station:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const deleteStation = async (stationName: string) => {
    const updatedStations = stations.filter(st => st !== stationName);
    setStations(updatedStations);
    const nextDefaultStation = updatedStations[0] || '';

    const updatedAssocs = associates.map(emp => {
      if (emp.station === stationName) {
        const updatedEmp = { ...emp, station: nextDefaultStation };
        saveAssociateToDb(updatedEmp).catch(console.error);
        return updatedEmp;
      }
      return emp;
    });
    setAssociates(updatedAssocs);

    setIsSyncing(true);
    try {
      await saveSystemConfigToDb(orgName, departments, updatedStations, shifts, credentials);
      showSyncNotification(`Station "${stationName}" removed.`);
    } catch (err) {
      console.error('Error deleting station:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const updateStation = async (oldName: string, newName: string) => {
    const trimmedNew = newName.trim();
    if (!trimmedNew || oldName === trimmedNew) return;
    const updated = stations.map(s => s === oldName ? trimmedNew : s);
    setStations(updated);

    const updatedAssocs = associates.map(emp => {
      if (emp.station === oldName) {
        const updatedEmp = { ...emp, station: trimmedNew };
        saveAssociateToDb(updatedEmp).catch(console.error);
        return updatedEmp;
      }
      return emp;
    });
    setAssociates(updatedAssocs);

    // Update station plans
    const updatedPlans = { ...plans };
    Object.keys(updatedPlans).forEach(key => {
      const plan = updatedPlans[key];
      if (plan.stationPlans && plan.stationPlans[oldName]) {
        const stationPlan = plan.stationPlans[oldName];
        delete plan.stationPlans[oldName];
        plan.stationPlans[trimmedNew] = {
          ...stationPlan,
          station: trimmedNew
        };
        savePlanToDb(plan.date || key.split('_')[0], plan.shift || key.split('_')[1], plan).catch(console.error);
      }
    });
    setPlans(updatedPlans);

    setIsSyncing(true);
    try {
      await saveSystemConfigToDb(orgName, departments, updated, shifts, credentials);
      showSyncNotification(`Station renamed to "${trimmedNew}".`);
    } catch (err) {
      console.error('Error updating station:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Attendance Save Mutation
  const saveAttendance = async (
    date: string, 
    shift: string, 
    localRecords: Record<string, AttendanceRecordValue>
  ) => {
    setAttendance((prev) => {
      const updated = { ...prev };
      Object.entries(localRecords).forEach(([empId, value]) => {
        const key = `${date}_${shift}_${empId}`;
        updated[key] = value;
      });
      return updated;
    });

    setIsSyncing(true);
    try {
      await saveAttendanceBatchToDb(date, shift, localRecords);
      showSyncNotification(`Saved ${Object.keys(localRecords).length} attendance logs to Firestore.`);

      // Async Google Sheets sync
      if (sheetsSyncEnabled && sheetToken && spreadsheetId) {
        const timestamp = new Date().toISOString();
        for (const [empId, record] of Object.entries(localRecords)) {
          const assoc = associates.find(a => a.id === empId);
          const name = assoc ? assoc.name : 'Unknown';
          const dept = assoc ? assoc.department : 'Unknown';
          const station = assoc ? assoc.station || 'N/A' : 'N/A';
          const isPresent = record.isPresent ? 'Present' : 'Absent';
          const overtime = record.overtimeHours || 0;

          appendRowToSheet(sheetToken, spreadsheetId, 'Attendance Logs!A1', [
            timestamp,
            date,
            shift,
            empId,
            name,
            dept,
            station,
            isPresent,
            overtime
          ]).catch(err => console.error('Error syncing attendance to sheets:', err));
        }
      }
    } catch (err) {
      console.error('Error saving attendance to Firestore:', err);
      showSyncNotification('Failed to save attendance records to Firestore.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Capacity Plan Save Mutation
  const savePlan = async (date: string, shift: string, planData: HeadcountPlanValue) => {
    const key = `${date}_${shift}`;
    setPlans(prev => ({
      ...prev,
      [key]: planData
    }));

    setIsSyncing(true);
    try {
      await savePlanToDb(date, shift, planData);
      showSyncNotification(`Capacity Plan for ${date} (${shift}) saved to Firestore.`);

      // Async Google Sheets sync
      if (sheetsSyncEnabled && sheetToken && spreadsheetId) {
        const timestamp = new Date().toISOString();
        const activeEmps = associates.filter(a => a.status === 'Active');
        let actualCount = 0;
        activeEmps.forEach(emp => {
          const attKey = `${date}_${shift}_${emp.id}`;
          const record = attendance[attKey];
          if (record && record.isPresent) {
            actualCount++;
          }
        });

        const planned = planData.plannedHeadcount || 0;
        const variance = actualCount - planned;
        const notes = planData.varianceNotes || '';

        appendRowToSheet(sheetToken, spreadsheetId, 'Capacity Plans!A1', [
          timestamp,
          date,
          shift,
          planned,
          actualCount,
          variance,
          notes
        ]).catch(err => console.error('Error syncing plan to sheets:', err));
      }
    } catch (err) {
      console.error('Error saving plan to Firestore:', err);
      showSyncNotification('Failed to save capacity plan to Firestore.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await firebaseSignOut();
    } catch (err) {
      console.error('Error signing out of Firebase Auth:', err);
    }
    setCurrentUser(null);
    localStorage.removeItem('mtrack_user');
  };

  const activeShiftName = shifts.find(s => s.id === currentShift)?.name || currentShift;

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Loader2 className="h-7 w-7 animate-spin text-indigo-400" />
            </div>
          </div>
          <div className="text-center space-y-1">
            <h2 className="font-display font-bold text-lg text-white tracking-tight">
              Loading Manufacturing Operations Core
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Connecting to Cloud Firestore database & synchronizing live shop floor records...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginScreen
        orgName={orgName}
        credentials={credentials}
        onLogin={(user) => {
          setCurrentUser(user);
          localStorage.setItem('mtrack_user', JSON.stringify(user));
        }}
      />
    );
  }

  // Render active operational view
  const renderActiveView = () => {
    switch (activeTab) {
      case 'daily_log':
        return (
          <DailyLog
            associates={associates}
            addAssociate={addAssociate}
            deleteAssociate={deleteAssociate}
            attendance={attendance}
            saveAttendance={saveAttendance}
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            currentShift={currentShift}
            setCurrentShift={setCurrentShift}
            currentUser={currentUser}
            stations={stations}
            addStation={addStation}
            deleteStation={deleteStation}
            updateStation={updateStation}
            shifts={shifts}
            departments={departments}
            addDepartment={addDepartment}
            deleteDepartment={deleteDepartment}
            updateDepartment={updateDepartment}
          />
        );
      case 'summary_grid':
        return (
          <SummaryGrid
            associates={associates}
            attendance={attendance}
            stations={stations}
          />
        );
      case 'resource_planning':
        return (
          <ResourcePlanning
            associates={associates}
            attendance={attendance}
            plans={plans}
            savePlan={savePlan}
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            currentShift={currentShift}
            setCurrentShift={setCurrentShift}
            currentUser={currentUser}
            stations={stations}
            shifts={shifts}
          />
        );
      case 'plan_actual_overview':
        return (
          <PlanActualOverview
            associates={associates}
            attendance={attendance}
            plans={plans}
            currentDate={currentDate}
            stations={stations}
            shifts={shifts}
            currentShift={currentShift}
            setCurrentShift={setCurrentShift}
          />
        );
      case 'compliance_reports':
        return (
          <ExportReport
            associates={associates}
            attendance={attendance}
            plans={plans}
            currentDate={currentDate}
            currentShift={currentShift}
            stations={stations}
            shifts={shifts}
          />
        );
      case 'system_settings':
        return (
          <SystemSettings
            orgName={orgName}
            changeOrgName={changeOrgName}
            credentials={credentials}
            updateCredentials={updateCredentials}
            shifts={shifts}
            addShift={addShift}
            updateShift={updateShift}
            deleteShift={deleteShift}
            associates={associates}
            deleteAssociate={deleteAssociate}
            currentUser={currentUser}
            departments={departments}
            addDepartment={addDepartment}
            deleteDepartment={deleteDepartment}
            updateDepartment={updateDepartment}
            sheetUser={sheetUser}
            sheetToken={sheetToken}
            onGoogleLogin={handleGoogleLogin}
            onGoogleLogout={handleGoogleLogout}
            spreadsheetId={spreadsheetId}
            setSpreadsheetId={setSpreadsheetId}
            sheetsSyncEnabled={sheetsSyncEnabled}
            setSheetsSyncEnabled={setSheetsSyncEnabled}
          />
        );
      default:
        return (
          <div className="p-8 text-center text-slate-500 font-medium">
            Unknown Tab Selected
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-800 antialiased relative">
      
      {/* Toast Notification Banner */}
      {syncToast.show && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-xl border text-xs font-medium transition-all animate-bounce ${
          syncToast.type === 'success' 
            ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300' 
            : 'bg-rose-950/90 border-rose-500/30 text-rose-300'
        }`}>
          {syncToast.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
          )}
          <span>{syncToast.msg}</span>
        </div>
      )}

      {/* Sidebar Control Panel */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        totalAssociates={associates.length}
        currentShiftName={activeShiftName}
        currentDate={currentDate}
        currentUser={currentUser}
        onLogout={handleLogout}
        orgName={orgName}
        isSyncing={isSyncing}
        isFirebaseActive={firebaseActive}
      />

      {/* Main Content Pane */}
      <main id="main-content-area" className="flex-1 overflow-y-auto h-screen p-8 bg-slate-50/70">
        <div className="max-w-7xl mx-auto">
          {renderActiveView()}
        </div>
      </main>

    </div>
  );
}
