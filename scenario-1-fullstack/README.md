# 场景一：全栈 Web 应用

> **技术栈**: Cloudflare Workers + Hono + Neon Postgres + Drizzle ORM
> **适用业务**: SaaS 产品、内容平台、企业内部工具

## 功能特性

- ✅ 完整的 CRUD API（用户、文章、评论、分类、标签）
- ✅ Neon Postgres serverless 数据库连接
- ✅ Drizzle ORM 类型安全的数据库操作
- ✅ 全局 CORS 配置
- ✅ 错误处理和健康检查
- ✅ GitHub Actions 全自动 CI/CD 部署流水线
- ✅ 内置演示首页（展示可用 API 端点）

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 Neon 数据库

1. 在 [Neon 控制台](https://console.neon.tech) 创建项目
2. 获取 `DATABASE_URL` 连接串
3. 复制配置文件并填入连接串：

```bash
cp .dev.vars.example .dev.vars
# 编辑 .dev.vars 填入 DATABASE_URL
```

### 3. 初始化数据库表

```bash
# 生成迁移文件
npx drizzle-kit generate

# 推送到 Neon 数据库（开发环境）
npm run migrate

# 生产环境（推送到 main 分支）
npm run migrate:production
```

### 4. 本地开发

```bash
npm run dev
# 访问 http://localhost:8787
# 健康检查: http://localhost:8787/api/health
```

### 5. 生产部署

**方式一：GitHub Actions（推荐）**

1. 将代码推送到 GitHub 仓库
2. 配置 GitHub Secrets（见下方）
3. 推送到 `main` 分支自动触发部署

**方式二：手动 CLI 部署**

```bash
npm run deploy
```

## GitHub Secrets 配置

在 GitHub 仓库 `Settings → Secrets and variables → Actions` 中添加：

| Secret | 说明 | 必须 |
|--------|------|------|
| `DATABASE_URL` | Neon Postgres 连接串 | ✅ |
| `CF_API_TOKEN` | Cloudflare API Token（Workers 部署权限） | ✅ |
| `CF_ACCOUNT_ID` | Cloudflare 账户 ID | ✅ |
| `NEON_API_KEY` | Neon API Key（用于分支管理） | ⚠️ 可选 |
| `NEON_PROJECT_ID` | Neon 项目 ID | ⚠️ 可选 |

## API 接口文档

### 用户 API

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/health` | 健康检查 |
| `GET` | `/api/users` | 查询所有用户 |
| `POST` | `/api/users` | 创建用户 |
| `GET` | `/api/users/:id` | 查询单个用户 |
| `PUT` | `/api/users/:id` | 更新用户 |
| `DELETE` | `/api/users/:id` | 删除用户 |

### 文章 API

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/posts` | 查询文章（分页） |
| `POST` | `/api/posts` | 创建文章 |
| `GET` | `/api/posts/:slug` | 文章详情 + 评论 |
| `PUT` | `/api/posts/:id` | 更新文章 |
| `DELETE` | `/api/posts/:id` | 删除文章 |

### 评论 API

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/posts/:postId/comments` | 文章评论列表 |
| `POST` | `/api/posts/:postId/comments` | 发表评论 |

### 分类与标签 API

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET/POST` | `/api/categories` | 分类列表/创建 |
| `GET/POST` | `/api/tags` | 标签列表/创建 |

### 统计 API

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/stats` | 数据统计（用户/文章/评论/分类数） |

## 生产运维

### 监控

- **Workers Observability**: 已在 wrangler.toml 启用
- **日志查看**: `npx wrangler tail`
- **错误追踪**: 可集成 Sentry（需自行配置）

### 性能优化

1. **Hyperdrive 连接池**: 生产推荐启用，降低数据库延迟 50%+
2. **KV 缓存**: 对未来热点数据使用 KV 命名空间缓存
3. **分页查询**: 文章列表已支持分页参数（page/limit）

### 回滚

```bash
# 查看版本历史
npx wrangler versions list

# 回滚到指定版本
npx wrangler versions publish --replace <version-id>
```

### 成本控制

- Workers 免费额度: 10 万请求/天
- Neon 免费额度: 免费层包含 0.5 GB 存储
- Hyperdrive: 按连接池时长计费（可从免费额度开始）

## 参考项目

| 项目 | 链接 |
|------|------|
| Cloudflare 官方模板 | https://github.com/cloudflare/templates |
| Neon + Drizzle + Workers 示例 | https://github.com/neondatabase/cloudflare-drizzle-neon |
| Hono Starter Kit | https://github.com/michaelshimeles/hono-starter-kit |
| Neon Serverless Driver | https://github.com/neondatabase/serverless |

## 项目结构

```
scenario-1-fullstack/
├── .github/workflows/      # GitHub Actions CI/CD
├── drizzle/                # Drizzle 迁移文件
├── src/
│   ├── index.ts            # Worker 入口（Hono 路由）
│   └── lib/db/
│       ├── index.ts        # 数据库连接
│       ├── schema.ts       # Drizzle 表定义
│       └── hyperdrive.ts   # Hyperdrive 连接池工具
├── test/                   # 单元测试
├── .dev.vars.example       # 开发环境变量模板
├── drizzle.config.ts       # Drizzle 配置
├── package.json
├── tsconfig.json
└── wrangler.toml           # Cloudflare Workers 配置
```