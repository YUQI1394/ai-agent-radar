const test = require('node:test');
const assert = require('node:assert/strict');
const { THEMES, cleanIssueEvidence, coachingPlan, evidenceEngagement, evidenceFreshness, evidenceStrength, isUsefulDemandSignal, issueExcerpt, issueFingerprint, opportunityPattern, opportunityTheme } = require('../lib/opportunity-themes');

test('maps issue evidence into actionable demand themes', () => {
  assert.equal(opportunityTheme({ title: 'Add Slack connector', labels: ['feature'] }).slug, 'integrations');
  assert.equal(opportunityTheme({ title: 'Retry after provider timeout', labels: ['bug'] }).slug, 'reliability');
  assert.equal(opportunityTheme({ title: 'Tracking: 429 / Capacity Issues', labels: [] }).slug, 'reliability');
  assert.equal(opportunityTheme({ title: 'Document local setup', labels: [] }).slug, 'developer-experience');
  assert.equal(opportunityTheme({ title: 'Persistent vector memory', labels: [] }).slug, 'memory-data');
  assert.equal(opportunityTheme({ title: 'Human approval workflow', labels: [] }).slug, 'agent-control');
  assert.equal(opportunityTheme({ title: 'Support a new capability', labels: [] }).slug, 'product-capability');
});

test('theme slugs are stable and unique', () => {
  assert.equal(new Set(THEMES.map((theme) => theme.slug)).size, THEMES.length);
});

test('separates broad themes into specific cross-repository problems', () => {
  assert.equal(opportunityPattern({ title: 'Retry after workflow timeout' }).name, 'Failure recovery');
  assert.equal(opportunityPattern({ title: 'Add Ollama provider support' }).name, 'Provider interoperability');
  assert.equal(opportunityPattern({ title: 'Require human approval before tool execution' }).name, 'Human approval & safety');
  assert.equal(opportunityPattern({ title: 'Improve vector retrieval quality' }).name, 'Retrieval & knowledge quality');
});

test('builds specialized coaching plans for opportunity themes', () => {
  const reliability = coachingPlan({ title: 'Retry after timeout', labels: [] });
  const integration = coachingPlan({ title: 'Add Slack connector', labels: [] });
  assert.equal(reliability.questions.length, 5);
  assert.match(reliability.experiment, /recovery|failure/i);
  assert.match(integration.experiment, /connection/i);
  assert.notEqual(reliability.hypothesis, integration.hypothesis);
});

test('issue fingerprints collapse cosmetic title duplicates', () => {
  assert.equal(issueFingerprint('[FEAT]: Add Slack connector'), issueFingerprint('feat - add slack connector'));
  assert.equal(issueFingerprint('Canary: add a small documentation clarification'), 'canary add a small documentation clarification');
});

test('creates bounded evidence excerpts without republishing credentials or contact details', () => {
  const excerpt = issueExcerpt(`## Problem\nI cannot finish the workflow. Contact me at user@example.com.\n\`\`\`js\nconst token = "sk-secretsecretsecretsecret";\n\`\`\`\nSee https://example.com/private for logs.`);
  assert.match(excerpt, /cannot finish the workflow/);
  assert.match(excerpt, /\[email hidden\]/);
  assert.match(excerpt, /\[link\]/);
  assert.doesNotMatch(excerpt, /user@example\.com|sk-secret|const token/);
  assert.ok(issueExcerpt('word '.repeat(200)).length <= 321);
});

test('cleans duplicate and maintenance-only evidence across stored history', () => {
  const issues = [
    { title: 'Canary: add a small documentation clarification', labels: [] },
    { title: 'CI red on main', labels: ['ci-red-main'] },
    { title: 'Comprehensive functionality review', labels: ['already-fixed'] },
    { title: 'Routine dependency refresh', labels: ['automated'] },
    { title: '[FEAT]: Add Slack connector', labels: [] },
    { title: 'feat - add slack connector', labels: [] },
    { title: 'Human approval workflow', labels: [] }
  ];
  assert.deepEqual(cleanIssueEvidence(issues).map((issue) => issue.title), ['[FEAT]: Add Slack connector', 'Human approval workflow']);
});

test('engagement uses diminishing returns and values independent positive reactions', () => {
  const ordinary = evidenceEngagement({ comments: 10, reactions: 0 });
  const repeated = evidenceEngagement({ comments: 1000, reactions: 0 });
  const supported = evidenceEngagement({ comments: 10, reactions: 20 });
  assert.ok(repeated - ordinary < 10, 'large comment counts should not dominate the ranking');
  assert.ok(supported > repeated, 'independent positive reactions should outweigh comment volume alone');
  assert.ok(repeated <= 24, 'comment-only engagement must stay capped');
});

test('recently active evidence outranks otherwise equal stale threads', () => {
  const now = Date.parse('2026-09-09T00:00:00Z');
  const active = { comments: 8, reactions: 3, updatedAt: '2026-09-01T00:00:00Z' };
  const stale = { comments: 8, reactions: 3, updatedAt: '2024-01-01T00:00:00Z' };
  assert.equal(evidenceFreshness(active, now), 10);
  assert.equal(evidenceFreshness(stale, now), 0);
  assert.ok(evidenceStrength(active, now) > evidenceStrength(stale, now));
});

test('rejects internal work and vague support posts without hiding explicit demand', () => {
  const useful = [
    { title: 'Proposal: Add approval gates before destructive tool calls', labels: [] },
    { title: '[FEATURE] Support webhook retries with backoff', labels: [] },
    { title: 'How can we support private registries?', labels: ['feature request'] }
  ];
  const noise = [
    { title: 'chore(context): slim always-on instructions', labels: [] },
    { title: '[Personas] Replace synthetic soak gate with acceptance proof', labels: [] },
    { title: '[Intake] Need a Cloudflare token for one-time operations', labels: [] },
    { title: 'How can I solve this installation error?', labels: [] },
    { title: 'no results whatsoever', labels: [] }
  ];
  useful.forEach((issue) => assert.equal(isUsefulDemandSignal(issue), true, issue.title));
  noise.forEach((issue) => assert.equal(isUsefulDemandSignal(issue), false, issue.title));
});
