# AI Chat Room - 实时交互应用

基于 Cloudflare Durable Objects + WebSocket + LiteLLM 的实时 AI 聊天室。

## 架构

```
Client (WebSocket) → Cloudflare Worker → Durable Objects (AIChatRoom) → LiteLLM Proxy (streaming)
```

## 功能特性

- ✅ 实时 WebSocket 通信
- ✅ AI 流式回复（Server-Sent Events）
- ✅ 多用户房间支持
- ✅ 在线用户计数
- ✅ 消息持久化（Durable Objects SQLite）
- ✅ 自动重连
- ✅ 响应式 UI

## 快速启动

### 1. 启动 LiteLLM Proxy

```bash
# 本地 LiteLLM
litellm --config proxy_server_config.yaml --port 4000
```

### 2. 部署 Cloudflare Worker

```bash
cd G:\其他计算机\我的计算机\001\realtime-app

# 设置 Secrets
npx wrangler secret put LITELLM_API_KEY
npx wrangler secret put LITELLM_API_BASE

# 部署
npx wrangler deploy
```

### 3. 启动前端

```bash
cd frontend
npm install
npm run dev
```

## 部署状态

| 组件 | 状态 | 详情 |
|------|------|------|
| Cloudflare Worker | ✅ 已部署 | https://ai-chat-room.my-fullstack-app.workers.dev |
| Durable Objects | ✅ 已创建 | AIChatRoom |
| Worker Secrets | ✅ 已配置 | LITELLM_API_KEY, LITELLM_API_BASE |
| GitHub Actions | ✅ 已配置 | .github/workflows/deploy.yml |
| Worker 代码 | ✅ 已完成 | src/index.ts |
| 前端代码 | ✅ 已完成 | frontend/src/App.tsx |

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| LITELLM_API_KEY | LiteLLM API Key | - |
| LITELLM_API_BASE | LiteLLM 地址 | http://localhost:4000 |
| ALLOWED_ORIGINS | CORS 允许来源 | * |

## 项目结构

```
realtime-app/
├── src/
│   └── index.ts          # Worker + Durable Objects
├── frontend/
│   ├── src/
│   │   ├── App.tsx       # React 聊天界面
│   │   ├── main.tsx      # 入口
│   │   └── index.css     # Tailwind 样式
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── hermes-config/
│   └── config.yaml       # Hermes Agent 配置
├── wrangler.toml
└── README.md
```

## 生产环境配置

### Cloudflare Workers

```bash
# 部署
npx wrangler deploy --env production

# 查看日志
npx wrangler tail
```

### Cloudflare Pages (前端)

```bash
# 构建前端
cd frontend
npm run build

# 部署到 Cloudflare Pages
npx wrangler pages project create ai-chat-room
npx wrangler pages deploy frontend/dist --project-name ai-chat-room
```

## 参考仓库

| 仓库 | 说明 | 链接 |
|------|------|------|
| Durable Objects Chat | 实时聊天室 | https://github.com/cloudflare/durable-objects-examples/tree/main/chat |
| LiteLLM Streaming | 流式响应 | https://github.com/BerriAI/litellm/tree/main/cookbook/community_examples/openai_basics |
| Cloudflare WebSocket | Workers WebSocket | https://developers.cloudflare.com/workers/runtime-apis/websockets/ |
| Vercel AI SDK | 流式 AI 响应 | https://github.com/vercel/ai |

## License

MIT
