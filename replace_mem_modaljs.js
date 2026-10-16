const fs=require('fs');
const p='E:/sia/peloton-hub-project-main/membership.html';
let s=fs.readFileSync(p,'utf8');
const start=s.indexOf('<script type="module">\n// Tier cards');
const end=s.indexOf('\n</body>');
const prefix=s.slice(0,start);
const newBlock=`<script type="module">
// Tier cards (live discounts + buttons) are handled by js/main.js
import './js/main.js';
import { apiPaymentCreate } from './js/mongo-payment.js';
import { getUser } from './js/main.js';

const TIER_PRICE = { Chain: 499, Peloton: 999 };

let selectedTier = null;
const modal = document.getElementById('membership-pay-modal');

function showMsg(el, type, text) {
  if (!el) return;
  el.textContent = text;
  el.className = 'form-msg show ' + (type === 'error' ? 'error' : 'success');
}

function openModal(tier) {
  selectedTier = tier;
  document.getElementById('mem-pay-title').textContent = 'Upgrade to ' + tier;
  document.getElementById('mem-pay-sub').textContent = (tier === 'Chain' ? 'Chain is ₱499/month' : 'Peloton is ₱999/month') + ', billed in store for cash upgrades or processed online.';
  modal.hidden = false;
  const cash = document.querySelector('input[name="mem-payment-method"][value="cash"]');
  if (cash) cash.checked = true;
  const fields = document.getElementById('mem-online-fields');
  if (fields) fields.hidden = true;
  const m = document.getElementById('mem-pay-msg');
  if (m) { m.textContent = ''; m.className = 'form-msg'; }
}

function toggleMemFields() {
  const val = document.querySelector('input[name="mem-payment-method"]:checked')?.value;
  const f = document.getElementById('mem-online-fields');
  if (f) f.hidden = (val !== 'online');
}

document.querySelectorAll('input[name="mem-payment-method"]').forEach(r => r.addEventListener('change', toggleMemFields));
document.getElementById('mem-pay-cancel')?.addEventListener('click', () => { modal.hidden = true; selectedTier = null; });

document.getElementById('mem-pay-confirm')?.addEventListener('click', async () => {
  if (!selectedTier) return;
  const btn = document.getElementById('mem-pay-confirm');
  const msg = document.getElementById('mem-pay-msg');
  const method = document.querySelector('input[name="mem-payment-method"]:checked')?.value || 'cash';

  if (method === 'online') {
    const name = (document.getElementById('mem-card-name')?.value || '').trim();
    const number = (document.getElementById('mem-card-number')?.value || '').replace(/\\s/g, '');
    const expiry = (document.getElementById('mem-card-expiry')?.value || '').trim();
    const cvv = (document.getElementById('mem-card-cvv')?.value || '').trim();
    if (!name) { showMsg(msg, 'error', 'Enter cardholder name.'); return; }
    if (!/^\\d{16}$/.test(number)) { showMsg(msg, 'error', 'Enter a valid 16-digit card number.'); return; }
    if (!/^\\d{2}\\/\\d{2}$/.test(expiry)) { showMsg(msg, 'error', 'Enter expiry as MM/YY.'); return; }
    if (!/^\\d{3,4}$/.test(cvv)) { showMsg(msg, 'error', 'Enter a valid CVV.'); return; }
  }

  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = 'Processing...';
  await new Promise(r => setTimeout(r, method === 'online' ? 900 : 200));

  const user = await getUser();
  if (!user) { window.location.href = 'auth.html?tier=' + encodeURIComponent(selectedTier); btn.disabled=false; btn.textContent=original; return; }

  try {
    await apiPaymentCreate({
      orderId: 'MEM-' + user.id + '-' + Date.now(),
      userId: user.id,
      amount: TIER_PRICE[selectedTier],
      method: method === 'online' ? 'online' : 'cash',
      currency: 'PHP',
      status: method === 'online' ? 'paid' : 'pending',
      metadata: { type: 'membership', tier: selectedTier },
    });
    modal.hidden = true;
    alert((method === 'online' ? 'Payment received! ' : 'Upgrade request recorded. ') + selectedTier + ' membership payment ' + (method === 'online' ? 'was successful.' : 'is pending in-store billing.') + ' An admin will activate the tier.');
  } catch (e) {
    showMsg(msg, 'error', e.message || 'Payment failed. Try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
});

// Intercept tier-upgrade clicks for logged-in members
const user = await getUser();
if (user) {
  document.querySelectorAll('.tier-join').forEach(link => {
    const href = link.getAttribute('href') || '';
    const tier = (href.match(/tier=([^&]+)/) || [])[1];
    const decoded = tier ? decodeURIComponent(tier) : '';
    if (!TIER_PRICE[decoded]) return;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      openModal(decoded);
    });
  });
}
</script>
`;
s = prefix + newBlock + s.slice(end);
fs.writeFileSync(p,s);
console.log('done');
`;
fs.writeFileSync('E:/sia/peloton-hub-project-main/replace_mem_modaljs_done.js', 'done');
`;
fs.writeFileSync(p, prefix + newBlock + s.slice(end)); // careful: s may be overwritten? Actually s still original
console.log('written');
