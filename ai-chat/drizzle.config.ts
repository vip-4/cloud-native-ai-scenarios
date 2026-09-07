import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./src/db/migrations",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_rWOvA5QU9pFe@ep-square-boat-auqrsoiu-pooler.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
  },
});
