(async () => {
  const grid = document.querySelector('.coach-grid');
  if (!grid) return;
  const nav = document.querySelector('.site-nav');
  if (nav && !nav.querySelector('[href="/patterns"]')) {
    const link = document.createElement('a');
    link.href = '/patterns';
    link.textContent = 'Patterns';
    nav.querySelector('[href="/weekly"]')?.before(link);
  }
  if (nav && !nav.querySelector('[href="/workspace"]')) {
    const link = document.createElement('a');
    link.href = '/workspace';
    link.textContent = 'Workspace';
    nav.querySelector('[href="/weekly"]')?.before(link);
  }
  const auth = await window.RadarAuth.ready;
  const opportunityId = location.pathname.split('/').filter(Boolean).pop();
  if (!auth.user) {
    const gate = document.createElement('section');
    gate.className = 'auth-gate';
    gate.id = 'validation-start';
    gate.innerHTML = `<span class="eyebrow">FREE REGISTRATION</span><h2>Ready to validate this signal?</h2><p>Create a free account to mark steps complete, save private notes and carry this sprint into your execution queue.</p><a class="button button-primary" href="/login?next=${encodeURIComponent(`${location.pathname}#validation-start`)}">Create free account or sign in</a>`;
    grid.before(gate);
    return;
  }
  const storageKey = `${auth.storagePrefix('validation')}${opportunityId}`;
  const cloud = await window.RadarCloud.ready;
  const steps = [...grid.querySelectorAll('article')];
  let state = { completed: [], notes: '' };
  try { state = { ...state, ...JSON.parse(localStorage.getItem(storageKey) || '{}') }; } catch (_) {}
  if (cloud.available) {
    try {
      const remote = await cloud.get('validation', opportunityId);
      if (remote && !remote.deleted && !state.pendingSync && String(remote.cloudUpdatedAt || '') >= String(state.cloudUpdatedAt || '')) state = { ...state, ...remote, pendingSync: false };
    } catch (_) { /* Keep the local offline copy. */ }
  }

  const workspace = document.createElement('section');
  workspace.className = 'validation-workspace';
  workspace.id = 'validation-start';
  workspace.innerHTML = `<div class="workspace-heading"><div><span class="analysis-label">YOUR PRIVATE WORKSPACE</span><h2>Validation progress</h2><p>${cloud.available ? 'Securely synced to your free account.' : 'Saved locally; cloud sync will retry when available.'}</p></div><strong class="workspace-progress" aria-live="polite">0 / ${steps.length}</strong></div><div class="validation-plan"><label for="validation-next-action">Next concrete action<input id="validation-next-action" type="text" maxlength="180" placeholder="Example: Interview two maintainers about timeout recovery"></label><label for="validation-due">Target date<input id="validation-due" type="date"></label><label for="validation-decision">Decision<select id="validation-decision"><option value="">Undecided</option><option value="build">Build</option><option value="narrow">Narrow</option><option value="stop">Stop</option></select></label></div><label for="validation-notes">Interview and experiment notes</label><textarea id="validation-notes" rows="7" placeholder="Capture exact user language, current workarounds, frequency, cost and behavioral evidence..."></textarea><div class="workspace-actions"><button class="button button-secondary" type="button" data-copy-notes>Copy notes</button><button class="workspace-reset" type="button" data-reset-progress>Reset progress</button><span class="workspace-saved" aria-live="polite"></span></div>`;
  workspace.querySelector('.validation-plan').insertAdjacentHTML('beforeend', `<label for="validation-interviews">User interviews<input id="validation-interviews" type="number" min="0" max="20" inputmode="numeric" aria-describedby="validation-readiness"></label><label for="validation-commitments">Behavioral commitments<input id="validation-commitments" type="number" min="0" max="20" inputmode="numeric" aria-describedby="validation-readiness"></label>`);
  workspace.querySelector('[for="validation-notes"]').insertAdjacentHTML('beforebegin', `<div class="readiness-guidance" id="validation-readiness" aria-live="polite"></div>`);
  grid.before(workspace);
  if (location.hash === '#validation-start') requestAnimationFrame(() => workspace.scrollIntoView({ block: 'start' }));
  const notes = workspace.querySelector('textarea');
  const progress = workspace.querySelector('.workspace-progress');
  const saved = workspace.querySelector('.workspace-saved');
  const nextAction = workspace.querySelector('#validation-next-action');
  const dueDate = workspace.querySelector('#validation-due');
  const decision = workspace.querySelector('#validation-decision');
  const interviews = workspace.querySelector('#validation-interviews');
  const commitments = workspace.querySelector('#validation-commitments');
  const readiness = workspace.querySelector('#validation-readiness');
  notes.value = state.notes || '';
  nextAction.value = state.nextAction || '';
  dueDate.value = state.dueDate || '';
  decision.value = ['build', 'narrow', 'stop'].includes(state.decision) ? state.decision : '';
  interviews.value = Math.min(20, Math.max(0, Number(state.interviews) || 0));
  commitments.value = Math.min(20, Math.max(0, Number(state.commitments) || 0));
  state.title = document.querySelector('.opportunity-detail-hero h1')?.textContent.trim() || 'Opportunity validation';
  state.project = document.querySelector('.opportunity-detail-hero p a')?.textContent.trim() || '';
  state.updatedAt = new Date().toISOString();
  let cloudTimer;
  function persist(message = cloud.available ? 'Saved · syncing…' : 'Saved locally') {
    state.notes = notes.value;
    state.nextAction = nextAction.value.trim();
    state.dueDate = dueDate.value;
    state.decision = decision.value;
    state.interviews = Math.min(20, Math.max(0, Number(interviews.value) || 0));
    state.commitments = Math.min(20, Math.max(0, Number(commitments.value) || 0));
    state.updatedAt = new Date().toISOString();
    state.pendingSync = true;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      saved.textContent = message;
      setTimeout(() => { saved.textContent = ''; }, 1600);
      if (cloud.available) {
        clearTimeout(cloudTimer);
        cloudTimer = setTimeout(async () => {
          const version = state.updatedAt;
          try {
            const cloudUpdatedAt = await cloud.set('validation', opportunityId, state);
            if (state.updatedAt === version) {
              state.pendingSync = false;
              state.cloudUpdatedAt = cloudUpdatedAt;
              localStorage.setItem(storageKey, JSON.stringify(state));
            }
            saved.textContent = 'Synced';
          }
          catch (_) { saved.textContent = 'Saved locally · sync pending'; }
          setTimeout(() => { saved.textContent = ''; }, 1600);
        }, 450);
      }
    } catch (_) { saved.textContent = 'Browser storage unavailable'; }
  }
  function updateProgress() {
    progress.textContent = `${state.completed.length} / ${steps.length}`;
    progress.style.setProperty('--progress', `${state.completed.length / steps.length * 100}%`);
  }
  function updateReadiness() {
    const interviewCount = Math.min(20, Math.max(0, Number(interviews.value) || 0));
    const commitmentCount = Math.min(20, Math.max(0, Number(commitments.value) || 0));
    if (interviewCount < 5) readiness.innerHTML = `<strong>Next proof target:</strong> Interview ${5 - interviewCount} more potential user${5 - interviewCount === 1 ? '' : 's'} before deciding what to build.`;
    else if (commitmentCount >= 3) readiness.innerHTML = '<strong>Build signal:</strong> You have repeated behavioral proof. Define the smallest paid or time-bound pilot.';
    else if (commitmentCount > 0) readiness.innerHTML = '<strong>Narrow the test:</strong> Some users acted. Ask for two more concrete commitments before building.';
    else readiness.innerHTML = '<strong>No behavioral proof yet:</strong> Ask users to join a pilot, share data, book time or pre-commit—then narrow or stop if nobody acts.';
  }
  steps.forEach((card, index) => {
    const stepAction = String(card.dataset.nextAction || card.querySelector('h2')?.textContent || '').trim().slice(0, 180);
    const control = document.createElement('label');
    control.className = 'coach-check';
    control.innerHTML = `<input type="checkbox" ${state.completed.includes(index) ? 'checked' : ''}><span>Mark this step complete</span>`;
    card.append(control);
    control.querySelector('input').addEventListener('change', (event) => {
      state.completed = event.target.checked ? [...new Set([...state.completed, index])] : state.completed.filter((step) => step !== index);
      state.completed.sort();
      updateProgress();
      persist();
    });
    const queueButton = document.createElement('button');
    queueButton.className = 'coach-queue-action';
    queueButton.type = 'button';
    queueButton.textContent = 'Make this my next action →';
    queueButton.addEventListener('click', () => {
      nextAction.value = stepAction;
      if (!dueDate.value) {
        const target = new Date();
        target.setDate(target.getDate() + 7);
        dueDate.value = target.toISOString().slice(0, 10);
      }
      persist('Added to execution queue');
      workspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
      nextAction.focus({ preventScroll: true });
    });
    card.append(queueButton);
  });
  let notesTimer;
  notes.addEventListener('input', () => { clearTimeout(notesTimer); notesTimer = setTimeout(() => persist(), 350); });
  nextAction.addEventListener('input', () => { clearTimeout(notesTimer); notesTimer = setTimeout(() => persist(), 350); });
  dueDate.addEventListener('change', () => persist());
  decision.addEventListener('change', () => persist('Decision saved'));
  [interviews, commitments].forEach((input) => input.addEventListener('input', () => { updateReadiness(); persist('Evidence count saved'); }));
  workspace.querySelector('[data-copy-notes]').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(notes.value); saved.textContent = 'Notes copied'; }
    catch (_) { notes.select(); saved.textContent = 'Select and copy your notes'; }
  });
  workspace.querySelector('[data-reset-progress]').addEventListener('click', () => {
    state.completed = [];
    steps.forEach((card) => { card.querySelector('input').checked = false; });
    updateProgress();
    persist('Progress reset');
  });
  updateProgress();
  updateReadiness();
  persist('');
})();
