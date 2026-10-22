/* ================================================================
   PelotonHub — email.js
   Sends support emails through EmailJS (https://www.emailjs.com),
   straight from the browser — no server needed.

   SETUP (see README → "Support emails (EmailJS)"):
   1.  Create an EmailJS account and connect an Email Service (Gmail etc.)
   2.  Create the two templates described in the README
   3.  Fill in EMAILJS_CONFIG below and set SHOP_EMAIL

   Until the config is filled in, every send is skipped (tickets are
   still saved to Firestore as before). Email failures never block a
   ticket or a reply from being saved.
   ================================================================ */

export const EMAILJS_CONFIG = {
  publicKey:        'BLdk88I8Ui1hcl-pI',    // Account → General → Public Key
  serviceId:        'service_kzkrme9',   // Email Services → Service ID
  shopTemplateId:   'template_shop',        // "New ticket" → shop inbox
  customerTemplateId: 'template_customer',  // confirmations + admin replies → customer
};

// Inbox that receives new support tickets
export const SHOP_EMAIL = 'pelotonhub2026@gmail.com';

const SHOP_NAME = 'PelotonHub';

function isConfigured() {
  return !Object.values(EMAILJS_CONFIG).some(v => v.startsWith('YOUR_'))
      && SHOP_EMAIL !== 'support@example.com';
}

/** POST one email to the EmailJS REST API. Returns { ok, error? } and never throws. */
async function send(templateId, params) {
  if (!isConfigured()) {
    console.info('[email] EmailJS not configured — skipped', templateId);
    return { ok: false, error: 'not configured' };
  }
  try {
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id:      EMAILJS_CONFIG.serviceId,
        template_id:     templateId,
        user_id:         EMAILJS_CONFIG.publicKey,
        template_params: params,
      }),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return { ok: true };
  } catch (e) {
    console.warn('[email] send failed', templateId, e.message);
    return { ok: false, error: e.message };
  }
}

/** Short ticket number shown to people, e.g. "#A1B2C3" */
const ticketRef = id => '#' + String(id || '').slice(0, 6).toUpperCase();

/** e.g. "Oct 18, 1:04 AM" — makes every subject unique so Gmail doesn't
 *  thread the emails together and hide the repeated template as "trimmed" */
const stamp = () => new Date().toLocaleString('en-US',
  { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/**
 * New support ticket: notify the shop (reply-to = customer) and send the
 * customer a "we got your message" confirmation.
 */
export async function emailNewTicket({ id, name, email, topic, order_ref, message }) {
  const ref = ticketRef(id), at = stamp();
  const [shop, customer] = await Promise.all([
    send(EMAILJS_CONFIG.shopTemplateId, {
      to_email:  SHOP_EMAIL,
      reply_to:  email,
      from_name: name,
      from_email: email,
      ticket_ref: `${ref} · ${at}`,
      topic,
      order_ref: order_ref || '—',
      message,
    }),
    send(EMAILJS_CONFIG.customerTemplateId, {
      to_email: email,
      to_name:  name,
      reply_to: SHOP_EMAIL,
      subject:  `We received your message — ${topic} (ticket ${ref})`,
      heading:  `Thanks for reaching out, ${name}! Your ticket ${ref} was received on ${at}. We reply within 1 business day. Here's a copy of your message:`,
      message:  (order_ref ? `Order reference: ${order_ref}\n\n` : '') + message,
      shop_name: SHOP_NAME,
    }),
  ]);
  return { shop, customer };
}

/** Admin reply on a ticket: email the reply to the customer. */
export function emailTicketReply({ id, name, email, topic, reply, admin_name }) {
  const ref = ticketRef(id), at = stamp();
  return send(EMAILJS_CONFIG.customerTemplateId, {
    to_email: email,
    to_name:  name || 'there',
    reply_to: SHOP_EMAIL,
    subject:  `Re: ${topic || 'Your PelotonHub inquiry'} (ticket ${ref}) — ${at}`,
    heading:  `${admin_name || 'The PelotonHub team'} replied to your ticket ${ref} on ${at}:`,
    message:  reply,
    shop_name: SHOP_NAME,
  });
}
