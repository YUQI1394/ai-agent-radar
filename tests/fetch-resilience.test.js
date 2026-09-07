const test = require('node:test');
const assert = require('node:assert/strict');
const { githubJson } = require('../lib/github-client');

function response(status, body = {}) {
  return { ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => body };
}

test('GitHub requests retry one transient server failure', async () => {
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => (++calls === 1 ? response(503) : response(200, { items: [1] }));
  try {
    assert.deepEqual(await githubJson('https://api.github.test', '', 'test request'), { items: [1] });
    assert.equal(calls, 2);
  } finally { global.fetch = originalFetch; }
});

test('GitHub requests do not retry deterministic client errors', async () => {
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => { calls += 1; return response(404); };
  try {
    await assert.rejects(githubJson('https://api.github.test', '', 'test request'), /returned 404/);
    assert.equal(calls, 1);
  } finally { global.fetch = originalFetch; }
});
