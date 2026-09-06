(() => {
  const grid = document.querySelector('.coach-grid');
  if (!grid) return;
  const opportunityId = location.pathname.split('/').filter(Boolean).pop();
  const storageKey = `ai-agent-radar:validation:${opportunityId}`;
  const steps = [...grid.querySelectorAll('article')];
  let state = { completed: [], notes: '' };
  try { state = { ...state, ...JSON.parse(localStorage.getItem(storageKey) || '{}') }; } catch (_) {}

  const workspace = document.createElement('section');
  workspace.className = 'validation-workspace';
  workspace.innerHTML = `<div class="workspace-heading"><div><span class="analysis-label">YOUR PRIVATE WORKSPACE</span><h2>Validation progress</h2><p>Saved only in this browser. No account required.</p></div><strong class="workspace-progress" aria-live="polite">0 / ${steps.length}</strong></div><label for="validation-notes">Interview and experiment notes</label><textarea id="validation-notes" rows="7" placeholder="Capture exact user language, current workarounds, frequency, cost and behavioral evidence..."></textarea><div class="workspace-actions"><button class="button button-secondary" type="button" data-copy-notes>Copy notes</button><button class="workspace-reset" type="button" data-reset-progress>Reset progress</button><span class="workspace-saved" aria-live="polite"></span></div>`;
  grid.before(workspace);
  const notes = workspace.querySelector('textarea');
  const progress = workspace.querySelector('.workspace-progress');
  const saved = workspace.querySelector('.workspace-saved');
  notes.value = state.notes || '';
  function persist(message = 'Saved locally') {
    state.notes = notes.value;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      saved.textContent = message;
      setTimeout(() => { saved.textContent = ''; }, 1600);
    } catch (_) { saved.textContent = 'Browser storage unavailable'; }
  }
  function updateProgress() {
    progress.textContent = `${state.completed.length} / ${steps.length}`;
    progress.style.setProperty('--progress', `${state.completed.length / steps.length * 100}%`);
  }
  steps.forEach((card, index) => {
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
  });
  let notesTimer;
  notes.addEventListener('input', () => { clearTimeout(notesTimer); notesTimer = setTimeout(() => persist(), 350); });
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
})();
