import React, { useState } from 'react';
import { 
  Calendar, 
  Clock, 
  TrendingDown, 
  TrendingUp, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Layers, 
  AlertTriangle,
  HelpCircle,
  FileSpreadsheet,
  Info,
  Grid,
  List,
  Download
} from 'lucide-react';
import { Associate, AttendanceMap, HeadcountPlanMap } from '../types';

interface PlanActualOverviewProps {
  associates: Associate[];
  attendance: AttendanceMap;
  plans: HeadcountPlanMap;
  currentDate: string;
  stations: string[];
  shifts: any[];
  currentShift: string;
  setCurrentShift: (shift: string) => void;
}

export default function PlanActualOverview({
  associates,
  attendance,
  plans,
  currentDate,
  stations,
  shifts,
  currentShift,
  setCurrentShift
}: PlanActualOverviewProps) {
  const [selectedRange, setSelectedRange] = useState<'7' | '14' | '30'>('7');
  const [viewMode, setViewMode] = useState<'matrix' | 'list'>('matrix');
  const [expandedShifts, setExpandedShifts] = useState<Record<string, boolean>>({});

  // Get range of dates ending on currentDate
  const getDatesInRange = (): string[] => {
    const list: string[] = [];
    const baseDate = new Date(currentDate);
    const count = parseInt(selectedRange);
    for (let i = count - 1; i >= 0; i--) {
      const temp = new Date(baseDate);
      temp.setDate(baseDate.getDate() - i);
      const yyyy = temp.getFullYear();
      const mm = String(temp.getMonth() + 1).padStart(2, '0');
      const dd = String(temp.getDate()).padStart(2, '0');
      list.push(`${yyyy}-${mm}-${dd}`);
    }
    return list;
  };

  const dates = getDatesInRange();

  // Helper to compute stats for a single date & shift
  const getShiftData = (dateStr: string, shiftId: string) => {
    const planKey = `${dateStr}_${shiftId}`;
    const plan = plans[planKey];

    // 1. Calculate Planned target
    let planned = 0;
    if (plan) {
      planned = plan.plannedHeadcount;
    } else {
      // Unplanned date default fallbacks for mock presentation
      if (['2026-07-12', '2026-07-13', '2026-07-14'].includes(dateStr)) {
        planned = stations.length * 5; // e.g. 5 per station
      } else {
        planned = 0; // Truly unlogged
      }
    }

    // 2. Calculate Actual headcount
    let actual = 0;
    let hasRecords = false;

    // First check if there is an override saved in the plan
    if (plan && plan.useOverride && plan.actualHeadcountOverride !== undefined) {
      actual = plan.actualHeadcountOverride;
      hasRecords = true;
    } else {
      // Otherwise count actual checked in associates for this date + shift
      associates.forEach(emp => {
        const attKey = `${dateStr}_${shiftId}_${emp.id}`;
        if (attendance[attKey]) {
          hasRecords = true;
          if (attendance[attKey].isPresent) {
            actual++;
          }
        }
      });
    }

    // 3. Station details breakdown
    const stationBreakdown = stations.map(st => {
      const isAssigned = (emp: Associate) => {
        return (emp.station === st || (!emp.station && (emp.department + ' Station' === st || emp.department === st)));
      };

      // Count actual checked in for this station
      let stActual = 0;
      associates.forEach(emp => {
        if (isAssigned(emp)) {
          const attKey = `${dateStr}_${shiftId}_${emp.id}`;
          if (attendance[attKey]?.isPresent) {
            stActual++;
          }
        }
      });

      // Get planned from saved station plan, or fallback to default (5) if shift has plan
      let stPlanned = 0;
      if (plan && plan.stationPlans && plan.stationPlans[st]) {
        stPlanned = plan.stationPlans[st].planned;
      } else if (planned > 0) {
        stPlanned = 5; // Default fallback for historical data
      }

      const stNotes = plan && plan.stationPlans && plan.stationPlans[st] ? plan.stationPlans[st].notes : '';

      return {
        station: st,
        planned: stPlanned,
        actual: stActual,
        variance: stActual - stPlanned,
        notes: stNotes
      };
    });

    const variance = actual - planned;
    const fulfillment = planned > 0 ? Math.round((actual / planned) * 100) : 100;

    return {
      planned,
      actual,
      variance,
      fulfillment,
      hasRecords,
      varianceNotes: plan ? plan.varianceNotes : '',
      stationBreakdown
    };
  };

  // Toggle shift collapse
  const toggleShiftExpand = (dateStr: string, shiftId: string) => {
    const key = `${dateStr}_${shiftId}`;
    setExpandedShifts(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Build aggregate stats for the selected range (across all logged shifts)
  let totalPlannedRollup = 0;
  let totalActualRollup = 0;
  let loggedShiftsCount = 0;
  let understaffedShiftsCount = 0;

  const dayWiseData = dates.map(dateStr => {
    const shiftSummaries = shifts.map(shift => {
      const info = getShiftData(dateStr, shift.id);
      if (info.hasRecords || info.planned > 0) {
        totalPlannedRollup += info.planned;
        totalActualRollup += info.actual;
        loggedShiftsCount++;
        if (info.actual < info.planned) {
          understaffedShiftsCount++;
        }
      }
      return {
        shift,
        ...info
      };
    });

    return {
      date: dateStr,
      formattedDate: new Date(dateStr).toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      }),
      shifts: shiftSummaries
    };
  });

  const overallFulfillmentRate = totalPlannedRollup > 0 
    ? Math.round((totalActualRollup / totalPlannedRollup) * 100) 
    : 100;

  const handleDownloadCSV = () => {
    const headers = [
      'Date',
      'Shift',
      'Planned Headcount',
      'Actual Headcount',
      'Variance',
      'Fulfillment Rate (%)',
      'Status'
    ];
    const csvRows = [headers.join(',')];

    dayWiseData.forEach(day => {
      let dayPlanned = 0;
      let dayActual = 0;

      day.shifts.forEach(sh => {
        dayPlanned += sh.planned;
        dayActual += sh.actual;

        const variance = sh.actual - sh.planned;
        const fulfillment = sh.planned > 0 ? Math.round((sh.actual / sh.planned) * 100) : 100;
        let status = 'Fully Staffed';
        if (sh.actual < sh.planned) status = 'Understaffed';
        if (sh.actual > sh.planned) status = 'Overstaffed';
        if (!sh.hasRecords && sh.planned === 0) status = 'No Activity';

        const row = [
          day.date,
          sh.shift.name,
          sh.planned,
          sh.actual,
          variance >= 0 ? `+${variance}` : variance,
          `${fulfillment}%`,
          status
        ];
        csvRows.push(row.join(','));
      });

      // Day Summary Row
      const dayVariance = dayActual - dayPlanned;
      const dayFulfillment = dayPlanned > 0 ? Math.round((dayActual / dayPlanned) * 100) : 100;
      let dayStatus = 'Fully Staffed';
      if (dayActual < dayPlanned) dayStatus = 'Understaffed';
      if (dayActual > dayPlanned) dayStatus = 'Overstaffed';

      const daySummaryRow = [
        `"${day.formattedDate} Total"`,
        'All Shifts',
        dayPlanned,
        dayActual,
        dayVariance >= 0 ? `+${dayVariance}` : dayVariance,
        `${dayFulfillment}%`,
        dayStatus
      ];
      csvRows.push(daySummaryRow.join(','));
      csvRows.push(',,,,,,'); // empty line separator between days
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `plan_vs_actual_overview_${selectedRange}_days.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Helper to resolve cell details for the matrix grid view
  const getMatrixCellData = (station: string, dateStr: string) => {
    const planKey = `${dateStr}_${currentShift}`;
    const plan = plans[planKey];
    
    // Check if there are any records registered for this day/shift
    let hasRecords = false;
    
    // Find associates pre-assigned to this station
    const isAssigned = (emp: Associate) => {
      return (emp.station === station || (!emp.station && (emp.department + ' Station' === station || emp.department === station)));
    };

    let stActual = 0;
    associates.forEach(emp => {
      const attKey = `${dateStr}_${currentShift}_${emp.id}`;
      if (attendance[attKey]) {
        hasRecords = true;
      }
      if (isAssigned(emp)) {
        if (attendance[attKey]?.isPresent) {
          stActual++;
        }
      }
    });

    let stPlanned = 0;
    if (plan && plan.stationPlans && plan.stationPlans[station]) {
      stPlanned = plan.stationPlans[station].planned;
    } else if (plan) {
      stPlanned = 5; // default fallback if there is a shift plan but station list isn't granularized
    } else if (['2026-07-12', '2026-07-13', '2026-07-14'].includes(dateStr)) {
      stPlanned = 5; // fallback defaults for seed presentation
      hasRecords = true;
    }

    const variance = stActual - stPlanned;
    return {
      planned: stPlanned,
      actual: stActual,
      variance,
      hasData: hasRecords || stPlanned > 0
    };
  };

  return (
    <div id="plan-actual-overview-view" className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900 tracking-tight">
            Plan vs Actual Overview
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Day-wise manpower fulfillment comparison, station capacities, and understaffing logs.
          </p>
        </div>

        {/* Range Selector & View Toggle */}
        <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
          {/* View Mode Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('matrix')}
              className={`text-xs font-bold px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                viewMode === 'matrix' 
                  ? 'bg-white text-indigo-650 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Matrix View (Stations vs Date)"
            >
              <Grid className="h-3.5 w-3.5" />
              Matrix View
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`text-xs font-bold px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                viewMode === 'list' 
                  ? 'bg-white text-indigo-650 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Compact Day-Wise List View"
            >
              <List className="h-3.5 w-3.5" />
              Shift Log List
            </button>
          </div>

          {/* Past Range */}
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            {(['7', '14', '30'] as const).map(range => (
              <button
                key={range}
                onClick={() => setSelectedRange(range)}
                className={`text-xs font-bold px-3 py-1.5 rounded-md transition-all ${
                  selectedRange === range 
                    ? 'bg-white text-indigo-650 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {range}D Window
              </button>
            ))}
          </div>

          {/* Download Overview CSV */}
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-lg shadow-sm border border-emerald-700 transition-all cursor-pointer h-8 shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            Download CSV
          </button>
        </div>
      </div>

      {/* Aggregate Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white border border-slate-200 rounded-xl p-4.5 shadow-sm">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">Overall Fulfillment</span>
          <p className="text-2xl font-mono font-black text-indigo-650 mt-1.5">{overallFulfillmentRate}%</p>
          <p className="text-[10px] text-slate-400 mt-1 leading-none">Manpower targets achieved</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4.5 shadow-sm">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">Total Target Hours</span>
          <p className="text-2xl font-mono font-black text-slate-800 mt-1.5">
            {totalPlannedRollup * 8} <span className="text-xs font-sans font-normal text-slate-500">h</span>
          </p>
          <p className="text-[10px] text-slate-400 mt-1 leading-none">For {totalPlannedRollup} planned FTEs</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4.5 shadow-sm">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">Actual FTE Workday</span>
          <p className="text-2xl font-mono font-black text-slate-800 mt-1.5">
            {totalActualRollup} <span className="text-xs font-sans font-normal text-slate-500">FTEs</span>
          </p>
          <p className="text-[10px] text-slate-400 mt-1 leading-none">Logged present on floor</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4.5 shadow-sm">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">Understaffed Shifts</span>
          <p className={`text-2xl font-mono font-black mt-1.5 ${understaffedShiftsCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {understaffedShiftsCount} <span className="text-xs font-sans font-normal text-slate-500">/ {loggedShiftsCount} logged</span>
          </p>
          <p className="text-[10px] text-slate-400 mt-1 leading-none">Shifts below manpower target</p>
        </div>
      </div>

      {/* RENDER MODE 1: MATRIX VIEW (Fulfillment Grid where rows show stations and columns show dates) */}
      {viewMode === 'matrix' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Matrix Header controls for Shift filtering */}
          <div className="bg-white p-4.5 border border-slate-200 rounded-xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-display font-bold text-sm text-slate-800 flex items-center gap-1.5">
                <Grid className="h-4.5 w-4.5 text-indigo-500" /> Plant Floor Fulfillment Matrix
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Each cell displays the <strong>Actual / Planned</strong> headcount and the workforce variance.
              </p>
            </div>

            {/* Matrix Shift Selector */}
            <div className="flex items-center gap-2">
              <label htmlFor="matrix-shift-filter" className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                Operating Shift:
              </label>
              <select
                id="matrix-shift-filter"
                value={currentShift}
                onChange={(e) => setCurrentShift(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {shifts.map(shift => (
                  <option key={shift.id} value={shift.id}>
                    {shift.name} ({shift.time})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Grid Scroll Wrapper */}
          <div className="overflow-hidden border border-slate-200 rounded-xl bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs select-none">
                <thead className="bg-slate-50 text-slate-500 font-mono text-[9px] uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-4 font-extrabold text-slate-700 bg-slate-50 sticky left-0 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.03)] w-52">
                      Active Station Row
                    </th>
                    {dates.map(d => {
                      const dObj = new Date(d);
                      const formatted = dObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      const weekday = dObj.toLocaleDateString('en-US', { weekday: 'short' });
                      return (
                        <th key={d} className="p-3 text-center border-l border-slate-200 min-w-[110px]">
                          <span className="block font-bold text-slate-700">{formatted}</span>
                          <span className="block text-[8px] text-slate-400 mt-0.5">{weekday}</span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {stations.map(st => {
                    return (
                      <tr key={st} className="hover:bg-slate-50/20 group">
                        {/* Sticky station name label */}
                        <td className="p-4 font-bold text-slate-800 bg-white sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.03)] border-r border-slate-100 truncate max-w-[210px]" title={st}>
                          {st}
                        </td>
                        {dates.map(dateStr => {
                          const cell = getMatrixCellData(st, dateStr);
                          const isUnder = cell.actual < cell.planned;
                          const hasData = cell.hasData;

                          return (
                            <td 
                              key={dateStr} 
                              className={`p-3 text-center border-l border-slate-100 transition-colors ${
                                !hasData
                                  ? 'bg-slate-50/50 text-slate-300'
                                  : isUnder
                                    ? 'bg-rose-50/30 hover:bg-rose-50/60 text-rose-800'
                                    : 'bg-emerald-50/30 hover:bg-emerald-50/60 text-emerald-800'
                              }`}
                            >
                              {!hasData ? (
                                <span className="font-mono text-[10px] text-slate-300">-</span>
                              ) : (
                                <div className="space-y-1">
                                  <div className="font-mono font-bold text-xs">
                                    {cell.actual} <span className="text-[9px] text-slate-400 font-sans font-normal">/</span> {cell.planned}
                                  </div>
                                  <span className={`inline-block text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                                    isUnder ? 'bg-rose-100/55 text-rose-700' : 'bg-emerald-100/55 text-emerald-700'
                                  }`}>
                                    {cell.variance >= 0 ? `+${cell.variance}` : cell.variance}
                                  </span>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* RENDER MODE 2: CHRONOLOGICAL DAY-WISE LIST VIEW */}
      {viewMode === 'list' && (
        <div className="space-y-4 animate-fadeIn">
          <h3 className="font-display font-bold text-base text-slate-800 flex items-center gap-2 px-1">
            <Calendar className="h-4 w-4 text-indigo-500" /> Day-Wise Capacity Logs ({selectedRange}-Day Window)
          </h3>

          <div className="space-y-3">
            {dayWiseData.map(day => {
              const isAnyShiftLogged = day.shifts.some(s => s.hasRecords || s.planned > 0);

              return (
                <div 
                  key={day.date} 
                  className={`bg-white border rounded-xl overflow-hidden shadow-sm transition-all hover:shadow-md ${
                    day.date === currentDate ? 'ring-2 ring-indigo-600/10 border-indigo-200' : 'border-slate-200'
                  }`}
                >
                  {/* Day Header Row */}
                  <div className="bg-slate-50/55 p-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="font-display font-extrabold text-sm text-slate-900">{day.formattedDate}</span>
                      <span className="text-[10px] font-mono text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded font-semibold">
                        {day.date}
                      </span>
                      {day.date === currentDate && (
                        <span className="bg-indigo-100 text-indigo-700 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Today
                        </span>
                      )}
                    </div>
                    {!isAnyShiftLogged && (
                      <span className="text-[10px] text-slate-400 italic">No attendance or planning logged</span>
                    )}
                  </div>

                  {/* Shifts List for this day */}
                  {isAnyShiftLogged && (
                    <div className="divide-y divide-slate-100">
                      {day.shifts.map(({ shift, planned, actual, variance, fulfillment, hasRecords, varianceNotes, stationBreakdown }) => {
                        const isLogged = hasRecords || planned > 0;
                        if (!isLogged) return null;

                        const key = `${day.date}_${shift.id}`;
                        const isExpanded = !!expandedShifts[key];
                        const isUnderstaffed = actual < planned;

                        return (
                          <div key={shift.id} className="p-3.5 space-y-3">
                            
                            {/* Shift Summary Row */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                              
                              {/* Shift Name and Time */}
                              <div className="flex items-center gap-2 sm:w-44">
                                <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span className="font-semibold text-slate-800">{shift.name}</span>
                                <span className="text-[10px] font-mono text-slate-400">({shift.time})</span>
                              </div>

                              {/* Plan vs Actual Figures */}
                              <div className="flex items-center gap-6 flex-wrap">
                                <div className="flex items-baseline gap-1.5">
                                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Plan:</span>
                                  <span className="font-mono font-bold text-slate-800">{planned} FTEs</span>
                                </div>
                                <div className="flex items-baseline gap-1.5">
                                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Actual:</span>
                                  <span className="font-mono font-bold text-indigo-600">{actual} FTEs</span>
                                </div>
                                <div className="flex items-baseline gap-1.5">
                                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Variance:</span>
                                  <span className={`font-mono font-bold ${variance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                    {variance > 0 ? `+${variance}` : variance}
                                  </span>
                                </div>
                              </div>

                              {/* Fulfillment Rate & Expand Toggle */}
                              <div className="flex items-center justify-between sm:justify-end gap-3.5 shrink-0 min-w-[150px]">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                                  isUnderstaffed 
                                    ? 'bg-rose-50 text-rose-700 border border-rose-100' 
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                }`}>
                                  {isUnderstaffed ? <TrendingDown className="h-2.5 w-2.5" /> : <TrendingUp className="h-2.5 w-2.5" />}
                                  {fulfillment}% Staffed
                                </span>

                                <button
                                  onClick={() => toggleShiftExpand(day.date, shift.id)}
                                  className="flex items-center gap-1.5 px-2 py-1 hover:bg-slate-50 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-md transition-colors"
                                >
                                  <span className="text-[10px] font-medium font-mono">Stations</span>
                                  {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                </button>
                              </div>

                            </div>

                            {/* Collapsible Station Breakdown details */}
                            {isExpanded && (
                              <div className="bg-slate-50/70 rounded-xl border border-slate-150 p-3.5 space-y-3.5 text-xs animate-fadeIn">
                                
                                <div className="flex items-center justify-between px-1">
                                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1.5">
                                    <Layers className="h-3.5 w-3.5 text-indigo-400" /> Station Specific Allocation Map
                                  </span>
                                  {varianceNotes && (
                                    <span className="text-[10px] text-slate-400 max-w-sm truncate" title={varianceNotes}>
                                      <strong>Notes:</strong> {varianceNotes}
                                    </span>
                                  )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {stationBreakdown.map(stInfo => {
                                    const stUnder = stInfo.actual < stInfo.planned;
                                    return (
                                      <div 
                                        key={stInfo.station} 
                                        className={`p-3 bg-white border rounded-lg shadow-sm flex flex-col justify-between gap-2.5 ${
                                          stUnder ? 'border-rose-100 bg-rose-50/10' : 'border-slate-200'
                                        }`}
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <span className="font-semibold text-slate-800 truncate" title={stInfo.station}>
                                            {stInfo.station}
                                          </span>
                                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase tracking-wider ${
                                            stUnder ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'
                                          }`}>
                                            Var: {stInfo.variance > 0 ? `+${stInfo.variance}` : stInfo.variance}
                                          </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-center text-xs">
                                          <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
                                            <span className="text-[9px] text-slate-400 uppercase font-mono block">Planned</span>
                                            <span className="font-mono font-bold text-slate-700">{stInfo.planned}</span>
                                          </div>
                                          <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
                                            <span className="text-[9px] text-slate-400 uppercase font-mono block">Actual</span>
                                            <span className="font-mono font-bold text-indigo-600">{stInfo.actual}</span>
                                          </div>
                                        </div>

                                        {stInfo.notes && (
                                          <div className="text-[10px] text-slate-500 bg-slate-50 border border-slate-100 rounded p-1.5 mt-0.5">
                                            <strong>Obstruction:</strong> {stInfo.notes}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>

                              </div>
                            )}

                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
