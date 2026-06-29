'use client';

import { useEffect, useState, useCallback } from 'react';
import Header from '@/components/Header';
import Calendar from '@/components/Calendar';
import GenerateButton from '@/components/GenerateButton';
import LeaveModal from '@/components/LeaveModal';

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
                <span><b>早午班</b> 08:00-15:00连续（7h，白班选1人，覆盖午休时段）</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-blue-500 inline-block"></span>
                <span><b>晚班</b> 18:00-01:00（7h）</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-purple-500 inline-block"></span>
                <span><b>夜班</b> 01:00-08:00（7h）</span>
              </div>
              <div className="text-green-700 mt-2 text-xs">白班≥3人 + 早午班1人 + 晚班1人 + 夜班1人</div>
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

        {/* Today & Tomorrow Quick View */}
        {!loading && schedules.length > 0 && (() => {
          const today = new Date();
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          const fmt = (d: Date) => d.toISOString().split('T')[0];
          const todayStr = fmt(today);
          const tomorrowStr = fmt(tomorrow);

          const SHIFT_LABELS: Record<string, string> = { day: '白班', noon: '早午班', evening: '晚班', night: '夜班' };
          const SHIFT_COLORS: Record<string, string> = { day: '#4caf50', noon: '#ff9800', evening: '#2196f3', night: '#9c27b0' };
          const SHIFT_TIMES: Record<string, string> = { day: '08:00-18:00', noon: '08:00-15:00', evening: '18:00-01:00', night: '01:00-08:00' };
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
            onDeleteLeave={user?.role === 'admin' ? async (date: string, staffId: string) => {
              if (!confirm('确定要删除这条请假记录吗？')) return;
              await fetch('/api/leave', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, staff_id: staffId }) });
              fetchData();
            } : undefined}
          />
        )}


      </main>

      {/* Leave Modal */}
      {user?.role === 'admin' && (
        <LeaveModal isOpen={showLeaveModal} onClose={() => setShowLeaveModal(false)} year={year} month={month} staff={staffList} onSuccess={fetchData} />
      )}
    </div>
  );
}
