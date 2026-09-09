(() => {
  'use strict';
  document.addEventListener('click', async (event) => {
    const trigger = event.target.closest('[data-share-url]');
    if (!trigger) return;
    event.preventDefault();
    const url = new URL(trigger.dataset.shareUrl || location.href, location.origin).href;
    const title = trigger.dataset.shareTitle || document.title;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        const original = trigger.textContent;
        trigger.textContent = 'Link copied ✓';
        setTimeout(() => { trigger.textContent = original; }, 1800);
      }
    } catch (error) {
      if (error?.name !== 'AbortError') location.assign(url);
    }
  });
})();
