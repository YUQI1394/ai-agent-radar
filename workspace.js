(async () => {
  const emptyState = document.querySelector('#workspace-empty');
  emptyState.innerHTML = `<span class="eyebrow">YOUR FIRST VALIDATION</span><h2>Start with one real problem—not an idea list</h2><p>Radar turns a public GitHub signal into a small validation sprint. Your first useful result can be one interview, one observed workaround, or one clear reason to stop.</p><ol class="workspace-onboarding"><li><strong>Choose one demand signal</strong><span>Open an Issue-backed opportunity that matches a field you understand.</span></li><li><strong>Make one action concrete</strong><span>Use “Make this my next action,” add a date, and keep the task small.</span></li><li><strong>Return with evidence</strong><span>Record interviews and commitments, then decide to build, narrow, or stop.</span></li></ol><a class="button button-primary" href="/opportunities">Choose my first opportunity →</a>`;
  const auth = await window.RadarAuth.ready;
  if (!auth.user) {
    document.querySelector('.workspace-summary').hidden = true;
    document.querySelector('.workspace-toolbar').hidden = true;
    document.querySelector('#workspace-empty').hidden = true;
    document.querySelector('#workspace-list').innerHTML = `<section class="auth-gate"><span class="eyebrow">FREE 7-DAY VALIDATION WORKSPACE</span><h2>Turn one GitHub need into a decision</h2><p>Choose one current signal, complete a focused validation sprint, and decide whether to Build, Narrow or Stop.</p><ul class="auth-benefits"><li><strong>One next action</strong><span>Scheduled automatically so research becomes execution.</span></li><li><strong>Real evidence</strong><span>Track interviews, commitments and exact user language.</span></li><li><strong>A decision gate</strong><span>Stop weak ideas before they consume weeks of work.</span></li></ul><a class="button button-primary" href="/login?next=%2Fworkspace">Open my free workspace</a><small>No payment · private notes · cross-device sync</small></section>`;
    return;
  }
  const prefix = auth.storagePrefix('validation');
  const cloud = await window.RadarCloud.ready;
  const list = document.querySelector('#workspace-list');
  const empty = document.querySelector('#workspace-empty');
  const focus = document.createElement('section');
  focus.className = 'workspace-focus';
  focus.hidden = true;
  document.querySelector('.workspace-toolbar').after(focus);
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
    const actionable = items.filter((item) => item.nextAction && !item.decision).sort((a, b) => {
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
    });
    const next = actionable[0];
    document.querySelector('#workspace-count').textContent = items.length;
    document.querySelector('#workspace-steps').textContent = items.reduce((sum, item) => sum + (item.completed || []).length, 0);
    document.querySelector('#workspace-complete').textContent = items.filter((item) => item.decision).length;
    document.querySelector('#workspace-due').textContent = `${cloud.available ? 'Cloud synced' : 'Offline copy'} · ${scheduled.length ? `${scheduled.length} scheduled · ${overdue} overdue` : 'No scheduled actions'}`;
    empty.hidden = items.length > 0;
    focus.hidden = !next;
    focus.innerHTML = next ? `<div><span class="analysis-label">${next.dueDate && next.dueDate < today ? 'OVERDUE · DO THIS NEXT' : 'FOCUS · DO THIS NEXT'}</span><h2>${escapeHtml(next.nextAction)}</h2><p>${escapeHtml(next.title)}${next.dueDate ? ` · Target ${escapeHtml(next.dueDate)}` : ' · Choose a target date when you continue'}</p></div><a class="button button-primary" href="/opportunity/${encodeURIComponent(next.id)}#validation-start">Continue this action →</a>` : '';
    const orderedItems = [...items].sort((a, b) => {
      const aRank = a.decision ? 3 : a.nextAction && a.dueDate ? 0 : a.nextAction ? 1 : 2;
      const bRank = b.decision ? 3 : b.nextAction && b.dueDate ? 0 : b.nextAction ? 1 : 2;
      if (aRank !== bRank) return aRank - bRank;
      if (aRank === 0 && a.dueDate !== b.dueDate) return String(a.dueDate).localeCompare(String(b.dueDate));
      return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
    });
    list.innerHTML = orderedItems.map((item) => {
      const count = (item.completed || []).length;
      const note = String(item.notes || '').trim();
      const decision = item.decision ? item.decision.charAt(0).toUpperCase() + item.decision.slice(1) : 'Undecided';
      const action = String(item.nextAction || '').trim();
      const interviews = Math.min(20, Math.max(0, Number(item.interviews) || 0));
      const commitments = Math.min(20, Math.max(0, Number(item.commitments) || 0));
      return `<article class="workspace-card"><div class="workspace-card-top"><span>${escapeHtml(item.project || 'Opportunity validation')}</span><strong>${count}/4 steps · ${escapeHtml(decision)}</strong></div><h2><a href="/opportunity/${encodeURIComponent(item.id)}">${escapeHtml(item.title)}</a></h2><div class="workspace-bar"><span style="width:${Math.min(100, count / 4 * 100)}%"></span></div><p class="workspace-evidence"><strong>${interviews}</strong> interviews · <strong>${commitments}</strong> commitments</p>${action ? `<p class="workspace-next"><strong>Next:</strong> ${escapeHtml(action)}${item.dueDate ? ` · ${escapeHtml(item.dueDate)}` : ''}</p>` : ''}<p>${note ? escapeHtml(note.slice(0, 180)) : 'No research notes yet.'}${note.length > 180 ? '…' : ''}</p><div class="workspace-card-actions"><a href="/opportunity/${encodeURIComponent(item.id)}">Continue validation →</a><button type="button" data-remove="${escapeHtml(item.key)}">Remove</button></div></article>`;
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
          interviews: Math.min(20, Math.max(0, Number(item.interviews) || 0)),
          commitments: Math.min(20, Math.max(0, Number(item.commitments) || 0)),
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
