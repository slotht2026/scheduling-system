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
  noon: '午备班',
  evening: '晚班',
  night: '夜班',
};

const SHIFT_ORDER = ['day', 'noon', 'evening', 'night'];

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

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

function getRestInfo(dateStr: string): { isRest: boolean; label: string } {
  if (HOLIDAYS_2026[dateStr]) return { isRest: true, label: HOLIDAYS_2026[dateStr] };
  if (WORKDAYS_OVERRIDE[dateStr]) return { isRest: false, label: '补班' };
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  if (day === 0 || day === 6) return { isRest: true, label: '周末' };
  return { isRest: false, label: '' };
}

export default function Calendar({ year, month, schedules, leaves, isAdmin, onDeleteLeave }: CalendarProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

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

  const leaveMap = useMemo(() => {
    const map: Record<string, LeaveEntry[]> = {};
    for (const l of leaves) {
      const dateKey = l.date.split('T')[0];
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(l);
    }
    return map;
  }, [leaves]);

  const getStaffName = (id: string) => STAFF.find(s => s.id === id)?.name || id;
  const getStaffColor = (id: string) => STAFF.find(s => s.id === id)?.color || '#666';
  const getStaffRole = (id: string) => STAFF.find(s => s.id === id)?.role || '';

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  return (
    <>
      {/* Schedule Cards */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 bg-gray-100 border-b border-gray-200">
          {['日', '一', '二', '三', '四', '五', '六'].map((day, i) => (
            <div key={day} className={`py-3 text-center text-sm font-bold ${i === 0 || i === 6 ? 'text-red-600' : 'text-gray-700'}`}>
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="border-b border-r border-gray-100 min-h-[100px]" />;
            }

            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const { isRest, label: restLabel } = getRestInfo(dateStr);
            const isToday = dateStr === new Date().toISOString().split('T')[0];
            const daySchedule = scheduleMap[dateStr] || {};
            const dayLeaves = leaveMap[dateStr] || [];
            const hasSchedule = Object.keys(daySchedule).length > 0;

            return (
              <div
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className={`border-b border-r border-gray-100 min-h-[100px] p-1.5 cursor-pointer hover:bg-blue-50/50 transition ${
                  isRest ? 'bg-red-50/30' : ''
                } ${isToday ? 'ring-2 ring-blue-400 ring-inset' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-bold ${isRest ? 'text-red-600' : isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                    {day}
                  </span>
                  {restLabel && <span className="text-[9px] text-red-500 bg-red-50 px-1 rounded">{restLabel}</span>}
                </div>

                {hasSchedule ? (
                  <div className="space-y-0.5">
                    {SHIFT_ORDER.map(shift => {
                      const staffIds = daySchedule[shift];
                      if (!staffIds || staffIds.length === 0) return null;
                      const cls = shift === 'day' ? 'bg-green-100 text-green-800' :
                                  shift === 'noon' ? 'bg-orange-100 text-orange-800' :
                                  shift === 'evening' ? 'bg-blue-100 text-blue-800' :
                                  'bg-purple-100 text-purple-800';
                      return (
                        <div key={shift} className={`text-[10px] leading-tight px-1 py-0.5 rounded ${cls}`}>
                          <span className="font-medium">{SHIFT_LABELS[shift]}:</span>
                          {staffIds.map(id => (
                            <span key={id} className="ml-0.5">{getStaffName(id)}</span>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-[10px] text-gray-400 mt-4 text-center">暂无排班</div>
                )}

                {dayLeaves.length > 0 && (
                  <div className="mt-1">
                    {dayLeaves.map(l => (
                      <div key={l.id} className="text-[10px] text-orange-600">🚫 {getStaffName(l.staff_id)}</div>
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
              <div>
                <h3 className="text-lg font-bold text-gray-800">{selectedDate} 排班详情</h3>
                <span className="text-sm text-gray-500">{getRestInfo(selectedDate).isRest ? '休息日' : '工作日'} · 星期{WEEKDAYS[new Date(selectedDate + 'T00:00:00').getDay()]}</span>
              </div>
              <button onClick={() => setSelectedDate(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            {(() => {
              const daySchedule = scheduleMap[selectedDate] || {};
              const dayLeaves = leaveMap[selectedDate] || [];
              const { isRest } = getRestInfo(selectedDate);
              const shifts = isRest ? WEEKEND_SHIFTS : SHIFTS;

              return (
                <>
                  {SHIFT_ORDER.map(shift => {
                    const staffIds = daySchedule[shift] || [];
                    const shiftInfo = (shifts as Record<string, { time: string; hours: number }>)[shift];
                    if (!shiftInfo && staffIds.length === 0) return null;

                    const cls = shift === 'day' ? 'bg-green-50 border-green-200' :
                                shift === 'noon' ? 'bg-orange-50 border-orange-200' :
                                shift === 'evening' ? 'bg-blue-50 border-blue-200' :
                                'bg-purple-50 border-purple-200';

                    return (
                      <div key={shift} className={`mb-3 p-3 rounded-lg border ${cls}`}>
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold text-gray-700">{SHIFT_LABELS[shift]}</span>
                          {shiftInfo && <span className="text-xs text-gray-500">{shiftInfo.time} ({shiftInfo.hours}h)</span>}
                        </div>
                        {staffIds.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {staffIds.map(id => (
                              <span key={id} className="px-2 py-1 rounded-full text-sm text-white" style={{ backgroundColor: getStaffColor(id) }}>
                                {getStaffName(id)} <span className="text-white/70 text-xs">({getStaffRole(id)})</span>
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
                      <h4 className="font-bold text-gray-700 mb-2">🚫 请假人员</h4>
                      {dayLeaves.map(l => (
                        <div key={l.id} className="flex justify-between items-center p-2 bg-orange-50 rounded-lg mb-1">
                          <span className="text-sm">
                            <span className="font-medium">{getStaffName(l.staff_id)}</span>
                            {l.reason && <span className="text-gray-500 ml-2">- {l.reason}</span>}
                          </span>
                          {isAdmin && onDeleteLeave && (
                            <button onClick={() => onDeleteLeave(selectedDate, l.staff_id)} className="text-red-500 hover:text-red-700 text-sm">删除</button>
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
