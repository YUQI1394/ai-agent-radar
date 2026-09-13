(() => {
  const card = document.querySelector('.auth-card');
  card.querySelector('.eyebrow').textContent = 'FREE 7-DAY VALIDATION WORKSPACE';
  card.querySelector('h1').innerHTML = 'Turn one signal into a <span>decision</span>';
  const introduction = card.querySelector('h1 + p');
  introduction.textContent = 'Registration unlocks an execution plan—not more reading. Start with one GitHub-backed need and work toward a Build, Narrow or Stop decision.';
  introduction.insertAdjacentHTML('afterend', '<ul class="auth-benefits"><li><strong>A concrete first action</strong><span>Automatically scheduled when you start a sprint.</span></li><li><strong>Evidence, not memory</strong><span>Track interviews, behavioral commitments and exact user language.</span></li><li><strong>A watchlist that moves</strong><span>See demand evidence, star growth and rank changes for saved projects.</span></li><li><strong>A decision brief you can use</strong><span>Export a readable Build, Narrow or Stop report—not a data dump.</span></li></ul><section class="registration-personalizer" aria-labelledby="registration-personalizer-title"><div><span>PERSONALIZE YOUR START</span><label id="registration-personalizer-title" for="registration-domain">Choose your professional field</label></div><select id="registration-domain"><option>Research</option><option>Security</option><option>Finance</option><option>Marketing</option><option>Coding</option><option>Design</option><option>Productivity</option><option>Agent Infrastructure</option></select><article id="registration-recommendation" aria-live="polite"><p>Loading a current GitHub-backed need…</p></article><small>Public evidence stays free. Registration saves your sprint and syncs progress.</small></section><section class="outcome-preview" aria-labelledby="outcome-preview-title"><div class="outcome-preview-heading"><span>WHAT YOU LEAVE WITH</span><strong id="outcome-preview-title">A decision—not another bookmark</strong></div><div class="outcome-preview-body"><p><span>Example outcome</span><strong>Provider timeout recovery for support agents</strong></p><dl><div><dt>Evidence</dt><dd>5 interviews · 3 commitments</dd></div><div><dt>Decision</dt><dd class="outcome-build">BUILD A NARROW PILOT</dd></div><div><dt>Next action</dt><dd>Run a manual recovery test with two teams</dd></div></dl></div></section>');
  const domainSelect = document.querySelector('#registration-domain');
  const recommendation = document.querySelector('#registration-recommendation');
  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  const rememberedDomain = localStorage.getItem('ai-agent-radar:preferred-domain');
  if ([...domainSelect.options].some((option) => option.value === rememberedDomain)) domainSelect.value = rememberedDomain;
  let liveOpportunities = [];
  const strength = (item) => {
    const ageDays = Math.max(0, (Date.now() - Date.parse(item.updatedAt)) / 86400000);
    const freshness = Number.isFinite(ageDays) ? ageDays <= 30 ? 10 : ageDays <= 90 ? 7 : ageDays <= 365 ? 3 : 0 : 0;
    return Math.min(24, Math.log2(item.comments + 1) * 4.5) + Math.min(24, Math.log2(item.reactions + 1) * 6) + freshness + item.radar / 20;
  };
  const renderRecommendation = () => {
    const domain = domainSelect.value;
    localStorage.setItem('ai-agent-radar:preferred-domain', domain);
    const item = liveOpportunities.filter((candidate) => candidate.domain === domain).sort((a, b) => strength(b) - strength(a))[0];
    recommendation.innerHTML = item
      ? `<span>LIVE GITHUB-BACKED NEED · ${escapeHtml(domain.toUpperCase())}</span><strong>${escapeHtml(item.title)}</strong><p>${item.comments} comments · ${item.reactions} reactions · found in ${escapeHtml(item.project)}</p><div><button class="button button-primary" type="button" data-start-opportunity="${encodeURIComponent(item.id)}" data-start-title="${escapeHtml(item.title)}">Use this need as my first sprint</button><a href="/opportunity/${encodeURIComponent(item.id)}">Inspect the public evidence →</a></div>`
      : `<strong>No current need clears the evidence threshold in ${escapeHtml(domain)}.</strong><p>Choose another field or browse the complete public Radar.</p><a href="/opportunities">Browse all current opportunities →</a>`;
  };
  domainSelect.addEventListener('change', renderRecommendation);
  recommendation.addEventListener('click', (event) => {
    const button = event.target.closest('[data-start-opportunity]');
    if (!button) return;
    next = `/opportunity/${button.dataset.startOpportunity}#validation-start`;
    sessionStorage.setItem('ai-agent-radar:auth-next', next);
    recommendation.querySelectorAll('[data-start-opportunity]').forEach((item) => { item.disabled = item !== button; });
    button.textContent = 'Selected · continue below to sign in';
    show(`Your first sprint is ready: ${button.dataset.startTitle}`);
    actions.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.querySelector('#auth-email')?.focus({ preventScroll: true });
  });
  fetch('/api/get-agents').then(async (response) => {
    if (!response.ok) throw new Error('Live recommendations are temporarily unavailable');
    const payload = await response.json();
    liveOpportunities = (Array.isArray(payload.agents) ? payload.agents : []).flatMap((agent) => (Array.isArray(agent.evidenceIssues) ? agent.evidenceIssues : []).filter((issue) => /^\d+$/.test(String(issue.id || '')) && issue.title).map((issue) => ({
      id: String(issue.id), title: String(issue.title), domain: String(agent.category || ''), project: String(agent.name || agent.slug || 'Open-source project'),
      comments: Math.max(0, Number(issue.comments) || 0), reactions: Math.max(0, Number(issue.reactions) || 0), updatedAt: String(issue.updatedAt || issue.createdAt || ''), radar: Math.max(0, Number(agent.score?.total) || 0)
    })));
    renderRecommendation();
  }).catch(() => {
    recommendation.innerHTML = '<strong>Live preview is temporarily unavailable.</strong><p>You can still create a free workspace and choose from current evidence after signing in.</p>';
  });
  document.querySelector('#magic-link-form button').textContent = 'Start free by email';
  const loading = document.querySelector('#auth-loading');
  const actions = document.querySelector('#auth-actions');
  const status = document.querySelector('#auth-status');
  let next = window.RadarAuth.next(new URLSearchParams(location.search).get('next') || sessionStorage.getItem('ai-agent-radar:auth-next') || '/workspace');
  const show = (message, isError = false) => { status.textContent = message; status.classList.toggle('error', isError); };
  window.RadarAuth.ready.then((auth) => {
    loading.hidden = true;
    if (auth.user) {
      sessionStorage.removeItem('ai-agent-radar:auth-next');
      location.replace(next);
      return;
    }
    if (!auth.configured || auth.error) {
      loading.hidden = false;
      loading.textContent = auth.error || 'Registration setup is being completed. Please check back shortly.';
      return;
    }
    document.querySelectorAll('[data-provider]').forEach((button) => { button.hidden = !auth.providers.includes(button.dataset.provider); });
    actions.hidden = false;
    if (auth.callbackError) show(`Sign-in wasn't completed: ${auth.callbackError}. Please try again.`, true);
  });
  document.querySelectorAll('[data-provider]').forEach((button) => button.addEventListener('click', async () => {
    button.disabled = true; show('Opening secure sign-in…');
    try { await window.RadarAuth.signIn(button.dataset.provider, next); }
    catch (error) { show(error.message, true); button.disabled = false; }
  }));
  document.querySelector('#magic-link-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button');
    button.disabled = true; show('Sending your secure sign-in link…');
    try { await window.RadarAuth.sendMagicLink(event.currentTarget.email.value, next); show('Check your inbox. The sign-in link may take a minute to arrive.'); }
    catch (error) { show(error.message, true); }
    finally { button.disabled = false; }
  });
})();
