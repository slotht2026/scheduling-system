'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Calendar from '@/components/Calendar';
import GenerateButton from '@/components/GenerateButton';
import LeaveModal from '@/components/LeaveModal';

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
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [leaves, setLeaves] = useState<LeaveEntry[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [scheduleRes, leaveRes] = await Promise.all([
        fetch(`/api/schedule?year=${year}&month=${month}`),
        fetch(`/api/leave?year=${year}&month=${month}`),
      ]);

      if (scheduleRes.status === 401 || leaveRes.status === 401) {
        router.push('/login');
        return;
      }

      const scheduleData = await scheduleRes.json();
      const leaveData = await leaveRes.json();

      setSchedules(scheduleData.schedules || []);
      setLeaves(leaveData.leaves || []);
    } catch {
      console.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [year, month, router]);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      router.push('/login');
      return;
    }
    setUser(JSON.parse(storedUser));
  }, [router]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

  const handlePrevMonth = () => {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
  };

  const handleDeleteLeave = async (date: string, staffId: string) => {
    if (!confirm('确定要删除这条请假记录吗？')) return;

    try {
      const res = await fetch('/api/leave', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, staff_id: staffId }),
      });

      if (res.ok) {
        fetchData();
      }
    } catch {
      console.error('Failed to delete leave');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={handlePrevMonth}
              className="p-2 rounded-lg hover:bg-gray-200 transition text-gray-800"
            >
              ←
            </button>
            <h2 className="text-2xl font-bold text-gray-800">
              {year}年{month}月
            </h2>
            <button
              onClick={handleNextMonth}
              className="p-2 rounded-lg hover:bg-gray-200 transition text-gray-800"
            >
              →
            </button>
          </div>

          <div className="flex items-center gap-3">
            {user.role === 'admin' && (
              <>
                <button
                  onClick={() => setShowLeaveModal(true)}
                  className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition"
                >
                  添加请假
                </button>
                <GenerateButton year={year} month={month} onGenerated={fetchData} />
              </>
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
            isAdmin={user.role === 'admin'}
            onDeleteLeave={handleDeleteLeave}
          />
        )}
      </main>

      {/* Leave Modal */}
      {user.role === 'admin' && (
        <LeaveModal
          isOpen={showLeaveModal}
          onClose={() => setShowLeaveModal(false)}
          year={year}
          month={month}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
}
