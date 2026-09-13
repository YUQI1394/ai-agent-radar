(async () => {
  const emptyState = document.querySelector('#workspace-empty');
  emptyState.innerHTML = `<span class="eyebrow">YOUR FIRST VALIDATION</span><h2>Choose a real need in a field you understand</h2><p>These recommendations come from the current qualified GitHub evidence feed. Pick one and Radar will schedule its first action for the next seven days.</p><div class="starter-picker" id="starter-picker" aria-live="polite"><p class="starter-loading">Loading current opportunities…</p></div><ol class="workspace-onboarding"><li><strong>Start with source evidence</strong><span>Every recommendation links back to the original public GitHub discussion.</span></li><li><strong>Do one concrete action</strong><span>Your first task and seven-day target are created when you start.</span></li><li><strong>Leave with a decision</strong><span>Record interviews and commitments, then choose Build, Narrow or Stop.</span></li></ol><a class="workspace-all-opportunities" href="/opportunities">Or browse every qualified opportunity →</a>`;
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
  const safeFilename = (value = 'validation-brief') => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'validation-brief';
  let agentFeedPromise;
  function loadAgentFeed() {
    if (!agentFeedPromise) agentFeedPromise = fetch('/api/get-agents').then(async (response) => {
      if (!response.ok) throw new Error('The live feed is temporarily unavailable');
      const payload = await response.json();
      return Array.isArray(payload.agents) ? payload.agents : [];
    });
    return agentFeedPromise;
  }
  function decisionBrief(item) {
    const labels = { build: 'Build', narrow: 'Narrow', stop: 'Stop' };
    return `# Validation decision brief\n\n## ${item.title}\n\n- Project: ${item.project || 'Not recorded'}\n- Professional domain: ${item.domain || 'Not recorded'}\n- Problem pattern: ${item.pattern || 'Not recorded'}\n- Source evidence: ${item.sourceUrl || 'Not recorded'}\n- Decision: ${labels[item.decision] || 'Undecided'}\n- Progress: ${(item.completed || []).length}/4 steps\n- User interviews: ${Number(item.interviews) || 0}\n- Behavioral commitments: ${Number(item.commitments) || 0}\n- Next action: ${item.nextAction || 'Not set'}\n- Target date: ${item.dueDate || 'Not set'}\n- Last updated: ${item.updatedAt || 'Not recorded'}\n\n## Evidence notes\n\n${String(item.notes || '').trim() || 'No evidence notes recorded yet.'}\n\n---\nGenerated from AI Agent Radar. Verify the original GitHub evidence before acting.\n`;
  }
  function records() {
    const items = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(prefix)) continue;
      try { const data = JSON.parse(localStorage.getItem(key)); if (data?.title) items.push({ ...data, key, id: key.slice(prefix.length) }); } catch (_) {}
    }
    return items.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  }
  async function loadStarterRecommendations() {
    const picker = document.querySelector('#starter-picker');
    if (!picker || records().length) return;
    try {
      const agents = await loadAgentFeed();
      const opportunities = [];
      const seen = new Set();
      agents.forEach((agent) => (Array.isArray(agent.evidenceIssues) ? agent.evidenceIssues : []).forEach((issue) => {
        const id = String(issue.id || '');
        if (!/^\d+$/.test(id) || !issue.title || seen.has(id)) return;
        seen.add(id);
        opportunities.push({
          id, title: String(issue.title), project: String(agent.name || agent.slug || 'Open-source project'),
          domain: String(agent.category || 'General AI'), comments: Math.max(0, Number(issue.comments) || 0),
          reactions: Math.max(0, Number(issue.reactions) || 0), radar: Math.max(0, Number(agent.score?.total) || 0),
          updatedAt: String(issue.updatedAt || issue.createdAt || '')
        });
      }));
      if (!opportunities.length) throw new Error('No current opportunities are available');
      const preferred = localStorage.getItem('ai-agent-radar:preferred-domain') || 'All fields';
      const domainOrder = ['Research', 'Security', 'Finance', 'Marketing', 'Coding', 'Design', 'Productivity', 'Agent Infrastructure'];
      const domains = domainOrder.filter((domain) => opportunities.some((item) => item.domain === domain));
      const initial = domains.includes(preferred) ? preferred : 'All fields';
      const strength = (item) => {
        const ageDays = Math.max(0, (Date.now() - Date.parse(item.updatedAt)) / 86400000);
        const freshness = Number.isFinite(ageDays) ? ageDays <= 30 ? 10 : ageDays <= 90 ? 7 : ageDays <= 365 ? 3 : 0 : 0;
        return Math.min(24, Math.log2(item.comments + 1) * 4.5) + Math.min(24, Math.log2(item.reactions + 1) * 6) + freshness + item.radar / 20;
      };
      const renderRecommendations = (domain) => {
        const ranked = opportunities.filter((item) => domainOrder.includes(item.domain) && (domain === 'All fields' || item.domain === domain))
          .sort((a, b) => strength(b) - strength(a) || a.title.localeCompare(b.title));
        const seenDomains = new Set();
        const candidates = (domain === 'All fields' ? ranked.filter((item) => {
          if (seenDomains.has(item.domain)) return false;
          seenDomains.add(item.domain);
          return true;
        }) : ranked).slice(0, 3);
        picker.querySelectorAll('[data-starter-domain]').forEach((button) => {
          const active = button.dataset.starterDomain === domain;
          button.classList.toggle('active', active);
          button.setAttribute('aria-pressed', String(active));
        });
        picker.querySelector('.starter-recommendations').innerHTML = candidates.map((item) => `<article class="starter-card"><div><span>${escapeHtml(item.domain)}</span><small>${item.comments} comments · ${item.reactions} reactions</small></div><h3>${escapeHtml(item.title)}</h3><p>Evidence in ${escapeHtml(item.project)}</p><a class="button button-primary" href="/opportunity/${encodeURIComponent(item.id)}#validation-start">Start this 7-day sprint →</a></article>`).join('');
        if (domain !== 'All fields') localStorage.setItem('ai-agent-radar:preferred-domain', domain);
      };
      picker.innerHTML = `<div class="starter-picker-heading"><strong>Recommended from live evidence</strong><span>Choose your field</span></div><div class="starter-domains" role="group" aria-label="Choose a professional field"><button type="button" data-starter-domain="All fields">All</button>${domains.map((domain) => `<button type="button" data-starter-domain="${escapeHtml(domain)}">${escapeHtml(domain === 'Agent Infrastructure' ? 'Infrastructure' : domain)}</button>`).join('')}</div><div class="starter-recommendations"></div>`;
      picker.querySelectorAll('[data-starter-domain]').forEach((button) => button.addEventListener('click', () => renderRecommendations(button.dataset.starterDomain)));
      renderRecommendations(initial);
    } catch (error) {
      picker.innerHTML = `<p class="starter-loading">${escapeHtml(error.message)}. <a href="/opportunities">Browse Opportunity Radar →</a></p>`;
    }
  }
  async function loadSavedWatchlist() {
    const section = document.querySelector('#workspace-watchlist');
    const grid = document.querySelector('#workspace-watchlist-grid');
    const brief = document.querySelector('#workspace-return-brief');
    if (!section || !grid || !brief) return;
    let ids = [];
    try {
      const local = JSON.parse(localStorage.getItem(auth.savedKey()) || '[]');
      if (Array.isArray(local)) ids = local.map(String);
    } catch (_) {}
    if (cloud.available) {
      try {
        const remote = await cloud.get('saved', 'agents');
        if (Array.isArray(remote?.ids)) {
          ids = remote.ids.map(String);
          localStorage.setItem(auth.savedKey(), JSON.stringify(ids));
        }
      } catch (_) { /* Keep the local watchlist. */ }
    }
    if (!ids.length) return;
    try {
      const wanted = new Set(ids);
      const saved = (await loadAgentFeed()).filter((agent) => wanted.has(String(agent.id || agent.slug || agent.name)));
      if (!saved.length) return;
      const snapshotKey = `${auth.storagePrefix('saved')}watchlist-snapshot`;
      let previous = null;
      try { previous = JSON.parse(localStorage.getItem(snapshotKey) || 'null'); } catch (_) {}
      if (cloud.available) {
        try { previous = await cloud.get('saved', 'watchlist-snapshot') || previous; } catch (_) { /* Use the device snapshot. */ }
      }
      const current = {
        checkedAt: new Date().toISOString(),
        projects: Object.fromEntries(saved.map((agent) => [String(agent.id || agent.slug || agent.name), {
          stars: Math.max(0, Number(agent.stars ?? agent.votes) || 0),
          issues: (agent.evidenceIssues || []).map((issue) => String(issue.id || '')).filter((id) => /^\d+$/.test(id))
        }]))
      };
      const changes = [];
      if (previous?.projects && typeof previous.projects === 'object') saved.forEach((agent) => {
        const id = String(agent.id || agent.slug || agent.name);
        const before = previous.projects[id];
        if (!before) {
          changes.push(`<li><strong>${escapeHtml(agent.name)}</strong><span>Newly added to your monitored projects</span></li>`);
          return;
        }
        const issueIds = new Set(Array.isArray(before.issues) ? before.issues.map(String) : []);
        const newIssues = (agent.evidenceIssues || []).filter((issue) => /^\d+$/.test(String(issue.id || '')) && !issueIds.has(String(issue.id)));
        if (newIssues.length) changes.push(`<li><strong>${escapeHtml(agent.name)}</strong><span>${newIssues.length} new qualified need${newIssues.length === 1 ? '' : 's'} · <a href="/opportunity/${encodeURIComponent(newIssues[0].id)}">open newest evidence →</a></span></li>`);
        const starGain = Math.max(0, Number(agent.stars ?? agent.votes) - Math.max(0, Number(before.stars) || 0));
        if (starGain) changes.push(`<li><strong>${escapeHtml(agent.name)}</strong><span>+${starGain.toLocaleString()} GitHub stars since your last check</span></li>`);
      });
      const missingCount = Math.max(0, ids.length - saved.length);
      if (missingCount && previous?.projects) changes.push(`<li><strong>Coverage change</strong><span>${missingCount} saved project${missingCount === 1 ? '' : 's'} no longer appear in the current curated feed</span></li>`);
      const lastChecked = previous?.checkedAt && Number.isFinite(Date.parse(previous.checkedAt)) ? new Date(previous.checkedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      brief.innerHTML = previous?.projects
        ? `<div><span class="analysis-label">SINCE YOUR LAST VISIT${lastChecked ? ` · ${escapeHtml(lastChecked)}` : ''}</span><strong>${changes.length ? `${changes.length} material change${changes.length === 1 ? '' : 's'}` : 'No material changes'}</strong></div>${changes.length ? `<ul>${changes.slice(0, 5).join('')}</ul>` : '<p>Your saved projects have no new qualified needs or star growth yet. The Radar will check again on your next visit.</p>'}`
        : `<div><span class="analysis-label">MONITORING STARTED</span><strong>${saved.length} saved project${saved.length === 1 ? '' : 's'} now have a return baseline</strong></div><p>On your next visit, this brief will show new qualified needs and GitHub growth since today.</p>`;
      brief.hidden = false;
      localStorage.setItem(snapshotKey, JSON.stringify(current));
      if (cloud.available) cloud.set('saved', 'watchlist-snapshot', current).catch(() => {});
      grid.innerHTML = saved.slice(0, 8).map((agent) => {
        const movement = Number(agent.starDelta || agent.voteDelta || 0) > 0
          ? `+${Number(agent.starDelta || agent.voteDelta)} stars since last scan`
          : Number(agent.rankChange || 0) !== 0 ? `${Number(agent.rankChange) > 0 ? '↑' : '↓'}${Math.abs(Number(agent.rankChange))} rank change` : 'No material change this scan';
        const evidenceCount = (agent.evidenceIssues || []).length;
        return `<a class="watchlist-card" href="/agent/${encodeURIComponent(agent.slug || agent.id)}"><span>${escapeHtml(agent.category || 'AI Agent')}</span><h3>${escapeHtml(agent.name)}</h3><p>Radar ${Number(agent.score?.total || agent.radarScore || 0)} · ${evidenceCount} qualified need${evidenceCount === 1 ? '' : 's'}</p><small>${escapeHtml(movement)}</small></a>`;
      }).join('');
      section.hidden = false;
    } catch (_) { /* Validation work remains usable if the public feed is unavailable. */ }
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
      return `<article class="workspace-card"><div class="workspace-card-top"><span>${item.domain ? `${escapeHtml(item.domain)} · ` : ''}${escapeHtml(item.project || 'Opportunity validation')}</span><strong>${count}/4 steps · ${escapeHtml(decision)}</strong></div><h2><a href="/opportunity/${encodeURIComponent(item.id)}">${escapeHtml(item.title)}</a></h2>${item.pattern || item.sourceUrl ? `<p class="workspace-trace">${item.pattern ? escapeHtml(item.pattern) : 'Qualified demand'}${item.sourceUrl ? ' · GitHub source linked' : ''}</p>` : ''}<div class="workspace-bar"><span style="width:${Math.min(100, count / 4 * 100)}%"></span></div><p class="workspace-evidence"><strong>${interviews}</strong> interviews · <strong>${commitments}</strong> commitments</p>${action ? `<p class="workspace-next"><strong>Next:</strong> ${escapeHtml(action)}${item.dueDate ? ` · ${escapeHtml(item.dueDate)}` : ''}</p>` : ''}<p>${note ? escapeHtml(note.slice(0, 180)) : 'No research notes yet.'}${note.length > 180 ? '…' : ''}</p><div class="workspace-card-actions"><a href="/opportunity/${encodeURIComponent(item.id)}">Continue validation →</a><button type="button" data-brief="${escapeHtml(item.key)}">Export decision brief</button><button type="button" data-remove="${escapeHtml(item.key)}">Remove</button></div></article>`;
    }).join('');
    list.querySelectorAll('[data-brief]').forEach((button) => button.addEventListener('click', () => {
      const item = records().find((record) => record.key === button.dataset.brief);
      if (!item) return;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([decisionBrief(item)], { type: 'text/markdown;charset=utf-8' }));
      link.download = `${safeFilename(item.title)}-decision-brief.md`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 0);
      const message = document.querySelector('#workspace-due');
      message.textContent = 'Decision brief exported';
    }));
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
          domain: String(item.domain || '').slice(0, 80), pattern: String(item.pattern || '').slice(0, 120),
          sourceUrl: /^https:\/\/github\.com\//i.test(String(item.sourceUrl || '')) ? String(item.sourceUrl).slice(0, 500) : '',
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
  await Promise.allSettled([loadStarterRecommendations(), loadSavedWatchlist()]);
})();
