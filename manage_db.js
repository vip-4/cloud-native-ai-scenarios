const { Client } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_rWOvA5QU9pFe@ep-square-boat-auqrsoiu-pooler.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function manageDatabase() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('已连接到数据库\n');

    const dbResult = await client.query('SELECT current_database() AS db');
    console.log(`当前数据库: ${dbResult.rows[0].db}\n`);

    const tablesResult = await client.query(`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    if (tablesResult.rows.length === 0) {
      console.log('当前数据库中没有表。');
    } else {
      console.log(`数据库中的表 (${tablesResult.rows.length} 个):`);
      console.log('─'.repeat(60));

      for (const table of tablesResult.rows) {
        const columnsResult = await client.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position;
        `, [table.table_name]);

        console.log(`\n表名: ${table.table_name} (${table.table_type})`);
        console.log('列信息:');
        for (const col of columnsResult.rows) {
          console.log(`  - ${col.column_name} [${col.data_type}] ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
        }
      }
    }
  } catch (err) {
    console.error('数据库操作失败:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

manageDatabase();
