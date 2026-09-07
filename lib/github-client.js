const GITHUB_TIMEOUT_MS = 12000;

function githubHeaders(token = '') {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'getaiagentradar.com', 'X-GitHub-Api-Version': '2022-11-28' };
  const apiToken = token || process.env.GITHUB_TOKEN;
  if (apiToken) headers.Authorization = `Bearer ${apiToken}`;
  return headers;
}

async function githubJson(url, token, label) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GITHUB_TIMEOUT_MS);
    try {
      const response = await fetch(url, { headers: githubHeaders(token), signal: controller.signal });
      if (response.ok) return await response.json();
      const remaining = response.headers.get('x-ratelimit-remaining');
      const reset = response.headers.get('x-ratelimit-reset');
      const error = new Error(`${label} returned ${response.status}${remaining !== null ? ` (rate remaining ${remaining}, reset ${reset || 'unknown'})` : ''}`);
      if (response.status !== 429 && response.status < 500) { error.nonRetryable = true; throw error; }
      lastError = error;
    } catch (error) {
      lastError = error?.name === 'AbortError' ? new Error(`${label} timed out after ${GITHUB_TIMEOUT_MS}ms`) : error;
      if (error?.nonRetryable) throw error;
    } finally { clearTimeout(timeout); }
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw lastError || new Error(`${label} failed`);
}

module.exports = { githubHeaders, githubJson };
