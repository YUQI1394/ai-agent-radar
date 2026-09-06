(() => {
  const prefix = 'ai-agent-radar:validation:';
  const list = document.querySelector('#workspace-list');
  const empty = document.querySelector('#workspace-empty');
  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  function records() {
    const items = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(prefix)) continue;
      try { const data = JSON.parse(localStorage.getItem(key)); if (data?.title) items.push({ ...data, key, id: key.slice(prefix.length) }); } catch (_) {}
    }
    return items.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  }
  function render() {
    const items = records();
    document.querySelector('#workspace-count').textContent = items.length;
    document.querySelector('#workspace-steps').textContent = items.reduce((sum, item) => sum + (item.completed || []).length, 0);
    document.querySelector('#workspace-complete').textContent = items.filter((item) => (item.completed || []).length >= 4).length;
    empty.hidden = items.length > 0;
    list.innerHTML = items.map((item) => {
      const count = (item.completed || []).length;
      const note = String(item.notes || '').trim();
      return `<article class="workspace-card"><div class="workspace-card-top"><span>${escapeHtml(item.project || 'Opportunity validation')}</span><strong>${count}/4 steps</strong></div><h2><a href="/opportunity/${encodeURIComponent(item.id)}">${escapeHtml(item.title)}</a></h2><div class="workspace-bar"><span style="width:${Math.min(100, count / 4 * 100)}%"></span></div><p>${note ? escapeHtml(note.slice(0, 180)) : 'No research notes yet.'}${note.length > 180 ? '…' : ''}</p><div class="workspace-card-actions"><a href="/opportunity/${encodeURIComponent(item.id)}">Continue validation →</a><button type="button" data-remove="${escapeHtml(item.key)}">Remove</button></div></article>`;
    }).join('');
    list.querySelectorAll('[data-remove]').forEach((button) => button.addEventListener('click', () => { localStorage.removeItem(button.dataset.remove); render(); }));
  }
  render();
})();
