(() => {
  'use strict';

  const FREE_LIMIT = 10;
  const state = {
    agents: [],
    search: '',
    filter: 'All',
    unlocked: localStorage.getItem('radar_unlocked') === 'true'
  };

  const elements = {
    grid: document.getElementById('agent-grid'),
    search: document.getElementById('search-input'),
    filters: [...document.querySelectorAll('.filter-button')],
    resultCount: document.getElementById('result-count'),
    updatedAt: document.getElementById('updated-at'),
    paywall: document.getElementById('paywall'),
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

    return `<article class="agent-card">
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
      </div>
    </article>`;
  }

  function render() {
    const query = state.search.trim().toLowerCase();
    const filtered = state.agents.filter((agent) => {
      const textMatch = !query || `${agent.name || ''} ${agent.description || ''} ${agent.tagline || ''}`
        .toLowerCase()
        .includes(query);
      return textMatch && categoryMatches(agent, state.filter);
    });

    const visible = state.unlocked ? filtered : filtered.slice(0, FREE_LIMIT);
    elements.grid.innerHTML = visible.map(createCard).join('');
    elements.grid.setAttribute('aria-busy', 'false');
    elements.empty.hidden = visible.length > 0;
    elements.resultCount.textContent = state.unlocked
      ? `${visible.length} agent${visible.length === 1 ? '' : 's'} found`
      : `Showing ${visible.length} of ${filtered.length} matching agents`;
  }

  function configureAccess() {
    elements.paywall.hidden = state.unlocked;
  }

  async function loadAgents() {
    try {
      const response = await fetch('/api/get-agents');
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = await response.json();
      state.agents = (data.agents || []).sort((a, b) => Number(b.votes || 0) - Number(a.votes || 0));
      elements.updatedAt.textContent = data.updatedAt ? `Updated ${new Date(data.updatedAt).toLocaleString()}` : 'Waiting for first update';
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

  configureAccess();
  loadAgents();
})();

