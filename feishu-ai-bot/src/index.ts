export interface Env {
  LITELLM_API_KEY: string;
  LITELLM_API_BASE: string;
  FEISHU_APP_ID: string;
  FEISHU_APP_SECRET: string;
  FEISHU_CHAT_ID: string;
  FEISHU_ENCRYPT_KEY?: string;
  FEISHU_KV: KVNamespace;
}

const FEISHU_API = 'https://open.feishu.cn/open-apis';

// 主动轮询架构：无需飞书事件订阅。
// cron 每分钟触发 scheduled → 拉取群消息 → 识别 @机器人 文本 → AI 回复
// KV 记录已处理的最大 message_id，避免重复回复。

export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    await pollGroupMessages(env);
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      const kvOk = true;
      return new Response(JSON.stringify({ status: 'ok', kv: kvOk }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname === '/poll' && request.method === 'POST') {
      // 手动触发一次轮询（调试/CI 使用）
      const result = await pollGroupMessages(env);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname === '/feishu/webhook' && request.method === 'POST') {
      // 保留事件订阅入口（若日后启用，无需重建 worker）
      return handleFeishuEvent(request, env);
    }

    return new Response('Feishu AI Bot - polling at /poll, webhook at /feishu/webhook', { status: 200 });
  },
};

// ===== 主动轮询核心 =====

async function pollGroupMessages(env: Env): Promise<any> {
  const chatId = env.FEISHU_CHAT_ID;
  if (!chatId) return { ok: false, error: 'FEISHU_CHAT_ID not configured' };

  const token = await getTenantAccessToken(env);
  const bot = await getBotInfo(token);
  const botOpenId = bot.open_id;
  console.log('bot open_id:', botOpenId, 'chat:', chatId);

  // 1. 读取游标：上次处理到哪条消息
  const cursorKey = `cursor:${chatId}`;
  const cursor = await env.FEISHU_KV.get(cursorKey);
  console.log('cursor:', cursor ? `have(${cursor})` : 'none');

  // 2. 从群拉消息（含消息内容）— 有游标则从游标时间之后
  const params = new URLSearchParams({
    container_id_type: 'chat',
    container_id: chatId,
    sort_type: 'ByCreateTimeAsc',
    page_size: '50',
  });
  if (cursor) params.set('start_time', cursor);
  const resp = await fetch(`${FEISHU_API}/im/v1/messages?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data: any = await resp.json();
  if (data.code !== 0) {
    console.error('list messages failed:', data.code, data.msg);
    return { ok: false, error: data.msg };
  }

  const messages: any[] = data?.data?.items || [];
  console.log('got messages:', messages.length);

  let processed: string[] = [];
  let maxCursor: string = cursor || '';

  // 3. 逐条识别 @机器人 的文本
  for (const msg of messages) {
    const createTime = (msg.create_time || '').toString();
    if (createTime <= maxCursor) continue;
    maxCursor = createTime;

    // 机器人（app）发送的不处理
    if (msg.sender?.sender_type === 'app') continue;

    if (msg.msg_type !== 'text') continue;

    let text = '';
    try {
      // 拉取接口返回的消息体在 body.content（JSON 字符串）；事件订阅为 content
      const rawContent = msg.body?.content ?? msg.content;
      text = JSON.parse(rawContent)?.text || '';
    } catch {
      continue;
    }

    // 是否 @ 了本机器人（飞书群内 @ 会带 <at user_id="bot_open_id">）
    if (!isMentioningBot(text, botOpenId)) {
      console.log('skip (not @bot):', text.slice(0, 30));
      continue;
    }

    // 解析用户查询（去 @ 占位 + AI 前缀）
    const query = cleanup(text, botOpenId);
    if (!query) {
      console.log('skip empty query');
      continue;
    }

    console.log('REPLY to:', query);
    const reply = await generateAIReply(query, env);
    await sendFeishuMessage(env, chatId, reply);
    processed.push(query.slice(0, 40));
  }

  // 4. 保存游标（KV 写入有免费额度限制：仅在有新消息推进时才写；失败降级不崩溃）
  if (maxCursor && maxCursor !== cursor) {
    try {
      await env.FEISHU_KV.put(cursorKey, maxCursor);
    } catch (err) {
      console.error('kv put failed (limit?):', err);
    }
  }

  return { ok: true, bot_open_id: botOpenId, messages_seen: messages.length, replied: processed };
}

function isMentioningBot(text: string, botOpenId: string): boolean {
  if (!text.includes('<at')) return false;
  // 兼容两种存储格式：<at user_id="ou_xxx"> 与 <at user_id=ou_xxx>
  return (
    text.includes(`user_id="${botOpenId}"`) ||
    text.includes(`user_id=${botOpenId}`) ||
    text.includes(botOpenId)
  );
}

function cleanup(text: string, botOpenId: string): string {
  return text
    .replace(/<at[^>]*>.*?<\/at>/g, '')
    .replace(/@_user_\d+\s*/g, '')
    .replace(/^AI\s*/i, '')
    .trim();
}

// ===== 事件订阅入口（保留，备用） =====

interface FeishuWebhookBody {
  challenge?: string;
  schema?: string;
  header?: { event_type: string; token: string; create_time: string };
  event?: {
    message?: {
      message_id: string;
      message_type: string;
      content: string;
      chat_id: string;
    };
    sender?: { sender_id?: { open_id: string } };
  };
}

async function handleFeishuEvent(request: Request, env: Env): Promise<Response> {
  try {
    const rawBody = await request.text();
    let body: FeishuWebhookBody;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ message: 'invalid json' }), { status: 400 });
    }

    if (body.challenge) {
      return new Response(body.challenge, {
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    const eventType = body.header?.event_type || '';
    const message = body.event?.message;
    const senderId = body.event?.sender?.sender_id?.open_id;

    if (eventType === 'im.message.receive_v1' && message && senderId) {
      if (message.message_type === 'text') {
        let text = '';
        try {
          text = JSON.parse(message.content)?.text || '';
        } catch {
          text = message.content;
        }
        const botOpenId = (await getBotInfo(await getTenantAccessToken(env))).open_id;
        const query = cleanup(text, botOpenId);
        if (query) {
          const reply = await generateAIReply(query, env);
          await sendFeishuMessage(env, message.chat_id, reply);
        }
      }
      return new Response(JSON.stringify({ code: 0, message: 'ok' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ code: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('handleFeishuEvent error:', err);
    return new Response(
      JSON.stringify({ code: 500, message: err instanceof Error ? err.message : 'error' }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ===== 共享工具 =====

async function generateAIReply(userQuery: string, env: Env): Promise<string> {
  const response = await fetch(`${env.LITELLM_API_BASE}/v1/chat/completions`, {
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
          content: '你是飞书群里的 AI 助手，回答简洁、专业、友好。使用中文回复。',
        },
        { role: 'user', content: userQuery },
      ],
      temperature: 0.7,
      max_tokens: 800,
    }),
  });

  if (!response.ok) {
    return `⚠️ AI 服务暂时不可用（${response.status}）`;
  }

  const data = (await response.json()) as any;
  return data?.choices?.[0]?.message?.content || '抱歉，我未能生成回复。';
}

async function getTenantAccessToken(env: Env): Promise<string> {
  const response = await fetch(`${FEISHU_API}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      app_id: env.FEISHU_APP_ID,
      app_secret: env.FEISHU_APP_SECRET,
    }),
  });
  const data = (await response.json()) as any;
  if (data.code !== 0) {
    throw new Error(`Feishu auth failed: ${data.msg}`);
  }
  return data.tenant_access_token;
}

async function getBotInfo(token: string): Promise<{ open_id: string }> {
  const response = await fetch(`${FEISHU_API}/bot/v3/info`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await response.json()) as any;
  if (data.code !== 0) {
    throw new Error(`Bot info failed: ${data.msg}`);
  }
  return data.bot as { open_id: string };
}

async function sendFeishuMessage(env: Env, chatId: string, text: string): Promise<void> {
  const token = await getTenantAccessToken(env);
  const response = await fetch(`${FEISHU_API}/im/v1/messages?receive_id_type=chat_id`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      receive_id: chatId,
      msg_type: 'text',
      content: JSON.stringify({ text }),
    }),
  });

  const data = await response.json().catch(() => null);
  console.log('send message:', response.status, JSON.stringify(data)?.slice(0, 300));
}