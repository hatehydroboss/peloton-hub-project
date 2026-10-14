/* ================================================================
   PelotonHub — firebase-stock-seed.js
   Run this ONCE to give every existing product a stock-on-hand number,
   based on its catalog sub-category (DEFAULT_STOCK in firebase.js).
   Products that already have a stock number are left untouched;
   products marked out of stock get 0.

   HOW TO USE:
   1. Add <script type="module" src="js/firebase-stock-seed.js"></script>
      temporarily before </body> in index.html
   2. Open index.html through Live Server, then DevTools → Console
   3. Wait for "✅ Stock setup complete!"
   4. Remove the script tag
   ================================================================ */

import { db, defaultStockFor } from './firebase.js';
import {
  collection, getDocs, query, where, writeBatch, doc, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  getAuth, signInWithEmailAndPassword,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

async function seedStock() {
  console.log('📦 Starting PelotonHub stock setup...');

  // Only admins may change products (see the security rules)
  await signInWithEmailAndPassword(getAuth(), 'admin@pelotonhub.ph', 'admin123');
  console.log('  ✓ Signed in as admin');

  const snap  = await getDocs(query(collection(db, 'products'), where('deleted', '==', false)));
  const batch = writeBatch(db);
  let updated = 0, skipped = 0;

  for (const d of snap.docs) {
    const p = d.data();
    if (p.stock_qty !== null && p.stock_qty !== undefined) { skipped++; continue; }
    const qty = p.in_stock ? defaultStockFor(p.category, p.sub_category) : 0;
    batch.update(doc(db, 'products', d.id), { stock_qty: qty, in_stock: qty > 0, updated_at: serverTimestamp() });
    console.log(`     ${String(qty).padStart(3)}  ${p.name}  (${p.sub_category})`);
    updated++;
  }

  if (updated) await batch.commit();
  console.log(`  ✓ ${updated} products given stock, ${skipped} already had a number`);
  console.log('✅ Stock setup complete! Remove this script tag from your HTML now.');
}

seedStock().catch(err => console.error('❌ Stock setup failed:', err));
