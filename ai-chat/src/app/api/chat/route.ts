import { db } from "@/db";
import { messages, chats } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { messages: chatMessages, chatId } = await req.json();

    if (!chatMessages || !Array.isArray(chatMessages)) {
      return new Response("Invalid messages", { status: 400 });
    }

    const existing = await db.select().from(chats).where(eq(chats.id, chatId)).limit(1);
    let currentChat = existing[0];

    if (!currentChat) {
      const title = chatMessages[0]?.content?.slice(0, 50) || "New Chat";
      const result = await db.insert(chats).values({ userId: session.user.id, title }).returning();
      currentChat = result[0];
    }

    await db.insert(messages).values({
      chatId: currentChat.id,
      role: "user",
      content: chatMessages[chatMessages.length - 1].content,
    });

    const llmResponse = await fetch("http://localhost:3001/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "kilo-auto",
        messages: chatMessages,
        stream: true,
      }),
    });

    if (!llmResponse.ok) {
      const errorText = await llmResponse.text();
      return new Response(`LLM error: ${errorText}`, { status: llmResponse.status });
    }

    const contentType = llmResponse.headers.get("content-type") || "";
    if (contentType.includes("text/event-stream")) {
      return new Response(llmResponse.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    const data = await llmResponse.json();
    const content = data.choices?.[0]?.message?.content || "";

    if (content) {
      await db.insert(messages).values({
        chatId: currentChat.id,
        role: "assistant",
        content,
      });
    }

    return Response.json({ content });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
