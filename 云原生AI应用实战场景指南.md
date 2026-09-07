# 云原生 AI 应用实战场景指南

> 目标读者：国内开发者  
> 要求：零基础友好 + 企业级生产可用 + 拒绝空泛理论 + 每个场景给具体仓库参考  
> 核心栈：Hermes、OpenClaw、GitHub、Cloudflare、Neon、Render、Railway

---

## 0. 全局技术栈总览与选型逻辑

| 能力域 | 推荐组件 | 选型理由 | 国内关注度 |
|--------|----------|----------|-----------|
| AI 模型调用 | LiteLLM / FreeLLMAPI / Hermes Agent / OpenClaw | 一次接入 100+ 模型，统一 OpenAI 格式，支持负载均衡、密钥加密、费用追踪；国内可直连 Groq / Google Gemini / Mistral / Cerebras / NVIDIA NIM 等免费层 | ⭐⭐⭐⭐⭐ |
| 边缘无服务器函数 | Cloudflare Workers / Pages | 边缘节点覆盖广、冷启动 <1ms、免费额度充足，适合全球加速与轻量 API | ⭐⭐⭐⭐⭐ |
| 托管数据库 | Neon PostgreSQL | Serverless Postgres，自动暂停/恢复，按计算/存储分离付费，适合 Next.js / Drizzle ORM | ⭐⭐⭐⭐ |
| 应用托管 | Railway / Render | 无需 K8s 的容器托管，支持 GitHub 自动部署，适合 Node.js / Next.js 服务 | ⭐⭐⭐⭐⭐ |
| 代码托管与 CI/CD | GitHub + GitHub Actions | 国内开发者最熟悉的协作平台，Actions 提供免费 CI/CD 分钟数 | ⭐⭐⭐⭐⭐ |
| 本地 AI 代理运行时 | Hermes Agent + OpenClaw | 本地优先的 agent gateway，支持 MCP / A2A / 多模态 / Gateway 持久化，可直接调用 LiteLLM 兼容端点 | ⭐⭐⭐⭐ |

### 0.1 核心环境变量（统一配置）

```bash
# FreeLLMAPI 本地网关（替代各厂商直连）
OPENAI_BASE_URL=http://localhost:3001/v1
OPENAI_API_KEY=freellmapi-89a2cae15297e3084396ce15673295ecd58d48e583a8bee3

# GitHub（用于 Actions / PR 自动化）
GITHUB_TOKEN=ghp_xxxxxxxxxxxx

# Neon（已存在）
DATABASE_URL=postgresql://neondb_owner:npg_rWOvA5QU9pFe@ep-square-boat-auqrsoiu-pooler.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

# Cloudflare（用于 Workers / Pages 部署）
CLOUDFLARE_API_TOKEN=xxxxxxxxxxxx

# Railway / Render
RAILWAY_TOKEN=xxxxxxxxxxxx
RENDER_API_KEY=xxxxxxxxxxxx
```

---

## 场景一：全栈 Web 应用（AI 聊天 + 数据库持久化）

### 1.1 适用业务方向
- 企业内部知识库问答  
- 客服智能回复系统  
- 多用户 AI 对话 SaaS（按用户隔离会话与计费）

### 1.2 技术栈选型逻辑
| 层级 | 技术 | 选型理由 |
|------|------|----------|
| 前端 | Next.js 14+ (App Router) + Tailwind CSS + shadcn/ui | React 生态最成熟，App Router 支持 Server Components，Tailwind + shadcn/ui 开发效率极高 |
| 后端 | Next.js API Routes / Server Actions | 同前端框架，无需单独部署后端服务，适合快速迭代 |
| 数据库 | Neon PostgreSQL + Drizzle ORM | Neon 自动暂停/恢复，Drizzle 类型安全，适合 Serverless 场景 |
| AI 网关 | LiteLLM Proxy / FreeLLMAPI / Railway 托管 | 统一 OpenAI 格式，支持多模型路由、密钥加密、费用追踪 |
| Agent 运行时 | Hermes Agent / OpenClaw | 本地开发调试用，支持 MCP / A2A / 多模态 |
| 部署 | Railway（全栈服务）+ Cloudflare Pages（前端静态） | Railway 一键部署 Node.js 服务，Cloudflare Pages 全球 CDN 加速静态资源 |

### 1.3 核心功能实现步骤

**步骤 1：项目初始化**
```bash
pnpm create next-app@latest ai-chat --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd ai-chat
pnpm add drizzle-orm postgres @ai-sdk/openai ai next-auth
pnpm add -D drizzle-kit @types/node
```

**步骤 2：数据库 Schema**
```ts
// src/db/schema.ts
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  password: text('password').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const chats = pgTable('chats', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const messages = pgTable('messages', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  chatId: text('chat_id').notNull().references(() => chats.id),
  role: text('role').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

**步骤 3：AI 流式聊天 API**
```ts
// src/app/api/chat/route.ts
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { getServerSession } from 'next-auth';

export const runtime = 'edge';

export async function POST(req: Request) {
  const session = await getServerSession();
  const { messages } = await req.json();

  const result = streamText({
    model: openai('kilo-auto', {
      baseURL: process.env.OPENAI_BASE_URL,
      apiKey: process.env.OPENAI_API_KEY,
    }),
    messages,
  });

  return result.toDataStreamResponse();
}
```

**步骤 4：Hermes Agent 本地调试集成**
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
cd C:\Users\Administrator\Desktop\001\hermes-agent
.\.venv\Scripts\hermes.exe gateway run --replace
```

### 1.4 生产部署配置要点

**Railway 部署配置**
```json
// railway.json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "pnpm install && pnpm build"
  },
  "deploy": {
    "startCommand": "pnpm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

```bash
# 部署命令
cd ai-chat
pnpm build
railway up
railway domain  # 获取生产域名
```

**关键生产配置**
- **Next.js 配置**：`output: 'standalone'`，减少部署体积
- **数据库迁移**：使用 `drizzle-kit push:pg` 自动同步 Neon schema
- **环境变量**：在 Railway Dashboard 设置 `DATABASE_URL`、`OPENAI_BASE_URL`、`OPENAI_API_KEY`、`AUTH_SECRET`
- **CORS 与 鉴权**：API Routes 校验 `Authorization` / Session Cookie；禁止裸奔暴露到公网
- **计费隔离**：在 LiteLLM / FreeLLMAPI 层按 `user_id` 做虚拟 key / spend tracking
- **AUTH_SECRET 生成**：`openssl rand -base64 32`

### 1.5 参考仓库
- LiteLLM Proxy + Next.js 全栈示例：https://github.com/BerriAI/litellm/tree/main/cookbook  
  - 路径：`cookbook/community_examples/nextjs_ai_chatgpt_plugin`  
  - 路径：`cookbook/community_examples/openai_basics/1_chatgpt_clone_rag`
- OpenClaw 官方前端接入示例：https://github.com/openclaw/openclaw/tree/main/cookbook  
- Railway Next.js 模板：https://github.com/railwayapp/examples/tree/main/nextjs

---

## 场景二：边缘计算服务（全球 AI API 网关）

### 2.1 适用业务方向
- 为国内/海外多租户提供统一 AI API 入口  
- 企业内部多模型路由与降级  
- 边缘侧智能摘要 / 翻译 / 内容审核

### 2.2 技术栈选型逻辑
| 层级 | 技术 | 选型理由 |
|------|------|----------|
| 边缘运行时 | Cloudflare Workers + Hono | 边缘节点覆盖广，冷启动 <1ms，Hono 轻量且类型安全 |
| AI 网关 | LiteLLM Proxy（Railway / Render 托管） | 成熟的多模型路由、密钥管理、费用追踪 |
| 模型路由 | LiteLLM Auto Router / 自定义加权轮询 | 支持延迟路由、故障转移、预算控制 |
| 密钥管理 | Cloudflare Secrets / Railway Variables | 生产 key 不落地，环境变量注入 |
| 监控 | Cloudflare Analytics + Prometheus + Grafana | 边缘原生监控 + 开源指标栈 |

### 2.3 核心功能实现步骤

**步骤 1：部署 LiteLLM Proxy 到 Railway**
```bash
# 创建 Railway 项目
railway init litellm-proxy
cd litellm-proxy

# package.json
{
  "name": "litellm-proxy",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "dependencies": {
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "dotenv": "^16.0.0"
  }
}
```

```js
// index.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;
const FRELLMAPI_URL = process.env.FRELLMAPI_URL || 'http://localhost:3001';
const FRELLMAPI_KEY = process.env.FRELLMAPI_KEY || 'freellmapi-89a2cae15297e3084396ce15673295ecd58d48e583a8bee3';

// 多模型路由配置
const MODEL_ROUTES = {
  'kilo-auto': {
    primary: { url: `${FRELLMAPI_URL}/v1/chat/completions`, model: 'kilo-auto' },
    fallbacks: [
      { url: `${FRELLMAPI_URL}/v1/chat/completions`, model: 'llama-3.3-70b-versatile' },
      { url: `${FRELLMAPI_URL}/v1/chat/completions`, model: 'google/gemini-2.0-flash-exp:free' }
    ]
  }
};

app.post('/v1/chat/completions', async (req, res) => {
  const { model, messages, stream = false } = req.body;
  // 实现带 failover 的调用逻辑...
  res.json(data);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 LiteLLM Proxy running at http://localhost:${PORT}`);
});
```

```bash
# 部署到 Railway
railway up
railway variables set FRELLMAPI_KEY=your-key-here
```

**步骤 2：Cloudflare Worker 边缘转发**
```ts
// src/index.ts
export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/v1/')) {
      const response = await fetch(`${env.LITELLM_URL}${url.pathname}`, {
        method: request.method,
        headers: {
          'Authorization': `Bearer ${env.LITELLM_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: request.method === 'POST' ? await request.text() : undefined
      });
      return response;
    }
    return new Response('Not Found', { status: 404 });
  },
};
```

```toml
# wrangler.toml
name = "ai-gateway-edge"
compatibility_date = "2026-08-30"
compatibility_flags = ["nodejs_compat"]

[vars]
LITELLM_URL = "https://your-railway-app.up.railway.app"

[[kv_namespaces]]
binding = "RATE_LIMITS"
id = "your-kv-namespace-id"
```

```bash
# 部署 Worker
npx wrangler deploy
npx wrangler secret put LITELLM_API_KEY
```

### 2.4 生产部署配置要点

| 关注点 | 配置建议 |
|--------|----------|
| 多活与故障转移 | LiteLLM 配置 `fallbacks` + `retry`；Worker 层再套一层 DNS 级故障转移 |
| 密钥隔离 | 生产 key 存入 Railway Variables / Cloudflare Secrets，禁止硬编码 |
| 限流与熔断 | LiteLLM 支持 `max_budget` / `rate_limit`；边缘侧用 Cloudflare Rate Limit |
| 日志审计 | LiteLLM 默认写入 SQLite/Postgres；生产建议外接 Prometheus + Grafana |
| 监控告警 | Railway 内置日志 + Cloudflare Workers Analytics |
| 自定义域名 | 在 Cloudflare 绑定自定义域名，启用 HTTPS |

### 2.5 参考仓库
- LiteLLM Docker Compose：https://github.com/BerriAI/litellm/blob/main/docker-compose.yml
- LiteLLM Helm Chart（K8s）：https://github.com/BerriAI/litellm/tree/main/helm
- Cloudflare Workers AI 示例：https://github.com/cloudflare/ai-workers/tree/main/demos
- Railway LiteLLM 部署示例：https://github.com/railwayapp/examples/tree/main/litellm

---

## 场景三：无服务器架构（Serverless AI 应用）

### 3.1 适用业务方向
- 事件驱动的 AI 自动化流水线（GitHub PR Review / Issue Triage）  
- 定时 AI 摘要 / 报表生成  
- Webhook 驱动的 AI 客服工单系统

### 3.2 技术栈选型逻辑
| 层级 | 技术 | 选型理由 |
|------|------|----------|
| 计算 | Cloudflare Workers / Pages Functions | 边缘计算，按请求付费，冷启动快 |
| 触发器 | GitHub Webhooks / Cloudflare Queues / Cron Triggers | 事件驱动，解耦生产消费 |
| 状态存储 | Neon PostgreSQL / Cloudflare KV / D1 | 根据数据持久化需求选择 |
| AI 调用 | LiteLLM / FreeLLMAPI（统一 OpenAI 格式） | 统一接口，多模型兼容 |
| 本地编排 | Hermes Agent / OpenClaw | 复杂决策链在本地编排，Worker 做简单转发 |

### 3.3 核心功能实现步骤

**步骤 1：GitHub PR Review Bot（Cloudflare Worker）**
```ts
// worker/src/index.ts
import { Hono } from 'hono';

type Bindings = {
  AI: Ai;
  PR_REVIEWS: KVNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

app.post('/webhooks/github', async (c) => {
  const payload = await c.req.json();
  const event = c.req.header('x-github-event');

  if (event === 'pull_request' && payload.action === 'opened') {
    const diff = await fetchPRDiff(payload.pull_request.diff_url);
    const review = await c.env.AI.run('@cf/meta/llama-3.1-70b-instruct', {
      prompt: `Review this PR:\n${diff}`,
      max_tokens: 1000
    });

    await c.env.PR_REVIEWS.put(`review:${payload.pull_request.id}`, review.response);
    
    // 评论 PR
    await fetch(payload.pull_request.comments_url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${c.env.GITHUB_TOKEN}` },
      body: JSON.stringify({ body: review.response })
    });
  }

  return c.json({ received: true });
});

export default app;
```

```toml
# wrangler.toml
name = "serverless-ai"
main = "src/index.ts"
compatibility_date = "2026-08-30"
compatibility_flags = ["nodejs_compat"]

[ai]
binding = "AI"

[[kv_namespaces]]
binding = "PR_REVIEWS"
id = "your-kv-id"

# 设置 GitHub Token
# npx wrangler secret put GITHUB_TOKEN
```

**步骤 2：Cron 定时任务（每日 AI 摘要）**
```yaml
# .github/workflows/daily-summary.yml
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
            -H "Authorization: Bearer ${{ secrets.WORKER_API_KEY }}"
```

### 3.4 生产部署配置要点
- **冷启动优化**：Worker 保持轻量，避免大依赖；复杂逻辑拆分为 Queue Consumer
- **幂等性**：Webhook 处理必须做去重（`X-GitHub-Delivery` / `idempotency-key`）
- **失败重试**：Cloudflare Queues 支持 DLQ；GitHub Actions 用 `if: always()` + 手动重跑
- **密钥轮转**：LiteLLM key / GitHub Token 定期轮转；用 `openclaw secrets` 或 Cloudflare Vault
- **监控**：Cloudflare Workers Analytics + GitHub Actions 日志

### 3.5 参考仓库
- LiteLLM GitHub Actions 集成：https://github.com/BerriAI/litellm/tree/main/cookbook/github_actions
- Cloudflare Workers + AI：https://github.com/cloudflare/ai-workers
- Cloudflare Queues 示例：https://github.com/cloudflare/queues-examples

---

## 场景四：实时交互应用（AI 客服 / 对话机器人 / 多人协作）

### 4.1 适用业务方向
- 在线客服系统（WebSocket / Webhook）  
- 多人实时 AI 白板 / 协作文档  
- 直播 / 游戏实时 AI 互动

### 4.2 技术栈选型逻辑
| 层级 | 技术 | 选型理由 |
|------|------|----------|
| 实时通信 | Cloudflare Durable Objects + WebSocket | Durable Objects 保证状态持久化，支持 WebSocket 原生协议 |
| 消息队列 | Cloudflare Queues | 解耦消息生产消费，支持死信队列 |
| 会话状态 | Neon PostgreSQL（长期会话） / Durable Objects SQLite（短状态） | 根据数据生命周期选择存储 |
| AI 网关 | LiteLLM Proxy（支持 streaming + function calling） | 统一 OpenAI 格式，支持流式输出 |
| 前端 | React + Vite + shadcn/ui | 轻量、现代、开发体验好 |
| 本地编排 | Hermes Agent Gateway + OpenClaw Gateway | 复杂对话流、工具调用、多模态处理 |

### 4.3 核心功能实现步骤

**步骤 1：Durable Objects 实时房间**
```ts
// worker/src/chat-room.ts
export class ChatRoom {
  private state: DurableObjectState;
  private sessions: Map<WebSocket, { userId: string; roomId: string }>;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.sessions = new Map();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      server.accept();
      const sessionId = crypto.randomUUID();
      const roomId = url.searchParams.get('room') || 'default';

      this.sessions.set(server, { userId: sessionId, roomId });

      server.addEventListener('message', async (event) => {
        const data = JSON.parse(event.data as string);
        await this.handleMessage(server, data);
      });

      server.addEventListener('close', () => {
        this.sessions.delete(server);
        this.broadcast({ type: 'system', message: 'User left' }, server);
      });

      this.broadcast({ type: 'system', message: 'User joined' }, server);
      server.send(JSON.stringify({ type: 'welcome', sessionId, roomId }));

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('Not Found', { status: 404 });
  }

  private async handleMessage(ws: WebSocket, data: any) {
    const { type, message } = data;
    if (type === 'chat') {
      await this.handleChatMessage(ws, message);
    }
  }

  private async handleChatMessage(ws: WebSocket, message: string) {
    const userId = this.getUserId(ws);
    
    this.broadcast({
      type: 'chat',
      userId,
      message,
      timestamp: new Date().toISOString()
    }, ws);

    // AI 回复（调用 LiteLLM Proxy 或 FreeLLMAPI）
    const aiResponse = await this.generateAIResponse(message);
    
    this.broadcast({
      type: 'chat',
      userId: 'ai',
      message: aiResponse,
      timestamp: new Date().toISOString()
    }, ws);
  }

  private async generateAIResponse(userMessage: string): Promise<string> {
    try {
      const response = await this.env.AI.run('@cf/meta/llama-3.1-70b-instruct', {
        prompt: `You are a helpful AI assistant. Respond to: ${userMessage}`,
        max_tokens: 500,
        temperature: 0.7
      });
      return response.response || 'I apologize, but I could not generate a response.';
    } catch (error) {
      console.error('AI generation error:', error);
      return 'I apologize, but I encountered an error generating a response.';
    }
  }

  private getUserId(ws: WebSocket): string {
    return this.sessions.get(ws)?.userId || 'anonymous';
  }

  private broadcast(message: any, exclude?: WebSocket) {
    const data = JSON.stringify(message);
    this.sessions.forEach((_, ws) => {
      if (ws !== exclude && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });
  }
}
```

```ts
// worker/src/index.ts
export { ChatRoom } from './chat-room';

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname === '/ws') {
      const id = env.CHAT_ROOM.idFromName('global-chat');
      return id.fetch(request);
    }
    return new Response('OK');
  },
};
```

```toml
# wrangler.toml
name = "realtime-chat"
main = "src/index.ts"
compatibility_date = "2026-08-30"
compatibility_flags = ["nodejs_compat"]

[ai]
binding = "AI"

[[durable_objects.bindings]]
name = "CHAT_ROOM"
class_name = "ChatRoom"
script_name = "realtime-chat"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["ChatRoom"]
```

**步骤 2：Hermes Agent 接入（本地复杂决策）**
```yaml
# ~/.hermes/config.yaml
model:
  provider: freellmapi
  model: kilo-auto
gateway:
  enabled: true
  port: 18789
tools:
  - web_search
  - code_interpreter
```

```bash
# 本地 Gateway 作为高级意图识别 / 工具调用层
cd C:\Users\Administrator\Desktop\001\hermes-agent
.\.venv\Scripts\hermes.exe gateway run --replace
```

### 4.4 生产部署配置要点
- **连接数控制**：Durable Objects 单实例并发上限；大房间用 `sticky` 路由
- **流式超时**：Cloudflare Worker 默认 30s，长对话需改用 Durable Object + `event.waitUntil`
- **消息持久化**：关键消息异步落库 Neon；热消息留 Durable Objects SQLite
- **鉴权**：WebSocket 握手阶段校验 JWT / API Key
- **监控**：Cloudflare Workers Analytics + 自定义日志

### 4.5 参考仓库
- Cloudflare Durable Objects Chat：https://github.com/cloudflare/durable-objects-examples/tree/main/chat
- LiteLLM Streaming 示例：https://github.com/BerriAI/litellm/tree/main/cookbook/community_examples/openai_basics
- OpenClaw Gateway 实时连接：https://github.com/openclaw/openclaw/tree/main/docs/gateway
- Realtime Chat Worker 示例：https://github.com/cloudflare/workers-sdk/tree/main/packages/wrangler/templates/realtime-chat

---

## 场景五：静态站点全球加速（文档 / 博客 / 产品官网 + AI 搜索）

### 5.1 适用业务方向
- 技术文档站（Docusaurus / Next.js 静态导出）  
- 企业官网 / 产品 Landing Page  
- 全球可访问的 AI 增强搜索站点

### 5.2 技术栈选型逻辑
| 层级 | 技术 | 选型理由 |
|------|------|----------|
| 静态站点生成 | Next.js Static Export / Astro / Docusaurus | 支持 Markdown、i18n、SEO 友好 |
| 托管与加速 | Cloudflare Pages + R2 | 全球 CDN，边缘缓存，50GB 带宽免费 |
| 数据库 | Neon PostgreSQL（存储搜索索引 / 用户反馈） | Serverless Postgres，自动暂停 |
| AI 搜索 | LiteLLM Embeddings + 向量检索（pgvector）或 Cloudflare Vectorize | 语义搜索，用户体验远超关键词匹配 |
| CI/CD | GitHub Actions 自动构建 + Cloudflare Pages 预览部署 | 代码即配置，PR 预览环境 |

### 5.3 核心功能实现步骤

**步骤 1：Next.js 静态导出 + Cloudflare Pages**
```js
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
};

export default nextConfig;
```

```bash
# 构建并部署
pnpm build
npx wrangler pages project create static-site --production-branch main
npx wrangler pages deploy out
```

**步骤 2：AI 语义搜索（LiteLLM Embeddings + Neon pgvector）**
```ts
// src/app/api/search/route.ts
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';
import { db } from '@/lib/db';
import { pages } from '@/lib/db/schema';

export async function POST(req: Request) {
  const { query } = await req.json();

  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small', {
      baseURL: process.env.OPENAI_BASE_URL,
      apiKey: process.env.OPENAI_API_KEY,
    }),
    value: query,
  });

  // 在 Neon 中做余弦相似度检索
  const results = await db.select()
    .from(pages)
    .orderBy(pages.embedding.cosineSimilarity(embedding))
    .limit(5);

  return Response.json(results);
}
```

```ts
// src/lib/db/schema.ts
import { pgTable, text, vector, timestamp } from 'drizzle-orm/pg-core';

export const pages = pgTable('pages', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }),
  url: text('url').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

**步骤 3：GitHub Actions 自动部署**
```yaml
name: Deploy to Cloudflare Pages
on:
  push:
    branches: [main]
  pull_request:
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
          projectName: my-static-site
          directory: ./out
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}
```

### 5.4 生产部署配置要点
- **构建缓存**：GitHub Actions 启用 `actions/cache` 缓存 `pnpm-store` / `.next`
- **分支预览**：Cloudflare Pages 开启 "Preview deployments on pull requests"
- **缓存策略**：静态资源 `Cache-Control: public, max-age=31536000, immutable`；HTML `max-age=0, must-revalidate`
- **安全头**：Cloudflare Pages 配置 `Security Headers`（CSP / X-Frame-Options / HSTS）
- **R2 存储**：大文件 / 用户上传走 R2，避免 Pages 50MB 限制
- **AI 搜索延迟优化**：Embedding 生成异步化，结果缓存到 KV

### 5.5 参考仓库
- Cloudflare Pages + Next.js：https://developers.cloudflare.com/pages/framework-guides/nextjs/
- LiteLLM Embeddings + 向量搜索：https://github.com/BerriAI/litellm/tree/main/cookbook/vector_search
- Docusaurus + Cloudflare Pages：https://docusaurus.io/docs/deployment#cloudflare-pages
- Next.js 静态导出示例：https://github.com/vercel/next.js/tree/canary/examples/static-html-export

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
                          │ LiteLLM Proxy        │
                          │ (Railway / Render)   │
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
| 1 | 环境就绪 | 完成 Hermes Agent / OpenClaw / FreeLLMAPI 本地部署 | 2-3 小时 |
| 2 | 模型调用 | 用 Hermes `chat -q` 和 OpenClaw `tui` 跑通 `kilo-auto` / `llama-3.3-70b-versatile` | 1 小时 |
| 3 | 全栈 Web | 克隆 LiteLLM cookbook 中的 ChatGPT Clone，接入 Neon + Railway 部署 | 1-2 天 |
| 4 | 边缘服务 | 部署 Cloudflare Worker + Railway LiteLLM Proxy 的多模型路由 Demo | 1 天 |
| 5 | Serverless | 用 GitHub Actions + Cloudflare Workers 实现一个 PR Review Bot | 2-3 天 |
| 6 | 实时交互 | 基于 Durable Objects 做一个多房间 AI 聊天室 | 2-3 天 |
| 7 | 静态加速 | 将个人文档站部署到 Cloudflare Pages，并加 AI 语义搜索 | 1-2 天 |

---

## 八、国内开发者常见问题与避坑

### 8.1 模型可用性
- **免费层**：Groq / Gemini / Mistral / Cerebras 免费层均无需信用卡，直接注册即可
- **网络受限**：若访问 `openrouter.ai` 受限，优先走本地 FreeLLMAPI → 直接连各厂商
- **API Key 管理**：使用 LiteLLM Proxy 统一管理，避免前端泄露厂商 key

### 8.2 部署平台选择
- **Cloudflare**：适合边缘函数、静态站点、全球加速；但免费版有 CPU 时间限制
- **Railway**：适合全栈 Node.js 服务、AI 网关；免费版 $5/月额度
- **Render**：适合静态站点、容器部署；免费版有冷启动延迟
- **混合部署**：前端静态资源放 Cloudflare Pages，AI 网关放 Railway，数据库用 Neon

### 8.3 Neon 冷启动
- Neon 免费版会自动暂停，首次查询可能 1-3 秒延迟
- 生产建议用 "Always On" 或连接池（pgBouncer）
- 高频访问的小表可缓存到 Cloudflare KV

### 8.4 Hermes / OpenClaw 配置
- Hermes 实际配置目录：`C:\Users\Administrator\AppData\Local\hermes\`
- OpenClaw 配置目录：`C:\Users\Administrator\.openclaw\openclaw.json`
- 不要放到 git 仓库里；用 `.env` + `config.yaml` 分离密钥与配置

### 8.5 LiteLLM 生产化
- 不要用 SQLite 做生产 spender/log；改用 Postgres / MySQL / S3
- 开启 `SSO` / `Virtual Keys` / `Rate Limits`；参考 `proxy_server_config.yaml`
- 使用 Railway 部署时，确保 `type: "module"` 在 `package.json` 中

### 8.6 Cloudflare Workers 限制
- 免费版 CPU 时间 10ms/请求，付费版 50ms/请求
- 脚本包大小限制 1MB（压缩后）
- 不适合长时间运行的任务，考虑 Durable Objects 或 Queues

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

### 9.4 Railway 一键部署
```powershell
# 部署 LiteLLM Proxy
cd C:\Users\Administrator\Desktop\001\litellm-proxy
railway up

# 部署 AI Chat
cd C:\Users\Administrator\Desktop\001\ai-chat
railway up
railway domain  # 获取域名
```

### 9.5 Cloudflare 一键部署
```powershell
# 部署 Worker
cd C:\Users\Administrator\Desktop\001\realtime-chat
npx wrangler deploy

# 部署 Pages
cd C:\Users\Administrator\Desktop\001\static-site
npx wrangler pages deploy out
```

---

## 十、总结

| 场景 | 新手友好度 | 企业级可用度 | 推荐优先级 |
|------|-----------|-------------|-----------|
| 全栈 Web 应用（AI 聊天） | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 高 |
| 边缘计算服务（API 网关） | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 中高 |
| 无服务器架构（Serverless） | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 高 |
| 实时交互应用（聊天室） | ⭐⭐⭐ | ⭐⭐⭐⭐ | 中 |
| 静态站点全球加速 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 高 |

### 新手建议
- **入门路径**：从场景三（Serverless GitHub Bot）或场景五（静态站 AI 搜索）切入，代码量最小、运维成本最低
- **进阶路径**：场景一（全栈 Web）+ 场景二（边缘 AI 网关）覆盖大多数企业需求
- **高阶路径**：场景四（实时交互）需要深入理解 Durable Objects 和 WebSocket

### 组合优势
- **Hermes / OpenClaw**：本地智能编排，支持 MCP / A2A / 多模态
- **FreeLLMAPI / LiteLLM**：统一模型路由，支持多厂商、负载均衡、计费
- **Cloudflare / Neon**：全球基础设施，边缘计算 + Serverless 数据库
- **GitHub / Railway / Render**：代码托管 + CI/CD + 应用托管，完整云原生闭环

---

## 十一、扩展阅读

### 官方文档
- Hermes Agent：https://github.com/entropy-research/Hermes
- OpenClaw：https://github.com/openclaw/openclaw
- LiteLLM：https://docs.litellm.ai
- Cloudflare Workers：https://developers.cloudflare.com/workers/
- Neon：https://neon.tech/docs
- Railway：https://docs.railway.app
- Render：https://render.com/docs

### 社区资源
- LiteLLM Cookbook：https://github.com/BerriAI/litellm/tree/main/cookbook
- Cloudflare Examples：https://github.com/cloudflare/examples
- Awesome Free LLM APIs：https://github.com/cheahjs/free-llm-api-resources
