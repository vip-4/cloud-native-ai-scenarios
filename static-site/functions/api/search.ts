interface Env {
  LITELLM_API_KEY: string;
  LITELLM_API_BASE: string;
}

interface DocPage {
  id: string;
  title: string;
  summary: string;
  keywords: string[];
}

const DOCS: DocPage[] = [
  {
    id: 'websocket-chat',
    title: 'WebSocket 实时聊天搭建',
    summary: '使用 Cloudflare Durable Objects 构建多用户 AI 聊天房间，支持 WebSocket 持久连接、SSE 流式回复与消息持久化。',
    keywords: ['websocket', 'durable objects', '实时聊天', 'SSE', '流式', '房间'],
  },
  {
    id: 'edge-gateway',
    title: '边缘 AI 网关部署',
    summary: '在全球边缘部署 OpenAI 兼容网关，统一代理 Requesty 等上游模型，内置限流、CORS 与健康检查。',
    keywords: ['edge', 'gateway', '网关', '限流', 'cors', '请求路由', '代理'],
  },
  {
    id: 'pr-review',
    title: 'Serverless PR 自动审查',
    summary: '结合 GitHub Actions 与 AI 能力，在每次 Pull Request 时自动生成代码审查意见，提升团队代码质量。',
    keywords: ['github actions', 'pr', 'review', '代码审查', 'serverless', '自动化'],
  },
  {
    id: 'durable-objects',
    title: 'Durable Objects 入门',
    summary: '理解 Cloudflare Durable Objects 的存储、状态与 WebSocket 语义，掌握有状态边缘计算的核心概念。',
    keywords: ['durable objects', '状态', '存储', '边缘计算', 'websocket', 'kv'],
  },
  {
    id: 'neon-db',
    title: 'Neon 数据库集成',
    summary: '在 Cloudflare 环境中使用 Neon Serverless PostgreSQL 持久化业务数据，享受自动暂停与连接池能力。',
    keywords: ['neon', 'postgresql', '数据库', 'pgvector', 'serverless', '连接池'],
  },
  {
    id: 'pages-cdn',
    title: 'Cloudflare Pages 全球加速',
    summary: '将静态站点部署到 Cloudflare Pages 全球 CDN，浏览器访问与 Pages Functions 计算都更快。',
    keywords: ['pages', 'cdn', '静态站点', '全球加速', '部署'],
  },
  {
    id: 'requesty-gateway',
    title: 'Requesty 统一模型网关',
    summary: '通过一个 API Key 访问数百个开源与商业大模型，统一 OpenAI 兼容格式，按量计费。',
    keywords: ['requesty', '模型', 'api', 'llm', 'router', 'openai 兼容'],
  },
  {
    id: 'ci-cd',
    title: 'GitHub Actions CI/CD',
    summary: '从推送到自动部署的完整流水线：类型检查、构建、Cloudflare 部署与生产健康检查。',
    keywords: ['github actions', 'ci', 'cd', 'workflow', '自动部署'],
  },
];

function pickDocs(needle: string, haystack: DocPage[]): DocPage[] {
  const q = needle.toLowerCase();
  const scored = haystack
    .map((d) => {
      let score = 0;
      const text = (d.title + ' ' + d.summary + ' ' + d.keywords.join(' ')).toLowerCase();
      for (const kw of d.keywords) {
        if (q.includes(kw.toLowerCase()) || text.includes(q)) score += 1;
      }
      if (text.split(' ').some((w) => q.split(' ').includes(w))) score += 0.5;
      return { doc: d, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, 6).map((s) => s.doc);
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = (await request.json().catch(() => ({}))) as { query?: string };
    const query = (body.query || '').trim();

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Missing query' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!env.LITELLM_API_KEY || !env.LITELLM_API_BASE) {
      return new Response(
        JSON.stringify({ error: 'Server not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const candidates = pickDocs(query, DOCS);

    const catalog = candidates.map((d) => `- id: ${d.id}\n  title: ${d.title}\n  summary: ${d.summary}`).join('\n');

    const aiResponse = await fetch(`${env.LITELLM_API_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.LITELLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'mistral/leanstral-1-5',
        messages: [
          {
            role: 'system',
            content:
              'You are a document search ranker. Given a user query and a list of candidate documents, ' +
              'return the most relevant documents as JSON ONLY. Output format: ' +
              '{"results":[{"id":"...","score":0.0}]}. Score is a number between 0 and 1 representing relevance. ' +
              'Return 3 to 5 results sorted by relevance descending.',
          },
          {
            role: 'user',
            content: `User query: "${query}"\n\nCandidate documents:\n${catalog}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 600,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text().catch(() => '');
      return new Response(
        JSON.stringify({ error: `AI service error (${aiResponse.status})` }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const aiData = (await aiResponse.json()) as any;
    let ranked: { id: string; score: number }[] = [];

    const content = aiData?.choices?.[0]?.message?.content || '';
    const jsonStr = content.replace(/```json|```/g, '').trim();
    const start = jsonStr.indexOf('{');
    const end = jsonStr.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      try {
        const parsed = JSON.parse(jsonStr.slice(start, end + 1));
        ranked = parsed.results || [];
      } catch {
        ranked = [];
      }
    }

    if (ranked.length === 0) {
      ranked = candidates.slice(0, 3).map((d) => ({ id: d.id, score: 1 }));
    }

    const byId = new Map(DOCS.map((d) => [d.id, d]));
    const results = ranked
      .map((r) => {
        const doc = byId.get(r.id);
        if (!doc) return null;
        return { id: doc.id, title: doc.title, summary: doc.summary, url: '/#docs', score: Math.min(1, Math.max(0, r.score || 0.5)) };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .slice(0, 5);

    return new Response(
      JSON.stringify({ query, model: aiData?.model || 'mistral/leanstral-1-5', results }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};