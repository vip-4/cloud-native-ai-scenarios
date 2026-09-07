# Hermes / OpenClaw / GitHub / Cloudflare / Neon / LiteLLM 实战场景方案

> **目标读者：** 国内开发者
> **要求：** 零基础友好 + 企业级生产可用 + 拒绝空泛理论 + 每个场景给具体仓库参考
> **统一前提：** 本地已启动 FreeLLMAPI 网关 `http://localhost:3001`，统一 API Key 为 `freellmapi-89a2cae15297e3084396ce15673295ecd58d48e583a8bee3`
> **硬件支撑：** NVIDIA RTX 5070 本地推理（Ollama `http://127.0.0.1:11434`）+ LM Studio（`http://127.0.0.1:1234`）

---

## 0. 全局技术栈总览与选型逻辑

| 能力域 | 推荐组件 | 选型理由 | 国内关注度 |
|--------|----------|----------|-----------|
| AI 模型调用 | LiteLLM / FreeLLMAPI / Hermes Agent / OpenClaw | 一次接入 100+ 模型，统一 OpenAI 格式，支持负载均衡、密钥加密、费用追踪；国内可直连 Groq / Google Gemini / Mistral / Cerebras / NVIDIA NIM 等免费层 | ⭐⭐⭐⭐⭐ |
| 边缘无服务器函数 | Cloudflare Workers / Pages | 边缘节点覆盖广、冷启动 <1ms、免费额度充足，适合全球加速与轻量 API | ⭐⭐⭐⭐⭐ |
| 托管数据库 | Neon PostgreSQL | Serverless Postgres，自动暂停/恢复，按计算/存储分离付费，适合 Next.js / Drizzle ORM | ⭐⭐⭐⭐ |
| 代码托管与 CI/CD | GitHub + GitHub Actions | 国内开发者最熟悉的协作平台，Actions 提供免费 CI/CD 分钟数 | ⭐⭐⭐⭐⭐ |
| 本地 AI 代理运行时 | Hermes Agent + OpenClaw | 本地优先的 agent gateway，支持 MCP / A2A / 多模态 / Gateway 持久化，可直接调用 LiteLLM 兼容端点 | ⭐⭐⭐⭐ |

### 0.1 本地硬件配置（已就绪）

| 组件 | 状态 | 地址/端口 | 说明 |
|------|------|----------|------|
| Ollama (RTX 5070) | ✅ | `http://127.0.0.1:11434` | 本地模型推理，支持 gemma4 等 |
| LM Studio | ✅ | `http://127.0.0.1:1234` | 本地模型服务 |
| FreeLLMAPI | ✅ | `http://localhost:3001` | 统一网关 |
| Hermes Agent Gateway | ✅ | `http://127.0.0.1:53303` | 本地 Agent 网关 |
| DeepSeek Harness | ✅ | `http://127.0.0.1:3080` | AI 编排界面 |
| OpenCode Desktop | ✅ | GUI | 已安装并可启动 |

### 0.2 核心环境变量（统一配置）

```bash
# FreeLLMAPI 本地网关（替代各厂商直连）
OPENAI_BASE_URL=http://localhost:3001/v1
OPENAI_API_KEY=freellmapi-89a2cae15297e3084396ce15673295ecd58d48e583a8bee3

# 本地 Ollama（RTX 5070 推理）
OLLAMA_BASE_URL=http://127.0.0.1:11434

# GitHub（用于 Actions / PR 自动化）
GITHUB_TOKEN=ghp_xxxxxxxxxxxx

# Neon PostgreSQL（已配置）
DATABASE_URL=postgresql://neondb_owner:npg_rWOvA5QU9pFe@ep-square-boat-auqrsoiu-pooler.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

# Cloudflare Wrangler（已登录）
CLOUDFLARE_API_TOKEN=xxxxxxxxxxxx
CLOUDFLARE_ACCOUNT_ID=8eb2b9535949b021a8898e81575fba9a
```

### 0.3 一键启动脚本

```powershell
# FreeLLMAPI 启动
cd "G:\其他计算机\我的计算机\001\freellmapi"
cmd /c "npx.cmd tsx watch server\src\index.ts"

# Hermes Agent 启动（后台运行）
cd "G:\其他计算机\我的计算机\001\hermes-agent"
set FREELLMAPI_API_KEY=freellmapi-89a2cae15297e3084396ce15673295ecd58d48e583a8bee3
"C:\Users\Administrator\AppData\Local\Programs\Python\Python311\python.exe" hermes gateway run --replace

# DeepSeek Harness 启动
set FREELLMAPI_API_KEY=freellmapi-89a2cae15297e3084396ce15673295ecd58d48e583a8bee3
npx @deepseek-ai/dsh web

# OpenCode Desktop 启动
set FREELLMAPI_API_KEY=freellmapi-89a2cae15297e3084396ce15673295ecd58d48e583a8bee3
start "" "C:\Users\Administrator\AppData\Local\Programs\@opencode-aidesktop\OpenCode.exe"
```

---

## 场景一：全栈 Web 应用（AI 聊天 + 数据库持久化）

### 1.1 适用业务方向
- 企业内部知识库问答  
- 客服智能回复系统  
- 多用户 AI 对话 SaaS（按用户隔离会话与计费）

### 1.2 技术栈选型
- 前端：Next.js 14 (App Router) + Tailwind CSS + shadcn/ui  
- 后端：Next.js API Routes / Server Actions  
- 数据库：Neon PostgreSQL + Drizzle ORM  
- AI 网关：LiteLLM Proxy 或本地 FreeLLMAPI  
- Agent 运行时：Hermes Agent / OpenClaw（本地开发调试用）  
- 部署：Cloudflare Pages（前端静态导出）+ Cloudflare Workers（API 代理）或 Vercel

### 1.3 核心功能实现步骤

```bash
# 1. 创建项目
pnpm create next-app@latest ai-chat --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd ai-chat

# 2. 安装依赖
pnpm add drizzle-orm postgres @ai-sdk/openai ai
pnpm add -D drizzle-kit @types/node

# 3. 初始化 Drizzle
npx drizzle-kit init
```

**关键代码：`src/db/schema.ts`**
```ts
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const chats = pgTable('chats', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const messages = pgTable('messages', {
  id: text('id').primaryKey(),
  chatId: text('chat_id').notNull().references(() => chats.id),
  role: text('role').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

**关键代码：`src/app/api/chat/route.ts`**
```ts
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

export const runtime = 'edge';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('kilo-auto', { baseURL: process.env.OPENAI_BASE_URL, apiKey: process.env.OPENAI_API_KEY }),
    messages,
  });

  return result.toDataStreamResponse();
}
```

### 1.4 生产部署配置要点
- **Next.js 配置**：`output: 'standalone'` 或 `output: 'export'`（静态导出走 Cloudflare Pages）
- **数据库迁移**：使用 `drizzle-kit push:pg` 或 `migrate` 自动同步 Neon schema
- **环境变量**：`OPENAI_BASE_URL` / `OPENAI_API_KEY` / `DATABASE_URL` 注入 Cloudflare Pages / Vercel / Docker 环境
- **CORS 与 鉴权**：API Routes 校验 `Authorization` / Session Cookie；禁止裸奔暴露到公网
- **计费隔离**：在 LiteLLM / FreeLLMAPI 层按 `user_id` 做虚拟 key / spend tracking

### 1.5 参考仓库

| 仓库 | 场景 | 链接 |
|------|------|------|
| LiteLLM Next.js 全栈示例 | 场景一 | https://github.com/BerriAI/litellm/tree/main/cookbook/community_examples/nextjs_ai_chatgpt_plugin |
| OpenClaw 官方前端接入 | 场景一 | https://github.com/openclaw/openclaw/tree/main/cookbook |
| Cloudflare Pages + Next.js + Neon | 场景一 | https://github.com/cloudflare/next-on-pages/tree/main/packages/next-on-pages |
| Vercel AI SDK 示例 | 场景一 | https://github.com/vercel/ai/tree/main/examples/next-openai |
| Drizzle ORM + Neon 示例 | 场景一 | https://github.com/drizzle-team/drizzle-orm/tree/main/examples/neon |
| FreeLLMAPI 官方仓库 | 全场景 | https://github.com/tashfeenahmed/freellmapi |
| Hermes Agent 官方仓库 | 全场景 | https://github.com/agent-studio/hermes-agent |

**Docker 部署一键启动：**
```bash
docker run -d -p 3001:3001 \
  -e ENCRYPTION_KEY=your-64-char-hex-key \
  ghcr.io/tashfeenahmed/freellmapi:latest
```

---

## 场景二：边缘计算服务（全球 AI API 网关）

### 2.1 适用业务方向
- 为国内/海外多租户提供统一 AI API 入口  
- 企业内部多模型路由与降级  
- 边缘侧智能摘要 / 翻译 / 内容审核

### 2.2 技术栈选型
- 边缘运行时：Cloudflare Workers + Hono /itty-router
- AI 网关：LiteLLM Proxy（部署在 Cloudflare Worker 上或独立容器）或 FreeLLMAPI
- 模型路由：LiteLLM Auto Router / 自定义加权轮询
- 密钥管理：Cloudflare Secrets / Vault
- 监控：Cloudflare Analytics + Prometheus + Grafana

### 2.3 核心功能实现步骤

**步骤 1：部署 LiteLLM Proxy 到 Cloudflare Worker（官方实验性支持）或 Railway / Render**

```bash
# 本地 Docker 运行 LiteLLM
docker run -p 4000:4000 \
  -e OPENAI_API_KEY=sk-... \
  -e GROQ_API_KEY=gsk_... \
  ghcr.io/berriai/litellm:latest \
  litellm --model gpt-4o --model groq/llama3-70b
```

**步骤 2：配置多模型自动路由（`proxy_server_config.yaml`）**

```yaml
model_list:
  - model_name: "gpt-4o"
    litellm_params:
      model: openai/gpt-4o
  - model_name: "groq-llama"
    litellm_params:
      model: groq/llama-3.3-70b-versatile
  - model_name: "gemini-free"
    litellm_params:
      model: gemini/gemini-2.0-flash-exp

router_settings:
  routing_strategy: "latency-based-routing"
  num_retries: 3
  timeout: 60
  fallbacks: [{"gpt-4o": ["groq-llama", "gemini-free"]}]
```

**步骤 3：Cloudflare Worker 边缘转发**

```ts
// src/index.ts
export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/v1/')) {
      return fetch('http://localhost:4000' + url.pathname, {
        headers: { 'Authorization': `Bearer ${env.LITELLM_API_KEY}` },
      });
    }
    return new Response('Not Found', { status: 404 });
  },
};
```

### 2.4 生产部署配置要点
- **多活与故障转移**：LiteLLM 配置 `fallbacks` + `retry`；Worker 层再套一层 DNS 级故障转移
- **密钥隔离**：生产 key 存入 Cloudflare Vault / GitHub Secrets，禁止硬编码
- **限流与熔断**：LiteLLM 支持 `max_budget` / `rate_limit`；边缘侧用 Cloudflare Rate Limit
- **日志审计**：LiteLLM 默认写入 SQLite/Postgres；生产建议外接 Prometheus + Grafana

### 2.5 参考仓库

| 仓库 | 说明 | 链接 |
|------|------|------|
| LiteLLM Docker Compose | 完整生产配置 | https://github.com/BerriAI/litellm/blob/main/docker-compose.yml |
| LiteLLM Helm Chart | Kubernetes 部署 | https://github.com/BerriAI/litellm/tree/main/helm |
| LiteLLM 模型路由配置 | 高级路由策略 | https://docs.litellm.ai/docs/proxy_router |
| Cloudflare Workers AI | 边缘 AI 推理 | https://github.com/cloudflare/ai-workers/tree/main/demos |
| Cloudflare Workers + Ollama | 本地模型边缘化 | https://github.com/cloudflare/cfssl-ollama |
| Wrangler 官方文档 | Workers 部署 | https://developers.cloudflare.com/workers/ |

**生产环境 LiteLLM 配置文件：**
```yaml
# proxy_server_config.yaml
model_list:
  - model_name: "kilo-auto"
    litellm_params:
      model: openai/kilo-auto
      api_base: http://localhost:3001/v1
      api_key: "freellmapi-89a2cae15297e3084396ce15673295ecd58d48e583a8bee3"

litellm_settings:
  drop_params: true
  set_verbose: true

general_settings:
  master_key: "your-master-key"
  database_url: "postgresql://user:pass@host/db"
  otlp_endpoint: "https://your-otlp-endpoint"

auth_settings:
  valid_proxy_keyes: ["user1-key", "user2-key"]
  max_parallel_requests: 100
  ui_access_mode: "admin"
```

### 2.6 当前部署状态

| 项目 | 状态 | 详情 |
|------|------|------|
| Cloudflare Worker | ✅ 已部署 | https://edge-ai-gateway.my-fullstack-app.workers.dev |
| LiteLLM Proxy | ✅ 本地运行 | http://localhost:4000 |
| Worker Secrets | ✅ 已配置 | LITELLM_API_KEY, LITELLM_API_BASE |
| GitHub Actions | ✅ 已配置 | .github/workflows/deploy.yml |
| Worker 代码 | ✅ 已完成 | src/index.ts |

**项目路径：** `G:\其他计算机\我的计算机\001\edge-gateway`

**核心功能：**
- 边缘 AI 网关，全球 300+ 节点
- IP 级别限流 (100 req/min)
- CORS 支持
- 健康检查 `/health`
- 模型列表代理 `/v1/models`
- 自动故障转移到备用模型

---

## 场景三：无服务器架构（Serverless AI 应用）

### 3.1 适用业务方向
- 事件驱动的 AI 自动化流水线（GitHub PR Review / Issue Triage）  
- 定时 AI 摘要 / 报表生成  
- Webhook 驱动的 AI 客服工单系统

### 3.2 技术栈选型
- 计算：Cloudflare Workers / Pages Functions / Vercel Functions
- 触发器：GitHub Webhooks / Cloudflare Queues / Cron Triggers
- 状态存储：Neon PostgreSQL / Cloudflare KV / D1
- AI 调用：LiteLLM / FreeLLMAPI（统一 OpenAI 格式）
- 本地 Agent：Hermes Agent / OpenClaw（复杂决策链在本地编排）

### 3.3 核心功能实现步骤

**步骤 1：GitHub PR Review Bot（Worker + GitHub App）**

```ts
// worker/index.ts
export default {
  async fetch(request: Request, env: Env) {
    const payload = await request.json();
    if (request.headers.get('x-github-event') === 'pull_request') {
      const diff = await getPRDiff(payload.pull_request.diff_url);
      const review = await callLLM(diff, env.LITELLM_KEY);
      await postPRComment(payload.pull_request.comments_url, review, env.GITHUB_TOKEN);
    }
    return new Response('OK');
  },
};

async function callLLM(diff: string, key: string) {
  const res = await fetch('http://localhost:3001/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'kilo-auto',
      messages: [{ role: 'user', content: `Review this PR diff:\n${diff}` }],
    }),
  });
  return res.json();
}
```

**步骤 2：Cron 定时任务（每日 AI 摘要）**

```bash
# 使用 Cloudflare Cron Triggers 或 GitHub Actions
name: Daily AI Summary
on:
  schedule:
    - cron: '0 18 * * *'  # 每天 18:00 UTC
jobs:
  summarize:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          curl -X POST https://your-worker.workers.dev/cron/summary \
            -H "Authorization: Bearer ${{ secrets.LITELLM_KEY }}"
```

### 3.4 生产部署配置要点
- **冷启动优化**：Worker 保持轻量，避免大依赖；复杂逻辑拆分为 Queue Consumer
- **幂等性**：Webhook 处理必须做去重（`X-GitHub-Delivery` / `idempotency-key`）
- **失败重试**：Cloudflare Queues 支持 DLQ；GitHub Actions 用 `if: always()` + 手动重跑
- **密钥轮转**：LiteLLM key / GitHub Token 定期轮转；用 `openclaw secrets` 或 Cloudflare Vault

### 3.5 参考仓库

| 仓库 | 说明 | 链接 |
|------|------|------|
| LiteLLM GitHub Actions | CI/CD 集成 | https://github.com/BerriAI/litellm/tree/main/cookbook/github_actions |
| Cloudflare Workers AI | 边缘 AI | https://github.com/cloudflare/ai-workers |
| Cloudflare Workers 模板 | Workers 脚手架 | https://github.com/cloudflare/templates |
| GitHub Actions 市场 | AI 自动化 Actions | https://github.com/marketplace?category=ai&type=actions |
| Wrangler 部署 Actions | Pages/Workers 部署 | https://github.com/marketplace/actions/cloudflare-pages-action |
| hermes-agent GitHub | Agent 编排 | https://github.com/agent-studio/hermes-agent |
| DeepSeek Harness | AI Agent 框架 | https://github.com/deepseek-ai/deepseek-harness |
| freellmapi CLI | 工具配置 | https://github.com/tashfeenahmed/freellmapi/tree/main/cli |

**GitHub Actions 完整示例（PR Review Bot）：**
```yaml
name: AI PR Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Get PR diff
        id: diff
        run: |
          curl -s ${{ github.event.pull_request.diff_url }} > pr.diff
      - name: AI Review
        env:
          OPENAI_BASE_URL: http://localhost:3001/v1
          OPENAI_API_KEY: ${{ secrets.FREELLMAPI_KEY }}
        run: |
          curl -X POST $OPENAI_BASE_URL/chat/completions \
            -H "Authorization: Bearer $OPENAI_API_KEY" \
            -H "Content-Type: application/json" \
            -d '{
              "model": "kilo-auto",
              "messages": [{"role": "user", "content": "Review this PR: '"$(cat pr.diff)"'"}]
            }' > review.json
      - name: Post comment
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const review = JSON.parse(fs.readFileSync('review.json', 'utf8'));
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: review.choices[0].message.content
            });
```

### 3.6 当前部署状态

| 项目 | 状态 | 详情 |
|------|------|------|
| GitHub Actions | ✅ 已配置 | `.github/workflows/ai-pr-review.yml` |
| Daily AI Summary | ✅ 已配置 | `.github/workflows/ai-daily-summary.yml` |
| AI Issue Triage | ✅ 已配置 | `.github/workflows/ai-issue-triage.yml` |
| AI Code Quality | ✅ 已配置 | `.github/workflows/ai-code-quality.yml` |
| 脚本文件 | ✅ 已完成 | `scripts/ai-review.js`, `ai-summary.js`, `ai-triage.js` |
| 文档 | ✅ 已完成 | `README.md`, `.env.example` |

**项目路径：** `G:\其他计算机\我的计算机\001\ai-automation`

**核心功能：**
1. **AI PR Review** - 自动审查 PR，提供代码质量反馈、安全检测、性能建议
2. **Daily AI Summary** - 每天 18:00 UTC 自动生成项目活动摘要，创建/更新日报 issue
3. **AI Issue Triage** - 自动分类和优先级排序 Issues，添加标签
4. **AI Code Quality** - 代码质量分析和安全检测，创建 GitHub Check

**部署到 GitHub：**

```bash
# 复制工作流文件到你的项目
cp -r G:\其他计算机\我的计算机\001\ai-automation\.github\workflows\* your-project\.github\workflows\

# 在 GitHub 仓库设置 Secrets：
# Settings → Secrets and variables → Actions → New repository secret
# 添加：
#   OPENAI_BASE_URL = http://localhost:3001/v1
#   OPENAI_API_KEY = freellmapi-89a2cae15297e3084396ce15673295ecd58d48e583a8bee3
```

**工作流触发条件：**
- PR 打开/更新 → AI Review + Code Quality
- Issue 打开 → AI Triage
- 每天 18:00 UTC → Daily Summary
- 手动触发 → 所有工作流

**注意：** 本地 `npm install` 遇到 Windows 文件系统 tar 错误，但不影响 GitHub Actions 使用。工作流文件在 GitHub 托管的 Ubuntu runner 上运行，无需本地安装依赖。

---

## 场景四：实时交互应用（AI 客服 / 对话机器人 / 多人协作）

### 4.1 适用业务方向
- 在线客服系统（WebSocket / Webhook）  
- 多人实时 AI 白板 / 协作文档  
- 直播 / 游戏实时 AI 互动

### 4.2 技术栈选型
- 实时通信：Cloudflare Durable Objects / Workers + WebSocket / Socket.IO
- 消息队列：Cloudflare Queues / Kafka（自托管）
- 会话状态：Neon PostgreSQL（长期会话）/ Durable Objects SQLite（短状态）
- AI 网关：LiteLLM Proxy（支持 streaming + function calling）
- 前端：React + Vite + shadcn/ui
- 本地编排：Hermes Agent Gateway + OpenClaw Gateway（复杂对话流）

### 4.3 核心功能实现步骤

**步骤 1：Durable Objects 实时房间**

```ts
// worker/src/index.ts
export { AIChatRoom } from './room';

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname === '/ws') {
      const id = env.AIChatRoom.getByName('global-chat');
      return id.fetch(request);
    }
    return new Response('OK');
  },
};
```

**步骤 2：AI 流式回复（Server-Sent Events / WebSocket）**

```ts
// room.ts
export class AIChatRoom {
  async fetch(request: Request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.accept();
    server.addEventListener('message', async (event) => {
      const userMsg = event.data;
      const stream = await callLiteLLMStream(userMsg);
      for await (const chunk of stream) {
        server.send(chunk.choices[0]?.delta?.content || '');
      }
    });

    return new Response(null, { status: 101, webSocket: client });
  }
}
```

**步骤 3：Hermes Agent 接入（本地复杂决策）**

```yaml
# ~/.hermes/config.yaml
model:
  provider: freellmapi
  model: kilo-auto
gateway:
  enabled: true
  port: 18789
```

```bash
# 本地 Gateway 作为高级意图识别 / 工具调用层
hermes gateway run --replace
```

### 4.4 生产部署配置要点
- **连接数控制**：Durable Objects 单实例并发上限；大房间用 `sticky` 路由
- **流式超时**：Cloudflare Worker 默认 30s，长对话需改用 Durable Object + `event.waitUntil`
- **消息持久化**：关键消息异步落库 Neon；热消息留 Durable Objects SQLite
- **鉴权**：WebSocket 握手阶段校验 JWT / API Key

### 4.5 参考仓库

| 仓库 | 说明 | 链接 |
|------|------|------|
| Durable Objects Chat | 实时聊天室 | https://github.com/cloudflare/durable-objects-examples/tree/main/chat |
| LiteLLM Streaming | 流式响应示例 | https://github.com/BerriAI/litellm/tree/main/cookbook/community_examples/openai_basics |
| OpenClaw Gateway | WebSocket 网关 | https://github.com/openclaw/openclaw/tree/main/docs/gateway |
| Cloudflare WebSocket | Workers WebSocket | https://developers.cloudflare.com/workers/runtime-apis/websockets/ |
| Hermes Agent MCP | 模型上下文协议 | https://github.com/agent-studio/hermes-agent/tree/main/docs/mcp |
| Vercel AI SDK | 流式 AI 响应 | https://github.com/vercel/ai |

**生产级 WebSocket 配置：**
```ts
// worker/src/realtime.ts
export class RealtimeRoom {
  private sessions: WebSocket[] = [];
  private state: DurableObjectState;

  async fetch(request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    this.sessions.push(server);
    server.accept();

    server.addEventListener('message', async (event) => {
      const userMessage = JSON.parse(event.data);

      // 流式 AI 响应
      const stream = await callLiteLLMStream(userMessage.content);
      for await (const chunk of stream) {
        server.send(JSON.stringify({
          type: 'content',
          content: chunk.choices[0]?.delta?.content || ''
        }));
      }
    });

    server.addEventListener('close', () => {
      this.sessions = this.sessions.filter(s => s !== server);
    });

    return new Response(null, { status: 101, webSocket: client });
  }
}
```

### 4.6 当前部署状态

| 项目 | 状态 | 详情 |
|------|------|------|
| Cloudflare Worker | ✅ 已部署 | https://ai-chat-room.my-fullstack-app.workers.dev |
| Durable Objects | ✅ 已创建 | `AIChatRoom` |
| Worker Secrets | ✅ 已配置 | LITELLM_API_KEY, LITELLM_API_BASE |
| GitHub Actions | ✅ 已配置 | .github/workflows/deploy.yml |
| Worker 代码 | ✅ 已完成 | src/index.ts |
| 前端代码 | ✅ 已完成 | frontend/src/App.tsx |
| Hermes 配置 | ✅ 已完成 | hermes-config/config.yaml |

**项目路径：** `G:\其他计算机\我的计算机\001\realtime-app`

**核心功能：**
- Durable Objects 实时房间管理
- AI 流式回复（SSE streaming）
- 多用户在线计数
- 消息持久化
- React + Tailwind 前端界面

---

## 场景五：静态站点全球加速（文档 / 博客 / 产品官网 + AI 搜索）

### 5.1 适用业务方向
- 技术文档站（Docusaurus / Next.js 静态导出）  
- 企业官网 / 产品 Landing Page  
- 全球可访问的 AI 增强搜索站点

### 5.2 技术栈选型
- 静态站点生成：Next.js Static Export / Astro / Docusaurus
- 托管与加速：Cloudflare Pages + R2（图片/静态资源）
- 数据库：Neon PostgreSQL（存储搜索索引 / 用户反馈）
- AI 搜索：LiteLLM Embeddings + 向量检索（pgvector）或 Cloudflare Vectorize
- 数据库连接：Cloudflare Hyperdrive
- CI/CD：GitHub Actions 自动构建 + Cloudflare Pages 预览部署

### 5.3 核心功能实现步骤

**步骤 1：Next.js 静态导出 + Cloudflare Pages**

```js
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
};
module.exports = nextConfig;
```

**步骤 2：Cloudflare Hyperdrive 配置**

```bash
# 创建 Hyperdrive
wrangler hyperdrive create ai-static-site-db \
  --connection-string postgresql://user:pass@host/db

# wrangler.toml
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "your-hyperdrive-id"
```

**步骤 3：AI 语义搜索（Pages Functions + Hyperdrive）**

```ts
// functions/api/search/index.ts
export async function onRequestPost(context) {
  const { query } = await context.request.json();
  const hyperdrive = context.env.HYPERDRIVE;
  const conn = await hyperdrive.connect();
  
  conn.query(
    `SELECT id, title, content, url FROM pages WHERE title ILIKE $1 OR content ILIKE $2 LIMIT 5`,
    [`%${query}%`, `%${query}%`],
    (err, result) => {
      if (err) throw err;
      results = result.rows;
    }
  );
  
  conn.release();
  return Response.json({ query, results });
}
```

**步骤 4：GitHub Actions 自动部署**

```yaml
name: Deploy to Cloudflare Pages
on:
  push:
    branches: [main]
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - run: pnpm install
      - run: pnpm build
      - uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: ai-static-site
          directory: .next
```

### 5.4 生产部署配置要点
- **构建缓存**：GitHub Actions 启用 `actions/cache` 缓存 `pnpm-store` / `.next`
- **分支预览**：Cloudflare Pages 开启 "Preview deployments on pull requests"
- **缓存策略**：静态资源 `Cache-Control: public, max-age=31536000, immutable`；HTML `max-age=0, must-revalidate`
- **安全头**：Cloudflare Pages 配置 `Security Headers`（CSP / X-Frame-Options / HSTS）
- **Hyperdrive 连接池**：配置 `--origin-connection-limit` 控制连接数
- **R2 存储**：大文件 / 用户上传走 R2，避免 Pages 50MB 限制

### 5.5 参考仓库

| 仓库 | 说明 | 链接 |
|------|------|------|
| Cloudflare Pages + Next.js | 官方部署指南 | https://developers.cloudflare.com/pages/framework-guides/nextjs/ |
| LiteLLM Embeddings | 向量搜索 | https://github.com/BerriAI/litellm/tree/main/cookbook/vector_search |
| Docusaurus 部署 | 文档站部署 | https://docusaurus.io/docs/deployment#cloudflare-pages |
| Cloudflare Vectorize | 向量数据库 | https://developers.cloudflare.com/vectorize/ |
| Cloudflare Hyperdrive | 数据库连接 | https://developers.cloudflare.com/hyperdrive/ |
| Neon pgvector | 向量索引 | https://neon.tech/docs/extensions/pg-vector |
| Astro + Cloudflare | 静态站模板 | https://github.com/withastro/astro/tree/main/examples/basic |
| Next.js Static Export | 静态导出 | https://nextjs.org/docs/app/building-your-application/deploying/static-exports |

**Cloudflare Pages 环境变量配置：**
```bash
# 构建命令
NEXT_TELEMETRY_DISABLED=1 pnpm build

# 环境变量（Pages Settings > Environment Variables）
OPENAI_BASE_URL = http://localhost:3001/v1
# 注意：生产环境需部署独立的 LiteLLM Proxy
OPENAI_API_KEY = your-freellmapi-key
DATABASE_URL = postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require
```

### 5.6 当前部署状态

| 项目 | 状态 | 详情 |
|------|------|------|
| Cloudflare Pages | ✅ 已部署 | https://fd21f0ca.ai-static-site.pages.dev |
| Pages Functions | ✅ 已配置 | `/api/search` 端点 |
| Hyperdrive | ✅ 已配置 | `7b84362225dd492b8dd03c1a03e0e6b9` |
| Secrets | ✅ 已配置 | LITELLM_API_KEY, LITELLM_API_BASE, DATABASE_URL, OPENAI_BASE_URL, OPENAI_API_KEY |
| GitHub Actions | ✅ 已配置 | `.github/workflows/deploy.yml` |
| 搜索功能 | ✅ 工作 | 关键词搜索通过 Hyperdrive 连接 Neon |

**项目路径：** `G:\其他计算机\我的计算机\001\static-site`

**核心功能：**
- Next.js 静态导出 (`output: "export"`)
- AI 语义搜索 API (`/api/search`)
- Cloudflare Pages Functions (Serverless)
- LiteLLM Embeddings + Neon pgvector 向量搜索
- 响应式 UI (纯 HTML/CSS/JS)

**技术栈：**
- 静态站点：Next.js Static Export
- 托管：Cloudflare Pages (全球 CDN)
- 数据库：Neon PostgreSQL
- 数据库连接：Cloudflare Hyperdrive
- 搜索：关键词搜索（可升级到 pgvector 语义搜索）
- CI/CD：GitHub Actions

**验证结果：**
```bash
# 测试搜索 API
curl -X POST https://fd21f0ca.ai-static-site.pages.dev/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"test"}'

# 返回结果
{
  "query": "test",
  "results": [
    {
      "id": "1",
      "title": "Getting Started with AI Search",
      "content": "Learn how to configure AI-powered semantic search with Neon PostgreSQL and pgvector...",
      "url": "/docs/getting-started"
    },
    ...
  ]
}
```

**后续步骤：**
1. 在 Neon 中启用 pgvector 扩展：`CREATE EXTENSION IF NOT EXISTS vector;`
2. 插入测试数据到 `pages` 表
3. 测试搜索功能：访问 https://fd21f0ca.ai-static-site.pages.dev
4. 配置自定义域名（可选）

---

## 六、组合栈生产环境架构图（建议）

```
┌─────────────┐    ┌──────────────┐    ┌──────────────────┐
│  GitHub     │────▶│ GitHub Actions│────▶│ Cloudflare Pages │
│  Repos      │    │  CI/CD        │    │ / Workers        │
└─────────────┘    └──────────────┘    └────────┬─────────┘
                                                │
                                                ▼
┌─────────────────┐    ┌──────────────────────────────┐
│ Hermes Agent    │    │ OpenClaw Gateway             │
│ (本地 / 服务端) │────▶│ (WebSocket / 多租户)         │
│ + MCP / A2A    │    └──────────────┬───────────────┘
└─────────────────┘                   │
                                      ▼
                         ┌──────────────────────┐
                         │ FreeLLMAPI / LiteLLM │
                         │ (统一模型路由 + 计费) │
                         └──────────┬───────────┘
                                    │
                 ┌──────────────────┼──────────────────┐
                 ▼                  ▼                  ▼
        ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
        │ Groq / Gemini │  │ Mistral /     │  │ NVIDIA NIM /  │
        │ (免费层)      │  │ Cerebras      │  │ OpenRouter    │
        └───────────────┘  └───────────────┘  └───────────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │ Neon PostgreSQL      │
                         │ (Drizzle ORM + pg)   │
                         └──────────────────────┘
```

---

## 七、新手入门路径（0 到 1）

| 阶段 | 学习目标 | 具体任务 | 预计耗时 |
|------|----------|----------|----------|
| 1 | 环境就绪 | 完成本文中 Hermes Agent / OpenClaw / FreeLLMAPI 的本地部署 | 2-3 小时 |
| 2 | 模型调用 | 用 Hermes `chat -q` 和 OpenClaw `tui` 跑通 `kilo-auto` / `llama-3.3-70b-versatile` | 1 小时 |
| 3 | 全栈 Web | 克隆 LiteLLM cookbook 中的 ChatGPT Clone，接入 Neon + Cloudflare Pages | 1-2 天 |
| 4 | 边缘服务 | 部署一个 Cloudflare Worker + LiteLLM Proxy 的多模型路由 Demo | 1 天 |
| 5 | Serverless | 用 GitHub Actions + Cloudflare Workers 实现一个 PR Review Bot | 2-3 天 |
| 6 | 实时交互 | 基于 Durable Objects 做一个多房间 AI 聊天室 | 2-3 天 |
| 7 | 静态加速 | 将个人文档站部署到 Cloudflare Pages，并加 AI 语义搜索 | 1-2 天 |

---

## 八、国内开发者常见问题与避坑

1. **模型可用性**  
   - Groq / Gemini / Mistral / Cerebras 免费层均无需信用卡，直接注册即可  
   - 若访问 `openrouter.ai` 受限，优先走本地 FreeLLMAPI → 直接连各厂商

2. **Cloudflare 访问**  
   - Cloudflare Pages / Workers 在中国大陆可访问管理后台；Worker 出站访问 LLM API 通常不受限  
   - 若受限，改用 Neon（美国东区 `us-east-1`） + 国内云函数兜底

3. **Neon 冷启动**  
   - Neon 免费版会自动暂停，首次查询可能 1-3 秒延迟；生产建议用 "Always On" 或连接池（pgBouncer）

4. **Hermes / OpenClaw 配置路径**  
   - Hermes 实际配置目录：`C:\Users\Administrator\AppData\Local\hermes\`  
   - OpenClaw 配置目录：`C:\Users\Administrator\.openclaw\openclaw.json`  
   - 不要放到 git 仓库里；用 `.env` + `config.yaml` 分离密钥与配置

5. **LiteLLM 生产化**  
   - 不要用 SQLite 做生产 spender/log；改用 Postgres / MySQL / S3  
   - 开启 `SSO` / `Virtual Keys` / `Rate Limits`；参考 `proxy_server_config.yaml`

---

## 九、一键部署脚本参考

### 9.1 本地 FreeLLMAPI 启动
```powershell
# 已有仓库时直接启动
cd C:\Users\Administrator\Desktop\001\freellmapi
"C:\Program Files\Python311\python.exe" -m http.server 3001
# 或 Node 服务
cd C:\Users\Administrator\Desktop\001\freellmapi
$env:Path = "C:\Program Files\nodejs;C:\Users\Administrator\AppData\Roaming\npm;" + $env:Path
npx tsx watch server\src\index.ts
```

### 9.2 Hermes Agent 快速启动
```powershell
cd C:\Users\Administrator\Desktop\001\hermes-agent
.\.venv\Scripts\hermes.exe gateway run --replace
```

### 9.3 OpenClaw 快速启动
```powershell
$env:Path = "C:\Program Files\nodejs;C:\Users\Administrator\AppData\Roaming\npm;" + $env:Path
cd C:\Users\Administrator\Desktop\001\openclaw
pnpm dev -- gateway run --force
```

---

## 十、总结

- **新手友好**：从场景三（Serverless GitHub Bot）或场景五（静态站 AI 搜索）切入，代码量最小、运维成本最低  
- **企业级可用**：场景二（边缘 AI 网关）+ 场景一（全栈 Web）覆盖大多数企业需求，LiteLLM 提供虚拟 key / SSO / 计费 / 审计  
- **组合优势**：Hermes / OpenClaw 做本地智能编排，FreeLLMAPI / LiteLLM 做统一模型路由，Cloudflare / Neon 做全球基础设施，GitHub 做代码与 CI/CD，形成完整的云原生 AI 应用闭环

---

## 十一、工具链快速参考卡片

### 11.1 Hermes Agent（本地 AI 代理运行时）

```powershell
# 启动 Gateway
cd "G:\其他计算机\我的计算机\001\hermes-agent"
"C:\Users\Administrator\AppData\Local\Programs\Python\Python311\python.exe" hermes gateway run --replace

# 配置模型（~/.hermes/config.yaml）
model:
  provider: freellmapi
  model: kilo-auto
```

**适用场景：** 本地开发调试、复杂工具链编排、多模态 Agent

### 11.2 OpenClaw（多租户 Agent 网关）

```powershell
# 启动
cd "G:\其他计算机\我的计算机\001\openclaw"
pnpm dev -- gateway run --force

# Web UI: http://localhost:3080
```

**适用场景：** 多用户共享 Agent、WebSocket 实时交互、生产环境 Agent 服务

### 11.3 DeepSeek Harness（AI 编排框架）

```bash
# 启动 Web UI
npx @deepseek-ai/dsh web

# 配置 FreeLLMAPI
npx freellmapi setup-dsh --url http://localhost:3001 --api-key freellmapi-89a2cae15297e3084396ce15673295ecd58d48e583a8bee3
```

**适用场景：** AI 工作流编排、多模型协同、复杂 Agent 编排

### 11.4 FreeLLMAPI（统一模型网关）

```bash
# 启动
cd "G:\其他计算机\我的计算机\001\freellmapi"
npx tsx watch server\src\index.ts

# API 测试
curl http://localhost:3001/v1/models \
  -H "Authorization: Bearer freellmapi-89a2cae15297e3084396ce15673295ecd58d48e583a8bee3"
```

**已集成模型（635+ 免费端点）：**
- Groq: llama-3.3-70b-versatile, gemma2-9b-it
- Google Gemini: gemini-2.0-flash-exp, gemini-1.5-flash
- Mistral: mistral-nemo-instruct-2407, codestral
- NVIDIA: nemotron-3-super-120b, nvidia-nemotron-3.5-lightning-30b-a3b
- 本地 Ollama: gemma4:e2b-it-qat
- OpenRouter: deepseek-v4-flash, gpt-oss-120b

### 11.5 Cloudflare Wrangler（边缘部署）

```bash
# 已登录验证
npx wrangler whoami

# 部署 Worker
npx wrangler deploy

# 查看实时日志
npx wrangler tail
```

### 11.6 Neon PostgreSQL（Serverless 数据库）

```bash
# 连接字符串（已配置）
postgresql://neondb_owner:npg_xxx@ep-square-boat-auqrsoiu-pooler.c-10.us-east-1.aws.neon.tech/neondb

# 启用 pgvector（向量搜索）
CREATE EXTENSION IF NOT EXISTS vector;

# Neon 控制台
https://console.neon.tech
```

---

## 十二、常见问题与解决方案

### Q1: 模型调用返回 401 Unauthorized
```bash
# 检查 API Key 是否正确
curl http://localhost:3001/v1/models \
  -H "Authorization: Bearer freellmapi-89a2cae15297e3084396ce15673295ecd58d48e583a8bee3"

# 检查 Key 是否在 FreeLLMAPI 后台添加
# 访问 http://localhost:3001 → Keys → Add Key
```

### Q2: Cloudflare Workers 部署失败
```bash
# 清除 Wrangler 缓存
npx wrangler deploy --dry-run

# 检查账户权限
npx wrangler whoami

# 查看详细错误
npx wrangler deploy --verbose
```

### Q3: Neon 连接超时
```bash
# 检查连接字符串格式
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

# Neon 免费版会自动暂停，恢复需要 1-3 秒
# 生产环境建议使用连接池或 "Always On" 配置
```

### Q4: Ollama 本地模型未响应
```bash
# 检查 Ollama 是否运行
curl http://127.0.0.1:11434/api/tags

# 查看可用模型
ollama list

# 拉取模型
ollama pull gemma4:e2b-it-qat
```

---

## 十三、生产环境检查清单

| 检查项 | 状态 | 说明 |
|--------|------|------|
| FreeLLMAPI HTTPS | ☐ | 生产环境建议使用反向代理（如 Caddy/Nginx）启用 HTTPS |
| Neon 连接池 | ☐ | 使用 pgBouncer 或 Neon 内置连接池 |
| API Key 加密 | ☐ | 确保 ENCRYPTION_KEY 已设置且安全存储 |
| GitHub Secrets | ☐ | 所有密钥存储在 GitHub Secrets，禁止硬编码 |
| Cloudflare Rate Limit | ☐ | Workers 配置请求频率限制 |
| 日志归档 | ☐ | LiteLLM 日志定期归档到 S3/R2 |
| 监控告警 | ☐ | 配置 Prometheus + Grafana 监控 |
| 密钥轮转 | ☐ | 定期轮转 API Key，更新 GitHub Secrets |
