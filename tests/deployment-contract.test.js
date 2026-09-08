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

test('account-gated pages load authentication before feature scripts', () => {
  const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const workspace = fs.readFileSync(path.join(root, 'workspace.html'), 'utf8');
  assert.ok(home.indexOf('/auth.js') < home.indexOf('/app.js'));
  assert.ok(home.indexOf('/auth.js') < home.indexOf('/cloud-storage.js'));
  assert.ok(home.indexOf('/cloud-storage.js') < home.indexOf('/app.js'));
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

test('homepage presents the full discovery-to-action path with live project evidence', () => {
  const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  assert.match(home, /01 \/ DISCOVER/);
  assert.match(home, /02 \/ UNDERSTAND/);
  assert.match(home, /03 \/ EXECUTE/);
  assert.match(home, /data-radar-node="0"/);
  assert.match(app, /function renderRadarField/);
  assert.match(app, /node\.textContent = `\$\{agent\.name\} · \$\{agent\.radarScore\}`/);
});

test('GitHub discovery includes narrow creative and design workflow searches', () => {
  const ingestion = fs.readFileSync(path.join(root, 'api', 'fetch-agents.js'), 'utf8');
  assert.match(ingestion, /"creative agent" in:name,description,readme/);
  assert.match(ingestion, /"design workflow" agent in:name,description,readme/);
});
