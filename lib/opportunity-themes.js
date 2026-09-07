const THEMES = [
  { name: 'Reliability', slug: 'reliability', pattern: /error|fail|retry|timeout|crash|recover|reliab|stability/i },
  { name: 'Integrations', slug: 'integrations', pattern: /integrat|connector|plugin|api|mcp|webhook|provider/i },
  { name: 'Developer Experience', slug: 'developer-experience', pattern: /document|example|install|setup|config|debug|typescript|sdk|cli/i },
  { name: 'Memory & Data', slug: 'memory-data', pattern: /memory|context|database|storage|vector|retriev|knowledge|rag/i },
  { name: 'Agent Control', slug: 'agent-control', pattern: /workflow|multi-agent|human|approval|observ|trace|monitor|schedule/i },
  { name: 'Product Capability', slug: 'product-capability', pattern: /.*/i }
];
const MAINTENANCE_NOISE = /dependency dashboard|release checklist|roadmap tracking|ci red|build status|build artifacts?|automated update|test matrix|canary|flaky test|tests? (?:fail|failing)|verification.*manifest|gsoc.*community/i;

function opportunityTheme(issue) {
  const text = `${issue.title || ''} ${(issue.labels || []).join(' ')}`;
  return THEMES.find((theme) => theme.pattern.test(text)) || THEMES[THEMES.length - 1];
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

module.exports = { THEMES, cleanIssueEvidence, issueFingerprint, opportunityTheme };
