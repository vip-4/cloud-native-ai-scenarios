import { useState, useEffect, useRef } from 'react';

interface Message {
  type: 'content' | 'message' | 'user_joined' | 'user_left' | 'error';
  role?: 'user' | 'assistant';
  content?: string;
  timestamp?: number;
  count?: number;
  message?: string;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setConnected(true);
      setMessages(prev => [...prev, { type: 'message', content: 'Connected to AI Chat Room', timestamp: Date.now() }]);
    };

    ws.onmessage = (event) => {
      const data: Message = JSON.parse(event.data);
      setMessages(prev => [...prev, data]);

      if (data.type === 'user_joined' || data.type === 'user_left') {
        setUserCount(data.count || 0);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      setMessages(prev => [...prev, { type: 'message', content: 'Disconnected from server', timestamp: Date.now() }]);
    };

    ws.onerror = () => {
      setMessages(prev => [...prev, { type: 'error', message: 'Connection error' }]);
    };

    wsRef.current = ws;

    return () => ws.close();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ content: input }));
    setInput('');
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">AI Chat Room</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">
              Users: {userCount}
            </span>
            <span className={`text-sm ${connected ? 'text-green-400' : 'text-red-400'}`}>
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[70%] rounded-lg px-4 py-2 ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white' 
                : msg.type === 'error'
                ? 'bg-red-600 text-white'
                : 'bg-gray-800 text-gray-100'
            }`}>
              {msg.type === 'content' && msg.content && (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
              {msg.type === 'message' && msg.content && (
                <div>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.timestamp && (
                    <span className="text-xs opacity-70 mt-1 block">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              )}
              {msg.type === 'user_joined' && (
                <p className="text-sm text-green-400">
                  User joined. Total users: {msg.count}
                </p>
              )}
              {msg.type === 'user_left' && (
                <p className="text-sm text-yellow-400">
                  User left. Total users: {msg.count}
                </p>
              )}
              {msg.type === 'error' && (
                <p className="text-sm">{msg.message}</p>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </main>

      <footer className="bg-gray-800 border-t border-gray-700 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!connected}
          />
          <button
            onClick={sendMessage}
            disabled={!connected || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Send
          </button>
        </div>
      </footer>
    </div>
  );
}

export default App;
