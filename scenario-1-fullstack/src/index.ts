import { Hono } from "hono";
import { cors } from "hono/cors";
import { db } from "./lib/db";
import { users, posts, comments, categories, postCategories, tags, postTags } from "./lib/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";

type Bindings = {
  DATABASE_URL: string;
  CLOUDFLARE_API_TOKEN?: string;
  [key: string]: unknown;
};

type Variables = {
  userId?: number;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// 全局 CORS 配置
app.use("/api/*", cors({
  origin: ["https://yourdomain.com", "https://*.pages.dev"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
}));

// ==================== 健康检查 ====================
app.get("/api/health", async (c) => {
  try {
    // 简单查询验证数据库连接
    const result = await db.select({ value: sql`1` }).limit(1);
    return c.json({
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString(),
      version: "v1.0.0",
    });
  } catch (error) {
    return c.json(
      { status: "error", database: "disconnected", error: (error as Error).message },
      503
    );
  }
});

// ==================== 用户 API ====================
app.get("/api/users", async (c) => {
  try {
    const allUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    return c.json({ data: allUsers, count: allUsers.length });
  } catch (error) {
    return c.json({ error: "查询用户失败", details: (error as Error).message }, 500);
  }
});

app.post("/api/users", async (c) => {
  try {
    const body = await c.req.json();
    if (!body.name || !body.email) {
      return c.json({ error: "name 和 email 为必填项" }, 400);
    }

    const newUser = await db
      .insert(users)
      .values({
        name: body.name,
        email: body.email,
        passwordHash: body.passwordHash || null,
        avatarUrl: body.avatarUrl || null,
      })
      .returning({ id: users.id, name: users.name, email: users.email });

    return c.json({ data: newUser[0] }, 201);
  } catch (error) {
    return c.json({ error: "创建用户失败", details: (error as Error).message }, 400);
  }
});

app.get("/api/users/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "无效的用户 ID" }, 400);

  const user = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      avatarUrl: users.avatarUrl,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, id));

  if (!user.length) return c.json({ error: "用户不存在" }, 404);
  return c.json({ data: user[0] });
});

app.put("/api/users/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "无效的用户 ID" }, 400);

  const body = await c.req.json();
  const updated = await db
    .update(users)
    .set({
      name: body.name,
      avatarUrl: body.avatarUrl,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning({ id: users.id, name: users.name, email: users.email });

  if (!updated.length) return c.json({ error: "用户不存在" }, 404);
  return c.json({ data: updated[0] });
});

app.delete("/api/users/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "无效的用户 ID" }, 400);

  const deleted = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });

  if (!deleted.length) return c.json({ error: "用户不存在" }, 404);
  return c.json({ message: "用户已删除", data: deleted[0] });
});

// ==================== 文章 API ====================
app.get("/api/posts", async (c) => {
  try {
    const page = parseInt(c.req.query("page") || "1");
    const limit = parseInt(c.req.query("limit") || "10");
    const offset = (page - 1) * limit;

    const allPosts = await db
      .select({
        id: posts.id,
        title: posts.title,
        slug: posts.slug,
        excerpt: posts.excerpt,
        coverImage: posts.coverImage,
        status: posts.status,
        publishedAt: posts.publishedAt,
        author: users.name,
      })
      .from(posts)
      .innerJoin(users, eq(posts.userId, users.id))
      .where(eq(posts.status, "published"))
      .orderBy(desc(posts.publishedAt))
      .limit(limit)
      .offset(offset);

    return c.json({ data: allPosts, page, limit, count: allPosts.length });
  } catch (error) {
    return c.json({ error: "查询文章失败", details: (error as Error).message }, 500);
  }
});

app.post("/api/posts", async (c) => {
  try {
    const body = await c.req.json();
    if (!body.title || !body.content) {
      return c.json({ error: "title 和 content 为必填项" }, 400);
    }

    const newPost = await db
      .insert(posts)
      .values({
        userId: body.userId || 1,
        title: body.title,
        slug: body.slug || body.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        excerpt: body.excerpt || null,
        content: body.content,
        coverImage: body.coverImage || null,
        status: body.status || "draft",
        publishedAt: body.status === "published" ? new Date() : null,
      })
      .returning({ id: posts.id, title: posts.title, slug: posts.slug });

    return c.json({ data: newPost[0] }, 201);
  } catch (error) {
    return c.json({ error: "创建文章失败", details: (error as Error).message }, 400);
  }
});

app.get("/api/posts/:slug", async (c) => {
  const slug = c.req.param("slug");

  const post = await db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      excerpt: posts.excerpt,
      content: posts.content,
      coverImage: posts.coverImage,
      publishedAt: posts.publishedAt,
      author: users.name,
      authorId: users.id,
    })
    .from(posts)
    .innerJoin(users, eq(posts.userId, users.id))
    .where(and(eq(posts.slug, slug), eq(posts.status, "published")));

  if (!post.length) return c.json({ error: "文章不存在" }, 404);

  // 统计浏览量（简单实现，实际应用中建议使用 KV/Queue 异步处理）
  const commentsList = await db
    .select({
      id: comments.id,
      content: comments.content,
      createdAt: comments.createdAt,
      author: users.name,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.postId, post[0].id))
    .orderBy(desc(comments.createdAt));

  return c.json({ data: { ...post[0], comments: commentsList } });
});

app.put("/api/posts/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "无效的文章 ID" }, 400);

  const body = await c.req.json();
  const updated = await db
    .update(posts)
    .set({
      title: body.title,
      slug: body.slug,
      excerpt: body.excerpt,
      content: body.content,
      coverImage: body.coverImage,
      status: body.status,
      publishedAt: body.status === "published" ? new Date() : body.publishedAt,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, id))
    .returning({ id: posts.id, title: posts.title, slug: posts.slug });

  if (!updated.length) return c.json({ error: "文章不存在" }, 404);
  return c.json({ data: updated[0] });
});

app.delete("/api/posts/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "无效的文章 ID" }, 400);

  const deleted = await db.delete(posts).where(eq(posts.id, id)).returning({ id: posts.id });
  if (!deleted.length) return c.json({ error: "文章不存在" }, 404);
  return c.json({ message: "文章已删除", data: deleted[0] });
});

// ==================== 评论 API ====================
app.get("/api/posts/:postId/comments", async (c) => {
  const postId = parseInt(c.req.param("postId"));
  if (isNaN(postId)) return c.json({ error: "无效的文章 ID" }, 400);

  const allComments = await db
    .select({
      id: comments.id,
      content: comments.content,
      createdAt: comments.createdAt,
      author: users.name,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.postId, postId))
    .orderBy(desc(comments.createdAt));

  return c.json({ data: allComments, count: allComments.length });
});

app.post("/api/posts/:postId/comments", async (c) => {
  try {
    const postId = parseInt(c.req.param("postId"));
    if (isNaN(postId)) return c.json({ error: "无效的文章 ID" }, 400);

    const body = await c.req.json();
    if (!body.content) return c.json({ error: "评论内容不能为空" }, 400);

    const newComment = await db
      .insert(comments)
      .values({
        postId,
        userId: body.userId || 1,
        content: body.content,
      })
      .returning({ id: comments.id, content: comments.content, createdAt: comments.createdAt });

    return c.json({ data: newComment[0] }, 201);
  } catch (error) {
    return c.json({ error: "发表评论失败", details: (error as Error).message }, 400);
  }
});

// ==================== 分类 API ====================
app.get("/api/categories", async (c) => {
  const allCategories = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
    })
    .from(categories)
    .orderBy(categories.name);

  return c.json({ data: allCategories });
});

app.post("/api/categories", async (c) => {
  try {
    const body = await c.req.json();
    if (!body.name) return c.json({ error: "分类名称不能为空" }, 400);

    const newCategory = await db
      .insert(categories)
      .values({
        name: body.name,
        slug: body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        description: body.description || null,
      })
      .returning({ id: categories.id, name: categories.name, slug: categories.slug });

    return c.json({ data: newCategory[0] }, 201);
  } catch (error) {
    return c.json({ error: "创建分类失败", details: (error as Error).message }, 400);
  }
});

// ==================== 标签 API ====================
app.get("/api/tags", async (c) => {
  const allTags = await db.select().from(tags).orderBy(tags.name);
  return c.json({ data: allTags });
});

app.post("/api/tags", async (c) => {
  try {
    const body = await c.req.json();
    if (!body.name) return c.json({ error: "标签名称不能为空" }, 400);

    // 检查是否已存在
    const existing = await db.select().from(tags).where(eq(tags.name, body.name));
    if (existing.length) return c.json({ data: existing[0] });

    const newTag = await db
      .insert(tags)
      .values({ name: body.name })
      .returning({ id: tags.id, name: tags.name });

    return c.json({ data: newTag[0] }, 201);
  } catch (error) {
    return c.json({ error: "创建标签失败", details: (error as Error).message }, 400);
  }
});

// ==================== 数据统计 API ====================
app.get("/api/stats", async (c) => {
  const [userCount, postCount, commentCount, categoryCount] = await Promise.all([
    db.select({ count: sql`count(*)` }).from(users),
    db.select({ count: sql`count(*)` }).from(posts),
    db.select({ count: sql`count(*)` }).from(comments),
    db.select({ count: sql`count(*)` }).from(categories),
  ]);

  return c.json({
    data: {
      users: Number(userCount[0].count),
      posts: Number(postCount[0].count),
      comments: Number(commentCount[0].count),
      categories: Number(categoryCount[0].count),
    },
  });
});

// ==================== 首页演示页面 ====================
app.get("/", (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>全栈 Web 应用 - Workers + Hono + Neon + Drizzle</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f0f2f5; color: #333; min-height: 100vh; }
        .container { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
        h1 { text-align: center; font-size: 2rem; margin-bottom: 8px; background: linear-gradient(135deg, #f6821f, #f0943d); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .subtitle { text-align: center; color: #666; margin-bottom: 32px; }
        .card { background: #fff; border-radius: 12px; padding: 24px; margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
        .card h3 { margin-bottom: 12px; font-size: 1.1rem; color: #1a1a1a; }
        .card p { color: #555; line-height: 1.6; margin-bottom: 8px; }
        .badge { display: inline-block; padding: 4px 12px; background: #fef3e7; color: #f6821f; border-radius: 999px; font-size: 12px; font-weight: 600; margin-right: 8px; }
        .endpoint { background: #1e293b; color: #e2e8f0; padding: 8px 12px; border-radius: 6px; font-family: 'Cascadia Code', monospace; font-size: 13px; margin-top: 8px; display: block; }
        .status { text-align: center; margin-top: 24px; }
        .status .dot { display: inline-block; width: 10px; height: 10px; background: #22c55e; border-radius: 50%; margin-right: 8px; animation: pulse 2s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .status a { color: #f6821f; text-decoration: none; margin-left: 8px; }
        .row { display: flex; gap: 12px; flex-wrap: wrap; }
        .row .card { flex: 1; min-width: 200px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 全栈 Web 应用</h1>
        <p class="subtitle">Cloudflare Workers + Hono + Neon Postgres + Drizzle ORM</p>

        <div class="row">
          <div class="card">
            <h3>📍 技术栈</h3>
            <span class="badge">Hono</span>
            <span class="badge">Drizzle</span>
            <span class="badge">Neon</span>
            <span class="badge">Workers</span>
            <span class="badge">TypeScript</span>
          </div>
          <div class="card">
            <h3>📊 部署状态</h3>
            <div class="status">
              <span class="dot"></span>
              <span id="status-text">API 服务运行中</span>
              <a href="/api/stats" target="_blank">查看统计 →</a>
            </div>
          </div>
        </div>

        <div class="card">
          <h3>🔌 可用 API 端点</h3>
          <p>以下端点已内置完整 CRUD 操作：</p>
          <span class="endpoint">GET    /api/health          → 健康检查</span>
          <span class="endpoint">GET    /api/users           → 查询所有用户</span>
          <span class="endpoint">POST   /api/users           → 创建用户</span>
          <span class="endpoint">GET    /api/posts           → 查询文章（分页）</span>
          <span class="endpoint">POST   /api/posts           → 创建文章</span>
          <span class="endpoint">GET    /api/posts/:slug     → 文章详情 + 评论</span>
          <span class="endpoint">GET    /api/categories      → 分类列表</span>
          <span class="endpoint">GET    /api/tags            → 标签列表</span>
          <span class="endpoint">GET    /api/stats           → 数据统计</span>
        </div>

        <div class="card">
          <h3>🚀 快速开始</h3>
          <p>1. 配置 Neon DATABASE_URL 环境变量</p>
          <p>2. 运行 <code>npm run migrate</code> 创建数据库表</p>
          <p>3. 运行 <code>npm run dev</code> 本地开发</p>
          <p>4. 推送至 GitHub 自动触发 CI/CD 部署</p>
        </div>
      </div>
    </body>
    </html>
  `);
});

// 404 处理
app.notFound((c) => c.json({ error: "404 - 接口不存在" }, 404));

// 全局错误处理
app.onError((err, c) => {
  console.error("Worker Error:", err.message);
  return c.json({ error: "服务器内部错误", details: err.message }, 500);
});

export default app;