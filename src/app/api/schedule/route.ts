import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { buildShiftConfig, shouldSkipNight } from '@/lib/staff';
import { loadStaff, loadRules } from '@/lib/staff-db';

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

    const shiftConfig = buildShiftConfig(await loadRules());
    return NextResponse.json({ schedules, leaves, year, month, shiftConfig });
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

    const { year, month, staffIds, requireLeader: requireLeaderParam, restAfterNight: restAfterNightParam, maxConsecutive: maxConsecutiveParam, minDayStaff: minDayStaffParam } = await request.json();
    if (!year || !month) {
      return NextResponse.json({ error: '需要year和month参数' }, { status: 400 });
    }

    // Load staff and rules from DB
    let allStaff = (await loadStaff()).filter(s => s.active);
    // If staffIds provided, filter to only selected staff
    if (staffIds && Array.isArray(staffIds) && staffIds.length > 0) {
      allStaff = allStaff.filter(s => staffIds.includes(s.id));
    }
    const STAFF = allStaff;

    // 即使主管未参与排班，也要加载出来作为夜班补位流动岗
    let directorFloater: typeof STAFF[number] | null = null;
    if (!STAFF.some(s => s.isDirector)) {
      const allStaffFull = (await loadStaff()).filter(s => s.active);
      directorFloater = allStaffFull.find(s => s.isDirector) || null;
    }

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
    const MIN_WEEKDAY_STAFF = minDayStaffParam !== undefined ? minDayStaffParam : parseInt(rules.weekday_day_min || '3');
    const REQUIRE_LEADER = requireLeaderParam !== undefined ? !!requireLeaderParam : rules.require_leader_dayshift !== 'false';
    const REST_AFTER_NIGHT = restAfterNightParam !== undefined ? (restAfterNightParam ? parseInt(rules.rest_after_night || '1') : 0) : parseInt(rules.rest_after_night || '1');
    const MAX_CONSECUTIVE = maxConsecutiveParam !== undefined ? (maxConsecutiveParam ? parseInt(rules.max_consecutive_days || '5') : 999) : parseInt(rules.max_consecutive_days || '5');

    // 生效班次配置（含自动跨天合并逻辑）
    const { SHIFTS: customShifts, WEEKEND_SHIFTS: customWeekendShifts, mergeEveningNight: MERGE_EVENING_NIGHT } = buildShiftConfig(rules);
    // 按工作日/周末分别判断晚班是否跨天（自动合并夜班）
    const WD_MERGE = shouldSkipNight(customShifts.evening);
    const WE_MERGE = shouldSkipNight(customWeekendShifts.evening);

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
        // 仅启用 hours>0 的班次：day 始终加入；evening/night 仅在启用时加入
        // 跨天合并(WE_MERGE)模式下 evening 即视为夜班(不再独立排 night)
        const enabledShifts: Array<[string, number]> = [];
        if (customWeekendShifts.day.hours > 0) enabledShifts.push(['day', customWeekendShifts.day.hours]);
        if (customWeekendShifts.evening.hours > 0) enabledShifts.push(['evening', customWeekendShifts.evening.hours]);
        if (!WE_MERGE && customWeekendShifts.night.hours > 0) enabledShifts.push(['night', customWeekendShifts.night.hours]);

        const shifts = enabledShifts.map(([s]) => s);
        const hoursArr = enabledShifts.map(([_, h]) => h);
        const limit = enabledShifts.length;

        const leaders = available.filter(s => isLeaderStaff(s.id) && canWork(s.id, day));
        const others = available.filter(s => !isLeaderStaff(s.id) && canWork(s.id, day));

        const sorted = [...leaders.sort((a, b) => hoursMap[a.id] - hoursMap[b.id]),
                        ...others.sort((a, b) => hoursMap[a.id] - hoursMap[b.id])];

        for (let i = 0; i < Math.min(limit, sorted.length); i++) {
          const s = sorted[i];
          scheduleEntries.push({ date: dateStr, shift: shifts[i], staffId: s.id });
          hoursMap[s.id] += hoursArr[i];
          dayAssigned.push(s.id);
          // 合并（跨天）模式下 evening 即覆盖通宵，按夜班处理休息
          if (shifts[i] === 'night' || (WE_MERGE && shifts[i] === 'evening')) lastNightMap[s.id] = day;
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

        // 白加午（从白班3人中选1人全天在岗）
        if (dayStaff.length > 1) {
          const noonCandidate = dayStaff.sort((a, b) => hoursMap[a] - hoursMap[b])[0];
          scheduleEntries.push({ date: dateStr, shift: 'noon', staffId: noonCandidate });
          // 白加午按 noon 工时(10h)计算，而非普通白班工时(7h)
          hoursMap[noonCandidate] -= customShifts.day.hours;
          hoursMap[noonCandidate] += customShifts.noon.hours;
        }

        // 晚班（仅当 evening 工时>0 时）
        if (customShifts.evening.hours > 0) {
          const eveningPool = available.filter(s => !dayAssigned.includes(s.id) && canWork(s.id, day))
            .sort((a, b) => hoursMap[a.id] - hoursMap[b.id]);
          if (eveningPool.length >= 1) {
            const s = eveningPool[0];
            scheduleEntries.push({ date: dateStr, shift: 'evening', staffId: s.id });
            hoursMap[s.id] += customShifts.evening.hours;
            dayAssigned.push(s.id);
            // 跨天合并模式下晚班即覆盖通宵，按夜班处理休息
            if (WD_MERGE) lastNightMap[s.id] = day;
          }
        }

        // 夜班（仅在不跨天合并、且 night 工时>0 时）
        if (!WD_MERGE && customShifts.night.hours > 0) {
          const nightPool = available.filter(s => !dayAssigned.includes(s.id) && canWork(s.id, day))
            .sort((a, b) => hoursMap[a.id] - hoursMap[b.id]);
          if (nightPool.length >= 1) {
            const s = nightPool[0];
            scheduleEntries.push({ date: dateStr, shift: 'night', staffId: s.id });
            hoursMap[s.id] += customShifts.night.hours;
            dayAssigned.push(s.id);
            lastNightMap[s.id] = day;
          }
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

    // 补位：夜班未安排的用主管作为流动岗填上（跨天合并模式下晚班已覆盖通宵，无需补夜班）
    // 仅当 night 工时>0 时才补（避免 night 被关掉时误补）
    const director = STAFF.find(s => s.isDirector) || directorFloater;
    if (director) {
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayMerge = isRestDay(dateStr) ? WE_MERGE : WD_MERGE;
        if (dayMerge) continue; // 合并模式下晚班已覆盖通宵
        const isWeekendNow = isRestDay(dateStr);
        const nightShiftHours = isWeekendNow ? customWeekendShifts.night.hours : customShifts.night.hours;
        if (nightShiftHours <= 0) continue; // night 被关闭时无需补位
        const hasNight = scheduleEntries.some(e => e.date === dateStr && e.shift === 'night');
        if (!hasNight) {
          scheduleEntries.push({ date: dateStr, shift: 'night', staffId: director.id });
          hoursMap[director.id] = (hoursMap[director.id] || 0) + nightShiftHours;
          lastNightMap[director.id] = day;
        }
      }
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
    if (directorFloater && hoursMap[directorFloater.id]) {
      summary.push({ name: directorFloater.name, hours: hoursMap[directorFloater.id] });
    }

    return NextResponse.json({
      message: '排班生成成功',
      hoursSummary: summary,
      totalEntries: scheduleEntries.length,
      shiftConfig: { SHIFTS: customShifts, WEEKEND_SHIFTS: customWeekendShifts, mergeEveningNight: MERGE_EVENING_NIGHT },
    });
  } catch (error) {
    console.error('Schedule POST error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
