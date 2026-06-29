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

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(50) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'viewer',
        staff_id VARCHAR(10),
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

    // Insert default users
    const passwordHash = await bcrypt.hash('123456', 10);

    const users = [
      { username: 'dgm', name: '邓高明', role: 'admin', staff_id: 'dgm' },
      { username: 'cnl', name: '陈能隆', role: 'viewer', staff_id: 'cht' },
      { username: 'pht', name: '庞涵天', role: 'viewer', staff_id: 'pht' },
      { username: 'zyf', name: '张永芳', role: 'viewer', staff_id: 'zyf' },
      { username: 'nbs', name: '农帮善', role: 'viewer', staff_id: 'nbs' },
      { username: 'wgn', name: '王国楠', role: 'viewer', staff_id: 'wgn' },
      { username: 'nyj', name: '乃业隽', role: 'viewer', staff_id: 'nyj' },
    ];

    for (const user of users) {
      await client.query(
        `INSERT INTO users (username, password_hash, name, role, staff_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (username) DO NOTHING;`,
        [user.username, passwordHash, user.name, user.role, user.staff_id]
      );
      console.log(`✓ User ${user.name} (${user.username}) inserted or already exists`);
    }

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
