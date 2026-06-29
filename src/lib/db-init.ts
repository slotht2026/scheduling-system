import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({
  host: process.env.POSTGRES_HOST || '47.100.189.133',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'StrongPass123!',
  database: process.env.POSTGRES_DATABASE || 'scheduling-system',
});

async function init() {
  const client = await pool.connect();
  try {
    console.log('Connected to database. Creating tables...');

    // Create users table (single source of truth for team members)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(50) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'viewer',
        staff_id VARCHAR(10) UNIQUE,
        color VARCHAR(20) NOT NULL DEFAULT '#6b7280',
        is_director BOOLEAN NOT NULL DEFAULT FALSE,
        is_leader BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order INT NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✓ users table created');

    // Create schedules table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schedules (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        shift VARCHAR(20) NOT NULL,
        staff_id VARCHAR(10) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(date, shift, staff_id)
      );
    `);
    console.log('✓ schedules table created');

    // Create leaves table
    await client.query(`
      CREATE TABLE IF NOT EXISTS leaves (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        staff_id VARCHAR(10) NOT NULL,
        reason VARCHAR(200),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(date, staff_id)
      );
    `);
    console.log('✓ leaves table created');

    // Create rules table
    await client.query(`
      CREATE TABLE IF NOT EXISTS rules (
        id SERIAL PRIMARY KEY,
        key VARCHAR(50) UNIQUE NOT NULL,
        value TEXT NOT NULL,
        label VARCHAR(100),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✓ rules table created');

    // Insert default users
    const passwordHash = await bcrypt.hash('123456', 10);

    const users = [
      { username: 'dgm', name: '邓高明', role: 'admin', staff_id: 'dgm', color: '#1a73e8', is_director: true, is_leader: false, sort_order: 1 },
      { username: 'cnl', name: '陈能隆', role: 'viewer', staff_id: 'cht', color: '#e91e63', is_director: false, is_leader: true, sort_order: 2 },
      { username: 'pht', name: '庞涵天', role: 'viewer', staff_id: 'pht', color: '#4caf50', is_director: false, is_leader: false, sort_order: 3 },
      { username: 'zyf', name: '张永芳', role: 'viewer', staff_id: 'zyf', color: '#ff9800', is_director: false, is_leader: false, sort_order: 4 },
      { username: 'nbs', name: '农帮善', role: 'viewer', staff_id: 'nbs', color: '#9c27b0', is_director: false, is_leader: false, sort_order: 5 },
      { username: 'wgn', name: '王国楠', role: 'viewer', staff_id: 'wgn', color: '#00bcd4', is_director: false, is_leader: false, sort_order: 6 },
      { username: 'nyj', name: '乃业隽', role: 'viewer', staff_id: 'nyj', color: '#795548', is_director: false, is_leader: false, sort_order: 7 },
    ];

    for (const user of users) {
      await client.query(
        `INSERT INTO users (username, password_hash, name, role, staff_id, color, is_director, is_leader, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (username) DO UPDATE SET
           color = EXCLUDED.color,
           is_director = EXCLUDED.is_director,
           is_leader = EXCLUDED.is_leader,
           sort_order = EXCLUDED.sort_order;`,
        [user.username, passwordHash, user.name, user.role, user.staff_id, user.color, user.is_director, user.is_leader, user.sort_order]
      );
      console.log(`✓ User ${user.name} (${user.username}) seeded`);
    }

    // Seed default rules
    const rulesData = [
      { key: 'weekday_day_min', value: '3', label: '工作日白班最少人数' },
      { key: 'weekday_day_hours', value: '7', label: '工作日白班工时' },
      { key: 'weekday_noon_hours', value: '7', label: '工作日午间备班工时' },
      { key: 'weekday_evening_hours', value: '7', label: '工作日晚班工时' },
      { key: 'weekday_night_hours', value: '7', label: '工作日夜班工时' },
      { key: 'weekend_day_hours', value: '8', label: '周末白班工时' },
      { key: 'weekend_evening_hours', value: '8', label: '周末晚班工时' },
      { key: 'weekend_night_hours', value: '8', label: '周末夜班工时' },
      { key: 'max_monthly_hours', value: '210', label: '月工时上限' },
      { key: 'max_consecutive_days', value: '5', label: '最大连续工作天数' },
      { key: 'rest_after_night', value: '1', label: '夜班后休息天数' },
      { key: 'require_leader_dayshift', value: 'true', label: '白班必须含Leader' },
    ];

    for (const r of rulesData) {
      await client.query(
        `INSERT INTO rules (key, value, label)
         VALUES ($1, $2, $3)
         ON CONFLICT (key) DO NOTHING;`,
        [r.key, r.value, r.label]
      );
    }
    console.log('✓ Rules seeded');

    // Drop staff table (merged into users)
    await client.query(`DROP TABLE IF EXISTS staff;`);
    console.log('✓ staff table dropped (merged into users)');

    console.log('\n✅ Database initialization complete!');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

init();
