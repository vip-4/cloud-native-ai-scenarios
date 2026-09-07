# ai-chat 部署指南

## 本地开发

```powershell
cd C:\Users\Administrator\Desktop\001\ai-chat
pnpm dev
```

访问 http://localhost:3000

## 环境变量

### 本地开发 (.env.local)
```env
DATABASE_URL=postgresql://neondb_owner:npg_rWOvA5QU9pFe@ep-square-boat-auqrsoiu-pooler.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
OPENAI_BASE_URL=http://localhost:3001/v1
OPENAI_API_KEY=freellmapi-89a2cae15297e3084396ce15673295ecd58d48e583a8bee3
OPENCLAW_GATEWAY_TOKEN=your-openclaw-gateway-token-here
AUTH_SECRET=your-auth-secret-here-generate-with-openssl-rand-base64-32
```

### 生产环境
```env
DATABASE_URL=<your-neon-database-url>
OPENAI_BASE_URL=<your-freellmapi-url>
OPENAI_API_KEY=<your-freellmapi-key>
OPENCLAW_GATEWAY_TOKEN=<your-openclaw-gateway-token>
AUTH_SECRET=<generated-with-openssl-rand-base64-32>
```

生成 AUTH_SECRET:
```bash
openssl rand -base64 32
```

## Vercel 部署

### 步骤 1: 推送代码到 GitHub
```bash
cd C:\Users\Administrator\Desktop\001\ai-chat
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-username/ai-chat.git
git push -u origin main
```

### 步骤 2: 连接 Vercel
1. 访问 https://vercel.com/new
2. 导入 GitHub 仓库
3. 配置环境变量（在 Vercel Dashboard 中设置）
4. 点击 Deploy

### 步骤 3: 配置 Vercel 环境变量
在 Vercel Dashboard → Settings → Environment Variables 中添加：
- `DATABASE_URL`
- `OPENAI_BASE_URL`
- `OPENAI_API_KEY`
- `OPENCLAW_GATEWAY_TOKEN`
- `AUTH_SECRET`

## Cloudflare Pages 部署

### 步骤 1: 构建项目
```powershell
cd C:\Users\Administrator\Desktop\001\ai-chat
pnpm build
```

### 步骤 2: 部署到 Cloudflare Pages
1. 访问 https://dash.cloudflare.com/pages
2. 创建新项目 → 连接 Git
3. 选择仓库和分支
4. 构建配置：
   - 构建命令：`pnpm build`
   - 输出目录：`.next`
   - 环境变量：在 Cloudflare Pages 设置中添加
5. 点击 Deploy

### 步骤 3: 配置 Cloudflare Pages 环境变量
在 Cloudflare Pages → Settings → Environment Variables 中添加：
- `DATABASE_URL`
- `OPENAI_BASE_URL`
- `OPENAI_API_KEY`
- `OPENCLAW_GATEWAY_TOKEN`
- `AUTH_SECRET`

## 数据库迁移

### 本地迁移
```powershell
cd C:\Users\Administrator\Desktop\001\ai-chat
pnpm drizzle-kit migrate
```

### 生产环境迁移
```powershell
# 设置生产环境变量
$env:DATABASE_URL="<production-database-url>"
pnpm drizzle-kit migrate
```

## 用户管理

### 创建测试用户
```powershell
cd C:\Users\Administrator\Desktop\001\ai-chat
node -e "
const bcrypt = require('bcryptjs');
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);

async function createUser() {
  const hashedPassword = await bcrypt.hash('password123', 10);
  await sql\`
    INSERT INTO users (email, name, password)
    VALUES ('test@example.com', 'Test User', \${hashedPassword})
    ON CONFLICT (email) DO NOTHING
  \`;
  console.log('User created: test@example.com / password123');
  await sql.end();
}

createUser();
"
```

## 多用户 Chat 隔离

- 每个 Chat 关联到 `user_id`
- 用户只能看到自己的 Chat 列表
- API 路由通过 NextAuth session 验证用户身份
- 数据库外键约束确保数据完整性

## Hermes Agent / OpenClaw 集成

### 本地 Gateway 要求
- Hermes Agent Gateway: 运行在本地
- OpenClaw Gateway: 运行在 http://localhost:18789
- FreeLLMAPI: 运行在 http://localhost:3001

### 生产环境注意事项
- 当前 Hermes/OpenClaw 集成仅支持本地 Gateway
- 生产环境需要将 Gateway 部署到独立服务器或容器
- 建议使用 Docker Compose 编排：
  ```yaml
  services:
    freellmapi:
      build: ./freellmapi
      ports:
        - "3001:3001"
    hermes:
      build: ./hermes-agent
      ports:
        - "18789:18789"
    openclaw:
      build: ./openclaw
      ports:
        - "18790:18789"
  ```

## 故障排查

### 数据库连接错误
- 检查 Neon 数据库状态
- 确认 DATABASE_URL 正确
- 运行 `pnpm drizzle-kit migrate` 同步 schema

### AI 模型调用失败
- 确认 FreeLLMAPI 运行在 http://localhost:3001
- 检查 API Key 是否正确
- 查看 FreeLLMAPI Dashboard 模型状态

### Hermes/OpenClaw 连接失败
- 确认 Gateway 正在运行
- 检查 OPENCLAW_GATEWAY_TOKEN 是否正确
- 查看 Gateway 日志：`C:\Users\Administrator\AppData\Local\Temp\openclaw\`
