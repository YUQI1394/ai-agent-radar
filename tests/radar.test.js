const test = require('node:test');
const assert = require('node:assert/strict');
const {
  category,
  enrichAgents,
  mergeArchive,
  qualifiesAsAgent,
  scoreBreakdown,
  weekKey
} = require('../lib/radar');

const now = Date.parse('2026-09-06T12:00:00.000Z');

function agent(overrides = {}) {
  return {
    id: 1,
    name: 'Reliable Agent Framework',
    tagline: 'Plan, execute, and monitor multi-agent workflows',
    description: 'An open-source framework for building and operating autonomous agents in production.',
    topics: ['ai-agent', 'agent-framework', 'observability'],
    stars: 4200,
    forks: 380,
    openIssues: 24,
    license: 'Apache-2.0',
    homepage: 'https://example.com',
    pushedAt: '2026-09-03T12:00:00.000Z',
    evidenceIssues: [{ comments: 8, reactions: 5 }],
    ...overrides
  };
}

test('accepts actionable agents and rejects model-only or generator products', () => {
  assert.equal(qualifiesAsAgent(agent()), true);
  assert.equal(qualifiesAsAgent(agent({
    name: 'Frontier LLM', tagline: 'A 70B language model',
    description: 'Open weights foundation model with strong benchmark performance.', topics: ['llm']
  })), false);
  assert.equal(qualifiesAsAgent(agent({
    name: 'Logo AI', tagline: 'AI logo generator',
    description: 'Create logos from text prompts for your next brand.', topics: ['image-generator']
  })), false);
});

test('scores stay bounded and reward fresh, evidenced projects', () => {
  const strong = scoreBreakdown(agent(), now);
  const stale = scoreBreakdown(agent({ pushedAt: '2023-01-01T00:00:00.000Z', evidenceIssues: [] }), now);
  assert.ok(strong.total >= 0 && strong.total <= 100);
  assert.equal(strong.maintenance, 20);
  assert.ok(strong.demand > stale.demand);
  assert.ok(strong.total > stale.total);
});

test('classifies infrastructure before broad coding keywords', () => {
  assert.equal(category(agent()), 'Agent Infrastructure');
  assert.equal(category(agent({
    name: 'Coding Copilot', tagline: 'Plan and execute software tasks',
    description: 'An autonomous coding agent that tests and deploys changes.',
    topics: ['developer-tools', 'coding']
  })), 'Coding');
});

test('enrichment preserves first-seen time and computes deltas', () => {
  const previous = agent({ stars: 4000, firstSeenAt: '2026-08-01T00:00:00.000Z' });
  const [current] = enrichAgents([agent()], [previous], now);
  assert.equal(current.firstSeenAt, previous.firstSeenAt);
  assert.equal(current.starDelta, 200);
  assert.ok(current.score.total > 0);
});

test('archive retains missing projects and marks current projects', () => {
  const archived = agent({ id: 2, name: 'Older Agent' });
  const merged = mergeArchive([archived], [agent()], '2026-09-06T12:00:00.000Z');
  assert.equal(merged.find((item) => item.id === 1).status, 'current');
  assert.equal(merged.find((item) => item.id === 2).status, 'archived');
});

test('week keys consistently end on Sunday in UTC', () => {
  assert.equal(weekKey('2026-09-01T23:59:00-07:00'), '2026-09-06');
  assert.equal(weekKey('2026-09-06T23:59:00Z'), '2026-09-06');
});
