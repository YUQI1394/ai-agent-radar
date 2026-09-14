const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
})[character]);

function sendRecovery(res, statusCode, {
  eyebrow,
  headline,
  message,
  primaryHref = '/opportunities',
  primaryLabel = 'Discover current opportunities'
}) {
  const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, follow"><title>${escapeHtml(headline)} · AI Agent Radar</title><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/styles.css"></head><body><header class="site-header"><a class="brand" href="/">AI Agent Radar</a><nav class="site-nav"><a href="/">Home</a><a href="/opportunities">Opportunities</a><a href="/patterns">Patterns</a><a href="/workspace">Workspace</a></nav></header><main class="page-shell report-shell"><section class="report-hero"><span class="eyebrow">${escapeHtml(eyebrow)}</span><h1>${escapeHtml(headline)}</h1><p>${escapeHtml(message)}</p><div class="hero-actions"><a class="button button-primary" href="${escapeHtml(primaryHref)}">${escapeHtml(primaryLabel)}</a><a class="button button-secondary" href="/workspace">Continue in workspace</a><a class="button button-secondary" href="/">Browse projects</a></div></section></main><footer class="site-footer"><p>AI Agent Radar · Free, independent open-source intelligence</p></footer></body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Robots-Tag', 'noindex, follow');
  if (statusCode === 410) res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(statusCode).send(html.replace('</body>', '<script src="/analytics.js"></script></body>'));
}

function sendNotFound(res, options = {}) {
  return sendRecovery(res, 404, {
    eyebrow: '404 · SIGNAL LOST',
    headline: 'This signal is no longer available.',
    message: 'The page may have moved or the underlying public data may have changed.',
    ...options
  });
}

function sendGone(res, options = {}) {
  return sendRecovery(res, 410, {
    eyebrow: '410 · LEGACY SOURCE RETIRED',
    headline: 'This legacy listing has been permanently removed.',
    message: 'AI Agent Radar now uses GitHub-backed open-source evidence instead of Product Hunt listings. Explore the current project and demand intelligence.',
    ...options
  });
}

module.exports = { sendGone, sendNotFound };
