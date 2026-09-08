import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

// 数据库连接（通过环境变量注入，勿硬编码）
const sql = neon(process.env.DATABASE_URL || "");

// 导出 Drizzle ORM 实例
export const db = drizzle(sql);

// 未来可通过以下方式切换到 Hyperdrive 连接池（生产环境推荐）
// import { hyperdrive } from "./hyperdrive";
// export const db = drizzle(hyperdrive.pool);