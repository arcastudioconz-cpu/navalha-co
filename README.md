# Navalha &amp; Co

A private, appointment-only barber studio website with a full booking system,
owner dashboard, newsletter capture, and a concierge chat. Built as a single
Node.js app so a solo barber can run and host it easily.

*Website designed &amp; developed by ARCA Studio.*

---

## What's inside

- **10 branded pages** — home, about, services, gallery, booking, contact, location, reviews, FAQ, store (coming soon).
- **Smart booking** — customers pick a service, style, date and time. The calendar only shows real openings and reserves the correct length for each service (Haircut 60 min, Beard 30, Haircut + Beard 90, Eyebrow 15). Double-booking is impossible.
- **Owner dashboard** (`/admin`) — today's schedule, all appointments, working hours, blocked days/times, service &amp; price editing, newsletter list with CSV export, reviews, and message templates. Everything Eduardo needs is editable here — no code changes.
- **Newsletter** — popup after 5s (once per session), stored in the database, exportable to CSV.
- **Concierge chat** — a built-in assistant that answers common questions and routes people to booking. Conversation persists as the visitor moves between pages and resets on a new session.
- **WhatsApp** — every confirmation produces a ready-to-send WhatsApp message with the private address. Optional automated sending via Twilio.
- **SQLite database** — a single file. Easy to back up, no separate database server to manage. A `products` table is already in place so the store can be switched on later.

## Requirements

- Node.js 18 or newer.

## Run it locally

```bash
npm install
cp .env.example .env      # then edit .env (see below)
npm start
```

Then open:

- Website — http://localhost:3000
- Dashboard — http://localhost:3000/admin

## Configure `.env`

| Variable | What it does |
|---|---|
| `PORT` | Port to run on (default 3000). |
| `SESSION_SECRET` | Signs the admin login cookie. Generate one: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `ADMIN_PASSWORD` | Used **only on first launch** to create the dashboard login. **Change it before the first run.** After logging in, you can change the password from Settings. |
| `DATABASE_PATH` | Where the SQLite file lives (default `./data/navalha.db`). |
| `TWILIO_*` | Optional — fill in to send WhatsApp confirmations automatically. |

> **Security:** never deploy with the default `changeme-admin` password. Change it in `.env` before first launch, then update it again from the dashboard once you're in.

## First things to set in the dashboard

1. **Settings → WhatsApp number** — digits only, with country code (e.g. `15550102030`). Until this is set, WhatsApp links open without a recipient.
2. **Settings → General area** — the neighbourhood shown publicly (the exact address is never on the site; it's sent on WhatsApp after booking).
3. **Availability** — confirm working days/hours; block any holidays.
4. **Services** — prices and durations are pre-filled; adjust if needed.

## Gallery photos

The gallery and portrait frames show labelled placeholders. Add real photo URLs
from **the gallery items** (or drop images into `public/` and reference them).
Replace the "photography" frames on the home and about pages with real `<img>`
tags when you have them.

## Deploying

Any host that runs Node works (Render, Railway, Fly.io, a small VPS). Two things
matter:

1. Set the environment variables from the table above.
2. **Give the SQLite file a persistent disk.** Point `DATABASE_PATH` at that disk
   (e.g. `/data/navalha.db` on Render/Railway) so bookings and subscribers
   survive restarts and deploys. Without a persistent disk the database resets
   on each deploy.

Start command: `npm start`.

## Automated WhatsApp (optional)

Out of the box, confirmations use click-to-send `wa.me` links — no setup, works
immediately. To send automatically:

1. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_WHATSAPP_FROM` in `.env`.
2. `npm install twilio`.

Sending then happens on each booking. The 30-day return-reminder query is exposed
at `/api/admin/reminders/due` for a scheduler/cron to pick up.

## Privacy note

The newsletter and bookings store personal data (names, phone numbers, emails).
Make sure you have a short privacy/consent line near the signup and booking forms
that fits your local rules (e.g. GDPR/CCPA), and only message people who've opted in.

## Project structure

```
navalha-co/
  server.js            Express app: API, admin auth, booking logic
  db.js                SQLite schema + seed data
  whatsapp.js          WhatsApp send (log by default, Twilio optional)
  package.json
  .env.example
  public/
    index.html … store.html, admin.html
    css/styles.css     brand design system
    js/app.js          shared nav, footer, chat, newsletter
    js/booking.js      booking flow
    js/admin.js        dashboard
```
