const assert = require('node:assert/strict');

const origin = (process.env.RADAR_ORIGIN || 'https://getaiagentradar.com').replace(/\/$/, '');
const pages = [
  ['/', 'AI Agent Radar'],
  ['/opportunities', 'Opportunity'],
  ['/patterns', 'Pattern'],
  ['/workspace', 'Workspace'],
  ['/methodology', 'Methodology'],
  ['/status', 'Status'],
  ['/category/research', 'Research AI Agents'],
  ['/category/security', 'Security AI Agents'],
  ['/category/finance', 'Finance AI Agents']
];

async function main() {
  const pageBodies = new Map();
  for (const [path, marker] of pages) {
    const response = await fetch(`${origin}${path}`, { redirect: 'follow' });
    assert.equal(response.status, 200, `${path} returned ${response.status}`);
    const html = await response.text();
    pageBodies.set(path, html);
    assert.match(html, new RegExp(marker, 'i'), `${path} is missing ${marker}`);
    console.log(`PASS ${path}`);
  }

  const opportunityHref = pageBodies.get('/opportunities')?.match(/href="(\/opportunity\/\d+)"/)?.[1];
  assert.ok(opportunityHref, 'Opportunity Radar has no traceable detail link');
  const detail = await fetch(`${origin}${opportunityHref}`);
  assert.equal(detail.status, 200, `${opportunityHref} returned ${detail.status}`);
  const detailHtml = await detail.text();
  assert.match(detailHtml, /Reporter context:/i, 'opportunity detail lacks reporter evidence');
  assert.match(detailHtml, /Start free validation sprint/i, 'opportunity detail lacks execution path');
  assert.match(detailHtml, /Share this brief/i, 'opportunity detail lacks sharing');
  console.log(`PASS ${opportunityHref} journey`);

  const [sitemap, feed, authConfig] = await Promise.all([
    fetch(`${origin}/sitemap.xml`), fetch(`${origin}/feed.xml`), fetch(`${origin}/auth-config.json`, { cache: 'no-store' })
  ]);
  assert.equal(sitemap.status, 200, '/sitemap.xml is unavailable');
  assert.match(await sitemap.text(), /<urlset[\s>]/, 'sitemap XML is malformed');
  assert.equal(feed.status, 200, '/feed.xml is unavailable');
  assert.match(await feed.text(), /<rss[\s>]/, 'RSS XML is malformed');
  assert.equal(authConfig.status, 200, '/auth-config.json is unavailable');
  const auth = await authConfig.json();
  assert.equal(auth.configured, true, 'free registration is not configured');
  assert.match(auth.publishableKey || '', /^sb_publishable_/, 'auth config does not expose a publishable key');
  assert.doesNotMatch(JSON.stringify(auth), /service_role|secret/i, 'auth config may expose privileged credentials');
  console.log('PASS discovery and registration endpoints');

  const response = await fetch(`${origin}/health`, { cache: 'no-store' });
  const health = await response.json();
  assert.equal(response.status, 200, `/health returned ${response.status}`);
  assert.equal(health.status, 'healthy');
  assert.ok(health.projects >= 20, 'curated project depth is below 20');
  assert.equal(health.checks?.feedFresh, true, 'feed is stale');
  assert.equal(health.checks?.issueCoverage, true, 'Issue scan coverage is below 50%');
  assert.equal(health.checks?.demandEvidence, true, 'demand evidence feed is empty or too shallow');
  assert.equal(health.checks?.evidenceContext, true, 'reporter context coverage is below 75%');
  assert.equal(health.checks?.professionalBreadth, true, 'professional domain coverage has collapsed');
  assert.ok(health.professionalCoverage?.representedDomains >= 6, 'fewer than six professional domains represented');
  if (health.ingestion) assert.equal(health.ingestion.degraded, false, 'latest GitHub refresh was partial');
  console.log(`PASS /health (${health.projects} projects, ${health.evidenceSignals} evidence signals)`);

  const headers = await fetch(`${origin}/`, { method: 'HEAD' });
  assert.match(headers.headers.get('strict-transport-security') || '', /max-age=/i);
  assert.equal(headers.headers.get('x-frame-options'), 'DENY');
  assert.match(headers.headers.get('content-security-policy') || '', /default-src 'self'/i);
  const workspaceHeaders = await fetch(`${origin}/workspace`, { method: 'HEAD' });
  assert.match(workspaceHeaders.headers.get('x-robots-tag') || pageBodies.get('/workspace') || '', /noindex/i);
  console.log('PASS security headers');
}

main().catch((error) => {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
});
