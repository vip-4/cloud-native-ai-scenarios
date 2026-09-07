const { createId } = require('@paralleldrive/cuid2');
const bcrypt = require('bcryptjs');
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL);

async function main() {
  const hashedPassword = await bcrypt.hash('password123', 10);
  const id = createId();

  const result = await sql`
    INSERT INTO users (id, email, name, password)
    VALUES (${id}, 'test@example.com', 'Test User', ${hashedPassword})
    ON CONFLICT (email) DO UPDATE SET name = 'Test User', password = ${hashedPassword}
    RETURNING id, email, name
  `;

  console.log('User created/updated:', result[0]);
  await sql.end();
}

main().catch(console.error);
