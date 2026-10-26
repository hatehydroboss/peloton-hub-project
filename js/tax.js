/* ================================================================
   PelotonHub — tax.js
   VAT rate, the shop's invoice details, and the VAT maths used by the
   cart, checkout, order details and the BIR sales invoice.
   Prices in the catalog are VAT-inclusive: the VAT is already inside
   the total, so it is taken out of it, never added on top.
   ================================================================ */

/** VAT rate (12% in the Philippines). Change it here only. */
export const VAT_RATE = 0.12;

/** Business details printed on the sales invoice. Change them here only.
 *  Placeholders in [brackets] must be replaced with the shop's real BIR details. */
export const BUSINESS = {
  name:          'PelotonHub Bike Shop',
  owner:         '[Registered owner / company name]',
  address:       '[Street, Barangay, City, Province, ZIP]',
  tin:           '000-000-000-00000',          // VAT Reg. TIN incl. branch code
  phone:         '[Phone number]',
  email:         '[Shop email]',
  website:       'pelotonhub.web.app',
  // Printer's accreditation / permit (placeholders until the BIR issues them)
  bir_permit_no: '[BIR Permit to Use No.]',
  permit_date:   '[Date issued]',
  atp_no:        '[Authority to Print No.]',
  atp_date:      '[Date issued]',
  series_range:  'INV-000001 to INV-999999',
  printer:       '[Accredited printer name, address and TIN]',
};

const round2 = n => Math.round((Number(n) || 0) * 100) / 100;

/** VAT inside a VAT-inclusive total: { vatable_sales, vat_amount, total }. */
export function vatBreakdown(total) {
  const t = round2(total);
  const vatable_sales = round2(t / (1 + VAT_RATE));
  return { vatable_sales, vat_amount: round2(t - vatable_sales), total: t };
}

/** The VAT figures saved on an order, or worked out from its total for older orders. */
export function orderVat(order) {
  if (order && order.vatable_sales != null && order.vat_amount != null)
    return { vatable_sales: order.vatable_sales, vat_amount: order.vat_amount, total: round2(order.total) };
  return vatBreakdown(order ? order.total : 0);
}

/** ₱1,234.50 — peso amount with 2 decimals. */
export function peso2(n) {
  return '₱' + (Number(n) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** VAT label for the current rate, e.g. "VAT (12%)". */
export const VAT_LABEL = `VAT (${Math.round(VAT_RATE * 100)}%)`;

/** Invoice serial from its sequence number: 1 → "INV-000001". */
export function invoiceNo(seq) {
  return 'INV-' + String(seq).padStart(6, '0');
}
