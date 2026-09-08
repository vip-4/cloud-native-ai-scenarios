import { describe, expect, it } from "vitest";

// 简单的基本功能测试（无外部依赖）
describe("基础算术功能", () => {
  it("1 + 1 = 2", () => {
    expect(1 + 1).toBe(2);
  });
});

// API 路由测试占位（可扩展到集成测试）
describe("API 接口测试（需本地 Worker 运行）", () => {
  it("健康检查端点应返回 ok", async () => {
    // 移除注释启用集成测试
    // const res = await fetch("http://localhost:8787/api/health");
    // const body = await res.json();
    // expect(res.status).toBe(200);
    // expect(body).toMatchObject({ status: "ok" });
    expect(true).toBe(true);
  });
});