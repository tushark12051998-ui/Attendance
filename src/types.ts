export interface Associate {
  id: string;
  name: string;
  department: string;
  station?: string; // Station assigned to (defaults to department mapped if not set)
  status: 'Active' | 'Inactive';
  skill: 'Operator' | 'Helper';
}

export interface AttendanceRecordValue {
  isPresent: boolean;
  overtimeHours: number; // 0 to 8, 1 decimal place
}

export interface StationHeadcountPlan {
  station: string;
  planned: number;
  actualOverride?: number;
  actualOperatorsOverride?: number;
  actualHelpersOverride?: number;
  useOverride: boolean;
  notes: string;
  plannedOperators?: number;
  plannedHelpers?: number;
}

export interface HeadcountPlanValue {
  plannedHeadcount: number;
  actualHeadcountOverride?: number;
  useOverride: boolean;
  varianceNotes: string;
  stationPlans?: Record<string, StationHeadcountPlan>; // Station-wise capacity plans
}

// Map key: "YYYY-MM-DD_shiftId_associateId"
export type AttendanceMap = Record<string, AttendanceRecordValue>;

// Map key: "YYYY-MM-DD_shiftId"
export type HeadcountPlanMap = Record<string, HeadcountPlanValue>;

export interface Shift {
  id: string;
  name: string;
  time: string;
}

export const SHIFTS: Shift[] = [
  { id: 'ShiftA', name: 'Shift A', time: '06:00' },
  { id: 'ShiftB', name: 'Shift B', time: '14:00' },
  { id: 'ShiftC', name: 'Shift C', time: '22:00' }
];

export const DEPARTMENTS = [
  'Welding',
  'Assembly',
  'Machining',
  'Quality Control'
];
