# Edge AI Gateway (场景二：边缘计算服务)

Cloudflare Workers 边缘 AI API 网关，提供统一的模型路由、限流和 CORS 支持。

## 架构

```
Client → Cloudflare Worker (Edge) → LiteLLM Proxy → AI Providers
```

## 快速启动

### 1. 本地 LiteLLM Proxy (Docker)

```bash
# 设置环境变量
set OPENAI_API_KEY=your-openai-key
set GROQ_API_KEY=your-groq-key
set GOOGLE_API_KEY=your-google-key

# 启动 LiteLLM
docker-compose up -d

# 验证
curl http://localhost:4000/v1/models
```

### 2. 部署 Cloudflare Worker

```bash
# 安装依赖
npm install

# 本地开发
npm run dev

# 部署到生产环境
npm run deploy

# 查看日志
npm run tail
```

### 3. 设置 Secrets

```bash
# 设置 LiteLLM API Key
wrangler secret put LITELLM_API_KEY

# 设置 LiteLLM API Base URL
wrangler secret put LITELLM_API_BASE
```

## 配置说明

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| LITELLM_API_KEY | LiteLLM Proxy 的 master key | - |
| LITELLM_API_BASE | LiteLLM Proxy 地址 | http://localhost:4000 |
| ALLOWED_ORIGINS | CORS 允许的来源 | * |
| RATE_LIMIT_MAX | 每分钟最大请求数 | 100 |
| RATE_LIMIT_WINDOW | 限流窗口（秒） | 60 |

## 功能特性

- ✅ 边缘路由：全球 300+ 边缘节点
- ✅ 自动故障转移：多模型 fallback
- ✅ 限流保护：IP 级别限流
- ✅ CORS 支持：跨域请求处理
- ✅ 健康检查：`/health` 端点
- ✅ 模型列表：`/v1/models` 端点

## 生产环境配置

### Cloudflare Worker 生产部署

```bash
# 使用生产环境部署
wrangler deploy --env production

# 绑定自定义域名
# 在 wrangler.toml 中配置 route:
# route = { pattern = "api.your-domain.com/*", zone_name = "your-domain.com" }
```

### 监控与日志

```bash
# 实时日志
wrangler tail

# 查看请求统计
# Cloudflare Dashboard → Workers → edge-ai-gateway → Metrics
```

## 参考仓库

| 组件 | 仓库 |
|------|------|
| LiteLLM Proxy | https://github.com/BerriAI/litellm |
| Cloudflare Workers AI | https://github.com/cloudflare/ai-workers |
| Docker Compose | https://github.com/BerriAI/litellm/blob/main/docker-compose.yml |

## 故障排查

### Worker 返回 502
- 检查 LiteLLM Proxy 是否运行
- 验证 LITELLM_API_BASE 配置
- 查看 Worker 日志：`wrangler tail`

### 限流问题
- 调整 RATE_LIMIT_MAX
- 使用专用 API Key 绕过限制
- 配置 KV 命名空间用于分布式限流

### CORS 错误
- 检查 ALLOWED_ORIGINS 配置
- 验证请求头是否包含 Origin
