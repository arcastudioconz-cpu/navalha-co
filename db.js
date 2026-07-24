'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'data', 'navalha.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ------------------------------------------------------------------
// Schema — designed so future features (store, loyalty, payments,
// multiple barbers) can be added without restructuring existing tables.
// ------------------------------------------------------------------
db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS services (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  description  TEXT DEFAULT '',
  duration_min INTEGER NOT NULL,
  price        REAL NOT NULL,
  active       INTEGER NOT NULL DEFAULT 1,
  sort_order   INTEGER NOT NULL DEFAULT 0
);

-- Weekly template: one row per weekday (0 = Sunday ... 6 = Saturday)
CREATE TABLE IF NOT EXISTS working_hours (
  day_of_week INTEGER PRIMARY KEY,   -- 0..6
  is_open     INTEGER NOT NULL DEFAULT 1,
  open_time   TEXT NOT NULL DEFAULT '09:00',
  close_time  TEXT NOT NULL DEFAULT '18:00'
);

-- Whole days Eduardo has closed (holidays, vacation)
CREATE TABLE IF NOT EXISTS blocked_dates (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  date   TEXT NOT NULL UNIQUE,        -- YYYY-MM-DD
  reason TEXT DEFAULT ''
);

-- Specific time ranges blocked on a given day (lunch, personal)
CREATE TABLE IF NOT EXISTS blocked_times (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  date       TEXT NOT NULL,           -- YYYY-MM-DD
  start_time TEXT NOT NULL,           -- HH:MM
  end_time   TEXT NOT NULL,           -- HH:MM
  reason     TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS appointments (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name    TEXT NOT NULL,
  phone            TEXT NOT NULL,
  service_id       INTEGER,
  service_name     TEXT NOT NULL,
  style            TEXT DEFAULT '',
  notes            TEXT DEFAULT '',
  appointment_date TEXT NOT NULL,     -- YYYY-MM-DD
  appointment_time TEXT NOT NULL,     -- HH:MM  (start)
  duration_min     INTEGER NOT NULL,
  price            REAL NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'confirmed', -- confirmed | completed | cancelled
  reminder_sent    INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_appt_date ON appointments(appointment_date, status);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone         TEXT DEFAULT '',
  source        TEXT DEFAULT 'popup',
  subscribed_at TEXT NOT NULL DEFAULT (datetime('now')),
  status        TEXT NOT NULL DEFAULT 'active'
);

-- Reusable / editable newsletter email templates. Eduardo can load one
-- into the composer, tweak it, save changes back, or send as-is.
CREATE TABLE IF NOT EXISTS email_templates (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,          -- internal label, e.g. "Fresh Cut Reminder"
  subject    TEXT NOT NULL,
  body       TEXT NOT NULL,          -- plain text; converted to simple HTML paragraphs on send
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A light log of each newsletter broadcast actually sent, so Eduardo can
-- see send history (subject, recipient count, when) in the dashboard.
CREATE TABLE IF NOT EXISTS newsletter_sends (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  subject       TEXT NOT NULL,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reviews (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  rating     INTEGER NOT NULL DEFAULT 5,
  text       TEXT NOT NULL,
  approved   INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS gallery (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  label      TEXT NOT NULL,
  image_url  TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Future store: table exists now so the shop can be switched on later.
CREATE TABLE IF NOT EXISTS products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  price       REAL NOT NULL DEFAULT 0,
  image_url   TEXT DEFAULT '',
  in_stock    INTEGER NOT NULL DEFAULT 1,
  active      INTEGER NOT NULL DEFAULT 0
);
`);

// ------------------------------------------------------------------
// Seed defaults on first run only
// ------------------------------------------------------------------
function seed() {
  const count = (t) => db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c;

  if (count('settings') === 0) {
    const s = db.prepare('INSERT INTO settings (key,value) VALUES (?,?)');
    s.run('business_name', 'Navalha & Co');
    s.run('general_area', 'Centro / Downtown district');
    s.run('whatsapp_number', ''); // e.g. 15550102030  (digits only, with country code)
    s.run('currency_symbol', '$');
    s.run('slot_interval_min', '30'); // grid granularity for start times
    s.run('booking_lead_min', '60');  // earliest bookable time from "now", in minutes
    s.run('confirmation_message',
      'Hi {name}! \u2702\ufe0f\n\nYour appointment at {business} is confirmed.\n\nDate: {date}\nTime: {time}\nService: {service}\n\nHere is your location:\n{location}\n\nIf anything comes up, just reply here.\n\nSee you soon! \ud83d\udd25');
    s.run('location_message', '\ud83d\udccd The exact studio address and door details are shared here privately once your appointment is confirmed.');
    s.run('reminder_message',
      'Hi {name}! \ud83d\udc4b\n\nIt\u2019s been a month since your last visit to {business}.\n\nReady for a fresh look? Reply here and book your next appointment.\n\nSee you soon! \u2728');
  }

  if (count('services') === 0) {
    const s = db.prepare('INSERT INTO services (name,description,duration_min,price,active,sort_order) VALUES (?,?,?,?,1,?)');
    s.run('Haircut', 'Consultation, precision cut, hot-towel finish and styling. The core of the house.', 60, 35, 1);
    s.run('Beard', 'Shape, line-up and hot-towel razor detailing for a clean, deliberate finish.', 30, 22, 2);
    s.run('Haircut + Beard', 'The full reset \u2014 a tailored cut paired with matching beard work. Best value.', 90, 50, 3);
    s.run('Eyebrow', 'Tidy, natural shaping to frame the face. Added to any service or booked alone.', 15, 12, 4);
  }

  if (count('working_hours') === 0) {
    const w = db.prepare('INSERT INTO working_hours (day_of_week,is_open,open_time,close_time) VALUES (?,?,?,?)');
    // Sunday closed, Mon–Sat open 09:00–18:00
    for (let d = 0; d <= 6; d++) w.run(d, d === 0 ? 0 : 1, '09:00', '18:00');
  }

  if (count('email_templates') === 0) {
    const t = db.prepare('INSERT INTO email_templates (name,subject,body) VALUES (?,?,?)');
    t.run(
      'Fresh Cut Reminder',
      "Time for a fresh cut? \u2702\ufe0f",
      "Hey there,\n\nIt's been a little while since your last visit \u2014 thought you might be due for a fresh cut.\n\nBook your next appointment whenever suits you, and I'll see you in the chair soon.\n\nSee you soon,\nEduardo\nNavalha & Co"
    );
    t.run(
      'Special Offer',
      "A little something for you \ud83d\udd25",
      "Hey there,\n\nJust wanted to let you know about a special offer running right now at Navalha & Co.\n\n[Describe your offer here]\n\nBook your appointment and mention this email to claim it.\n\nSee you soon,\nEduardo\nNavalha & Co"
    );
    t.run(
      'Hours / Availability Update',
      "A quick update on my hours",
      "Hey there,\n\nJust a quick note about my current availability \u2014 [describe any changes to hours, holidays, or new opening days here].\n\nBook online any time to see exactly what's open.\n\nSee you soon,\nEduardo\nNavalha & Co"
    );
    t.run(
      'Welcome',
      "Welcome to Navalha & Co",
      "Hey there,\n\nThanks for joining the Navalha & Co community! You'll be the first to hear about offers, availability, and anything new at the studio.\n\nReady for your first visit? Book online whenever suits you.\n\nSee you soon,\nEduardo\nNavalha & Co"
    );
  }

  if (count('reviews') === 0) {
    const r = db.prepare('INSERT INTO reviews (name,rating,text,approved) VALUES (?,?,?,1)');
    r.run('Marcus S.', 5, 'No waiting, no rush. Eduardo actually listens, and it\u2019s the best fade I\u2019ve had in years.');
    r.run('Daniel R.', 5, 'Feels less like a barbershop and more like a private appointment. The attention is unreal.');
    r.run('Thiago M.', 5, 'Told him roughly what I wanted, he made it better than I pictured. Booking is effortless too.');
    r.run('Lucas P.', 5, 'The one-on-one thing is a game changer. You\u2019re the only person in the room and it shows.');
    r.run('Andr\u00e9 V.', 5, 'Clean space, sharp cut, and the WhatsApp confirmation made it dead simple.');
    r.run('Rafael C.', 5, 'Been to a lot of barbers. This is the first one that feels genuinely premium.');
  }

  if (count('gallery') === 0) {
    const g = db.prepare('INSERT INTO gallery (label,sort_order) VALUES (?,?)');
    ['Skin fade','Classic side part','Textured crop','Beard sculpt','Undercut','Scissor cut','Line-up detail','Hot-towel finish','The studio']
      .forEach((l, i) => g.run(l, i));
  }
}
seed();

module.exports = db;