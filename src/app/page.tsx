'use client';

import { useEffect, useState, useCallback } from 'react';
import Header from '@/components/Header';
import Calendar from '@/components/Calendar';
import GenerateButton from '@/components/GenerateButton';
import LeaveModal from '@/components/LeaveModal';
import { SHIFTS, WEEKEND_SHIFTS } from '@/lib/staff';

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
      const [schedRes, staffRes] = await Promise.all([
        fetch(`/api/schedule/public?year=${year}&month=${month}`),
        fetch('/api/staff/public'),
      ]);
      if (schedRes.ok) {
        const data = await schedRes.json();
        setSchedules(data.schedules || []);
        setLeaves(data.leaves || []);
      }
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

  // Calculate monthly stats
  const stats = staffList.map(s => {
    let hours = 0;
    let total = 0;
    const shiftCounts: Record<string, number> = { day: 0, noon: 0, evening: 0, night: 0 };
    schedules.forEach(e => {
      if (e.staff_id === s.id) {
        const dateStr = e.date.split('T')[0];
        const rest = isRestDay(dateStr);
        const shifts = rest ? WEEKEND_SHIFTS : SHIFTS;
        if (shifts[e.shift]) {
          // noon person is also in day, don't double count
          if (e.shift === 'noon') {
            // noon replaces day hours for that person
          } else {
            hours += shifts[e.shift].hours;
          }
          total++;
          shiftCounts[e.shift]++;
        }
      }
    });
    // Fix noon hours: if someone has noon, subtract day hours for those days and add noon hours
    const noonDays = schedules.filter(e => e.staff_id === s.id && e.shift === 'noon').map(e => e.date.split('T')[0]);
    hours -= noonDays.length * (SHIFTS.day?.hours || 7);
    hours += noonDays.length * (SHIFTS.noon?.hours || 7);

    return { ...s, hours, total, day: shiftCounts.day, noon: shiftCounts.noon, evening: shiftCounts.evening, night: shiftCounts.night };
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} onLogout={handleLogout} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Schedule Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-green-50 border border-green-200 rounded-xl p-5">
            <h3 className="font-bold text-green-800 text-base mb-3">📅 工作日排班（周一至周五）</h3>
            <div className="space-y-1.5 text-sm text-green-900">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-green-500 inline-block"></span>
                <span><b>白班</b> 08:00-12:00 + 15:00-18:00（7h，午休12:00-15:00）</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-orange-400 inline-block"></span>
                <span><b>午间备班</b> 08:00-15:00连续（7h，白班选1人，覆盖午休时段）</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-blue-500 inline-block"></span>
                <span><b>晚班</b> 18:00-01:00（7h）</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-purple-500 inline-block"></span>
                <span><b>夜班</b> 01:00-08:00（7h）</span>
              </div>
              <div className="text-green-700 mt-2 text-xs">白班≥3人（含1名leader）+ 午备1人 + 晚班1人 + 夜班1人</div>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <h3 className="font-bold text-blue-800 text-base mb-3">🗓️ 周末/节假日排班</h3>
            <div className="space-y-1.5 text-sm text-blue-900">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-green-500 inline-block"></span>
                <span><b>白班</b> 08:00-16:00（8h，1人）</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-blue-500 inline-block"></span>
                <span><b>晚班</b> 16:00-00:00（8h，1人）</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-purple-500 inline-block"></span>
                <span><b>夜班</b> 00:00-08:00（8h，1人）</span>
              </div>
              <div className="text-blue-700 mt-2 text-xs">门诊不开，每班1人，三班覆盖24h</div>
            </div>
          </div>
        </div>

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
                <GenerateButton year={year} month={month} onGenerated={fetchData} />
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
            onDeleteLeave={user?.role === 'admin' ? async (date: string, staffId: string) => {
              if (!confirm('确定要删除这条请假记录吗？')) return;
              await fetch('/api/leave', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, staff_id: staffId }) });
              fetchData();
            } : undefined}
          />
        )}

        {/* Monthly Stats */}
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
      </main>

      {/* Leave Modal */}
      {user?.role === 'admin' && (
        <LeaveModal isOpen={showLeaveModal} onClose={() => setShowLeaveModal(false)} year={year} month={month} staff={staffList} onSuccess={fetchData} />
      )}
    </div>
  );
}
