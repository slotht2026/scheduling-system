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
  noon:    { name: '白加午', time: '08:00-18:00', hours: 10 },
  evening: { name: '晚班', time: '18:00-01:00', hours: 7 },
  night:   { name: '夜班', time: '01:00-08:00', hours: 7 },
};

export const WEEKEND_SHIFTS: Record<string, { time: string; hours: number }> = {
  day:     { time: '08:00-16:00', hours: 8 },
  evening: { time: '16:00-00:00', hours: 8 },
  night:   { time: '00:00-08:00', hours: 8 },
};

// Fallback hardcoded staff (used only if DB is unavailable)
export const FALLBACK_STAFF: StaffMember[] = [
  { id: 'dgm', name: '邓高明', role: '技术主管', color: '#1a73e8', isDirector: true, isLeader: false, sortOrder: 1, active: true },
  { id: 'cht', name: '陈能隆', role: '技术组长', color: '#e91e63', isDirector: false, isLeader: true, sortOrder: 2, active: true },
  { id: 'pht', name: '庞涵天', role: '技术员', color: '#4caf50', isDirector: false, isLeader: false, sortOrder: 3, active: true },
  { id: 'zyf', name: '张永芳', role: '技术员', color: '#ff9800', isDirector: false, isLeader: false, sortOrder: 4, active: true },
  { id: 'nbs', name: '农帮善', role: '技术员', color: '#9c27b0', isDirector: false, isLeader: false, sortOrder: 5, active: true },
  { id: 'wgn', name: '王国楠', role: '技术员', color: '#00bcd4', isDirector: false, isLeader: false, sortOrder: 6, active: true },
  { id: 'nyj', name: '乃业隽', role: '技术员', color: '#795548', isDirector: false, isLeader: false, sortOrder: 7, active: true },
];

export const DEFAULT_RULES: Record<string, string> = {
  weekday_day_min: '3',
  weekday_day_time: '08:00-12:00, 15:00-18:00',
  weekday_day_hours: '7',
  weekday_noon_time: '08:00-18:00',
  weekday_noon_hours: '10',
  weekday_evening_time: '18:00-01:00',
  weekday_evening_hours: '7',
  weekday_night_time: '01:00-08:00',
  weekday_night_hours: '7',
  weekend_day_time: '08:00-16:00',
  weekend_day_hours: '8',
  weekend_evening_time: '16:00-00:00',
  weekend_evening_hours: '8',
  weekend_night_time: '00:00-08:00',
  weekend_night_hours: '8',
  max_monthly_hours: '210',
  max_consecutive_days: '5',
  rest_after_night: '1',
  require_leader_dayshift: 'true',
};

// 判断班次时段是否跨天（如 18:00-08:00、18:00-01:00）。
// 跨天即视为「通宵班」，排班时不再单独排夜班。
// 注意：结束时间恰好为 00:00（如 16:00-00:00）不算跨天，因为它是与夜班 00:00-08:00 无缝衔接的三班倒。
export function isOvernight(time: string): boolean {
  const segments = time.split(',').map(s => s.trim()).filter(Boolean);
  if (segments.length === 0) return false;
  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const firstStart = toMinutes(segments[0].split('-')[0]);
  const lastEnd = toMinutes(segments[segments.length - 1].split('-')[1]);
  // 结束时间恰为 00:00 → 不算跨天（与夜班无缝衔接）
  if (lastEnd === 0) return false;
  return lastEnd < firstStart; // 结束时间早于开始时间 → 跨天
}

export interface ShiftConfig {
  SHIFTS: Record<string, { name: string; time: string; hours: number }>;
  WEEKEND_SHIFTS: Record<string, { time: string; hours: number }>;
  mergeEveningNight: boolean;
}

// 根据数据库规则构建「生效班次配置」。当工作日或周末晚班时段跨天（如 18:00-08:00）时，
// 自动视为通宵班，排班算法不再单独排夜班（mergeEveningNight=true）。
export function buildShiftConfig(rules: Record<string, string> = {}): ShiftConfig {
  const customShifts: Record<string, { name: string; time: string; hours: number }> = { ...SHIFTS };
  if (rules.weekday_day_time) customShifts.day = { ...customShifts.day, time: rules.weekday_day_time };
  if (rules.weekday_day_hours) customShifts.day = { ...customShifts.day, hours: parseInt(rules.weekday_day_hours) };
  if (rules.weekday_noon_time) customShifts.noon = { ...customShifts.noon, time: rules.weekday_noon_time };
  if (rules.weekday_noon_hours) customShifts.noon = { ...customShifts.noon, hours: parseInt(rules.weekday_noon_hours) };
  if (rules.weekday_evening_time) customShifts.evening = { ...customShifts.evening, time: rules.weekday_evening_time };
  if (rules.weekday_evening_hours) customShifts.evening = { ...customShifts.evening, hours: parseInt(rules.weekday_evening_hours) };
  if (rules.weekday_night_time) customShifts.night = { ...customShifts.night, time: rules.weekday_night_time };
  if (rules.weekday_night_hours) customShifts.night = { ...customShifts.night, hours: parseInt(rules.weekday_night_hours) };

  const customWeekendShifts: Record<string, { time: string; hours: number }> = { ...WEEKEND_SHIFTS };
  if (rules.weekend_day_time) customWeekendShifts.day = { ...customWeekendShifts.day, time: rules.weekend_day_time };
  if (rules.weekend_day_hours) customWeekendShifts.day = { ...customWeekendShifts.day, hours: parseInt(rules.weekend_day_hours) };
  if (rules.weekend_evening_time) customWeekendShifts.evening = { ...customWeekendShifts.evening, time: rules.weekend_evening_time };
  if (rules.weekend_evening_hours) customWeekendShifts.evening = { ...customWeekendShifts.evening, hours: parseInt(rules.weekend_evening_hours) };
  if (rules.weekend_night_time) customWeekendShifts.night = { ...customWeekendShifts.night, time: rules.weekend_night_time };
  if (rules.weekend_night_hours) customWeekendShifts.night = { ...customWeekendShifts.night, hours: parseInt(rules.weekend_night_hours) };

  // 晚班时段跨天 → 自动合并（不再单独排夜班）
  const merge = isOvernight(customShifts.evening.time) || isOvernight(customWeekendShifts.evening.time);

  return { SHIFTS: customShifts, WEEKEND_SHIFTS: customWeekendShifts, mergeEveningNight: merge };
}

// For client-side use (static data)
export const STAFF = FALLBACK_STAFF;

export function getStaffById(staff: StaffMember[], id: string): StaffMember | undefined {
  return staff.find(s => s.id === id);
}

export function isLeader(staff: StaffMember[], staffId: string): boolean {
  const s = staff.find(x => x.id === staffId);
  return !!(s?.isDirector || s?.isLeader);
}
