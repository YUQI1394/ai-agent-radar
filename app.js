(() => {
  'use strict';

  const state = {
    agents: [],
    search: '',
    filter: 'All'
  };

  const elements = {
    grid: document.getElementById('agent-grid'),
    search: document.getElementById('search-input'),
    filters: [...document.querySelectorAll('.filter-button')],
    resultCount: document.getElementById('result-count'),
    updatedAt: document.getElementById('updated-at'),
    heroUpdatedAt: document.getElementById('hero-updated-at'),
    trendingWidget: document.getElementById('trending-widget'),
    trendingList: document.getElementById('trending-list'),
    empty: document.getElementById('empty-state')
  };

  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);

  const safeUrl = (value) => {
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '#';
    } catch { return '#'; }
  };

  function categoryMatches(agent, selected) {
    if (selected === 'All') return true;
    const tags = [...(agent.tags || []), ...(agent.topics || [])]
      .map((tag) => String(tag).toLowerCase());
    const aliases = {
      Marketing: /marketing|advertising|growth|sales|social media/,
      Coding: /coding|code|developer|programming|software|github|api/,
      Design: /design|creative|graphics|ui|ux|image|video/,
      Productivity: /productivity|workflow|automation|task|calendar|collaboration/
    };
    return tags.some((tag) => aliases[selected]?.test(tag));
  }

  function createCard(agent, index) {
    const topics = (agent.topics || []).slice(0, 3).map((topic) => `<span class="topic">${escapeHtml(topic)}</span>`).join('');
    const thumbnail = agent.thumbnail
      ? `<img class="agent-logo" src="${safeUrl(agent.thumbnail)}" alt="" loading="lazy">`
      : `<div class="agent-logo placeholder" aria-hidden="true">${escapeHtml((agent.name || 'AI').slice(0, 2).toUpperCase())}</div>`;
    const detailId = encodeURIComponent(agent.id || agent.slug || '');
    const shareText = `Just discovered ${agent.name || 'an AI Agent'} on AI Agent Radar 🚀 https://ai-agent-radar.vercel.app`;
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;

    return `<article id="agent-${detailId}" class="agent-card">
      <div class="card-top">
        ${thumbnail}
        <span class="votes" title="Product Hunt votes">▲ ${Number(agent.votes || 0).toLocaleString()}</span>
      </div>
      <h2>${index + 1}. ${escapeHtml(agent.name)}</h2>
      <p class="tagline">${escapeHtml(agent.tagline)}</p>
      <div class="topics">${topics || '<span class="topic">AI Agent</span>'}</div>
      <div class="card-actions">
        <a class="card-link details-link" href="/detail.html?id=${detailId}">Details</a>
        <a class="card-link visit-link" href="${safeUrl(agent.url)}" target="_blank" rel="noopener noreferrer">Visit ↗</a>
        <a class="card-link share-link" href="${shareUrl}" target="_blank" rel="noopener noreferrer" aria-label="Share ${escapeHtml(agent.name)} on X">Share on X</a>
      </div>
    </article>`;
  }

  function renderTrending() {
    const trendingAgents = [...state.agents]
      .sort((a, b) => Number(b.votes || 0) - Number(a.votes || 0))
      .slice(0, 5);

    elements.trendingList.innerHTML = trendingAgents.map((agent, index) => {
      const detailId = encodeURIComponent(agent.id || agent.slug || agent.name || '');
      return `<li class="trending-item">
        <span class="trending-rank">${index + 1}</span>
        <a class="trending-name" href="#agent-${detailId}" data-agent-target="agent-${detailId}">${escapeHtml(agent.name)}</a>
        <span class="trending-votes">▲ ${Number(agent.votes || 0).toLocaleString()}</span>
      </li>`;
    }).join('');

    elements.trendingWidget.hidden = trendingAgents.length === 0;
  }

  function render() {
    const query = state.search.trim().toLowerCase();
    const filtered = state.agents.filter((agent) => {
      const textMatch = !query || `${agent.name || ''} ${agent.description || ''}`
        .toLowerCase()
        .includes(query);
      return textMatch && categoryMatches(agent, state.filter);
    });

    elements.grid.innerHTML = filtered.map(createCard).join('');
    elements.grid.setAttribute('aria-busy', 'false');
    elements.empty.hidden = filtered.length > 0;
    elements.resultCount.textContent = `${filtered.length} agent${filtered.length === 1 ? '' : 's'} found`;
  }

  function hoursAgo(value) {
    const timestamp = new Date(value).getTime();
    if (!Number.isFinite(timestamp)) return null;
    return Math.max(0, Math.floor((Date.now() - timestamp) / 3600000));
  }

  function showUpdatedAt(value) {
    const hours = hoursAgo(value);
    const relative = hours === null ? 'Waiting for first update' : `Updated ${hours} hour${hours === 1 ? '' : 's'} ago`;
    elements.updatedAt.textContent = relative;
    elements.heroUpdatedAt.textContent = hours === null
      ? 'Updated every 6 hours • Last updated: pending'
      : `Updated every 6 hours • Last updated: ${hours} hour${hours === 1 ? '' : 's'} ago`;
    document.title = hours === null ? 'AI Agent Radar' : `AI Agent Radar — ${relative}`;
  }

  async function loadAgents() {
    try {
      const response = await fetch('/api/get-agents');
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = await response.json();
      state.agents = (data.agents || []).sort((a, b) => Number(b.votes || 0) - Number(a.votes || 0));
      showUpdatedAt(data.updatedAt);
      renderTrending();
      render();
    } catch (error) {
      elements.grid.setAttribute('aria-busy', 'false');
      elements.grid.innerHTML = `<div class="error-state"><h2>Could not load agents</h2><p>${escapeHtml(error.message)}. Please try again shortly.</p></div>`;
      elements.resultCount.textContent = 'Feed unavailable';
    }
  }

  elements.search.addEventListener('input', (event) => { state.search = event.target.value; render(); });
  elements.filters.forEach((button) => button.addEventListener('click', () => {
    state.filter = button.dataset.filter;
    elements.filters.forEach((item) => item.classList.toggle('active', item === button));
    render();
  }));
  elements.grid.addEventListener('click', (event) => {
    const shareLink = event.target.closest('.share-link');
    if (!shareLink) return;
    event.preventDefault();
    window.open(shareLink.href, 'share-on-x', 'popup,width=680,height=520,noopener,noreferrer');
  });
  elements.trendingList.addEventListener('click', (event) => {
    const link = event.target.closest('[data-agent-target]');
    if (!link) return;

    const target = document.getElementById(link.dataset.agentTarget);
    if (!target) return;

    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('agent-card-highlighted');
    window.setTimeout(() => target.classList.remove('agent-card-highlighted'), 1600);
  });

  loadAgents();
})();

