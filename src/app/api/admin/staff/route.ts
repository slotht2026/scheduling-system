import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

async function getAuth(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

// GET: list all staff
export async function GET(request: NextRequest) {
  try {
    const user = await getAuth(request);
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
    if (user.role !== 'admin') return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });

    const staff = await query(
      `SELECT id, name, role, color, is_director, is_leader, sort_order, active
       FROM staff ORDER BY sort_order`
    );
    return NextResponse.json({ staff });
  } catch (error) {
    console.error('Staff GET error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// POST: create staff member
export async function POST(request: NextRequest) {
  try {
    const user = await getAuth(request);
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
    if (user.role !== 'admin') return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });

    const body = await request.json();
    const { id, name, role, color, is_director, is_leader, sort_order } = body;

    if (!id || !name) {
      return NextResponse.json({ error: 'ID和姓名必填' }, { status: 400 });
    }

    const existing = await queryOne('SELECT id FROM staff WHERE id = $1', [id]);
    if (existing) {
      return NextResponse.json({ error: '该ID已存在' }, { status: 409 });
    }

    await query(
      `INSERT INTO staff (id, name, role, color, is_director, is_leader, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, name, role || '技术员', color || '#6b7280', is_director || false, is_leader || false, sort_order || 0]
    );

    return NextResponse.json({ message: '添加成功' }, { status: 201 });
  } catch (error) {
    console.error('Staff POST error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// PUT: update staff member
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuth(request);
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
    if (user.role !== 'admin') return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });

    const body = await request.json();
    const { id, name, role, color, is_director, is_leader, sort_order, active } = body;

    if (!id) {
      return NextResponse.json({ error: '需要ID' }, { status: 400 });
    }

    const existing = await queryOne('SELECT id FROM staff WHERE id = $1', [id]);
    if (!existing) {
      return NextResponse.json({ error: '人员不存在' }, { status: 404 });
    }

    await query(
      `UPDATE staff SET name = $2, role = $3, color = $4, is_director = $5, is_leader = $6, sort_order = $7, active = $8
       WHERE id = $1`,
      [id, name, role, color, is_director, is_leader, sort_order, active]
    );

    return NextResponse.json({ message: '更新成功' });
  } catch (error) {
    console.error('Staff PUT error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// DELETE: delete staff member
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuth(request);
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
    if (user.role !== 'admin') return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: '需要ID' }, { status: 400 });
    }

    // Check if staff has schedules
    const schedules = await queryOne('SELECT COUNT(*) as count FROM schedules WHERE staff_id = $1', [id]);
    if (schedules && parseInt(schedules.count) > 0) {
      // Soft delete - just deactivate
      await query('UPDATE staff SET active = FALSE WHERE id = $1', [id]);
      return NextResponse.json({ message: '该人员有排班记录，已设为停用状态' });
    }

    await query('DELETE FROM staff WHERE id = $1', [id]);
    return NextResponse.json({ message: '删除成功' });
  } catch (error) {
    console.error('Staff DELETE error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
