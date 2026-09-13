(() => {
  'use strict';

  if (!document.querySelector('script[src="/analytics.js"]')) {
    const analytics = document.createElement('script');
    analytics.src = '/analytics.js';
    document.head.append(analytics);
  }

  const PENDING_NEXT_KEY = 'ai-agent-radar:pending-auth-next';
  const PENDING_NEXT_TTL = 60 * 60 * 1000;

  const normalizeNext = (value) => {
    try {
      const url = new URL(value || '/', location.origin);
      const path = `${url.pathname}${url.search}${url.hash}`.slice(0, 1000);
      return url.origin === location.origin && !url.pathname.startsWith('/login') ? path : '/workspace';
    } catch { return '/'; }
  };
  const rememberPendingNext = (value) => {
    const pending = { path: normalizeNext(value), createdAt: Date.now() };
    const serialized = JSON.stringify(pending);
    try { sessionStorage.setItem(PENDING_NEXT_KEY, serialized); } catch (_) {}
    try { localStorage.setItem(PENDING_NEXT_KEY, serialized); } catch (_) {}
    return pending.path;
  };
  const readPendingNext = () => {
    for (const storage of [sessionStorage, localStorage]) {
      try {
        const raw = storage.getItem(PENDING_NEXT_KEY) || (storage === sessionStorage ? storage.getItem('ai-agent-radar:auth-next') : '');
        if (!raw) continue;
        let pending;
        try { pending = JSON.parse(raw); } catch (_) { pending = storage === sessionStorage ? { path: raw, createdAt: Date.now() } : null; }
        if (!pending || !Number.isFinite(Number(pending.createdAt)) || Date.now() - Number(pending.createdAt) > PENDING_NEXT_TTL) {
          storage.removeItem(PENDING_NEXT_KEY);
          continue;
        }
        return normalizeNext(pending.path);
      } catch (_) { /* Continue when storage is unavailable. */ }
    }
    return '';
  };
  const clearPendingNext = () => {
    for (const storage of [sessionStorage, localStorage]) {
      try { storage.removeItem(PENDING_NEXT_KEY); storage.removeItem('ai-agent-radar:auth-next'); } catch (_) {}
    }
  };
  const authCallbackError = () => {
    const params = new URLSearchParams(location.hash.replace(/^#/, ''));
    const code = String(params.get('error_code') || params.get('error') || '').trim();
    const description = String(params.get('error_description') || '').trim();
    if (!code && !description) return '';
    return (description || code.replace(/[_-]+/g, ' ')).slice(0, 300);
  };
  const api = {
    client: null, user: null, configured: false, providers: ['email'], error: '', callbackError: '',
    next(value) { return normalizeNext(value); },
    rememberNext(value) { return rememberPendingNext(value); },
    pendingNext() { return readPendingNext(); },
    clearPendingNext() { clearPendingNext(); },
    storagePrefix(kind) { return `ai-agent-radar:${kind}:${this.user?.id || 'guest'}:`; },
    savedKey() { return `ai-agent-radar-saved:${this.user?.id || 'guest'}`; },
    async signIn(provider, next = '/') {
      if (!this.client) throw new Error('Registration is not configured yet.');
      this.rememberNext(next);
      const { error } = await this.client.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${location.origin}/login` }
      });
      if (error) throw error;
    },
    async sendMagicLink(email, next = '/') {
      if (!this.client) throw new Error('Registration is not configured yet.');
      this.rememberNext(next);
      const { error } = await this.client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${location.origin}/login` }
      });
      if (error) throw error;
    },
    async signOut() {
      if (this.client) await this.client.auth.signOut({ scope: 'local' });
      location.assign('/');
    }
  };

  function migrateLegacyBrowserData() {
    if (!api.user) return;
    try {
      const accountSavedKey = api.savedKey();
      if (!localStorage.getItem(accountSavedKey)) {
        const legacySaved = localStorage.getItem('ai-agent-radar-saved');
        if (legacySaved) localStorage.setItem(accountSavedKey, legacySaved);
      }
      const accountPrefix = api.storagePrefix('validation');
      const legacyPrefix = 'ai-agent-radar:validation:';
      const legacyKeys = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key?.startsWith(legacyPrefix) && /^\d+$/.test(key.slice(legacyPrefix.length))) legacyKeys.push(key);
      }
      legacyKeys.forEach((legacyKey) => {
        const accountKey = `${accountPrefix}${legacyKey.slice(legacyPrefix.length)}`;
        if (!localStorage.getItem(accountKey)) localStorage.setItem(accountKey, localStorage.getItem(legacyKey));
      });
    } catch (_) { /* Storage may be unavailable in privacy-restricted browsers. */ }
  }

  function updateNavigation() {
    document.querySelectorAll('.site-nav').forEach((nav) => {
      let link = nav.querySelector('[data-auth-link]');
      if (!link) {
        link = document.createElement('a');
        link.dataset.authLink = '';
        nav.append(link);
      }
      link.href = api.user ? '/account' : `/login?next=${encodeURIComponent(location.pathname + location.search)}`;
      link.textContent = api.user ? 'Account' : 'Sign in';
    });
  }

  api.ready = (async () => {
    try {
      const response = await fetch('/auth-config.json', { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Auth configuration request failed (${response.status})`);
      const config = await response.json();
      api.configured = Boolean(config.configured);
      api.providers = Array.isArray(config.providers) ? config.providers.map(String) : ['email'];
      if (!api.configured) return api;
      if (!window.supabase?.createClient) throw new Error('The secure sign-in library did not load.');
      api.client = window.supabase.createClient(config.url, config.publishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      const { data, error } = await api.client.auth.getUser();
      if (error && !/session/i.test(error.message || '')) throw error;
      api.user = data?.user || null;
      if (!api.user) {
        api.callbackError = authCallbackError();
        if (api.callbackError) history.replaceState(null, '', `${location.pathname}${location.search}`);
      }
      migrateLegacyBrowserData();
      api.client.auth.onAuthStateChange((event, session) => {
        api.user = session?.user || null;
        if (api.user) migrateLegacyBrowserData();
        updateNavigation();
        document.dispatchEvent(new CustomEvent('radar:auth', { detail: { event, user: api.user } }));
      });
    } catch (error) { api.error = error.message || 'Authentication is temporarily unavailable.'; }
    finally {
      updateNavigation();
      document.dispatchEvent(new CustomEvent('radar:auth-ready'));
    }
    return api;
  })();
  window.RadarAuth = api;
})();
