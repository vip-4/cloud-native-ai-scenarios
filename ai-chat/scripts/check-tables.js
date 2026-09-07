const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const * as schema = require('../src/db/schema');

async function checkTables() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const client = postgres(connectionString);
  const db = drizzle(client, { schema });

  try {
    console.log('Checking database connection...');

    // Check users table
    const users = await db.select().from(schema.users).limit(1);
    console.log('✓ Users table accessible');

    // Check chats table
    const chats = await db.select().from(schema.chats).limit(1);
    console.log('✓ Chats table accessible');

    // Check messages table
    const messages = await db.select().from(schema.messages).limit(1);
    console.log('✓ Messages table accessible');

    console.log('\nAll tables are accessible!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkTables();
