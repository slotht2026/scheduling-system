import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const staff = await query(
      `SELECT staff_id as id, name, role, color, is_director as "isDirector", is_leader as "isLeader"
       FROM users WHERE staff_id IS NOT NULL AND active = TRUE ORDER BY sort_order`
    );
    return NextResponse.json({ staff });
  } catch (error) {
    console.error('Public staff GET error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
