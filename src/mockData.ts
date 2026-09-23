import { Associate, AttendanceMap, HeadcountPlanMap } from './types';

export const INITIAL_ASSOCIATES: Associate[] = [
  { id: 'IDRCW001', name: 'John Miller', department: 'Welding', station: 'Welding Station', status: 'Active', skill: 'Operator' },
  { id: 'IDRCW002', name: 'Sarah Chen', department: 'Assembly', station: 'Assembly Line', status: 'Active', skill: 'Helper' },
  { id: 'IDRCW003', name: 'Marcus Vance', department: 'Machining', station: 'Machining Station', status: 'Active', skill: 'Operator' },
  { id: 'IDRCW004', name: 'Elena Rostova', department: 'Assembly', station: 'Assembly Line', status: 'Active', skill: 'Helper' },
  { id: 'IDRCW005', name: 'David Kojo', department: 'Welding', station: 'Welding Station', status: 'Active', skill: 'Operator' },
  { id: 'IDRCW006', name: 'Yuki Tanaka', department: 'Machining', station: 'Machining Station', status: 'Active', skill: 'Helper' },
  { id: 'IDRCW007', name: 'Carlos Mendez', department: 'Assembly', station: 'Assembly Line', status: 'Active', skill: 'Operator' },
  { id: 'IDRCW008', name: 'Diana Prince', department: 'Quality Control', station: 'Quality Control Station', status: 'Active', skill: 'Operator' }
];

// Helper to generate mock data for 2026-07-12, 2026-07-13, 2026-07-14
const generateMockRecords = (): { attendance: AttendanceMap; plans: HeadcountPlanMap } => {
  const attendance: AttendanceMap = {};
  const plans: HeadcountPlanMap = {};

  const dates = ['2026-07-12', '2026-07-13', '2026-07-14'];
  const shifts = ['ShiftA', 'ShiftB', 'ShiftC'];

  // Configure specific scenario patterns for each date and shift to look realistic:
  // Date 12 (Sunday) - lower planned, some overtime
  // Date 13 (Monday) - standard weekday, high plan, some absenteeism, variance logged
  // Date 14 (Tuesday) - standard weekday, high plan, perfect attendance

  dates.forEach(date => {
    shifts.forEach(shift => {
      const planKey = `${date}_${shift}`;
      let planned = 5;
      let notes = '';

      if (date === '2026-07-12') {
        // Sunday: lower target
        planned = shift === 'ShiftC' ? 3 : 4;
      } else if (date === '2026-07-13') {
        // Monday: standard high target
        planned = shift === 'ShiftA' ? 6 : shift === 'ShiftB' ? 5 : 4;
      } else {
        // Tuesday: standard high target
        planned = shift === 'ShiftA' ? 7 : shift === 'ShiftB' ? 5 : 4;
      }

      // Populate associate attendance for this shift
      let presentCount = 0;

      INITIAL_ASSOCIATES.forEach((emp, index) => {
        const attKey = `${date}_${shift}_${emp.id}`;
        
        // Define attendance patterns
        let isPresent = true;
        let otHours = 0;

        if (date === '2026-07-12') {
          // Sunday: Only some workers scheduled or active
          // Shift A: index 0, 1, 2, 7 present
          // Shift B: index 3, 4, 5 present
          // Shift C: index 6, 7 present
          if (shift === 'ShiftA') {
            isPresent = [0, 1, 2, 7].includes(index);
            if (isPresent && index === 0) otHours = 2.0;
            if (isPresent && index === 2) otHours = 1.5;
          } else if (shift === 'ShiftB') {
            isPresent = [3, 4, 5].includes(index);
            if (isPresent && index === 4) otHours = 3.0;
          } else {
            isPresent = [6, 7].includes(index);
          }
        } else if (date === '2026-07-13') {
          // Monday: Some absenteeism on Shift A and B
          if (shift === 'ShiftA') {
            // Sarah Chen (index 1) called in sick, Elena Rostova (index 3) absent
            isPresent = ![1, 3].includes(index);
            if (isPresent && index === 0) otHours = 1.5;
            if (isPresent && index === 4) otHours = 2.0;
          } else if (shift === 'ShiftB') {
            // Yuki Tanaka (index 5) absent
            isPresent = index !== 5;
            if (isPresent && index === 2) otHours = 1.0;
          } else {
            // Shift C: perfect attendance for scheduled 4
            isPresent = [1, 3, 5, 7].includes(index);
            if (isPresent && index === 7) otHours = 2.0;
          }
        } else {
          // Tuesday: Perfect high attendance or standard
          if (shift === 'ShiftA') {
            isPresent = index !== 6; // Carlos Mendez off
            if (isPresent && index === 1) otHours = 2.5;
            if (isPresent && index === 3) otHours = 1.0;
          } else if (shift === 'ShiftB') {
            isPresent = [0, 2, 4, 6, 7].includes(index);
            if (isPresent && index === 0) otHours = 1.5;
          } else {
            isPresent = [1, 3, 5].includes(index);
          }
        }

        attendance[attKey] = {
          isPresent,
          overtimeHours: isPresent ? parseFloat(otHours.toFixed(1)) : 0.0
        };

        if (isPresent) {
          presentCount++;
        }
      });

      // Variance logging triggers when actual < planned
      if (presentCount < planned) {
        if (date === '2026-07-13' && shift === 'ShiftA') {
          notes = 'Sarah Chen called in sick (assembly line); Elena Rostova absent due to family emergency. Line 1 assembly rate slightly reduced.';
        } else if (date === '2026-07-13' && shift === 'ShiftB') {
          notes = 'Yuki Tanaka absent (machining). Setup on Mill #3 delayed by 45 mins; workload re-routed to Shift C.';
        } else if (date === '2026-07-12' && shift === 'ShiftA') {
          notes = 'Scheduled Sunday maintenance crew short-staffed. Delayed preventive maintenance on Welding Robot #2.';
        } else {
          notes = `Understaffed for production requirements. Gap of ${planned - presentCount} worker(s). Operations adjusted.`;
        }
      }

      plans[planKey] = {
        plannedHeadcount: planned,
        useOverride: false,
        varianceNotes: notes
      };
    });
  });

  return { attendance, plans };
};

const mockData = generateMockRecords();
export const INITIAL_ATTENDANCE = mockData.attendance;
export const INITIAL_HEADCOUNT_PLANS = mockData.plans;
