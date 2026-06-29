import { query } from './db';

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  color: string;
  isDirector: boolean;
  isLeader: boolean;
  sortOrder: number;
  active: boolean;
}

export const SHIFTS: Record<string, { name: string; time: string; hours: number }> = {
  day:     { name: '白班', time: '08:00-12:00, 15:00-18:00', hours: 7 },
  noon:    { name: '午间备班', time: '08:00-15:00', hours: 7 },
  evening: { name: '晚班', time: '18:00-01:00', hours: 7 },
  night:   { name: '夜班', time: '01:00-08:00', hours: 7 },
};

export const WEEKEND_SHIFTS: Record<string, { time: string; hours: number }> = {
  day:     { time: '08:00-16:00', hours: 8 },
  evening: { time: '16:00-00:00', hours: 8 },
  night:   { time: '00:00-08:00', hours: 8 },
};

// Fallback hardcoded staff (used only if DB is unavailable)
const FALLBACK_STAFF: StaffMember[] = [
  { id: 'dgm', name: '邓高明', role: '技术主管', color: '#1a73e8', isDirector: true, isLeader: false, sortOrder: 1, active: true },
  { id: 'cht', name: '陈能隆', role: '技术组长', color: '#e91e63', isDirector: false, isLeader: true, sortOrder: 2, active: true },
  { id: 'pht', name: '庞涵天', role: '技术员', color: '#4caf50', isDirector: false, isLeader: false, sortOrder: 3, active: true },
  { id: 'zyf', name: '张永芳', role: '技术员', color: '#ff9800', isDirector: false, isLeader: false, sortOrder: 4, active: true },
  { id: 'nbs', name: '农帮善', role: '技术员', color: '#9c27b0', isDirector: false, isLeader: false, sortOrder: 5, active: true },
  { id: 'wgn', name: '王国楠', role: '技术员', color: '#00bcd4', isDirector: false, isLeader: false, sortOrder: 6, active: true },
  { id: 'nyj', name: '乃业隽', role: '技术员', color: '#795548', isDirector: false, isLeader: false, sortOrder: 7, active: true },
];

// Load staff from database
export async function loadStaff(): Promise<StaffMember[]> {
  try {
    const rows = await query(
      `SELECT id, name, role, color, is_director, is_leader, sort_order, active
       FROM staff ORDER BY sort_order`
    );
    if (rows.length === 0) return FALLBACK_STAFF;
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      role: r.role,
      color: r.color,
      isDirector: r.is_director,
      isLeader: r.is_leader,
      sortOrder: r.sort_order,
      active: r.active,
    }));
  } catch {
    return FALLBACK_STAFF;
  }
}

// Load rules from database
export async function loadRules(): Promise<Record<string, string>> {
  try {
    const rows = await query(`SELECT key, value FROM rules`);
    if (rows.length === 0) return DEFAULT_RULES;
    const rules: Record<string, string> = {};
    for (const r of rows) {
      rules[r.key] = r.value;
    }
    return rules;
  } catch {
    return DEFAULT_RULES;
  }
}

export const DEFAULT_RULES: Record<string, string> = {
  weekday_day_min: '3',
  weekday_day_hours: '7',
  weekday_noon_hours: '7',
  weekday_evening_hours: '7',
  weekday_night_hours: '7',
  weekend_day_hours: '8',
  weekend_evening_hours: '8',
  weekend_night_hours: '8',
  max_monthly_hours: '210',
  max_consecutive_days: '5',
  rest_after_night: '1',
  require_leader_dayshift: 'true',
};

// For client-side use (static data)
export const STAFF = FALLBACK_STAFF;

export function getStaffById(staff: StaffMember[], id: string): StaffMember | undefined {
  return staff.find(s => s.id === id);
}

export function isLeader(staff: StaffMember[], staffId: string): boolean {
  const s = staff.find(x => x.id === staffId);
  return !!(s?.isDirector || s?.isLeader);
}
