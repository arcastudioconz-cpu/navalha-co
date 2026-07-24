'use strict';

require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-insecure-secret-change-me';

app.use(express.json());
app.use(cookieParser());

// ------------------------------------------------------------------
// Settings helpers
// ------------------------------------------------------------------
const getSetting = (key, fallback = '') => {
  const row = db.prepare('SELECT value FROM settings WHERE key=?').get(key);
  return row ? row.value : fallback;
};
const setSetting = db.prepare(
  'INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'
);

// ------------------------------------------------------------------
// Admin auth (single admin; scrypt password hash + signed cookie)
// ------------------------------------------------------------------
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}
function verifyPassword(password, stored) {
  try {
    const [, salt, hash] = stored.split('$');
    const test = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
  } catch { return false; }
}
// Create the admin password on first run from ADMIN_PASSWORD
(function seedAdmin() {
  const existing = getSetting('admin_password_hash', '');
  if (!existing) {
    const pw = process.env.ADMIN_PASSWORD || 'changeme-admin';
    setSetting.run('admin_password_hash', hashPassword(pw));
    console.log('[setup] Admin login created from ADMIN_PASSWORD. Change it after first login.');
  }
})();

function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}
function verifyToken(token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  if (sig.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch { return null; }
}
function requireAdmin(req, res, next) {
  const payload = verifyToken(req.cookies.na_session);
  if (!payload || payload.role !== 'admin') return res.status(401).json({ error: 'Not authorised' });
  next();
}

// ------------------------------------------------------------------
// Time / availability helpers
// ------------------------------------------------------------------
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const toHHMM = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const overlaps = (a1, a2, b1, b2) => a1 < b2 && b1 < a2;
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const nowMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

function busyIntervals(date) {
  const busy = [];
  db.prepare(`SELECT appointment_time t, duration_min d FROM appointments
              WHERE appointment_date=? AND status!='cancelled'`).all(date)
    .forEach(a => busy.push([toMin(a.t), toMin(a.t) + a.d]));
  db.prepare('SELECT start_time s, end_time e FROM blocked_times WHERE date=?').all(date)
    .forEach(b => busy.push([toMin(b.s), toMin(b.e)]));
  return busy;
}

function dateIsOpen(date) {
  if (date < todayISO()) return false;
  if (db.prepare('SELECT 1 FROM blocked_dates WHERE date=?').get(date)) return false;
  const dow = new Date(date + 'T00:00:00').getDay();
  const wh = db.prepare('SELECT is_open FROM working_hours WHERE day_of_week=?').get(dow);
  return !!(wh && wh.is_open);
}

function availableTimes(date, durationMin) {
  if (!dateIsOpen(date)) return [];
  const dow = new Date(date + 'T00:00:00').getDay();
  const wh = db.prepare('SELECT open_time,close_time FROM working_hours WHERE day_of_week=?').get(dow);
  if (!wh) return [];
  const open = toMin(wh.open_time), close = toMin(wh.close_time);
  const step = parseInt(getSetting('slot_interval_min', '30'), 10) || 30;
  const lead = parseInt(getSetting('booking_lead_min', '60'), 10) || 0;
  const busy = busyIntervals(date);
  const isToday = date === todayISO();
  const earliest = isToday ? nowMinutes() + lead : -1;

  const out = [];
  for (let t = open; t + durationMin <= close; t += step) {
    if (t < earliest) continue;
    const clash = busy.some(([b1, b2]) => overlaps(t, t + durationMin, b1, b2));
    if (!clash) out.push(toHHMM(t));
  }
  return out;
}

// ------------------------------------------------------------------
// PUBLIC API
// ------------------------------------------------------------------
app.get('/api/public/settings', (req, res) => {
  res.json({
    business_name: getSetting('business_name', 'Navalha & Co'),
    general_area: getSetting('general_area', ''),
    whatsapp_number: getSetting('whatsapp_number', ''),
    currency_symbol: getSetting('currency_symbol', '$'),
    location_message: getSetting('location_message', '')
  });
});

app.get('/api/services', (req, res) => {
  res.json(db.prepare('SELECT id,name,description,duration_min,price FROM services WHERE active=1 ORDER BY sort_order,id').all());
});

app.get('/api/reviews', (req, res) => {
  res.json(db.prepare('SELECT name,rating,text FROM reviews WHERE approved=1 ORDER BY created_at DESC').all());
});

app.get('/api/gallery', (req, res) => {
  res.json(db.prepare('SELECT label,image_url FROM gallery ORDER BY sort_order,id').all());
});

app.get('/api/availability/days', (req, res) => {
  const year = parseInt(req.query.year, 10);
  const month = parseInt(req.query.month, 10);
  if (!year || !month) return res.status(400).json({ error: 'year and month required' });
  const days = new Date(year, month, 0).getDate();
  const open = [];
  for (let d = 1; d <= days; d++) {
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (dateIsOpen(iso)) open.push(iso);
  }
  res.json({ open });
});

app.get('/api/availability', (req, res) => {
  const { date, service_id } = req.query;
  if (!date || !service_id) return res.status(400).json({ error: 'date and service_id required' });
  const svc = db.prepare('SELECT duration_min FROM services WHERE id=? AND active=1').get(service_id);
  if (!svc) return res.status(404).json({ error: 'Unknown service' });
  res.json({ date, times: availableTimes(date, svc.duration_min) });
});

const createBooking = db.transaction((data) => {
  const svc = db.prepare('SELECT id,name,duration_min,price FROM services WHERE id=? AND active=1').get(data.service_id);
  if (!svc) throw { status: 400, msg: 'Unknown service' };
  const times = availableTimes(data.date, svc.duration_min);
  if (!times.includes(data.time)) throw { status: 409, msg: 'That time is no longer available. Please pick another.' };
  const info = db.prepare(`INSERT INTO appointments
    (customer_name,phone,service_id,service_name,style,notes,appointment_date,appointment_time,duration_min,price,status)
    VALUES (?,?,?,?,?,?,?,?,?,?, 'confirmed')`).run(
      data.name, data.phone, svc.id, svc.name, data.style || '', data.notes || '',
      data.date, data.time, svc.duration_min, svc.price);
  return { id: info.lastInsertRowid, service: svc };
});

function buildWhatsApp(name, date, time, serviceName) {
  const tpl = getSetting('confirmation_message', '');
  const location = getSetting('location_message', '');
  const business = getSetting('business_name', 'Navalha & Co');
  const prettyDate = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
  const [h, m] = time.split(':').map(Number);
  const prettyTime = `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  const text = tpl.replace('{name}', name).replace('{business}', business)
    .replace('{date}', prettyDate).replace('{time}', prettyTime)
    .replace('{service}', serviceName).replace('{location}', location);
  const number = getSetting('whatsapp_number', '');
  const base = number ? `https://wa.me/${number}` : 'https://wa.me/';
  return { text, url: `${base}?text=${encodeURIComponent(text)}` };
}

app.post('/api/bookings', (req, res) => {
  const { name, phone, service_id, date, time } = req.body || {};
  if (!name || name.trim().length < 2) return res.status(400).json({ error: 'A valid name is required.' });
  if (!phone || phone.replace(/\D/g, '').length < 7) return res.status(400).json({ error: 'A valid WhatsApp number is required.' });
  if (!service_id || !date || !time) return res.status(400).json({ error: 'Service, date and time are required.' });
  try {
    const result = createBooking({
      name: name.trim(), phone: phone.trim(), service_id,
      style: req.body.style, notes: req.body.notes, date, time
    });
    const wa = buildWhatsApp(name.trim(), date, time, result.service.name);
    require('./whatsapp').send(phone, wa.text).catch(() => {});

    // Fire-and-forget: email Eduardo the full booking details. Never
    // blocks or breaks the customer's confirmation if it fails.
    require('./email').notifyEduardoNewBooking({
      customer_name: name.trim(),
      phone: phone.trim(),
      service_name: result.service.name,
      duration_min: result.service.duration_min,
      price: result.service.price,
      style: req.body.style || '',
      notes: req.body.notes || '',
      date,
      time
    }).catch(() => {});

    res.json({ ok: true, id: result.id, whatsapp_url: wa.url, whatsapp_text: wa.text });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.msg || 'Could not create booking.' });
  }
});

app.post('/api/newsletter', (req, res) => {
  const { full_name, email, phone } = req.body || {};
  if (!full_name || full_name.trim().length < 2) return res.status(400).json({ error: 'Please enter your full name.' });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  const exists = db.prepare('SELECT 1 FROM newsletter_subscribers WHERE email=?').get(email.trim());
  if (exists) return res.status(409).json({ error: 'You are already on the list \u2014 thank you!' });
  db.prepare('INSERT INTO newsletter_subscribers (full_name,email,phone,source) VALUES (?,?,?,?)')
    .run(full_name.trim(), email.trim().toLowerCase(), (phone || '').trim(), req.body.source || 'popup');
  res.json({ ok: true });
});

// ------------------------------------------------------------------
// ADMIN AUTH
// ------------------------------------------------------------------
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  const stored = getSetting('admin_password_hash', '');
  if (!password || !verifyPassword(password, stored)) return res.status(401).json({ error: 'Incorrect password.' });
  const token = signToken({ role: 'admin', exp: Date.now() + 1000 * 60 * 60 * 12 });
  res.cookie('na_session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 12 });
  res.json({ ok: true });
});
app.post('/api/admin/logout', (req, res) => { res.clearCookie('na_session'); res.json({ ok: true }); });
app.get('/api/admin/me', requireAdmin, (req, res) => res.json({ ok: true }));

app.post('/api/admin/password', requireAdmin, (req, res) => {
  const { current, next } = req.body || {};
  if (!verifyPassword(current || '', getSetting('admin_password_hash', ''))) return res.status(401).json({ error: 'Current password is incorrect.' });
  if (!next || next.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  setSetting.run('admin_password_hash', hashPassword(next));
  res.json({ ok: true });
});

// ------------------------------------------------------------------
// ADMIN — APPOINTMENTS
// ------------------------------------------------------------------
app.get('/api/admin/appointments', requireAdmin, (req, res) => {
  const scope = req.query.scope;
  let sql = 'SELECT * FROM appointments';
  const params = [];
  if (scope === 'today') { sql += ' WHERE appointment_date=?'; params.push(todayISO()); }
  else if (scope === 'upcoming') { sql += " WHERE appointment_date>=? AND status='confirmed'"; params.push(todayISO()); }
  sql += ' ORDER BY appointment_date, appointment_time';
  res.json(db.prepare(sql).all(...params));
});
app.patch('/api/admin/appointments/:id', requireAdmin, (req, res) => {
  const { status } = req.body || {};
  if (!['confirmed', 'completed', 'cancelled'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  db.prepare('UPDATE appointments SET status=? WHERE id=?').run(status, req.params.id);
  res.json({ ok: true });
});
app.delete('/api/admin/appointments/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM appointments WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ------------------------------------------------------------------
// ADMIN — SERVICES
// ------------------------------------------------------------------
app.get('/api/admin/services', requireAdmin, (req, res) =>
  res.json(db.prepare('SELECT * FROM services ORDER BY sort_order,id').all()));
app.post('/api/admin/services', requireAdmin, (req, res) => {
  const { name, description, duration_min, price } = req.body || {};
  if (!name || !duration_min || price == null) return res.status(400).json({ error: 'Name, duration and price are required.' });
  const max = db.prepare('SELECT COALESCE(MAX(sort_order),0)+1 n FROM services').get().n;
  const info = db.prepare('INSERT INTO services (name,description,duration_min,price,sort_order) VALUES (?,?,?,?,?)')
    .run(name, description || '', duration_min, price, max);
  res.json({ ok: true, id: info.lastInsertRowid });
});
app.patch('/api/admin/services/:id', requireAdmin, (req, res) => {
  const f = req.body || {};
  db.prepare('UPDATE services SET name=COALESCE(?,name), description=COALESCE(?,description), duration_min=COALESCE(?,duration_min), price=COALESCE(?,price), active=COALESCE(?,active) WHERE id=?')
    .run(f.name ?? null, f.description ?? null, f.duration_min ?? null, f.price ?? null, f.active ?? null, req.params.id);
  res.json({ ok: true });
});
app.delete('/api/admin/services/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM services WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ------------------------------------------------------------------
// ADMIN — AVAILABILITY
// ------------------------------------------------------------------
app.get('/api/admin/working-hours', requireAdmin, (req, res) =>
  res.json(db.prepare('SELECT * FROM working_hours ORDER BY day_of_week').all()));
app.patch('/api/admin/working-hours/:dow', requireAdmin, (req, res) => {
  const { is_open, open_time, close_time } = req.body || {};
  db.prepare('UPDATE working_hours SET is_open=COALESCE(?,is_open), open_time=COALESCE(?,open_time), close_time=COALESCE(?,close_time) WHERE day_of_week=?')
    .run(is_open ?? null, open_time ?? null, close_time ?? null, req.params.dow);
  res.json({ ok: true });
});

app.get('/api/admin/blocked-dates', requireAdmin, (req, res) =>
  res.json(db.prepare('SELECT * FROM blocked_dates ORDER BY date').all()));
app.post('/api/admin/blocked-dates', requireAdmin, (req, res) => {
  const { date, reason } = req.body || {};
  if (!date) return res.status(400).json({ error: 'Date required.' });
  try { db.prepare('INSERT INTO blocked_dates (date,reason) VALUES (?,?)').run(date, reason || ''); }
  catch { return res.status(409).json({ error: 'That date is already blocked.' }); }
  res.json({ ok: true });
});
app.delete('/api/admin/blocked-dates/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM blocked_dates WHERE id=?').run(req.params.id); res.json({ ok: true });
});

app.get('/api/admin/blocked-times', requireAdmin, (req, res) =>
  res.json(db.prepare('SELECT * FROM blocked_times ORDER BY date,start_time').all()));
app.post('/api/admin/blocked-times', requireAdmin, (req, res) => {
  const { date, start_time, end_time, reason } = req.body || {};
  if (!date || !start_time || !end_time) return res.status(400).json({ error: 'Date, start and end required.' });
  db.prepare('INSERT INTO blocked_times (date,start_time,end_time,reason) VALUES (?,?,?,?)').run(date, start_time, end_time, reason || '');
  res.json({ ok: true });
});
app.delete('/api/admin/blocked-times/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM blocked_times WHERE id=?').run(req.params.id); res.json({ ok: true });
});

// ------------------------------------------------------------------
// ADMIN — NEWSLETTER
// ------------------------------------------------------------------
app.get('/api/admin/subscribers', requireAdmin, (req, res) => {
  const q = (req.query.q || '').trim();
  let rows;
  if (q) rows = db.prepare("SELECT * FROM newsletter_subscribers WHERE full_name LIKE ? OR email LIKE ? ORDER BY subscribed_at DESC")
    .all(`%${q}%`, `%${q}%`);
  else rows = db.prepare('SELECT * FROM newsletter_subscribers ORDER BY subscribed_at DESC').all();
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const weekAgo = new Date(now.getTime() - 7 * 864e5).toISOString().slice(0, 10);
  res.json({
    subscribers: rows,
    total: db.prepare('SELECT COUNT(*) c FROM newsletter_subscribers').get().c,
    this_month: db.prepare('SELECT COUNT(*) c FROM newsletter_subscribers WHERE subscribed_at>=?').get(monthStart).c,
    this_week: db.prepare('SELECT COUNT(*) c FROM newsletter_subscribers WHERE subscribed_at>=?').get(weekAgo).c
  });
});
app.delete('/api/admin/subscribers/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM newsletter_subscribers WHERE id=?').run(req.params.id); res.json({ ok: true });
});
app.get('/api/admin/subscribers.csv', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT full_name,email,phone,subscribed_at,source,status FROM newsletter_subscribers ORDER BY subscribed_at DESC').all();
  const header = ['full_name', 'email', 'phone', 'subscribed_at', 'source', 'status'];
  const csv = [header.join(',')].concat(
    rows.map(r => header.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))
  ).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="newsletter_subscribers.csv"');
  res.send(csv);
});

// ------------------------------------------------------------------
// ADMIN — REVIEWS, GALLERY, SETTINGS
// ------------------------------------------------------------------
app.get('/api/admin/reviews', requireAdmin, (req, res) =>
  res.json(db.prepare('SELECT * FROM reviews ORDER BY created_at DESC').all()));
app.post('/api/admin/reviews', requireAdmin, (req, res) => {
  const { name, rating, text } = req.body || {};
  if (!name || !text) return res.status(400).json({ error: 'Name and text required.' });
  db.prepare('INSERT INTO reviews (name,rating,text,approved) VALUES (?,?,?,1)').run(name, rating || 5, text);
  res.json({ ok: true });
});
app.patch('/api/admin/reviews/:id', requireAdmin, (req, res) => {
  db.prepare('UPDATE reviews SET approved=COALESCE(?,approved) WHERE id=?').run(req.body.approved ?? null, req.params.id);
  res.json({ ok: true });
});
app.delete('/api/admin/reviews/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM reviews WHERE id=?').run(req.params.id); res.json({ ok: true });
});

app.get('/api/admin/gallery', requireAdmin, (req, res) => {
  res.json(db.prepare('SELECT * FROM gallery ORDER BY sort_order,id').all());
});
app.post('/api/admin/gallery', requireAdmin, (req, res) => {
  const { label, image_url } = req.body || {};
  if (!label) return res.status(400).json({ error: 'Label required.' });
  const max = db.prepare('SELECT COALESCE(MAX(sort_order),0)+1 n FROM gallery').get().n;
  db.prepare('INSERT INTO gallery (label,image_url,sort_order) VALUES (?,?,?)').run(label, image_url || '', max);
  res.json({ ok: true });
});
app.patch('/api/admin/gallery/:id', requireAdmin, (req, res) => {
  const { label, image_url } = req.body || {};
  db.prepare('UPDATE gallery SET label=COALESCE(?,label), image_url=COALESCE(?,image_url) WHERE id=?')
    .run(label ?? null, image_url ?? null, req.params.id);
  res.json({ ok: true });
});
app.delete('/api/admin/gallery/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM gallery WHERE id=?').run(req.params.id); res.json({ ok: true });
});

app.get('/api/admin/settings', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT key,value FROM settings').all();
  const obj = {};
  rows.forEach(r => { if (r.key !== 'admin_password_hash') obj[r.key] = r.value; });
  res.json(obj);
});
app.patch('/api/admin/settings', requireAdmin, (req, res) => {
  const allowed = ['business_name', 'general_area', 'whatsapp_number', 'currency_symbol',
    'slot_interval_min', 'booking_lead_min', 'confirmation_message', 'location_message', 'reminder_message'];
  Object.entries(req.body || {}).forEach(([k, v]) => { if (allowed.includes(k)) setSetting.run(k, String(v)); });
  res.json({ ok: true });
});

app.get('/api/admin/reminders/due', requireAdmin, (req, res) => {
  const rows = db.prepare(`SELECT * FROM appointments
    WHERE status='completed' AND reminder_sent=0
    AND appointment_date <= date('now','-30 day')`).all();
  res.json(rows);
});

// ------------------------------------------------------------------
// Static site
// ------------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ------------------------------------------------------------------
// 404 — anything that didn't match a real file or API route above.
// Must be registered after static + all routes, so it only catches
// genuinely unmatched requests.
// ------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

app.listen(PORT, () => {
  console.log(`\n  Navalha & Co running \u2192  http://localhost:${PORT}`);
  console.log(`  Admin dashboard      \u2192  http://localhost:${PORT}/admin\n`);
});
