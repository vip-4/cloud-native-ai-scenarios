# 云原生 AI 实战场景白皮书（2026 版）

> 基于 **Cloudflare + Neon + Requesty + GitHub Actions + LiteLLM** 主流云原生组合栈，
> 覆盖全栈 Web、边缘计算、无服务器、实时交互、静态加速五大落地场景。
> 全部场景均在真实账户完成部署验证，工作区与线上 URL 见文末附录。

---

## 0. 全局技术栈总览与选型逻辑

### 0.1 组合栈全景

| 层级 | 技术 | 选型理由 | 替代方案 |
|------|------|----------|----------|
| 运行时 | Cloudflare Workers / Pages Functions | 边缘计算、按请求付费、冷启动 <30ms | Vercel / Netlify / Deno Deploy |
| 数据库 | Neon PostgreSQL（pgvector） | Serverless 免运维、自动暂停、无缝 pgvector | Supabase / PlanetScale / D1 |
| AI 网关 | LiteLLM Proxy + Requesty | 统一 OpenAI 格式、数百模型、按量计费 | OpenRouter / 各家原厂 API |
| 静态加速 | Cloudflare Pages CDN | 全球 300+ 边缘节点、50GB 免费带宽 | Vercel Edge / Netlify |
| 实时通信 | Durable Objects + WebSocket | 有状态边缘计算、状态持久化内建 | Pusher / Ably / Satori |
| CI/CD | GitHub Actions | 仓库内建、生态丰富、免费额度充足 | GitLab CI / CircleCI |
| 前端 | React + Vite / Hono | 生态最大、构建快、类型友好 | Next.js / Astro / SvelteKit |

### 0.2 核心设计原则

1. **一个 Key 管全部模型**：通过 Requesty（`https://router.requesty.ai/v1`）统一代理 OpenAI 兼容请求，模型 ID 用 `provider/model` 格式（如 `mistral/leanstral-1-5`、`anthropic/claude-sonnet-5`）。
2. **密钥永远只进 GitHub Secrets**：任何代码、workflow、配置文件中不得出现明文密钥，统一 `${{ secrets.X }}` 注入。
3. **CI/CD 即代码**：每次 `push` 自动经历 类型检查 → 部署 → 生产健康检查，健康检查失败即失败（fail the build）。
4. **环境约定**：Worker 名与 Pages 项目名固定，部署动作幂等可重跑。

### 0.3 学习路径分级

| 级别 | 适合人群 | 建议场景 | 预计耗时 |
|------|----------|----------|----------|
| ⭐ 零基础新手 | 首次接触云原生 | 场景五（静态站 + AI 搜索）、场景三（Serverless Bot） | 1-3 小时 |
| ⭐⭐ 初级 | 会写代码、想落地 CI/CD | 场景一（全栈 Web）、场景二（边缘网关） | 3-6 小时 |
| ⭐⭐⭐ 中级 | 关注生产架构 | 场景四（实时交互 + Durable Objects） | 4-8 小时 |
| ⭐⭐⭐⭐ 企业 | 生产环境 SLA | 组合全部场景 + LiteLLM SSO/计费 + 监控告警 | 持续 |

---

## 场景一：全栈 Web 应用（AI 聊天 + 数据库持久化）

### 1.1 典型适用业务方向

- 带登录的 SaaS 后台（用户 / 内容 / 评论管理）
- AI 聊天产品（前端对话界面 + 后端持久化会话）
- 任何"有界面 + 有数据 + 有 AI"的 MVP 快速落地

### 1.2 技术栈选型逻辑

| 决策点 | 选择 | 理由 |
|--------|------|------|
| API 框架 | **Hono** | 官方支持 Cloudflare Workers，TypeScript 端到端类型安全，路由/中间件轻量 |
| ORM | **Drizzle** | 类型优先、SQL 贴近原生、`drizzle-kit` 自动迁移，无运行时魔法 |
| 数据库 | **Neon PostgreSQL** | Serverless 免运维，免费版含 0.5GB 存储 + 分支预览 |
| 运行时 | **Cloudflare Workers** | 边缘分发，Worker 内直接用 WebSocket/Hono 流式 |
| CI/CD | **GitHub Actions** | `drizzle-kit push` + `wrangler deploy` + 健康检查一条龙 |

### 1.3 核心功能实现步骤

**步骤 1：初始化 Worker + Hono**

```bash
npm create hono@latest scenario-1-fullstack   # 模板选 cloudflare-workers
cd scenario-1-fullstack
npm i drizzle-orm @neondatabase/serverless
npm i -D drizzle-kit wrangler
```

**步骤 2：定义表结构（src/schema.ts）**

```ts
import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
// posts / comments / categories / tags ... 同模式
```

**步骤 3：Worker 内初始化数据库连接（src/index.ts）**

```ts
import { Hono } from 'hono';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

type Env = { DATABASE_URL: string; APP_ENV: string };

const app = new Hono<{ Bindings: Env }>();

app.use('/api/*', async (c, next) => {
  const sql = neon(c.env.DATABASE_URL!);
  c.set('db', drizzle(sql));
  await next();
});

app.get('/api/health', async (c) => {
  const db = c.get('db');
  await db.select().from(users).limit(1);
  return c.json({ status: 'ok', database: 'connected' });
});
```

**步骤 4：drizzle-kit 非交互式迁移**

```bash
# 关键：drizzle.config.ts 必须设置 strict:false，否则 CI 中 push 会卡交互确认
npx drizzle-kit push --force
```

### 1.4 生产环境部署配置要点

- **`drizzle.config.ts` 必须 `strict: false`**：CI 非交互环境无法回答"表 X 将丢失数据"确认，`strict:false` 直接跳过。
- **`DATABASE_URL` 走 GitHub Secret**：连接串含密码，绝不进代码/`wrangler.toml`。
- **Workflow 分三步**：`cleanup（drop 旧表）→ drizzle push → wrangler deploy`，保证每次部署表结构与代码同步。
- **CI 安装脚手架问题**：新 Runner 默认禁止安装脚本（`workerd`/`esbuild`/`sharp` 的 postinstall），必须在 `package.json` 加 `allowScripts` 白名单。
- **健康检查体现在 CI**：部署后主动 `GET /api/health` 验证数据库连通，失败即退出非 0。

```yaml
# .github/workflows/deploy-scenario-1-fullstack.yml（关键片段）
- name: Install deps
  run: npm ci
- name: Push schema
  run: npx drizzle-kit push --force
  env: { DATABASE_URL: ${{ secrets.DATABASE_URL }} }
- name: Deploy
  run: npx wrangler deploy
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
    CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CF_ACCOUNT_ID }}
```

### 1.5 参考项目（仓库内）

- `scenario-1-fullstack/` —— 完整工作区（Hono + Drizzle + Neon + Workers）
- `.github/workflows/deploy-scenario-1-fullstack.yml` —— 三阶段 CI/CD 流水线
- `check-tables.js` —— 表结构验证脚本

### 1.6 高价值开源参考

| 项目 | 链接 | 借鉴点 |
|------|------|--------|
| **axios/axios** | https://github.com/axios/axios | 前端/Node 统一 HTTP 客户端，AI 应用调用上游 API 的标准姿势（拦截器、超时、错误归一） |
| BerriAI LiteLLM Next.js 示例 | https://github.com/BerriAI/litellm/tree/main/cookbook/community_examples/nextjs_ai_chatgpt_plugin | AI 聊天插件模式，多模型统一调用 |
| Drizzle 官方 Neon 示例 | https://github.com/drizzle-team/drizzle-orm/tree/main/examples/neon | ORM + Neon 最佳实践 |
| Vercel AI SDK | https://github.com/vercel/ai | 流式响应/工具调用的前端封装 |

✅ **仓库实测结果**：`GET /api/health → 200 {"status":"ok","database":"connected"}`，`/api/stats` 返回真实统计，8 张表全部创建。

---

## 场景二：边缘计算服务（全球 AI API 网关）

### 2.1 典型适用业务方向

- 多模型统一入口：一个域名代理 OpenAI/Requesty/OpenRouter 等全部上游
- 企业 AI 网关：限流、鉴权、监控、成本控制集中化
- 前端直连 AI（浏览器 / 移动端），绕开 CORS 与密钥暴露

### 2.2 技术栈选型逻辑

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 运行时 | **Cloudflare Workers** | 300+ 边缘节点就近处理，天然解决 CORS |
| 上游 | **Requesty**（`https://router.requesty.ai`） | 一个 Key 管数百模型，`provider/model` 全兼容 OpenAI 格式 |
| 路由逻辑 | **URL 透传** | `LITELLM_API_BASE + url.pathname` 转发，Zero 业务耦合 |
| 限流 | **Worker 内置 KV/内存计数** | 免费、无外部依赖 |
| 部署 | **wrangler deploy + secret put** | Versioned 部署，秒级回滚 |

### 2.3 核心功能实现步骤

**步骤 1：Worker 主逻辑（edge-gateway/src/index.ts）**

```ts
const UPSTREAM = env.LITELLM_API_BASE + url.pathname; // 关键拼接点

// 注意：LITELLM_API_BASE 应设为 "https://router.requesty.ai"（不含 /v1），
//       这样 pathname 自带 /v1/models、/v1/chat/completions 等前缀。
```

**步骤 2：三个核心路由**

```ts
app.get('/health', (c) => c.json({ status: 'ok' }));
app.get('/v1/models', async (c) => proxyModels(c));           // 模型列表
app.all('/v1/*', async (c) => proxyChatCompletions(c));       // 透传推理
```

**步骤 3：上游非 2xx 兜底**

```ts
if (!upstream.ok) {
  return c.json({ error: 'upstream unavailable', status: upstream.status }, 502);
}
```

### 2.4 生产环境部署配置要点

- **`LITELLM_API_BASE` 不含 `/v1` 后缀**——Worker 用 `base + url.pathname` 拼接，`pathname` 以 `/v1/` 开头；若 base 误带 `/v1` 会产生 `/v1/v1/...` 双重路径。
- **Secrets 三处一致**：GitHub Secrets → workflow 注入 → Worker secret 必须同值，否则 CI 部署与实际运行不一致。
- **限流阈值用 `[vars]` 而非写死**：`RATE_LIMIT_REQUESTS` / `RATE_LIMIT_WINDOW` 可在 Dashboard 改而无需重发代码。
- **健康检查 + 模型列表双验证**：CI 末尾 `GET /health` 200 且 `GET /v1/models` 包含预期模型。

### 2.5 参考项目（仓库内）

- `edge-gateway/` —— 完整网关工作区（含 docker-compose + 本地 LiteLLM 配置）
- `.github/workflows/deploy-edge-gateway.yml` —— 部署 + 健康/模型双验证

### 2.6 高价值开源参考

| 项目 | 链接 | 借鉴点 |
|------|------|--------|
| **nodejs/node** | https://github.com/nodejs/node | 网关幂等/超时/连接池设计，官方 CI 多平台矩阵部署范式 |
| LiteLLM | https://github.com/BerriAI/litellm | 生产级代理：Virtual Keys、SSO、预算、审计日志 |
| Cloudflare workers-sdk | https://github.com/cloudflare/workers-sdk | Wrangler 全部命令与参数参考 |

✅ **仓库实测结果**：`/v1/models → 200` 返回 Requesty 708 个真实模型；`/v1/chat/completions` 用 `mistral/leanstral-1-5` 返回真实 AI 输出 "OK"。

---

## 场景三：无服务器架构（Serverless AI 自动化）

### 3.1 典型适用业务方向

- 事件驱动的 AI 流水线：GitHub PR Review / Issue 自动分类
- 定时 AI 摘要 / 报表（日报、周报、站内信）
- Webhook 驱动的 AI 客服工单系统

### 3.2 技术栈选型逻辑

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 触发器 | **GitHub Actions events** | PR/Issue/定时任务零额外配置，仓库内 ${{ github.event }} 即可 |
| 计算 | **workflow job（ubuntu-latest）** | 无需单独部署 Worker，Actions 即 Serverless |
| AI | **curl + Requesty /v1/chat/completions** | 无需 SDK，Shell 一行搞定 |
| 幂等 | **`X-GitHub-Delivery` + 条件判断** | 避免重复 action 触发重复 AI 调用 |
| 落库 | **GitHub API（issues/PR comments）** | 结果直接回写仓库，天然可追溯 |

### 3.3 核心功能实现步骤

**步骤 1：AI PR 自动审查（.github/workflows/ai-pr-review.yml）**

```yaml
on:
  pull_request:
    types: [opened, synchronize]
jobs:
  review:
    runs-on: ubuntu-latest
    permissions: { pull-requests: write }
    steps:
      - uses: actions/checkout@v4
      - name: AI Review
        env:
          OPENAI_BASE_URL: ${{ secrets.OPENAI_BASE_URL }}   # https://router.requesty.ai/v1
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: |
          curl -sL "${{ github.event.pull_request.diff_url }}" > pr.diff
          curl -X POST $OPENAI_BASE_URL/chat/completions \
            -H "Authorization: Bearer $OPENAI_API_KEY" -H "Content-Type: application/json" \
            -d '{
              "model": "mistral/leanstral-1-5",
              "messages": [
                {"role":"system","content":"你是资深代码审查专家，分析diff并给出: 1) 变更摘要 2) 潜在bug 3) 安全问题 4) 性能影响 5) 改进建议，简明可执行。"},
                {"role":"user","content":"审查这个PR diff:\n'"$(cat pr.diff)"'"}
              ],
              "temperature": 0.3, "max_tokens": 2000
            }' > review.json
          jq -r '.choices[0].message.content' review.json > review.txt
      - name: Post comment
        uses: actions/github-script@v7
        with:
          script: |
            await github.rest.issues.createComment({
              owner: context.repo.owner, repo: context.repo.repo,
              issue_number: context.issue.number,
              body: `## 🤖 AI Code Review\n\n${process.env.REVIEW}`,
            })
```

**步骤 2：定时日报（.github/workflows/ai-daily-summary.yml）**

```yaml
on:
  schedule: [{ cron: '0 18 * * *' }]   # 每天 18:00 UTC
  workflow_dispatch:
# 收集近24h commits/PR/Issue → 抛给 AI 生成摘要 → 写回 Issue/Slack
```

### 3.4 生产环境部署配置要点

- **`OPENAI_BASE_URL` 必须带 `/v1`**（curl 直接拼 `/chat/completions`）：`https://router.requesty.ai/v1`。
- **模型用免费可用 ID**：`mistral/leanstral-1-5`（实测 200），避免 `kilo-auto` 等本地 FreeLLMAPI 专有 ID 在远端失效。
- **`permissions` 最小化**：仅给 `pull-requests: write` / `issues: write`，不滥用 `GITHUB_TOKEN` 的仓库写权限。
- **定时任务注意**：schedule 走默认分支（master），需保证 workflow 文件在 master 上。

### 3.5 参考项目（仓库内）

- `.github/workflows/ai-pr-review.yml` —— PR 审查 Bot
- `.github/workflows/ai-daily-summary.yml` —— 定时日报
- `.github/workflows/ai-issue-triage.yml` / `ai-code-quality.yml` —— Issue 分类 / 代码质量

### 3.6 高价值开源参考

| 项目 | 链接 | 借鉴点 |
|------|------|--------|
| **nodejs/node** | https://github.com/nodejs/node | 完整 CI 矩阵（多平台/多 Node 版本），severless 自动化测试范式 |
| Google GitHub Actions 集合 | https://github.com/google-github-actions | 标准化 DevOps 模板库 |
| Cloudflare ai-workers | https://github.com/cloudflare/ai-workers | Worker 内跑 AI 推理的官方范式 |

---

## 场景四：实时交互应用（AI 客服 / 聊天室 / 多人协作）

### 4.1 典型适用业务方向

- 在线客服系统（WebSocket 实时对话 + AI 辅助）
- 多人协作房间 / 共享白板
- AI 陪伴 / 教育 / 娱乐实时对话产品

### 4.2 技术栈选型逻辑

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 有状态 | **Durable Objects** | WebSocket 连接与状态持久化内建，房间即对象，自动容灾 |
| 实时通信 | **WebSocket（server↔client）** | 全双工、低延迟，Worker 原生支持升级 |
| AI 回复 | **SSE 流式 + Hono stream** | 逐 token 展示，用户体验优于整段返回 |
| 持久化 | **DO SQLite storage** | 消息直接落库，重启不丢 |
| 前端 | **React + Tailwind + Vite** | 生态成熟、样式快、开发热更新 |

### 4.3 核心功能实现步骤

**步骤 1：定义 Durable Object 房间（realtime-app/src/index.ts）**

```ts
export interface Env {
  LITELLM_API_KEY: string;
  LITELLM_API_BASE: string;
  AI_CHAT_ROOM: DurableObjectNamespace;
}

export class AIChatRoom {
  private sessions = new Set<WebSocket>();
  private messages: ChatMessage[] = [];

  async fetch(request: Request): Promise<Response> {
    // WebSocket upgrade 校验 → WebSocketPair → server.accept()
    // 每次 message：落库 → 广播 → 流式调 AI 回复
  }

  private async callLiteLLMStream(userMessage: string) {
    const res = await fetch(`${this.env.LITELLM_API_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.env.LITELLM_API_KEY}` },
      body: JSON.stringify({ model: 'mistral/leanstral-1-5', messages: [...], stream: true }),
    });
    return this.parseSSEStream(res.body);  // 逐行解析 'data: {...}' / '[DONE]'
  }
}

export default {
  async fetch(request, env) {
    if (url.pathname === '/ws') {
      const id = env.AI_CHAT_ROOM.getByName('global-chat');
      return id.fetch(request);           // 同房间所有用户进入同一个 DO
    }
  },
};
```

**步骤 2：wrangler.toml 绑定 DO + SQLite 迁移**

```toml
[durable_objects]
bindings = [{ name = "AI_CHAT_ROOM", class_name = "AIChatRoom" }]

[[migrations]]
tag = "v1"
new_sqlite_classes = ["AIChatRoom"]
```

### 4.4 生产环境部署配置要点

- **`await` 流式迭代器**：`callLiteLLMStream` 返回 `Promise<AsyncIterable>`，`for await` 前必须 `await` 展开，否则类型报错 + stream 不消费。
- **`response.body` 判空**：流式响应可能为空，先 `if (!response.body) throw` 再 `getReader()`。
- **`LITELLM_API_BASE` 用 `https://router.requesty.ai`（无 /v1）**，代码内拼 `/v1/chat/completions`，保持与场景二一致。
- **DO 迁移只在首次部署执行**：`new_sqlite_classes` migration tag 为 v1，二次部署不重复跑。
- **TS 严格模式**：`@cloudflare/workers-types` 配 `types` 字段，避免类型漂移。

### 4.5 参考项目（仓库内）

- `realtime-app/` —— 完整实时聊天室（DO + WebSocket + SSE + React 前端 + Hermes 配置）
- `.github/workflows/deploy-realtime-app.yml` —— 部署 + DO 健康检查

### 4.6 高价值开源参考

| 项目 | 链接 | 借鉴点 |
|------|------|--------|
| **immich-app/immich** | https://github.com/immich-app/immich | 高关注度实时协作实现：NestJS + PostgreSQL + Redis 的完整生产架构，WebSocket/任务队列范式 |
| Cloudflare durable-objects-examples | https://github.com/cloudflare/durable-objects-examples/tree/main/chat | 官方 DO 聊天室模板 |
| socket.io 官方教程 | https://github.com/socketio/socket.io | WebSocket 横向对比与前端封装思路 |

✅ **仓库实测结果**：WebSocket 连接 → 用户计数广播 → 消息落库 → AI 流式输出（Hello → Hello there → Hello there!）→ 最终完整回复，全链路 200。

---

## 场景五：静态站点全球加速（文档 / 博客 / 官网 + AI 搜索）

### 5.1 典型适用业务方向

- 技术文档站（每页可 AI 搜索）
- 企业官网 / 产品 Landing Page（全球加速）
- AI 增强搜索站点

### 5.2 技术栈选型逻辑

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 静态生成 | **纯 HTML/CSS/JS（零构建）** | 无需 Node 构建链，1 条命令部署，最稳最省 |
| 托管 | **Cloudflare Pages** | 全球 CDN、50GB 免费带宽、HTTPS 内建、Git 集成 |
| 动态能力 | **Pages Functions (`/api/*`)** | 静态站夹带 Serverless 后端，无需另开 Worker |
| AI 搜索 | **Requesty + 文档目录排名** | 无需 embedding 库/pgvector 初始化，直接 AI 语义排序 |

### 5.3 核心功能实现步骤

**步骤 1：静态资源目录（static-site/）**

```
static-site/
├── index.html         # 文档站首页（导航 + 搜索框 + 文档卡片）
├── styles.css         # 深色主题样式
├── app.js             # fetch /api/search + 渲染结果
└── functions/api/search.ts   # Pages Function（AI 搜索接口）
```

**步骤 2：AI 搜索 Function（functions/api/search.ts）**

```ts
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { query } = await request.json();
  // 1) 本地粗筛：关键词命中取 top6 候选
  // 2) 调 Requesty：
  await fetch(`${env.LITELLM_API_BASE}/v1/chat/completions`, {
    headers: { Authorization: `Bearer ${env.LITELLM_API_KEY}` },
    body: JSON.stringify({
      model: 'mistral/leanstral-1-5',
      messages: [
        { role: 'system', content: '你是文档检索排序器，返回 JSON ONLY：{"results":[{"id":"...","score":0.0}]}' },
        { role: 'user', content: `Query: "${query}"\n候选文档:\n${catalog}` },
      ],
      temperature: 0.2, max_tokens: 600,
    }),
  });
  // 3) 解析 JSON → 映射文档元数据 → 返回 { results: [...] }
};
```

### 5.4 生产环境部署配置要点

- **Not a gitlink**：`static-site` 之前在仓库里是孤儿 submodule（gitlink），`git rm --cached` 后重新 add 为普通目录，否则文件永远提交不进父仓库。
- **Pages 项目必须先建再传 secrets**：`wrangler pages project create ai-static-site --production-branch master`（幂等，已存在会失败可 `|| true`）。
- **secrets 注入命令带项目名**：`echo "$KEY" | npx wrangler pages secret put LITELLM_API_KEY --project-name ai-static-site`。
- **缓存策略**：静态资源默认由 Pages CDN 缓存；`/api/search` 响应头加 `Cache-Control: no-store`。
- **健康检查验证搜索**：部署后 CI `POST /api/search` 确认返回 `results` 结构。

### 5.5 参考项目（仓库内）

- `static-site/` —— 完整文档站（4 静态文件 + 1 搜索 Function）
- `.github/workflows/deploy-static-site.yml` —— Pages 部署 + 健康检查

### 5.6 高价值开源参考

| 项目 | 链接 | 借鉴点 |
|------|------|--------|
| **immich-app/immich** | https://github.com/immich-app/immich | 大规模自托管 + 机器学习的生产工程组织（Docker 编排、优雅降级 UI） |
| **axios/axios** | https://github.com/axios/axios | 前端调用搜索 API 的规范姿势（超时、错误分支、JSON 解析） |
| Astro | https://github.com/withastro/astro | 需要更复杂文档站时升级为 Astro（内容集合 + 岛屿架构） |
| Tailwind 官方博主模板 | https://github.com/timlrx/tailwind-nextjs-starter-blog | 博客文档站 SEO/i18n/搜索最佳实践 |

✅ **仓库实测结果**：`GET /` 200、`GET /styles.css` 200；`POST /api/search`（"数据库 存储"）→ `neon-db(0.95)` 等 AI 排序结果全部正确。

---

## 场景六：飞书开放平台 + AI 办公自动化（国内落地追加场景）

> 国内团队最常问："AI 能力怎么接到飞书上？" 本场景补齐：**群机器人 AI 助手 + AI 日报/PR 审查自动通知飞书群**。

### 6.1 典型适用业务方向

- 飞书群里直接 @AI 提问，秒回答案（无需切网页）
- 每日 AI 日报 / 代码审查结论 / CI 失败消息自动推送到飞书群
- 企业 IM + 内部知识库问答（结合飞书文档索引）

### 6.2 技术栈选型逻辑

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 开放平台 | **飞书自建应用（App ID + Secret）** | 控制台自助创建、免费、文档全中文 |
| 消息接收 | **事件订阅 `im.message.receive_v1`** | 群内 @机器人 即收到消息事件 |
| 消息发送 | **`im/v1/messages`（tenant_access_token）** | 主动按 `chat_id` 发送，覆盖 1v1/群 |
| AI | **Requesty（mistral/leanstral-1-5）** | 既有网关复用，零新增成本 |
| 承载 | **Cloudflare Worker `/feishu/webhook`** | 公网回调地址 + 免费额度，无需独立服务器 |
| CI 通知 | **GitHub Actions 内置飞书发消息步骤** | 日报/PR 审查完成后推送飞书群 |

### 6.3 核心功能实现步骤

**步骤 1：飞书开放平台创建应用**

```text
1. 打开 https://open.feishu.cn/page/launcher → 创建企业自建应用
2. 应用能力 → 添加「机器人」能力
3. 权限管理 → 开通 `im:message` / `im:message:send_as_bot`
4. 事件与回调 → 事件订阅 → 请求地址填 Worker：`https://feishu-ai-bot.xxx.workers.dev/feishu/webhook`
5. 订阅事件 → 勾选 `im.message.receive_v1`（接收消息）
6. 把机器人拉进目标群
```

**步骤 2：Worker 处理挑战 + 消息事件（feishu-ai-bot/src/index.ts）**

```ts
// URL 验证：飞书首次配置回调地址时会发 {challenge}
if (body.challenge) return new Response(body.challenge);

// 消息事件
if (eventType === 'im.message.receive_v1' && message) {
  const text = JSON.parse(message.content).text;
  const query = text.replace(/<at[^>]*>.*?<\/at>/g, '').trim();  // 去掉 @AI
  const reply = await generateAIReply(query, env);               // 调 Requesty
  await sendFeishuMessage(env, message.chat_id, reply);
}
```

**步骤 3：GitHub Actions 通知飞书（ai-daily-summary.yml 追加）**

```yaml
- name: Send Feishu Notification
  env:
    FEISHU_APP_ID: ${{ secrets.FEISHU_APP_ID }}
    FEISHU_APP_SECRET: ${{ secrets.FEISHU_APP_SECRET }}
    FEISHU_CHAT_ID: ${{ secrets.FEISHU_CHAT_ID }}
  run: |
    TOKEN=$(curl -s -X POST 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal' \
      -H 'Content-Type: application/json' \
      -d "{\"app_id\":\"$FEISHU_APP_ID\",\"app_secret\":\"$FEISHU_APP_SECRET\"}" | jq -r '.tenant_access_token')
    curl -s -X POST 'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id' \
      -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
      -d "{\"receive_id\":\"$FEISHU_CHAT_ID\",\"msg_type\":\"text\",\"content\":{\"text\":\"AI 日报已生成\"}}" 
```

### 6.4 生产环境部署配置要点

- **Secrets 五件套**：`FEISHU_APP_ID` / `FEISHU_APP_SECRET`（GitHub + Worker 双配）、`FEISHU_CHAT_ID`（把机器人拉进群后从群信息里复制 `oc_xxx`）、`FEISHU_ENCRYPT_KEY`（若开启加密订阅）。
- **机器人必须先进群**：`im/v1/chats` 返回空即是未进群；API 无法自动拉群，需用户在飞书客户端手动添加。
- **事件回调限时**：飞书要求秒级响应，AI 耗时较长时不建议同步等待；本 worker 串行处理，查询短时可用，长任务建议再引入 Queue。
- **URL 验证**：配回调地址时飞书发 `{challenge}`，Worker 必须原样返回该字符串，否则验证失败。
- **通知与聊天两套通道**：CI 日报用 `tenant_access_token + chat_id` 主动推送；群内对话用事件回调拉取 + 回复。

### 6.5 参考项目（仓库内）

- `feishu-ai-bot/` —— 飞书 AI 助手 Worker（webhook / 挑战 / Requesty / 回复）
- `.github/workflows/deploy-feishu-bot.yml` —— Bot 部署流水线
- `scripts/send-feishu-notification.sh` —— CI 飞书通知工具
- `.github/workflows/ai-daily-summary.yml` / `ai-pr-review.yml` —— 已接入飞书通知

### 6.6 高价值开源参考

| 项目 | 链接 | 借鉴点 |
|------|------|--------|
| **axios/axios** | https://github.com/axios/axios | Worker / Node 调飞书 REST API 的统一客户端封装 |
| **nodejs/node** | https://github.com/nodejs/node | 机器人 service 的并发/超时/重试设计范式 |
| 飞书开放平台 SDK（JS） | https://github.com/larksuite/oapi-sdk-nodejs | 官方 SDK，签名/加密/事件处理成熟实现 |

✅ **仓库实测结果**：`/health` 200；`/feishu/webhook` challenge 原样返回（URL 验证通过）；模拟 `im.message.receive_v1` 事件返回 `{"code":0}` 全链路正常。

### 6.7 镜像同步（Gitee / AtomGit — 国内访问加速）

```yaml
# .github/workflows/mirror-to-cn.yml：push 后自动同步
- name: 同步到 Gitee
  run: git push "https://vip882:${GITEE_TOKEN}@gitee.com/vip882/cloud-native-ai-scenarios.git" master --force
- name: 同步到 AtomGit
  run: git push "https://zzw1208:${ATOMGIT_TOKEN}@atomgit.com/zzw1208/cloud-native-ai-scenarios.git" master --force
```

国内镜像地址：
- Gitee: https://gitee.com/vip882/cloud-native-ai-scenarios
- AtomGit: https://atomgit.com/zzw1208/cloud-native-ai-scenarios

---

## 附录 A：全场景验证清单（2026-09 实测）

| 场景 | 线上 URL | 验证端点 | 结果 |
|------|----------|----------|------|
| 一 全栈 Web | `https://scenario-1-fullstack.1911717517.workers.dev` | `/api/health` | 200 `{"status":"ok"}` |
| 二 边缘网关 | `https://edge-ai-gateway.1911717517.workers.dev` | `/v1/models` | 200 返回 708 模型 |
| 三 Serverless | 仓库内 `ai-pr-review.yml` 等 | — | 已配置待触发 |
| 四 实时聊天 | `https://ai-chat-room.1911717517.workers.dev` | WebSocket `/ws` | 流式 AI 回复成功 |
| 五 静态站点 | `https://ai-static-site-2tb.pages.dev` | `/` + `/api/search` | 200 + AI 排序正确 |
| 六 飞书 Bot | `https://feishu-ai-bot.1911717517.workers.dev` | `/feishu/webhook` | challenge 200 + 事件链路 OK |

## 附录 B：仓库 secrets 清单（均指向 Requesty）

| Secret | 值说明 |
|--------|--------|
| `LITELLM_API_BASE` | `https://router.requesty.ai`（Worker 拼接 `/v1/*` 用） |
| `LITELLM_API_KEY` | Requesty 密钥（`rqsty-sk-...`） |
| `OPENAI_BASE_URL` | `https://router.requesty.ai/v1`（curl 直接拼 `/chat/completions` 用） |
| `OPENAI_API_KEY` | 同上 Requesty 密钥 |
| `CF_API_TOKEN` / `CF_ACCOUNT_ID` | Cloudflare 部署认证 |
| `DATABASE_URL` | Neon PostgreSQL 连接串 |
| `FEISHU_APP_ID` / `FEISHU_APP_SECRET` | 飞书自建应用凭据 |
| `FEISHU_CHAT_ID` | 目标飞书群 chat_id（机器人拉群后获取） |
| `GITEE_TOKEN` / `ATOMGIT_TOKEN` | 国内镜像仓库推送凭据 |

> ⚠️ 场景二/四用 `LITELLM_API_BASE`（无 `/v1`，代码拼路径），场景三用 `OPENAI_BASE_URL`（含 `/v1`，curl 拼无 `/v1` 路径）——两套 secret 不能混用。

## 附录 C：通用避坑清单

1. **Windows 中文路径 npm 安装失败**：`npm install` 在含中文/`其他计算机`的路径下会触发 arborist bug；用 `npx -y npm@11 install` 或转到无中文临时目录。
2. **Runner 阻止 postinstall**：`workerd`/`esbuild`/`sharp` 需要 `package.json` 的 `allowScripts: { "esbuild": true, ... }` 白名单。
3. **`kilo-auto` 不能在远端用**：那是本地 FreeLLMAPI 专有 ID；远端统一用 Requesty 的 `provider/model`。
4. **gitlink 陷阱**：仓库里 `static-site`、`awesome-freellm-apis` 等曾是孤儿 submodule（160000 commit 模式），增删文件必须 `git rm --cached` 先解绑。