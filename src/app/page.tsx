'use client';

import { useEffect, useState, useCallback } from 'react';
import Header from '@/components/Header';
import Calendar from '@/components/Calendar';
import GenerateButton from '@/components/GenerateButton';
import LeaveModal from '@/components/LeaveModal';
import { SHIFTS, WEEKEND_SHIFTS, type ShiftConfig, isOvernight } from '@/lib/staff';

interface StaffMember {
  id: string;
  name: string;
  role: string;
  color: string;
  isDirector: boolean;
  isLeader: boolean;
}

interface User {
  id: number;
  username: string;
  name: string;
  role: string;
  staffId: string;
}

interface ScheduleEntry {
  id: number;
  date: string;
  shift: string;
  staff_id: string;
}

interface LeaveEntry {
  id: number;
  date: string;
  staff_id: string;
  reason: string;
}

const HOLIDAYS_2026: Record<string, string> = {
  '2026-01-01': '元旦', '2026-01-02': '元旦', '2026-01-03': '元旦',
  '2026-02-17': '春节', '2026-02-18': '春节', '2026-02-19': '春节',
  '2026-02-20': '春节', '2026-02-21': '春节', '2026-02-22': '春节', '2026-02-23': '春节',
  '2026-04-05': '清明节', '2026-04-06': '清明节', '2026-04-07': '清明节',
  '2026-05-01': '劳动节', '2026-05-02': '劳动节', '2026-05-03': '劳动节',
  '2026-05-04': '劳动节', '2026-05-05': '劳动节',
  '2026-05-31': '端午节', '2026-06-01': '端午节', '2026-06-02': '端午节',
  '2026-10-01': '国庆节', '2026-10-02': '国庆节', '2026-10-03': '国庆节',
  '2026-10-04': '国庆节', '2026-10-05': '国庆节', '2026-10-06': '国庆节', '2026-10-07': '国庆节',
};

const WORKDAYS_OVERRIDE: Record<string, boolean> = {
  '2026-01-04': true, '2026-02-07': true, '2026-02-21': true,
  '2026-04-26': true, '2026-05-09': true, '2026-06-28': true,
  '2026-10-10': true,
};

function isRestDay(dateStr: string): boolean {
  if (HOLIDAYS_2026[dateStr]) return true;
  if (WORKDAYS_OVERRIDE[dateStr]) return false;
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  return day === 0 || day === 6;
}

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [leaves, setLeaves] = useState<LeaveEntry[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [shiftConfig, setShiftConfig] = useState<ShiftConfig | null>(null);

  // Load user from localStorage (optional - page works without login)
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const todayMonth = today.getMonth() + 1;
      const todayYear = today.getFullYear();
      const tomorrowMonth = tomorrow.getMonth() + 1;
      const tomorrowYear = tomorrow.getFullYear();

      const monthsToFetch = new Set<string>();
      monthsToFetch.add(`${year}-${month}`);
      monthsToFetch.add(`${todayYear}-${todayMonth}`);
      monthsToFetch.add(`${tomorrowYear}-${tomorrowMonth}`);

      const schedRequests = Array.from(monthsToFetch).map(m => {
        const [y, mo] = m.split('-');
        return fetch(`/api/schedule/public?year=${y}&month=${mo}`);
      });

      const schedResponses = await Promise.all([...schedRequests, fetch('/api/staff/public')]);
      const staffRes = schedResponses.pop()!;

      let allSchedules: ScheduleEntry[] = [];
      let allLeaves: LeaveEntry[] = [];
      let shiftConfigData: ShiftConfig | null = null;
      for (const res of schedResponses) {
        if (res.ok) {
          const data = await res.json();
          allSchedules = allSchedules.concat(data.schedules || []);
          allLeaves = allLeaves.concat(data.leaves || []);
          if (!shiftConfigData && data.shiftConfig) shiftConfigData = data.shiftConfig;
        }
      }

      const seenSched = new Set<string>();
      const uniqueSchedules = allSchedules.filter(e => {
        const key = `${e.date}-${e.shift}-${e.staff_id}`;
        if (seenSched.has(key)) return false;
        seenSched.add(key);
        return true;
      });
      const seenLeave = new Set<string>();
      const uniqueLeaves = allLeaves.filter(e => {
        const key = `${e.date}-${e.staff_id}`;
        if (seenLeave.has(key)) return false;
        seenLeave.add(key);
        return true;
      });

      setSchedules(uniqueSchedules);
      setLeaves(uniqueLeaves);
      setShiftConfig(shiftConfigData);
      if (staffRes.ok) {
        const data = await staffRes.json();
        setStaffList(data.staff || []);
      }
    } catch {
      console.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePrevMonth = () => {
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else { setMonth(month - 1); }
  };

  const handleNextMonth = () => {
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else { setMonth(month + 1); }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    setUser(null);
  };

  // 本月工时统计（仅管理员可见）
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
  const monthSchedules = schedules.filter(e => e.date.startsWith(monthPrefix));
  const effShifts = (rest: boolean) => rest ? (shiftConfig?.WEEKEND_SHIFTS || WEEKEND_SHIFTS) : (shiftConfig?.SHIFTS || SHIFTS);
  const stats = staffList.map(s => {
    let hours = 0;
    let total = 0;
    const shiftCounts: Record<string, number> = { day: 0, noon: 0, evening: 0, night: 0 };
    monthSchedules.forEach(e => {
      if (e.staff_id === s.id) {
        const dateStr = e.date.split('T')[0];
        const rest = isRestDay(dateStr);
        const shifts = effShifts(rest);
        if (shifts[e.shift]) {
          if (e.shift !== 'noon') {
            hours += shifts[e.shift].hours;
          }
          total++;
          shiftCounts[e.shift]++;
        }
      }
    });
    const noonDays = monthSchedules.filter(e => e.staff_id === s.id && e.shift === 'noon').map(e => e.date.split('T')[0]);
    const effWeekday = effShifts(false);
    hours -= noonDays.length * (effWeekday.day?.hours || 7);
    hours += noonDays.length * (effWeekday.noon?.hours || 7);

    return { ...s, hours, total, day: shiftCounts.day, noon: shiftCounts.noon, evening: shiftCounts.evening, night: shiftCounts.night };
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} onLogout={handleLogout} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Schedule Info Cards */}
        {(() => {
          const wd = shiftConfig?.SHIFTS || SHIFTS;
          const we = shiftConfig?.WEEKEND_SHIFTS || WEEKEND_SHIFTS;
          const wdOvernight = isOvernight(wd.evening.time);
          const weOvernight = isOvernight(we.evening.time);
          return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-green-50 border border-green-200 rounded-xl p-5">
              <h3 className="font-bold text-green-800 text-base mb-3">📅 工作日排班（周一至周五）</h3>
              <div className="space-y-1.5 text-sm text-green-900">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-green-500 inline-block"></span>
                  <span><b>白班</b> {wd.day.time}（{wd.day.hours}h，午休12:00-15:00）</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-orange-400 inline-block"></span>
                  <span><b>白加午</b> {wd.noon.time}连续（{wd.noon.hours}h，白班选1人，全天在岗）</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-blue-500 inline-block"></span>
                  <span><b>晚班</b> {wd.evening.time}（{wd.evening.hours}h）</span>
                </div>
                {!wdOvernight && (
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-purple-500 inline-block"></span>
                  <span><b>夜班</b> {wd.night.time}（{wd.night.hours}h）</span>
                </div>
                )}
                <div className="text-green-700 mt-2 text-xs">白班≥3人 + 白加午1人 + 晚班1人{!wdOvernight ? ' + 夜班1人' : ''}</div>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
              <h3 className="font-bold text-blue-800 text-base mb-3">🗓️ 周末/节假日排班</h3>
              <div className="space-y-1.5 text-sm text-blue-900">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-green-500 inline-block"></span>
                  <span><b>白班</b> {we.day.time}（{we.day.hours}h，1人）</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-blue-500 inline-block"></span>
                  <span><b>晚班</b> {we.evening.time}（{we.evening.hours}h，1人）</span>
                </div>
                {!weOvernight && (
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-purple-500 inline-block"></span>
                  <span><b>夜班</b> {we.night.time}（{we.night.hours}h，1人）</span>
                </div>
                )}
                <div className="text-blue-700 mt-2 text-xs">门诊不开，每班1人，三班覆盖24h</div>
              </div>
            </div>
          </div>
            );
          })()}

        {/* Today & Tomorrow Quick View */}
        {!loading && schedules.length > 0 && (() => {
          const today = new Date();
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          const fmt = (d: Date) => d.toISOString().split('T')[0];
          const todayStr = fmt(today);
          const tomorrowStr = fmt(tomorrow);

          const SHIFT_LABELS: Record<string, string> = { day: '白班', noon: '白加午', evening: '晚班', night: '夜班' };
          const SHIFT_COLORS: Record<string, string> = { day: '#4caf50', noon: '#ff9800', evening: '#2196f3', night: '#9c27b0' };
          const effEveningTime = shiftConfig?.SHIFTS?.evening?.time || '18:00-01:00';
          const effNightTime = shiftConfig?.SHIFTS?.night?.time || '01:00-08:00';
          const effNoonTime = shiftConfig?.SHIFTS?.noon?.time || '08:00-18:00';
          const SHIFT_TIMES: Record<string, string> = { day: '08:00-18:00', noon: effNoonTime, evening: effEveningTime, night: effNightTime };
          const SHIFT_ORDER = ['day', 'noon', 'evening', 'night'];

          const getName = (id: string) => staffList.find(s => s.id === id)?.name || id;
          const getColor = (id: string) => staffList.find(s => s.id === id)?.color || '#666';

          const renderDay = (dateStr: string, label: string) => {
            const dayEntries = schedules.filter(e => e.date.split('T')[0] === dateStr);
            if (dayEntries.length === 0) return null;

            const byShift: Record<string, string[]> = {};
            dayEntries.forEach(e => {
              if (!byShift[e.shift]) byShift[e.shift] = [];
              byShift[e.shift].push(e.staff_id);
            });
            // 午班的人不显示在白班
            const noonIds = byShift['noon'] || [];

            return (
              <div key={dateStr} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{label === '今天' ? '📍' : '📅'}</span>
                  <span className="font-bold text-gray-800">{label}</span>
                  <span className="text-sm text-gray-500">{dateStr}</span>
                </div>
                <div className="space-y-2">
                  {SHIFT_ORDER.map(shift => {
                    const ids = byShift[shift];
                    if (!ids || ids.length === 0) return null;
                    const displayIds = shift === 'day' ? ids.filter(id => !noonIds.includes(id)) : ids;
                    if (displayIds.length === 0) return null;
                    return (
                      <div key={shift} className="flex items-start gap-3">
                        <div className="w-16 shrink-0">
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium text-white" style={{ backgroundColor: SHIFT_COLORS[shift] }}>{SHIFT_LABELS[shift]}</span>
                          <div className="text-[10px] text-gray-400 mt-0.5">{SHIFT_TIMES[shift]}</div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {displayIds.map(id => (
                            <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm text-white" style={{ backgroundColor: getColor(id) }}>
                              {getName(id)}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          };

          const todayCard = renderDay(todayStr, '今天');
          const tomorrowCard = renderDay(tomorrowStr, '明天');

          if (!todayCard && !tomorrowCard) return null;

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {todayCard || <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-4 flex items-center justify-center text-gray-400 text-sm">今天无排班数据</div>}
              {tomorrowCard || <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-4 flex items-center justify-center text-gray-400 text-sm">明天无排班数据</div>}
            </div>
          );
        })()}

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-4">
            <button onClick={handlePrevMonth} className="p-2 rounded-lg hover:bg-gray-200 transition text-xl text-gray-800 font-bold">◀</button>
            <h2 className="text-2xl font-bold text-gray-800">{year}年{month}月</h2>
            <button onClick={handleNextMonth} className="p-2 rounded-lg hover:bg-gray-200 transition text-xl text-gray-800 font-bold">▶</button>
          </div>
          <div className="flex items-center gap-3">
            {user?.role === 'admin' && (
              <>
                <button onClick={() => setShowLeaveModal(true)} className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition">🏥 添加请假</button>
                <GenerateButton year={year} month={month} staff={staffList} onGenerated={fetchData} />
              </>
            )}
            {!user && (
              <a href="/login" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">🔑 管理员登录</a>
            )}
          </div>
        </div>

        {/* Calendar */}
        {loading ? (
          <div className="text-center py-20 text-gray-500">加载排班数据中...</div>
        ) : (
          <Calendar
            year={year}
            month={month}
            schedules={schedules}
            leaves={leaves}
            staff={staffList}
            isAdmin={user?.role === 'admin'}
            shiftConfig={shiftConfig}
            onDeleteLeave={user?.role === 'admin' ? async (date: string, staffId: string) => {
              if (!confirm('确定要删除这条请假记录吗？')) return;
              await fetch('/api/leave', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, staff_id: staffId }) });
              fetchData();
            } : undefined}
          />
        )}

        {/* Monthly Stats - 管理员可见 */}
        {user?.role === 'admin' && !loading && stats.length > 0 && (
          <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="text-lg font-bold text-gray-800 mb-4">📊 本月工时统计</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {stats.map(s => (
                <div key={s.id} className="text-center p-3 rounded-lg" style={{ backgroundColor: s.color + '15' }}>
                  <div className="font-bold text-sm" style={{ color: s.color }}>{s.name}</div>
                  <div className="text-2xl font-bold text-gray-800 mt-1">{s.hours}h</div>
                  <div className="text-xs text-gray-500 mt-1">
                    白{s.day} 午{s.noon} 晚{s.evening} 夜{s.night}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-gray-500 text-right">
              月工时上限：210h（标准174h + 加班36h）
            </div>
          </div>
        )}


      </main>

      {/* Leave Modal */}
      {user?.role === 'admin' && (
        <LeaveModal isOpen={showLeaveModal} onClose={() => setShowLeaveModal(false)} year={year} month={month} staff={staffList} onSuccess={fetchData} />
      )}
    </div>
  );
}
