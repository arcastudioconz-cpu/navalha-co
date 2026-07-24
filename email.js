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

// Converts a plain-text email body into simple HTML — blank lines become
// paragraph breaks, single line breaks become <br>. Keeps the newsletter
// composer simple (just type normally) without needing a rich text editor.
function textToHtml(text) {
  return String(text || '')
    .split(/\n\s*\n/)
    .map(para => `<p style="margin:0 0 16px;">${para.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

// Sends a newsletter broadcast to a list of subscribers. Sends one at a
// time (small barbershop list, so no need for batch/queue complexity) and
// keeps going even if an individual send fails, so one bad address
// doesn't stop the rest of the list. Returns a summary the dashboard can
// show ("Sent to 42 of 43 subscribers").
//
// Note: there is currently no one-click unsubscribe link — each email
// includes a line asking people to reply if they'd like to be removed,
// and Eduardo can delete them from the Newsletter tab. A proper
// unsubscribe link would be a good future addition if the list grows.
async function sendNewsletterBroadcast(subject, bodyText, recipients) {
  if (!resend) {
    return { sent: 0, failed: recipients.length, lastError: 'Resend not configured on the server (missing package or RESEND_API_KEY).' };
  }
  const bodyHtml = textToHtml(bodyText);
  let sent = 0, failed = 0, lastError = null;

  for (const r of recipients) {
    try {
      const { error } = await resend.emails.send({
        from: FROM_ADDRESS,
        to: r.email,
        subject,
        html: `
          ${bodyHtml}
          <hr style="border:none;border-top:1px solid #ddd;margin:24px 0 12px;">
          <p style="font-size:12px;color:#888;">You're receiving this because you joined the Navalha &amp; Co newsletter. Reply to this email if you'd rather not receive these.</p>
        `
      });
      if (error) {
        failed++;
        lastError = (error && (error.message || error.name || JSON.stringify(error))) || 'Unknown error';
        console.error('[email] Newsletter send failed for', r.email, lastError);
      } else sent++;
    } catch (err) {
      failed++;
      lastError = err.message || String(err);
      console.error('[email] Newsletter send failed for', r.email, lastError);
    }
    // Small gap between sends to stay well within provider rate limits.
    await new Promise(res => setTimeout(res, 350));
  }

  return { sent, failed, lastError };
}

module.exports = { notifyEduardoNewBooking, sendNewsletterBroadcast };