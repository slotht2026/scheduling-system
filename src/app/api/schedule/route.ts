import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { STAFF, SHIFTS, WEEKEND_SHIFTS } from '@/lib/staff';

// Helper: get auth from cookie
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

    const daysInMonth = new Date(year, month, 0).getDate();

    // Get leaves for this month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

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

    // 排班算法参数
    const MAX_MONTHLY_HOURS = 210;
    const MIN_WEEKDAY_STAFF = 3;

    // 删除本月旧排班
    await query(
      `DELETE FROM schedules WHERE date >= $1 AND date <= $2`,
      [startDate, endDateStr]
    );

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
      // 夜班后休息1天
      if (day - lastNightMap[id] <= 1) return false;
      // 连续工作不超过5天
      if (consecutiveMap[id] >= 5) return false;
      // 工时不超限
      return true;
    }

    function isLeaderStaff(id: string): boolean {
      const s = STAFF.find(x => x.id === id);
      return !!(s?.isDirector || s?.isLeader);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOfWeek = new Date(year, month - 1, day).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      // 可用人员（排除请假的）
      const available = STAFF.filter(s => !leaveSet.has(`${dateStr}_${s.id}`));
      const dayAssigned: string[] = []; // 当天已排班的人

      if (isWeekend) {
        // 周末/假日：三班倒，每班1人
        const shifts = ['day', 'evening', 'night'] as const;
        const hoursArr = [WEEKEND_SHIFTS.day.hours, WEEKEND_SHIFTS.evening.hours, WEEKEND_SHIFTS.night.hours];

        // 按工时排序，最空闲的排白班（优先leader）
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
        // 工作日
        const leaders = available.filter(s => isLeaderStaff(s.id) && canWork(s.id, day));
        const others = available.filter(s => !isLeaderStaff(s.id) && canWork(s.id, day));

        // 白班：1个leader（错开） + 其他人按工时排序
        const dayStaff: string[] = [];
        const sortedLeaders = leaders.sort((a, b) => hoursMap[a.id] - hoursMap[b.id]);
        if (sortedLeaders.length > 0) {
          dayStaff.push(sortedLeaders[0].id);
        }
        const sortedOthers = others.sort((a, b) => hoursMap[a.id] - hoursMap[b.id]);
        for (const s of sortedOthers) {
          if (dayStaff.length >= MIN_WEEKDAY_STAFF) break;
          if (!dayStaff.includes(s.id)) dayStaff.push(s.id);
        }
        // 不够3人则从leader补充
        for (const s of sortedLeaders) {
          if (dayStaff.length >= MIN_WEEKDAY_STAFF) break;
          if (!dayStaff.includes(s.id)) dayStaff.push(s.id);
        }

        for (const id of dayStaff) {
          scheduleEntries.push({ date: dateStr, shift: 'day', staffId: id });
          hoursMap[id] += SHIFTS.day.hours;
          dayAssigned.push(id);
        }

        // 午间备班：从白班人员中选1人（工时最少的），不另计工时
        if (dayStaff.length > 1) {
          const noonCandidate = dayStaff.sort((a, b) => hoursMap[a] - hoursMap[b])[0];
          scheduleEntries.push({ date: dateStr, shift: 'noon', staffId: noonCandidate });
        }

        // 晚班：从剩余人员中选工时最少的
        const remaining = available.filter(s => !dayAssigned.includes(s.id) && canWork(s.id, day))
          .sort((a, b) => hoursMap[a.id] - hoursMap[b.id]);

        if (remaining.length >= 1) {
          scheduleEntries.push({ date: dateStr, shift: 'evening', staffId: remaining[0].id });
          hoursMap[remaining[0].id] += SHIFTS.evening.hours;
          dayAssigned.push(remaining[0].id);
        }

        // 夜班：从剩余人员中选工时最少的
        if (remaining.length >= 2) {
          scheduleEntries.push({ date: dateStr, shift: 'night', staffId: remaining[1].id });
          hoursMap[remaining[1].id] += SHIFTS.night.hours;
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
