import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

async function getAuth(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

// GET: fetch leaves for a month
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

    const leaves = await query(
      `SELECT id, date::text, staff_id, reason, created_at
       FROM leaves
       WHERE date >= $1 AND date <= $2
       ORDER BY date`,
      [startDate, endDateStr]
    );

    return NextResponse.json({ leaves });
  } catch (error) {
    console.error('Leave GET error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// POST: add leave (admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await getAuth(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    const { date, staff_id, reason } = await request.json();
    if (!date || !staff_id) {
      return NextResponse.json({ error: '需要date和staff_id参数' }, { status: 400 });
    }

    await query(
      `INSERT INTO leaves (date, staff_id, reason) VALUES ($1, $2, $3)
       ON CONFLICT (date, staff_id) DO UPDATE SET reason = $3`,
      [date, staff_id, reason || null]
    );

    return NextResponse.json({ message: '请假添加成功' });
  } catch (error) {
    console.error('Leave POST error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// DELETE: remove leave (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuth(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    const { date, staff_id } = await request.json();
    if (!date || !staff_id) {
      return NextResponse.json({ error: '需要date和staff_id参数' }, { status: 400 });
    }

    await query(
      `DELETE FROM leaves WHERE date = $1 AND staff_id = $2`,
      [date, staff_id]
    );

    return NextResponse.json({ message: '请假删除成功' });
  } catch (error) {
    console.error('Leave DELETE error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
