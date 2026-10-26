/* ================================================================
   PelotonHub — invoice.js
   Builds the printable BIR sales invoice for one order. Used by the
   customer page (invoice.html) and the admin page (admin/invoice.html).
   Business details and the VAT rate come from tax.js.
   ================================================================ */

import { BUSINESS, VAT_LABEL, orderVat, peso2 } from './tax.js';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const longDate = iso => iso ? new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
const PAY = { paymongo: 'Online (PayMongo)', cash: 'Cash' };

/** Invoice HTML for an order ({ id, items[], total, discount_pct, invoice_no, invoice_date, … }). */
export function renderInvoice(order) {
  const o     = order;
  const items = o.items || [];
  const gross = items.reduce((s, i) => s + i.price * i.qty, 0);
  const vat   = orderVat(o);
  const disc  = Math.round((gross - vat.total) * 100) / 100;
  const issued = !!o.invoice_no;

  const stamp = o.status === 'cancelled'
    ? '<div class="inv-stamp">Cancelled</div>'
    : !issued ? '<div class="inv-stamp inv-stamp-soft">Not yet issued</div>' : '';

  return `
  <article class="invoice" aria-label="Sales invoice">
    ${stamp}
    <header class="inv-head">
      <div class="inv-biz">
        <h1>${esc(BUSINESS.name)}</h1>
        <p>${esc(BUSINESS.owner)} &mdash; Prop.</p>
        <p>${esc(BUSINESS.address)}</p>
        <p><strong>VAT Reg. TIN: ${esc(BUSINESS.tin)}</strong></p>
        <p>${esc(BUSINESS.phone)} &middot; ${esc(BUSINESS.email)} &middot; ${esc(BUSINESS.website)}</p>
      </div>
      <div class="inv-title">
        <h2>Sales Invoice</h2>
        <table class="inv-kv">
          <tr><th>No.</th><td class="inv-no">${issued ? esc(o.invoice_no) : '&mdash;'}</td></tr>
          <tr><th>Date</th><td>${esc(longDate(issued ? o.invoice_date : o.created_at))}</td></tr>
          <tr><th>Order</th><td class="mono">${esc(o.id)}</td></tr>
        </table>
      </div>
    </header>

    ${!issued && o.status !== 'cancelled' ? `<p class="inv-banner">This invoice number is issued when the order is picked up. Until then this copy is for reference only.</p>` : ''}

    <section class="inv-sold">
      <table class="inv-kv">
        <tr><th>Sold to</th><td>${esc(o.customer_name || 'Walk-in customer')}</td></tr>
        <tr><th>Email</th><td>${esc(o.customer_email || '')}</td></tr>
        <tr><th>TIN</th><td class="inv-blank"></td></tr>
        <tr><th>Address</th><td class="inv-blank"></td></tr>
        <tr><th>Payment</th><td>${esc(PAY[o.payment_method] || o.payment_method || '')}</td></tr>
      </table>
    </section>

    <table class="inv-items">
      <thead><tr><th class="q">Qty</th><th>Item / Description</th><th class="r inv-unit">Unit Price</th><th class="r">Amount</th></tr></thead>
      <tbody>
        ${items.map(i => `<tr>
          <td class="q">${i.qty}</td>
          <td>${esc(i.name)}${i.size ? ` <span class="inv-muted">(${esc(i.size)})</span>` : ''}<span class="inv-each">${peso2(i.price)} each</span></td>
          <td class="r inv-unit">${peso2(i.price)}</td>
          <td class="r">${peso2(i.price * i.qty)}</td>
        </tr>`).join('')}
      </tbody>
    </table>

    <div class="inv-bottom">
      <table class="inv-sum">
        <tr><th>VATable Sales</th><td>${peso2(vat.vatable_sales)}</td></tr>
        <tr><th>VAT-Exempt Sales</th><td>${peso2(0)}</td></tr>
        <tr><th>Zero-Rated Sales</th><td>${peso2(0)}</td></tr>
        <tr><th>${esc(VAT_LABEL)}</th><td>${peso2(vat.vat_amount)}</td></tr>
      </table>
      <table class="inv-sum">
        <tr><th>Total Sales (VAT Inclusive)</th><td>${peso2(gross)}</td></tr>
        ${disc > 0 ? `<tr><th>Less: Discount${o.discount_pct ? ` (${o.discount_pct}%)` : ''}</th><td>-${peso2(disc)}</td></tr>` : ''}
        <tr><th>Less: VAT</th><td>${peso2(vat.vat_amount)}</td></tr>
        <tr><th>Amount Net of VAT</th><td>${peso2(vat.vatable_sales)}</td></tr>
        <tr><th>Add: VAT</th><td>${peso2(vat.vat_amount)}</td></tr>
        <tr class="inv-due"><th>Total Amount Due</th><td>${peso2(vat.total)}</td></tr>
      </table>
    </div>

    <div class="inv-sign">
      <div><span></span>Cashier / Authorized Representative</div>
      <div><span></span>Received the items in good order</div>
    </div>

    <footer class="inv-foot">
      <p>BIR Permit to Use No.: ${esc(BUSINESS.bir_permit_no)} &middot; Date Issued: ${esc(BUSINESS.permit_date)}</p>
      <p>ATP No.: ${esc(BUSINESS.atp_no)} &middot; Date Issued: ${esc(BUSINESS.atp_date)} &middot; Approved Series: ${esc(BUSINESS.series_range)}</p>
      <p>${esc(BUSINESS.printer)}</p>
      <p class="inv-muted">THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX UNTIL BIR PERMIT DETAILS ARE COMPLETED.</p>
    </footer>
  </article>`;
}
