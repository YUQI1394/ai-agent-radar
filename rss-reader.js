(() => {
  const list = document.querySelector('#rss-list');
  const count = document.querySelector('#rss-count');
  const status = document.querySelector('#rss-status');
  const filters = [...document.querySelectorAll('[data-rss-filter]')];
  const copyButton = document.querySelector('#rss-copy');
  const copyStatus = document.querySelector('#rss-copy-status');
  const urlInput = document.querySelector('#rss-url');
  const entries = [...list.querySelectorAll('[data-rss-entry]')];
  let activeFilter = 'all';

  const safeLink = (value) => {
    try {
      const url = new URL(value, location.origin);
      return url.origin === location.origin ? `${url.pathname}${url.search}` : '/';
    } catch (_) { return '/'; }
  };

  function render() {
    const visible = activeFilter === 'all' ? entries : entries.filter((entry) => entry.dataset.rssEntry === activeFilter);
    count.textContent = visible.length;
    status.textContent = `${activeFilter === 'all' ? 'current feed entries' : activeFilter === 'agent' ? 'project updates' : 'GitHub-backed demand signals'}`;
    entries.forEach((entry) => { entry.hidden = !visible.includes(entry); });
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

  entries.forEach((entry) => {
    const link = entry.querySelector('a');
    if (link) link.href = safeLink(link.href);
  });
})();
