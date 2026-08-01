/* ===================================================================
   NAVALHA & CO — booking flow (talks to the live API)
   =================================================================== */
document.addEventListener('na:ready', () => {
  const { $, $all, money } = window.NA;
  const STYLES = ['Fade', 'Classic', 'Undercut', 'Modern Cut', 'Textured Crop', 'Other'];
  const STEPS = 7;

  const state = {
    step: 1, services: [],
    booking: { name: '', phone: '', service: null, style: null, notes: '', date: null, time: null },
    calY: new Date().getFullYear(), calM: new Date().getMonth(), openDays: new Set()
  };

  $('#stepsBar').innerHTML = Array.from({ length: STEPS - 1 }, () => '<i></i>').join('');

  const fmtDate = iso => new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const fmtTime = t => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };
  const toISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const svc = id => state.services.find(s => s.id === id);

  async function init() {
    state.services = await window.NA.services();
    setStep(1);
  }

  function setStep(n) {
    state.step = n;
    $all('.step').forEach(s => s.classList.toggle('active', +s.dataset.step === n));
    $all('#stepsBar i').forEach((b, i) => b.classList.toggle('on', i < n));
    if (n === 2) renderServices();
    if (n === 3) renderStyles();
    if (n === 4) loadMonth();
    if (n === 5) loadSlots();
    if (n === 6) renderReview();
    document.querySelector('.booking-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  $all('[data-go]').forEach(btn => btn.addEventListener('click', () => {
    const target = +btn.dataset.go;
    if (target > state.step && !validate(state.step)) return;
    setStep(target);
  }));

  function flash(sel, m) { const el = $(sel); el.style.borderColor = '#ff8e8e'; el.focus(); el.placeholder = m; setTimeout(() => el.style.borderColor = '', 1600); }
  function validate(n) {
    const b = state.booking;
    if (n === 1) {
      b.name = $('#bkName').value.trim(); b.phone = $('#bkPhone').value.trim();
      if (b.name.length < 2) { flash('#bkName', 'Please enter your name'); return false; }
      if (b.phone.replace(/\D/g, '').length < 7) { flash('#bkPhone', 'Enter a valid WhatsApp number'); return false; }
    }
    if (n === 2 && !b.service) { alert('Please select a service.'); return false; }
    if (n === 3) { b.notes = $('#bkNotes').value.trim(); if (!b.style) { alert('Please choose a style, or pick "Other".'); return false; } }
    if (n === 4 && !b.date) { alert('Please select an available date.'); return false; }
    if (n === 5 && !b.time) { alert('Please select an available time.'); return false; }
    return true;
  }

  function renderServices() {
    $('#bkServices').innerHTML = state.services.map(s => `
      <button class="choice ${state.booking.service === s.id ? 'sel' : ''}" data-svc="${s.id}">
        <span class="n">${s.name}</span><span class="d">${s.duration_min} min</span>
        <span class="p">${money(s.price)}</span></button>`).join('');
    $all('[data-svc]').forEach(b => b.addEventListener('click', () => {
      state.booking.service = +b.dataset.svc; state.booking.time = null; renderServices();
    }));
  }

  function renderStyles() {
    $('#bkStyles').innerHTML = STYLES.map(s =>
      `<button class="style ${state.booking.style === s ? 'sel' : ''}" data-style="${s}"><span>${s}</span></button>`).join('');
    $all('[data-style]').forEach(b => b.addEventListener('click', () => { state.booking.style = b.dataset.style; renderStyles(); }));
  }

  async function loadMonth() {
    try {
      const r = await fetch(`/api/availability/days?year=${state.calY}&month=${state.calM + 1}`);
      const data = await r.json();
      state.openDays = new Set(data.open || []);
    } catch { state.openDays = new Set(); }
    renderCalendar();
  }

  function renderCalendar() {
    const y = state.calY, m = state.calM;
    const first = new Date(y, m, 1), startDow = first.getDay(), days = new Date(y, m + 1, 0).getDate();
    const monthName = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const prevDisabled = (y < today.getFullYear() || (y === today.getFullYear() && m <= today.getMonth()));
    let html = `<div class="cal-head">
        <button id="calPrev" ${prevDisabled ? 'disabled' : ''} aria-label="Previous month">&lsaquo;</button>
        <b>${monthName}</b><button id="calNext" aria-label="Next month">&rsaquo;</button></div><div class="cal-grid">`;
    ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(d => html += `<div class="cal-dow">${d}</div>`);
    for (let i = 0; i < startDow; i++) html += '<div class="day empty"></div>';
    for (let d = 1; d <= days; d++) {
      const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const avail = state.openDays.has(iso);
      const sel = state.booking.date === iso;
      html += `<div class="day ${avail ? 'avail' : 'off'} ${sel ? 'sel' : ''}" ${avail ? `data-date="${iso}"` : ''}>${d}</div>`;
    }
    html += '</div>';
    $('#calendar').innerHTML = html;
    const prev = $('#calPrev'), next = $('#calNext');
    if (prev && !prev.disabled) prev.addEventListener('click', () => { state.calM--; if (state.calM < 0) { state.calM = 11; state.calY--; } loadMonth(); });
    if (next) next.addEventListener('click', () => { state.calM++; if (state.calM > 11) { state.calM = 0; state.calY++; } loadMonth(); });
    $all('[data-date]').forEach(el => el.addEventListener('click', () => { state.booking.date = el.dataset.date; state.booking.time = null; renderCalendar(); }));
  }

  async function loadSlots() {
    const b = state.booking;
    const box = $('#slots');
    if (!b.date || !b.service) { box.innerHTML = '<p class="empty-note">Pick a date first.</p>'; return; }
    box.innerHTML = '<p class="empty-note">Checking availability\u2026</p>';
    try {
      const r = await fetch(`/api/availability?date=${b.date}&service_id=${b.service}`);
      const data = await r.json();
      const times = data.times || [];
      if (!times.length) { box.innerHTML = `<p class="empty-note">No times left on ${fmtDate(b.date)} \u2014 try another day.</p>`; return; }
      box.innerHTML = times.map(t => `<button class="slot ${b.time === t ? 'sel' : ''}" data-time="${t}">${fmtTime(t)}</button>`).join('');
      $all('[data-time]').forEach(s => s.addEventListener('click', () => { b.time = s.dataset.time; loadSlots(); }));
    } catch { box.innerHTML = '<p class="empty-note">Could not load times. Please try again.</p>'; }
  }

  function renderReview() {
    const b = state.booking, s = svc(b.service);
    $('#reviewBox').innerHTML = `
      <div class="review-row"><span>Name</span><span>${b.name}</span></div>
      <div class="review-row"><span>WhatsApp</span><span>${b.phone}</span></div>
      <div class="review-row"><span>Service</span><span>${s.name} \u00b7 ${s.duration_min} min</span></div>
      <div class="review-row"><span>Style</span><span>${b.style}</span></div>
      ${b.notes ? `<div class="review-row"><span>Notes</span><span>${b.notes}</span></div>` : ''}
      <div class="review-row"><span>Date</span><span>${fmtDate(b.date)}</span></div>
      <div class="review-row"><span>Time</span><span>${fmtTime(b.time)}</span></div>
      <div class="review-row"><span>Total</span><span style="color:var(--gold)">${money(s.price)}</span></div>`;
  }

  $('#confirmBtn').addEventListener('click', async () => {
    const b = state.booking, btn = $('#confirmBtn');
    btn.disabled = true; btn.textContent = 'Confirming\u2026';
    try {
      const r = await fetch('/api/bookings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: b.name, phone: b.phone, service_id: b.service, style: b.style, notes: b.notes, date: b.date, time: b.time, session_id: window.NA.getSessionId() })
      });
      const data = await r.json();
      if (!r.ok) { alert(data.error || 'Could not confirm. Please try another time.'); btn.disabled = false; btn.textContent = 'Confirm Appointment'; if (r.status === 409) setStep(5); return; }
      $('#waPreview').textContent = data.whatsapp_text || '';
      $('#waOpen').href = data.whatsapp_url || '#';
      const confirmedSvc = svc(b.service);
      window.NA.trackPixelEvent('Schedule', {
        content_name: confirmedSvc ? confirmedSvc.name : undefined,
        value: confirmedSvc ? confirmedSvc.price : undefined,
        currency: 'NZD'
      });
      setStep(7);
    } catch {
      alert('Network error. Please try again.');
      btn.disabled = false; btn.textContent = 'Confirm Appointment';
    }
  });

  init();
});
