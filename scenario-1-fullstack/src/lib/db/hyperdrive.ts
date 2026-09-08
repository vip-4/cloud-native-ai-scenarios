import { neon } from "@neondatabase/serverless";

// Hyperdrive 连接工厂（生产环境使用，替代直接连接）
// 用法: 配置 wrangler.toml 的 [hyperdrive] 绑定后，
// 通过 c.env.HYPERDRIVE.connectionString 获取连接串
export function createHyperdrivePool(connectionString: string) {
  const sql = neon(connectionString);
  return {
    query: sql,
    connectionString,
  };
}