'use client';

import { useMemo, useState } from 'react';
import { STAFF, SHIFTS, WEEKEND_SHIFTS } from '@/lib/staff';

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

interface CalendarProps {
  year: number;
  month: number;
  schedules: ScheduleEntry[];
  leaves: LeaveEntry[];
  isAdmin: boolean;
  onDeleteLeave?: (date: string, staffId: string) => void;
}

const SHIFT_LABELS: Record<string, string> = {
  day: '白班',
  noon: '午间备班',
  evening: '晚班',
  night: '夜班',
};

const SHIFT_ORDER = ['day', 'noon', 'evening', 'night'];

export default function Calendar({ year, month, schedules, leaves, isAdmin, onDeleteLeave }: CalendarProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0=Sunday

  // Group schedules by date
  const scheduleMap = useMemo(() => {
    const map: Record<string, Record<string, string[]>> = {};
    for (const s of schedules) {
      const dateKey = s.date.split('T')[0];
      if (!map[dateKey]) map[dateKey] = {};
      if (!map[dateKey][s.shift]) map[dateKey][s.shift] = [];
      map[dateKey][s.shift].push(s.staff_id);
    }
    return map;
  }, [schedules]);

  // Group leaves by date
  const leaveMap = useMemo(() => {
    const map: Record<string, LeaveEntry[]> = {};
    for (const l of leaves) {
      const dateKey = l.date.split('T')[0];
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(l);
    }
    return map;
  }, [leaves]);

  const getStaffName = (id: string) => {
    return STAFF.find(s => s.id === id)?.name || id;
  };

  const getStaffColor = (id: string) => {
    return STAFF.find(s => s.id === id)?.color || '#666';
  };

  const days = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    days.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d);
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
          {['日', '一', '二', '三', '四', '五', '六'].map((day, i) => (
            <div
              key={day}
              className={`py-3 text-center text-sm font-medium ${
                i === 0 || i === 6 ? 'text-red-600' : 'text-gray-700'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="border-b border-r border-gray-100 min-h-[120px]" />;
            }

            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayOfWeek = new Date(year, month - 1, day).getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const isToday = dateStr === new Date().toISOString().split('T')[0];
            const daySchedule = scheduleMap[dateStr] || {};
            const dayLeaves = leaveMap[dateStr] || [];
            const hasSchedule = Object.keys(daySchedule).length > 0;

            return (
              <div
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className={`border-b border-r border-gray-100 min-h-[120px] p-1.5 cursor-pointer hover:bg-blue-50/50 transition ${
                  isWeekend ? 'bg-red-50/30' : ''
                } ${isToday ? 'ring-2 ring-blue-400 ring-inset' : ''}`}
              >
                <div className={`text-sm font-medium mb-1 ${
                  isWeekend ? 'text-red-600' : isToday ? 'text-blue-600' : 'text-gray-700'
                }`}>
                  {day}
                </div>

                {hasSchedule ? (
                  <div className="space-y-0.5">
                    {SHIFT_ORDER.map(shift => {
                      const staffIds = daySchedule[shift];
                      if (!staffIds || staffIds.length === 0) return null;
                      return (
                        <div key={shift} className="text-[10px] leading-tight">
                          <span className="text-gray-500">{SHIFT_LABELS[shift]}:</span>
                          {staffIds.map(id => (
                            <span
                              key={id}
                              className="inline-block ml-1 px-1 rounded"
                              style={{ backgroundColor: getStaffColor(id) + '20', color: getStaffColor(id) }}
                            >
                              {getStaffName(id)}
                            </span>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-[10px] text-gray-400 mt-2">暂无排班</div>
                )}

                {dayLeaves.length > 0 && (
                  <div className="mt-1">
                    {dayLeaves.map(l => (
                      <div key={l.id} className="text-[10px] text-orange-600">
                        🏥 {getStaffName(l.staff_id)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail modal */}
      {selectedDate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40" onClick={() => setSelectedDate(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">
                {selectedDate} 排班详情
              </h3>
              <button onClick={() => setSelectedDate(null)} className="text-gray-400 hover:text-gray-600 text-xl">
                ✕
              </button>
            </div>

            {(() => {
              const daySchedule = scheduleMap[selectedDate] || {};
              const dayLeaves = leaveMap[selectedDate] || [];
              const dayOfWeek = new Date(selectedDate + 'T00:00:00').getDay();
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
              const shifts = isWeekend ? WEEKEND_SHIFTS : SHIFTS;

              return (
                <>
                  <div className="mb-3 text-sm text-gray-500">
                    {isWeekend ? '周末班次' : '工作日班次'}
                  </div>

                  {SHIFT_ORDER.map(shift => {
                    const staffIds = daySchedule[shift] || [];
                    const shiftInfo = (shifts as Record<string, { time: string; hours: number }>)[shift];
                    if (!shiftInfo && staffIds.length === 0) return null;

                    return (
                      <div key={shift} className="mb-3 p-3 bg-gray-50 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium text-gray-700">
                            {SHIFT_LABELS[shift]}
                          </span>
                          {shiftInfo && (
                            <span className="text-xs text-gray-500">
                              {shiftInfo.time} ({shiftInfo.hours}h)
                            </span>
                          )}
                        </div>
                        {staffIds.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {staffIds.map(id => (
                              <span
                                key={id}
                                className="px-2 py-1 rounded-full text-sm text-white"
                                style={{ backgroundColor: getStaffColor(id) }}
                              >
                                {getStaffName(id)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">未安排</span>
                        )}
                      </div>
                    );
                  })}

                  {dayLeaves.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium text-gray-700 mb-2">请假人员</h4>
                      {dayLeaves.map(l => (
                        <div key={l.id} className="flex justify-between items-center p-2 bg-orange-50 rounded-lg mb-1">
                          <span className="text-sm">
                            <span className="font-medium">{getStaffName(l.staff_id)}</span>
                            {l.reason && <span className="text-gray-500 ml-2">- {l.reason}</span>}
                          </span>
                          {isAdmin && onDeleteLeave && (
                            <button
                              onClick={() => onDeleteLeave(selectedDate, l.staff_id)}
                              className="text-red-500 hover:text-red-700 text-sm"
                            >
                              删除
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </>
  );
}
