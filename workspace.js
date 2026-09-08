(async () => {
  const auth = await window.RadarAuth.ready;
  if (!auth.user) {
    document.querySelector('.workspace-summary').hidden = true;
    document.querySelector('.workspace-toolbar').hidden = true;
    document.querySelector('#workspace-empty').hidden = true;
    document.querySelector('#workspace-list').innerHTML = `<section class="auth-gate"><span class="eyebrow">FREE REGISTRATION</span><h2>Sign in to use your workspace</h2><p>Create a free account to save validation progress on this device and keep different users' work separate.</p><a class="button button-primary" href="/login?next=%2Fworkspace">Create free account or sign in</a></section>`;
    return;
  }
  const prefix = auth.storagePrefix('validation');
  const cloud = await window.RadarCloud.ready;
  const list = document.querySelector('#workspace-list');
  const empty = document.querySelector('#workspace-empty');
  const exportButton = document.querySelector('#workspace-export');
  const importButton = document.createElement('button');
  const importInput = document.createElement('input');
  importButton.className = 'button button-secondary';
  importButton.type = 'button';
  importButton.textContent = 'Import backup';
  importInput.type = 'file';
  importInput.accept = 'application/json,.json';
  importInput.hidden = true;
  exportButton.after(importButton, importInput);
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
  async function syncFromCloud() {
    if (!cloud.available) return;
    try {
      const remote = await cloud.list('validation');
      const remoteIds = new Set(remote.map((item) => String(item.id)));
      const writes = [];
      remote.forEach((item) => {
        const key = `${prefix}${item.id}`;
        if (item.deleted) {
          localStorage.removeItem(key);
          return;
        }
        let local = null;
        try { local = JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) {}
        if (local?.pendingSync) {
          writes.push(cloud.set('validation', item.id, local).then((cloudUpdatedAt) => {
            const current = JSON.parse(localStorage.getItem(key) || 'null');
            if (current?.updatedAt === local.updatedAt) localStorage.setItem(key, JSON.stringify({ ...current, pendingSync: false, cloudUpdatedAt }));
          }));
        } else {
          localStorage.setItem(key, JSON.stringify({ ...item, pendingSync: false }));
        }
      });
      records().filter((item) => !remoteIds.has(String(item.id))).forEach((item) => {
        writes.push(cloud.set('validation', item.id, item).then((cloudUpdatedAt) => {
          localStorage.setItem(item.key, JSON.stringify({ ...item, pendingSync: false, cloudUpdatedAt, key: undefined }));
        }));
      });
      await Promise.allSettled(writes);
    } catch (_) { /* Render the offline copy. */ }
  }
  function render() {
    const items = records();
    const today = new Date().toISOString().slice(0, 10);
    const scheduled = items.filter((item) => item.nextAction && item.dueDate);
    const overdue = scheduled.filter((item) => item.dueDate < today && !item.decision).length;
    document.querySelector('#workspace-count').textContent = items.length;
    document.querySelector('#workspace-steps').textContent = items.reduce((sum, item) => sum + (item.completed || []).length, 0);
    document.querySelector('#workspace-complete').textContent = items.filter((item) => item.decision).length;
    document.querySelector('#workspace-due').textContent = `${cloud.available ? 'Cloud synced' : 'Offline copy'} · ${scheduled.length ? `${scheduled.length} scheduled · ${overdue} overdue` : 'No scheduled actions'}`;
    empty.hidden = items.length > 0;
    list.innerHTML = items.map((item) => {
      const count = (item.completed || []).length;
      const note = String(item.notes || '').trim();
      const decision = item.decision ? item.decision.charAt(0).toUpperCase() + item.decision.slice(1) : 'Undecided';
      const action = String(item.nextAction || '').trim();
      return `<article class="workspace-card"><div class="workspace-card-top"><span>${escapeHtml(item.project || 'Opportunity validation')}</span><strong>${count}/4 steps · ${escapeHtml(decision)}</strong></div><h2><a href="/opportunity/${encodeURIComponent(item.id)}">${escapeHtml(item.title)}</a></h2><div class="workspace-bar"><span style="width:${Math.min(100, count / 4 * 100)}%"></span></div>${action ? `<p class="workspace-next"><strong>Next:</strong> ${escapeHtml(action)}${item.dueDate ? ` · ${escapeHtml(item.dueDate)}` : ''}</p>` : ''}<p>${note ? escapeHtml(note.slice(0, 180)) : 'No research notes yet.'}${note.length > 180 ? '…' : ''}</p><div class="workspace-card-actions"><a href="/opportunity/${encodeURIComponent(item.id)}">Continue validation →</a><button type="button" data-remove="${escapeHtml(item.key)}">Remove</button></div></article>`;
    }).join('');
    list.querySelectorAll('[data-remove]').forEach((button) => button.addEventListener('click', async () => {
      if (!window.confirm('Remove this validation from this browser? Export a backup first if you may need it later.')) return;
      localStorage.removeItem(button.dataset.remove);
      if (cloud.available) {
        try { await cloud.remove('validation', button.dataset.remove.slice(prefix.length)); } catch (_) {}
      }
      render();
    }));
  }
  exportButton.addEventListener('click', () => {
    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), version: 1, validations: records().map(({ key, ...item }) => item) }, null, 2);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    link.download = `ai-agent-radar-workspace-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
  });
  importButton.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    const message = document.querySelector('#workspace-due');
    try {
      if (file.size > 1000000) throw new Error('Backup is larger than 1 MB');
      const payload = JSON.parse(await file.text());
      if (payload?.version !== 1 || !Array.isArray(payload.validations) || payload.validations.length > 100) throw new Error('Unsupported backup format');
      let imported = 0;
      const writes = [];
      payload.validations.forEach((item) => {
        const id = String(item?.id || '');
        if (!/^\d+$/.test(id) || typeof item.title !== 'string' || !item.title.trim()) return;
        const record = {
          id,
          title: item.title.slice(0, 300), project: String(item.project || '').slice(0, 200),
          completed: Array.isArray(item.completed) ? [...new Set(item.completed.filter((step) => Number.isInteger(step) && step >= 0 && step < 4))] : [],
          notes: String(item.notes || '').slice(0, 50000), nextAction: String(item.nextAction || '').slice(0, 180),
          dueDate: /^\d{4}-\d{2}-\d{2}$/.test(String(item.dueDate || '')) ? item.dueDate : '',
          decision: ['build', 'narrow', 'stop'].includes(item.decision) ? item.decision : '', updatedAt: new Date().toISOString(), pendingSync: true
        };
        localStorage.setItem(`${prefix}${id}`, JSON.stringify(record));
        if (cloud.available) writes.push(cloud.set('validation', id, record));
        imported += 1;
      });
      await Promise.allSettled(writes);
      render();
      message.textContent = `${imported} validation${imported === 1 ? '' : 's'} imported`;
    } catch (error) {
      message.textContent = `Import failed: ${error.message}`;
    } finally { importInput.value = ''; }
  });
  await syncFromCloud();
  render();
})();
