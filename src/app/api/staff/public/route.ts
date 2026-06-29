import { NextResponse } from 'next/server';
import { loadStaff } from '@/lib/staff-db';

export async function GET() {
  try {
    const staff = await loadStaff();
    return NextResponse.json({ staff: staff.filter(s => s.active) });
  } catch (error) {
    console.error('Public staff GET error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
