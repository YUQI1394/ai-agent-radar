(() => {
  'use strict';

  const api = {
    available: false,
    error: '',
    async get(kind, key) {
      if (!this.available) return null;
      const { data, error } = await window.RadarAuth.client.from('user_workspace').select('data,updated_at').eq('record_type', kind).eq('record_key', String(key)).maybeSingle();
      if (error) throw error;
      return data ? { ...data.data, cloudUpdatedAt: data.updated_at } : null;
    },
    async list(kind) {
      if (!this.available) return [];
      const { data, error } = await window.RadarAuth.client.from('user_workspace').select('record_key,data,updated_at').eq('record_type', kind).order('updated_at', { ascending: false }).limit(200);
      if (error) throw error;
      return (data || []).map((row) => ({ ...row.data, id: row.data?.id || row.record_key, cloudUpdatedAt: row.updated_at }));
    },
    async set(kind, key, value) {
      if (!this.available) return false;
      const auth = window.RadarAuth;
      const storedValue = { ...value };
      delete storedValue.cloudUpdatedAt;
      delete storedValue.pendingSync;
      const { data, error } = await auth.client.from('user_workspace').upsert({
        user_id: auth.user.id, record_type: kind, record_key: String(key), data: storedValue, updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,record_type,record_key' }).select('updated_at').single();
      if (error) throw error;
      return data?.updated_at || new Date().toISOString();
    },
    async remove(kind, key) {
      if (!this.available) return false;
      const auth = window.RadarAuth;
      const { error } = await auth.client.from('user_workspace').upsert({
        user_id: auth.user.id, record_type: kind, record_key: String(key), data: { deleted: true }, updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,record_type,record_key' });
      if (error) throw error;
      return true;
    },
    async clear() {
      if (!this.available) return false;
      const auth = window.RadarAuth;
      const { error } = await auth.client.from('user_workspace').delete().eq('user_id', auth.user.id);
      if (error) throw error;
      return true;
    }
  };

  api.ready = (async () => {
    const auth = await window.RadarAuth.ready;
    if (!auth.user || !auth.client) return api;
    try {
      const { error } = await auth.client.from('user_workspace').select('record_key').limit(1);
      if (error) throw error;
      api.available = true;
    } catch (error) {
      api.error = error.message || 'Cloud sync is temporarily unavailable.';
    }
    document.dispatchEvent(new CustomEvent('radar:cloud', { detail: { available: api.available, error: api.error } }));
    return api;
  })();
  window.RadarCloud = api;
})();
