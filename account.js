(async () => {
  'use strict';
  const auth = await window.RadarAuth.ready;
  const state = document.querySelector('#account-state');
  if (!auth.user) { location.replace('/login?next=%2Faccount'); return; }
  state.hidden = true;
  document.querySelector('#account-details').hidden = false;
  document.querySelector('#account-email').textContent = auth.user.email || 'Authenticated user';
  document.querySelector('#sign-out').addEventListener('click', () => auth.signOut());
  const cloud = await window.RadarCloud.ready;
  document.querySelector('#sync-state').textContent = cloud.available ? 'Cloud synchronization is active.' : 'Cloud synchronization is temporarily unavailable; local copies remain available.';
  document.querySelector('#clear-workspace').addEventListener('click', async () => {
    if (!window.confirm('Permanently delete all saved agents, validation notes and progress from this account? This cannot be undone.')) return;
    const button = document.querySelector('#clear-workspace');
    button.disabled = true;
    try {
      if (!cloud.available) throw new Error('Cloud sync is unavailable. Try again later.');
      await cloud.clear();
      Object.keys(localStorage).filter((key) => key.includes(auth.user.id)).forEach((key) => localStorage.removeItem(key));
      document.querySelector('#account-action-status').textContent = 'Your workspace data has been deleted.';
    } catch (error) {
      document.querySelector('#account-action-status').textContent = error.message || 'Could not delete workspace data.';
      button.disabled = false;
    }
  });
})();
