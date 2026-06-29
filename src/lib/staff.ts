export const STAFF = [
  { id: 'dgm', name: '邓高明', role: '技术主管', color: '#1a73e8', isDirector: true, isLeader: false },
  { id: 'cht', name: '陈能隆', role: '技术组长', color: '#e91e63', isDirector: false, isLeader: true },
  { id: 'pht', name: '庞涵天', role: '技术员', color: '#4caf50', isDirector: false, isLeader: false },
  { id: 'zyf', name: '张永芳', role: '技术员', color: '#ff9800', isDirector: false, isLeader: false },
  { id: 'nbs', name: '农帮善', role: '技术员', color: '#9c27b0', isDirector: false, isLeader: false },
  { id: 'wgn', name: '王国楠', role: '技术员', color: '#00bcd4', isDirector: false, isLeader: false },
  { id: 'nyj', name: '乃业隽', role: '技术员', color: '#795548', isDirector: false, isLeader: false },
];

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

export function getStaffById(id: string) {
  return STAFF.find(s => s.id === id);
}

export function isLeader(staffId: string): boolean {
  const staff = getStaffById(staffId);
  return staff?.isDirector || staff?.isLeader || false;
}
