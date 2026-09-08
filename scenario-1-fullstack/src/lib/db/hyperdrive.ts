import { neon } from "@neondatabase/serverless";

// Hyperdrive 连接池工厂（生产环境使用，替代直接连接）
export function createHyperdrivePool(databaseUrl: string, connectionPoolSize = 20) {
  // 生产环境中使用 Cloudflare Hyperdrive 绑定
  // 请使用: c.env.HYPERDRIVE.connectionString
  const pool = neon(databaseUrl, {
    poolOptions: {
      max: connectionPoolSize,
    },
  });

  return {
    query: pool,
    connectionString: databaseUrl,
  };
}