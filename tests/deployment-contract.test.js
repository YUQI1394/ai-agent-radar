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
  const auth = fs.readFileSync(path.join(root, 'auth.js'), 'utf8');
  const login = fs.readFileSync(path.join(root, 'login.js'), 'utf8');
  assert.match(auth, /authCallbackError/);
  assert.match(auth, /error_description/);
  assert.match(auth, /history\.replaceState/);
  assert.match(login, /Sign-in wasn't completed/);
});

test('unknown routes recover into discovery and execution paths', () => {
  const html = fs.readFileSync(path.join(root, '404.html'), 'utf8');
  assert.match(html, /noindex, follow/);
  assert.match(html, /SIGNAL LOST/);
  assert.match(html, /href="\/opportunities"/);
  assert.match(html, /href="\/workspace"/);
  const { sendNotFound } = require('../lib/http-pages');
  const response = { headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.statusCode = code; return this; }, send(body) { this.body = body; return this; } };
  sendNotFound(response, { headline: 'Missing test signal' });
  assert.equal(response.statusCode, 404);
  assert.match(response.headers['X-Robots-Tag'], /noindex/);
  assert.match(response.body, /Missing test signal/);
  for (const file of ['agent.js', 'category.js', 'compare.js', 'opportunity.js', 'weekly.js']) {
    assert.match(fs.readFileSync(path.join(root, 'api', file), 'utf8'), /sendNotFound/);
  }
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
  assert.doesNotMatch(sitemap, /agents:archive/);
  assert.match(sitemap, /Array\.isArray\(payload\?\.agents\)/);
  assert.match(sitemap, /agent\.lastSeenAt \|\| agent\.pushedAt \|\| agent\.updatedAt/);
  const agent = fs.readFileSync(path.join(root, 'api', 'agent.js'), 'utf8');
  assert.match(agent, /agent\.status === 'archived' \? 'noindex, follow' : 'index, follow'/);
  assert.match(agent, /X-Robots-Tag', 'noindex, follow'/);
});

test('production security headers and third-party authentication integrity stay enforced', () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  const headers = new Map(vercel.headers[0].headers.map((header) => [header.key.toLowerCase(), header.value]));
  const csp = headers.get('content-security-policy');
  const scriptDirective = csp.split(';').map((directive) => directive.trim()).find((directive) => directive.startsWith('script-src '));
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /connect-src[^;]+supabase\.co/);
  assert.match(csp, /script-src-attr 'none'/);
  assert.doesNotMatch(scriptDirective, /'unsafe-inline'/);
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
  assert.match(weekly, /evidenceEngagement/);
  assert.doesNotMatch(weekly, /supported by ads/);
  assert.match(weekly, /\/opportunity\/\$\{encodeURIComponent\(issue\.id\)\}/);
});

test('homepage presents the full discovery-to-action path with live project evidence', () => {
  const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  assert.match(home, /<title>Open-Source AI Agents &amp; GitHub Demand · AI Agent Radar<\/title>/);
  assert.match(home, /rel="canonical" href="https:\/\/getaiagentradar\.com\/"/);
  assert.match(home, /01 \/ DISCOVER/);
  assert.match(home, /02 \/ UNDERSTAND/);
  assert.match(home, /03 \/ EXECUTE/);
  assert.match(home, /data-radar-node="0"/);
  assert.match(home, /Qualified unmet needs/);
  assert.match(app, /function renderRadarField/);
  assert.match(app, /qualified needs/);
  assert.match(app, /strongest\.issue\.title/);
  assert.match(app, /agent\.evidenceIssues/);
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
  assert.match(listing, /html\.replace\('<meta name="robots" content="index, follow">', '<meta name="robots" content="noindex, follow">'\)/);
  assert.match(ingestion, /excerpt: issueExcerpt\(issue\.body\)/);
  assert.match(detail, /Start free validation sprint/);
  assert.match(detail, /Reporter context/);
  assert.match(detail, /href="#validation-start"/);
  assert.match(validation, /gate\.id = 'validation-start'/);
  assert.match(validation, /workspace\.id = 'validation-start'/);
  assert.match(validation, /location\.pathname}#validation-start/);
  assert.match(validation, /FREE 7-DAY VALIDATION SPRINT/);
  assert.match(validation, /Build, Narrow or Stop/);
  assert.match(detail, /data-next-action=/);
  assert.match(detail, /Share this brief/);
  assert.match(detail, /\/share\.js/);
  assert.match(validation, /Make this my next action/);
  assert.match(validation, /startedFromBrief/);
  assert.match(validation, /Sprint started · first action scheduled/);
  assert.match(validation, /setDate\(target\.getDate\(\) \+ 7\)/);
  assert.match(validation, /Added to execution queue/);
  assert.match(validation, /User interviews/);
  assert.match(validation, /Behavioral commitments/);
  assert.match(validation, /Next proof target/);
  assert.match(validation, /Build signal/);
  assert.match(validation, /No behavioral proof yet/);
  const workspace = fs.readFileSync(path.join(root, 'workspace.js'), 'utf8');
  assert.match(workspace, /interviews ·/);
  assert.match(workspace, /commitments/);
  assert.match(listing, /evidenceEngagement/);
});

test('archived opportunity signals are preserved but not indexed or promoted as current', () => {
  const detail = fs.readFileSync(path.join(root, 'api', 'opportunity.js'), 'utf8');
  assert.match(detail, /currentAgentIds/);
  assert.match(detail, /historicalSignal/);
  assert.match(detail, /Historical signal · no longer in the current curated feed/);
  assert.match(detail, /X-Robots-Tag', 'noindex, follow'/);
  assert.match(detail, /Browse current opportunities/);
});

test('registration explains the concrete free outcome before asking users to sign in', () => {
  const login = fs.readFileSync(path.join(root, 'login.js'), 'utf8');
  const workspace = fs.readFileSync(path.join(root, 'workspace.js'), 'utf8');
  assert.match(login, /FREE 7-DAY VALIDATION WORKSPACE/);
  assert.match(login, /Build, Narrow or Stop decision/);
  assert.match(login, /A concrete first action/);
  assert.match(login, /A decision brief you can use/);
  assert.match(login, /WHAT YOU LEAVE WITH/);
  assert.match(login, /Example outcome/);
  assert.match(login, /BUILD A NARROW PILOT/);
  assert.match(workspace, /Stop weak ideas before they consume weeks of work/);
  assert.match(workspace, /Export decision brief/);
  assert.match(workspace, /decisionBrief\(item\)/);
  assert.match(workspace, /text\/markdown/);
});

test('an empty registered workspace recommends live opportunities by professional field', () => {
  const workspace = fs.readFileSync(path.join(root, 'workspace.js'), 'utf8');
  assert.match(workspace, /fetch\('\/api\/get-agents'\)/);
  assert.match(workspace, /Recommended from live evidence/);
  assert.match(workspace, /data-starter-domain/);
  assert.match(workspace, /Start this 7-day sprint/);
  assert.match(workspace, /#validation-start/);
  assert.match(workspace, /ai-agent-radar:preferred-domain/);
  assert.match(workspace, /const seenDomains = new Set/);
  assert.match(workspace, /Math\.log2\(item\.comments \+ 1\)/);
  assert.match(workspace, /ageDays <= 30/);
  assert.match(workspace, /Build, Narrow or Stop/);
});

test('privacy-preserving page analytics covers discovery and conversion routes', () => {
  const analytics = fs.readFileSync(path.join(root, 'analytics.js'), 'utf8');
  const auth = fs.readFileSync(path.join(root, 'auth.js'), 'utf8');
  const privacy = fs.readFileSync(path.join(root, 'privacy-policy.html'), 'utf8');
  assert.match(analytics, /getaiagentradar\\\.com/);
  assert.match(analytics, /\/_vercel\/insights\/script\.js/);
  assert.doesNotMatch(analytics, /email|notes|localStorage|user_workspace/);
  assert.match(auth, /script\[src="\/analytics\.js"\]/);
  assert.match(privacy, /does not use cookies/);
  assert.match(privacy, /does not receive account email addresses/);
  for (const file of ['agent.js', 'category.js', 'weekly.js', 'opportunities.js', 'opportunity.js', 'patterns.js', 'compare.js']) {
    const source = fs.readFileSync(path.join(root, 'api', file), 'utf8');
    assert.match(source, /\/analytics\.js/, `${file} must load page analytics`);
  }
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
  assert.match(workspace, /Choose a real need in a field you understand/);
  assert.match(workspace, /Do one concrete action/);
  assert.match(workspace, /Leave with a decision/);
  const workspaceHtml = fs.readFileSync(path.join(root, 'workspace.html'), 'utf8');
  assert.match(workspaceHtml, /secure account sync and an offline copy/);
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

test('all sitemap-backed dynamic pages support link-checking HEAD requests', () => {
  for (const file of ['agent.js', 'category.js', 'opportunities.js', 'opportunity.js', 'patterns.js', 'weekly.js', 'sitemap.js', 'feed.js']) {
    const source = fs.readFileSync(path.join(root, 'api', file), 'utf8');
    assert.match(source, /['"]HEAD['"]/, `${file} does not allow HEAD`);
  }
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
  assert.match(category, /LIVE GITHUB DEMAND/);
  assert.match(category, /cleanIssueEvidence/);
  assert.match(category, /opportunityPattern/);
  assert.match(category, /#demand/);
  assert.match(category, /Start guided sprint/);
  assert.match(category, /opportunities\?domain=/);
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
  const smoke = fs.readFileSync(path.join(root, 'scripts', 'smoke-test.js'), 'utf8');
  assert.match(health, /issueCoverage: issueCoverageRatio >= 0\.5/);
  assert.match(health, /demandEvidence: evidenceSignals >= 30/);
  assert.match(health, /evidenceContext: contextRatio >= 0\.75/);
  assert.match(health, /representedDomains === TARGET_DOMAINS\.length/);
  assert.match(health, /minimumDomainCount >= 2/);
  assert.match(health, /professionalDemandBreadth/);
  assert.match(health, /minimumDomainEvidence >= 2/);
  assert.match(smoke, /representedDomains, 8/);
  assert.match(smoke, /minimumDomainCount >= 2/);
  assert.match(smoke, /minimumDomainEvidence >= 2/);
  assert.match(smoke, /sitemapAgentCount/);
  assert.match(workflow, /professionalDemandBreadth/);
  assert.match(health, /evidenceContext: \{ available: contextSignals/);
  assert.match(workflow, /Verify production data health/);
  assert.match(workflow, /for attempt in \{1\.\.12\}/);
  assert.match(workflow, /\.checks\.issueCoverage/);
  assert.match(workflow, /\.checks\.demandEvidence/);
});

test('health counts the same cleaned evidence users can actually see', () => {
  const health = fs.readFileSync(path.join(root, 'api', 'health.js'), 'utf8');
  assert.match(health, /cleanIssueEvidence/);
  assert.match(health, /const evidenceFor/);
  assert.doesNotMatch(health, /sum \+ \(Array\.isArray\(agent\.evidenceIssues\) \? agent\.evidenceIssues\.length/);
});

test('every public project and opportunity reader reapplies the current evidence rules', () => {
  const feed = fs.readFileSync(path.join(root, 'api', 'get-agents.js'), 'utf8');
  const agent = fs.readFileSync(path.join(root, 'api', 'agent.js'), 'utf8');
  const opportunity = fs.readFileSync(path.join(root, 'api', 'opportunity.js'), 'utf8');
  assert.match(feed, /cleanIssueEvidence\(agent\.evidenceIssues \|\| \[\]\)/);
  assert.match(feed, /painSignals: evidenceIssues\.length/);
  assert.match(agent, /cleanIssueEvidence\(agent\.evidenceIssues \|\| \[\]\)\.map/);
  assert.match(opportunity, /cleanIssueEvidence\(agent\.evidenceIssues \|\| \[\]\)\.find/);
});

test('push refreshes wait for the matching production deployment', () => {
  const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'refresh-agents.yml'), 'utf8');
  const health = fs.readFileSync(path.join(root, 'api', 'health.js'), 'utf8');
  const ingestion = fs.readFileSync(path.join(root, 'api', 'fetch-agents.js'), 'utf8');
  const smokeWorkflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'production-smoke.yml'), 'utf8');
  assert.match(health, /VERCEL_GIT_COMMIT_SHA/);
  assert.match(health, /deployment-ready/);
  assert.match(health, /refreshDeployment: payload\?\.ingestion\?\.deploymentCommit === deploymentCommit/);
  assert.match(ingestion, /x-expected-commit/);
  assert.match(workflow, /EXPECTED_COMMIT: \$\{\{ github\.sha \}\}/);
  assert.match(workflow, /X-Expected-Commit/);
  assert.match(workflow, /\.ingestion\.deploymentCommit == \$commit/);
  assert.match(workflow, /stale function; retrying/);
  assert.match(workflow, /checks\.refreshDeployment/);
  assert.match(workflow, /deploymentCommit/);
  assert.match(workflow, /health\?deployment=1/);
  assert.match(smokeWorkflow, /health\?deployment=1/);
  assert.doesNotMatch(workflow, /push:\s*\n\s+branches: \[main\]\s*\n\s+paths:/);
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
  assert.match(smoke, /sitemap HEAD coverage/);
  assert.match(smoke, /method: 'HEAD'/);
  assert.match(smoke, /auth\.configured/);
  assert.match(smoke, /auth\/v1\/settings/);
  assert.match(smoke, /disable_signup/);
  assert.match(smoke, /anonymous visitors can reach the private workspace table/);
  assert.match(smoke, /privacy-preserving conversion analytics/);
  assert.match(smoke, /_vercel\/insights\/script\.js/);
  assert.match(smoke, /content-security-policy/);
  assert.match(smoke, /healthAttempt <= 12/);
  assert.match(smoke, /branded 404 recovery/);
  assert.match(smoke, /dynamic 404 recovery/);
  for (const slug of ['research', 'security', 'finance', 'coding', 'marketing', 'design', 'productivity', 'infrastructure']) {
    assert.match(smoke, new RegExp(`/category/${slug}`));
  }
  assert.match(smoke, /LIVE GITHUB DEMAND/);
  assert.match(smoke, /fewer than two qualified demand signals/);
});

test('pattern intelligence uses qualified evidence and leads to an executable test', () => {
  const patterns = fs.readFileSync(path.join(root, 'api', 'patterns.js'), 'utf8');
  assert.match(patterns, /cleanIssueEvidence\(agent\.evidenceIssues/);
  assert.match(patterns, /coachingPlan\(lead\.issue\)/);
  assert.match(patterns, /RECOMMENDED FIRST TEST/);
  assert.match(patterns, /#validation-start/);
  assert.match(patterns, /opportunities\?pattern=/);
  assert.match(patterns, /opportunityPattern/);
  assert.match(patterns, /Specific problems/);
  assert.match(patterns, /evidenceEngagement/);
  assert.match(patterns, /agent\.status === 'archived'/);
  const detail = fs.readFileSync(path.join(root, 'api', 'opportunity.js'), 'utf8');
  assert.match(detail, /coach\.pattern\.name/);
  const opportunities = fs.readFileSync(path.join(root, 'api', 'opportunities.js'), 'utf8');
  assert.match(opportunities, /agent\.status === 'archived'/);
  assert.match(opportunities, /current curated feed/);
  assert.match(opportunities, /activePattern/);
  assert.match(opportunities, /item\.pattern === activePattern/);
  assert.match(opportunities, /Specific problem:/);
  const methodology = fs.readFileSync(path.join(root, 'methodology.html'), 'utf8');
  assert.match(methodology, /capped, logarithmic weighting/);
  assert.match(methodology, /old, abandoned thread/);
  assert.match(methodology, /Independent repository repetition carries more weight/);
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
  assert.match(ingestion, /"pentest agent" in:name,description,readme/);
  assert.match(ingestion, /"social media agent" in:name,description,readme/);
  assert.match(ingestion, /"sales agent" in:name,description,readme/);
  assert.match(ingestion, /"investment agent" in:name,description,readme/);
  assert.match(ingestion, /"agentic video production" in:name,description,readme/);
  assert.match(ingestion, /"personal AI assistant" agent in:name,description,readme/);
  assert.match(ingestion, /"AI penetration testing" in:name,description,readme/);
});

test('GitHub discovery broadens thin professional domains without burst concurrency', () => {
  const ingestion = fs.readFileSync(path.join(root, 'api', 'fetch-agents.js'), 'utf8');
  for (const query of ['SOC analyst agent', 'accounting agent', 'SEO agent', 'content marketing agent', 'UI UX agent', 'meeting agent', 'literature review agent']) {
    assert.match(ingestion, new RegExp(query), `missing focused discovery query: ${query}`);
  }
  assert.match(ingestion, /allSettledLimited\(searches/);
  assert.match(ingestion, /concurrency = 6/);
  const radar = fs.readFileSync(path.join(root, 'lib', 'radar.js'), 'utf8');
  assert.match(radar, /minimumPerDomain = 3/);
  const selection = fs.readFileSync(path.join(root, 'lib', 'ingestion-selection.js'), 'utf8');
  assert.match(selection, /categoryBalanced/);
  assert.match(ingestion, /authorAssociation: String\(issue\.author_association/);
  assert.match(ingestion, /issue\.reactions >= 3/);
  assert.match(selection, /evidenceByCategory/);
  assert.match(selection, /recoveryNames/);
});
