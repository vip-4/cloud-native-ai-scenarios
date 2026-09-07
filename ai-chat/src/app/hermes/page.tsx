"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

export default function HermesPage() {
  const { data: session } = useSession();
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResponse("");

    try {
      const res = await fetch("/api/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model: "kilo-auto" }),
      });

      const data = await res.json();
      setResponse(data.choices?.[0]?.message?.content || data.content || JSON.stringify(data, null, 2));
    } catch (err) {
      setResponse(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-zinc-600 dark:text-zinc-400">Please sign in to use Hermes Agent</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-black">
      <div className="max-w-3xl mx-auto w-full px-4 py-12">
        <div className="rounded-lg bg-white dark:bg-zinc-900 p-8 shadow">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Hermes Agent</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
            Advanced orchestration via local FreeLLMAPI
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your prompt for Hermes Agent..."
              rows={6}
              className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="rounded-md bg-purple-600 px-4 py-2 text-white font-medium hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Running..." : "Run Hermes"}
            </button>
          </form>

          {response && (
            <div className="mt-6 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 p-4">
              <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Response</h2>
              <pre className="whitespace-pre-wrap text-sm text-zinc-900 dark:text-zinc-100">{response}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
