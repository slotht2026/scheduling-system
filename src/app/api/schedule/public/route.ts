import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
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
    console.error('Public schedule GET error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
