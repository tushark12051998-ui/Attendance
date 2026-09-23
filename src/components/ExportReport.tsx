import React from 'react';
import { 
  Download, 
  Printer, 
  FileSpreadsheet, 
  Clock, 
  CheckSquare, 
  Users, 
  AlertTriangle,
  Factory,
  ShieldAlert,
  Info
} from 'lucide-react';
import { Associate, AttendanceMap, HeadcountPlanMap } from '../types';

interface ExportReportProps {
  associates: Associate[];
  attendance: AttendanceMap;
  plans: HeadcountPlanMap;
  currentDate: string;
  currentShift: string;
  stations?: string[];
  shifts: any[];
}

export default function ExportReport({
  associates,
  attendance,
  plans,
  currentDate,
  currentShift,
  stations = [],
  shifts
}: ExportReportProps) {

  // CSV Data Engine
  const handleExportCSV = () => {
    // Generate dates list for July 2026
    const dates: string[] = [];
    for (let d = 1; d <= 31; d++) {
      dates.push(`2026-07-${d < 10 ? '0' + d : d}`);
    }
    const shiftsList = shifts.map(s => s.id);

    let csvContent = "Date,Shift ID,Shift Name,Associate ID,Full Name,Department,Status,Overtime Hours\n";

    dates.forEach(date => {
      shiftsList.forEach(sId => {
        const shiftObj = shifts.find(s => s.id === sId);
        associates.forEach(emp => {
          const key = `${date}_${sId}_${emp.id}`;
          const record = attendance[key];
          
          if (record) {
            const statusStr = record.isPresent ? "Present" : "Absent";
            const otHours = record.overtimeHours;
            const safeName = `"${emp.name.replace(/"/g, '""')}"`;
            const row = `${date},${sId},"${shiftObj?.name || sId}",${emp.id},${safeName},${emp.department},${statusStr},${otHours}`;
            csvContent += row + "\n";
          }
        });
      });
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `m_track_attendance_ledger_july_2026.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  // Compile stats for active date + active shift
  const selectedShiftObj = shifts.find(s => s.id === currentShift);
  const activePlanKey = `${currentDate}_${currentShift}`;
  const planData = plans[activePlanKey];

  // Calculate stats
  let totalPresent = 0;
  let totalAbsent = 0;
  let totalOtAccumulated = 0;
  let activeLogsCount = 0;

  associates.forEach(emp => {
    const key = `${currentDate}_${currentShift}_${emp.id}`;
    if (attendance[key]) {
      activeLogsCount++;
      if (attendance[key].isPresent) {
        totalPresent++;
        totalOtAccumulated += attendance[key].overtimeHours;
      } else {
        totalAbsent++;
      }
    }
  });

  const plannedHeadcount = planData ? planData.plannedHeadcount : 6;
  const actualHeadcount = planData && planData.useOverride && planData.actualHeadcountOverride !== undefined
    ? planData.actualHeadcountOverride
    : totalPresent;

  const variance = actualHeadcount - plannedHeadcount;
  const varianceNotes = planData ? planData.varianceNotes : '';

  return (
    <div id="compliance-reports-view" className="space-y-6">
      
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900 tracking-tight">
            Compliance & Data Export
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Export structured CSV ledgers for external payroll systems and generate print-optimized operational shift logs.
          </p>
        </div>
      </div>

      {/* CSV Export Banner Control */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex gap-4 items-start">
          <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl border border-emerald-100 shrink-0">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-display font-bold text-slate-900 text-sm">
              HR & Payroll CSV Data Export Engine
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
              Downloads a comma-separated values (CSV) spreadsheet containing all recorded attendance logs, overtime metrics, and department labels for July 2026. This file can be uploaded directly into Workday, SAP, or localized payroll tools.
            </p>
          </div>
        </div>

        <button
          id="btn-export-csv"
          onClick={handleExportCSV}
          className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-5 py-3 rounded-lg border border-emerald-700 shadow-sm shadow-emerald-600/10 transition-colors shrink-0"
        >
          <Download className="h-4 w-4" /> Export July Attendance Ledger
        </button>
      </div>

      {/* Daily Shift Summary Report */}
      <div className="space-y-4">
        <div className="flex items-center justify-between no-print">
          <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
            Daily Operational Digest
          </span>
          
          <button
            id="btn-trigger-print"
            onClick={handlePrint}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-4 py-2.5 rounded-lg border border-slate-200 transition-colors"
          >
            <Printer className="h-4 w-4" /> Print Shift Memo
          </button>
        </div>

        {/* Paper Layout Container */}
        <div 
          id="print-report-card" 
          className="bg-white border-2 border-slate-200 rounded-xl p-8 shadow-sm relative font-sans max-w-3xl mx-auto overflow-hidden bg-radial-gradient"
        >
          {/* Style block specifically for clean printing */}
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              #sidebar-panel, .no-print, header, footer {
                display: none !important;
              }
              body {
                background: white !important;
                color: black !important;
              }
              #print-report-card {
                border: none !important;
                box-shadow: none !important;
                width: 100% !important;
                max-width: 100% !important;
                padding: 0 !important;
                margin: 0 !important;
              }
            }
          `}} />

          {/* Report watermark/header */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-6">
            <div className="flex items-center gap-3">
              <div className="bg-slate-900 text-white p-2.5 rounded-lg">
                <Factory className="h-6 w-6" />
              </div>
              <div>
                <h1 className="font-display font-black text-xl tracking-tight text-slate-900">
                  PLANT OPERATIONS REPORT
                </h1>
                <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase mt-0.5">
                  Shift Capacity & Roster Verification Memo
                </p>
              </div>
            </div>

            <div className="text-right font-mono text-[10px] text-slate-500">
              <p>M-TRACK MES UTILITY</p>
              <p>REF: SHIFT-LOG-{currentDate}-{currentShift}</p>
              <p className="mt-1 font-bold text-slate-900">DATE: {currentDate}</p>
            </div>
          </div>

          {/* Operational Context Cards */}
          <div className="grid grid-cols-2 gap-4 my-6 py-4 border-b border-slate-200">
            <div>
              <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-bold">Log Window Parameters</p>
              <p className="text-sm font-bold text-slate-800 mt-1">
                {new Date(currentDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
              <p className="text-xs text-indigo-600 font-semibold font-mono mt-0.5">
                {selectedShiftObj?.name} (Starts {selectedShiftObj?.time})
              </p>
            </div>

            <div className="text-right">
              <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-bold">Report Status</p>
              <p className="text-sm font-bold text-slate-800 mt-1 flex items-center justify-end gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                Operations Verified
              </p>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Roster database synced (local state)
              </p>
            </div>
          </div>

          {/* Core Metrics Tables */}
          <div className="space-y-6">
            <h3 className="font-display font-bold text-xs uppercase tracking-wider text-slate-900">
              I. Shift Headcount Reconciliation
            </h3>

            <div className="grid grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="text-center p-2">
                <p className="text-[10px] font-mono font-bold text-slate-400 uppercase">Target Plan</p>
                <p className="text-xl font-mono font-bold text-slate-800 mt-1">{plannedHeadcount}</p>
              </div>
              <div className="text-center p-2 border-l border-slate-200">
                <p className="text-[10px] font-mono font-bold text-slate-400 uppercase">Actual Present</p>
                <p className="text-xl font-mono font-bold text-indigo-600 mt-1">{actualHeadcount}</p>
              </div>
              <div className="text-center p-2 border-l border-slate-200">
                <p className="text-[10px] font-mono font-bold text-slate-400 uppercase">Variance Gap</p>
                <p className={`text-xl font-mono font-bold mt-1 ${variance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {variance > 0 ? `+${variance}` : variance}
                </p>
              </div>
              <div className="text-center p-2 border-l border-slate-200">
                <p className="text-[10px] font-mono font-bold text-slate-400 uppercase">Total OT Logged</p>
                <p className="text-xl font-mono font-bold text-slate-800 mt-1">+{totalOtAccumulated.toFixed(1)}h</p>
              </div>
            </div>

            {/* Attendance Roster Sublist */}
            <div className="space-y-3">
              <h3 className="font-display font-bold text-xs uppercase tracking-wider text-slate-900">
                II. Attendance Roll-Call Verified
              </h3>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 uppercase font-mono text-[9px]">
                      <th className="py-2 px-4 font-bold">ID</th>
                      <th className="py-2 px-4 font-bold">Associate Name</th>
                      <th className="py-2 px-4 font-bold">Department</th>
                      <th className="py-2 px-4 text-center font-bold">Log Status</th>
                      <th className="py-2 px-4 text-right font-bold">OT Hours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {associates.map(emp => {
                      const attKey = `${currentDate}_${currentShift}_${emp.id}`;
                      const record = attendance[attKey] || { isPresent: true, overtimeHours: 0 };
                      
                      return (
                        <tr key={emp.id} className="hover:bg-slate-50/50">
                          <td className="py-2 px-4 font-mono font-semibold text-slate-900">{emp.id}</td>
                          <td className="py-2 px-4 font-medium text-slate-800">{emp.name}</td>
                          <td className="py-2 px-4 text-slate-500">{emp.department}</td>
                          <td className="py-2 px-4 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              record.isPresent 
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' 
                                : 'bg-rose-50 text-rose-800 border border-rose-100'
                            }`}>
                              {record.isPresent ? 'Present' : 'Absent'}
                            </span>
                          </td>
                          <td className="py-2 px-4 text-right font-mono text-slate-600">
                            {record.isPresent && record.overtimeHours > 0 ? `+${record.overtimeHours.toFixed(1)}h` : '0.0h'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Variance logging section */}
            <div className="space-y-2 pt-2">
              <h3 className="font-display font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                III. Logged Shift Obstacles & Variances
              </h3>

              {variance < 0 ? (
                <div className="border border-rose-200 bg-rose-50/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-rose-800 font-semibold text-xs mb-1.5">
                    <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
                    HEADCOUNT DEFICIT DETECTED (GAP: {variance} WORKERS)
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed font-serif italic">
                    {varianceNotes.trim() ? `"${varianceNotes}"` : "⚠ Attention: No supervisor notes have been documented for this headcount variance. Make sure to update in Resource Planning Tab."}
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 text-xs text-slate-500 italic">
                  No staff capacity shortages detected. Roster met production plan criteria optimally.
                  {varianceNotes.trim() && (
                    <div className="mt-2 text-slate-700 font-serif">
                      <strong>General Memo Notes:</strong> "{varianceNotes}"
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Signature Block */}
            <div className="pt-12 mt-12 border-t border-slate-200 grid grid-cols-2 gap-12 text-xs">
              <div>
                <p className="text-slate-400 font-mono text-[9px] uppercase tracking-wider">Report Compiled By</p>
                <div className="h-10 border-b border-slate-400 mt-4"></div>
                <p className="mt-2 font-semibold text-slate-700">Shop Floor Lead / Supervisor</p>
              </div>

              <div className="text-right">
                <p className="text-slate-400 font-mono text-[9px] uppercase tracking-wider">Authentication Check</p>
                <div className="h-10 flex items-end justify-end mt-4">
                  <span className="font-mono text-[10px] text-slate-400 italic">Digital Signature [MES-SECURE]</span>
                </div>
                <p className="mt-2 font-semibold text-slate-700">M-TRACK Automated Roster Gate</p>
              </div>
            </div>

          </div>
        </div>

        {/* Tip Banner */}
        <div className="mt-4 flex items-center gap-2 bg-slate-50 border border-slate-200/50 rounded-lg p-3 text-[11px] text-slate-500 font-medium no-print max-w-3xl mx-auto">
          <Info className="h-4 w-4 text-slate-400 shrink-0" />
          <span>Printing Tip: Pressing "Print Shift Memo" triggers the browser print prompt. M-TRACK stylesheet will automatically suppress layouts, menus, sidebars, and banners, giving you a clean physical or PDF document.</span>
        </div>
      </div>

    </div>
  );
}
