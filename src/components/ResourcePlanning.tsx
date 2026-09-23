import React, { useState, useEffect } from 'react';
import { 
  Users, 
  TrendingDown, 
  TrendingUp, 
  Lock, 
  Unlock, 
  AlertTriangle, 
  Check, 
  HelpCircle,
  FileSpreadsheet,
  FileText,
  Calendar,
  Clock,
  Layers,
  ArrowRight
} from 'lucide-react';
import { Associate, AttendanceMap, HeadcountPlanMap, HeadcountPlanValue, StationHeadcountPlan } from '../types';

interface ResourcePlanningProps {
  associates: Associate[];
  attendance: AttendanceMap;
  plans: HeadcountPlanMap;
  savePlan: (date: string, shift: string, plan: HeadcountPlanValue) => void;
  currentDate: string;
  setCurrentDate: (date: string) => void;
  currentShift: string;
  setCurrentShift: (shift: string) => void;
  currentUser: { name: string; role: 'admin' | 'engineer' };
  stations: string[];
  shifts: any[];
}

export default function ResourcePlanning({
  associates,
  attendance,
  plans,
  savePlan,
  currentDate,
  setCurrentDate,
  currentShift,
  setCurrentShift,
  currentUser,
  stations,
  shifts
}: ResourcePlanningProps) {
  // Local state for scratchpad station-wise planning
  // Map of station -> StationHeadcountPlan
  const [stationPlansLocal, setStationPlansLocal] = useState<Record<string, StationHeadcountPlan>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const isAdmin = currentUser.role === 'admin';
  const canEditActual = isAdmin || currentUser.role === 'engineer';
  const canEditNotes = isAdmin || currentUser.role === 'engineer';
  const canSave = isAdmin || currentUser.role === 'engineer';

  // Compute calculated actual headcount from attendance records per station
  const getComputedStationActual = (stationName: string): number => {
    return associates.filter(emp => {
      const isAssigned = (emp.station === stationName || (!emp.station && (emp.department + ' Station' === stationName || emp.department === stationName)));
      if (!isAssigned) return false;
      const attKey = `${currentDate}_${currentShift}_${emp.id}`;
      return attendance[attKey]?.isPresent === true;
    }).length;
  };

  // Compute calculated actual operator/helper count from attendance records per station
  const getComputedStationActualSkills = (stationName: string): { operators: number; helpers: number } => {
    let operators = 0;
    let helpers = 0;
    associates.forEach(emp => {
      const isAssigned = (emp.station === stationName || (!emp.station && (emp.department + ' Station' === stationName || emp.department === stationName)));
      if (!isAssigned) return;
      const attKey = `${currentDate}_${currentShift}_${emp.id}`;
      const isPresent = attendance[attKey]?.isPresent === true;
      if (isPresent) {
        if (emp.skill === 'Helper') {
          helpers++;
        } else {
          operators++;
        }
      }
    });
    return { operators, helpers };
  };

  // Check if any station attendance data exists for this day/shift
  const hasAttendanceData = associates.some(emp => {
    const attKey = `${currentDate}_${currentShift}_${emp.id}`;
    return !!attendance[attKey];
  });

  // Calculate actual headcounts and load saved plans when date/shift/attendance/stations change
  useEffect(() => {
    const planKey = `${currentDate}_${currentShift}`;
    const savedPlan = plans[planKey];
    
    const freshStationPlans: Record<string, StationHeadcountPlan> = {};

    stations.forEach(st => {
      const computedActual = getComputedStationActual(st);
      const computedSkillsActual = getComputedStationActualSkills(st);
      
      // If there's a saved plan and it has station plans for this station
      if (savedPlan && savedPlan.stationPlans && savedPlan.stationPlans[st]) {
        const savedStPlan = savedPlan.stationPlans[st];
        freshStationPlans[st] = {
          ...savedStPlan,
          plannedOperators: savedStPlan.plannedOperators ?? 3,
          plannedHelpers: savedStPlan.plannedHelpers ?? 2,
          // Ensure actual is updated to reflect any new daily logs if override not active
          actualOverride: savedStPlan.useOverride 
            ? (savedStPlan.actualOverride ?? computedActual)
            : computedActual,
          actualOperatorsOverride: savedStPlan.useOverride
            ? (savedStPlan.actualOperatorsOverride ?? computedSkillsActual.operators)
            : undefined,
          actualHelpersOverride: savedStPlan.useOverride
            ? (savedStPlan.actualHelpersOverride ?? computedSkillsActual.helpers)
            : undefined
        };
      } else {
        // Create default station plan (Fallbacks: 3 planned operators, 2 planned helpers -> 5 total)
        freshStationPlans[st] = {
          station: st,
          planned: 5,
          plannedOperators: 3,
          plannedHelpers: 2,
          useOverride: false,
          actualOverride: computedActual,
          notes: ''
        };
      }
    });

    setStationPlansLocal(freshStationPlans);
    setIsDirty(false);
  }, [currentDate, currentShift, associates, attendance, plans, stations]);

  // Handle station planned operators headcount change
  const handleStationPlannedOperatorsChange = (station: string, val: string) => {
    if (!isAdmin) return;
    let num = parseInt(val);
    if (isNaN(num)) num = 0;
    if (num < 0) num = 0;

    setStationPlansLocal(prev => {
      const currentPlan = prev[station] || { planned: 5, notes: '' };
      const nextOperators = num;
      const nextHelpers = currentPlan.plannedHelpers ?? 2;
      const nextTotal = nextOperators + nextHelpers;

      const updated = {
        ...prev,
        [station]: {
          ...currentPlan,
          plannedOperators: nextOperators,
          plannedHelpers: nextHelpers,
          planned: nextTotal
        }
      };
      setIsDirty(true);
      return updated;
    });
  };

  // Handle station planned helpers headcount change
  const handleStationPlannedHelpersChange = (station: string, val: string) => {
    if (!isAdmin) return;
    let num = parseInt(val);
    if (isNaN(num)) num = 0;
    if (num < 0) num = 0;

    setStationPlansLocal(prev => {
      const currentPlan = prev[station] || { planned: 5, notes: '' };
      const nextOperators = currentPlan.plannedOperators ?? 3;
      const nextHelpers = num;
      const nextTotal = nextOperators + nextHelpers;

      const updated = {
        ...prev,
        [station]: {
          ...currentPlan,
          plannedOperators: nextOperators,
          plannedHelpers: nextHelpers,
          planned: nextTotal
        }
      };
      setIsDirty(true);
      return updated;
    });
  };

  // Handle station actual operators override change (Admins and Engineers)
  const handleStationActualOperatorsChange = (station: string, val: string) => {
    const canEditActual = isAdmin || currentUser.role === 'engineer';
    if (!canEditActual) return;
    let num = parseInt(val);
    if (isNaN(num)) num = 0;
    if (num < 0) num = 0;

    setStationPlansLocal(prev => {
      const currentPlan = prev[station] || { planned: 5, notes: '', useOverride: false };
      const skillsActual = getComputedStationActualSkills(station);
      const nextActualOps = num;
      const nextActualHelpers = currentPlan.actualHelpersOverride ?? skillsActual.helpers;
      const nextTotalActual = nextActualOps + nextActualHelpers;

      const updated = {
        ...prev,
        [station]: {
          ...currentPlan,
          actualOperatorsOverride: nextActualOps,
          actualHelpersOverride: nextActualHelpers,
          actualOverride: nextTotalActual,
          useOverride: true
        }
      };
      setIsDirty(true);
      return updated;
    });
  };

  // Handle station actual helpers override change (Admins and Engineers)
  const handleStationActualHelpersChange = (station: string, val: string) => {
    const canEditActual = isAdmin || currentUser.role === 'engineer';
    if (!canEditActual) return;
    let num = parseInt(val);
    if (isNaN(num)) num = 0;
    if (num < 0) num = 0;

    setStationPlansLocal(prev => {
      const currentPlan = prev[station] || { planned: 5, notes: '', useOverride: false };
      const skillsActual = getComputedStationActualSkills(station);
      const nextActualOps = currentPlan.actualOperatorsOverride ?? skillsActual.operators;
      const nextActualHelpers = num;
      const nextTotalActual = nextActualOps + nextActualHelpers;

      const updated = {
        ...prev,
        [station]: {
          ...currentPlan,
          actualOperatorsOverride: nextActualOps,
          actualHelpersOverride: nextActualHelpers,
          actualOverride: nextTotalActual,
          useOverride: true
        }
      };
      setIsDirty(true);
      return updated;
    });
  };

  // Handle toggling / resetting override
  const handleToggleActualOverride = (station: string) => {
    const canEditActual = isAdmin || currentUser.role === 'engineer';
    if (!canEditActual) return;

    setStationPlansLocal(prev => {
      const currentPlan = prev[station] || { planned: 5, notes: '', useOverride: false };
      const nextUseOverride = !currentPlan.useOverride;
      
      let updatedPlan;
      if (nextUseOverride) {
        const skillsActual = getComputedStationActualSkills(station);
        const totalActual = skillsActual.operators + skillsActual.helpers;
        updatedPlan = {
          ...currentPlan,
          useOverride: true,
          actualOperatorsOverride: skillsActual.operators,
          actualHelpersOverride: skillsActual.helpers,
          actualOverride: totalActual
        };
      } else {
        // Reset override
        updatedPlan = {
          ...currentPlan,
          useOverride: false,
          actualOperatorsOverride: undefined,
          actualHelpersOverride: undefined,
          actualOverride: undefined
        };
      }

      const updated = {
        ...prev,
        [station]: updatedPlan
      };
      setIsDirty(true);
      return updated;
    });
  };

  // Handle station notes change (Admins and Engineers)
  const handleStationNotesChange = (station: string, val: string) => {
    const canEditNotes = isAdmin || currentUser.role === 'engineer';
    if (!canEditNotes) return;
    setStationPlansLocal(prev => {
      const updated = {
        ...prev,
        [station]: {
          ...prev[station],
          notes: val
        }
      };
      setIsDirty(true);
      return updated;
    });
  };

  // Save/Commit the aggregated station-wise plans (Admins and Engineers)
  const handleLockAndSave = () => {
    const canSave = isAdmin || currentUser.role === 'engineer';
    if (!canSave) return;

    // Aggregate statistics
    let totalPlanned = 0;
    let totalActual = 0;
    let combinedNotes: string[] = [];

    (Object.values(stationPlansLocal) as StationHeadcountPlan[]).forEach(stPlan => {
      totalPlanned += stPlan.planned;
      let actualVal = 0;
      if (stPlan.useOverride) {
        if (stPlan.actualOverride !== undefined) {
          actualVal = stPlan.actualOverride;
        } else {
          const actOps = stPlan.actualOperatorsOverride ?? getComputedStationActualSkills(stPlan.station).operators;
          const actHlps = stPlan.actualHelpersOverride ?? getComputedStationActualSkills(stPlan.station).helpers;
          actualVal = actOps + actHlps;
        }
      } else {
        actualVal = getComputedStationActual(stPlan.station);
      }
      totalActual += actualVal;
      if (stPlan.notes.trim()) {
        combinedNotes.push(`${stPlan.station}: ${stPlan.notes.trim()}`);
      }
    });

    const planKey = `${currentDate}_${currentShift}`;
    const planData: HeadcountPlanValue = {
      plannedHeadcount: totalPlanned,
      actualHeadcountOverride: totalActual,
      useOverride: false,
      varianceNotes: combinedNotes.join(' | ') || 'All stations logged.',
      stationPlans: stationPlansLocal
    };

    savePlan(currentDate, currentShift, planData);
    setIsDirty(false);
    setToastMsg(`Aggregated floor capacity plan locked and saved for ${currentDate} [${currentShift}]`);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const selectedShiftObj = shifts.find(s => s.id === currentShift);

  // Compute overall summaries
  let totalPlannedRollup = 0;
  let totalActualRollup = 0;
  
  let totalPlannedOperators = 0;
  let totalActualOperators = 0;
  let totalPlannedHelpers = 0;
  let totalActualHelpers = 0;

  stations.forEach(st => {
    const plObj = stationPlansLocal[st] || { planned: 5, plannedOperators: 3, plannedHelpers: 2, useOverride: false };
    const acSkills = getComputedStationActualSkills(st);
    
    const actOps = plObj.useOverride 
      ? (plObj.actualOperatorsOverride ?? acSkills.operators)
      : acSkills.operators;
      
    const actHelpers = plObj.useOverride 
      ? (plObj.actualHelpersOverride ?? acSkills.helpers)
      : acSkills.helpers;

    totalPlannedRollup += plObj.planned;
    totalActualRollup += (actOps + actHelpers);

    totalPlannedOperators += plObj.plannedOperators ?? 3;
    totalActualOperators += actOps;
    
    totalPlannedHelpers += plObj.plannedHelpers ?? 2;
    totalActualHelpers += actHelpers;
  });

  const overallVariance = totalActualRollup - totalPlannedRollup;

  return (
    <div id="resource-planning-view" className="space-y-6">
      
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900 tracking-tight">
            Capacity & Headcount Planning
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Establish station-wise shift targets, track actual floor attendance, and record historic planning.
          </p>
        </div>
        {!isAdmin && currentUser.role === 'engineer' && (
          <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg text-xs text-indigo-700 font-semibold shadow-sm">
            <Unlock className="h-3.5 w-3.5 shrink-0 text-indigo-550" />
            Actual Headcount is Editable for Engineers
          </div>
        )}
        {!isAdmin && currentUser.role !== 'engineer' && (
          <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg text-xs text-amber-700 font-semibold shadow-sm animate-pulse">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            Planning is Read-Only
          </div>
        )}
      </div>

      {/* Top Context Control Bar */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
        
        {/* Date Selector */}
        <div className="flex-1 flex flex-col gap-1.5">
          <label htmlFor="plan-date-picker" className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-slate-400" /> Plan Date
          </label>
          <input
            id="plan-date-picker"
            type="date"
            value={currentDate}
            onChange={(e) => setCurrentDate(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Shift Selector */}
        <div className="flex-1 flex flex-col gap-1.5">
          <label htmlFor="plan-shift-selector" className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-slate-400" /> Operating Shift
          </label>
          <select
            id="plan-shift-selector"
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

        {/* Active Context Readout */}
        <div className="sm:w-64 bg-slate-50/50 rounded-lg border border-dashed border-slate-200 p-3.5 flex flex-col justify-center">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Selected Window</span>
          <span className="font-display font-semibold text-slate-800 text-xs mt-0.5">
            {new Date(currentDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <span className="font-mono text-[11px] text-indigo-600 font-bold mt-0.5">
            {selectedShiftObj?.name} (Starts {selectedShiftObj?.time})
          </span>
        </div>
      </div>

      {/* Warning if Attendance Data is not recorded yet */}
      {!hasAttendanceData && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-3 text-slate-600">
          <HelpCircle className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm text-slate-800">No Attendance Records Found</h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Attendance records have not been logged yet for {currentDate} during {selectedShiftObj?.name}. 
              Calculated actuals default to 0. Log attendance in the <strong>Daily Operational Log</strong> to synchronize floor headcounts.
            </p>
          </div>
        </div>
      )}

      {/* Total Aggregate Roll-up Stats Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-xs font-mono uppercase tracking-widest text-slate-400 font-bold mb-4">
          Roll-up Fulfillment Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <span className="text-[10px] font-mono uppercase text-slate-500">Total Planned</span>
            <p className="text-2xl font-mono font-bold text-slate-900 mt-1">{totalPlannedRollup} <span className="text-xs text-slate-500 font-sans font-normal">FTEs</span></p>
            <div className="text-[10px] text-slate-500 mt-1.5 flex gap-2.5 font-sans font-semibold border-t border-slate-200/50 pt-1.5">
              <span>Ops: <strong className="text-indigo-600">{totalPlannedOperators}</strong></span>
              <span>Hlps: <strong className="text-amber-600">{totalPlannedHelpers}</strong></span>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <span className="text-[10px] font-mono uppercase text-slate-500">Total Actual Present</span>
            <p className="text-2xl font-mono font-bold text-indigo-600 mt-1">{totalActualRollup} <span className="text-xs text-slate-500 font-sans font-normal">FTEs</span></p>
            <div className="text-[10px] text-slate-500 mt-1.5 flex gap-2.5 font-sans font-semibold border-t border-slate-200/50 pt-1.5">
              <span>Ops: <strong className="text-indigo-600">{totalActualOperators}</strong></span>
              <span>Hlps: <strong className="text-amber-600">{totalActualHelpers}</strong></span>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <span className="text-[10px] font-mono uppercase text-slate-500">Fulfillment Rate</span>
            <p className={`text-2xl font-mono font-bold mt-1 ${overallVariance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {totalPlannedRollup > 0 ? Math.round((totalActualRollup / totalPlannedRollup) * 100) : 100}%
            </p>
            <div className="text-[10px] text-slate-500 mt-1.5 flex gap-2.5 font-sans font-semibold border-t border-slate-200/50 pt-1.5">
              <span>Ops Rate: <strong className="text-indigo-600">{totalPlannedOperators > 0 ? Math.round((totalActualOperators / totalPlannedOperators) * 100) : 100}%</strong></span>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <span className="text-[10px] font-mono uppercase text-slate-500">Net Shift Variance</span>
            <p className={`text-2xl font-mono font-bold mt-1 ${overallVariance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {overallVariance > 0 ? `+${overallVariance}` : overallVariance} <span className="text-xs font-sans font-normal">FTEs</span>
            </p>
            <div className="text-[10px] text-slate-500 mt-1.5 flex gap-2.5 font-sans font-semibold border-t border-slate-200/50 pt-1.5">
              <span>Ops Var: <strong className={totalActualOperators - totalPlannedOperators < 0 ? 'text-rose-600' : 'text-emerald-600'}>{totalActualOperators - totalPlannedOperators > 0 ? `+${totalActualOperators - totalPlannedOperators}` : totalActualOperators - totalPlannedOperators}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Station Wise Capacity Matrix Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Layers className="h-5 w-5 text-indigo-500" />
          <h3 className="font-display font-bold text-base text-slate-800">
            Station Capacity Planning Matrix
          </h3>
        </div>

        {/* Interactive Matrix Grid Table */}
        <div className="bg-white border border-slate-200/85 rounded-xl shadow-sm overflow-hidden animate-fadeIn">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-indigo-950 text-indigo-100 font-mono text-[10px] uppercase tracking-wider border-b border-indigo-900">
                <tr>
                  <th className="p-4 font-bold" colSpan={1}>Station Context</th>
                  <th className="p-4 text-center border-l border-indigo-900" colSpan={2}>Operators</th>
                  <th className="p-4 text-center border-l border-indigo-900" colSpan={2}>Helpers</th>
                  <th className="p-4 text-center border-l border-indigo-900" colSpan={3}>Total Headcount</th>
                  <th className="p-4 border-l border-indigo-900">Operational Notes</th>
                </tr>
                <tr className="bg-slate-900 text-[9px] text-slate-400 border-t border-indigo-900/50">
                  <th className="p-3">Station Name</th>
                  {/* Operators */}
                  <th className="p-3 text-center border-l border-indigo-900/20 w-24">Plan (Req)</th>
                  <th className="p-3 text-center w-24">Actual</th>
                  {/* Helpers */}
                  <th className="p-3 text-center border-l border-indigo-900/20 w-24">Plan (Req)</th>
                  <th className="p-3 text-center w-24">Actual</th>
                  {/* Total */}
                  <th className="p-3 text-center border-l border-indigo-900/20 w-24">Plan Target</th>
                  <th className="p-3 text-center w-24">Actual Present</th>
                  <th className="p-3 text-center w-28">Variance Status</th>
                  {/* Notes */}
                  <th className="p-3 border-l border-indigo-900/20">Variance / Obstacle Comments</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 font-medium text-slate-700">
                {stations.map(st => {
                  const plan = stationPlansLocal[st] || { planned: 5, plannedOperators: 3, plannedHelpers: 2, notes: '', useOverride: false };
                  const skillsActualComputed = getComputedStationActualSkills(st);
                  
                  const actualOperators = plan.useOverride 
                    ? (plan.actualOperatorsOverride ?? skillsActualComputed.operators)
                    : skillsActualComputed.operators;
                    
                  const actualHelpers = plan.useOverride 
                    ? (plan.actualHelpersOverride ?? skillsActualComputed.helpers)
                    : skillsActualComputed.helpers;
                    
                  const totalPlan = plan.planned;
                  const totalActual = actualOperators + actualHelpers;
                  const variance = totalActual - totalPlan;
                  const isUnderstaffed = totalActual < totalPlan;

                  return (
                    <tr 
                      key={st} 
                      className={`hover:bg-slate-50/50 transition-colors ${
                        isUnderstaffed ? 'bg-rose-50/10' : ''
                      }`}
                    >
                      {/* Station Name */}
                      <td className="p-3.5 font-bold text-slate-800 text-xs">
                        {st}
                      </td>

                      {/* Operators Plan Input */}
                      <td className="p-3.5 text-center border-l border-slate-100 w-24">
                        {isAdmin ? (
                          <input
                            type="number"
                            min="0"
                            value={plan.plannedOperators ?? 3}
                            onChange={(e) => handleStationPlannedOperatorsChange(st, e.target.value)}
                            className="w-16 bg-slate-50 border border-slate-250 hover:border-slate-350 focus:bg-white text-center font-mono font-bold text-xs py-1.5 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                          />
                        ) : (
                          <span className="font-mono text-slate-800 font-bold">{plan.plannedOperators ?? 3}</span>
                        )}
                      </td>

                      {/* Operators Actual */}
                      <td className="p-3.5 text-center font-mono font-bold text-indigo-650 bg-indigo-55/10 w-24">
                        {canEditActual ? (
                          <div className="flex items-center justify-center gap-1 mx-auto max-w-[80px]">
                            <input
                              type="number"
                              min="0"
                              value={actualOperators}
                              onChange={(e) => handleStationActualOperatorsChange(st, e.target.value)}
                              className={`w-12 bg-slate-50 border text-center font-mono font-bold text-xs py-1.5 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 ${
                                plan.useOverride ? 'border-amber-300 bg-amber-50/25' : 'border-slate-200 hover:border-slate-350'
                              }`}
                              title={plan.useOverride ? "Overridden value. Click sync to revert to live logs." : "Live attendance value. Edit to override."}
                            />
                            {plan.useOverride && (
                              <button
                                onClick={() => handleToggleActualOverride(st)}
                                className="text-amber-500 hover:text-amber-600 cursor-pointer p-0.5"
                                title="Reset to live logs"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                                </svg>
                              </button>
                            )}
                          </div>
                        ) : (
                          <span>{actualOperators}</span>
                        )}
                      </td>

                      {/* Helpers Plan Input */}
                      <td className="p-3.5 text-center border-l border-slate-100 w-24">
                        {isAdmin ? (
                          <input
                            type="number"
                            min="0"
                            value={plan.plannedHelpers ?? 2}
                            onChange={(e) => handleStationPlannedHelpersChange(st, e.target.value)}
                            className="w-16 bg-slate-50 border border-slate-250 hover:border-slate-350 focus:bg-white text-center font-mono font-bold text-xs py-1.5 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                          />
                        ) : (
                          <span className="font-mono text-slate-800 font-bold">{plan.plannedHelpers ?? 2}</span>
                        )}
                      </td>

                      {/* Helpers Actual */}
                      <td className="p-3.5 text-center font-mono font-bold text-amber-650 bg-amber-55/10 w-24">
                        {canEditActual ? (
                          <div className="flex items-center justify-center gap-1 mx-auto max-w-[80px]">
                            <input
                              type="number"
                              min="0"
                              value={actualHelpers}
                              onChange={(e) => handleStationActualHelpersChange(st, e.target.value)}
                              className={`w-12 bg-slate-50 border text-center font-mono font-bold text-xs py-1.5 rounded focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-800 ${
                                plan.useOverride ? 'border-amber-300 bg-amber-50/25' : 'border-slate-200 hover:border-slate-350'
                              }`}
                              title={plan.useOverride ? "Overridden value. Click sync to revert to live logs." : "Live attendance value. Edit to override."}
                            />
                            {plan.useOverride && (
                              <button
                                onClick={() => handleToggleActualOverride(st)}
                                className="text-amber-500 hover:text-amber-600 cursor-pointer p-0.5"
                                title="Reset to live logs"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                                </svg>
                              </button>
                            )}
                          </div>
                        ) : (
                          <span>{actualHelpers}</span>
                        )}
                      </td>

                      {/* Total Plan */}
                      <td className="p-3.5 text-center font-mono font-extrabold text-slate-800 bg-slate-50/40 border-l border-slate-150 w-24">
                        {totalPlan}
                      </td>

                      {/* Total Actual */}
                      <td className="p-3.5 text-center font-mono font-extrabold text-slate-900 bg-slate-50/40 w-24">
                        {totalActual}
                      </td>

                      {/* Variance Badge */}
                      <td className="p-3.5 text-center w-28">
                        {variance < 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 border border-rose-150 text-rose-700 text-[10px] font-bold rounded-lg font-mono">
                            <TrendingDown className="h-3 w-3" /> Under: {Math.abs(variance)}
                          </span>
                        ) : variance > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-150 text-emerald-700 text-[10px] font-bold rounded-lg font-mono">
                            <TrendingUp className="h-3 w-3" /> Over: +{variance}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-550 text-[10px] font-bold rounded-lg font-mono">
                            <Check className="h-3 w-3" /> Match
                          </span>
                        )}
                      </td>

                      {/* Notes / Textarea */}
                      <td className="p-3.5 border-l border-slate-150">
                        {canEditNotes ? (
                          <textarea
                            rows={1.5}
                            value={plan.notes}
                            onChange={(e) => handleStationNotesChange(st, e.target.value)}
                            placeholder="Record crane breakdown or material delay obstacle comments..."
                            className="w-full text-xs bg-slate-50 border border-slate-250 hover:border-slate-350 focus:bg-white rounded p-1.5 px-3.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans text-slate-800"
                          />
                        ) : (
                          <span className="text-slate-500 italic text-[11px] block truncate max-w-[180px]" title={plan.notes}>
                            {plan.notes || "No obstacle notes."}
                          </span>
                        )}
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Save Button Row */}
      {canSave ? (
        <div className="flex items-center justify-between bg-slate-900 text-white p-5 rounded-xl border border-slate-800 shadow-md">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Unlock className="h-4 w-4 text-indigo-400" />
            <span>Locking saves all station headcount targets and compiles aggregate summaries.</span>
          </div>

          <button
            id="btn-lock-plan"
            onClick={handleLockAndSave}
            disabled={!isDirty}
            className={`font-semibold text-xs px-6 py-3 rounded-lg shadow-sm transition-all duration-150 flex items-center gap-2 cursor-pointer ${
              isDirty 
                ? 'bg-indigo-600 hover:bg-indigo-750 text-white border border-indigo-700 shadow-lg shadow-indigo-500/10' 
                : 'bg-slate-800 text-slate-500 border border-slate-850 cursor-not-allowed'
            }`}
          >
            {isDirty ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            Commit & Lock Shift Capacity Targets
          </button>
        </div>
      ) : (
        <div className="bg-slate-150 p-4 border border-slate-200 rounded-xl flex items-center gap-3 text-slate-600">
          <Lock className="h-4 w-4 text-slate-400" />
          <p className="text-xs">
            Logged in as <strong>{currentUser.name}</strong>. Headcount capacity planning targets and historic commits are restricted to Authorized access.
          </p>
        </div>
      )}

      {/* Toast Message */}
      {showToast && (
        <div id="toast-plan-success" className="fixed top-6 right-6 bg-slate-900 border border-slate-800 text-indigo-400 px-5 py-4 rounded-xl shadow-2xl flex items-center gap-3 z-50 animate-bounce duration-500 max-w-sm">
          <div className="h-6 w-6 rounded-full bg-indigo-50/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
            <Check className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-white leading-tight">Capacity Targets Committed</p>
            <p className="text-[11px] text-slate-400 mt-1">{toastMsg}</p>
          </div>
        </div>
      )}

    </div>
  );
}
