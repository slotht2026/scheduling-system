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
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    const users = await query(
      `SELECT id, username, name, role, staff_id, created_at FROM users ORDER BY id`
    );

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Users GET error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// PUT: change password (admin only)
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuth(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    const { userId, newPassword } = await request.json();
    if (!userId || !newPassword) {
      return NextResponse.json({ error: '需要userId和newPassword参数' }, { status: 400 });
    }

    const targetUser = await queryOne('SELECT id FROM users WHERE id = $1', [userId]);
    if (!targetUser) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    const passwordHash = await hashPassword(newPassword);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);

    return NextResponse.json({ message: '密码修改成功' });
  } catch (error) {
    console.error('Users PUT error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
