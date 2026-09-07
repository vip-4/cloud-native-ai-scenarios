"use client";

import { useState, useRef, useEffect } from "react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";

export default function Home() {
  const { data: session } = useSession();
  const [chats, setChats] = useState<{ id: string; title: string }[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ id: string; role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadChats = async () => {
    try {
      const res = await fetch("/api/chats");
      const data = await res.json();
      if (data.chats) {
        setChats(data.chats);
      }
    } catch (err) {
      console.error("Failed to load chats:", err);
    }
  };

  useEffect(() => {
    if (session?.user) {
      loadChats();
    }
  }, [session]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startNewChat = () => {
    setCurrentChatId(null);
    setMessages([]);
  };

  const loadChatMessages = async (chatId: string) => {
    setCurrentChatId(chatId);
    try {
      const res = await fetch(`/api/chats/${chatId}/messages`);
      const data = await res.json();
      if (data.messages) {
        setMessages(data.messages);
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = { id: Date.now().toString(), role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          chatId: currentChatId,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("text/event-stream")) {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let assistantContent = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value);
            assistantContent += text;
          }
        }

        const assistantMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: assistantContent,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        const data = await res.json();
        const assistantMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.content || "",
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (err) {
      console.error("Chat error:", err);
    } finally {
      setLoading(false);
      loadChats();
    }
  };

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-center">
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">Please sign in to access AI Chat</p>
          <Link href="/login" className="text-blue-600 hover:text-blue-700">Sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-black">
      <aside className="w-64 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black flex flex-col">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">AI Chat</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Powered by FreeLLMAPI</p>
        </div>

        <div className="p-3">
          <button
            onClick={startNewChat}
            className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm text-white font-medium hover:bg-blue-700"
          >
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3">
          {chats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => loadChatMessages(chat.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm truncate mb-1 ${
                currentChatId === chat.id
                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                  : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              {chat.title}
            </button>
          ))}
        </div>

        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
          <div className="text-xs text-zinc-600 dark:text-zinc-400 truncate">
            {session.user?.email}
          </div>
          <div className="flex gap-2">
            <Link href="/hermes" className="flex-1 text-center rounded-md bg-purple-600 px-2 py-1.5 text-xs text-white hover:bg-purple-700">
              Hermes
            </Link>
            <Link href="/openclaw" className="flex-1 text-center rounded-md bg-indigo-600 px-2 py-1.5 text-xs text-white hover:bg-indigo-700">
              OpenClaw
            </Link>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-zinc-500 dark:text-zinc-400 text-lg">Start a conversation with AI</p>
              <p className="text-zinc-400 dark:text-zinc-500 text-sm mt-2">Using model: kilo-auto via local FreeLLMAPI</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100"
                    }`}
                  >
                    <p className="text-sm font-medium mb-1 opacity-70">
                      {message.role === "user" ? "You" : "AI"}
                    </p>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2">
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm">Thinking...</p>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
        <div className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black px-4 py-3">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              disabled={loading}
              className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
