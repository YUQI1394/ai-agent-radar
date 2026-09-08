const THEMES = [
  { name: 'Reliability', slug: 'reliability', pattern: /error|fail|retry|timeout|crash|recover|reliab|stability/i },
  { name: 'Integrations', slug: 'integrations', pattern: /integrat|connector|plugin|api|mcp|webhook|provider/i },
  { name: 'Developer Experience', slug: 'developer-experience', pattern: /document|example|install|setup|config|debug|typescript|sdk|cli/i },
  { name: 'Memory & Data', slug: 'memory-data', pattern: /memory|context|database|storage|vector|retriev|knowledge|rag/i },
  { name: 'Agent Control', slug: 'agent-control', pattern: /workflow|multi-agent|human|approval|observ|trace|monitor|schedule/i },
  { name: 'Product Capability', slug: 'product-capability', pattern: /.*/i }
];
const MAINTENANCE_NOISE = /dependency dashboard|dependency (?:update|refresh|bump)|release checklist|roadmap tracking|ci red|build status|build artifacts?|automated update|test matrix|canary|flaky test|tests? (?:fail|failing)|verification.*manifest|gsoc.*community|already[- ]fixed|duplicate|wontfix|invalid/i;

function opportunityTheme(issue) {
  const text = `${issue.title || ''} ${(issue.labels || []).join(' ')}`;
  return THEMES.find((theme) => theme.pattern.test(text)) || THEMES[THEMES.length - 1];
}

const COACHING = {
  reliability: { hypothesis: 'For [operator], the workflow fails during [condition], forcing [recovery work] and costing [time, money or trust].', questions: ['Show me the last failure and its logs.', 'What triggered it and how often does it recur?', 'How do you detect it today?', 'What does recovery require?', 'What would a safe failure look like?'], experiment: 'Add one narrow guardrail, retry or recovery path around the failing step. Replay three real failure cases and compare recovery time.', proof: 'The same failure is recovered faster in three real cases without creating a new incident.' },
  integrations: { hypothesis: 'For [team], moving data between [system A] and [system B] requires [manual work], causing [delay or errors].', questions: ['Which systems must exchange data?', 'What triggers the handoff?', 'Which fields or permissions block it?', 'How is it handled today?', 'Who owns failures between systems?'], experiment: 'Manually operate or prototype one high-frequency connection for one team before building a general connector.', proof: 'A user completes the real cross-system workflow twice and asks to keep the connection active.' },
  'developer-experience': { hypothesis: 'For [developer], completing [setup or development task] is unclear at [step], causing [abandonment or rework].', questions: ['Screen-share the task without guidance.', 'Where do you first hesitate?', 'What did you search for?', 'Which error or concept is unclear?', 'What workaround finally unblocked you?'], experiment: 'Create the smallest example, diagnostic or setup assistant and observe three developers using it unprompted.', proof: 'Three developers finish the task with fewer interventions or measurably less time.' },
  'memory-data': { hypothesis: 'For [user], the agent loses or retrieves [information] incorrectly across [scope], causing [wrong action or repeated work].', questions: ['Which information must persist?', 'For how long and within what scope?', 'Show the last wrong or missing recall.', 'What data must never cross boundaries?', 'How do you correct memory today?'], experiment: 'Test one constrained memory scope with a small real dataset and a written expected-recall benchmark.', proof: 'The system retrieves the right evidence across repeated sessions without leaking or inventing context.' },
  'agent-control': { hypothesis: 'For [owner], the agent takes or proposes [action] without enough [visibility, approval or control], creating [risk].', questions: ['Which action needs oversight?', 'When should a human intervene?', 'What evidence is needed to approve it?', 'How is an action reversed?', 'Who is accountable when it fails?'], experiment: 'Insert one approval, audit or pause point into a live workflow and measure delay versus prevented risk.', proof: 'Owners can explain, approve and reverse the action without blocking low-risk work.' },
  'product-capability': { hypothesis: 'For [specific user], completing [job] is difficult because [missing capability], causing [measurable consequence].', questions: ['When did you last need this?', 'What outcome were you trying to reach?', 'What did you use instead?', 'How often does this occur?', 'What commitment would prove it matters?'], experiment: 'Deliver the outcome manually or with a narrow prototype before building a reusable feature.', proof: 'A user completes the real workflow and commits time, data, distribution or budget to repeat it.' }
};

function coachingPlan(issue) {
  const theme = opportunityTheme(issue);
  return { theme, ...COACHING[theme.slug] };
}

function issueFingerprint(title = '') {
  return String(title).toLowerCase()
    .replace(/^\s*(?:\[[^\]]{1,30}\]|feat(?:ure)?|bug|question|proposal|enhancement)\s*[:_-]*\s*/i, '')
    .replace(/[`'"()[\]{}:;,.!?_-]+/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function cleanIssueEvidence(issues = []) {
  const fingerprints = new Set();
  return issues.filter((issue) => {
    const searchable = `${issue.title || ''} ${(issue.labels || []).join(' ')}`;
    const fingerprint = issueFingerprint(issue.title);
    if (!fingerprint || fingerprints.has(fingerprint) || MAINTENANCE_NOISE.test(searchable)) return false;
    fingerprints.add(fingerprint);
    return true;
  });
}

module.exports = { THEMES, cleanIssueEvidence, coachingPlan, issueFingerprint, opportunityTheme };
