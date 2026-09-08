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
  assert.ok(workspace.indexOf('/auth.js') < workspace.indexOf('/workspace.js'));
});
