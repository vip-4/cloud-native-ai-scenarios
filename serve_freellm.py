#!/usr/bin/env python3
"""Local FreeLLM Directory Server"""

import http.server
import socketserver
import os
import sys
import json
import re
from pathlib import Path

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

PORT = 8080
DIRECTORY = Path(__file__).parent / "awesome-freellm-apis"

class FreeLLMHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIRECTORY), **kwargs)
    
    def do_GET(self):
        if self.path == '/' or self.path == '/index.html':
            self.serve_index()
        else:
            super().do_GET()
    
    def serve_index(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/html; charset=utf-8')
        self.end_headers()
        
        html = """<!DOCTYPE html>
<html>
<head>
    <title>FreeLLM 本地目录</title>
    <meta charset="utf-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; }
        .header h1 { margin: 0 0 10px 0; }
        .header p { margin: 5px 0; opacity: 0.9; }
        .section { background: white; padding: 20px; margin-bottom: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .section h2 { color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
        .provider { display: inline-block; background: #f0f0f0; padding: 8px 12px; margin: 5px; border-radius: 5px; font-size: 14px; }
        .provider.free { background: #d4edda; color: #155724; }
        .provider.registration { background: #fff3cd; color: #856404; }
        a { color: #667eea; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .btn { display: inline-block; background: #667eea; color: white; padding: 10px 20px; border-radius: 5px; margin: 5px; }
        .btn:hover { background: #5568d3; }
        .links { margin-top: 20px; }
        .links a { margin-right: 15px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🆓 FreeLLM 本地目录</h1>
        <p>453+ 免费 LLM API | 31 提供商</p>
        <p>数据来源: <a href="https://freellm.net" style="color: white;">freellm.net</a> | 本地副本</p>
    </div>
    
    <div class="section">
        <h2>📖 文档</h2>
        <a href="README.md" class="btn">英文 README</a>
        <a href="README.zh-CN.md" class="btn">简体中文</a>
        <a href="README.zh-TW.md" class="btn">繁體中文</a>
        <a href="README.ja.md" class="btn">日本語</a>
        <a href="README.ko.md" class="btn">한국어</a>
    </div>
    
    <div class="section">
        <h2>💻 代码示例</h2>
        <a href="code-examples/claude-code.md" class="btn">Claude Code</a>
        <a href="code-examples/codex.md" class="btn">Codex CLI</a>
        <a href="code-examples/cursor.md" class="btn">Cursor</a>
    </div>
    
    <div class="section">
        <h2>🔗 快速链接</h2>
        <div class="links">
            <a href="https://freellm.net" target="_blank">🌐 在线浏览</a>
            <a href="https://freellm.net/models/" target="_blank">模型列表</a>
            <a href="https://freellm.net/playground/" target="_blank">Playground</a>
            <a href="https://freellm.net/config/" target="_blank">配置生成器</a>
        </div>
    </div>
    
    <div class="section">
        <h2>📊 推荐免费提供商</h2>
        <p>🚀 <strong>Groq</strong> - 完全免费，无需信用卡，30 RPM | <a href="https://console.groq.com/keys">获取 Key</a></p>
        <p>🎯 <strong>Google Gemini</strong> - 完全免费，无需信用卡，15 RPM | <a href="https://aistudio.google.com/app/apikey">获取 Key</a></p>
        <p>⚡ <strong>Mistral AI</strong> - 完全免费，无需信用卡 | <a href="https://console.mistral.ai/api-keys">获取 Key</a></p>
        <p>🧠 <strong>Cerebras</strong> - 完全免费，无需信用卡 | <a href="https://cloud.cerebras.ai/">获取 Key</a></p>
        <p>🤗 <strong>Hugging Face</strong> - 完全免费，无需信用卡 | <a href="https://huggingface.co/settings/tokens">获取 Key</a></p>
    </div>
</body>
</html>"""
        
        self.wfile.write(html.encode('utf-8'))

if __name__ == "__main__":
    os.chdir(DIRECTORY)
    with socketserver.TCPServer(("", PORT), FreeLLMHandler) as httpd:
        print(f"🚀 FreeLLM 本地目录已启动")
        print(f"📖 访问地址: http://localhost:{PORT}")
        print(f"📁 目录位置: {DIRECTORY}")
        print(f"⏹️  按 Ctrl+C 停止服务")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n服务已停止")
