import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { loadStaff, loadRules, SHIFTS, WEEKEND_SHIFTS, type StaffMember } from '@/lib/staff';

async function getAuth(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

// GET: fetch schedule for a month
export async function GET(request: NextRequest) {
  try {
    const user = await getAuth(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0);
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    const schedules = await query(
      `SELECT id, date::text, shift, staff_id, created_at
       FROM schedules
       WHERE date >= $1 AND date <= $2
       ORDER BY date, shift`,
      [startDate, endDateStr]
    );

    const leaves = await query(
      `SELECT id, date::text, staff_id, reason, created_at
       FROM leaves
       WHERE date >= $1 AND date <= $2
       ORDER BY date`,
      [startDate, endDateStr]
    );

    return NextResponse.json({ schedules, leaves, year, month });
  } catch (error) {
    console.error('Schedule GET error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// POST: generate schedule for a month (admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await getAuth(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    const { year, month } = await request.json();
    if (!year || !month) {
      return NextResponse.json({ error: '需要year和month参数' }, { status: 400 });
    }

    // Load staff and rules from DB
    const STAFF = (await loadStaff()).filter(s => s.active);
    const rules = await loadRules();

    // 节假日/补班日（与原型一致）
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

    const daysInMonth = new Date(year, month, 0).getDate();
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    // Get leaves for this month
    const leaves = await query(
      `SELECT date::text, staff_id FROM leaves WHERE date >= $1 AND date <= $2`,
      [startDate, endDateStr]
    );
    const leaveSet = new Set(leaves.map(l => `${l.date}_${l.staff_id}`));

    // Delete existing schedule for this month
    await query(
      `DELETE FROM schedules WHERE date >= $1 AND date <= $2`,
      [startDate, endDateStr]
    );

    // Parse rules
    const MAX_MONTHLY_HOURS = parseInt(rules.max_monthly_hours || '210');
    const MIN_WEEKDAY_STAFF = parseInt(rules.weekday_day_min || '3');
    const MAX_CONSECUTIVE = parseInt(rules.max_consecutive_days || '5');
    const REST_AFTER_NIGHT = parseInt(rules.rest_after_night || '1');
    const REQUIRE_LEADER = rules.require_leader_dayshift !== 'false';

    // Custom shift hours from rules
    const customShifts = { ...SHIFTS };
    if (rules.weekday_day_hours) customShifts.day = { ...customShifts.day, hours: parseInt(rules.weekday_day_hours) };
    if (rules.weekday_noon_hours) customShifts.noon = { ...customShifts.noon, hours: parseInt(rules.weekday_noon_hours) };
    if (rules.weekday_evening_hours) customShifts.evening = { ...customShifts.evening, hours: parseInt(rules.weekday_evening_hours) };
    if (rules.weekday_night_hours) customShifts.night = { ...customShifts.night, hours: parseInt(rules.weekday_night_hours) };

    const customWeekendShifts = { ...WEEKEND_SHIFTS };
    if (rules.weekend_day_hours) customWeekendShifts.day = { ...customWeekendShifts.day, hours: parseInt(rules.weekend_day_hours) };
    if (rules.weekend_evening_hours) customWeekendShifts.evening = { ...customWeekendShifts.evening, hours: parseInt(rules.weekend_evening_hours) };
    if (rules.weekend_night_hours) customWeekendShifts.night = { ...customWeekendShifts.night, hours: parseInt(rules.weekend_night_hours) };

    // 每人工时统计
    const hoursMap: Record<string, number> = {};
    STAFF.forEach(s => { hoursMap[s.id] = 0; });

    // 每人连续工作天数
    const consecutiveMap: Record<string, number> = {};
    STAFF.forEach(s => { consecutiveMap[s.id] = 0; });

    // 每人上次夜班日期
    const lastNightMap: Record<string, number> = {};
    STAFF.forEach(s => { lastNightMap[s.id] = -99; });

    const scheduleEntries: { date: string; shift: string; staffId: string }[] = [];

    function canWork(id: string, day: number): boolean {
      if (day - lastNightMap[id] <= REST_AFTER_NIGHT) return false;
      if (consecutiveMap[id] >= MAX_CONSECUTIVE) return false;
      return true;
    }

    function isLeaderStaff(id: string): boolean {
      const s = STAFF.find(x => x.id === id);
      return !!(s?.isDirector || s?.isLeader);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isWeekend = isRestDay(dateStr);

      const available = STAFF.filter(s => !leaveSet.has(`${dateStr}_${s.id}`));
      const dayAssigned: string[] = [];

      if (isWeekend) {
        const shifts = ['day', 'evening', 'night'] as const;
        const hoursArr = [customWeekendShifts.day.hours, customWeekendShifts.evening.hours, customWeekendShifts.night.hours];

        const leaders = available.filter(s => isLeaderStaff(s.id) && canWork(s.id, day));
        const others = available.filter(s => !isLeaderStaff(s.id) && canWork(s.id, day));

        const sorted = [...leaders.sort((a, b) => hoursMap[a.id] - hoursMap[b.id]),
                        ...others.sort((a, b) => hoursMap[a.id] - hoursMap[b.id])];

        for (let i = 0; i < Math.min(3, sorted.length); i++) {
          const s = sorted[i];
          scheduleEntries.push({ date: dateStr, shift: shifts[i], staffId: s.id });
          hoursMap[s.id] += hoursArr[i];
          dayAssigned.push(s.id);
          if (shifts[i] === 'night') lastNightMap[s.id] = day;
        }
      } else {
        const leaders = available.filter(s => isLeaderStaff(s.id) && canWork(s.id, day));
        const others = available.filter(s => !isLeaderStaff(s.id) && canWork(s.id, day));

        // 白班
        const dayStaff: string[] = [];
        const sortedLeaders = leaders.sort((a, b) => hoursMap[a.id] - hoursMap[b.id]);

        if (REQUIRE_LEADER && sortedLeaders.length > 0) {
          dayStaff.push(sortedLeaders[0].id);
        }

        const sortedOthers = others.sort((a, b) => hoursMap[a.id] - hoursMap[b.id]);
        for (const s of sortedOthers) {
          if (dayStaff.length >= MIN_WEEKDAY_STAFF) break;
          if (!dayStaff.includes(s.id)) dayStaff.push(s.id);
        }
        for (const s of sortedLeaders) {
          if (dayStaff.length >= MIN_WEEKDAY_STAFF) break;
          if (!dayStaff.includes(s.id)) dayStaff.push(s.id);
        }

        for (const id of dayStaff) {
          scheduleEntries.push({ date: dateStr, shift: 'day', staffId: id });
          hoursMap[id] += customShifts.day.hours;
          dayAssigned.push(id);
        }

        // 午间备班
        if (dayStaff.length > 1) {
          const noonCandidate = dayStaff.sort((a, b) => hoursMap[a] - hoursMap[b])[0];
          scheduleEntries.push({ date: dateStr, shift: 'noon', staffId: noonCandidate });
        }

        // 晚班
        const remaining = available.filter(s => !dayAssigned.includes(s.id) && canWork(s.id, day))
          .sort((a, b) => hoursMap[a.id] - hoursMap[b.id]);

        if (remaining.length >= 1) {
          scheduleEntries.push({ date: dateStr, shift: 'evening', staffId: remaining[0].id });
          hoursMap[remaining[0].id] += customShifts.evening.hours;
          dayAssigned.push(remaining[0].id);
        }

        // 夜班
        if (remaining.length >= 2) {
          scheduleEntries.push({ date: dateStr, shift: 'night', staffId: remaining[1].id });
          hoursMap[remaining[1].id] += customShifts.night.hours;
          dayAssigned.push(remaining[1].id);
          lastNightMap[remaining[1].id] = day;
        }
      }

      // 更新连续工作天数
      STAFF.forEach(s => {
        if (dayAssigned.includes(s.id)) {
          consecutiveMap[s.id]++;
        } else {
          consecutiveMap[s.id] = 0;
        }
      });
    }

    // 批量插入排班
    for (const entry of scheduleEntries) {
      await query(
        `INSERT INTO schedules (date, shift, staff_id) VALUES ($1, $2, $3)
         ON CONFLICT (date, shift, staff_id) DO NOTHING`,
        [entry.date, entry.shift, entry.staffId]
      );
    }

    const summary = STAFF.map(s => ({ name: s.name, hours: hoursMap[s.id] }));

    return NextResponse.json({
      message: '排班生成成功',
      hoursSummary: summary,
      totalEntries: scheduleEntries.length,
    });
  } catch (error) {
    console.error('Schedule POST error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
