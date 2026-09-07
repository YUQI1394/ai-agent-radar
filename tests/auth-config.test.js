const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/auth-config');

function response() {
  return { headers: {}, statusCode: 0, body: null, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test('auth configuration never reports ready with missing values', () => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_PUBLISHABLE_KEY;
  const res = response();
  handler({}, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { configured: false, url: '', publishableKey: '' });
  if (previousUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previousUrl;
  if (previousKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = previousKey;
});

test('auth configuration exposes only browser-safe connection values', () => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
  const res = response();
  handler({}, res);
  assert.equal(res.body.configured, true);
  assert.equal(res.body.publishableKey, 'sb_publishable_test');
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_PUBLISHABLE_KEY;
});
