const sql = require('postgres')(process.env.DATABASE_URL);

async function main() {
  const tables = await sql`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;
  console.log('Existing tables:', tables.map(t => t.table_name));
  await sql.end();
}

main().catch(console.error);
