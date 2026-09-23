import React from 'react';
import { 
  ClipboardEdit, 
  Grid, 
  Users, 
  BarChart3, 
  FileSpreadsheet, 
  Factory, 
  Clock,
  LogOut,
  Shield,
  Settings,
  CloudCheck,
  RefreshCw,
  Database
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  totalAssociates: number;
  currentShiftName: string;
  currentDate: string;
  currentUser: { name: string; role: 'admin' | 'engineer'; email?: string; photoURL?: string } | null;
  onLogout: () => void;
  orgName: string;
  isSyncing?: boolean;
  isFirebaseActive?: boolean;
}

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  totalAssociates, 
  currentShiftName,
  currentDate,
  currentUser,
  onLogout,
  orgName,
  isSyncing = false,
  isFirebaseActive = true
}: SidebarProps) {
  const menuItems = [
    { id: 'daily_log', name: 'Daily Operational Log', icon: ClipboardEdit, desc: 'Record attendance & overtime' },
    { id: 'summary_grid', name: 'Manpower Summary Grid', icon: Grid, desc: '7 / 14 / 30-day matrix view' },
    { id: 'resource_planning', name: 'Resource Planning', icon: Users, desc: 'Plan vs actual & variance logs' },
    { id: 'plan_actual_overview', name: 'Plan vs Actual Overview', icon: BarChart3, desc: 'Compact day-wise comparison' },
    { id: 'compliance_reports', name: 'Compliance & Reports', icon: FileSpreadsheet, desc: 'CSV export & print summaries' },
  ];

  if (currentUser?.role === 'admin') {
    menuItems.push({
      id: 'system_settings',
      name: 'System Settings',
      icon: Settings,
      desc: 'Branding, shifts, security'
    });
  }

  return (
    <aside id="sidebar-panel" className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col text-slate-300 h-screen sticky top-0 shrink-0 select-none">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800 flex items-center gap-3">
        <div className="bg-indigo-500/10 border border-indigo-500/30 p-2 rounded-lg text-indigo-400 shrink-0">
          <Factory className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <h1 className="font-display font-bold text-base tracking-tight text-white leading-tight truncate">
            {orgName}
          </h1>
          <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase mt-0.5">
            Shop Floor MES Core
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        <span className="px-3 text-[10px] font-mono tracking-wider text-slate-500 uppercase block mb-3">
          Operational Control
        </span>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`w-full text-left flex items-start gap-3.5 px-4 py-3.5 rounded-lg transition-all duration-200 group cursor-pointer ${
                isActive 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950/20 font-medium' 
                  : 'hover:bg-slate-800/60 hover:text-slate-100 text-slate-400'
              }`}
            >
              <Icon className={`h-5 w-5 shrink-0 mt-0.5 transition-transform duration-200 group-hover:scale-105 ${
                isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'
              }`} />
              <div>
                <span className="block text-sm font-semibold">{item.name}</span>
                <span className={`block text-[11px] mt-0.5 leading-tight ${
                  isActive ? 'text-indigo-100/80' : 'text-slate-500 group-hover:text-slate-400'
                }`}>
                  {item.desc}
                </span>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Workforce Quick Stats Footer Widget */}
      <div className="p-5 border-t border-slate-800 bg-slate-950/40 font-sans space-y-4">
        {/* User Identity Section */}
        {currentUser && (
          <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 flex flex-col gap-2.5">
            <div className="flex items-center gap-2.5">
              {currentUser.photoURL ? (
                <img 
                  src={currentUser.photoURL} 
                  alt={currentUser.name} 
                  referrerPolicy="no-referrer"
                  className="h-8 w-8 rounded-full object-cover border border-slate-700 shrink-0" 
                />
              ) : (
                <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                  currentUser.role === 'admin' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}>
                  <Shield className="h-4 w-4" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-slate-100 truncate">
                  {currentUser.name}
                </span>
                {currentUser.email && (
                  <span className="block text-[10px] text-slate-400 truncate">
                    {currentUser.email}
                  </span>
                )}
                <span className={`inline-block text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase mt-0.5 ${
                  currentUser.role === 'admin' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400'
                }`}>
                  {currentUser.role === 'admin' ? 'Administrator' : 'Shift Engineer'}
                </span>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-slate-850 hover:bg-slate-800 text-[11px] text-slate-400 hover:text-rose-400 font-bold rounded border border-slate-850 hover:border-rose-950/30 transition-all duration-150 cursor-pointer"
            >
              <LogOut className="h-3 w-3" /> Sign Out Portal
            </button>
          </div>
        )}

        <div>
          <span className="text-[10px] font-mono tracking-wider text-slate-500 uppercase block mb-2.5">
            System Status
          </span>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Active Roster:</span>
              <span className="font-mono font-medium text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700/50">
                {totalAssociates} Headcount
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Active Shift:</span>
              <span className="font-mono font-medium text-indigo-400 flex items-center gap-1">
                <Clock className="h-3 w-3 inline" /> {currentShiftName}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">System Date:</span>
              <span className="font-mono text-slate-400 text-[11px]">
                {currentDate}
              </span>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {isFirebaseActive ? (
              <>
                <span className={`h-2 w-2 rounded-full ${isSyncing ? 'bg-amber-400 animate-spin' : 'bg-emerald-500 animate-pulse'}`}></span>
                <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider font-semibold">
                  {isSyncing ? 'Syncing...' : 'Firestore Live'}
                </span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-slate-500"></span>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                  Offline
                </span>
              </>
            )}
          </div>
          <span className="text-[9px] text-slate-600 font-mono">MES Production</span>
        </div>
      </div>
    </aside>
  );
}
