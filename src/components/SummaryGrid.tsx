import React, { useState } from 'react';
import { 
  CalendarRange, 
  Layers, 
  HelpCircle, 
  UserCheck, 
  UserX, 
  Clock, 
  Sparkles,
  Search,
  Filter,
  Download
} from 'lucide-react';
import { Associate, AttendanceMap, SHIFTS } from '../types';

interface SummaryGridProps {
  associates: Associate[];
  attendance: AttendanceMap;
  stations?: string[];
}

type RangeType = '7_days' | '14_days' | 'monthly';

export default function SummaryGrid({ associates, attendance, stations = [] }: SummaryGridProps) {
  const [viewRange, setViewRange] = useState<RangeType>('7_days');
  const [selectedShiftFilter, setSelectedShiftFilter] = useState<string>('All'); // 'All', 'ShiftA', 'ShiftB', 'ShiftC'
  const [deptFilter, setDeptFilter] = useState<string>('All');
  const [stationFilter, setStationFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const handleDownloadCSV = () => {
    const headers = ['Employee ID', 'Name', 'Department', 'Station', ...datesList, 'Days Present', 'Days Absent', 'Accumulated OT'];
    const csvRows = [headers.join(',')];

    filteredAssociates.forEach(emp => {
      const agg = getRowAggregates(emp.id);
      const dateStatuses = datesList.map(date => {
        const cell = getCellStatus(emp.id, date);
        if (!cell.isRecorded) return 'N/A';
        let val = cell.isPresent ? 'Present' : 'Absent';
        if (cell.isPresent && cell.ot > 0) val += ` (+${cell.ot}h)`;
        return val;
      });
      const row = [
        emp.id,
        `"${emp.name.replace(/"/g, '""')}"`,
        `"${emp.department.replace(/"/g, '""')}"`,
        `"${(emp.station || '').replace(/"/g, '""')}"`,
        ...dateStatuses.map(s => `"${s}"`),
        agg.present,
        agg.absent,
        `"${agg.ot}h"`
      ];
      csvRows.push(row.join(','));
    });

    // Add total headcount row
    const totalHeadcountRow = [
      '"Total Floor Headcount"',
      '',
      '',
      '',
      ...datesList.map(date => getColumnTotalHeadcount(date)),
      '',
      '',
      ''
    ];
    csvRows.push(totalHeadcountRow.join(','));

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `manpower_summary_grid_${viewRange}_shift_${selectedShiftFilter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Define date ranges anchored in July 2026 to showcase the mock logs (Jul 12, 13, 14, 15) beautifully
  const getDatesForRange = (): string[] => {
    const dates: string[] = [];
    if (viewRange === '7_days') {
      // 2026-07-09 to 2026-07-15
      for (let d = 9; d <= 15; d++) {
        dates.push(`2026-07-${d < 10 ? '0' + d : d}`);
      }
    } else if (viewRange === '14_days') {
      // 2026-07-02 to 2026-07-15
      for (let d = 2; d <= 15; d++) {
        dates.push(`2026-07-${d < 10 ? '0' + d : d}`);
      }
    } else {
      // Full July 2026 (2026-07-01 to 2026-07-31)
      for (let d = 1; d <= 31; d++) {
        dates.push(`2026-07-${d < 10 ? '0' + d : d}`);
      }
    }
    return dates;
  };

  const datesList = getDatesForRange();

  // Unique departments for filter
  const departments = ['All', ...Array.from(new Set(associates.map(a => a.department)))];

  // Helper to determine status and OT for an associate on a specific date + shift combination
  const getCellStatus = (empId: string, dateStr: string) => {
    // If filtering by specific shift
    if (selectedShiftFilter !== 'All') {
      const key = `${dateStr}_${selectedShiftFilter}_${empId}`;
      const record = attendance[key];
      return record ? { isRecorded: true, isPresent: record.isPresent, ot: record.overtimeHours } : { isRecorded: false, isPresent: false, ot: 0 };
    } else {
      // Combined shift calculation
      // If present on ANY shift, they are "Present" for that date.
      // Total OT is the sum of OT hours across all shifts for that date.
      // If they have records on any shift, we count them as recorded.
      let isRecorded = false;
      let isPresent = false;
      let totalOt = 0;
      
      const shiftsList = ['ShiftA', 'ShiftB', 'ShiftC'];
      shiftsList.forEach(sId => {
        const key = `${dateStr}_${sId}_${empId}`;
        const record = attendance[key];
        if (record) {
          isRecorded = true;
          if (record.isPresent) {
            isPresent = true;
          }
          totalOt += record.overtimeHours;
        }
      });

      return { 
        isRecorded, 
        isPresent, 
        ot: parseFloat(totalOt.toFixed(1)) 
      };
    }
  };

  // Group associates by Department and Station
  const filteredAssociates = associates.filter(emp => {
    const matchesDept = deptFilter === 'All' || emp.department === deptFilter;
    const matchesStation = stationFilter === 'All' || (emp.station === stationFilter || (!emp.station && (emp.department + ' Station' === stationFilter || emp.department === stationFilter)));
    const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase()) || emp.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDept && matchesStation && matchesSearch;
  });

  // Departments list for rendering grouping rows
  const operatingDeptsInFiltered = Array.from(new Set(filteredAssociates.map(a => a.department)));

  // Calculate row aggregates for an associate over the active dates list
  const getRowAggregates = (empId: string) => {
    let presentCount = 0;
    let absentCount = 0;
    let totalOt = 0;

    datesList.forEach(date => {
      const status = getCellStatus(empId, date);
      if (status.isRecorded) {
        if (status.isPresent) {
          presentCount++;
          totalOt += status.ot;
        } else {
          absentCount++;
        }
      }
    });

    return {
      present: presentCount,
      absent: absentCount,
      ot: parseFloat(totalOt.toFixed(1))
    };
  };

  // Calculate actual headcount available on each date column
  const getColumnTotalHeadcount = (dateStr: string): number => {
    let totalPresent = 0;
    filteredAssociates.forEach(emp => {
      const status = getCellStatus(emp.id, dateStr);
      // Count if present on that day
      if (status.isRecorded && status.isPresent) {
        totalPresent++;
      }
    });
    return totalPresent;
  };

  // Human friendly formatting for calendar headers
  const formatHeaderDate = (dateStr: string): { label: string; sub: string } => {
    const parts = dateStr.split('-');
    const day = parts[2];
    const dateObj = new Date(dateStr);
    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'narrow' }); // M, T, W, T...
    return {
      label: `${day}`,
      sub: dayOfWeek
    };
  };

  return (
    <div id="summary-grid-view" className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900 tracking-tight">
            Manpower Attendance Summary Grid
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Supervisory cross-reference matrix grouping workers by department with visual indicators and accumulated OT counters.
          </p>
        </div>
        <button
          onClick={handleDownloadCSV}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-sm border border-emerald-700 transition-all cursor-pointer h-9 shrink-0 self-start md:self-auto"
        >
          <Download className="h-4 w-4" />
          Download Grid CSV
        </button>
      </div>

      {/* Grid Filter Bar Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col xl:flex-row items-stretch xl:items-center gap-4">
        
        {/* Toggle Range View */}
        <div className="flex-1 flex flex-col gap-1.5">
          <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <CalendarRange className="h-3.5 w-3.5 text-slate-400" /> Time Horizon
          </span>
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200/50 self-start w-full">
            <button
              id="btn-range-7"
              onClick={() => setViewRange('7_days')}
              className={`flex-1 text-center py-1.5 px-3.5 rounded-md text-xs font-medium transition-all ${
                viewRange === '7_days' 
                  ? 'bg-slate-900 text-white shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/40'
              }`}
            >
              7-Day View
            </button>
            <button
              id="btn-range-14"
              onClick={() => setViewRange('14_days')}
              className={`flex-1 text-center py-1.5 px-3.5 rounded-md text-xs font-medium transition-all ${
                viewRange === '14_days' 
                  ? 'bg-slate-900 text-white shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/40'
              }`}
            >
              14-Day View
            </button>
            <button
              id="btn-range-monthly"
              onClick={() => setViewRange('monthly')}
              className={`flex-1 text-center py-1.5 px-3.5 rounded-md text-xs font-medium transition-all ${
                viewRange === 'monthly' 
                  ? 'bg-slate-900 text-white shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/40'
              }`}
            >
              Monthly Grid
            </button>
          </div>
        </div>

        {/* Shift Filter Dropdown */}
        <div className="w-full sm:w-48 flex flex-col gap-1.5">
          <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-slate-400" /> Shift Resolution
          </span>
          <select
            id="summary-shift-filter"
            value={selectedShiftFilter}
            onChange={(e) => setSelectedShiftFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
          >
            <option value="All">All Shifts Combined</option>
            {SHIFTS.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.time})</option>
            ))}
          </select>
        </div>

        {/* Department filter */}
        <div className="w-full sm:w-48 flex flex-col gap-1.5">
          <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-slate-400" /> Department Group
          </span>
          <select
            id="summary-dept-filter"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
          >
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept === 'All' ? 'All Departments' : dept}</option>
            ))}
          </select>
        </div>

        {/* Station filter */}
        <div className="w-full sm:w-48 flex flex-col gap-1.5">
          <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-indigo-400" /> Assigned Station
          </span>
          <select
            id="summary-station-filter"
            value={stationFilter}
            onChange={(e) => setStationFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
          >
            <option value="All">All Stations</option>
            {stations.map(st => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
        </div>

        {/* Search Input */}
        <div className="flex-1 flex flex-col gap-1.5">
          <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Search className="h-3.5 w-3.5 text-slate-400" /> Worker Search
          </span>
          <div className="relative">
            <input
              id="summary-search"
              type="text"
              placeholder="Search by name or EMP ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors placeholder:text-slate-400 font-medium"
            />
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
          </div>
        </div>
      </div>

      {/* Legend Card */}
      <div className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-4 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-slate-600">
        <span className="font-mono text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-2">Legend:</span>
        <span className="flex items-center gap-1.5 font-medium">
          <span className="inline-flex h-5 w-5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded items-center justify-center font-mono text-[10px] font-bold">P</span> Present
        </span>
        <span className="flex items-center gap-1.5 font-medium">
          <span className="inline-flex h-5 w-5 bg-rose-50 text-rose-700 border border-rose-200 rounded items-center justify-center font-mono text-[10px] font-bold">A</span> Absent
        </span>
        <span className="flex items-center gap-1.5 font-medium text-indigo-600">
          <span className="inline-flex px-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[10px] font-mono font-semibold">+2.5h</span> Overtime indicator
        </span>
        <span className="flex items-center gap-1.5 font-medium">
          <span className="inline-block h-5 w-5 bg-slate-100 border border-slate-200/60 rounded"></span> Future / Unlogged date
        </span>
        <span className="flex items-center gap-1 text-[11px] text-slate-400 italic ml-auto font-medium">
          <HelpCircle className="h-3.5 w-3.5" /> Dynamic columns adjust based on time horizon.
        </span>
      </div>

      {/* Main Grid Table Container */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-fixed min-w-[800px]">
            {/* Define strict col widths to avoid horizontal squeeze on smaller screens */}
            <colgroup>
              {/* Associate details: Employee ID, Full Name */}
              <col className="w-52" />
              
              {/* Dynamic dates cells */}
              {datesList.map(date => (
                <col key={date} className="w-16" />
              ))}
              
              {/* Row aggregates */}
              <col className="w-20" />
              <col className="w-20" />
              <col className="w-24" />
            </colgroup>

            <thead>
              {/* Double Header: Main Category and Date indicators */}
              <tr className="border-b border-slate-200 text-[10px] font-mono uppercase text-slate-500 bg-slate-50/50">
                <th className="py-4 px-4 font-semibold text-slate-900 border-r border-slate-100 align-bottom">
                  Associate Details
                </th>
                
                {/* Sequenced dates */}
                {datesList.map(date => {
                  const header = formatHeaderDate(date);
                  return (
                    <th key={date} className="py-2.5 px-1 text-center font-semibold border-r border-slate-100">
                      <span className="block text-[10px] text-slate-400 font-normal leading-tight">{header.sub}</span>
                      <span className="block text-xs font-bold text-slate-800 mt-0.5 font-mono">{header.label}</span>
                    </th>
                  );
                })}

                {/* Aggregated Totals Headers */}
                <th className="py-4 px-2 text-center font-bold text-emerald-700 bg-emerald-50/20 border-r border-slate-100 align-bottom">
                  Days P
                </th>
                <th className="py-4 px-2 text-center font-bold text-rose-700 bg-rose-50/20 border-r border-slate-100 align-bottom">
                  Days A
                </th>
                <th className="py-4 px-2 text-center font-bold text-indigo-800 bg-indigo-50/20 align-bottom">
                  Accum OT
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredAssociates.length === 0 ? (
                <tr>
                  <td colSpan={datesList.length + 4} className="py-12 text-center text-slate-400 text-sm font-medium">
                    No associates match the applied search queries or filters.
                  </td>
                </tr>
              ) : (
                operatingDeptsInFiltered.map(dept => {
                  // Get associates belonging to this department
                  const deptWorkers = filteredAssociates.filter(w => w.department === dept);
                  
                  return (
                    <React.Fragment key={dept}>
                      {/* Department Separator Row */}
                      <tr className="bg-slate-50/60 border-y border-slate-200/80">
                        <td 
                          colSpan={datesList.length + 4} 
                          className="py-2 px-4 font-display font-bold text-xs text-slate-700 uppercase tracking-wider"
                        >
                          <div className="flex items-center gap-2">
                            <Layers className="h-3.5 w-3.5 text-indigo-600" />
                            {dept} Group ({deptWorkers.length} workers)
                          </div>
                        </td>
                      </tr>

                      {/* Workers Rows */}
                      {deptWorkers.map(emp => {
                        const agg = getRowAggregates(emp.id);
                        return (
                          <tr key={emp.id} className="hover:bg-slate-50/40 transition-colors border-b border-slate-100">
                            
                            {/* Worker Profile column */}
                            <td className="py-3 px-4 border-r border-slate-100">
                              <div className="truncate">
                                <span className="block font-mono text-[11px] font-bold text-slate-900 leading-tight">
                                  {emp.id}
                                </span>
                                <span className="block text-xs font-semibold text-slate-700 truncate mt-0.5">
                                  {emp.name}
                                </span>
                              </div>
                            </td>

                            {/* Attendance Cells mapping */}
                            {datesList.map(date => {
                              const cell = getCellStatus(emp.id, date);
                              
                              if (!cell.isRecorded) {
                                return (
                                  <td key={date} className="py-3 px-1 border-r border-slate-100 text-center bg-slate-50/20">
                                    <span className="inline-block h-2 w-2 rounded-full bg-slate-200" title="Unlogged future date"></span>
                                  </td>
                                );
                              }

                              return (
                                <td 
                                  key={date} 
                                  className={`py-3 px-1 border-r border-slate-100 text-center transition-colors ${
                                    cell.isPresent ? 'bg-emerald-50/5' : 'bg-rose-50/5'
                                  }`}
                                >
                                  {cell.isPresent ? (
                                    <div className="flex flex-col items-center gap-0.5">
                                      <span className="inline-flex h-5 w-5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded items-center justify-center font-mono text-[10px] font-bold shadow-xs">
                                        P
                                      </span>
                                      {cell.ot > 0 && (
                                        <span className="text-[9px] font-mono font-bold text-indigo-600 bg-indigo-50 px-0.5 rounded leading-none">
                                          +{cell.ot}h
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="inline-flex h-5 w-5 bg-rose-50 text-rose-800 border border-rose-200 rounded items-center justify-center font-mono text-[10px] font-bold shadow-xs">
                                      A
                                    </span>
                                  )}
                                </td>
                              );
                            })}

                            {/* Aggregated totals */}
                            <td className="py-3 px-2 text-center font-mono font-bold text-xs text-emerald-700 bg-emerald-50/10 border-r border-slate-100">
                              {agg.present}
                            </td>
                            <td className="py-3 px-2 text-center font-mono font-bold text-xs text-rose-700 bg-rose-50/10 border-r border-slate-100">
                              {agg.absent}
                            </td>
                            <td className="py-3 px-2 text-center font-mono font-bold text-xs text-indigo-800 bg-indigo-50/10">
                              {agg.ot > 0 ? `${agg.ot}h` : '0h'}
                            </td>

                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })
              )}

              {/* Bottom Actual Headcount Totals Calculation Row */}
              {filteredAssociates.length > 0 && (
                <tr className="bg-slate-900 text-white border-t-2 border-slate-800 font-mono text-xs">
                  <td className="py-3.5 px-4 font-bold border-r border-slate-800">
                    <div className="flex items-center gap-1.5 uppercase tracking-wide text-[10px] text-indigo-400">
                      <Sparkles className="h-3.5 w-3.5" /> Floor Headcount
                    </div>
                  </td>
                  
                  {datesList.map(date => {
                    const total = getColumnTotalHeadcount(date);
                    return (
                      <td key={date} className="py-3.5 px-1 text-center font-bold border-r border-slate-800 text-indigo-400 bg-slate-950/40">
                        {total}
                      </td>
                    );
                  })}

                  {/* Empty summaries cells to complete the row */}
                  <td colSpan={3} className="bg-slate-950/80 p-3.5 text-center text-slate-500 font-normal italic text-[10px]">
                    Aggregate totals
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
