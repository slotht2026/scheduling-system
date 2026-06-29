import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

async function getAuth(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

// GET: list all rules
export async function GET(request: NextRequest) {
  try {
    const user = await getAuth(request);
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
    if (user.role !== 'admin') return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });

    const rules = await query(`SELECT id, key, value, label FROM rules ORDER BY id`);
    return NextResponse.json({ rules });
  } catch (error) {
    console.error('Rules GET error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// PUT: update rules (batch)
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuth(request);
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
    if (user.role !== 'admin') return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });

    const { rules } = await request.json();
    if (!rules || !Array.isArray(rules)) {
      return NextResponse.json({ error: '需要rules数组' }, { status: 400 });
    }

    for (const rule of rules) {
      if (!rule.key || rule.value === undefined) continue;
      await query(
        `UPDATE rules SET value = $1, updated_at = NOW() WHERE key = $2`,
        [String(rule.value), rule.key]
      );
    }

    return NextResponse.json({ message: '规则更新成功' });
  } catch (error) {
    console.error('Rules PUT error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
