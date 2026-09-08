export interface Env {
  LITELLM_API_KEY: string;
  LITELLM_API_BASE: string;
  FEISHU_APP_ID: string;
  FEISHU_APP_SECRET: string;
  // 飞书事件订阅的 Encrypt Key（可选，开启加密时填写）
  FEISHU_ENCRYPT_KEY?: string;
}

const FEISHU_API = 'https://open.feishu.cn/open-apis';

interface FeishuWebhookBody {
  challenge?: string;
  token?: string;
  type?: string;
  schema?: string;
  header?: {
    event_id: string;
    event_type: string;
    token: string;
    create_time: string;
  };
  event?: {
    message?: {
      message_id: string;
      message_type: string;
      content: string;
      chat_id: string;
      create_time: string;
    };
    sender?: {
      sender_id?: {
        open_id: string;
      };
    };
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname === '/feishu/webhook' && request.method === 'POST') {
      return handleFeishuEvent(request, env);
    }

    return new Response('Feishu AI Bot - webhook at /feishu/webhook', { status: 200 });
  },
};

async function handleFeishuEvent(request: Request, env: Env): Promise<Response> {
  try {
    // 飞书事件订阅可能做 URL 验证：challenge 请求需原样返回
    const contentType = request.headers.get('content-type') || '';
    const rawBody = await request.text();
    let body: FeishuWebhookBody;

    try {
      body = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ message: 'invalid json' }), { status: 400 });
    }

    // URL 验证（首次配置事件订阅时飞书会发送 challenge）
    if (body.challenge) {
      return new Response(body.challenge, {
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    const eventType = body.header?.event_type || body.type || '';
    const event = body.event;

    const message = event?.message;
    const senderId = event?.sender?.sender_id?.open_id;

    console.log('event_type:', eventType, 'msg_type:', message?.message_type);

    // 消息事件
    if (eventType === 'im.message.receive_v1' && message && senderId) {
      // 只处理文本消息
      if (message.message_type === 'text') {
        let text = '';
        try {
          const parsed = JSON.parse(message.content);
          text = parsed.text || '';
        } catch {
          text = message.content;
        }

        // 去除 @ 提及占位
        const cleaned = text.replace(/<at[^>]*>.*?<\/at>/g, '').replace(/@_user_\d+\s*/g, '').trim();

        // 移除"AI&nbsp;"或"AI "前缀（机器人名）
        const userQuery = cleaned.replace(/^AI\s*/i, '').trim();

        if (userQuery) {
          // 后台异步生成回复（不阻塞事件回执）
          env = env; // keep
          request; // keep
          // 注意：事件回调必须在默认限时内返回，AI 耗时较长时需异步。
          // Cloudflare Workers 无法直接后置任务，这里串行处理并尽量紧凑。
          const replyText = await generateAIReply(userQuery, env);
          await sendFeishuMessage(env, message.chat_id, replyText);
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

async function sendFeishuMessage(env: Env, chatId: string, text: string): Promise<void> {
  // 同一 key 可能被重复获取；Worker 单次运行不需要缓存
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