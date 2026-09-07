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
    const today = new Date().toISOString().slice(0, 10);
    const scheduled = items.filter((item) => item.nextAction && item.dueDate);
    const overdue = scheduled.filter((item) => item.dueDate < today && !item.decision).length;
    document.querySelector('#workspace-count').textContent = items.length;
    document.querySelector('#workspace-steps').textContent = items.reduce((sum, item) => sum + (item.completed || []).length, 0);
    document.querySelector('#workspace-complete').textContent = items.filter((item) => item.decision).length;
    document.querySelector('#workspace-due').textContent = scheduled.length ? `${scheduled.length} scheduled · ${overdue} overdue` : 'No scheduled actions';
    empty.hidden = items.length > 0;
    list.innerHTML = items.map((item) => {
      const count = (item.completed || []).length;
      const note = String(item.notes || '').trim();
      const decision = item.decision ? item.decision.charAt(0).toUpperCase() + item.decision.slice(1) : 'Undecided';
      const action = String(item.nextAction || '').trim();
      return `<article class="workspace-card"><div class="workspace-card-top"><span>${escapeHtml(item.project || 'Opportunity validation')}</span><strong>${count}/4 steps · ${escapeHtml(decision)}</strong></div><h2><a href="/opportunity/${encodeURIComponent(item.id)}">${escapeHtml(item.title)}</a></h2><div class="workspace-bar"><span style="width:${Math.min(100, count / 4 * 100)}%"></span></div>${action ? `<p class="workspace-next"><strong>Next:</strong> ${escapeHtml(action)}${item.dueDate ? ` · ${escapeHtml(item.dueDate)}` : ''}</p>` : ''}<p>${note ? escapeHtml(note.slice(0, 180)) : 'No research notes yet.'}${note.length > 180 ? '…' : ''}</p><div class="workspace-card-actions"><a href="/opportunity/${encodeURIComponent(item.id)}">Continue validation →</a><button type="button" data-remove="${escapeHtml(item.key)}">Remove</button></div></article>`;
    }).join('');
    list.querySelectorAll('[data-remove]').forEach((button) => button.addEventListener('click', () => { localStorage.removeItem(button.dataset.remove); render(); }));
  }
  document.querySelector('#workspace-export').addEventListener('click', () => {
    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), version: 1, validations: records().map(({ key, ...item }) => item) }, null, 2);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    link.download = `ai-agent-radar-workspace-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  });
  render();
})();
