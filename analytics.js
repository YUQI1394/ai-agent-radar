(() => {
  'use strict';
  if (!/^(?:www\.)?getaiagentradar\.com$/i.test(location.hostname)) return;
  if (document.querySelector('script[data-radar-analytics]')) return;
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  const script = document.createElement('script');
  script.defer = true;
  script.src = '/_vercel/insights/script.js';
  script.dataset.radarAnalytics = '';
  document.head.append(script);
})();
