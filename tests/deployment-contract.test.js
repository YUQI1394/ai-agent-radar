const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('Vercel Hobby deployment stays within the direct-function limit', () => {
  const functions = fs.readdirSync(path.join(root, 'api')).filter((file) => file.endsWith('.js'));
  assert.ok(functions.length <= 12, `Expected at most 12 API functions, found ${functions.length}: ${functions.join(', ')}`);
});

test('registration routes and public auth configuration remain deployable', () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  const rewrites = new Map(vercel.rewrites.map((rule) => [rule.source, rule.destination]));
  assert.equal(rewrites.get('/login'), '/login.html');
  assert.equal(rewrites.get('/account'), '/account.html');
  const config = JSON.parse(fs.readFileSync(path.join(root, 'auth-config.json'), 'utf8'));
  assert.equal(typeof config.configured, 'boolean');
  assert.equal(typeof config.url, 'string');
  assert.equal(typeof config.publishableKey, 'string');
  assert.deepEqual(config.providers, ['email']);
});

test('public feed starts independently while account-gated pages load authentication first', () => {
  const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const workspace = fs.readFileSync(path.join(root, 'workspace.html'), 'utf8');
  assert.ok(home.indexOf('/app.js') < home.indexOf('/auth.js'));
  assert.ok(home.indexOf('/auth.js') < home.indexOf('/cloud-storage.js'));
  assert.ok(workspace.indexOf('/auth.js') < workspace.indexOf('/workspace.js'));
  assert.ok(workspace.indexOf('/cloud-storage.js') < workspace.indexOf('/workspace.js'));
});

test('workspace migration enforces per-user row-level security', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase', 'workspace.sql'), 'utf8');
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /auth\.uid\(\).*user_id/i);
  assert.match(sql, /revoke all.*anon/i);
  assert.match(sql, /primary key \(user_id, record_type, record_key\)/i);
});

test('sitemap applies the same opportunity quality filter as public rankings', () => {
  const sitemap = fs.readFileSync(path.join(root, 'api', 'sitemap.js'), 'utf8');
  assert.match(sitemap, /cleanIssueEvidence\(agent\.evidenceIssues/);
  assert.match(sitemap, /agent\.status !== 'archived'/);
  assert.match(sitemap, /agent\.lastSeenAt \|\| agent\.pushedAt \|\| agent\.updatedAt/);
});

test('production security headers and third-party authentication integrity stay enforced', () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  const headers = new Map(vercel.headers[0].headers.map((header) => [header.key.toLowerCase(), header.value]));
  assert.match(headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.match(headers.get('content-security-policy'), /connect-src[^;]+supabase\.co/);
  for (const file of ['index.html', 'login.html', 'workspace.html', 'account.html']) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(html, /supabase\.min\.js" integrity="sha384-[A-Za-z0-9+/=]+" crossorigin="anonymous"/);
  }
});

test('RSS publishes filtered projects and opportunity signals', () => {
  const feed = fs.readFileSync(path.join(root, 'api', 'feed.js'), 'utf8');
  assert.match(feed, /cleanIssueEvidence\(agent\.evidenceIssues/);
  assert.match(feed, /\[Opportunity\]/);
  assert.match(feed, /\.slice\(0, 50\)/);
  assert.doesNotMatch(feed, /agent\.createdAt \|\| payload\.updatedAt/);
});

test('weekly reports connect repository rankings to traceable demand evidence', () => {
  const weekly = fs.readFileSync(path.join(root, 'api', 'weekly.js'), 'utf8');
  assert.match(weekly, /cleanIssueEvidence/);
  assert.match(weekly, /DEMAND INTELLIGENCE/);
  assert.match(weekly, /not proof of willingness to pay/);
  assert.match(weekly, /\/opportunity\/\$\{encodeURIComponent\(issue\.id\)\}/);
});

test('homepage presents the full discovery-to-action path with live project evidence', () => {
  const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  assert.match(home, /01 \/ DISCOVER/);
  assert.match(home, /02 \/ UNDERSTAND/);
  assert.match(home, /03 \/ EXECUTE/);
  assert.match(home, /data-radar-node="0"/);
  assert.match(app, /function renderRadarField/);
  assert.match(app, /node\.textContent = `\$\{agent\.name\} · \$\{agent\.radarScore\}`/);
  assert.match(app, /data-share-url/);
  const share = fs.readFileSync(path.join(root, 'share.js'), 'utf8');
  assert.match(share, /navigator\.share/);
  assert.match(share, /navigator\.clipboard\.writeText/);
  assert.ok(home.indexOf('/app.js') < home.indexOf('@supabase/supabase-js'), 'public feed must start before the optional auth library');
  assert.match(app, /loadAgents\(\);[\s\S]*radar:auth-ready/);
  const auth = fs.readFileSync(path.join(root, 'auth.js'), 'utf8');
  assert.match(auth, /radar:auth-ready/);
});

test('opportunities lead directly into the free guided execution sprint', () => {
  const listing = fs.readFileSync(path.join(root, 'api', 'opportunities.js'), 'utf8');
  const detail = fs.readFileSync(path.join(root, 'api', 'opportunity.js'), 'utf8');
  const ingestion = fs.readFileSync(path.join(root, 'api', 'fetch-agents.js'), 'utf8');
  const validation = fs.readFileSync(path.join(root, 'validation.js'), 'utf8');
  assert.match(listing, /Start guided sprint/);
  assert.match(listing, /What the reporter described/);
  assert.match(listing, /Search demand evidence/);
  assert.match(listing, /queryTerms\.every/);
  assert.match(listing, /Filter opportunities by professional field/);
  assert.match(listing, /activeDomain/);
  assert.match(listing, /filterHref/);
  assert.match(listing, /X-Robots-Tag', 'noindex, follow/);
  assert.match(ingestion, /excerpt: issueExcerpt\(issue\.body\)/);
  assert.match(detail, /Start free validation sprint/);
  assert.match(detail, /Reporter context/);
  assert.match(detail, /href="#validation-start"/);
  assert.match(validation, /gate\.id = 'validation-start'/);
  assert.match(validation, /workspace\.id = 'validation-start'/);
  assert.match(validation, /location\.pathname}#validation-start/);
  assert.match(detail, /data-next-action=/);
  assert.match(detail, /Share this brief/);
  assert.match(detail, /\/share\.js/);
  assert.match(validation, /Make this my next action/);
  assert.match(validation, /Added to execution queue/);
  assert.match(validation, /User interviews/);
  assert.match(validation, /Behavioral commitments/);
  assert.match(validation, /Next proof target/);
  assert.match(validation, /Build signal/);
  assert.match(validation, /No behavioral proof yet/);
  const workspace = fs.readFileSync(path.join(root, 'workspace.js'), 'utf8');
  assert.match(workspace, /interviews ·/);
  assert.match(workspace, /commitments/);
});

test('workspace sync protects newer offline edits from stale cloud copies', () => {
  const cloud = fs.readFileSync(path.join(root, 'cloud-storage.js'), 'utf8');
  const validation = fs.readFileSync(path.join(root, 'validation.js'), 'utf8');
  const workspace = fs.readFileSync(path.join(root, 'workspace.js'), 'utf8');
  assert.match(cloud, /delete storedValue\.pendingSync/);
  assert.match(cloud, /select\('updated_at'\)\.single\(\)/);
  assert.match(validation, /state\.pendingSync = true/);
  assert.match(validation, /state\.updatedAt === version/);
  assert.match(workspace, /if \(local\?\.pendingSync\)/);
  assert.match(workspace, /if \(item\.deleted\)/);
  assert.match(cloud, /data: \{ deleted: true \}/);
  assert.doesNotMatch(workspace, /Promise\.allSettled\(records\(\)\.map/);
  assert.match(workspace, /DO THIS NEXT/);
  assert.match(workspace, /orderedItems/);
  assert.match(workspace, /Continue this action/);
});

test('opportunity pages expose stable search and social metadata', () => {
  const listing = fs.readFileSync(path.join(root, 'api', 'opportunities.js'), 'utf8');
  const detail = fs.readFileSync(path.join(root, 'api', 'opportunity.js'), 'utf8');
  assert.match(listing, /'@type': 'ItemList'/);
  assert.match(listing, /itemListElement: opportunities\.slice\(0, 25\)/);
  assert.match(listing, /twitter:card/);
  assert.match(detail, /'@type': 'BreadcrumbList'/);
  assert.match(detail, /mainEntityOfPage: canonical/);
  assert.match(detail, /twitter:card/);
});

test('all professional fields have discoverable structured reports', () => {
  const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const category = fs.readFileSync(path.join(root, 'api', 'category.js'), 'utf8');
  for (const slug of ['research', 'security', 'finance', 'coding', 'marketing', 'design', 'productivity', 'infrastructure']) {
    assert.match(home, new RegExp(`/category/${slug}`));
  }
  assert.match(category, /'@type': 'ItemList'/);
  assert.match(category, /'@type': 'BreadcrumbList'/);
  assert.match(category, /twitter:card/);
  assert.match(category, /agents\.length \? 'index, follow' : 'noindex, follow'/);
  const sitemap = fs.readFileSync(path.join(root, 'api', 'sitemap.js'), 'utf8');
  assert.match(sitemap, /agents\.some\(\(agent\) => category\(agent\) === CATEGORY_NAMES\[slug\]\)/);
});

test('refreshes submit current projects, demand and professional pages to IndexNow', () => {
  const ingestion = fs.readFileSync(path.join(root, 'api', 'fetch-agents.js'), 'utf8');
  assert.match(ingestion, /representedCategories/);
  assert.match(ingestion, /opportunityUrls/);
  assert.match(ingestion, /`\$\{SITE_URL\}\/opportunities`/);
  assert.match(ingestion, /`\$\{SITE_URL\}\/patterns`/);
  assert.match(ingestion, /`\$\{SITE_URL\}\/category\/\$\{slug\}`/);
  assert.match(ingestion, /new Set\(\[/);
});

test('scheduled refreshes fail when production demand intelligence is unhealthy', () => {
  const health = fs.readFileSync(path.join(root, 'api', 'health.js'), 'utf8');
  const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'refresh-agents.yml'), 'utf8');
  assert.match(health, /issueCoverage: issueCoverageRatio >= 0\.5/);
  assert.match(health, /demandEvidence: evidenceSignals >= 30/);
  assert.match(health, /evidenceContext: contextRatio >= 0\.75/);
  assert.match(health, /representedDomains >= 6/);
  assert.match(health, /evidenceContext: \{ available: contextSignals/);
  assert.match(workflow, /Verify production data health/);
  assert.match(workflow, /for attempt in \{1\.\.12\}/);
  assert.match(workflow, /\.checks\.issueCoverage/);
  assert.match(workflow, /\.checks\.demandEvidence/);
});

test('push refreshes wait for the matching production deployment', () => {
  const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'refresh-agents.yml'), 'utf8');
  const health = fs.readFileSync(path.join(root, 'api', 'health.js'), 'utf8');
  assert.match(health, /VERCEL_GIT_COMMIT_SHA/);
  assert.match(workflow, /EXPECTED_COMMIT: \$\{\{ github\.sha \}\}/);
  assert.match(workflow, /deploymentCommit/);
  assert.ok(workflow.indexOf('Wait for matching production deployment') < workflow.indexOf('Refresh production feed'));
});

test('production smoke monitoring covers the public conversion journey', () => {
  const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'production-smoke.yml'), 'utf8');
  const smoke = fs.readFileSync(path.join(root, 'scripts', 'smoke-test.js'), 'utf8');
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /actions\/checkout@v7/);
  assert.match(workflow, /Wait for matching production deployment/);
  assert.match(workflow, /node scripts\/smoke-test\.js/);
  assert.match(smoke, /opportunityHref/);
  assert.match(smoke, /Reporter context:/);
  assert.match(smoke, /sitemap\.xml/);
  assert.match(smoke, /auth\.configured/);
  assert.match(smoke, /content-security-policy/);
});

test('pattern intelligence uses qualified evidence and leads to an executable test', () => {
  const patterns = fs.readFileSync(path.join(root, 'api', 'patterns.js'), 'utf8');
  assert.match(patterns, /cleanIssueEvidence\(agent\.evidenceIssues/);
  assert.match(patterns, /coachingPlan\(lead\.issue\)/);
  assert.match(patterns, /RECOMMENDED FIRST TEST/);
  assert.match(patterns, /#validation-start/);
  assert.match(patterns, /opportunityPattern/);
  assert.match(patterns, /Specific problems/);
  assert.match(patterns, /agent\.status === 'archived'/);
  const opportunities = fs.readFileSync(path.join(root, 'api', 'opportunities.js'), 'utf8');
  assert.match(opportunities, /agent\.status === 'archived'/);
  assert.match(opportunities, /current curated feed/);
});

test('the open-source archive excludes projects without a verifiable license', () => {
  const ingestion = fs.readFileSync(path.join(root, 'api', 'fetch-agents.js'), 'utf8');
  const radar = fs.readFileSync(path.join(root, 'lib', 'radar.js'), 'utf8');
  const methodology = fs.readFileSync(path.join(root, 'methodology.html'), 'utf8');
  assert.match(radar, /UNVERIFIED_LICENSES/);
  assert.match(radar, /'NOASSERTION'/);
  assert.match(ingestion, /mergeArchive[\s\S]*\.filter\(qualifiesAsAgent\)/);
  assert.match(methodology, /verifiable SPDX license/);
  assert.match(methodology, /Public source code is not automatically open source/);
});

test('GitHub discovery includes narrow creative and design workflow searches', () => {
  const ingestion = fs.readFileSync(path.join(root, 'api', 'fetch-agents.js'), 'utf8');
  assert.match(ingestion, /"creative agent" in:name,description,readme/);
  assert.match(ingestion, /"creative agents" in:name,description,readme/);
  assert.match(ingestion, /"marketing agents" in:name,description,readme/);
  assert.match(ingestion, /"design workflow" agent in:name,description,readme/);
});
