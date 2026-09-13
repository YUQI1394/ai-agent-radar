const THEMES = [
  { name: 'Reliability', slug: 'reliability', pattern: /error|fail|retry|timeout|crash|recover|reliab|stability|429|rate.?limit|capacity|unavailable|outage/i },
  { name: 'Integrations', slug: 'integrations', pattern: /integrat|connector|plugin|api|mcp|webhook|provider|instagram|tiktok|social.?media|agent mail/i },
  { name: 'Developer Experience', slug: 'developer-experience', pattern: /document|example|install|setup|config|debug|typescript|sdk|cli/i },
  { name: 'Memory & Data', slug: 'memory-data', pattern: /memory|context|database|storage|vector|retriev|knowledge|rag/i },
  { name: 'Agent Control', slug: 'agent-control', pattern: /workflow|multi-agent|human|approval|observ|trace|monitor|schedule/i },
  { name: 'Product Capability', slug: 'product-capability', pattern: /.*/i }
];
const PATTERNS = [
  { name: 'Rate limits & capacity', theme: 'Reliability', pattern: /429|rate.?limit|quota|capacity|throttl/i },
  { name: 'Cost & token efficiency', theme: 'Product Capability', pattern: /token(?:s| consumption| usage|[- ]greedy)|too many tokens|burn\w*.{0,30}(?:token|round)|cost|billing|budget/i },
  { name: 'Failure recovery', theme: 'Reliability', pattern: /retry|recover|resume|checkpoint|timeout|crash|failover/i },
  { name: 'Provider interoperability', theme: 'Integrations', pattern: /provider|model support|llms?|openai|anthropic|ollama|gemini|hermes|azure|bedrock/i },
  { name: 'Channel publishing & distribution', theme: 'Integrations', pattern: /instagram|tiktok|social.?media|cross.?post|publishing channel/i },
  { name: 'Tool & system connectors', theme: 'Integrations', pattern: /connector|plugin|webhook|mcp|integrat|api\b|agent mail|mail support|browser extension/i },
  { name: 'Setup & configuration', theme: 'Developer Experience', pattern: /install|setup|config|environment|deploy|docker/i },
  { name: 'Debugging & observability', theme: 'Agent Control', pattern: /debug|observ|trace|log|monitor|telemetry|执行过程|执行.{0,12}看到|可见.{0,12}agent/i },
  { name: 'Context & memory boundaries', theme: 'Memory & Data', pattern: /memory|context|session|persist|recall/i },
  { name: 'Retrieval & knowledge quality', theme: 'Memory & Data', pattern: /retriev|knowledge|vector|rag|embedding|database/i },
  { name: 'Human approval & safety', theme: 'Agent Control', pattern: /human|approv(?:al|ed)|permission|access.?control|guardrail|security|privacy/i },
  { name: 'Workflow orchestration', theme: 'Agent Control', pattern: /workflow|multi-agent|schedule|queue|parallel|orchestrat/i },
  { name: 'Data import & export', theme: 'Product Capability', pattern: /export|import|backup|download|upload|migration/i },
  { name: 'Documentation & examples', theme: 'Developer Experience', pattern: /document|example|tutorial|guide|typescript|sdk|cli/i },
  { name: 'Agent behavior & reasoning', theme: 'Product Capability', pattern: /sycophan|death spiral|reasoning agent|instruction following|response quality/i },
  { name: 'Tool execution & lifecycle', theme: 'Product Capability', pattern: /dynamic tool|tool (?:addition|removal|call|execution)|parallel tool|skills?|abilities|operators?|perform work|execution kwargs/i },
  { name: 'Runtime & deployment environments', theme: 'Product Capability', pattern: /\bwsl\b|windows users?|dedicated cloud|local ai|locally deployed|runtime-owned|remote ssh|ssh environment|远程调用|服务器.{0,20}(?:文件|路径)|系统路径|本地安装/i },
  { name: 'Structured output & schema fidelity', theme: 'Product Capability', pattern: /structured output|output parser|pydantic|schema fidelity|field datatype|json schema/i },
  { name: 'Testing & evaluation workflows', theme: 'Product Capability', pattern: /testing platform|load testing|quality assurance|\bqa\b|evaluation workflow/i },
  { name: 'Interface & rendering', theme: 'Product Capability', pattern: /markdown rendering|web ui|html routes?|prompt is not always returned|json.{0,30}(?:concise|compact)|重点不突出|翻页麻烦|返回更简洁/i },
  { name: 'Access, privacy & accountability', theme: 'Agent Control', pattern: /access.?control|privacy|destruct\w* commands?|credential|who initiated|task cancellation/i },
  { name: 'Multi-user & team routing', theme: 'Agent Control', pattern: /multi-user|team members?|several agents|nearest answers|多用户|后台管理|管理员.{0,12}(?:老师|学生|角色)/i },
  { name: 'Events & conditional automation', theme: 'Agent Control', pattern: /event-based|dag triggers?|pre.?conditions?/i },
  { name: 'Strategy & provenance', theme: 'Product Capability', pattern: /strategy|provenance|structured representation|description-driven adaptation/i },
  { name: 'Knowledge organization', theme: 'Memory & Data', pattern: /knowledge base|知识库|文档.{0,20}(?:分类|批量导入)/i },
  { name: 'Distribution & marketplaces', theme: 'Product Capability', pattern: /distribution system|npm packages?|marketplace/i }
];
const MAINTENANCE_NOISE = /dependenc(?:y|ies) (?:dashboard|update|refresh|bump)|daily security sweep|release checklist|roadmap tracking|tag-driven workflow.{0,40}releases?|\b(?:five-stack )?integration tracker\b|clean-room evaluation|current conformance (?:manifest|corpus)|ci red|build status|build artifacts?|automated update|test matrix|canary|flaky test|tests? (?:fail|failing)|verification.*manifest|security policy (?:is )?(?:not )?(?:fully )?set up|security[- ]scanning baseline|valid license of this product|gsoc.*community|already[- ]fixed|duplicate|wontfix|invalid/i;
const INTERNAL_WORK = /^(?:chore|test|ci|build|epic|tracking|intake|publish|triage|plan(?:-\d+)?)\b/i;
const NON_DEMAND_BRACKET = /^\[(?!bug\b|feat(?:ure)?\b|enhancement\b|request\b|proposal\b|rfc\b|security\b)[^\]]+\]/i;
const SUPPORT_QUESTION = /^(?:question|help(?: me)?|how (?:do|can|to)\b|why\b|i (?:can'?t|cant|cannot)\b|can someone\b|is there a way\b)/i;
const EXPLICIT_DEMAND = /feature|request|proposal|enhancement|support|allow|enable|add|expose|integrat|workflow|access.?control|approval|memory|security|privacy|observ|export|import|api|provider|webhook|documentation|performance|retry|recovery|rate.?limit/i;
const VAGUE_REPORT = /^(?:not parsed|no results whatsoever|denied request(?:,.*)?|ctrl\+v (?:doesn'?t|dosen'?t|does not) work|import .{0,30} issue|感谢.{0,30}(?:教程|大佬).{0,100}(?:分享|共同学习))$/i;
const INTERNAL_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);
const REPOSITORY_DEFECT = /deployment drift|http 5\d\d.{0,80}(?:crash|server error)|(?:routes?|endpoints?|hostnames?|\/[\w.-]+).{0,80}(?:404|do not answer)|modulenotfounderror|guard census|suite green/i;
const AGGREGATE_TRACKER = /^(?:product\s+)?roadmap(?:\s+(?:20\d{2}|q[1-4]))?[\s:–—-]*$/i;

function isUsefulDemandSignal(issue = {}) {
  const title = String(issue.title || '').trim();
  const labels = (issue.labels || []).join(' ');
  const association = String(issue.authorAssociation || '').toUpperCase();
  const comments = Math.max(0, Number(issue.comments || 0));
  const reactions = Math.max(0, Number(issue.reactions || 0));
  const withoutAllowedPrefix = title.replace(/^\[(?:bug|feat(?:ure)?|enhancement|request|proposal|rfc|security)\]\s*:?[ ]*/i, '');
  if (title.length < 12 || AGGREGATE_TRACKER.test(title) || MAINTENANCE_NOISE.test(`${title} ${labels}`)) return false;
  if (INTERNAL_WORK.test(withoutAllowedPrefix) || NON_DEMAND_BRACKET.test(title) || VAGUE_REPORT.test(withoutAllowedPrefix)) return false;
  if (INTERNAL_ASSOCIATIONS.has(association) && reactions < 2) return false;
  if (/^\[?bug\b|\bbug\b/i.test(`${title} ${labels}`) && reactions === 0 && comments <= 2) return false;
  if (REPOSITORY_DEFECT.test(title) && reactions < 2) return false;
  if (SUPPORT_QUESTION.test(withoutAllowedPrefix) && !EXPLICIT_DEMAND.test(`${title} ${labels}`)) return false;
  return true;
}

function opportunityTheme(issue) {
  const text = `${issue.title || ''} ${(issue.labels || []).join(' ')}`;
  return THEMES.find((theme) => theme.pattern.test(text)) || THEMES[THEMES.length - 1];
}

function opportunityPattern(issue) {
  const text = `${issue.title || ''} ${(issue.labels || []).join(' ')}`;
  const theme = opportunityTheme(issue);
  return PATTERNS.find((pattern) => pattern.pattern.test(text)) || { name: `${theme.name} workflows`, theme: theme.name };
}

const COACHING = {
  reliability: { hypothesis: 'For [operator], the workflow fails during [condition], forcing [recovery work] and costing [time, money or trust].', questions: ['Show me the last failure and its logs.', 'What triggered it and how often does it recur?', 'How do you detect it today?', 'What does recovery require?', 'What would a safe failure look like?'], experiment: 'Add one narrow guardrail, retry or recovery path around the failing step. Replay three real failure cases and compare recovery time.', proof: 'The same failure is recovered faster in three real cases without creating a new incident.' },
  integrations: { hypothesis: 'For [team], moving data between [system A] and [system B] requires [manual work], causing [delay or errors].', questions: ['Which systems must exchange data?', 'What triggers the handoff?', 'Which fields or permissions block it?', 'How is it handled today?', 'Who owns failures between systems?'], experiment: 'Manually operate or prototype one high-frequency connection for one team before building a general connector.', proof: 'A user completes the real cross-system workflow twice and asks to keep the connection active.' },
  'developer-experience': { hypothesis: 'For [developer], completing [setup or development task] is unclear at [step], causing [abandonment or rework].', questions: ['Screen-share the task without guidance.', 'Where do you first hesitate?', 'What did you search for?', 'Which error or concept is unclear?', 'What workaround finally unblocked you?'], experiment: 'Create the smallest example, diagnostic or setup assistant and observe three developers using it unprompted.', proof: 'Three developers finish the task with fewer interventions or measurably less time.' },
  'memory-data': { hypothesis: 'For [user], the agent loses or retrieves [information] incorrectly across [scope], causing [wrong action or repeated work].', questions: ['Which information must persist?', 'For how long and within what scope?', 'Show the last wrong or missing recall.', 'What data must never cross boundaries?', 'How do you correct memory today?'], experiment: 'Test one constrained memory scope with a small real dataset and a written expected-recall benchmark.', proof: 'The system retrieves the right evidence across repeated sessions without leaking or inventing context.' },
  'agent-control': { hypothesis: 'For [owner], the agent takes or proposes [action] without enough [visibility, approval or control], creating [risk].', questions: ['Which action needs oversight?', 'When should a human intervene?', 'What evidence is needed to approve it?', 'How is an action reversed?', 'Who is accountable when it fails?'], experiment: 'Insert one approval, audit or pause point into a live workflow and measure delay versus prevented risk.', proof: 'Owners can explain, approve and reverse the action without blocking low-risk work.' },
  'product-capability': { hypothesis: 'For [specific user], completing [job] is difficult because [missing capability], causing [measurable consequence].', questions: ['When did you last need this?', 'What outcome were you trying to reach?', 'What did you use instead?', 'How often does this occur?', 'What commitment would prove it matters?'], experiment: 'Deliver the outcome manually or with a narrow prototype before building a reusable feature.', proof: 'A user completes the real workflow and commits time, data, distribution or budget to repeat it.' }
};

const PATTERN_COACHING = {
  'Cost & token efficiency': { hypothesis: 'For [operator], one completed [workflow] consumes [tokens or spend], exceeding [acceptable budget] because [specific repeated step].', questions: ['Show the cost or token trace for one completed task.', 'Which step consumes the largest share?', 'How often is context or work repeated?', 'What quality level must remain unchanged?', 'What monthly limit would make this sustainable?'], experiment: 'Instrument one representative workflow, remove or cache its highest-cost repeated step, then replay the same task set against the original baseline.', proof: 'Median cost falls by a written target across at least five comparable runs without reducing completion quality.' },
  'Agent behavior & reasoning': { hypothesis: 'For [user], the agent repeatedly [undesired behavior] in [situation], causing [wrong decision, rework or loss of trust].', questions: ['Show three recent examples of the behavior.', 'What response or action would have been acceptable?', 'Which context predicts the failure?', 'How do users correct it today?', 'What new failure must the fix avoid?'], experiment: 'Create a ten-case behavioral benchmark from real failures and test one narrow prompt, policy or evaluation change against the unchanged baseline.', proof: 'The target behavior improves on the written benchmark without a material regression on the control cases.' },
  'Tool execution & lifecycle': { hypothesis: 'For [builder], the agent cannot reliably [select, add, call or remove a tool] during [workflow], causing [manual intervention or failed work].', questions: ['Which tool operation fails?', 'What state exists immediately before the failure?', 'How should errors and partial results be exposed?', 'Which permissions or schemas are involved?', 'What workaround keeps the workflow moving?'], experiment: 'Implement or simulate one tool lifecycle operation with explicit inputs, outputs and failure handling, then replay three real calls.', proof: 'Three representative calls complete with the expected state transition and an observable recovery path.' },
  'Runtime & deployment environments': { hypothesis: 'For [team], the agent cannot run reliably in [target environment], blocking [workflow] because of [dependency, packaging or platform constraint].', questions: ['Which exact environment and version is required?', 'Where does installation or execution first fail?', 'What dependency or permission differs?', 'How is the agent deployed today?', 'How many users share this environment?'], experiment: 'Package the smallest supported path for one named environment and observe three clean installations from written instructions.', proof: 'Three users reach the same working task from a clean environment without undocumented intervention.' },
  'Interface & rendering': { hypothesis: 'For [user], the interface fails to expose or render [critical state or action], preventing [job] and causing [workaround].', questions: ['Show the exact screen and action where progress stops.', 'What did you expect to see?', 'Is the underlying data correct?', 'Which devices or browsers reproduce it?', 'What workaround is used now?'], experiment: 'Prototype one corrected interaction or rendering state and run five task-based usability attempts.', proof: 'At least four of five users complete the target action without explanation and can describe the resulting state.' },
  'Structured output & schema fidelity': { hypothesis: 'For [builder], the agent returns output that violates [required schema or type], breaking [downstream workflow] and causing [repair work].', questions: ['Show the expected schema and the last invalid result.', 'Which field or type breaks downstream processing?', 'How often does the failure occur?', 'How is invalid output repaired today?', 'Which valid edge cases must remain supported?'], experiment: 'Build a fixed set of ten real schema cases, apply one constrained-output or repair strategy and compare valid completion against the unchanged baseline.', proof: 'At least nine of ten cases pass the same downstream validator without manual repair or loss of required information.' },
  'Testing & evaluation workflows': { hypothesis: 'For [team], validating [agent behavior or system load] before release requires [manual or missing process], allowing [failure or delay] to reach production.', questions: ['What decision should the test support?', 'Which real failure is currently missed?', 'What environment and load must be reproduced?', 'Which result is trustworthy enough to block release?', 'Who reviews and acts on the result?'], experiment: 'Run one repeatable pre-release scenario against a written baseline and expose the result to the person who owns the release decision.', proof: 'The same scenario produces a repeatable result and changes one real release, remediation or scope decision.' },
  'Channel publishing & distribution': { hypothesis: 'For [publisher], distributing [content] to [channel] requires [manual handoff or reformatting], causing [delay, inconsistency or missed reach].', questions: ['Which channels are part of the real campaign?', 'What must change for each channel?', 'Where do credentials or approvals enter?', 'How is failure detected and retried?', 'Which publishing result matters beyond clicks?'], experiment: 'Operate one cross-channel post manually or through a narrow connector, including approval and failure recovery, for three real publishing cycles.', proof: 'The publisher repeats the workflow across three cycles and keeps the connection active because it reduces measurable handoff work.' },
  'Strategy & provenance': { hypothesis: 'For [decision-maker], an agent recommendation lacks [structure, source or change history], making [decision] difficult to verify.', questions: ['Which decision must be audited?', 'What source evidence is required?', 'Who challenges or approves the output?', 'How are assumptions changed today?', 'What format fits the existing review process?'], experiment: 'Produce one structured, source-linked decision artifact for a live case and have two domain reviewers challenge it.', proof: 'Reviewers can trace each material claim, identify changed assumptions and make the decision without reconstructing the analysis.' }
};

const DOMAIN_COACHING = {
  Security: { audience: 'security engineers or SOC operators', recruitment: 'Recruit authorized practitioners from security teams, maintainer discussions and specialist communities.', constraint: 'Use only systems and data you are explicitly authorized to test; measure risk reduction as well as speed.' },
  Finance: { audience: 'finance operators, analysts or accountants', recruitment: 'Recruit people who perform the workflow with real controls, reconciliations or reporting deadlines.', constraint: 'Use anonymized or synthetic records and require human review for financial decisions and regulated outputs.' },
  Research: { audience: 'researchers, analysts or librarians', recruitment: 'Recruit people who can bring a recent literature, evidence-review or source-tracing task.', constraint: 'Measure citation accuracy, coverage and review time; never reward speed at the expense of source fidelity.' },
  Coding: { audience: 'developers or engineering leads', recruitment: 'Recruit contributors who can replay the problem in a representative repository and development environment.', constraint: 'Use a fixed test case and compare completion, regressions and recovery against the unchanged baseline.' },
  Marketing: { audience: 'marketers or growth operators', recruitment: 'Recruit people running a current campaign, channel or content workflow—not people reacting to an idea pitch.', constraint: 'Measure completed workflow, time saved or a real distribution commitment; do not treat clicks or compliments as proof.' },
  Design: { audience: 'designers or creative leads', recruitment: 'Recruit practitioners with a current brief, asset handoff or revision cycle that can be observed end to end.', constraint: 'Keep a human quality review and measure accepted output, revision count and cycle time.' },
  Productivity: { audience: 'operators or knowledge workers', recruitment: 'Recruit people who repeat the task every week and can show their current calendar, notes or coordination workaround.', constraint: 'Measure repeated use and time returned across two cycles, not a one-time demo completion.' },
  'Agent Infrastructure': { audience: 'agent-platform engineers or technical operators', recruitment: 'Recruit teams with live traces, tool calls or deployment constraints from a real agent workflow.', constraint: 'Test observable state transitions, permission boundaries and recovery from partial failure.' }
};

function coachingPlan(issue, domain = '') {
  const theme = opportunityTheme(issue);
  const pattern = opportunityPattern(issue);
  const professional = DOMAIN_COACHING[domain] || { audience: 'people affected by this workflow', recruitment: 'Recruit people who can show a recent, concrete example of the problem.', constraint: 'Measure behavior in the real workflow and keep a human review step for consequential actions.' };
  return { theme, pattern, ...(PATTERN_COACHING[pattern.name] || COACHING[theme.slug]), ...professional };
}

function issueFingerprint(title = '') {
  return String(title).toLowerCase()
    .replace(/^\s*(?:\[[^\]]{1,30}\]|feat(?:ure)?|bug|question|proposal|enhancement)\s*[:_-]*\s*/i, '')
    .replace(/[`'"()[\]{}:;,.!?_-]+/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function issueExcerpt(body = '', limit = 320) {
  const cleaned = String(body || '')
    .replace(/<!--[^]*?-->/g, ' ')
    .replace(/```[^]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/gi, '[link]')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[email hidden]')
    .replace(/(?:gh[opusr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,})/g, '[credential hidden]')
    .replace(/^\s*(?:#{1,6}|[-*+] |\d+\. |\[[ xX]\] )/gm, '')
    .replace(/[*_~>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  return cleaned.length <= limit ? cleaned : `${cleaned.slice(0, limit).replace(/\s+\S*$/, '')}…`;
}

function cleanIssueEvidence(issues = []) {
  const fingerprints = new Set();
  return issues.filter((issue) => {
    const searchable = `${issue.title || ''} ${(issue.labels || []).join(' ')}`;
    const fingerprint = issueFingerprint(issue.title);
    if (!fingerprint || fingerprints.has(fingerprint) || !isUsefulDemandSignal(issue)) return false;
    fingerprints.add(fingerprint);
    return true;
  });
}

function evidenceEngagement(issue = {}) {
  const comments = Math.max(0, Number(issue.comments || 0));
  const reactions = Math.max(0, Number(issue.reactions || 0));
  const discussion = Math.min(24, Math.log2(comments + 1) * 4.5);
  const independentApproval = Math.min(24, Math.log2(reactions + 1) * 6);
  return Math.round(discussion + independentApproval);
}

function evidenceFreshness(issue = {}, now = Date.now()) {
  const updatedAt = Date.parse(issue.updatedAt || issue.createdAt || '');
  if (!Number.isFinite(updatedAt)) return 0;
  const ageDays = Math.max(0, (now - updatedAt) / 86400000);
  if (ageDays <= 30) return 10;
  if (ageDays <= 90) return 7;
  if (ageDays <= 365) return 3;
  return 0;
}

function evidenceStrength(issue = {}, now = Date.now()) {
  return evidenceEngagement(issue) + evidenceFreshness(issue, now);
}

module.exports = { PATTERNS, THEMES, cleanIssueEvidence, coachingPlan, evidenceEngagement, evidenceFreshness, evidenceStrength, isUsefulDemandSignal, issueExcerpt, issueFingerprint, opportunityPattern, opportunityTheme };
