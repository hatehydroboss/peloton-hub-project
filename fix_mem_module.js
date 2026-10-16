const fs=require('fs');
const p='E:/sia/peloton-hub-project-main/membership.html';
let s=fs.readFileSync(p,'utf8');
const start=s.indexOf("<script type=\"module\">\n// Tier cards");
const end=s.lastIndexOf("</script>\n</body>");
// replace from start to end (script block)
const newBlock=`<script type="module">
// Tier cards (live discounts + buttons) are handled by js/main.js
import './js/main.js';
import { apiPaymentCreate } from './js/mongo-payment.js';
import { getUser, apiLogout } from './js/main.js';
import { apiMembershipUpgrade } from './js/firebase.js';

const TIER_PRICE = { Chain: 499, Peloton: 999 };

async function upgradeTo(tier) {
  const user = await getUser();
  if (!user) { window.location.href = 'auth.html?tier=' + encodeURIComponent(tier); return; }
  if (tier === user.tier) return;
  if (tier === 'Spoke') {
    const r = await apiMembershipUpgrade({ tier: 'Spoke' });
    if (r.ok) window.location.reload();
    else alert(r.error || 'Could not upgrade');
    return;
  }
  const amount = TIER_PRICE[tier];
  try {
    await apiPaymentCreate({
      orderId: 'MEM-' + user.id + '-' + Date.now(),
      userId: user.id,
      amount,
      method: 'online',
      currency: 'PHP',
      status: 'paid',
      metadata: { type: 'membership', tier },
    });
    const r = await apiMembershipUpgrade({ tier });
    if (r.ok) {
      alert('Upgrade successful! Your ' + tier + ' membership is now active.');
      window.location.href = 'profile.html';
    } else {
      alert(r.error || 'Payment recorded but tier activation failed. Please contact support.');
    }
  } catch (e) {
    alert(e.message || 'Upgrade failed');
  }
}

// Direct-upgrade buttons on tier cards
const user = await getUser();
if (user) {
  document.querySelectorAll('.tier-join').forEach(link => {
    const href = link.getAttribute('href') || '';
    const tier = (href.match(/upgrade=([^&]+)/) || [])[1];
    const decoded = tier ? decodeURIComponent(tier) : '';
    if (!TIER_PRICE[decoded] && decoded !== 'Spoke') return;
    // Replace href-based navigation with direct upgrade
    link.addEventListener('click', (e) => {
      // Only intercept paid tier upgrades, not registration links
      if (!TIER_PRICE[decoded] && decoded !== 'Spoke') return;
      e.preventDefault();
      upgradeTo(decoded || 'Spoke');
    });
  });
}

// Allow direct upgrade via ?upgrade=Chain|Peloton
const params = new URLSearchParams(window.location.search);
const wanted = params.get('upgrade');
if (wanted) upgradeTo(wanted);
</script>
`;
// remove old script block
s = s.slice(0, start) + newBlock + '</body>\n</html>';
// Actually need preserve footer; our slice removed footer and everything after start. Reconstruct instead:
// Re-read original to keep footer.
s = fs.readFileSync(p,'utf8');
const footerIndex = s.indexOf('<footer>');
const beforeFooter = s.slice(0, footerIndex);
// remove existing bottom module script before footer? It is after footer before body. Find script before </body>
const bodyClose = s.indexOf('</body>');
const footerBlock = s.slice(footerIndex, bodyClose);
// replace script block at end
const prefix = s.slice(0, start);
const newFull = prefix + footerBlock + newBlock + '</body>\n</html>';
fs.writeFileSync(p,newFull);
console.log('done');
`;
// can't run self? Write file and execute via node instead below
fs.writeFileSync('E:/sia/peloton-hub-project-main/membership_patch_helper.js', newBlock);
console.log('prepared');
