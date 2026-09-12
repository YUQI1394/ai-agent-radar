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
  ['/category/finance', 'Finance AI Agents'],
  ['/category/coding', 'Coding AI Agents'],
  ['/category/marketing', 'Marketing AI Agents'],
  ['/category/design', 'Design AI Agents'],
  ['/category/productivity', 'Productivity AI Agents'],
  ['/category/infrastructure', 'Agent Infrastructure AI Agents']
];

async function main() {
  const pageBodies = new Map();
  for (const [path, marker] of pages) {
    const response = await fetch(`${origin}${path}`, { redirect: 'follow' });
    assert.equal(response.status, 200, `${path} returned ${response.status}`);
    const html = await response.text();
    pageBodies.set(path, html);
    assert.match(html, new RegExp(marker, 'i'), `${path} is missing ${marker}`);
    if (path.startsWith('/category/')) {
      const demandCount = Number(html.match(/LIVE GITHUB DEMAND[\s\S]{0,300}<h2>(\d+) qualified signals/i)?.[1] || 0);
      assert.ok(demandCount >= 2, `${path} has fewer than two qualified demand signals`);
      assert.match(html, /#demand/, `${path} lacks structured demand data`);
      assert.match(html, /Start guided sprint/i, `${path} lacks an execution path`);
    }
    console.log(`PASS ${path}`);
  }

  const filteredOpportunities = await fetch(`${origin}/opportunities?q=memory`);
  assert.equal(filteredOpportunities.status, 200, `filtered opportunities returned ${filteredOpportunities.status}`);
  assert.match(filteredOpportunities.headers.get('x-robots-tag') || '', /noindex/i, 'filtered opportunities lack an HTTP noindex signal');
  assert.match(await filteredOpportunities.text(), /<meta name="robots" content="noindex, follow">/i, 'filtered opportunities lack an HTML noindex signal');
  console.log('PASS filtered opportunity indexing controls');

  const opportunityCache = await fetch(`${origin}/opportunities`, { method: 'HEAD' });
  assert.match(opportunityCache.headers.get('cache-control') || '', /public/i, 'opportunity intelligence is not publicly cacheable');
  console.log('PASS public intelligence cache policy');

  const opportunityHref = pageBodies.get('/opportunities')?.match(/href="(\/opportunity\/\d+)"/)?.[1];
  assert.ok(opportunityHref, 'Opportunity Radar has no traceable detail link');
  const detail = await fetch(`${origin}${opportunityHref}`);
  assert.equal(detail.status, 200, `${opportunityHref} returned ${detail.status}`);
  const detailHtml = await detail.text();
  assert.match(detailHtml, /Reporter context:/i, 'opportunity detail lacks reporter evidence');
  assert.match(detailHtml, /Start free validation sprint/i, 'opportunity detail lacks execution path');
  assert.match(detailHtml, /Share this brief/i, 'opportunity detail lacks sharing');
  assert.match(detailHtml, /\/analytics\.js/, 'opportunity journey lacks anonymous page analytics');
  console.log(`PASS ${opportunityHref} journey`);

  const [analyticsLoader, insightsScript, authScript] = await Promise.all([
    fetch(`${origin}/analytics.js`), fetch(`${origin}/_vercel/insights/script.js`), fetch(`${origin}/auth.js`)
  ]);
  assert.equal(analyticsLoader.status, 200, '/analytics.js is unavailable');
  assert.match(await analyticsLoader.text(), /\/_vercel\/insights\/script\.js/, 'analytics loader does not use Vercel Insights');
  assert.equal(insightsScript.status, 200, 'Vercel Web Analytics is not enabled');
  assert.match(insightsScript.headers.get('content-type') || '', /javascript/i, 'Vercel analytics route is not JavaScript');
  assert.equal(authScript.status, 200, '/auth.js is unavailable');
  assert.match(await authScript.text(), /\/analytics\.js/, 'registration journey does not load anonymous analytics');
  console.log('PASS privacy-preserving conversion analytics');

  const [sitemap, feed, authConfig] = await Promise.all([
    fetch(`${origin}/sitemap.xml`), fetch(`${origin}/feed.xml`), fetch(`${origin}/auth-config.json`, { cache: 'no-store' })
  ]);
  assert.equal(sitemap.status, 200, '/sitemap.xml is unavailable');
  const sitemapXml = await sitemap.text();
  assert.match(sitemapXml, /<urlset[\s>]/, 'sitemap XML is malformed');
  assert.equal(feed.status, 200, '/feed.xml is unavailable');
  assert.match(await feed.text(), /<rss[\s>]/, 'RSS XML is malformed');
  assert.equal(authConfig.status, 200, '/auth-config.json is unavailable');
  const auth = await authConfig.json();
  assert.equal(auth.configured, true, 'free registration is not configured');
  assert.match(auth.publishableKey || '', /^sb_publishable_/, 'auth config does not expose a publishable key');
  assert.doesNotMatch(JSON.stringify(auth), /service_role|secret/i, 'auth config may expose privileged credentials');
  console.log('PASS discovery and registration endpoints');

  const sitemapPaths = [...sitemapXml.matchAll(/<loc>https:\/\/[^/]+([^<]*)<\/loc>/g)]
    .map((match) => match[1] || '/');
  const headPaths = new Set(['/']);
  for (const prefix of ['/agent/', '/opportunity/', '/category/', '/weekly', '/patterns', '/opportunities']) {
    const match = sitemapPaths.find((path) => path === prefix || path.startsWith(prefix));
    if (match) headPaths.add(match);
  }
  assert.ok(headPaths.size >= 7, 'sitemap is missing one or more public route families');
  const headResults = await Promise.all([...headPaths].map(async (path) => {
    const result = await fetch(`${origin}${path}`, { method: 'HEAD', redirect: 'follow' });
    return [path, result.status];
  }));
  for (const [path, status] of headResults) assert.equal(status, 200, `HEAD ${path} returned ${status}`);
  console.log(`PASS sitemap HEAD coverage (${headResults.length} route families)`);

  let response;
  for (let healthAttempt = 1; healthAttempt <= 12; healthAttempt += 1) {
    response = await fetch(`${origin}/health`, { cache: 'no-store' });
    if (response.status === 200 || healthAttempt === 12) break;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  const health = await response.json();
  assert.equal(response.status, 200, `/health returned ${response.status}`);
  assert.equal(health.status, 'healthy');
  assert.match(response.headers.get('cache-control') || '', /no-store/i, 'health status may be served stale');
  assert.ok(health.projects >= 20, 'curated project depth is below 20');
  const sitemapAgentCount = sitemapPaths.filter((path) => path.startsWith('/agent/')).length;
  assert.equal(sitemapAgentCount, health.projects, 'sitemap includes agents outside the current curated feed');
  assert.equal(health.checks?.feedFresh, true, 'feed is stale');
  assert.equal(health.checks?.issueCoverage, true, 'Issue scan coverage is below 50%');
  assert.equal(health.checks?.demandEvidence, true, 'demand evidence feed is empty or too shallow');
  assert.equal(health.checks?.evidenceContext, true, 'reporter context coverage is below 75%');
  assert.equal(health.checks?.professionalBreadth, true, 'professional domain coverage has collapsed');
  assert.equal(health.checks?.professionalDemandBreadth, true, 'professional demand evidence coverage has collapsed');
  assert.equal(health.professionalCoverage?.representedDomains, 8, 'not all eight professional domains are represented');
  assert.ok(health.professionalCoverage?.minimumDomainCount >= 2, 'a professional domain has fewer than two projects');
  assert.equal(health.professionalDemandCoverage?.representedDomains, 8, 'not all eight professional domains have demand evidence');
  assert.ok(health.professionalDemandCoverage?.minimumDomainEvidence >= 2, 'a professional domain has fewer than two demand signals');
  if (health.ingestion) assert.equal(health.ingestion.degraded, false, 'latest GitHub refresh was partial');
  console.log(`PASS /health (${health.projects} projects, ${health.evidenceSignals} evidence signals)`);

  const headers = await fetch(`${origin}/`, { method: 'HEAD' });
  assert.match(headers.headers.get('strict-transport-security') || '', /max-age=/i);
  assert.equal(headers.headers.get('x-frame-options'), 'DENY');
  const productionCsp = headers.headers.get('content-security-policy') || '';
  const productionScriptDirective = productionCsp.split(';').map((directive) => directive.trim()).find((directive) => directive.startsWith('script-src ')) || '';
  assert.match(productionCsp, /default-src 'self'/i);
  assert.match(productionCsp, /script-src-attr 'none'/i);
  assert.doesNotMatch(productionScriptDirective, /'unsafe-inline'/i, 'executable inline scripts are allowed by CSP');
  const workspaceHeaders = await fetch(`${origin}/workspace`, { method: 'HEAD' });
  assert.match(workspaceHeaders.headers.get('x-robots-tag') || pageBodies.get('/workspace') || '', /noindex/i);
  console.log('PASS security headers');

  const missing = await fetch(`${origin}/this-page-should-not-exist-radar-check`, { redirect: 'manual' });
  assert.equal(missing.status, 404, `unknown route returned ${missing.status}`);
  const missingHtml = await missing.text();
  assert.match(missingHtml, /SIGNAL LOST/i, 'custom 404 recovery page is missing');
  assert.match(missingHtml, /Discover unmet needs/i, 'custom 404 lacks a demand-discovery path');
  assert.match(missingHtml, /Continue in workspace/i, 'custom 404 lacks an execution path');
  console.log('PASS branded 404 recovery');

  const staleOpportunity = await fetch(`${origin}/opportunity/not-a-valid-id`, { redirect: 'manual' });
  assert.equal(staleOpportunity.status, 404, `stale opportunity returned ${staleOpportunity.status}`);
  assert.match(staleOpportunity.headers.get('x-robots-tag') || '', /noindex/i, 'stale opportunity is indexable');
  const staleOpportunityHtml = await staleOpportunity.text();
  assert.match(staleOpportunityHtml, /AI Agent Radar/i, 'dynamic 404 is not branded');
  assert.match(staleOpportunityHtml, /Continue in workspace/i, 'dynamic 404 lacks an execution recovery path');
  console.log('PASS dynamic 404 recovery');
}

main().catch((error) => {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
});
