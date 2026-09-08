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
