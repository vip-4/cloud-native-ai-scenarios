import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

// 可懒初始化的数据库实例（由中间件在首次请求时初始化）
let _db: ReturnType<typeof drizzle> | null = null;

export function getDb(databaseUrl: string) {
  if (!_db) {
    const sql = neon(databaseUrl);
    _db = drizzle(sql);
  }
  return _db;
}