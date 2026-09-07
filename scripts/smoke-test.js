const assert = require('node:assert/strict');

const origin = (process.env.RADAR_ORIGIN || 'https://getaiagentradar.com').replace(/\/$/, '');
const pages = [
  ['/', 'AI Agent Radar'],
  ['/opportunities', 'Opportunity'],
  ['/patterns', 'Pattern'],
  ['/workspace', 'Workspace'],
  ['/methodology', 'Methodology'],
  ['/status', 'Status']
];

async function main() {
  for (const [path, marker] of pages) {
    const response = await fetch(`${origin}${path}`, { redirect: 'follow' });
    assert.equal(response.status, 200, `${path} returned ${response.status}`);
    const html = await response.text();
    assert.match(html, new RegExp(marker, 'i'), `${path} is missing ${marker}`);
    console.log(`PASS ${path}`);
  }

  const response = await fetch(`${origin}/health`, { cache: 'no-store' });
  const health = await response.json();
  assert.equal(response.status, 200, `/health returned ${response.status}`);
  assert.equal(health.status, 'healthy');
  assert.ok(health.projects >= 20, 'curated project depth is below 20');
  assert.equal(health.checks?.feedFresh, true, 'feed is stale');
  console.log(`PASS /health (${health.projects} projects, ${health.evidenceSignals} evidence signals)`);

  const headers = await fetch(`${origin}/`, { method: 'HEAD' });
  assert.match(headers.headers.get('strict-transport-security') || '', /max-age=/i);
  assert.equal(headers.headers.get('x-frame-options'), 'DENY');
  console.log('PASS security headers');
}

main().catch((error) => {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
});
