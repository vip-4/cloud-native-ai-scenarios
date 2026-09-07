# 场景二：边缘计算服务部署完成

## 部署状态

| 组件 | 状态 | 详情 |
|------|------|------|
| Cloudflare Worker | ✅ 已部署 | https://edge-ai-gateway.my-fullstack-app.workers.dev |
| LiteLLM Proxy | ✅ 本地运行 | http://localhost:4000 |
| Worker Secrets | ✅ 已配置 | LITELLM_API_KEY, LITELLM_API_BASE |
| GitHub Actions | ✅ 已配置 | .github/workflows/deploy.yml |
| Worker 代码 | ✅ 已完成 | src/index.ts |

## 验证结果

### 1. Worker Secrets 设置成功
```bash
LITELLM_API_KEY: 已设置
LITELLM_API_BASE: 已设置
```

### 2. 本地 LiteLLM Proxy 运行正常
```bash
# 健康检查
curl http://localhost:4000/health
# 返回: {"healthy_endpoints":[...], "unhealthy_endpoints":[...], "healthy_count":1, "unhealthy_count":5}

# 模型列表
curl http://localhost:4000/v1/models
# 返回: 6 个模型（kilo-auto, llama-3.3-70b, gemma2-9b, gemini-2.0-flash, nemotron-3.5-30b, mistral-nemo）
```

### 3. Cloudflare Worker 健康检查通过
```bash
curl https://edge-ai-gateway.my-fullstack-app.workers.dev/health
# 返回: {"status":"ok","timestamp":1788803995337}
```

## 快速启动

### 本地 LiteLLM Proxy

```bash
# 进入目录
cd G:\其他计算机\我的计算机\001\edge-gateway

# 启动 LiteLLM（已安装 Python 3.11 + LiteLLM）
set PATH=C:\Program Files\Python311;C:\Program Files\Python311\Scripts;%PATH%
litellm --config proxy_server_config.yaml --port 4000 --host 0.0.0.0

# 验证
curl http://localhost:4000/health
curl http://localhost:4000/v1/models
```

### 部署 Cloudflare Worker

```bash
# 已部署，更新时重新部署
cd G:\其他计算机\我的计算机\001\edge-gateway
npx wrangler deploy
```

### 设置 Secrets

```bash
cd G:\其他计算机\我的计算机\001\edge-gateway

# 设置 LiteLLM API Key
echo your-api-key | npx wrangler secret put LITELLM_API_KEY

# 设置 LiteLLM API Base URL
echo http://localhost:4000 | npx wrangler secret put LITELLM_API_BASE
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| LITELLM_API_KEY | LiteLLM Proxy 的 master key | (已通过 wrangler secret 设置) |
| LITELLM_API_BASE | LiteLLM Proxy 地址 | http://localhost:4000 |
| ALLOWED_ORIGINS | CORS 允许的来源 | * |
| RATE_LIMIT_MAX | 每分钟最大请求数 | 100 |
| RATE_LIMIT_WINDOW | 限流窗口（秒） | 60 |

## 使用方式

### 直接调用 Worker

```bash
# 健康检查
curl https://edge-ai-gateway.my-fullstack-app.workers.dev/health

# 获取模型列表
curl https://edge-ai-gateway.my-fullstack-app.workers.dev/v1/models \
  -H "Authorization: Bearer YOUR_LITELLM_KEY"

# 聊天补全
curl https://edge-ai-gateway.my-fullstack-app.workers.dev/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_LITELLM_KEY" \
  -d '{
    "model": "kilo-auto",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### 前端接入

```typescript
const response = await fetch('https://edge-ai-gateway.my-fullstack-app.workers.dev/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${LITELLM_KEY}`,
  },
  body: JSON.stringify({
    model: 'kilo-auto',
    messages: [{ role: 'user', content: 'Hello!' }],
  }),
});
```

## 生产环境配置

### 自定义域名

编辑 `wrangler.toml`:

```toml
[env.production]
route = { pattern = "api.your-domain.com/*", zone_name = "your-domain.com" }
```

### 监控

```bash
# 实时日志
npx wrangler tail

# 查看 Worker 指标
# Cloudflare Dashboard → Workers → edge-ai-gateway → Metrics
```

## 故障排查

| 问题 | 解决方案 |
|------|----------|
| Worker 返回 502 | 检查 LiteLLM Proxy 是否运行，验证 LITELLM_API_BASE |
| 限流问题 | 调整 RATE_LIMIT_MAX 或使用专用 API Key |
| CORS 错误 | 检查 ALLOWED_ORIGINS 配置 |

## 参考仓库

- LiteLLM Proxy: https://github.com/BerriAI/litellm
- Cloudflare Workers AI: https://github.com/cloudflare/ai-workers
- Docker Compose: https://github.com/BerriAI/litellm/blob/main/docker-compose.yml
