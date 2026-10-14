/* =============================================================
   PelotonHub Admin — admin-common.js  (Firebase edition)
   Loaded as type="module" on every admin page except login.html.
   - Exposes the Firebase API helpers as window.FB so the page's
     classic inline scripts (and inline onclick handlers) can use them.
   - Guards the page: signed-out users and non-admins go to login.html.
   - Fills the sidebar name/initials and wires the logout button.
   - Fires `admin-ready` on document as soon as someone is signed in,
     so the page loads its data while the admin check runs alongside it
     (each Firebase round trip costs about a second; doing them one after
     another made pages slow). The security rules refuse data to
     non-admins, and they are redirected once the check comes back.
   ============================================================= */

import * as api from '../../js/firebase.js';

window.FB = api;

const user = await new Promise(resolve => {
  const unsub = api.onAuthStateChanged(api.auth, u => { unsub(); resolve(u); });
});

if (!user) {
  location.replace('login.html');
} else {
  document.getElementById('admin-logout-btn')?.addEventListener('click', async () => {
    await api.apiAdminLogout();
    location.href = 'login.html';
  });

  const adminCheck = api.apiAdminMe();          // runs at the same time as the page's data load
  document.dispatchEvent(new Event('admin-ready'));

  const { admin } = await adminCheck;
  if (!admin) {
    location.replace('login.html');
  } else {
    const nameEl     = document.getElementById('admin-name');
    const initialsEl = document.getElementById('admin-initials');
    if (nameEl)     nameEl.textContent     = admin.name || 'Shop Admin';
    if (initialsEl) initialsEl.textContent = admin.initials || 'SA';
    window.ADMIN = admin;
  }
}
