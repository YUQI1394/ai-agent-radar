const test = require('node:test');
const assert = require('node:assert/strict');
const { THEMES, cleanIssueEvidence, issueFingerprint, opportunityTheme } = require('../lib/opportunity-themes');

test('maps issue evidence into actionable demand themes', () => {
  assert.equal(opportunityTheme({ title: 'Add Slack connector', labels: ['feature'] }).slug, 'integrations');
  assert.equal(opportunityTheme({ title: 'Retry after provider timeout', labels: ['bug'] }).slug, 'reliability');
  assert.equal(opportunityTheme({ title: 'Document local setup', labels: [] }).slug, 'developer-experience');
  assert.equal(opportunityTheme({ title: 'Persistent vector memory', labels: [] }).slug, 'memory-data');
  assert.equal(opportunityTheme({ title: 'Human approval workflow', labels: [] }).slug, 'agent-control');
  assert.equal(opportunityTheme({ title: 'Support a new capability', labels: [] }).slug, 'product-capability');
});

test('theme slugs are stable and unique', () => {
  assert.equal(new Set(THEMES.map((theme) => theme.slug)).size, THEMES.length);
});

test('issue fingerprints collapse cosmetic title duplicates', () => {
  assert.equal(issueFingerprint('[FEAT]: Add Slack connector'), issueFingerprint('feat - add slack connector'));
  assert.equal(issueFingerprint('Canary: add a small documentation clarification'), 'canary add a small documentation clarification');
});

test('cleans duplicate and maintenance-only evidence across stored history', () => {
  const issues = [
    { title: 'Canary: add a small documentation clarification', labels: [] },
    { title: '[FEAT]: Add Slack connector', labels: [] },
    { title: 'feat - add slack connector', labels: [] },
    { title: 'Human approval workflow', labels: [] }
  ];
  assert.deepEqual(cleanIssueEvidence(issues).map((issue) => issue.title), ['[FEAT]: Add Slack connector', 'Human approval workflow']);
});
