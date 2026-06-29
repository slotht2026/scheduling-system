import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.POSTGRES_HOST || '47.100.189.133',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'StrongPass123!',
  database: process.env.POSTGRES_DATABASE || 'scheduling-system',
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Connected to database. Running migrations...');

    // Create staff table
    await client.query(`
      CREATE TABLE IF NOT EXISTS staff (
        id VARCHAR(10) PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT '技术员',
        color VARCHAR(20) NOT NULL DEFAULT '#6b7280',
        is_director BOOLEAN NOT NULL DEFAULT FALSE,
        is_leader BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order INT NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✓ staff table created');

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

    // Seed staff from existing hardcoded data
    const staffData = [
      { id: 'dgm', name: '邓高明', role: '技术主管', color: '#1a73e8', is_director: true, is_leader: false, sort_order: 1 },
      { id: 'cht', name: '陈能隆', role: '技术组长', color: '#e91e63', is_director: false, is_leader: true, sort_order: 2 },
      { id: 'pht', name: '庞涵天', role: '技术员', color: '#4caf50', is_director: false, is_leader: false, sort_order: 3 },
      { id: 'zyf', name: '张永芳', role: '技术员', color: '#ff9800', is_director: false, is_leader: false, sort_order: 4 },
      { id: 'nbs', name: '农帮善', role: '技术员', color: '#9c27b0', is_director: false, is_leader: false, sort_order: 5 },
      { id: 'wgn', name: '王国楠', role: '技术员', color: '#00bcd4', is_director: false, is_leader: false, sort_order: 6 },
      { id: 'nyj', name: '乃业隽', role: '技术员', color: '#795548', is_director: false, is_leader: false, sort_order: 7 },
    ];

    for (const s of staffData) {
      await client.query(
        `INSERT INTO staff (id, name, role, color, is_director, is_leader, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING;`,
        [s.id, s.name, s.role, s.color, s.is_director, s.is_leader, s.sort_order]
      );
      console.log(`✓ Staff ${s.name} inserted or already exists`);
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
    console.log('✓ Default rules seeded');

    console.log('\n✅ Migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
