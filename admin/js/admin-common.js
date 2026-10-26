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

/**
 * Confirmation dialog in the console's own modal style (used instead of the
 * browser's confirm() for deletes). Resolves true when the admin confirms.
 * adminConfirm({ title, message, confirmText, danger })
 */
window.adminConfirm = function ({ title = 'Are you sure?', message = '', confirmText = 'Confirm', danger = true } = {}) {
  let box = document.getElementById('admin-confirm-modal');
  if (!box) {
    box = document.createElement('div');
    box.className = 'modal-overlay';
    box.id = 'admin-confirm-modal';
    box.setAttribute('role', 'alertdialog');
    box.setAttribute('aria-modal', 'true');
    box.innerHTML = `
      <div class="modal-box" style="max-width:440px;">
        <div class="admin-modal-body">
          <h2 id="ac-title" style="margin-bottom:0.7rem;"></h2>
          <p id="ac-message" style="font-size:0.88rem;color:var(--ink-2);line-height:1.6;margin-bottom:1.4rem;"></p>
          <div class="modal-actions">
            <button class="btn-outline btn-sm" type="button" id="ac-cancel">Cancel</button>
            <button class="btn-sm" type="button" id="ac-ok"></button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(box);
  }
  box.querySelector('#ac-title').textContent = title;
  box.querySelector('#ac-message').textContent = message;
  const ok = box.querySelector('#ac-ok');
  ok.textContent = confirmText;
  ok.className = (danger ? 'btn-danger-outline' : 'btn-primary') + ' btn-sm';
  box.classList.add('open');
  ok.focus();
  return new Promise(resolve => {
    const done = val => {
      box.classList.remove('open');
      box.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
      resolve(val);
    };
    const onClick = e => {
      if (e.target === box || e.target.id === 'ac-cancel') done(false);
      else if (e.target.id === 'ac-ok') done(true);
    };
    const onKey = e => { if (e.key === 'Escape') done(false); };
    box.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
  });
};

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
