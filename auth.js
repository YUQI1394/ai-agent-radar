(() => {
  'use strict';

  const normalizeNext = (value) => {
    try {
      const url = new URL(value || '/', location.origin);
      return url.origin === location.origin ? `${url.pathname}${url.search}${url.hash}` : '/';
    } catch { return '/'; }
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
    storagePrefix(kind) { return `ai-agent-radar:${kind}:${this.user?.id || 'guest'}:`; },
    savedKey() { return `ai-agent-radar-saved:${this.user?.id || 'guest'}`; },
    async signIn(provider, next = '/') {
      if (!this.client) throw new Error('Registration is not configured yet.');
      sessionStorage.setItem('ai-agent-radar:auth-next', normalizeNext(next));
      const { error } = await this.client.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${location.origin}/login` }
      });
      if (error) throw error;
    },
    async sendMagicLink(email, next = '/') {
      if (!this.client) throw new Error('Registration is not configured yet.');
      sessionStorage.setItem('ai-agent-radar:auth-next', normalizeNext(next));
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
