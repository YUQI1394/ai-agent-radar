const test = require('node:test');
const assert = require('node:assert/strict');
const { selectIssueTargets } = require('../lib/ingestion-selection');

const candidate = (name) => ({ name });

test('Issue scanning balances current-feed freshness with new-project discovery', () => {
  const candidates = [
    ...Array.from({ length: 9 }, (_, index) => candidate(`current-${index}`)),
    ...Array.from({ length: 5 }, (_, index) => candidate(`new-${index}`))
  ];
  const current = Array.from({ length: 9 }, (_, index) => ({ name: `current-${index}`, issueScannedAt: index < 2 ? null : `2026-09-0${index}T00:00:00.000Z` }));
  const selected = selectIssueTargets(candidates, current, [], 10);
  assert.equal(selected.length, 10);
  assert.equal(selected.filter((agent) => agent.name.startsWith('current-')).length, 7);
  assert.equal(selected.filter((agent) => agent.name.startsWith('new-')).length, 3);
  assert.deepEqual(selected.slice(0, 2).map((agent) => agent.name), ['current-0', 'current-1']);
});

test('archived scan history prevents rediscovered candidates from losing priority state', () => {
  const candidates = [candidate('rediscovered'), candidate('never-scanned')];
  const archive = [{ name: 'rediscovered', issueScannedAt: '2026-09-08T00:00:00.000Z' }];
  const selected = selectIssueTargets(candidates, [], archive, 2);
  assert.deepEqual(selected.map((agent) => agent.name), ['never-scanned', 'rediscovered']);
});
