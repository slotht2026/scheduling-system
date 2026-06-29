import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { verifyToken, hashPassword } from '@/lib/auth';

async function getAuth(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

// GET: list all users (admin only)
export async function GET(request: NextRequest) {
  try {
    const user = await getAuth(request);
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
    if (user.role !== 'admin') return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });

    const users = await query(
      `SELECT id, username, name, role, staff_id, color, is_director, is_leader, sort_order, active, created_at
       FROM users ORDER BY sort_order, id`
    );
    return NextResponse.json({ users });
  } catch (error) {
    console.error('Users GET error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// POST: create user (admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await getAuth(request);
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
    if (user.role !== 'admin') return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });

    const body = await request.json();
    const { username, password, name, role, staff_id, color, is_director, is_leader, sort_order } = body;

    if (!username || !password || !name) {
      return NextResponse.json({ error: '用户名、密码、姓名必填' }, { status: 400 });
    }

    const existing = await queryOne('SELECT id FROM users WHERE username = $1', [username]);
    if (existing) return NextResponse.json({ error: '用户名已存在' }, { status: 409 });

    if (staff_id) {
      const sidExists = await queryOne('SELECT id FROM users WHERE staff_id = $1', [staff_id]);
      if (sidExists) return NextResponse.json({ error: 'staff_id已存在' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const result = await query(
      `INSERT INTO users (username, password_hash, name, role, staff_id, color, is_director, is_leader, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [username, passwordHash, name, role || 'viewer', staff_id || null, color || '#6b7280', is_director || false, is_leader || false, sort_order || 0]
    );

    return NextResponse.json({ message: '创建成功', id: result[0].id }, { status: 201 });
  } catch (error) {
    console.error('Users POST error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// PUT: update user (admin only)
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuth(request);
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
    if (user.role !== 'admin') return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });

    const body = await request.json();
    const { id, name, role, staff_id, color, is_director, is_leader, sort_order, active, newPassword } = body;

    if (!id) return NextResponse.json({ error: '需要用户ID' }, { status: 400 });

    const target = await queryOne('SELECT id FROM users WHERE id = $1', [id]);
    if (!target) return NextResponse.json({ error: '用户不存在' }, { status: 404 });

    // Update password if provided
    if (newPassword) {
      const passwordHash = await hashPassword(newPassword);
      await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, id]);
    }

    // Update profile fields
    await query(
      `UPDATE users SET name = $2, role = $3, staff_id = $4, color = $5, is_director = $6, is_leader = $7, sort_order = $8, active = $9
       WHERE id = $1`,
      [id, name, role, staff_id, color, is_director, is_leader, sort_order, active]
    );

    return NextResponse.json({ message: '更新成功' });
  } catch (error) {
    console.error('Users PUT error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// DELETE: delete user (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuth(request);
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
    if (user.role !== 'admin') return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: '需要用户ID' }, { status: 400 });

    // Prevent deleting self
    if (parseInt(id) === user.userId) {
      return NextResponse.json({ error: '不能删除自己' }, { status: 400 });
    }

    // Check if user has schedules
    const targetUser = await queryOne('SELECT staff_id FROM users WHERE id = $1', [id]);
    if (!targetUser) return NextResponse.json({ error: '用户不存在' }, { status: 404 });

    if (targetUser.staff_id) {
      const schedules = await queryOne('SELECT COUNT(*) as count FROM schedules WHERE staff_id = $1', [targetUser.staff_id]);
      if (schedules && parseInt(schedules.count) > 0) {
        // Soft delete
        await query('UPDATE users SET active = FALSE WHERE id = $1', [id]);
        return NextResponse.json({ message: '该用户有排班记录，已设为停用状态' });
      }
    }

    await query('DELETE FROM users WHERE id = $1', [id]);
    return NextResponse.json({ message: '删除成功' });
  } catch (error) {
    console.error('Users DELETE error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
