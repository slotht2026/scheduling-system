import { query } from './db';
import type { StaffMember } from './staff';
import { DEFAULT_RULES, FALLBACK_STAFF } from './staff';

// Load team members from users table
export async function loadStaff(): Promise<StaffMember[]> {
  try {
    const rows = await query(
      `SELECT staff_id as id, name, role, color, is_director, is_leader, sort_order, active
       FROM users WHERE staff_id IS NOT NULL AND active = TRUE ORDER BY sort_order`
    );
    if (rows.length === 0) return FALLBACK_STAFF;
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      role: r.role,
      color: r.color,
      isDirector: r.is_director,
      isLeader: r.is_leader,
      sortOrder: r.sort_order,
      active: r.active,
    }));
  } catch {
    return FALLBACK_STAFF;
  }
}

// Load rules from database
export async function loadRules(): Promise<Record<string, string>> {
  try {
    const rows = await query(`SELECT key, value FROM rules`);
    if (rows.length === 0) return DEFAULT_RULES;
    const rules: Record<string, string> = {};
    for (const r of rows) { rules[r.key] = r.value; }
    return rules;
  } catch {
    return DEFAULT_RULES;
  }
}
