import React, { useState } from 'react';
import { 
  Shield, 
  Lock, 
  Settings, 
  Clock, 
  Plus, 
  Trash2, 
  Edit2, 
  Building, 
  Check, 
  AlertCircle, 
  Key, 
  User,
  Users,
  Layers,
  FileSpreadsheet,
  LogOut,
  Globe,
  RefreshCw
} from 'lucide-react';
import { Shift, Associate } from '../types';
import { createSpreadsheet } from '../services/googleSheets';

interface SystemSettingsProps {
  orgName: string;
  changeOrgName: (name: string) => void;
  credentials: any;
  updateCredentials: (role: 'admin' | 'engineer', name: string, password: string) => void;
  shifts: Shift[];
  addShift: (name: string, time: string) => void;
  updateShift: (id: string, name: string, time: string) => void;
  deleteShift: (id: string) => void;
  associates: Associate[];
  deleteAssociate: (id: string) => void;
  currentUser: { name: string; role: 'admin' | 'engineer' };
  departments: string[];
  addDepartment: (name: string) => void;
  deleteDepartment: (name: string) => void;
  updateDepartment?: (oldName: string, newName: string) => void;
  // Google Sheets props
  sheetUser: any;
  sheetToken: string | null;
  onGoogleLogin: () => Promise<void>;
  onGoogleLogout: () => Promise<void>;
  spreadsheetId: string;
  setSpreadsheetId: (id: string) => void;
  sheetsSyncEnabled: boolean;
  setSheetsSyncEnabled: (enabled: boolean) => void;
}

export default function SystemSettings({
  orgName,
  changeOrgName,
  credentials,
  updateCredentials,
  shifts,
  addShift,
  updateShift,
  deleteShift,
  associates,
  deleteAssociate,
  currentUser,
  departments,
  addDepartment,
  deleteDepartment,
  updateDepartment,
  sheetUser,
  sheetToken,
  onGoogleLogin,
  onGoogleLogout,
  spreadsheetId,
  setSpreadsheetId,
  sheetsSyncEnabled,
  setSheetsSyncEnabled
}: SystemSettingsProps) {
  // Tabs: 'profile', 'organization', 'shifts', 'associates', 'departments', 'sheets'
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'organization' | 'shifts' | 'associates' | 'departments' | 'sheets'>('profile');
  
  // Google Sheets state
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);

  // Toast notifications state
  const [toast, setToast] = useState<{ show: boolean; msg: string; type: 'success' | 'error' }>({ show: false, msg: '', type: 'success' });
  const triggerToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  // Credential states
  const [adminName, setAdminName] = useState(credentials?.admin?.name || '');
  const [adminPass, setAdminPass] = useState(credentials?.admin?.password || '');
  const [engName, setEngName] = useState(credentials?.engineer?.name || '');
  const [engPass, setEngPass] = useState(credentials?.engineer?.password || '');

  // Organization state
  const [tempOrgName, setTempOrgName] = useState(orgName);

  // Shift form states
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [newShiftName, setNewShiftName] = useState('');
  const [newShiftTime, setNewShiftTime] = useState('08:00');

  // Department editing state
  const [editingDeptName, setEditingDeptName] = useState<string | null>(null);
  const [editingDeptValue, setEditingDeptValue] = useState<string>('');

  // Associate directory state
  const [searchQuery, setSearchQuery] = useState('');

  // Handlers
  const handleUpdateAdminCreds = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminName.trim()) {
      triggerToast('Administrator display name cannot be empty', 'error');
      return;
    }
    if (!adminPass || adminPass.length < 3) {
      triggerToast('Password must be at least 3 characters', 'error');
      return;
    }
    updateCredentials('admin', adminName.trim(), adminPass);
    triggerToast('Administrator profile updated successfully!');
  };

  const handleUpdateEngCreds = (e: React.FormEvent) => {
    e.preventDefault();
    if (!engName.trim()) {
      triggerToast('Shift Engineer display name cannot be empty', 'error');
      return;
    }
    if (!engPass || engPass.length < 3) {
      triggerToast('Password must be at least 3 characters', 'error');
      return;
    }
    updateCredentials('engineer', engName.trim(), engPass);
    triggerToast('Shift Engineer profile updated successfully!');
  };

  const handleUpdateOrg = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempOrgName.trim()) {
      triggerToast('Organization name cannot be empty', 'error');
      return;
    }
    changeOrgName(tempOrgName.trim());
    triggerToast('Organization name updated successfully!');
  };

  const handleAddOrUpdateShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShiftName.trim()) {
      triggerToast('Shift name is required', 'error');
      return;
    }
    if (!newShiftTime) {
      triggerToast('Shift timing is required', 'error');
      return;
    }

    if (editingShiftId) {
      updateShift(editingShiftId, newShiftName.trim(), newShiftTime);
      triggerToast(`Shift "${newShiftName}" updated successfully.`);
      setEditingShiftId(null);
    } else {
      addShift(newShiftName.trim(), newShiftTime);
      triggerToast(`New shift "${newShiftName}" added.`);
    }

    setNewShiftName('');
    setNewShiftTime('08:00');
  };

  const startEditShift = (shift: Shift) => {
    setEditingShiftId(shift.id);
    setNewShiftName(shift.name);
    setNewShiftTime(shift.time);
  };

  const cancelEditShift = () => {
    setEditingShiftId(null);
    setNewShiftName('');
    setNewShiftTime('08:00');
  };

  const filteredAssociates = associates.filter(emp => 
    emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (emp.station && emp.station.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div id="system-settings-view" className="space-y-6">
      
      {/* Header */}
      <div>
        <h2 className="text-2xl font-display font-bold text-slate-900 tracking-tight">
          System Administration
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Manage system security credentials, organization branding, operating shifts, and master associate rosters.
        </p>
      </div>

      {/* Main Tab Container */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col md:flex-row min-h-[500px]">
        
        {/* Left Sub-Navigation Sidebar */}
        <div className="w-full md:w-64 bg-slate-50 border-r border-slate-200 p-4 space-y-1 select-none flex-shrink-0">
          <span className="px-3 text-[10px] font-mono tracking-wider text-slate-400 uppercase block mb-2">
            Settings Sections
          </span>
          
          <button
            onClick={() => setActiveSubTab('profile')}
            className={`w-full text-left px-3.5 py-3 rounded-lg text-xs font-semibold flex items-center gap-2.5 transition-all ${
              activeSubTab === 'profile' 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/10' 
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Lock className="h-4 w-4" />
            Security & Accounts
          </button>

          <button
            onClick={() => setActiveSubTab('organization')}
            className={`w-full text-left px-3.5 py-3 rounded-lg text-xs font-semibold flex items-center gap-2.5 transition-all ${
              activeSubTab === 'organization' 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/10' 
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Building className="h-4 w-4" />
            Organization Branding
          </button>

          <button
            onClick={() => setActiveSubTab('shifts')}
            className={`w-full text-left px-3.5 py-3 rounded-lg text-xs font-semibold flex items-center gap-2.5 transition-all ${
              activeSubTab === 'shifts' 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/10' 
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Clock className="h-4 w-4" />
            Operating Shifts & Hours
          </button>

          <button
            onClick={() => setActiveSubTab('associates')}
            className={`w-full text-left px-3.5 py-3 rounded-lg text-xs font-semibold flex items-center gap-2.5 transition-all ${
              activeSubTab === 'associates' 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/10' 
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Users className="h-4 w-4" />
            Master Roster Directory
          </button>

          <button
            onClick={() => setActiveSubTab('departments')}
            className={`w-full text-left px-3.5 py-3 rounded-lg text-xs font-semibold flex items-center gap-2.5 transition-all ${
              activeSubTab === 'departments' 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/10' 
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Layers className="h-4 w-4" />
            Department Groups
          </button>

          <button
            onClick={() => setActiveSubTab('sheets')}
            className={`w-full text-left px-3.5 py-3 rounded-lg text-xs font-semibold flex items-center gap-2.5 transition-all ${
              activeSubTab === 'sheets' 
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/10' 
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Google Sheets Sync
          </button>
        </div>

        {/* Right Active Sub-Tab Form Panel */}
        <div className="flex-1 p-6 md:p-8">
          
          {/* Sub-Tab 1: Profile and Passwords */}
          {activeSubTab === 'profile' && (
            <div className="space-y-8 max-w-2xl animate-fadeIn">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-indigo-500" /> Identity and Password Credentials
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Change public display names and system access passwords for authentication stages.
                </p>
              </div>

              {/* Form 1: Admin account */}
              <form onSubmit={handleUpdateAdminCreds} className="space-y-4 bg-slate-50 p-5 rounded-xl border border-slate-200">
                <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase block tracking-wider">
                  System Administrator Account Settings
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold block">
                      Admin Name / Title
                    </label>
                    <input
                      type="text"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      placeholder="e.g. S. Kowalski (Admin)"
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-sans font-medium"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold block">
                      Security Password
                    </label>
                    <input
                      type="password"
                      value={adminPass}
                      onChange={(e) => setAdminPass(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-mono"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] px-4 py-2 rounded-lg border border-slate-800 shadow-sm transition-all h-8 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Check className="h-3.5 w-3.5" /> Save Administrator Details
                  </button>
                </div>
              </form>

              {/* Form 2: Engineer account */}
              <form onSubmit={handleUpdateEngCreds} className="space-y-4 bg-slate-50 p-5 rounded-xl border border-slate-200">
                <span className="text-[10px] font-mono font-bold text-emerald-600 uppercase block tracking-wider">
                  Shift Engineer Account Settings
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold block">
                      Engineer Name / Title
                    </label>
                    <input
                      type="text"
                      value={engName}
                      onChange={(e) => setEngName(e.target.value)}
                      placeholder="e.g. J. Carter (Engineer)"
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-sans font-medium"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold block">
                      Security Password
                    </label>
                    <input
                      type="password"
                      value={engPass}
                      onChange={(e) => setEngPass(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-mono"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] px-4 py-2 rounded-lg border border-slate-800 shadow-sm transition-all h-8 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Check className="h-3.5 w-3.5" /> Save Engineer Details
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Sub-Tab 2: Organization Name */}
          {activeSubTab === 'organization' && (
            <form onSubmit={handleUpdateOrg} className="space-y-6 max-w-xl animate-fadeIn">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Building className="h-4 w-4 text-indigo-500" /> Organization Configuration
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Change the main manufacturing plant or company name displayed on headers, sign-in flows, and system printouts.
                </p>
              </div>

              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="input-org-name" className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold block">
                    Manufacturing Plant / Organization Name
                  </label>
                  <input
                    id="input-org-name"
                    type="text"
                    value={tempOrgName}
                    onChange={(e) => setTempOrgName(e.target.value)}
                    placeholder="e.g. OPUS | MES"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-bold"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-lg border border-indigo-700 shadow-md transition-all h-9 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Check className="h-4 w-4" /> Save Organization Name
                  </button>
                </div>
              </div>

              <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-lg text-[11px] text-indigo-700 leading-relaxed flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                <p>
                  <strong>Visual Impact:</strong> Saving this form instantly updates all system dashboards, sidebar banners, print summaries, and the identity login portal to reflect the customized organization name.
                </p>
              </div>
            </form>
          )}

          {/* Sub-Tab 3: Dynamic Shifts */}
          {activeSubTab === 'shifts' && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-indigo-500" /> Shop Floor Shift Configurations
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Add, update, or remove active operating shifts and custom work schedules bound to operational logs.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Form Panel: Add / Edit Shift */}
                <form onSubmit={handleAddOrUpdateShift} className="lg:col-span-1 bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4 h-fit">
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase block tracking-wider">
                    {editingShiftId ? 'Edit Active Shift' : 'Add New Active Shift'}
                  </span>
                  
                  <div className="space-y-1.5">
                    <label htmlFor="shift-name-input" className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold block">
                      Shift Name
                    </label>
                    <input
                      id="shift-name-input"
                      type="text"
                      value={newShiftName}
                      onChange={(e) => setNewShiftName(e.target.value)}
                      placeholder="e.g. Shift D (Weekend)"
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-sans font-semibold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="shift-time-input" className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold block">
                      Shift Starts (HH:MM)
                    </label>
                    <input
                      id="shift-time-input"
                      type="text"
                      value={newShiftTime}
                      onChange={(e) => setNewShiftTime(e.target.value)}
                      placeholder="e.g. 18:00"
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-mono"
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    {editingShiftId && (
                      <button
                        type="button"
                        onClick={cancelEditShift}
                        className="bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs px-4 py-2 rounded-lg border border-slate-200 transition-all h-8 flex items-center justify-center cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-lg border border-indigo-700 shadow-md transition-all h-8 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" /> {editingShiftId ? 'Update' : 'Register Shift'}
                    </button>
                  </div>
                </form>

                {/* Right Lists: Current active shifts */}
                <div className="lg:col-span-2 space-y-3.5">
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase block tracking-wider px-1">
                    Registered Active Operating Shifts ({shifts.length})
                  </span>

                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-mono text-[9px] uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="p-3.5">Shift Code ID</th>
                          <th className="p-3.5">Shift Name</th>
                          <th className="p-3.5">Start Timing</th>
                          <th className="p-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 font-sans font-medium">
                        {shifts.map((st) => (
                          <tr key={st.id} className="hover:bg-slate-50/50">
                            <td className="p-3.5 font-mono text-slate-500 text-[11px]">{st.id}</td>
                            <td className="p-3.5 font-bold text-slate-800">{st.name}</td>
                            <td className="p-3.5 font-mono text-indigo-600">{st.time}</td>
                            <td className="p-3.5 text-right flex gap-1.5 justify-end">
                              <button
                                type="button"
                                onClick={() => startEditShift(st)}
                                className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded transition-colors"
                                title="Edit Shift Details"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              {shifts.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    deleteShift(st.id);
                                    triggerToast(`Shift "${st.name}" has been deleted.`);
                                  }}
                                  className="text-rose-500 hover:bg-rose-50 p-1.5 rounded transition-colors"
                                  title="Delete Shift Code"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sub-Tab 4: Master Roster Deletion */}
          {activeSubTab === 'associates' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Users className="h-4 w-4 text-indigo-500" /> Master Roster Directory ({associates.length})
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Direct access to delete associate profiles from the plant-wide manufacturing execution matrix.
                  </p>
                </div>
                
                {/* Search query */}
                <input
                  type="text"
                  placeholder="Search name, ID, or station..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-60 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
                />
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white max-h-[400px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-mono text-[9px] uppercase tracking-wider border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="p-3.5">Employee ID</th>
                      <th className="p-3.5">Full Name</th>
                      <th className="p-3.5">Department</th>
                      <th className="p-3.5">Pre-Feed Station</th>
                      <th className="p-3.5">Skill</th>
                      <th className="p-3.5 text-right">Operational Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-sans font-medium">
                    {filteredAssociates.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400">
                          No matching registered associates found in roster.
                        </td>
                      </tr>
                    ) : (
                      filteredAssociates.map((emp) => (
                        <tr key={emp.id} className="hover:bg-slate-50/50">
                          <td className="p-3.5 font-mono font-bold text-slate-500 text-[11px]">{emp.id}</td>
                          <td className="p-3.5 font-bold text-slate-800 text-xs">{emp.name}</td>
                          <td className="p-3.5">{emp.department}</td>
                          <td className="p-3.5 text-indigo-600">{emp.station || 'Default'}</td>
                          <td className="p-3.5">
                            <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded ${
                              emp.skill === 'Operator' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                            }`}>
                              {emp.skill || 'Operator'}
                            </span>
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                deleteAssociate(emp.id);
                                triggerToast(`Associate "${emp.name}" has been permanently deleted.`);
                              }}
                              className="text-rose-500 hover:bg-rose-50 px-2.5 py-1.5 rounded transition-all flex items-center gap-1.5 ml-auto text-[11px] border border-transparent hover:border-rose-100 cursor-pointer"
                              title="Delete Associate Profile"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-Tab 5: Department Groups */}
          {activeSubTab === 'departments' && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-indigo-500" /> Department Groups ({departments.length})
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Configure department categories. Only System Administrators can register or remove department groups.
                </p>
              </div>

              {currentUser.role === 'admin' ? (
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    const inputEl = document.getElementById('new-dept-input') as HTMLInputElement;
                    const val = inputEl?.value.trim();
                    if (!val) {
                      triggerToast('Department name is required', 'error');
                      return;
                    }
                    if (departments.includes(val)) {
                      triggerToast('Department already exists', 'error');
                      return;
                    }
                    addDepartment(val);
                    triggerToast(`Department "${val}" added successfully.`);
                    if (inputEl) inputEl.value = '';
                  }}
                  className="space-y-4 bg-slate-50 p-5 rounded-xl border border-slate-200"
                >
                  <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase block tracking-wider">
                    Register New Department
                  </span>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      id="new-dept-input"
                      type="text"
                      placeholder="e.g. Paint Shop, Foundry"
                      className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-sans font-medium"
                    />
                    <button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer h-9 shrink-0"
                    >
                      <Plus className="h-4 w-4" /> Add Department
                    </button>
                  </div>
                </form>
              ) : (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 text-amber-800 text-xs">
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold">Access Restricted</span>
                    <p className="text-amber-600 mt-0.5">
                      You are logged in as an Engineer. Dynamic department group additions are restricted to Admin writes.
                    </p>
                  </div>
                </div>
              )}

              {/* Department list */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-mono text-[9px] uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">Department Name</th>
                      <th className="p-3.5">Total Members</th>
                      {currentUser.role === 'admin' && <th className="p-3.5 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-sans font-medium">
                    {departments.map((dept) => {
                      const membersCount = associates.filter(a => a.department === dept).length;
                      const isEditing = editingDeptName === dept;
                      return (
                        <tr key={dept} className="hover:bg-slate-50/50">
                          <td className="p-3.5 font-bold text-slate-800 text-xs">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editingDeptValue}
                                onChange={(e) => setEditingDeptValue(e.target.value)}
                                className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-850 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans font-medium"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    if (!editingDeptValue.trim()) {
                                      triggerToast('Department name is required', 'error');
                                      return;
                                    }
                                    if (departments.includes(editingDeptValue.trim()) && editingDeptValue.trim() !== dept) {
                                      triggerToast('Department name already exists', 'error');
                                      return;
                                    }
                                    if (updateDepartment) {
                                      updateDepartment(dept, editingDeptValue.trim());
                                      triggerToast(`Department renamed to "${editingDeptValue.trim()}"`);
                                    }
                                    setEditingDeptName(null);
                                  } else if (e.key === 'Escape') {
                                    setEditingDeptName(null);
                                  }
                                }}
                              />
                            ) : (
                              dept
                            )}
                          </td>
                          <td className="p-3.5 font-mono text-slate-500">{membersCount} members</td>
                          {currentUser.role === 'admin' && (
                            <td className="p-3.5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {isEditing ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!editingDeptValue.trim()) {
                                          triggerToast('Department name is required', 'error');
                                          return;
                                        }
                                        if (departments.includes(editingDeptValue.trim()) && editingDeptValue.trim() !== dept) {
                                          triggerToast('Department name already exists', 'error');
                                          return;
                                        }
                                        if (updateDepartment) {
                                          updateDepartment(dept, editingDeptValue.trim());
                                          triggerToast(`Department renamed to "${editingDeptValue.trim()}"`);
                                        }
                                        setEditingDeptName(null);
                                      }}
                                      className="text-emerald-650 hover:bg-emerald-50 px-2 py-1 rounded transition-all text-xs font-bold border border-emerald-150 cursor-pointer"
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingDeptName(null)}
                                      className="text-slate-500 hover:bg-slate-100 px-2 py-1 rounded transition-all text-xs font-bold border border-slate-200 cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingDeptName(dept);
                                        setEditingDeptValue(dept);
                                      }}
                                      className="text-indigo-600 hover:bg-indigo-50 px-2.5 py-1.5 rounded transition-all flex items-center gap-1.5 text-[11px] border border-transparent hover:border-indigo-100 cursor-pointer"
                                      title="Rename Department"
                                    >
                                      <Edit2 className="h-3.5 w-3.5" /> Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        deleteDepartment(dept);
                                        triggerToast(`Department "${dept}" deleted.`);
                                      }}
                                      className="text-rose-500 hover:bg-rose-50 px-2.5 py-1.5 rounded transition-all flex items-center gap-1.5 text-[11px] border border-transparent hover:border-rose-100 cursor-pointer"
                                      title="Delete Department Group"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" /> Delete
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-Tab 6: Google Sheets Sync */}
          {activeSubTab === 'sheets' && (
            <div className="space-y-6 max-w-2xl animate-fadeIn">
              <div>
                <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold font-mono tracking-wider px-2 py-1 rounded-md border border-emerald-200">
                  GOOGLE WORKSPACE
                </span>
                <h3 className="text-sm font-bold text-slate-900 mt-2.5 flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Google Sheets Logs Syncing
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Connect your Google Account to automatically append new rows to a Google Spreadsheet whenever daily attendance logs, shift headcount capacity plans, or master associate directory updates are saved.
                </p>
              </div>

              {!sheetUser ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center space-y-4">
                  <div className="mx-auto w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center animate-pulse">
                    <Globe className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-800">Google Sheets Integration Not Connected</p>
                    <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                      Authorize access to your Google Account to automatically sync operations data to Google Sheets. We request permission to manage your spreadsheets.
                    </p>
                  </div>
                  <div className="flex justify-center pt-2">
                    <button
                      onClick={onGoogleLogin}
                      className="gsi-material-button"
                      type="button"
                    >
                      <div className="gsi-material-button-state"></div>
                      <div className="gsi-material-button-content-wrapper">
                        <div className="gsi-material-button-icon">
                          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                            <path fill="none" d="M0 0h48v48H0z"></path>
                          </svg>
                        </div>
                        <span className="gsi-material-button-contents">Sign in with Google</span>
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Connected Account Card */}
                  <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {sheetUser.photoURL ? (
                        <img 
                          src={sheetUser.photoURL} 
                          alt={sheetUser.displayName || 'Google User'} 
                          className="h-10 w-10 rounded-full border border-emerald-200"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-750 flex items-center justify-center font-bold text-xs">
                          {sheetUser.displayName?.charAt(0) || 'G'}
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-bold text-slate-800">{sheetUser.displayName}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{sheetUser.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={onGoogleLogout}
                      className="text-slate-600 hover:text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-lg text-[11px] font-bold border border-slate-200 hover:border-rose-200 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <LogOut className="h-3.5 w-3.5" /> Sign Out
                    </button>
                  </div>

                  {/* Sync Configuration Controls */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm">
                    <span className="text-[10px] font-mono font-bold text-emerald-600 uppercase block tracking-wider">
                      Synchronization Settings
                    </span>

                    {/* Enable Toggle */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div>
                        <p className="text-xs font-bold text-slate-800">Auto-append saved data to Google Sheets</p>
                        <p className="text-[10px] text-slate-500">Automatically push new records on save actions</p>
                      </div>
                      <button
                        onClick={() => {
                          if (!spreadsheetId) {
                            triggerToast('Please create or paste a spreadsheet ID first', 'error');
                            return;
                          }
                          const nextVal = !sheetsSyncEnabled;
                          setSheetsSyncEnabled(nextVal);
                          triggerToast(nextVal ? 'Real-time Sheets Sync enabled.' : 'Real-time Sheets Sync disabled.');
                        }}
                        type="button"
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          sheetsSyncEnabled ? 'bg-emerald-600' : 'bg-slate-200'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                            sheetsSyncEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Spreadsheet ID / Link Input */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold block">
                        Linked Spreadsheet ID or URL
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={spreadsheetId}
                          onChange={(e) => {
                            const input = e.target.value.trim();
                            const idMatch = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
                            const extractedId = idMatch ? idMatch[1] : input;
                            setSpreadsheetId(extractedId);
                          }}
                          placeholder="Paste Spreadsheet ID or full Google Sheet URL..."
                          className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-550/20 focus:border-emerald-500 text-slate-800 font-mono"
                        />
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Paste a URL (e.g. <i>https://docs.google.com/spreadsheets/d/...</i>) or enter the ID directly. We'll extract the ID automatically.
                      </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2.5 pt-2">
                      <button
                        type="button"
                        disabled={isCreatingSheet}
                        onClick={async () => {
                          setIsCreatingSheet(true);
                          try {
                            const title = `${orgName} - M-Track Attendance & Capacity Logs`;
                            const newId = await createSpreadsheet(sheetToken!, title);
                            setSpreadsheetId(newId);
                            setSheetsSyncEnabled(true);
                            triggerToast('Google Sheet created and configured successfully!');
                          } catch (err: any) {
                            console.error('Error creating spreadsheet:', err);
                            triggerToast('Failed to create sheet: ' + (err.message || err), 'error');
                          } finally {
                            setIsCreatingSheet(false);
                          }
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] px-4 py-2 rounded-lg border border-emerald-700 shadow-sm transition-all h-8 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        {isCreatingSheet ? (
                          <>
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Generating Sheet...
                          </>
                        ) : (
                          <>
                            <Plus className="h-3.5 w-3.5" /> Create New Spreadsheet
                          </>
                        )}
                      </button>

                      {spreadsheetId && (
                        <a
                          href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] px-4 py-2 rounded-lg border border-slate-200 shadow-sm transition-all h-8 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Globe className="h-3.5 w-3.5 text-slate-500" /> Open spreadsheet
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Information block */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-[11px] text-slate-500 space-y-2">
                    <p className="font-bold text-slate-700">What tabs will be created?</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li><b>Attendance Logs</b>: Tracks individual worker shift check-ins and overtime records</li>
                      <li><b>Capacity Plans</b>: Tracks planned vs. actual headcounts, variances, and engineer notes</li>
                      <li><b>Associates</b>: Records registration details of active shop floor personnel</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Settings Action Toast Message */}
      {toast.show && (
        <div id="settings-toast" className={`fixed top-6 right-6 border text-slate-100 px-5 py-4 rounded-xl shadow-2xl flex items-center gap-3 z-50 animate-bounce ${
          toast.type === 'success' 
            ? 'bg-slate-900 border-indigo-900 text-indigo-400' 
            : 'bg-rose-950 border-rose-900 text-rose-400'
        }`}>
          <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 border ${
            toast.type === 'success' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
          }`}>
            <Check className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-white leading-tight">
              {toast.type === 'success' ? 'System Synchronized' : 'Process Blocked'}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">{toast.msg}</p>
          </div>
        </div>
      )}

    </div>
  );
}
