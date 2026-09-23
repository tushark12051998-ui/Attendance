import React, { useState, useEffect } from 'react';
import { 
  UserPlus, 
  Check, 
  AlertCircle, 
  Calendar, 
  Clock, 
  UserCheck, 
  UserX,
  AlertTriangle,
  FileCheck,
  Plus,
  Settings,
  Layers,
  Lock,
  Trash2,
  FileSpreadsheet,
  X,
  Info,
  Grid,
  Search,
  Filter
} from 'lucide-react';
import { Associate, AttendanceMap, AttendanceRecordValue } from '../types';

interface DailyLogProps {
  associates: Associate[];
  addAssociate: (id: string, name: string, department: string, station: string, skill: 'Operator' | 'Helper') => void;
  deleteAssociate: (id: string) => void;
  attendance: AttendanceMap;
  saveAttendance: (date: string, shift: string, records: Record<string, AttendanceRecordValue>) => void;
  currentDate: string;
  setCurrentDate: (date: string) => void;
  currentShift: string;
  setCurrentShift: (shift: string) => void;
  currentUser: { name: string; role: 'admin' | 'engineer' };
  stations: string[];
  addStation: (name: string) => void;
  deleteStation: (name: string) => void;
  updateStation?: (oldName: string, newName: string) => void;
  shifts: any[];
  departments: string[];
  addDepartment: (name: string) => void;
  deleteDepartment: (name: string) => void;
  updateDepartment?: (oldName: string, newName: string) => void;
}

export default function DailyLog({
  associates,
  addAssociate,
  deleteAssociate,
  attendance,
  saveAttendance,
  currentDate,
  setCurrentDate,
  currentShift,
  setCurrentShift,
  currentUser,
  stations,
  addStation,
  deleteStation,
  updateStation,
  shifts,
  departments,
  addDepartment,
  deleteDepartment,
  updateDepartment
}: DailyLogProps) {
  // Local working state for the active date and shift, so edits are "scratch" until committed
  const [localRecords, setLocalRecords] = useState<Record<string, AttendanceRecordValue>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  // Quick-add associate form state (Admin Only)
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [addMethod, setAddMethod] = useState<'single' | 'excel'>('single');
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newDept, setNewDept] = useState('');
  const [newStation, setNewStation] = useState('');
  const [newSkill, setNewSkill] = useState<'Operator' | 'Helper'>('Operator');
  const [addError, setAddError] = useState('');

  // Initialize newDept to first department when dynamic departments are loaded
  useEffect(() => {
    if (departments.length > 0 && !newDept) {
      setNewDept(departments[0]);
    }
  }, [departments]);

  // Excel Paste bulk import state
  const [excelInput, setExcelInput] = useState('');
  const [parsedExcelRows, setParsedExcelRows] = useState<Array<{
    id: string;
    name: string;
    department: string;
    station: string;
    skill: 'Operator' | 'Helper';
    isValid: boolean;
    error?: string;
  }>>([]);

  // Manage stations state (Admin Only)
  const [showManageStations, setShowManageStations] = useState(false);
  const [newStationInput, setNewStationInput] = useState('');
  const [stationAddError, setStationAddError] = useState('');

  // Manage departments state (Admin Only)
  const [newDeptInput, setNewDeptInput] = useState('');
  const [deptAddError, setDeptAddError] = useState('');

  // Inline editing state for Stations and Departments
  const [editingStationName, setEditingStationName] = useState<string | null>(null);
  const [editingStationValue, setEditingStationValue] = useState<string>('');
  const [editingDeptName, setEditingDeptName] = useState<string | null>(null);
  const [editingDeptValue, setEditingDeptValue] = useState<string>('');

  // Tabular matrix filters and layout controls
  const [viewMode, setViewMode] = useState<'matrix' | 'cards'>('matrix');
  const [searchTerm, setSearchTerm] = useState('');
  const [stationFilter, setStationFilter] = useState('All');
  const [deptFilter, setDeptFilter] = useState('All');

  // Helper to filter associates for high-density tabular matrix view
  const filteredAssociatesForView = () => {
    return associates.filter(emp => {
      if (emp.status !== 'Active') return false;
      
      const matchesSearch = 
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.id.toLowerCase().includes(searchTerm.toLowerCase());
        
      const empStation = emp.station || (emp.department + ' Station');
      const matchesStation = stationFilter === 'All' || empStation === stationFilter || emp.station === stationFilter;
      const matchesDept = deptFilter === 'All' || emp.department === deptFilter;
      
      return matchesSearch && matchesStation && matchesDept;
    });
  };

  // Initialize newStation to first station in list when dynamic stations are loaded/changed
  useEffect(() => {
    if (stations.length > 0 && !newStation) {
      setNewStation(stations[0]);
    }
  }, [stations]);

  // Load attendance state into local scratchpad whenever date or shift changes, or when master attendance database is updated
  useEffect(() => {
    const freshRecords: Record<string, AttendanceRecordValue> = {};
    associates.forEach(emp => {
      const key = `${currentDate}_${currentShift}_${emp.id}`;
      if (attendance[key]) {
        freshRecords[emp.id] = { ...attendance[key] };
      } else {
        // Default values for new or unlogged days: Absent by default (or Present if preferred).
        // Let's make them default to Absent (false) so that Engineers actively SELECT them, as requested:
        // "engineer will only select name and overtime under station."
        // This is much safer and matches the workflow of checking off who's here!
        freshRecords[emp.id] = { isPresent: false, overtimeHours: 0 };
      }
    });
    setLocalRecords(freshRecords);
    setIsDirty(false);
  }, [currentDate, currentShift, associates, attendance]);

  // Handle selecting name / toggling attendance
  const handleToggleAttendance = (empId: string, isPresent: boolean) => {
    setLocalRecords(prev => {
      const updated = {
        ...prev,
        [empId]: {
          isPresent,
          overtimeHours: isPresent ? (prev[empId]?.overtimeHours || 0) : 0
        }
      };
      setIsDirty(true);
      return updated;
    });
  };

  // Handle overtime hours input change
  const handleOvertimeChange = (empId: string, val: string) => {
    let hours = parseFloat(val);
    if (isNaN(hours)) hours = 0;
    if (hours < 0) hours = 0;
    if (hours > 8) hours = 8;
    hours = Math.round(hours * 10) / 10;

    setLocalRecords(prev => {
      const updated = {
        ...prev,
        [empId]: {
          ...prev[empId],
          overtimeHours: hours
        }
      };
      setIsDirty(true);
      return updated;
    });
  };

  // Save changes to parent state and LocalStorage
  const handleCommit = () => {
    saveAttendance(currentDate, currentShift, localRecords);
    setIsDirty(false);
    setToastMessage(`Daily log committed successfully for ${currentDate} [${currentShift}]`);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Admin: Create/mention a new floor station
  const handleCreateStation = (e: React.FormEvent) => {
    e.preventDefault();
    setStationAddError('');
    const trimmed = newStationInput.trim();
    if (!trimmed) {
      setStationAddError('Station name cannot be empty');
      return;
    }
    if (stations.includes(trimmed)) {
      setStationAddError('Station already exists');
      return;
    }
    addStation(trimmed);
    setNewStationInput('');
    setToastMessage(`Station "${trimmed}" added successfully.`);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleCreateDepartment = (e: React.FormEvent) => {
    e.preventDefault();
    setDeptAddError('');
    const trimmed = newDeptInput.trim();
    if (!trimmed) {
      setDeptAddError('Department name cannot be empty');
      return;
    }
    if (departments.includes(trimmed)) {
      setDeptAddError('Department already exists');
      return;
    }
    addDepartment(trimmed);
    setNewDeptInput('');
    setToastMessage(`Department "${trimmed}" added successfully.`);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleRenameStation = (oldName: string) => {
    const trimmed = editingStationValue.trim();
    if (!trimmed) {
      setToastMessage('Station name cannot be empty.');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }
    if (stations.includes(trimmed) && trimmed !== oldName) {
      setToastMessage('Station name already exists.');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }
    if (updateStation) {
      updateStation(oldName, trimmed);
      setToastMessage(`Station "${oldName}" renamed to "${trimmed}".`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
    setEditingStationName(null);
  };

  const handleRenameDepartment = (oldName: string) => {
    const trimmed = editingDeptValue.trim();
    if (!trimmed) {
      setToastMessage('Department name cannot be empty.');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }
    if (departments.includes(trimmed) && trimmed !== oldName) {
      setToastMessage('Department name already exists.');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }
    if (updateDepartment) {
      updateDepartment(oldName, trimmed);
      setToastMessage(`Department "${oldName}" renamed to "${trimmed}".`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
    setEditingDeptName(null);
  };

  // Admin: Register a new associate to the master matrix
  const handleAddAssociate = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');

    const trimmedId = newId.trim().toUpperCase();
    const trimmedName = newName.trim();
    const selectedStat = newStation || stations[0];

    if (!trimmedId || !trimmedName || !selectedStat) {
      setAddError('Please fill in all fields.');
      return;
    }

    if (!/^IDRCW\d+$/i.test(trimmedId)) {
      setAddError('Associate ID must match IDRCW### format (e.g. IDRCW009).');
      return;
    }

    if (associates.some(emp => emp.id === trimmedId)) {
      setAddError('An associate with this ID already exists.');
      return;
    }

    addAssociate(trimmedId, trimmedName, newDept || departments[0], selectedStat, newSkill);
    
    // Reset fields
    setNewId('');
    setNewName('');
    setNewDept(departments[0] || '');
    setNewSkill('Operator');
    setShowQuickAdd(false);
    
    // Notify
    setToastMessage(`Pre-assigned ${trimmedName} (${trimmedId}) to station: ${selectedStat}`);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const selectedShiftObj = shifts.find(s => s.id === currentShift);
  const isAdmin = currentUser.role === 'admin';

  return (
    <div id="daily-log-view" className="space-y-6">
      
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900 tracking-tight">
            Daily Operational Log
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Log shop-floor attendance and overtime for specific production dates and shifts.
          </p>
        </div>

        {/* Admin controls toggle buttons */}
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => {
              setShowQuickAdd(!showQuickAdd);
              setShowManageStations(false);
            }}
            className={`flex items-center gap-2 text-xs font-medium px-4 py-2.5 rounded-lg border shadow-sm transition-all duration-150 ${
              showQuickAdd 
                ? 'bg-indigo-600 text-white border-indigo-700' 
                : 'bg-slate-900 hover:bg-slate-850 text-white border-slate-800'
            }`}
          >
            <UserPlus className="h-4 w-4" />
            {showQuickAdd ? 'Collapse Roster Setup' : 'Pre-feed Associate Matrix'}
          </button>

          {isAdmin && (
            <button
              onClick={() => {
                setShowManageStations(!showManageStations);
                setShowQuickAdd(false);
              }}
              className={`flex items-center gap-2 text-xs font-medium px-4 py-2.5 rounded-lg border shadow-sm transition-all duration-150 ${
                showManageStations 
                  ? 'bg-indigo-600 text-white border-indigo-700' 
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              <Settings className="h-4 w-4" />
              {showManageStations ? 'Close Master Config' : 'Configure Stations & Departments'}
            </button>
          )}
        </div>
      </div>

      {/* Admin Action 1: Manage Floor Stations & Department Groups */}
      {isAdmin && showManageStations && (
        <div className="bg-slate-900 text-white border border-slate-800 rounded-xl p-6 shadow-lg animate-fadeIn">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Column 1: Stations */}
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
                <Settings className="h-5 w-5 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Shop Floor Stations Management</h3>
                  <p className="text-[11px] text-slate-400">Mention or create new physical production stations below</p>
                </div>
              </div>

              <form onSubmit={handleCreateStation} className="flex gap-3 items-end">
                <div className="flex-1 space-y-1.5">
                  <label htmlFor="station-input" className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                    New Station Name
                  </label>
                  <input
                    id="station-input"
                    type="text"
                    value={newStationInput}
                    onChange={(e) => setNewStationInput(e.target.value)}
                    placeholder="e.g. Paint Station C"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 text-slate-100 placeholder:text-slate-600 font-sans"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-lg border border-indigo-700 shadow-md transition-all flex items-center gap-1.5 shrink-0 h-9 cursor-pointer"
                >
                  <Plus className="h-4 w-4" /> Add Station
                </button>
              </form>

              {stationAddError && (
                <p className="text-rose-400 text-xs mt-1 font-medium">{stationAddError}</p>
              )}

              <div className="pt-2 font-sans">
                <p className="text-[10px] font-mono uppercase text-slate-400 tracking-wider mb-2">Current Active Stations:</p>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-2">
                  {stations.map(st => (
                    <span key={st} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-semibold text-slate-300">
                      {editingStationName === st ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editingStationValue}
                            onChange={(e) => setEditingStationValue(e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-24"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRenameStation(st);
                              if (e.key === 'Escape') setEditingStationName(null);
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleRenameStation(st)}
                            className="text-emerald-400 hover:text-emerald-300 p-0.5"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingStationName(null)}
                            className="text-slate-400 hover:text-rose-400 p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span>{st}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingStationName(st);
                              setEditingStationValue(st);
                            }}
                            className="text-slate-500 hover:text-indigo-400 p-0.5 rounded hover:bg-slate-900 transition-colors cursor-pointer"
                            title={`Rename ${st}`}
                          >
                            <Settings className="h-3 w-3" />
                          </button>
                          {stations.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                deleteStation(st);
                                setToastMessage(`Station "${st}" has been deleted.`);
                                setShowToast(true);
                                setTimeout(() => setShowToast(false), 3000);
                              }}
                              className="text-slate-500 hover:text-rose-400 p-0.5 rounded hover:bg-slate-900 transition-colors cursor-pointer"
                              title={`Delete ${st}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Column 2: Departments */}
            <div className="space-y-4 border-t lg:border-t-0 lg:border-l border-slate-800 pt-6 lg:pt-0 lg:pl-8">
              <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
                <Layers className="h-5 w-5 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Department Groups Management</h3>
                  <p className="text-[11px] text-slate-400">Configure or create new skill department categories below</p>
                </div>
              </div>

              <form onSubmit={handleCreateDepartment} className="flex gap-3 items-end">
                <div className="flex-1 space-y-1.5">
                  <label htmlFor="dept-input" className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                    New Department Name
                  </label>
                  <input
                    id="dept-input"
                    type="text"
                    value={newDeptInput}
                    onChange={(e) => setNewDeptInput(e.target.value)}
                    placeholder="e.g. Paint Shop"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 text-slate-100 placeholder:text-slate-600 font-sans"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-lg border border-indigo-700 shadow-md transition-all flex items-center gap-1.5 shrink-0 h-9 cursor-pointer"
                >
                  <Plus className="h-4 w-4" /> Add Dept
                </button>
              </form>

              {deptAddError && (
                <p className="text-rose-400 text-xs mt-1 font-medium">{deptAddError}</p>
              )}

              <div className="pt-2 font-sans">
                <p className="text-[10px] font-mono uppercase text-slate-400 tracking-wider mb-2">Current Active Departments:</p>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-2">
                  {departments.map(dept => (
                    <span key={dept} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-semibold text-slate-300">
                      {editingDeptName === dept ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editingDeptValue}
                            onChange={(e) => setEditingDeptValue(e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-24"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRenameDepartment(dept);
                              if (e.key === 'Escape') setEditingDeptName(null);
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleRenameDepartment(dept)}
                            className="text-emerald-400 hover:text-emerald-300 p-0.5"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingDeptName(null)}
                            className="text-slate-400 hover:text-rose-400 p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span>{dept}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDeptName(dept);
                              setEditingDeptValue(dept);
                            }}
                            className="text-slate-500 hover:text-indigo-400 p-0.5 rounded hover:bg-slate-900 transition-colors cursor-pointer"
                            title={`Rename ${dept}`}
                          >
                            <Settings className="h-3 w-3" />
                          </button>
                          {departments.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                deleteDepartment(dept);
                                setToastMessage(`Department "${dept}" has been deleted.`);
                                setShowToast(true);
                                setTimeout(() => setShowToast(false), 3000);
                              }}
                              className="text-slate-500 hover:text-rose-400 p-0.5 rounded hover:bg-slate-900 transition-colors cursor-pointer"
                              title={`Delete ${dept}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Admin Action 2: Pre-feed Associate Matrix (Roster additions with Excel support) */}
      {isAdmin && showQuickAdd && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-white animate-fadeIn font-sans">
          <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3 mb-4">
            <UserPlus className="h-5 w-5 text-indigo-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-100">Pre-feed Associate Matrix Profile</h3>
              <p className="text-[11px] text-slate-400">Register single associates or import multiple entries from spreadsheet cells.</p>
            </div>
          </div>

          {/* Tab Selector */}
          <div className="flex border-b border-slate-800 mb-5">
            <button
              type="button"
              onClick={() => { setAddMethod('single'); setAddError(''); }}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
                addMethod === 'single'
                  ? 'border-indigo-500 text-indigo-400 font-extrabold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Single Associate Form
            </button>
            <button
              type="button"
              onClick={() => { setAddMethod('excel'); setAddError(''); }}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                addMethod === 'excel'
                  ? 'border-indigo-500 text-indigo-400 font-extrabold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-400" /> Import from Excel / Google Sheets
            </button>
          </div>

          {/* Form Method 1: Single registration */}
          {addMethod === 'single' && (
            <form onSubmit={handleAddAssociate} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div className="space-y-1.5">
                <label htmlFor="assoc-id" className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                  Employee ID
                </label>
                <input
                  id="assoc-id"
                  type="text"
                  value={newId}
                  onChange={(e) => setNewId(e.target.value)}
                  placeholder="IDRCW009"
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
              
              <div className="space-y-1.5">
                <label htmlFor="assoc-name" className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                  Full Name
                </label>
                <input
                  id="assoc-name"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="James Carter"
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="assoc-dept" className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                  Skill Department
                </label>
                <select
                  id="assoc-dept"
                  value={newDept}
                  onChange={(e) => setNewDept(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="assoc-station" className="text-[10px] font-mono uppercase tracking-wider text-indigo-300 font-bold block">
                  Pre-feed Station Assignment
                </label>
                <select
                  id="assoc-station"
                  value={newStation}
                  onChange={(e) => setNewStation(e.target.value)}
                  className="w-full bg-slate-950 border border-indigo-950 rounded-lg px-3 py-2 text-xs text-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                >
                  {stations.map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="assoc-skill" className="text-[10px] font-mono uppercase tracking-wider text-amber-300 font-bold block">
                  Skill level / Role
                </label>
                <select
                  id="assoc-skill"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value as 'Operator' | 'Helper')}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="Operator">Operator</option>
                  <option value="Helper">Helper</option>
                </select>
              </div>

              <div className="md:col-span-5 flex justify-end pt-2">
                <button
                  id="btn-submit-quickadd"
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-6 py-2.5 rounded-lg border border-indigo-700 shadow-md transition-all duration-150 h-9 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="h-3.5 w-3.5" /> Confirm Matrix Registration
                </button>
              </div>
            </form>
          )}

          {/* Form Method 2: Excel copy paste bulk import */}
          {addMethod === 'excel' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="bg-slate-950 border border-slate-850 p-4.5 rounded-lg">
                <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5 mb-2">
                  <Info className="h-4 w-4 text-emerald-400" /> Excel / Sheets Integration Guide
                </h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Open your excel spreadsheet, copy your employee table rows (with columns: <code className="text-slate-300 bg-slate-900 px-1 py-0.5 rounded">ID</code>, <code className="text-slate-300 bg-slate-900 px-1 py-0.5 rounded">Name</code>, <code className="text-slate-300 bg-slate-900 px-1 py-0.5 rounded">Department</code>, <code className="text-slate-300 bg-slate-900 px-1 py-0.5 rounded">Station</code>, and optionally <code className="text-slate-300 bg-slate-900 px-1 py-0.5 rounded">Skill</code>), and paste them directly into the input area below. The system will run a validation dry-run check immediately.
                </p>
                <div className="mt-3.5 bg-slate-900 border border-slate-800 rounded p-2.5 text-[10px] font-mono text-slate-500 leading-none">
                  <div className="text-slate-400 font-bold mb-1 border-b border-slate-800 pb-1 flex justify-between">
                    <span>Example spreadsheet format (Tab separated):</span>
                    <span className="text-emerald-500 uppercase">Excel copy-paste friendly</span>
                  </div>
                  IDRCW010 [Tab] Jane Miller [Tab] Welding [Tab] Welding Station [Tab] Operator<br />
                  IDRCW011 [Tab] Robert Chen [Tab] Assembly [Tab] Assembly Line [Tab] Helper
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="excel-paste-input" className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                  Paste Excel Rows Here:
                </label>
                <textarea
                  id="excel-paste-input"
                  rows={4}
                  value={excelInput}
                  onChange={(e) => {
                    const text = e.target.value;
                    setExcelInput(text);
                    if (!text.trim()) {
                      setParsedExcelRows([]);
                      return;
                    }

                    const lines = text.split('\n');
                    const parsed = lines.map((line, idx) => {
                      const trimmedLine = line.trim();
                      if (!trimmedLine) return null;

                      const cols = trimmedLine.split(/\t|,/);
                      const rawId = cols[0]?.trim() || '';
                      const rawName = cols[1]?.trim() || '';
                      const rawDept = cols[2]?.trim() || '';
                      const rawStation = cols[3]?.trim() || '';
                      const rawSkill = cols[4]?.trim() || 'Operator';

                      const empId = rawId.toUpperCase();
                      let error = '';
                      let isValid = true;

                      if (!empId) {
                        error = 'Missing Employee ID';
                        isValid = false;
                      } else if (!/^IDRCW\d+$/i.test(empId)) {
                        error = 'Format must be IDRCW### (e.g. IDRCW010)';
                        isValid = false;
                      } else if (associates.some(e => e.id === empId)) {
                        error = 'ID already exists in master roster';
                        isValid = false;
                      }

                      if (isValid && !rawName) {
                        error = 'Name cannot be empty';
                        isValid = false;
                      }

                      let resolvedDept = departments[0] || 'Assembly';
                      if (isValid && rawDept) {
                        const foundDept = departments.find(
                          d => d.toLowerCase() === rawDept.toLowerCase() || d.toLowerCase() + ' station' === rawDept.toLowerCase()
                        );
                        if (foundDept) resolvedDept = foundDept;
                      }

                      let resolvedStation = stations[0] || 'Assembly Line';
                      if (isValid && rawStation) {
                        const foundStation = stations.find(s => s.toLowerCase() === rawStation.toLowerCase());
                        if (foundStation) resolvedStation = foundStation;
                      }

                      const skillVal: 'Operator' | 'Helper' = (rawSkill.toLowerCase() === 'helper') ? 'Helper' : 'Operator';

                      return {
                        id: empId,
                        name: rawName,
                        department: resolvedDept,
                        station: resolvedStation,
                        skill: skillVal,
                        isValid,
                        error: error || undefined
                      };
                    }).filter(row => row !== null) as any[];

                    setParsedExcelRows(parsed);
                  }}
                  placeholder="IDRCW010&#9;Jane Miller&#9;Welding&#9;Welding Station&#9;Operator&#10;IDRCW011&#9;Robert Chen&#9;Assembly&#9;Assembly Line&#9;Helper"
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3.5 py-2.5 text-xs font-mono text-slate-100 placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Parsed Output Dry-run Preview */}
              {parsedExcelRows.length > 0 && (
                <div className="space-y-2.5 animate-fadeIn">
                  <div className="flex items-center justify-between text-xs px-1">
                    <span className="font-bold text-slate-300">
                      Import Dry-Run Report ({parsedExcelRows.filter(r => r.isValid).length} ready, {parsedExcelRows.filter(r => !r.isValid).length} invalid)
                    </span>
                    <button
                      type="button"
                      onClick={() => { setExcelInput(''); setParsedExcelRows([]); }}
                      className="text-slate-500 hover:text-slate-300 text-[10px] font-mono uppercase"
                    >
                      Clear All
                    </button>
                  </div>

                  <div className="max-h-56 overflow-y-auto border border-slate-800 rounded-lg bg-slate-950/40 font-sans">
                    <table className="w-full text-left border-collapse text-[11px] font-sans">
                      <thead className="bg-slate-900 text-slate-400 font-mono text-[9px] uppercase tracking-wider sticky top-0 border-b border-slate-800">
                        <tr>
                          <th className="p-2.5">ID</th>
                          <th className="p-2.5">Name</th>
                          <th className="p-2.5">Department</th>
                          <th className="p-2.5">Station</th>
                          <th className="p-2.5">Skill</th>
                          <th className="p-2.5 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850 text-slate-300">
                        {parsedExcelRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-900/50">
                            <td className="p-2.5 font-mono">{row.id}</td>
                            <td className="p-2.5 font-semibold text-slate-100">{row.name}</td>
                            <td className="p-2.5">{row.department}</td>
                            <td className="p-2.5 text-indigo-300">{row.station}</td>
                            <td className="p-2.5">
                              <span className={`inline-block px-2 py-0.5 text-[9px] font-bold rounded ${
                                row.skill === 'Operator' ? 'bg-indigo-950 text-indigo-300 border border-indigo-900/40' : 'bg-amber-950 text-amber-300 border border-amber-900/40'
                              }`}>
                                {row.skill}
                              </span>
                            </td>
                            <td className="p-2.5 text-right">
                              {row.isValid ? (
                                <span className="inline-flex items-center gap-1 bg-emerald-950/40 border border-emerald-900 text-emerald-400 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                                  <Check className="h-2.5 w-2.5" /> Ready
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-rose-950/40 border border-rose-900 text-rose-400 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase" title={row.error}>
                                  <X className="h-2.5 w-2.5" /> Error: {row.error}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      disabled={parsedExcelRows.filter(r => r.isValid).length === 0}
                      onClick={() => {
                        const validRows = parsedExcelRows.filter(r => r.isValid);
                        let count = 0;
                        validRows.forEach(row => {
                          if (!associates.some(emp => emp.id === row.id)) {
                            addAssociate(row.id, row.name, row.department, row.station, row.skill);
                            count++;
                          }
                        });
                        setExcelInput('');
                        setParsedExcelRows([]);
                        setShowQuickAdd(false);
                        setToastMessage(`Successfully imported ${count} associates from Excel.`);
                        setShowToast(true);
                        setTimeout(() => setShowToast(false), 3000);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold px-6 py-2.5 rounded-lg shadow-md transition-all flex items-center gap-1.5 h-9 cursor-pointer"
                    >
                      <Check className="h-4 w-4" /> Import Valid Entries ({parsedExcelRows.filter(r => r.isValid).length})
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {addError && (
            <div className="flex items-center gap-1.5 text-xs text-rose-400 font-medium mt-3 bg-rose-950/20 border border-rose-950/40 p-2.5 rounded-lg">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {addError}
            </div>
          )}
        </div>
      )}

      {/* Date and Shift Active Scope selector panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-center bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm">
        <div className="space-y-1.5">
          <label htmlFor="log-date-selector" className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" /> Production Date
          </label>
          <input
            id="log-date-selector"
            type="date"
            value={currentDate}
            onChange={(e) => setCurrentDate(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="shift-selector" className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> Operating Shift
          </label>
          <select
            id="shift-selector"
            value={currentShift}
            onChange={(e) => setCurrentShift(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
          >
            {shifts.map(shift => (
              <option key={shift.id} value={shift.id}>
                {shift.name} ({shift.time})
              </option>
            ))}
          </select>
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col justify-center h-full self-stretch">
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-semibold block leading-none">Selected Shift Scope:</span>
          <span className="font-display font-semibold text-slate-800 text-sm mt-1.5">
            {new Date(currentDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <span className="font-mono text-xs text-indigo-600 font-semibold mt-1">
            {selectedShiftObj?.name} (Starts {selectedShiftObj?.time})
          </span>
        </div>
      </div>

      {/* Unsaved Scratch Warning Flag */}
      {isDirty && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-amber-800 animate-pulse">
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm">Unsaved Local Changes Detected</h4>
            <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
              You have modified attendance selections or overtime values. Click <strong>"Commit & Save Daily Log"</strong> in the bottom banner to record these to persistent memory.
            </p>
          </div>
        </div>
      )}

      {/* View Switcher & Quick Bulk Selection Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/80 rounded-xl p-4.5 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-bold text-slate-500 font-mono uppercase tracking-wide">Log Layout Mode:</span>
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('matrix')}
              className={`text-xs font-bold px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'matrix' 
                  ? 'bg-white text-indigo-650 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Grid className="h-3.5 w-3.5" />
              Tabular Matrix
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`text-xs font-bold px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'cards' 
                  ? 'bg-white text-indigo-650 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              Station Cards
            </button>
          </div>
        </div>

        {/* Quick Bulk Selection Tools */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              const listToMark = viewMode === 'matrix' ? filteredAssociatesForView() : associates.filter(e => e.status === 'Active');
              setLocalRecords(prev => {
                const next = { ...prev };
                listToMark.forEach(emp => {
                  next[emp.id] = {
                    isPresent: true,
                    overtimeHours: prev[emp.id]?.overtimeHours || 0
                  };
                });
                setIsDirty(true);
                return next;
              });
              setToastMessage(`Marked all ${listToMark.length} associates as Present.`);
              setShowToast(true);
              setTimeout(() => setShowToast(false), 2000);
            }}
            className="text-xs font-semibold px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
          >
            Mark All Present
          </button>
          <button
            type="button"
            onClick={() => {
              const listToReset = viewMode === 'matrix' ? filteredAssociatesForView() : associates.filter(e => e.status === 'Active');
              setLocalRecords(prev => {
                const next = { ...prev };
                listToReset.forEach(emp => {
                  next[emp.id] = {
                    isPresent: false,
                    overtimeHours: 0
                  };
                });
                setIsDirty(true);
                return next;
              });
              setToastMessage(`Reset attendance for ${listToReset.length} associates.`);
              setShowToast(true);
              setTimeout(() => setShowToast(false), 2000);
            }}
            className="text-xs font-semibold px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Reset/Clear Selections
          </button>
        </div>
      </div>

      {/* View Filters Panel for high-density matrix */}
      {viewMode === 'matrix' && (
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4 animate-fadeIn">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by associate name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase shrink-0">Filter Station:</span>
            <select
              value={stationFilter}
              onChange={(e) => setStationFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="All">All Stations ({stations.length})</option>
              {stations.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase shrink-0">Filter Dept:</span>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="All">All Departments ({departments.length})</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Main Section: Station-wise lists of prefeeded associates or Matrix Table */}
      <div className="space-y-6">
        {viewMode === 'matrix' ? (
          /* TABULAR MATRIX VIEW (Editable Table Grid as Requested) */
          <div className="bg-white border border-slate-200/80 rounded-xl shadow-sm overflow-hidden animate-fadeIn">
            <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
              <span className="font-display font-bold text-sm text-slate-800 flex items-center gap-2">
                <Grid className="h-4.5 w-4.5 text-indigo-500" />
                Workforce Attendance & Overtime Matrix
              </span>
              <span className="text-[10px] font-mono text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">
                {filteredAssociatesForView().length} active matching rows
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 text-slate-500 font-mono text-[9px] uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3.5 text-center w-12">Present</th>
                    <th className="p-3.5 w-24">Associate ID</th>
                    <th className="p-3.5">Full Name</th>
                    <th className="p-3.5">Department</th>
                    <th className="p-3.5">Floor Station</th>
                    <th className="p-3.5">Skill</th>
                    <th className="p-3.5">Operational Status</th>
                    <th className="p-3.5 w-44">Overtime Hours</th>
                    {isAdmin && <th className="p-3.5 text-center w-16">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAssociatesForView().length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 9 : 8} className="p-12 text-center text-slate-400">
                        <UserX className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                        <p className="text-sm font-medium">No matching active associates found.</p>
                        <p className="text-[11px] text-slate-400 mt-1">Try resetting filters or adding new associates in the top matrix setup form.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredAssociatesForView().map(emp => {
                      const rec = localRecords[emp.id] || { isPresent: false, overtimeHours: 0 };
                      const isPresent = rec.isPresent;
                      const empStation = emp.station || (emp.department + ' Station');

                      return (
                        <tr 
                          key={emp.id} 
                          className={`hover:bg-slate-50/40 transition-colors ${
                            isPresent ? 'bg-indigo-50/10' : ''
                          }`}
                        >
                          {/* Checked Checkbox */}
                          <td className="p-3.5 text-center">
                            <input
                              id={`tbl-select-${emp.id}`}
                              type="checkbox"
                              checked={isPresent}
                              onChange={(e) => handleToggleAttendance(emp.id, e.target.checked)}
                              className="h-4.5 w-4.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </td>

                          {/* ID */}
                          <td className="p-3.5 font-mono text-slate-500 font-medium">
                            {emp.id}
                          </td>

                          {/* Name */}
                          <td className="p-3.5 font-semibold text-slate-800">
                            {emp.name}
                          </td>

                          {/* Department */}
                          <td className="p-3.5">
                            <span className="inline-block bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              {emp.department}
                            </span>
                          </td>

                          {/* Floor Station */}
                          <td className="p-3.5 font-medium text-slate-600">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
                              {empStation}
                            </span>
                          </td>

                          {/* Skill badge */}
                          <td className="p-3.5">
                            <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded ${
                              emp.skill === 'Operator' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                            }`}>
                              {emp.skill || 'Operator'}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="p-3.5">
                            {isPresent ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-100 text-[10px] font-bold px-2 py-0.5 rounded">
                                <UserCheck className="h-3 w-3" /> Present
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-slate-400 bg-slate-50 border border-slate-200/40 text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                                <UserX className="h-3 w-3" /> Absent
                              </span>
                            )}
                          </td>

                          {/* Overtime Selector */}
                          <td className="p-3.5">
                            {isPresent ? (
                              <div className="flex items-center gap-2 animate-fadeIn">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextVal = Math.max(0, rec.overtimeHours - 0.5);
                                    handleOvertimeChange(emp.id, nextVal.toString());
                                  }}
                                  className="h-7 w-7 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-600 font-bold rounded flex items-center justify-center cursor-pointer transition-colors"
                                >
                                  -
                                </button>
                                <input
                                  id={`tbl-ot-${emp.id}`}
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max="8"
                                  value={rec.overtimeHours}
                                  onChange={(e) => handleOvertimeChange(emp.id, e.target.value)}
                                  className="w-16 text-center text-xs font-mono font-bold py-1.5 bg-white border border-indigo-200 text-indigo-750 focus:ring-2 focus:ring-indigo-550/20 focus:outline-none focus:border-indigo-500 rounded-md"
                                  placeholder="0.0"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextVal = Math.min(8, rec.overtimeHours + 0.5);
                                    handleOvertimeChange(emp.id, nextVal.toString());
                                  }}
                                  className="h-7 w-7 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-600 font-bold rounded flex items-center justify-center cursor-pointer transition-colors"
                                >
                                  +
                                </button>
                                <span className="text-[10px] text-slate-400 font-mono">hours</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Select present to enable</span>
                            )}
                          </td>

                          {/* Actions */}
                          {isAdmin && (
                            <td className="p-3.5 text-center">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteAssociate(emp.id);
                                  setToastMessage(`Associate "${emp.name}" has been deleted.`);
                                  setShowToast(true);
                                  setTimeout(() => setShowToast(false), 3000);
                                }}
                                className="text-slate-400 hover:text-rose-650 p-1.5 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                title="Delete Associate Profile"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ORIGINAL STATION CARDS VIEW */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn">
            {stations.map(station => {
              // Find associates pre-assigned to this station
              const prefeededAssociates = associates.filter(
                emp => emp.status === 'Active' && (emp.station === station || (!emp.station && (emp.department + ' Station' === station || emp.department === station)))
              );

              return (
                <div 
                  key={station}
                  className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow"
                >
                  {/* Station Card Title */}
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <span className="font-display font-bold text-sm text-slate-800 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-indigo-500 shrink-0"></span>
                      {station}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {prefeededAssociates.length} pre-assigned
                    </span>
                  </div>

                  {/* Station Associates Checklist List */}
                  <div className="p-4 flex-1 space-y-2.5">
                    {prefeededAssociates.length === 0 ? (
                      <div className="h-32 border-2 border-dashed border-slate-150 rounded-xl flex flex-col items-center justify-center p-4 text-center">
                        <span className="text-xs text-slate-400 font-medium">No associates prefeeded to this station.</span>
                        {isAdmin && (
                          <p className="text-[10px] text-indigo-500 mt-1 cursor-pointer hover:underline" onClick={() => setShowQuickAdd(true)}>
                            Assign an associate now →
                          </p>
                        )}
                      </div>
                    ) : (
                      prefeededAssociates.map(emp => {
                        const rec = localRecords[emp.id] || { isPresent: false, overtimeHours: 0 };
                        const isPresent = rec.isPresent;

                        return (
                          <div 
                            key={emp.id}
                            className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-150 ${
                              isPresent 
                                ? 'bg-indigo-50/40 border-indigo-150 text-slate-800' 
                                : 'bg-slate-50/50 border-slate-100 text-slate-400'
                            }`}
                          >
                            {/* Left: Checkbox & Name Selection */}
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <input
                                id={`select-assoc-${emp.id}`}
                                type="checkbox"
                                checked={isPresent}
                                onChange={(e) => handleToggleAttendance(emp.id, e.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 text-indigo-650 focus:ring-indigo-500 cursor-pointer shrink-0"
                              />
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <label 
                                  htmlFor={`select-assoc-${emp.id}`}
                                  className="text-xs font-semibold select-none cursor-pointer truncate block"
                                >
                                  <span className={isPresent ? 'text-slate-900' : 'text-slate-500'}>
                                    {emp.name}
                                  </span>
                                  <span className={`inline-block px-1.5 py-0.2 ml-1 text-[9px] font-bold rounded ${
                                    emp.skill === 'Operator' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
                                  }`}>
                                    {emp.skill === 'Operator' ? 'OP' : 'HLP'}
                                  </span>
                                  <span className="font-mono text-[10px] text-slate-400 ml-1.5 font-normal">
                                    ({emp.id})
                                  </span>
                                </label>
                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteAssociate(emp.id);
                                      setToastMessage(`Associate "${emp.name}" has been deleted.`);
                                      setShowToast(true);
                                      setTimeout(() => setShowToast(false), 3000);
                                    }}
                                    className="text-slate-400 hover:text-rose-650 p-1 rounded transition-colors ml-1 cursor-pointer flex items-center justify-center shrink-0"
                                    title="Permanently Delete Associate"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Right: Overtime selection and Presence status badge */}
                            <div className="flex items-center gap-3 shrink-0">
                              {isPresent ? (
                                <div className="flex items-center gap-1.5 animate-fadeIn">
                                  <span className="text-[10px] font-mono font-bold text-indigo-500 tracking-wider uppercase">
                                    + OT:
                                  </span>
                                  <input
                                    id={`input-ot-${emp.id}`}
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="8"
                                    value={rec.overtimeHours}
                                    onChange={(e) => handleOvertimeChange(emp.id, e.target.value)}
                                    className="w-16 text-center text-xs font-mono font-bold px-1.5 py-1 bg-white border border-indigo-200 text-indigo-750 focus:ring-2 focus:ring-indigo-550/20 focus:outline-none focus:border-indigo-500 rounded-md"
                                    placeholder="0.0"
                                  />
                                  <span className="text-[10px] text-slate-400 font-mono">h</span>
                                </div>
                              ) : (
                                <span className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase bg-slate-100 border border-slate-200/40 px-2 py-0.5 rounded">
                                  Absent
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="h-16"></div>

      {/* Persistent Floating Bottom Action Control Bar */}
      <div className="fixed bottom-0 left-80 right-0 bg-white border-t border-slate-200 px-8 py-4 shadow-[0_-10px_25px_-5px_rgba(0,0,0,0.05)] flex items-center justify-between z-40">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-md ${isDirty ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
            <FileCheck className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-800 leading-tight">
              {isDirty ? 'Unsaved Floor Record Selections Pending' : 'Database Fully Synchronized'}
            </p>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5 uppercase tracking-wide">
              {currentDate} • {selectedShiftObj?.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isDirty && (
            <span className="text-xs text-amber-600 font-medium font-mono animate-pulse hidden sm:inline">
              Changes not saved to local storage *
            </span>
          )}
          <button
            id="btn-commit-daily-log"
            type="button"
            onClick={handleCommit}
            className={`font-semibold text-xs px-6 py-3 rounded-lg shadow-sm transition-all duration-200 flex items-center gap-2 ${
              isDirty 
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-700 cursor-pointer shadow-indigo-600/10 hover:shadow-indigo-600/20 shadow-lg' 
                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
            }`}
            disabled={!isDirty}
          >
            <Check className="h-4 w-4" /> Commit & Save Daily Log
          </button>
        </div>
      </div>

      {/* Floating Success Toast Message */}
      {showToast && (
        <div id="toast-success" className="fixed top-6 right-6 bg-slate-900 border border-slate-800 text-indigo-400 px-5 py-4 rounded-xl shadow-2xl flex items-center gap-3 z-50 animate-bounce duration-500 max-w-sm">
          <div className="h-6 w-6 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
            <Check className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-white leading-tight">Database Synchronized</p>
            <p className="text-[11px] text-slate-400 mt-1">{toastMessage}</p>
          </div>
        </div>
      )}

    </div>
  );
}
