export interface Env {
  LITELLM_API_KEY: string;
  LITELLM_API_BASE: string;
  AI_CHAT_ROOM: DurableObjectNamespace;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export class AIChatRoom {
  private sessions: Set<WebSocket> = new Set();
  private state: DurableObjectState;
  private env: Env;
  private messages: ChatMessage[] = [];

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    server.accept();

    this.sessions.add(server);
    this.broadcast({ type: 'user_joined', count: this.sessions.size });

    server.addEventListener('message', async (event) => {
      try {
        const data = JSON.parse(event.data as string);
        const userMessage: ChatMessage = {
          role: 'user',
          content: data.content,
          timestamp: Date.now(),
        };

        this.messages.push(userMessage);
        await this.state.storage.put(`msg:${this.messages.length - 1}`, userMessage);

        await this.broadcast({
          type: 'message',
          role: 'user',
          content: data.content,
          timestamp: userMessage.timestamp,
        });

        const stream = this.callLiteLLMStream(data.content);
        let fullResponse = '';

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content || '';
          if (delta) {
            fullResponse += delta;
            this.broadcast({
              type: 'content',
              content: delta,
            });
          }
        }

        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: fullResponse,
          timestamp: Date.now(),
        };
        this.messages.push(assistantMessage);
        await this.state.storage.put(`msg:${this.messages.length - 1}`, assistantMessage);

        this.broadcast({
          type: 'message',
          role: 'assistant',
          content: fullResponse,
          timestamp: assistantMessage.timestamp,
        });
      } catch (error) {
        server.send(JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
    });

    server.addEventListener('close', () => {
      this.sessions.delete(server);
      this.broadcast({ type: 'user_left', count: this.sessions.size });
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  private async callLiteLLMStream(userMessage: string): Promise<AsyncIterable<any>> {
    const response = await fetch(`${this.env.LITELLM_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.env.LITELLM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'kilo-auto',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful AI assistant in a real-time chat room. Keep responses concise and engaging.',
          },
          ...this.messages.slice(-10),
          { role: 'user', content: userMessage },
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`LiteLLM error: ${response.status}`);
    }

    return this.parseSSEStream(response.body);
  }

  private async *parseSSEStream(body: ReadableStream<Uint8Array>): AsyncIterable<any> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          try {
            yield JSON.parse(data);
          } catch {
            // skip invalid JSON
          }
        }
      }
    }
  }

  private broadcast(message: any) {
    const data = JSON.stringify(message);
    for (const session of this.sessions) {
      try {
        session.send(data);
      } catch {
        this.sessions.delete(session);
      }
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/ws') {
      const id = env.AI_CHAT_ROOM.getByName('global-chat');
      return id.fetch(request);
    }

    return new Response('AI Chat Room - WebSocket endpoint at /ws');
  },
};
