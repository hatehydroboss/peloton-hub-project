/* ================================================================
   PelotonHub — migration 001: VAT fields + invoice numbers
   ----------------------------------------------------------------
   The database is Cloud Firestore (no SQL tables), so this migration
   is a script that runs in the browser while signed in as an admin.

   WHAT IT DOES (adds fields only; never deletes, renames or resets):
   1. orders.vatable_sales / orders.vat_amount
      Filled ONLY where the field is missing or null:
        vatable_sales = ROUND(total / 1.12, 2)
        vat_amount    = total − vatable_sales
      `total` is read, never written. Orders that already have the
      fields are skipped.
      Discounts: `total` is already the amount after the member/promo
      discount (there is no delivery fee: orders are store pickups), so
      VAT is taken out of the discounted amount the customer actually
      pays, the same way checkout now does it.
   2. orders.invoice_no / invoice_seq / invoice_date (Completed orders only)
      Completed orders without an invoice number are numbered oldest
      first by their completion date (updated_at, else created_at):
      INV-000001, INV-000002, … continuing after config/invoice_counter.
      invoice_date = that same date. config/invoice_counter.last is
      set to the last number used, so new pickups continue the series.
   NOT touched: delivered_at (old orders stay without it, so they
   aren't eligible for returns), status, total, items, anything else.

   HOW TO RUN (local server, e.g. F5 in VS Code → http://127.0.0.1:5500):
   1. Open http://127.0.0.1:5500/admin/index.html and sign in as admin.
   2. Open DevTools → Console and run the dry run (changes nothing):
        const m = await import('/migrations/001-vat-and-invoice-backfill.js');
        await m.migrate();
   3. Check the tables it prints. To write the changes:
        await m.migrate({ apply: true });
   Running it again is safe: filled orders are skipped.
   ================================================================ */

import { db, auth, VAT_RATE, invoiceNo, apiAdminMe } from '../js/firebase.js';
import {
  collection, doc, getDoc, getDocs, writeBatch, Timestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const round2 = n => Math.round(n * 100) / 100;
const isEmpty = v => v === undefined || v === null;
const toDate = ts => (ts instanceof Timestamp ? ts.toDate() : ts ? new Date(ts) : null);

export async function migrate({ apply = false } = {}) {
  if (!auth.currentUser) throw new Error('Sign in to the admin console first.');
  const { admin } = await apiAdminMe();
  if (!admin) throw new Error('The signed-in account is not an admin.');

  const [ordersSnap, counterSnap] = await Promise.all([
    getDocs(collection(db, 'orders')),
    getDoc(doc(db, 'config', 'invoice_counter')),
  ]);
  const counterLast = (counterSnap.exists() && counterSnap.data().last) || 0;

  // ── 1. VAT backfill ──
  const changes = new Map();   // orderId → fields to add
  const skipped = [];
  const vatRows = [];
  ordersSnap.docs.forEach(d => {
    const o = d.data();
    if (!isEmpty(o.vatable_sales) && !isEmpty(o.vat_amount)) return;   // already filled
    if (typeof o.total !== 'number' || !isFinite(o.total)) { skipped.push({ order: d.id, reason: 'total is not a number', total: o.total }); return; }
    const vatable = isEmpty(o.vatable_sales) ? round2(o.total / (1 + VAT_RATE)) : o.vatable_sales;
    const add = {};
    if (isEmpty(o.vatable_sales)) add.vatable_sales = vatable;
    if (isEmpty(o.vat_amount))    add.vat_amount    = round2(o.total - vatable);
    changes.set(d.id, add);
    vatRows.push({ order: d.id, status: o.status, total: o.total, ...add });
  });

  // ── 2. Invoice numbers for Completed orders that have none ──
  const toNumber = ordersSnap.docs
    .filter(d => d.data().status === 'completed' && !d.data().invoice_no)
    .map(d => ({ id: d.id, date: toDate(d.data().updated_at) || toDate(d.data().created_at) || new Date(0), ts: d.data().updated_at || d.data().created_at || null }))
    .sort((a, b) => a.date - b.date || a.id.localeCompare(b.id));
  const invRows = [];
  toNumber.forEach((o, i) => {
    const seq = counterLast + i + 1;
    const add = { invoice_no: invoiceNo(seq), invoice_seq: seq, invoice_date: o.ts };
    changes.set(o.id, { ...(changes.get(o.id) || {}), ...add });
    invRows.push({ order: o.id, invoice_no: add.invoice_no, invoice_date: o.date.toLocaleString('en-PH') });
  });

  console.log(`%cMigration 001 — ${apply ? 'APPLYING' : 'DRY RUN (nothing written)'}`, 'font-weight:bold;font-size:14px');
  console.log(`Orders in database: ${ordersSnap.size}. VAT to fill: ${vatRows.length}. Invoice numbers to issue: ${invRows.length}.`);
  if (vatRows.length) console.table(vatRows);
  if (invRows.length) console.table(invRows);
  if (skipped.length) { console.warn('Skipped (left unchanged):'); console.table(skipped); }
  if (counterLast) console.warn(`config/invoice_counter is already at ${counterLast}: new numbers start at ${invoiceNo(counterLast + 1)}. Orders completed since the code update keep their lower numbers.`);

  if (!apply) return { applied: false, vat: vatRows.length, invoices: invRows.length, skipped: skipped.length };

  // Write in batches (Firestore allows 500 writes per batch). The invoice counter
  // is saved in each batch with the highest number written so far, so a failed run
  // never leaves numbers handed out without the counter knowing.
  const ids = [...changes.keys()];
  const seqOf = id => changes.get(id).invoice_seq || 0;
  let maxSeq = counterLast, written = 0;
  for (let i = 0; i < ids.length; i += 400) {
    const batch = writeBatch(db);
    ids.slice(i, i + 400).forEach(id => {
      batch.update(doc(db, 'orders', id), changes.get(id));   // update = adds fields, keeps the rest
      maxSeq = Math.max(maxSeq, seqOf(id));
    });
    if (maxSeq > counterLast) batch.set(doc(db, 'config', 'invoice_counter'), { last: maxSeq, updated_at: Timestamp.now() }, { merge: true });
    await batch.commit();
    written += Math.min(400, ids.length - i);
    console.log(`Written ${written} / ${ids.length} orders`);
  }
  console.log('%cMigration 001 done.', 'font-weight:bold;color:green');
  return { applied: true, vat: vatRows.length, invoices: invRows.length, skipped: skipped.length };
}
