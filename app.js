(() => {
  'use strict';

  const CATEGORIES = ['All', 'Marketing', 'Coding', 'Design', 'Productivity'];
  const SAVED_KEY = 'ai-agent-radar-saved';

  function readSavedAgents() {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
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

  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);
  const safeUrl = (value) => {
    try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : '#'; }
    catch { return '#'; }
  };
  const agentKey = (agent) => String(agent.id || agent.slug || agent.name || '');
  const ageInHours = (agent) => {
    const timestamp = new Date(agent.createdAt).getTime();
    return Number.isFinite(timestamp) ? Math.max(0, (Date.now() - timestamp) / 3600000) : Infinity;
  };

  function categoryMatches(agent, selected) {
    if (selected === 'All') return true;
    if (selected === 'Saved') return state.saved.has(agentKey(agent));
    const tags = [...(agent.tags || []), ...(agent.topics || []), ...(agent.topicSlugs || [])].map((tag) => String(tag).toLowerCase());
    const aliases = {
      Marketing: /marketing|advertising|growth|sales|social.?media/,
      Coding: /coding|code|developer|programming|software|github|api/,
      Design: /design|creative|graphics|ui|ux|image|video/,
      Productivity: /productivity|workflow|automation|task|calendar|collaboration/
    };
    return tags.some((tag) => aliases[selected]?.test(tag));
  }

  const primaryCategory = (agent) => CATEGORIES.slice(1).find((category) => categoryMatches(agent, category)) || 'AI Agent';

  function radarScore(agent) {
    const votes = Math.max(0, Number(agent.votes || 0));
    const voteSignal = Math.min(65, Math.round(Math.log10(votes + 1) * 22));
    const hours = ageInHours(agent);
    const freshnessSignal = hours <= 24 ? 25 : hours <= 72 ? 21 : hours <= 168 ? 16 : hours <= 720 ? 9 : 3;
    const searchable = `${agent.name || ''} ${agent.tagline || ''} ${agent.description || ''} ${(agent.topics || []).join(' ')}`;
    return Math.min(100, voteSignal + freshnessSignal + (/agent|autonomous|copilot|assistant|workflow|automation/i.test(searchable) ? 10 : 6));
  }

  function signalFor(agent) {
    const hours = ageInHours(agent);
    if (hours <= 24) return { label: 'NEW', className: 'signal-new' };
    if (hours <= 72) return { label: 'FRESH', className: 'signal-fresh' };
    if (agent.radarScore >= 78) return { label: 'TRENDING', className: 'signal-trending' };
    return { label: 'DISCOVERED', className: 'signal-discovered' };
  }

  function sortAgents(agents) {
    return [...agents].sort((a, b) => {
      if (state.sort === 'newest') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      if (state.sort === 'votes') return Number(b.votes || 0) - Number(a.votes || 0);
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
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Just discovered ${agent.name || 'an AI Agent'} on AI Agent Radar 🚀 https://ai-agent-radar.vercel.app`)}`;
    const signal = signalFor(agent);
    const isSaved = state.saved.has(key);
    return `<article id="agent-${detailId}" class="agent-card">
      <div class="card-top">${thumbnail}<div class="card-signals"><span class="signal-badge ${signal.className}">${signal.label}</span><button class="save-button${isSaved ? ' saved' : ''}" type="button" data-save-id="${escapeHtml(key)}" aria-pressed="${isSaved}" aria-label="${isSaved ? 'Remove' : 'Save'} ${escapeHtml(agent.name)}">${isSaved ? '♥' : '♡'}</button></div></div>
      <div class="score-row"><span class="radar-score">Radar Score <strong>${agent.radarScore}</strong></span><span class="votes" title="Product Hunt votes">▲ ${Number(agent.votes || 0).toLocaleString()}</span></div>
      <h2>${index + 1}. ${escapeHtml(agent.name)}</h2>
      <p class="tagline">${escapeHtml(agent.tagline)}</p>
      <p class="best-for">Best for: <strong>${escapeHtml(primaryCategory(agent))}</strong></p>
      <div class="topics">${topics || '<span class="topic">AI Agent</span>'}</div>
      <div class="card-actions"><a class="card-link details-link" href="/detail.html?id=${detailId}">Details</a><a class="card-link visit-link" href="${safeUrl(agent.url)}" target="_blank" rel="noopener noreferrer">Visit ↗</a><a class="card-link share-link" href="${shareUrl}" target="_blank" rel="noopener noreferrer" aria-label="Share ${escapeHtml(agent.name)} on X">Share on X</a></div>
    </article>`;
  }

  function renderTrending() {
    const leaders = [...state.agents].sort((a, b) => b.radarScore - a.radarScore).slice(0, 5);
    elements.trendingList.innerHTML = leaders.map((agent, index) => {
      const detailId = encodeURIComponent(agentKey(agent));
      return `<li class="trending-item"><span class="trending-rank">${index + 1}</span><a class="trending-name" href="#agent-${detailId}" data-agent-target="agent-${detailId}">${escapeHtml(agent.name)}</a><span class="trending-votes">Score ${agent.radarScore}</span></li>`;
    }).join('');
    elements.trendingWidget.hidden = leaders.length === 0;
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
    elements.statNew.textContent = state.agents.filter((agent) => ageInHours(agent) <= 168).length.toLocaleString();
    elements.statCategory.textContent = counts[leading] ? leading : 'Mixed';
    elements.statTop.textContent = top?.name || '—';
  }

  function render() {
    const query = state.search.trim().toLowerCase();
    const filtered = sortAgents(state.agents.filter((agent) => {
      const textMatch = !query || `${agent.name || ''} ${agent.description || ''}`.toLowerCase().includes(query);
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
    const relative = hours === null ? 'Waiting for first update' : `Updated ${hours} hour${hours === 1 ? '' : 's'} ago`;
    elements.updatedAt.textContent = relative;
    elements.heroUpdatedAt.textContent = hours === null ? 'Updated every 6 hours • Last updated: pending' : `Updated every 6 hours • Last updated: ${hours} hour${hours === 1 ? '' : 's'} ago`;
    document.title = hours === null ? 'AI Agent Radar' : `AI Agent Radar — ${relative}`;
  }

  async function loadAgents() {
    try {
      const response = await fetch('/api/get-agents');
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = await response.json();
      state.agents = (data.agents || []).map((agent) => ({ ...agent, radarScore: radarScore(agent) }));
      showUpdatedAt(data.updatedAt); renderTrending(); render();
    } catch (error) {
      elements.grid.setAttribute('aria-busy', 'false');
      elements.grid.innerHTML = `<div class="error-state"><h2>Could not load agents</h2><p>${escapeHtml(error.message)}. Please try again shortly.</p></div>`;
      elements.resultCount.textContent = 'Feed unavailable';
    }
  }

  elements.search.addEventListener('input', (event) => { state.search = event.target.value; render(); });
  elements.filters.forEach((button) => button.addEventListener('click', () => { state.filter = button.dataset.filter; elements.filters.forEach((item) => item.classList.toggle('active', item === button)); render(); }));
  elements.sorts.forEach((button) => button.addEventListener('click', () => { state.sort = button.dataset.sort; elements.sorts.forEach((item) => item.classList.toggle('active', item === button)); render(); }));
  elements.grid.addEventListener('click', (event) => {
    const saveButton = event.target.closest('[data-save-id]');
    if (saveButton) {
      const key = saveButton.dataset.saveId;
      state.saved.has(key) ? state.saved.delete(key) : state.saved.add(key);
      localStorage.setItem(SAVED_KEY, JSON.stringify([...state.saved]));
      render(); return;
    }
    const shareLink = event.target.closest('.share-link');
    if (shareLink) { event.preventDefault(); window.open(shareLink.href, 'share-on-x', 'popup,width=680,height=520,noopener,noreferrer'); }
  });
  elements.trendingList.addEventListener('click', (event) => {
    const link = event.target.closest('[data-agent-target]');
    if (!link) return;
    const target = document.getElementById(link.dataset.agentTarget);
    if (!target) return;
    event.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('agent-card-highlighted'); window.setTimeout(() => target.classList.remove('agent-card-highlighted'), 1600);
  });

  loadAgents();
})();
