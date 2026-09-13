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
  assert.equal(opportunityPattern({ title: 'Fine-grained access controls' }).name, 'Human approval & safety');
  assert.equal(opportunityPattern({ title: 'Logs about token consumption' }).name, 'Cost & token efficiency');
  assert.equal(opportunityPattern({ title: 'Make the agent less of a sycophant' }).name, 'Agent behavior & reasoning');
  assert.equal(opportunityPattern({ title: 'Support dynamic tool addition after agent creation' }).name, 'Tool execution & lifecycle');
  assert.equal(opportunityPattern({ title: 'Native WSL execution support for Windows users' }).name, 'Runtime & deployment environments');
  assert.equal(opportunityPattern({ title: 'Support event-based DAG triggers' }).name, 'Events & conditional automation');
  assert.equal(opportunityPattern({ title: 'Structured strategy representation and provenance' }).name, 'Strategy & provenance');
  assert.equal(opportunityPattern({ title: 'Support multi-user administration' }).name, 'Multi-user & team routing');
  assert.equal(opportunityPattern({ title: '知识库支持文档分类和批量导入' }).name, 'Knowledge organization');
  assert.equal(opportunityPattern({ title: 'Instagram and Tiktok publishing support' }).name, 'Channel publishing & distribution');
  assert.equal(opportunityPattern({ title: '最好能支持多用户和后台管理' }).name, 'Multi-user & team routing');
  assert.equal(opportunityPattern({ title: 'I want to use the agent on Remote SSH' }).name, 'Runtime & deployment environments');
  assert.equal(opportunityPattern({ title: 'Pydantic field datatype breaks the output parser' }).name, 'Structured output & schema fidelity');
  assert.equal(opportunityPattern({ title: 'General-purpose autonomous load testing platform' }).name, 'Testing & evaluation workflows');
  assert.equal(opportunityPattern({ title: '命令返回成串json，重点不突出，翻页麻烦，能不能返回更简洁' }).name, 'Interface & rendering');
  assert.equal(opportunityPattern({ title: '是否能够看到子 agent 的执行过程？' }).name, 'Debugging & observability');
  assert.equal(opportunityPattern({ title: 'Browser extension for web-based AI agents' }).name, 'Tool & system connectors');
  assert.equal(opportunityPattern({ title: '远程调用问题，打开服务器文件不方便' }).name, 'Runtime & deployment environments');
});

test('builds specialized coaching plans for opportunity themes', () => {
  const reliability = coachingPlan({ title: 'Retry after timeout', labels: [] });
  const integration = coachingPlan({ title: 'Add Slack connector', labels: [] });
  assert.equal(reliability.questions.length, 5);
  assert.match(reliability.experiment, /recovery|failure/i);
  assert.match(integration.experiment, /connection/i);
  assert.notEqual(reliability.hypothesis, integration.hypothesis);
});

test('adds professional recruitment and guardrails to coaching plans', () => {
  const security = coachingPlan({ title: 'Add human approval before tool execution' }, 'Security');
  const marketing = coachingPlan({ title: 'Support social campaign scheduling' }, 'Marketing');
  const research = coachingPlan({ title: 'Improve source retrieval quality' }, 'Research');
  assert.match(security.audience, /security engineers/);
  assert.match(security.constraint, /authorized/);
  assert.match(marketing.recruitment, /current campaign/);
  assert.match(marketing.constraint, /clicks or compliments/);
  assert.match(research.constraint, /citation accuracy/);
});

test('turns specific demand patterns into tailored validation experiments', () => {
  const cost = coachingPlan({ title: 'Logs about token consumption and cost', labels: [] });
  const tools = coachingPlan({ title: 'Support dynamic tool addition after agent creation', labels: [] });
  const interfacePlan = coachingPlan({ title: 'Markdown rendering breaks the task interface', labels: [] });
  assert.equal(cost.pattern.name, 'Cost & token efficiency');
  assert.match(cost.experiment, /instrument|baseline/i);
  assert.equal(tools.pattern.name, 'Tool execution & lifecycle');
  assert.match(tools.proof, /state transition/i);
  assert.equal(interfacePlan.pattern.name, 'Interface & rendering');
  assert.match(interfacePlan.experiment, /usability/i);
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
    { title: 'Daily security sweep — backlog', labels: ['dependencies', 'security'] },
    { title: 'Security Policy not fully set up', labels: [] },
    { title: 'Triage the security-scanning baseline before preview', labels: ['tests'] },
    { title: 'You do not have a valid license of this product.', labels: ['kind/bug'] },
    { title: 'Denied request, used Claude Review', labels: [] },
    { title: "Ctrl+V dosen't work", labels: ['bug'] },
    { title: 'Epic: Hive Mind: Unlimited Agent Swarm with Complete MCP Integration', labels: ['enhancement'] },
    { title: 'Harden the tag-driven workflow for stable and preview releases', labels: ['platform'] },
    { title: 'Prime Agent v0.8: five-stack integration tracker', labels: [] },
    { title: 'Harden clean-room evaluation and evaluate the verifier on the current corpus', labels: ['conformance'] },
    { title: 'Production soak-test of pull/work-stealing coordination before default-on', labels: ['test'] },
    { title: 'Architecture Validation: 8 doc-drift findings + 3 non-critical invariant gaps (2026-08-16)', labels: ['automated'] },
    { title: '感谢大佬的教程，学完后分享出来共同学习', labels: ['feedback'] },
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

test('rejects maintainer-authored backlog and repository-specific defects as market demand', () => {
  const noise = [
    { title: 'Bind GitHub tools to the active Project and reuse execution credential availability', labels: ['bug'], authorAssociation: 'COLLABORATOR', comments: 8, reactions: 0 },
    { title: 'Security-file guard census: 8 more demonstrated gaps, including an SSRF enforcement point', labels: [], authorAssociation: 'OWNER', comments: 8, reactions: 0 },
    { title: '[BUG] /discover returns HTTP 500 — search_blueprint crashes', labels: [], authorAssociation: 'CONTRIBUTOR', comments: 22, reactions: 1 },
    { title: '[BUG] 5 user-facing routes return 404 after deployment drift', labels: [], authorAssociation: 'CONTRIBUTOR', comments: 12, reactions: 0 }
  ];
  noise.forEach((issue) => assert.equal(isUsefulDemandSignal(issue), false, issue.title));
  assert.equal(isUsefulDemandSignal({ title: 'Feature request: add approval gates for destructive commands', labels: [], authorAssociation: 'NONE', comments: 3, reactions: 0 }), true);
  assert.equal(isUsefulDemandSignal({ title: 'Proposal: support audited agent actions', labels: [], authorAssociation: 'OWNER', comments: 8, reactions: 3 }), true);
});

test('rejects aggregate roadmaps and unsupported low-engagement defects', () => {
  const noise = [
    { title: 'ROADMAP 2025', labels: [], authorAssociation: 'MEMBER', comments: 64, reactions: 40 },
    { title: '[Bug] One metric kind is applied to the whole clause', labels: ['bug'], authorAssociation: 'NONE', comments: 2, reactions: 0 },
    { title: 'Github Copilot connection timeout', labels: ['bug'], authorAssociation: 'NONE', comments: 2, reactions: 0 },
    { title: 'AI Research fails at Data Collection with 502 for multiple tickers', labels: [], authorAssociation: 'NONE', comments: 2, reactions: 0 },
    { title: 'Error: Failed to retrieve data with a legacy provider API', labels: [], authorAssociation: 'NONE', comments: 2, reactions: 0 },
    { title: 'windows独立版使用免费api，发送消息后显示链接失败', labels: [], authorAssociation: 'NONE', comments: 2, reactions: 0 }
  ];
  noise.forEach((issue) => assert.equal(isUsefulDemandSignal(issue), false, issue.title));
  assert.equal(isUsefulDemandSignal({ title: 'Output parser repeatedly violates the requested schema', labels: ['bug'], authorAssociation: 'NONE', comments: 29, reactions: 5 }), true);
  assert.equal(isUsefulDemandSignal({ title: 'Unable to use locally deployed models', labels: ['bug'], authorAssociation: 'NONE', comments: 5, reactions: 0 }), true);
});
