'use strict';

// Optional automated WhatsApp sending.
//
// Out of the box this just logs the message — bookings still work, and the
// customer gets a click-to-send wa.me link from the confirmation screen.
//
// To send automatically, add your Twilio credentials to .env:
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
// then `npm install twilio` and this module will use it.

const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM } = process.env;

let client = null;
if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_WHATSAPP_FROM) {
  try {
    client = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  } catch {
    console.warn('[whatsapp] Twilio credentials set but the "twilio" package is not installed. Run: npm install twilio');
  }
}

async function send(toPhone, body) {
  const digits = String(toPhone || '').replace(/[^\d+]/g, '');
  if (!client) {
    console.log(`[whatsapp] (not sent — no Twilio) to ${digits}:\n${body}\n`);
    return { sent: false };
  }
  const to = `whatsapp:${digits.startsWith('+') ? digits : '+' + digits}`;
  const msg = await client.messages.create({ from: TWILIO_WHATSAPP_FROM, to, body });
  return { sent: true, sid: msg.sid };
}

module.exports = { send };
