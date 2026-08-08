'use strict';
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query, withTransaction } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const logger = require('../services/logger');

const router = express.Router();

// ── Time helpers ──────────────────────────────────
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const toHHMM = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const overlaps = (a1, a2, b1, b2) => a1 < b2 && b1 < a2;
const todayISO = () => new Date().toISOString().slice(0, 10);
const nowMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

const SLOT_INTERVAL_MIN = 30;   // grid granularity for start times
const LEAD_TIME_MIN = 120;      // earliest bookable time from "now" (2 hours notice)
const CONSULT_DURATION_MIN = 30; // every consultation call is 30 minutes

async function busyIntervals(date) {
  const busy = [];
  const appts = await query(
    `SELECT appointment_time t FROM consultations WHERE appointment_date=$1 AND status!='cancelled'`,
    [date]
  );
  appts.rows.forEach(a => busy.push([toMin(a.t), toMin(a.t) + CONSULT_DURATION_MIN]));

  const blocked = await query(`SELECT start_time s, end_time e FROM arca_blocked_times WHERE date=$1`, [date]);
  blocked.rows.forEach(b => busy.push([toMin(b.s), toMin(b.e)]));

  return busy;
}

async function dateIsOpen(date) {
  if (date < todayISO()) return false;
  const blocked = await query('SELECT 1 FROM arca_blocked_dates WHERE date=$1', [date]);
  if (blocked.rows.length > 0) return false;
  const dow = new Date(date + 'T00:00:00Z').getUTCDay();
  const wh = await query('SELECT is_open FROM arca_working_hours WHERE day_of_week=$1', [dow]);
  return !!(wh.rows[0] && wh.rows[0].is_open);
}

async function availableTimes(date) {
  if (!(await dateIsOpen(date))) return [];
  const dow = new Date(date + 'T00:00:00Z').getUTCDay();
  const whRes = await query('SELECT open_time,close_time FROM arca_working_hours WHERE day_of_week=$1', [dow]);
  const wh = whRes.rows[0];
  if (!wh) return [];

  const open = toMin(wh.open_time), close = toMin(wh.close_time);
  const busy = await busyIntervals(date);
  const isToday = date === todayISO();
  const earliest = isToday ? nowMinutes() + LEAD_TIME_MIN : -1;

  const out = [];
  for (let t = open; t + CONSULT_DURATION_MIN <= close; t += SLOT_INTERVAL_MIN) {
    if (t < earliest) continue;
    const clash = busy.some(([b1, b2]) => overlaps(t, t + CONSULT_DURATION_MIN, b1, b2));
    if (!clash) out.push(toHHMM(t));
  }
  return out;
}

// ─── PUBLIC: which days in a month are open ───────
router.get('/availability/days', async (req, res, next) => {
  try {
    const year = parseInt(req.query.year, 10);
    const month = parseInt(req.query.month, 10); // 1..12
    if (!year || !month) return res.status(400).json({ success: false, error: 'year and month required' });

    const daysInMonth = new Date(year, month, 0).getDate();
    const open = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (await dateIsOpen(iso)) open.push(iso);
    }
    res.json({ success: true, data: { open } });
  } catch (err) { next(err); }
});

// ─── PUBLIC: available times for a specific date ──
router.get('/availability', async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ success: false, error: 'date required' });
    const times = await availableTimes(date);
    res.json({ success: true, data: { date, times } });
  } catch (err) { next(err); }
});

// ─── PUBLIC: create a consultation booking ────────
router.post('/create', async (req, res, next) => {
  try {
    const {
      full_name, email, phone, business_name,
      service_category, service_detail, addons, budget, project_details,
      date, time
    } = req.body || {};

    if (!full_name || full_name.trim().length < 2) return res.status(400).json({ success: false, error: 'A valid name is required.' });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success: false, error: 'A valid email is required.' });
    if (!service_category) return res.status(400).json({ success: false, error: 'Please select a service.' });
    if (!date || !time) return res.status(400).json({ success: false, error: 'Please select a date and time.' });

    const result = await withTransaction(async (trx) => {
      // Re-check availability inside the transaction to prevent a race
      // between two people booking the same slot at once.
      const times = await availableTimes(date);
      if (!times.includes(time)) {
        const err = new Error('That time is no longer available. Please pick another.');
        err.status = 409;
        throw err;
      }
      const id = uuidv4();
      await trx.query(
        `INSERT INTO consultations
          (id, full_name, email, phone, business_name, service_category, service_detail,
           addons, budget, project_details, appointment_date, appointment_time, duration_min, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'confirmed')`,
        [
          id, full_name.trim(), email.trim(), (phone || '').trim(), (business_name || '').trim(),
          service_category, service_detail || '', JSON.stringify(addons || []),
          budget || '', (project_details || '').trim(),
          date, time, CONSULT_DURATION_MIN
        ]
      );
      return { id };
    });

    logger.info('New consultation booked', { id: result.id, email, service_category });
    res.json({ success: true, data: result });
  } catch (err) {
    if (err.status === 409) return res.status(409).json({ success: false, error: err.message });
    next(err);
  }
});

// ─── ADMIN: manage working hours ──────────────────
router.get('/admin/working-hours', authenticate, async (req, res, next) => {
  try {
    const r = await query('SELECT * FROM arca_working_hours ORDER BY day_of_week');
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
});
router.patch('/admin/working-hours/:dow', authenticate, async (req, res, next) => {
  try {
    const { is_open, open_time, close_time } = req.body || {};
    await query(
      `UPDATE arca_working_hours SET is_open=COALESCE($1,is_open), open_time=COALESCE($2,open_time), close_time=COALESCE($3,close_time) WHERE day_of_week=$4`,
      [is_open ?? null, open_time ?? null, close_time ?? null, req.params.dow]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── ADMIN: blocked dates ──────────────────────────
router.get('/admin/blocked-dates', authenticate, async (req, res, next) => {
  try {
    const r = await query('SELECT * FROM arca_blocked_dates ORDER BY date');
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
});
router.post('/admin/blocked-dates', authenticate, async (req, res, next) => {
  try {
    const { date, reason } = req.body || {};
    if (!date) return res.status(400).json({ success: false, error: 'Date required.' });
    await query('INSERT INTO arca_blocked_dates (id,date,reason) VALUES ($1,$2,$3)', [uuidv4(), date, reason || '']);
    res.json({ success: true });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, error: 'That date is already blocked.' });
    next(err);
  }
});
router.delete('/admin/blocked-dates/:id', authenticate, async (req, res, next) => {
  try { await query('DELETE FROM arca_blocked_dates WHERE id=$1', [req.params.id]); res.json({ success: true }); }
  catch (err) { next(err); }
});

// ─── ADMIN: blocked times ──────────────────────────
router.get('/admin/blocked-times', authenticate, async (req, res, next) => {
  try {
    const r = await query('SELECT * FROM arca_blocked_times ORDER BY date, start_time');
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
});
router.post('/admin/blocked-times', authenticate, async (req, res, next) => {
  try {
    const { date, start_time, end_time, reason } = req.body || {};
    if (!date || !start_time || !end_time) return res.status(400).json({ success: false, error: 'Date, start and end required.' });
    await query('INSERT INTO arca_blocked_times (id,date,start_time,end_time,reason) VALUES ($1,$2,$3,$4,$5)',
      [uuidv4(), date, start_time, end_time, reason || '']);
    res.json({ success: true });
  } catch (err) { next(err); }
});
router.delete('/admin/blocked-times/:id', authenticate, async (req, res, next) => {
  try { await query('DELETE FROM arca_blocked_times WHERE id=$1', [req.params.id]); res.json({ success: true }); }
  catch (err) { next(err); }
});

// ─── ADMIN: view / manage consultations ────────────
router.get('/admin/consultations', authenticate, async (req, res, next) => {
  try {
    const scope = req.query.scope; // upcoming | all
    let sql = 'SELECT * FROM consultations';
    const params = [];
    if (scope === 'upcoming') { sql += " WHERE appointment_date>=$1 AND status='confirmed'"; params.push(todayISO()); }
    sql += ' ORDER BY appointment_date, appointment_time';
    const r = await query(sql, params);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
});
router.patch('/admin/consultations/:id', authenticate, async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (!['confirmed', 'completed', 'cancelled'].includes(status)) return res.status(400).json({ success: false, error: 'Invalid status.' });
    await query('UPDATE consultations SET status=$1 WHERE id=$2', [status, req.params.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});
router.delete('/admin/consultations/:id', authenticate, async (req, res, next) => {
  try { await query('DELETE FROM consultations WHERE id=$1', [req.params.id]); res.json({ success: true }); }
  catch (err) { next(err); }
});

module.exports = router;