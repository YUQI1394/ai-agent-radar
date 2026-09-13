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
  const historicalSignal = document.body.dataset.signalStatus === 'historical';
  if (!auth.user) {
    const gate = document.createElement('section');
    gate.className = 'auth-gate';
    gate.id = 'validation-start';
    gate.innerHTML = historicalSignal
      ? '<span class="eyebrow">HISTORICAL SIGNAL</span><h2>Start from current evidence</h2><p>This brief is preserved for reference, but it has left the current curated feed. Choose a live signal before beginning a new sprint.</p><a class="button button-primary" href="/opportunities">Browse current opportunities</a>'
      : `<span class="eyebrow">FREE 7-DAY VALIDATION SPRINT</span><h2>Leave with evidence—not another saved link</h2><p>Your free workspace turns this exact GitHub need into a concrete next action and a Build, Narrow or Stop decision.</p><ul class="auth-benefits"><li><strong>Today:</strong> a problem hypothesis and first action</li><li><strong>This week:</strong> structured interview records, evidence counts and reminders</li><li><strong>At the end:</strong> a decision based on behavior, not opinions</li></ul><a class="button button-primary" href="/login?next=${encodeURIComponent(`${location.pathname}#validation-start`)}">Start this sprint free</a><small>No payment · private notes · cloud sync</small>`;
    grid.before(gate);
    return;
  }
  const storageKey = `${auth.storagePrefix('validation')}${opportunityId}`;
  const cloud = await window.RadarCloud.ready;
  const steps = [...grid.querySelectorAll('article')];
  const stepActions = steps.map((card) => String(card.dataset.nextAction || card.querySelector('h2')?.textContent || '').trim().slice(0, 180));
  let state = { completed: [], notes: '' };
  try { state = { ...state, ...JSON.parse(localStorage.getItem(storageKey) || '{}') }; } catch (_) {}
  if (cloud.available) {
    try {
      const remote = await cloud.get('validation', opportunityId);
      if (remote && !remote.deleted && !state.pendingSync && String(remote.cloudUpdatedAt || '') >= String(state.cloudUpdatedAt || '')) state = { ...state, ...remote, pendingSync: false };
    } catch (_) { /* Keep the local offline copy. */ }
  }
  const cleanInterviewLog = (items) => (Array.isArray(items) ? items : []).slice(0, 10).map((item) => ({
    role: String(item?.role || '').slice(0, 80),
    incident: String(item?.incident || '').slice(0, 400),
    workaround: String(item?.workaround || '').slice(0, 300),
    commitment: ['none', 'follow-up', 'shared-data', 'pilot', 'paid'].includes(item?.commitment) ? item.commitment : 'none'
  }));
  state.interviewLog = cleanInterviewLog(state.interviewLog);
  state.manualInterviews = Math.min(20, Math.max(0, Number(state.manualInterviews ?? state.interviews) || 0));
  state.manualCommitments = Math.min(20, Math.max(0, Number(state.manualCommitments ?? state.commitments) || 0));

  const workspace = document.createElement('section');
  workspace.className = 'validation-workspace';
  workspace.id = 'validation-start';
  workspace.innerHTML = `<div class="workspace-heading"><div><span class="analysis-label">YOUR PRIVATE WORKSPACE</span><h2>Validation progress</h2><p>${cloud.available ? 'Securely synced to your free account.' : 'Saved locally; cloud sync will retry when available.'}</p></div><strong class="workspace-progress" aria-live="polite">0 / ${steps.length}</strong></div><div class="validation-plan"><label for="validation-next-action">Next concrete action<input id="validation-next-action" type="text" maxlength="180" placeholder="Example: Interview two maintainers about timeout recovery"></label><label for="validation-due">Target date<input id="validation-due" type="date"></label><label for="validation-decision">Your decision<select id="validation-decision" aria-describedby="validation-verdict"><option value="">Undecided</option><option value="build">Build</option><option value="narrow">Narrow</option><option value="stop">Stop</option></select></label></div><div class="evidence-scorecard"><div><span class="analysis-label">EVIDENCE CHECK</span><strong id="validation-evidence-score">0 / 5 proof gates</strong></div><ul id="validation-evidence-gates"></ul><p id="validation-verdict" aria-live="polite"></p></div><label for="validation-notes">Interview and experiment notes</label><textarea id="validation-notes" rows="7" placeholder="Capture exact user language, current workarounds, frequency, cost and behavioral evidence..."></textarea><div class="workspace-actions"><button class="button button-primary" type="button" data-copy-outreach>Copy interview outreach</button><button class="button button-secondary" type="button" data-add-calendar disabled>Add action to calendar</button><button class="button button-secondary" type="button" data-copy-notes>Copy notes</button><button class="workspace-reset" type="button" data-reset-progress>Reset progress</button><span class="workspace-saved" aria-live="polite"></span></div>`;
  workspace.querySelector('.validation-plan').insertAdjacentHTML('beforeend', `<label for="validation-interviews">User interviews<input id="validation-interviews" type="number" min="0" max="20" inputmode="numeric" aria-describedby="validation-readiness"></label><label for="validation-commitments">Behavioral commitments<input id="validation-commitments" type="number" min="0" max="20" inputmode="numeric" aria-describedby="validation-readiness"></label>`);
  workspace.querySelector('[for="validation-notes"]').insertAdjacentHTML('beforebegin', `<div class="readiness-guidance" id="validation-readiness" aria-live="polite"></div>`);
  workspace.querySelector('#validation-notes').insertAdjacentHTML('afterend', `<section class="interview-log" aria-labelledby="interview-log-title"><div class="interview-log-heading"><div><span class="analysis-label">STRUCTURED INTERVIEW EVIDENCE</span><h3 id="interview-log-title">Record what happened—not who said it</h3><p>Use roles instead of names. A complete record needs a recent incident and the current workaround or cost.</p></div><button class="button button-secondary" type="button" data-add-interview>Add interview record</button></div><div id="interview-log-status" class="interview-log-status" aria-live="polite"></div><div id="interview-log-list" class="interview-log-list"></div></section>`);
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
  const evidenceScore = workspace.querySelector('#validation-evidence-score');
  const evidenceGates = workspace.querySelector('#validation-evidence-gates');
  const verdict = workspace.querySelector('#validation-verdict');
  const calendarButton = workspace.querySelector('[data-add-calendar]');
  const interviewLogList = workspace.querySelector('#interview-log-list');
  const interviewLogStatus = workspace.querySelector('#interview-log-status');
  const addInterviewButton = workspace.querySelector('[data-add-interview]');
  const startedFromBrief = location.hash === '#validation-start' && !state.nextAction;
  notes.value = state.notes || '';
  nextAction.value = state.nextAction || '';
  dueDate.value = state.dueDate || '';
  decision.value = ['build', 'narrow', 'stop'].includes(state.decision) ? state.decision : '';
  interviews.value = state.manualInterviews;
  commitments.value = state.manualCommitments;
  state.title = document.querySelector('.opportunity-detail-hero h1')?.textContent.trim() || 'Opportunity validation';
  state.project = document.querySelector('.opportunity-detail-hero p a')?.textContent.trim() || '';
  state.domain = document.querySelector('.professional-coach-note .analysis-label')?.textContent.replace(/\s+VALIDATION LENS$/i, '').trim() || state.domain || '';
  state.pattern = steps[0]?.querySelector('.coach-step')?.textContent.replace(/^01\s*·\s*/i, '').trim() || state.pattern || '';
  const sourceUrl = document.querySelector('.evidence-source a[href^="https://github.com/"]')?.href || '';
  state.sourceUrl = /^https:\/\/github\.com\//i.test(sourceUrl) ? sourceUrl : state.sourceUrl || '';
  state.updatedAt = new Date().toISOString();
  let cloudTimer;
  function localDateAfter(days) {
    const target = new Date();
    target.setDate(target.getDate() + days);
    return new Date(target.getTime() - target.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
  function updateCalendarButton() {
    calendarButton.disabled = !nextAction.value.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate.value);
  }
  function calendarDate(value, offsetDays = 0) {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + offsetDays));
    return date.toISOString().slice(0, 10).replace(/-/g, '');
  }
  function calendarText(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\r?\n/g, '\\n');
  }
  function downloadCalendarReminder() {
    if (calendarButton.disabled) return;
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AI Agent Radar//Validation Coach//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT', `UID:radar-${opportunityId}-${dueDate.value}@getaiagentradar.com`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${calendarDate(dueDate.value)}`, `DTEND;VALUE=DATE:${calendarDate(dueDate.value, 1)}`, `SUMMARY:${calendarText(`AI Agent Radar: ${nextAction.value.trim()}`)}`, `DESCRIPTION:${calendarText(`${state.title}\nContinue: ${location.origin}${location.pathname}#validation-start`)}`, 'END:VEVENT', 'END:VCALENDAR', ''];
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' }));
    link.download = `ai-agent-radar-action-${dueDate.value}.ics`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
    saved.textContent = 'Calendar reminder downloaded';
    setTimeout(() => { saved.textContent = ''; }, 1800);
  }
  function structuredEvidence() {
    const complete = state.interviewLog.filter((item) => item.role.trim() && item.incident.trim().length >= 20 && item.workaround.trim().length >= 10).length;
    const committed = state.interviewLog.filter((item) => item.commitment !== 'none').length;
    const detailCharacters = state.interviewLog.reduce((sum, item) => sum + item.incident.trim().length + item.workaround.trim().length, 0);
    return { complete, committed, detailCharacters };
  }
  function renderInterviewLog() {
    const proof = structuredEvidence();
    interviewLogStatus.textContent = `${proof.complete} complete structured record${proof.complete === 1 ? '' : 's'} · ${proof.committed} behavioral commitment${proof.committed === 1 ? '' : 's'}`;
    interviewLogList.innerHTML = state.interviewLog.length ? state.interviewLog.map((item, index) => `<article class="interview-record" data-interview-index="${index}"><div class="interview-record-heading"><strong>Interview ${index + 1}</strong><button type="button" data-remove-interview="${index}" aria-label="Remove interview ${index + 1}">Remove</button></div><label>Role / context <small>Do not enter a name or contact details.</small><input type="text" maxlength="80" data-interview-field="role" value="${escapeHtml(item.role)}" placeholder="Example: SOC analyst at a small managed provider"></label><label>Last concrete incident <textarea rows="3" maxlength="400" data-interview-field="incident" placeholder="What happened, when, and what was blocked?">${escapeHtml(item.incident)}</textarea></label><label>Current workaround or cost <textarea rows="2" maxlength="300" data-interview-field="workaround" placeholder="What do they do today, and what time, money or risk does it create?">${escapeHtml(item.workaround)}</textarea></label><label>Behavior after the conversation<select data-interview-field="commitment"><option value="none"${item.commitment === 'none' ? ' selected' : ''}>No commitment yet</option><option value="follow-up"${item.commitment === 'follow-up' ? ' selected' : ''}>Booked a follow-up</option><option value="shared-data"${item.commitment === 'shared-data' ? ' selected' : ''}>Shared data or access</option><option value="pilot"${item.commitment === 'pilot' ? ' selected' : ''}>Joined a pilot</option><option value="paid"${item.commitment === 'paid' ? ' selected' : ''}>Paid or pre-committed</option></select></label></article>`).join('') : '<div class="interview-log-empty"><strong>No structured interviews yet</strong><p>Add the first record after a conversation. Your general notes remain available above.</p></div>';
    addInterviewButton.disabled = state.interviewLog.length >= 10;
    addInterviewButton.textContent = state.interviewLog.length >= 10 ? '10-record limit reached' : 'Add interview record';
  }
  function evidenceSnapshot() {
    const structured = structuredEvidence();
    const interviewCount = Math.max(structured.complete, Math.min(20, Math.max(0, Number(interviews.value) || 0)));
    const commitmentCount = Math.max(structured.committed, Math.min(20, Math.max(0, Number(commitments.value) || 0)));
    const completed = new Set(state.completed || []);
    const gates = [
      { met: completed.has(0), label: 'Problem framed without proposing a feature' },
      { met: interviewCount >= 5, label: 'Five affected users interviewed' },
      { met: completed.has(2), label: 'Smallest real-world experiment completed' },
      { met: commitmentCount >= 3, label: 'Three behavioral commitments recorded' },
      { met: notes.value.trim().length + structured.detailCharacters >= 80, label: 'Concrete evidence notes captured' }
    ];
    const passed = gates.filter((gate) => gate.met).length;
    if (passed === gates.length) return { gates, passed, level: 'evidence-backed', recommendation: 'Build signal: define the smallest paid or time-bound pilot, then keep measuring behavior.' };
    if (interviewCount >= 5 && completed.has(2) && commitmentCount === 0) return { gates, passed, level: 'tested-no-commitment', recommendation: 'Stop or redesign signal: the test produced no behavioral commitment. Do not build the full product yet.' };
    if (commitmentCount > 0) return { gates, passed, level: 'early-signal', recommendation: `Narrow signal: ${commitmentCount} user${commitmentCount === 1 ? '' : 's'} acted. Test the smallest common job until three users commit.` };
    return { gates, passed, level: 'not-ready', recommendation: `Keep testing: ${gates.length - passed} proof gate${gates.length - passed === 1 ? '' : 's'} remain before a Build decision is evidence-backed.` };
  }
  function persist(message = cloud.available ? 'Saved · syncing…' : 'Saved locally') {
    state.notes = notes.value;
    state.nextAction = nextAction.value.trim();
    state.dueDate = dueDate.value;
    state.decision = decision.value;
    state.manualInterviews = Math.min(20, Math.max(0, Number(interviews.value) || 0));
    state.manualCommitments = Math.min(20, Math.max(0, Number(commitments.value) || 0));
    const structured = structuredEvidence();
    state.interviews = Math.max(state.manualInterviews, structured.complete);
    state.commitments = Math.max(state.manualCommitments, structured.committed);
    const proof = evidenceSnapshot();
    state.evidenceLevel = proof.level;
    state.evidenceGates = proof.passed;
    state.recommendation = proof.recommendation;
    state.decisionEvidence = state.decision ? (state.decision === 'build' && proof.level !== 'evidence-backed' ? 'provisional' : proof.passed >= 3 ? 'evidence-backed' : 'early') : '';
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
    const structured = structuredEvidence();
    const interviewCount = Math.max(structured.complete, Math.min(20, Math.max(0, Number(interviews.value) || 0)));
    const commitmentCount = Math.max(structured.committed, Math.min(20, Math.max(0, Number(commitments.value) || 0)));
    const proof = evidenceSnapshot();
    evidenceScore.textContent = `${proof.passed} / ${proof.gates.length} proof gates`;
    evidenceGates.innerHTML = proof.gates.map((gate) => `<li class="${gate.met ? 'met' : ''}"><span aria-hidden="true">${gate.met ? '✓' : '○'}</span>${gate.label}</li>`).join('');
    verdict.className = `evidence-verdict ${proof.level}`;
    verdict.innerHTML = `<strong>Coach verdict:</strong> ${proof.recommendation}${decision.value === 'build' && proof.level !== 'evidence-backed' ? ' Your Build choice is saved as provisional.' : ''}`;
    if (interviewCount < 5) readiness.innerHTML = `<strong>Next proof target:</strong> Interview ${5 - interviewCount} more potential user${5 - interviewCount === 1 ? '' : 's'} before deciding what to build.`;
    else if (commitmentCount >= 3) readiness.innerHTML = '<strong>Build signal:</strong> You have repeated behavioral proof. Define the smallest paid or time-bound pilot.';
    else if (commitmentCount > 0) readiness.innerHTML = '<strong>Narrow the test:</strong> Some users acted. Ask for two more concrete commitments before building.';
    else readiness.innerHTML = '<strong>No behavioral proof yet:</strong> Ask users to join a pilot, share data, book time or pre-commit—then narrow or stop if nobody acts.';
  }
  steps.forEach((card, index) => {
    const stepAction = stepActions[index];
    const control = document.createElement('label');
    control.className = 'coach-check';
    control.innerHTML = `<input type="checkbox" ${state.completed.includes(index) ? 'checked' : ''}><span>Mark this step complete</span>`;
    card.append(control);
    control.querySelector('input').addEventListener('change', (event) => {
      const previousAction = nextAction.value.trim();
      state.completed = event.target.checked ? [...new Set([...state.completed, index])] : state.completed.filter((step) => step !== index);
      state.completed.sort();
      let message = '';
      if (event.target.checked && (!previousAction || previousAction === stepAction)) {
        const nextIndex = stepActions.findIndex((_, stepIndex) => !state.completed.includes(stepIndex));
        if (nextIndex >= 0) {
          nextAction.value = stepActions[nextIndex];
          dueDate.value = localDateAfter(1);
          message = 'Step complete · next action scheduled';
        } else {
          nextAction.value = '';
          dueDate.value = '';
          message = 'All steps complete · record your decision';
        }
      }
      updateProgress();
      updateReadiness();
      updateCalendarButton();
      persist(message || undefined);
    });
    const queueButton = document.createElement('button');
    queueButton.className = 'coach-queue-action';
    queueButton.type = 'button';
    queueButton.textContent = 'Make this my next action →';
    queueButton.addEventListener('click', () => {
      nextAction.value = stepAction;
      if (!dueDate.value) dueDate.value = localDateAfter(1);
      updateCalendarButton();
      persist('Added to execution queue');
      workspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
      nextAction.focus({ preventScroll: true });
    });
    card.append(queueButton);
  });
  if (startedFromBrief && steps[0]) {
    nextAction.value = stepActions[0];
    if (!dueDate.value) dueDate.value = localDateAfter(1);
    state.startedAt = state.startedAt || new Date().toISOString();
  }
  let notesTimer;
  addInterviewButton.addEventListener('click', () => {
    if (state.interviewLog.length >= 10) return;
    state.interviewLog.push({ role: '', incident: '', workaround: '', commitment: 'none' });
    renderInterviewLog();
    updateReadiness();
    persist('Interview record added');
    interviewLogList.querySelector('[data-interview-index]:last-child input')?.focus();
  });
  interviewLogList.addEventListener('input', (event) => {
    const field = event.target.closest('[data-interview-field]');
    const card = event.target.closest('[data-interview-index]');
    const index = Number(card?.dataset.interviewIndex);
    if (!field || !Number.isInteger(index) || !state.interviewLog[index]) return;
    const limits = { role: 80, incident: 400, workaround: 300, commitment: 20 };
    const name = field.dataset.interviewField;
    if (!(name in limits)) return;
    const value = String(field.value || '').slice(0, limits[name]);
    state.interviewLog[index][name] = name === 'commitment' && !['none', 'follow-up', 'shared-data', 'pilot', 'paid'].includes(value) ? 'none' : value;
    const structured = structuredEvidence();
    interviewLogStatus.textContent = `${structured.complete} complete structured record${structured.complete === 1 ? '' : 's'} · ${structured.committed} behavioral commitment${structured.committed === 1 ? '' : 's'}`;
    updateReadiness();
    clearTimeout(notesTimer);
    notesTimer = setTimeout(() => persist('Interview evidence saved'), 350);
  });
  interviewLogList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-interview]');
    if (!button) return;
    const index = Number(button.dataset.removeInterview);
    if (!Number.isInteger(index) || !state.interviewLog[index]) return;
    state.interviewLog.splice(index, 1);
    renderInterviewLog();
    updateReadiness();
    persist('Interview record removed');
  });
  notes.addEventListener('input', () => { updateReadiness(); clearTimeout(notesTimer); notesTimer = setTimeout(() => persist(), 350); });
  nextAction.addEventListener('input', () => { updateCalendarButton(); clearTimeout(notesTimer); notesTimer = setTimeout(() => persist(), 350); });
  dueDate.addEventListener('change', () => { updateCalendarButton(); persist(); });
  decision.addEventListener('change', () => { updateReadiness(); persist(decision.value === 'build' && evidenceSnapshot().level !== 'evidence-backed' ? 'Provisional Build saved · gather more proof' : 'Decision saved'); });
  [interviews, commitments].forEach((input) => input.addEventListener('input', () => { updateReadiness(); persist('Evidence count saved'); }));
  workspace.querySelector('[data-copy-notes]').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(notes.value); saved.textContent = 'Notes copied'; }
    catch (_) { notes.select(); saved.textContent = 'Select and copy your notes'; }
  });
  workspace.querySelector('[data-copy-outreach]').addEventListener('click', async () => {
    const outreach = `Hi — I am researching a recurring problem reported around “${state.title}” in ${state.project || 'an open-source project'}. I am not selling anything. Could I ask for 15 minutes about the last time you faced this, what you tried, and what the workaround cost? I will share the findings back with you.`;
    try { await navigator.clipboard.writeText(outreach); saved.textContent = 'Interview outreach copied'; }
    catch (_) { saved.textContent = 'Copy unavailable in this browser'; }
    setTimeout(() => { saved.textContent = ''; }, 1800);
  });
  calendarButton.addEventListener('click', downloadCalendarReminder);
  workspace.querySelector('[data-reset-progress]').addEventListener('click', () => {
    state.completed = [];
    steps.forEach((card) => { card.querySelector('input').checked = false; });
    updateProgress();
    updateReadiness();
    persist('Progress reset');
  });
  updateProgress();
  renderInterviewLog();
  updateReadiness();
  updateCalendarButton();
  persist(startedFromBrief ? 'Sprint started · first action scheduled' : '');
})();
