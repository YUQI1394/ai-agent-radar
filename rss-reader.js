(() => {
  const list = document.querySelector('#rss-list');
  const count = document.querySelector('#rss-count');
  const status = document.querySelector('#rss-status');
  const filters = [...document.querySelectorAll('[data-rss-filter]')];
  const copyButton = document.querySelector('#rss-copy');
  const copyStatus = document.querySelector('#rss-copy-status');
  const urlInput = document.querySelector('#rss-url');
  let entries = [];
  let activeFilter = 'all';

  const safeLink = (value) => {
    try {
      const url = new URL(value, location.origin);
      return url.origin === location.origin ? `${url.pathname}${url.search}` : '/';
    } catch (_) { return '/'; }
  };

  function render() {
    const visible = activeFilter === 'all' ? entries : entries.filter((entry) => entry.type === activeFilter);
    count.textContent = visible.length;
    status.textContent = `${activeFilter === 'all' ? 'current feed entries' : activeFilter === 'agent' ? 'project updates' : 'GitHub-backed demand signals'}`;
    list.replaceChildren(...visible.map((entry) => {
      const article = document.createElement('article');
      article.className = `rss-card rss-${entry.type}`;
      const meta = document.createElement('div');
      const badge = document.createElement('span');
      badge.textContent = entry.type === 'agent' ? 'PROJECT' : 'DEMAND SIGNAL';
      const time = document.createElement('time');
      time.dateTime = entry.isoDate;
      time.textContent = entry.dateLabel;
      meta.append(badge, time);
      const heading = document.createElement('h2');
      const link = document.createElement('a');
      link.href = safeLink(entry.link);
      link.textContent = entry.title;
      heading.append(link);
      const description = document.createElement('p');
      description.textContent = entry.description;
      article.append(meta, heading, description);
      return article;
    }));
    if (!visible.length) list.innerHTML = '<div class="workspace-empty"><h2>No entries in this view</h2><p>The feed will update after the next qualified GitHub signal is published.</p></div>';
  }

  filters.forEach((button) => button.addEventListener('click', () => {
    activeFilter = button.dataset.rssFilter;
    filters.forEach((item) => item.classList.toggle('active', item === button));
    render();
  }));

  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(urlInput.value);
      copyStatus.textContent = 'Copied. Paste this URL into your RSS app.';
    } catch (_) {
      urlInput.select();
      copyStatus.textContent = 'Select and copy the highlighted address.';
    }
  });

  fetch('/feed.xml', { headers: { Accept: 'application/rss+xml' } }).then(async (response) => {
    if (!response.ok) throw new Error(`Feed returned ${response.status}`);
    const xml = new DOMParser().parseFromString(await response.text(), 'application/xml');
    if (xml.querySelector('parsererror')) throw new Error('The feed XML could not be parsed');
    entries = [...xml.querySelectorAll('channel > item')].map((item) => {
      const rawTitle = item.querySelector('title')?.textContent?.trim() || 'Untitled update';
      const type = rawTitle.startsWith('[Opportunity]') ? 'opportunity' : 'agent';
      const published = new Date(item.querySelector('pubDate')?.textContent || '');
      return {
        type,
        title: rawTitle.replace(/^\[(Agent|Opportunity)\]\s*/, ''),
        link: item.querySelector('link')?.textContent?.trim() || '/',
        description: item.querySelector('description')?.textContent?.trim() || '',
        isoDate: Number.isFinite(published.getTime()) ? published.toISOString() : '',
        dateLabel: Number.isFinite(published.getTime()) ? published.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Date unavailable'
      };
    });
    render();
  }).catch((error) => {
    count.textContent = '0';
    status.textContent = 'feed temporarily unavailable';
    list.innerHTML = `<div class="workspace-empty"><h2>Unable to load the visual feed</h2><p>${String(error.message || 'Please try again shortly.')}</p><a class="button button-primary" href="/feed.xml">Open RSS XML</a></div>`;
  });
})();
