const THEMES = [
  { name: 'Integrations', slug: 'integrations', pattern: /integrat|connector|plugin|api|mcp|webhook|provider/i },
  { name: 'Reliability', slug: 'reliability', pattern: /error|fail|retry|timeout|crash|recover|reliab|stability/i },
  { name: 'Developer Experience', slug: 'developer-experience', pattern: /document|example|install|setup|config|debug|typescript|sdk|cli/i },
  { name: 'Memory & Data', slug: 'memory-data', pattern: /memory|context|database|storage|vector|retriev|knowledge|rag/i },
  { name: 'Agent Control', slug: 'agent-control', pattern: /workflow|multi-agent|human|approval|observ|trace|monitor|schedule/i },
  { name: 'Product Capability', slug: 'product-capability', pattern: /.*/i }
];

function opportunityTheme(issue) {
  const text = `${issue.title || ''} ${(issue.labels || []).join(' ')}`;
  return THEMES.find((theme) => theme.pattern.test(text)) || THEMES[THEMES.length - 1];
}

module.exports = { THEMES, opportunityTheme };
