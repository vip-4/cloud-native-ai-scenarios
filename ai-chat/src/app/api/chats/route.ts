import { db } from "@/db";
import { chats } from "@/db/schema";
import { auth } from "@/auth";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const userChats = await db.select().from(chats).where(eq(chats.userId, session.user.id)).orderBy(chats.createdAt);
    
    return Response.json({ chats: userChats });
  } catch (error) {
    console.error("Failed to load chats:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
