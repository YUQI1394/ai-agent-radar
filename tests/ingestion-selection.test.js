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

test('Issue scanning rotates across professional categories before filling by age', () => {
  const categories = ['Security', 'Finance', 'Research', 'Coding', 'Marketing', 'Design', 'Productivity', 'Agent Infrastructure'];
  const candidates = categories.flatMap((category, categoryIndex) => [0, 1].map((offset) => ({ name: `${category}-${offset}`, category })));
  const current = candidates.map((item, index) => ({ ...item, evidenceIssues: [{}, {}], issueScannedAt: `2026-09-${String(index + 1).padStart(2, '0')}T00:00:00.000Z` }));
  const selected = selectIssueTargets(candidates, current, [], 7);
  assert.equal(selected.length, 7);
  assert.equal(new Set(selected.map((item) => item.category)).size, 7);
  assert.deepEqual(selected.map((item) => item.category), categories.slice(0, 7));
});

test('Issue scanning prioritizes every current project in a domain below the evidence floor', () => {
  const marketing = Array.from({ length: 3 }, (_, index) => ({ name: `marketing-${index}`, category: 'Marketing' }));
  const coding = Array.from({ length: 8 }, (_, index) => ({ name: `coding-${index}`, category: 'Coding' }));
  const candidates = [...marketing, ...coding];
  const current = candidates.map((item, index) => ({ ...item, evidenceIssues: item.category === 'Marketing' ? [] : [{}, {}], issueScannedAt: `2026-08-${String(index + 1).padStart(2, '0')}T00:00:00.000Z` }));
  const selected = selectIssueTargets(candidates, current, [], 7);
  assert.deepEqual(selected.filter((item) => item.category === 'Marketing').map((item) => item.name), marketing.map((item) => item.name));
});

test('Issue recovery rotates across multiple domains below the target evidence depth', () => {
  const thin = ['Marketing', 'Security', 'Design', 'Research'].flatMap((category) => [0, 1].map((index) => ({ name: `${category}-${index}`, category })));
  const healthy = Array.from({ length: 8 }, (_, index) => ({ name: `coding-${index}`, category: 'Coding' }));
  const candidates = [...thin, ...healthy];
  const current = candidates.map((item, index) => ({ ...item, evidenceIssues: item.category === 'Coding' ? [{}, {}, {}, {}] : [{}], issueScannedAt: `2026-08-${String(index + 1).padStart(2, '0')}T00:00:00.000Z` }));
  const selected = selectIssueTargets(candidates, current, [], 7);
  for (const category of ['Marketing', 'Security', 'Design', 'Research']) assert.ok(selected.some((item) => item.category === category), `${category} must receive a recovery scan`);
});
