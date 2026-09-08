(function () {
  const form = document.getElementById('search-form');
  const input = document.getElementById('search-input');
  const btn = document.getElementById('search-btn');
  const status = document.getElementById('search-status');
  const results = document.getElementById('search-results');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = input.value.trim();
    if (!query) return;

    btn.disabled = true;
    btn.textContent = '搜索中…';
    status.hidden = false;
    status.textContent = 'AI 正在匹配相关文档…';
    results.innerHTML = '';

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => '');
        throw new Error(`搜索失败 (${res.status})${err ? ': ' + err.slice(0, 120) : ''}`);
      }

      const data = await res.json();

      if (!data.results || data.results.length === 0) {
        status.textContent = '未找到相关文档，换个关键词试试。';
        return;
      }

      status.textContent = `共 ${data.results.length} 条相关结果 · 模型 ${data.model}`;
      renderResults(data.results);
    } catch (err) {
      status.textContent = err.message || '搜索出错，请稍后重试';
      status.style.color = '#ff6b6b';
    } finally {
      btn.disabled = false;
      btn.textContent = '搜索';
    }
  });

  function renderResults(items) {
    results.innerHTML = '';
    for (const item of items) {
      const card = document.createElement('div');
      card.className = 'result-card';

      const title = document.createElement('h4');
      const link = document.createElement('a');
      link.href = '#docs';
      link.textContent = item.title;
      title.appendChild(link);

      const desc = document.createElement('p');
      desc.textContent = item.summary;

      const score = document.createElement('span');
      score.className = 'result-score';
      const pct = Math.round((item.score || 0) * 100);
      score.textContent = `相关度 ${pct}%`;

      card.appendChild(title);
      card.appendChild(desc);
      card.appendChild(score);
      results.appendChild(card);
    }
  }
})();