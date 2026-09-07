import { db } from "@/db";
import { messages, chats } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { id } = await params;
    const chat = await db.select().from(chats).where(eq(chats.id, id)).limit(1);
    if (!chat[0] || chat[0].userId !== session.user.id) {
      return new Response("Forbidden", { status: 403 });
    }

    const chatMessages = await db.select().from(messages).where(eq(messages.chatId, id)).orderBy(messages.createdAt);
    return Response.json({ messages: chatMessages });
  } catch (error) {
    console.error("Failed to load messages:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
