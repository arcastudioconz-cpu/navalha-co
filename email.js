'use strict';

// Sends Eduardo an email the moment a customer books an appointment.
// Uses Resend (same service ARCA Studio's own platform already uses),
// so no new account is strictly required if you want to reuse an
// existing Resend account — otherwise sign up free at resend.com.

let Resend;
try {
  Resend = require('resend').Resend;
} catch {
  Resend = null;
}

const resend = (Resend && process.env.RESEND_API_KEY) ? new Resend(process.env.RESEND_API_KEY) : null;

// Using Resend's shared test sender until navalhaco.co.nz (or whatever
// domain you use) is verified in the Resend dashboard. Once verified,
// change this to something like 'Navalha & Co <bookings@navalhaco.co.nz>'.
const FROM_ADDRESS = 'Navalha & Co <onboarding@resend.dev>';

function toPrettyDate(dateISO) {
  return new Date(dateISO + 'T00:00:00').toLocaleDateString('en-NZ', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}
function toPrettyTime(time) {
  const [h, m] = time.split(':').map(Number);
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

// Fire-and-forget: called after a booking is successfully created.
// Never throws — a failed email must never affect the customer's
// booking confirmation, which has already succeeded by this point.
async function notifyEduardoNewBooking(booking) {
  if (!resend) {
    console.log('[email] Resend not configured (missing package or RESEND_API_KEY) — skipping email notification.');
    return;
  }
  const to = process.env.EDUARDO_EMAIL;
  if (!to) {
    console.log('[email] EDUARDO_EMAIL not set — skipping email notification.');
    return;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject: `New booking: ${booking.customer_name} — ${booking.service_name} on ${toPrettyDate(booking.date)}`,
      html: `
        <h2 style="margin:0 0 12px;">New appointment booked</h2>
        <p><strong>When:</strong> ${toPrettyDate(booking.date)} at ${toPrettyTime(booking.time)}</p>
        <hr style="border:none;border-top:1px solid #ddd;margin:16px 0;">
        <p><strong>Client:</strong> ${booking.customer_name}</p>
        <p><strong>WhatsApp:</strong> ${booking.phone}</p>
        <hr style="border:none;border-top:1px solid #ddd;margin:16px 0;">
        <p><strong>Service:</strong> ${booking.service_name} (${booking.duration_min} min)</p>
        <p><strong>Style:</strong> ${booking.style || '-'}</p>
        ${booking.notes ? `<p><strong>Notes:</strong> ${String(booking.notes).replace(/\n/g, '<br>')}</p>` : ''}
        <p><strong>Price:</strong> $${booking.price}</p>
        <hr style="border:none;border-top:1px solid #ddd;margin:16px 0;">
        <p>Manage this booking in your <a href="${process.env.DASHBOARD_URL || ''}/admin">dashboard</a>.</p>
      `
    });

    if (error) {
      console.error('[email] Booking notification failed:', error.message || error);
      return;
    }
    console.log('[email] Booking notification sent:', data && data.id);
  } catch (err) {
    console.error('[email] Booking notification failed:', err.message);
  }
}

module.exports = { notifyEduardoNewBooking };