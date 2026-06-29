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
    console.log('Running migration: merge staff into users...');

    // Add new columns to users table
    const cols = [
      { name: 'color', type: "VARCHAR(20) NOT NULL DEFAULT '#6b7280'" },
      { name: 'is_director', type: 'BOOLEAN NOT NULL DEFAULT FALSE' },
      { name: 'is_leader', type: 'BOOLEAN NOT NULL DEFAULT FALSE' },
      { name: 'sort_order', type: 'INT NOT NULL DEFAULT 0' },
      { name: 'active', type: 'BOOLEAN NOT NULL DEFAULT TRUE' },
    ];

    for (const col of cols) {
      await client.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='${col.name}') THEN
            ALTER TABLE users ADD COLUMN ${col.name} ${col.type};
          END IF;
        END $$;
      `);
      console.log(`✓ Column users.${col.name} ensured`);
    }

    // Copy data from staff table if it exists
    const staffExists = await client.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'staff')`
    );

    if (staffExists.rows[0].exists) {
      // Update users with staff data
      await client.query(`
        UPDATE users SET
          color = s.color,
          is_director = s.is_director,
          is_leader = s.is_leader,
          sort_order = s.sort_order,
          active = s.active
        FROM staff s
        WHERE users.staff_id = s.id;
      `);
      console.log('✓ Copied staff data to users');

      // Drop staff table
      await client.query(`DROP TABLE IF EXISTS staff;`);
      console.log('✓ Dropped staff table');
    }

    // Ensure rules table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS rules (
        id SERIAL PRIMARY KEY,
        key VARCHAR(50) UNIQUE NOT NULL,
        value TEXT NOT NULL,
        label VARCHAR(100),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✓ rules table ensured');

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
