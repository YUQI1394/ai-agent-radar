(() => {
  'use strict';

  const CATEGORIES = ['All', 'Research', 'Security', 'Finance', 'Marketing', 'Coding', 'Design', 'Productivity', 'Agent Infrastructure'];
  const LEGACY_SAVED_KEY = 'ai-agent-radar-saved';
  const savedStorageKey = () => window.RadarAuth?.user ? window.RadarAuth.savedKey() : LEGACY_SAVED_KEY;

  function readSavedAgents() {
    try {
      const saved = JSON.parse(localStorage.getItem(savedStorageKey()) || '[]');
      return new Set(Array.isArray(saved) ? saved.map(String) : []);
    } catch { return new Set(); }
  }

  const state = { agents: [], search: '', filter: 'All', sort: 'radar', saved: readSavedAgents() };
  const elements = {
    grid: document.getElementById('agent-grid'), search: document.getElementById('search-input'),
    filters: [...document.querySelectorAll('.filter-button')], sorts: [...document.querySelectorAll('.sort-button')],
    counts: [...document.querySelectorAll('[data-count]')], resultCount: document.getElementById('result-count'),
    updatedAt: document.getElementById('updated-at'), heroUpdatedAt: document.getElementById('hero-updated-at'),
    trendingWidget: document.getElementById('trending-widget'), trendingList: document.getElementById('trending-list'),
    empty: document.getElementById('empty-state'), statTotal: document.getElementById('stat-total'),
    statNew: document.getElementById('stat-new'), statCategory: document.getElementById('stat-category'),
    statTop: document.getElementById('stat-top')
  };
  if (location.hash === '#saved') {
    state.filter = 'Saved';
    elements.filters.forEach((button) => button.classList.toggle('active', button.dataset.filter === 'Saved'));
  }

  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);
  const safeUrl = (value) => {
    try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : '#'; }
    catch { return '#'; }
  };
  const agentKey = (agent) => String(agent.id || agent.slug || agent.name || '');
  const ageInHours = (agent) => {
    const timestamp = new Date(agent.pushedAt || agent.updatedAt || agent.createdAt).getTime();
    return Number.isFinite(timestamp) ? Math.max(0, (Date.now() - timestamp) / 3600000) : Infinity;
  };

  function categoryMatches(agent, selected) {
    if (selected === 'All') return true;
    if (selected === 'Saved') return state.saved.has(agentKey(agent));
    if (agent.category === selected) return true;
    const tags = [...(agent.tags || []), ...(agent.topics || []), ...(agent.topicSlugs || [])].map((tag) => String(tag).toLowerCase());
    const aliases = {
      Research: /research|academic|scientific|literature|knowledge|retriev|rag/,
      Security: /security|cyber|pentest|penetration.?test|red.?team|malware|vulnerab|threat|reverse.?engineering/,
      Finance: /finance|fintech|trading|investment|quant|stock|portfolio|accounting/,
      Marketing: /marketing|advertising|growth|sales|social.?media/,
      Coding: /coding|code|developer|programming|software|github|api/,
      Design: /design|creative|graphics|ui|ux|image|video/,
      Productivity: /productivity|workflow|automation|task|calendar|collaboration/
    };
    return tags.some((tag) => aliases[selected]?.test(tag));
  }

  const primaryCategory = (agent) => agent.category || CATEGORIES.slice(1).find((category) => categoryMatches(agent, category)) || 'AI Agent';

  function radarScore(agent) {
    if (Number.isFinite(Number(agent.score?.total))) return Number(agent.score.total);
    const votes = Math.max(0, Number(agent.stars ?? agent.votes ?? 0));
    const voteSignal = Math.min(65, Math.round(Math.log10(votes + 1) * 22));
    const hours = ageInHours(agent);
    const freshnessSignal = hours <= 24 ? 25 : hours <= 72 ? 21 : hours <= 168 ? 16 : hours <= 720 ? 9 : 3;
    const searchable = `${agent.name || ''} ${agent.tagline || ''} ${agent.description || ''} ${(agent.topics || []).join(' ')}`;
    return Math.min(100, voteSignal + freshnessSignal + (/agent|autonomous|copilot|assistant|workflow|automation/i.test(searchable) ? 10 : 6));
  }

  function signalFor(agent) {
    if (Number(agent.voteDelta || 0) > 0 || Number(agent.rankChange || 0) > 0) return { label: 'RISING', className: 'signal-trending' };
    const hours = ageInHours(agent);
    if (hours <= 24) return { label: 'NEW', className: 'signal-new' };
    if (hours <= 72) return { label: 'FRESH', className: 'signal-fresh' };
    if (agent.radarScore >= 78) return { label: 'TRENDING', className: 'signal-trending' };
    return { label: 'DISCOVERED', className: 'signal-discovered' };
  }

  function sortAgents(agents) {
    return [...agents].sort((a, b) => {
      if (state.sort === 'newest') return new Date(b.pushedAt || b.updatedAt || b.createdAt || 0) - new Date(a.pushedAt || a.updatedAt || a.createdAt || 0);
      if (state.sort === 'votes') return Number(b.stars ?? b.votes ?? 0) - Number(a.stars ?? a.votes ?? 0);
      return b.radarScore - a.radarScore || Number(b.votes || 0) - Number(a.votes || 0);
    });
  }

  function createCard(agent, index) {
    const topics = (agent.topics || []).slice(0, 3).map((topic) => `<span class="topic">${escapeHtml(topic)}</span>`).join('');
    const thumbnail = agent.thumbnail
      ? `<img class="agent-logo" src="${safeUrl(agent.thumbnail)}" alt="" loading="lazy">`
      : `<div class="agent-logo placeholder" aria-hidden="true">${escapeHtml((agent.name || 'AI').slice(0, 2).toUpperCase())}</div>`;
    const key = agentKey(agent);
    const detailId = encodeURIComponent(key);
    const detailSlug = encodeURIComponent(agent.slug || agent.id || key);
    const signal = signalFor(agent);
    const score = agent.score || { total: agent.radarScore, adoption: 0, maintenance: 0, quality: 0, relevance: 0, demand: 0, momentum: 0 };
    const peer = state.agents.filter((item) => agentKey(item) !== key).sort((a, b) => {
      const aShared = (a.topics || []).filter((topic) => (agent.topics || []).includes(topic)).length;
      const bShared = (b.topics || []).filter((topic) => (agent.topics || []).includes(topic)).length;
      return bShared - aShared || b.radarScore - a.radarScore;
    })[0];
    const compareHref = peer ? `/compare?agents=${encodeURIComponent(agent.slug || agent.id)},${encodeURIComponent(peer.slug || peer.id)}` : `/agent/${detailSlug}`;
    const isSaved = state.saved.has(key);
    return `<article id="agent-${detailId}" class="agent-card">
      <div class="card-top">${thumbnail}<div class="card-signals"><span class="signal-badge ${signal.className}">${signal.label}</span><button class="save-button${isSaved ? ' saved' : ''}" type="button" data-save-id="${escapeHtml(key)}" aria-pressed="${isSaved}" aria-label="${isSaved ? 'Remove' : 'Save'} ${escapeHtml(agent.name)}">${isSaved ? '♥' : '♡'}</button></div></div>
      <div class="score-row"><span class="radar-score" title="Adoption ${score.adoption ?? score.community}/25 · Maintenance ${score.maintenance ?? score.freshness}/20 · Project quality ${score.quality || 0}/20 · Relevance ${score.relevance}/20 · Demand ${score.demand || 0}/10 · Momentum ${score.momentum}/5">Radar Score <strong>${agent.radarScore}</strong></span><span class="votes" title="GitHub stars">★ ${Number(agent.stars ?? agent.votes ?? 0).toLocaleString()}${Number(agent.starDelta ?? agent.voteDelta ?? 0) > 0 ? ` <small>+${Number(agent.starDelta ?? agent.voteDelta)}</small>` : ''}</span></div>
      <h2>${index + 1}. ${escapeHtml(agent.name)}</h2>
      <p class="tagline">${escapeHtml(agent.tagline)}</p>
      <p class="best-for">Best for: <strong>${escapeHtml(primaryCategory(agent))}</strong></p>
      <div class="repo-facts" aria-label="Repository evidence"><span class="quality-label">${escapeHtml(agent.qualityLabel || 'REVIEWED')}</span>${Number(agent.painSignals || 0) ? `<span class="demand-label">${Number(agent.painSignals)} demand signal${Number(agent.painSignals) === 1 ? '' : 's'}</span>` : ''}<span>${escapeHtml(agent.language || 'Unknown')}</span><span>${escapeHtml(agent.license || 'No license')}</span><span>⑂ ${Number(agent.forks || 0).toLocaleString()} forks</span><span>◯ ${Number(agent.openIssues || 0).toLocaleString()} issues</span></div>
      <div class="topics">${topics || '<span class="topic">AI Agent</span>'}</div>
      <div class="card-actions"><a class="card-link details-link" href="/agent/${detailSlug}">Analysis</a><a class="card-link compare-link" href="${compareHref}">Compare</a><a class="card-link visit-link" href="${safeUrl(agent.githubUrl || agent.url)}" target="_blank" rel="noopener noreferrer">GitHub ↗</a><a class="card-link share-link" href="/agent/${detailSlug}" data-share-url="/agent/${detailSlug}" data-share-title="${escapeHtml(agent.name)} · AI Agent Radar" aria-label="Share ${escapeHtml(agent.name)}">Share</a></div>
    </article>`;
  }

  function renderTrending() {
    const leaders = [...state.agents].sort((a, b) => b.radarScore - a.radarScore).slice(0, 5);
    elements.trendingList.innerHTML = leaders.map((agent, index) => {
      const detailSlug = encodeURIComponent(agent.slug || agent.id || agentKey(agent));
      const movement = Number(agent.starDelta ?? agent.voteDelta ?? 0) > 0 ? ` · +${Number(agent.starDelta ?? agent.voteDelta)} stars` : Number(agent.rankChange || 0) > 0 ? ` · ↑${Number(agent.rankChange)}` : '';
      return `<li class="trending-item"><span class="trending-rank">${index + 1}</span><a class="trending-name" href="/agent/${detailSlug}">${escapeHtml(agent.name)}</a><span class="trending-votes">Score ${agent.radarScore}${movement}</span></li>`;
    }).join('');
    elements.trendingWidget.hidden = leaders.length === 0;
  }

  function renderRadarField() {
    const nodes = [...document.querySelectorAll('[data-radar-node]')];
    const leader = [...state.agents].sort((a, b) => b.radarScore - a.radarScore)[0];
    const issues = state.agents.flatMap((agent) => (agent.evidenceIssues || []).map((issue) => ({ agent, issue })))
      .sort((a, b) => Number(b.issue.reactions || 0) - Number(a.issue.reactions || 0) || Number(b.issue.comments || 0) - Number(a.issue.comments || 0));
    const strongest = issues[0];
    const labels = [
      leader ? `${leader.name} · ${leader.radarScore}` : 'project signal pending',
      strongest ? `${String(strongest.issue.title || 'Demand signal').slice(0, 34)}${String(strongest.issue.title || '').length > 34 ? '…' : ''}` : 'demand signal pending',
      `${issues.length} qualified needs · ${CATEGORIES.length - 1} fields`
    ];
    const titles = [
      leader ? `${leader.name} · ${primaryCategory(leader)} · Radar ${leader.radarScore}` : labels[0],
      strongest ? `${strongest.issue.title} · ${strongest.agent.name} · ${Number(strongest.issue.comments || 0)} comments` : labels[1],
      `${issues.length} traceable GitHub demand signals across ${CATEGORIES.length - 1} professional fields`
    ];
    nodes.forEach((node, index) => { node.textContent = labels[index]; node.title = titles[index]; });
  }

  function renderCountsAndSummary() {
    const counts = Object.fromEntries(CATEGORIES.map((category) => [category, state.agents.filter((agent) => categoryMatches(agent, category)).length]));
    elements.counts.forEach((element) => {
      const value = element.dataset.count === 'Saved' ? state.saved.size : counts[element.dataset.count];
      element.textContent = `(${value || 0})`;
    });
    const leading = CATEGORIES.slice(1).sort((a, b) => counts[b] - counts[a])[0];
    const top = [...state.agents].sort((a, b) => b.radarScore - a.radarScore)[0];
    elements.statTotal.textContent = state.agents.length.toLocaleString();
    elements.statNew.textContent = state.agents.reduce((sum, agent) => sum + (agent.evidenceIssues || []).length, 0).toLocaleString();
    elements.statCategory.textContent = counts[leading] ? leading : 'Mixed';
    elements.statTop.textContent = top?.name || '—';
  }

  function render() {
    const query = state.search.trim().toLowerCase();
    const filtered = sortAgents(state.agents.filter((agent) => {
      const textMatch = !query || `${agent.name || ''} ${agent.description || ''} ${agent.language || ''} ${agent.license || ''} ${(agent.topics || []).join(' ')}`.toLowerCase().includes(query);
      return textMatch && categoryMatches(agent, state.filter);
    }));
    elements.grid.innerHTML = filtered.map(createCard).join('');
    elements.grid.setAttribute('aria-busy', 'false');
    elements.empty.hidden = filtered.length > 0;
    elements.resultCount.textContent = `${filtered.length} agent${filtered.length === 1 ? '' : 's'} found`;
    renderCountsAndSummary();
  }

  function showUpdatedAt(value) {
    const timestamp = new Date(value).getTime();
    const hours = Number.isFinite(timestamp) ? Math.max(0, Math.floor((Date.now() - timestamp) / 3600000)) : null;
    const relative = hours === null ? 'Waiting for first update' : hours === 0 ? 'Updated just now' : `Updated ${hours} hour${hours === 1 ? '' : 's'} ago`;
    elements.updatedAt.textContent = relative;
    elements.heroUpdatedAt.textContent = hours === null ? 'Updated every 6 hours • Last updated: pending' : hours === 0 ? 'Updated every 6 hours • Last updated: just now' : `Updated every 6 hours • Last updated: ${hours} hour${hours === 1 ? '' : 's'} ago`;
    document.title = hours === null ? 'AI Agent Radar' : `AI Agent Radar — ${relative}`;
  }

  async function loadAgents() {
    try {
      const response = await fetch('/api/get-agents');
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = await response.json();
      state.agents = (data.agents || []).map((agent) => ({ ...agent, radarScore: radarScore(agent) }));
      showUpdatedAt(data.updatedAt); renderRadarField(); renderTrending(); render();
    } catch (error) {
      elements.grid.setAttribute('aria-busy', 'false');
      elements.grid.innerHTML = `<div class="error-state"><h2>Could not load agents</h2><p>${escapeHtml(error.message)}. Please try again shortly.</p></div>`;
      elements.resultCount.textContent = 'Feed unavailable';
    }
  }

  elements.search.addEventListener('input', (event) => { state.search = event.target.value; render(); });
  elements.filters.forEach((button) => button.addEventListener('click', () => { state.filter = button.dataset.filter; elements.filters.forEach((item) => item.classList.toggle('active', item === button)); render(); }));
  elements.sorts.forEach((button) => button.addEventListener('click', () => { state.sort = button.dataset.sort; elements.sorts.forEach((item) => item.classList.toggle('active', item === button)); render(); }));
  elements.grid.addEventListener('click', async (event) => {
    const saveButton = event.target.closest('[data-save-id]');
    if (saveButton) {
      if (!window.RadarAuth) {
        location.assign(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
        return;
      }
      const auth = await window.RadarAuth.ready;
      if (!auth.user) {
        location.assign(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
        return;
      }
      const key = saveButton.dataset.saveId;
      state.saved.has(key) ? state.saved.delete(key) : state.saved.add(key);
      localStorage.setItem(savedStorageKey(), JSON.stringify([...state.saved]));
      window.RadarCloud.ready.then((cloud) => {
        if (cloud.available) cloud.set('saved', 'agents', { ids: [...state.saved] }).catch(() => {});
      });
      render(); return;
    }
  });
  async function syncAccountState() {
    const auth = await window.RadarAuth.ready;
    if (auth.user) state.saved = readSavedAgents();
    if (window.RadarCloud) window.RadarCloud.ready.then(async (cloud) => {
      if (auth.user && cloud.available) {
        try {
          const remote = await cloud.get('saved', 'agents');
          if (Array.isArray(remote?.ids)) {
            state.saved = new Set(remote.ids.map(String));
            localStorage.setItem(savedStorageKey(), JSON.stringify([...state.saved]));
          } else if (state.saved.size) await cloud.set('saved', 'agents', { ids: [...state.saved] });
        } catch (_) { /* Keep local saved agents available offline. */ }
      }
      render();
    });
  }
  loadAgents();
  if (window.RadarAuth) syncAccountState();
  else document.addEventListener('radar:auth-ready', syncAccountState, { once: true });
})();
