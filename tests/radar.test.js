const test = require('node:test');
const assert = require('node:assert/strict');
const {
  category,
  enrichAgents,
  mergeArchive,
  qualifiesAsAgent,
  selectCuratedAgents,
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
  assert.equal(qualifiesAsAgent(agent({
    name: 'Trading Course', tagline: 'Code for machine learning trading from data sourcing to live execution',
    description: 'Examples and notebooks for quantitative finance.', topics: ['trading-agent']
  })), false);
  assert.equal(qualifiesAsAgent(agent({
    name: 'Awesome AI Startups', tagline: 'A curated list of indie-built AI startups',
    description: 'A curated list of useful tools and companies.', topics: ['ai-agents', 'mcp']
  })), false);
  assert.equal(qualifiesAsAgent(agent({
    name: 'Quant Platform', tagline: 'Machine-learning investment platform equipped with RD-Agent',
    description: 'Explore ideas and implement quantitative models.', topics: ['finance', 'research']
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

test('professional domains take priority over infrastructure form', () => {
  assert.equal(category(agent({ name: 'Quant Agent', topics: ['ai-agents', 'quantitative-finance', 'agent-framework'] })), 'Finance');
  assert.equal(category(agent({ name: 'Red Team Agent', topics: ['ai-agents', 'penetration-testing', 'mcp-server'] })), 'Security');
  assert.equal(category(agent({ name: 'Research Agent', topics: ['ai-agents', 'deep-research', 'rag'] })), 'Research');
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

test('curated selection preserves professional-domain representation', () => {
  const coding = Array.from({ length: 36 }, (_, index) => agent({ id: index + 1, category: 'Coding', score: { total: 100 - index }, stars: 1000 - index }));
  const specialist = [
    agent({ id: 101, category: 'Security', score: { total: 45 }, stars: 100 }),
    agent({ id: 102, category: 'Security', score: { total: 44 }, stars: 90 }),
    agent({ id: 103, category: 'Finance', score: { total: 43 }, stars: 80 }),
    agent({ id: 104, category: 'Finance', score: { total: 42 }, stars: 70 }),
    agent({ id: 105, category: 'Design', score: { total: 41 }, stars: 60 }),
    agent({ id: 106, category: 'Design', score: { total: 40 }, stars: 50 })
  ];
  const selected = selectCuratedAgents([...coding, ...specialist], 36, 2);
  assert.equal(selected.filter((item) => item.category === 'Security').length, 2);
  assert.equal(selected.filter((item) => item.category === 'Finance').length, 2);
  assert.equal(selected.filter((item) => item.category === 'Design').length, 2);
  assert.equal(selected.length, 36);
  assert.deepEqual(selected.map((item) => item.score.total), selected.map((item) => item.score.total).sort((a, b) => b - a));
});

test('week keys consistently end on Sunday in UTC', () => {
  assert.equal(weekKey('2026-09-01T23:59:00-07:00'), '2026-09-06');
  assert.equal(weekKey('2026-09-06T23:59:00Z'), '2026-09-06');
});
