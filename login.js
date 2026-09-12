(() => {
  const card = document.querySelector('.auth-card');
  card.querySelector('.eyebrow').textContent = 'FREE 7-DAY VALIDATION WORKSPACE';
  card.querySelector('h1').innerHTML = 'Turn one signal into a <span>decision</span>';
  const introduction = card.querySelector('h1 + p');
  introduction.textContent = 'Registration unlocks an execution plan—not more reading. Start with one GitHub-backed need and work toward a Build, Narrow or Stop decision.';
  introduction.insertAdjacentHTML('afterend', '<ul class="auth-benefits"><li><strong>A concrete first action</strong><span>Automatically scheduled when you start a sprint.</span></li><li><strong>Evidence, not memory</strong><span>Track interviews, behavioral commitments and exact user language.</span></li><li><strong>A decision brief you can use</strong><span>Export a readable Build, Narrow or Stop report—not a data dump.</span></li></ul><section class="outcome-preview" aria-labelledby="outcome-preview-title"><div class="outcome-preview-heading"><span>WHAT YOU LEAVE WITH</span><strong id="outcome-preview-title">A decision—not another bookmark</strong></div><div class="outcome-preview-body"><p><span>Example outcome</span><strong>Provider timeout recovery for support agents</strong></p><dl><div><dt>Evidence</dt><dd>5 interviews · 3 commitments</dd></div><div><dt>Decision</dt><dd class="outcome-build">BUILD A NARROW PILOT</dd></div><div><dt>Next action</dt><dd>Run a manual recovery test with two teams</dd></div></dl></div></section>');
  document.querySelector('#magic-link-form button').textContent = 'Start free by email';
  const loading = document.querySelector('#auth-loading');
  const actions = document.querySelector('#auth-actions');
  const status = document.querySelector('#auth-status');
  const next = window.RadarAuth.next(new URLSearchParams(location.search).get('next') || sessionStorage.getItem('ai-agent-radar:auth-next') || '/workspace');
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
