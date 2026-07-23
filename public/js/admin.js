/* ===================================================================
   NAVALHA & CO — Eduardo's dashboard
   =================================================================== */
document.addEventListener('na:ready', () => {
  const { $, money } = window.NA;
  const app = $('#adminApp');
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const api = async (url, opts = {}) => {
    const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
    if (r.status === 401) { showLogin(); throw new Error('unauth'); }
    return r;
  };
  const fmtDate = iso => new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtTime = t => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- LOGIN ---------- */
  function showLogin() {
    app.innerHTML = `
      <div class="card" style="max-width:400px;margin:60px auto">
        <span class="eyebrow">Eduardo</span>
        <h2 style="font-size:1.6rem;margin:10px 0 6px">Owner login</h2>
        <p class="muted" style="font-size:.9rem;margin-bottom:22px">Enter your password to manage the studio.</p>
        <div class="field"><label>Password</label><input id="pw" type="password" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" /></div>
        <div class="form-msg err" id="loginMsg"></div>
        <button class="btn btn-gold" id="loginBtn" style="width:100%">Sign in</button>
      </div>`;
    $('#pw').addEventListener('keydown', e => { if (e.key === 'Enter') $('#loginBtn').click(); });
    $('#loginBtn').addEventListener('click', async () => {
      const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('#pw').value }) });
      if (!r.ok) { $('#loginMsg').textContent = 'Incorrect password.'; return; }
      dashboard();
    });
  }

  /* ---------- DASHBOARD SHELL ---------- */
  const TABS = [['today', 'Today'], ['appointments', 'Appointments'], ['availability', 'Availability'],
  ['services', 'Services'], ['gallery', 'Gallery'], ['newsletter', 'Newsletter'], ['reviews', 'Reviews'], ['settings', 'Settings']];

  function dashboard(active = 'today') {
    app.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:12px;margin-bottom:8px">
        <div><span class="eyebrow">Eduardo \u00b7 Dashboard</span><h2 style="font-size:1.9rem;margin-top:8px">Studio control</h2></div>
        <button class="btn btn-ghost" id="logout" style="padding:10px 18px">Sign out</button>
      </div>
      <div class="divider"></div>
      <div class="admin-tabs" id="tabs" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:26px;border-bottom:1px solid var(--card-line);padding-bottom:14px">
        ${TABS.map(([id, l]) => `<button data-tab="${id}" style="font-size:.74rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);padding:8px 14px;border-radius:3px">${l}</button>`).join('')}
      </div>
      <div id="panel"></div>`;
    $('#logout').addEventListener('click', async () => { await fetch('/api/admin/logout', { method: 'POST' }); showLogin(); });
    document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => select(b.dataset.tab)));
    select(active);
  }
  function select(tab) {
    document.querySelectorAll('[data-tab]').forEach(b => {
      const on = b.dataset.tab === tab;
      b.style.background = on ? 'rgba(212,175,55,.1)' : 'transparent';
      b.style.color = on ? 'var(--gold-light)' : 'var(--muted)';
    });
    ({ today: renderToday, appointments: renderAppointments, availability: renderAvailability,
       services: renderServices, gallery: renderGallery, newsletter: renderNewsletter, reviews: renderReviews, settings: renderSettings }[tab])();
  }
  const panel = () => $('#panel');
  const stat = (v, l) => `<div class="card" style="padding:20px"><div style="font-family:var(--font-display);font-size:2rem;color:var(--gold)">${v}</div><div class="muted" style="font-size:.68rem;letter-spacing:.14em;text-transform:uppercase">${l}</div></div>`;

  /* ---------- TODAY ---------- */
  async function renderToday() {
    const [today, upcoming, subs] = await Promise.all([
      (await api('/api/admin/appointments?scope=today')).json(),
      (await api('/api/admin/appointments?scope=upcoming')).json(),
      (await api('/api/admin/subscribers')).json()
    ]);
    panel().innerHTML = `
      <div class="grid" style="grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:26px">
        ${stat(today.length, "Today's appointments")}${stat(upcoming.length, 'Upcoming')}${stat(subs.total, 'Subscribers')}
      </div>
      <h3 style="font-size:1.2rem;margin-bottom:14px">Today \u2014 ${new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
      ${apptTable(today) || '<p class="empty-note">No appointments today.</p>'}`;
    wireApptButtons(renderToday);
  }

  /* ---------- APPOINTMENTS ---------- */
  async function renderAppointments() {
    const rows = await (await api('/api/admin/appointments?scope=all')).json();
    panel().innerHTML = `<h3 style="font-size:1.2rem;margin-bottom:14px">All appointments</h3>${apptTable(rows) || '<p class="empty-note">No appointments yet.</p>'}`;
    wireApptButtons(renderAppointments);
  }
  function apptTable(rows) {
    if (!rows.length) return '';
    return `<table class="data" style="width:100%;border-collapse:collapse;font-size:.86rem">
      <thead><tr>${['Date', 'Time', 'Client', 'Service', 'Style', 'Status', ''].map(h => `<th style="text-align:left;font-size:.66rem;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);padding:10px 12px;border-bottom:1px solid var(--line)">${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(a => `<tr>
        <td style="padding:12px;border-bottom:1px solid var(--card-line)">${fmtDate(a.appointment_date)}</td>
        <td style="padding:12px;border-bottom:1px solid var(--card-line)">${fmtTime(a.appointment_time)}</td>
        <td style="padding:12px;border-bottom:1px solid var(--card-line)">${esc(a.customer_name)}<br><span class="muted" style="font-size:.78rem">${esc(a.phone)}</span></td>
        <td style="padding:12px;border-bottom:1px solid var(--card-line)">${esc(a.service_name)}</td>
        <td style="padding:12px;border-bottom:1px solid var(--card-line)">${esc(a.style)}${a.notes ? `<br><span class="muted" style="font-size:.76rem">${esc(a.notes)}</span>` : ''}</td>
        <td style="padding:12px;border-bottom:1px solid var(--card-line)"><span style="color:${a.status === 'cancelled' ? '#ff8e8e' : a.status === 'completed' ? 'var(--muted)' : 'var(--gold-light)'}">${a.status}</span></td>
        <td style="padding:12px;border-bottom:1px solid var(--card-line);white-space:nowrap">
          ${a.status === 'confirmed' ? `<button class="mini" data-done="${a.id}" title="Mark completed">\u2713</button><button class="mini" data-cancel="${a.id}" title="Cancel">\u2715</button>` : ''}
          <button class="mini" data-del="${a.id}" title="Delete">\ud83d\uddd1</button>
        </td></tr>`).join('')}</tbody></table>
      <style>.mini{border:1px solid var(--card-line);border-radius:4px;padding:5px 9px;margin-left:5px;color:var(--gold-light);font-size:.8rem}.mini:hover{border-color:var(--gold)}</style>`;
  }
  function wireApptButtons(refresh) {
    document.querySelectorAll('[data-done]').forEach(b => b.onclick = async () => { await api(`/api/admin/appointments/${b.dataset.done}`, { method: 'PATCH', body: JSON.stringify({ status: 'completed' }) }); refresh(); });
    document.querySelectorAll('[data-cancel]').forEach(b => b.onclick = async () => { if (confirm('Cancel this appointment? The time slot reopens for others.')) { await api(`/api/admin/appointments/${b.dataset.cancel}`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) }); refresh(); } });
    document.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (confirm('Permanently delete this appointment?')) { await api(`/api/admin/appointments/${b.dataset.del}`, { method: 'DELETE' }); refresh(); } });
  }

  /* ---------- AVAILABILITY ---------- */
  async function renderAvailability() {
    const [wh, bd, bt] = await Promise.all([
      (await api('/api/admin/working-hours')).json(),
      (await api('/api/admin/blocked-dates')).json(),
      (await api('/api/admin/blocked-times')).json()
    ]);
    panel().innerHTML = `
      <h3 style="font-size:1.2rem;margin-bottom:6px">Working days &amp; hours</h3>
      <p class="muted" style="font-size:.85rem;margin-bottom:16px">Toggle a day on or off, and set opening hours. Customers only ever see times inside these windows.</p>
      <div id="whList" style="margin-bottom:34px"></div>

      <h3 style="font-size:1.2rem;margin-bottom:6px">Blocked days</h3>
      <p class="muted" style="font-size:.85rem;margin-bottom:14px">Holidays and vacation. These dates disappear from the booking calendar.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px">
        <div class="field" style="margin:0"><label>Date</label><input id="bdDate" type="date"></div>
        <div class="field" style="margin:0;flex:1;min-width:180px"><label>Reason (optional)</label><input id="bdReason" type="text" placeholder="e.g. Vacation"></div>
        <button class="btn btn-gold" id="bdAdd" style="padding:12px 20px">Block day</button>
      </div>
      <div id="bdList" style="margin-bottom:34px"></div>

      <h3 style="font-size:1.2rem;margin-bottom:6px">Blocked times</h3>
      <p class="muted" style="font-size:.85rem;margin-bottom:14px">Lunch breaks or personal slots on a specific day.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px">
        <div class="field" style="margin:0"><label>Date</label><input id="btDate" type="date"></div>
        <div class="field" style="margin:0"><label>From</label><input id="btStart" type="time"></div>
        <div class="field" style="margin:0"><label>To</label><input id="btEnd" type="time"></div>
        <div class="field" style="margin:0;flex:1;min-width:140px"><label>Reason</label><input id="btReason" type="text" placeholder="e.g. Lunch"></div>
        <button class="btn btn-gold" id="btAdd" style="padding:12px 20px">Block time</button>
      </div>
      <div id="btList"></div>`;

    // working hours
    $('#whList').innerHTML = wh.map(w => `
      <div style="display:flex;align-items:center;gap:14px;padding:10px 14px;border:1px solid var(--card-line);border-radius:4px;margin-bottom:8px;flex-wrap:wrap">
        <span style="min-width:96px">${DAYS[w.day_of_week]}</span>
        <button class="switch ${w.is_open ? 'on' : ''}" data-dow="${w.day_of_week}" aria-label="Toggle" style="width:46px;height:26px;border-radius:20px;background:${w.is_open ? 'var(--gold)' : '#242424'};position:relative;flex-shrink:0"><i style="position:absolute;top:3px;left:${w.is_open ? '23px' : '3px'};width:20px;height:20px;border-radius:50%;background:#0a0a0a;transition:.2s"></i></button>
        <input type="time" value="${w.open_time}" data-open="${w.day_of_week}" style="background:#0e0e0e;border:1px solid var(--card-line);border-radius:3px;color:var(--text);padding:8px">
        <span class="muted">to</span>
        <input type="time" value="${w.close_time}" data-close="${w.day_of_week}" style="background:#0e0e0e;border:1px solid var(--card-line);border-radius:3px;color:var(--text);padding:8px">
      </div>`).join('');
    document.querySelectorAll('[data-dow]').forEach(sw => sw.onclick = async () => {
      const dow = sw.dataset.dow, isOpen = sw.classList.contains('on') ? 0 : 1;
      await api(`/api/admin/working-hours/${dow}`, { method: 'PATCH', body: JSON.stringify({ is_open: isOpen }) });
      renderAvailability();
    });
    const saveHours = async (dow, field, val) => api(`/api/admin/working-hours/${dow}`, { method: 'PATCH', body: JSON.stringify({ [field]: val }) });
    document.querySelectorAll('[data-open]').forEach(i => i.onchange = () => saveHours(i.dataset.open, 'open_time', i.value));
    document.querySelectorAll('[data-close]').forEach(i => i.onchange = () => saveHours(i.dataset.close, 'close_time', i.value));

    // blocked dates
    $('#bdList').innerHTML = bd.length ? bd.map(d => rowChip(fmtDate(d.date) + (d.reason ? ` \u2014 ${esc(d.reason)}` : ''), `bd-${d.id}`)).join('') : '<p class="empty-note">No blocked days.</p>';
    bd.forEach(d => { const el = $(`#bd-${d.id}`); if (el) el.onclick = async () => { await api(`/api/admin/blocked-dates/${d.id}`, { method: 'DELETE' }); renderAvailability(); }; });
    $('#bdAdd').onclick = async () => {
      if (!$('#bdDate').value) return alert('Pick a date.');
      const r = await api('/api/admin/blocked-dates', { method: 'POST', body: JSON.stringify({ date: $('#bdDate').value, reason: $('#bdReason').value }) });
      if (!r.ok) { const e = await r.json(); alert(e.error); return; }
      renderAvailability();
    };

    // blocked times
    $('#btList').innerHTML = bt.length ? bt.map(t => rowChip(`${fmtDate(t.date)} \u00b7 ${t.start_time}\u2013${t.end_time}${t.reason ? ` \u2014 ${esc(t.reason)}` : ''}`, `bt-${t.id}`)).join('') : '<p class="empty-note">No blocked times.</p>';
    bt.forEach(t => { const el = $(`#bt-${t.id}`); if (el) el.onclick = async () => { await api(`/api/admin/blocked-times/${t.id}`, { method: 'DELETE' }); renderAvailability(); }; });
    $('#btAdd').onclick = async () => {
      const p = { date: $('#btDate').value, start_time: $('#btStart').value, end_time: $('#btEnd').value, reason: $('#btReason').value };
      if (!p.date || !p.start_time || !p.end_time) return alert('Date, from and to are required.');
      const r = await api('/api/admin/blocked-times', { method: 'POST', body: JSON.stringify(p) });
      if (!r.ok) { const e = await r.json(); alert(e.error); return; }
      renderAvailability();
    };
  }
  const rowChip = (label, id) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:11px 14px;border:1px solid var(--card-line);border-radius:4px;margin-bottom:8px"><span>${label}</span><button id="${id}" class="mini" style="border:1px solid var(--card-line);border-radius:4px;padding:5px 10px;color:#ff8e8e">Remove</button></div>`;

  /* ---------- SERVICES ---------- */
  async function renderGallery() {
    const rows = await (await api('/api/admin/gallery')).json();
    panel().innerHTML = `
      <h3 style="font-size:1.2rem;margin-bottom:14px">Gallery photos</h3>
      <div id="galList" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;margin-bottom:24px">
        ${rows.map(g => `
        <div class="card" style="padding:14px">
          <div style="width:100%;aspect-ratio:1;border-radius:4px;overflow:hidden;background:#0e0e0e;margin-bottom:10px;display:flex;align-items:center;justify-content:center">
            ${g.image_url ? `<img src="/${esc(g.image_url)}" alt="${esc(g.label)}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
            <span class="muted" style="font-size:.76rem;${g.image_url ? 'display:none' : 'display:flex'};align-items:center;justify-content:center;height:100%;padding:10px;text-align:center">No image / broken path</span>
          </div>
          <input value="${esc(g.label)}" data-galf="label" data-id="${g.id}" style="width:100%;background:#0e0e0e;border:1px solid var(--card-line);border-radius:3px;color:var(--text);padding:8px;margin-bottom:6px;font-size:.86rem">
          <input value="${esc(g.image_url)}" data-galf="image_url" data-id="${g.id}" placeholder="images/photo.jpg" style="width:100%;background:#0e0e0e;border:1px solid var(--card-line);border-radius:3px;color:var(--text);padding:8px;margin-bottom:8px;font-size:.8rem">
          <button class="mini" data-delgal="${g.id}" style="width:100%;border:1px solid var(--card-line);border-radius:4px;padding:7px;color:#ff8e8e">Delete</button>
        </div>`).join('') || '<p class="empty-note" style="grid-column:1/-1">No photos yet — add your first one below.</p>'}
      </div>
      <h3 style="font-size:1.1rem;margin:26px 0 12px">Add a photo</h3>
      <div class="card" style="display:grid;grid-template-columns:1fr 1.4fr auto;gap:10px;align-items:center">
        <input id="ngLabel" placeholder="Label (e.g. Skin Fade)" style="background:#0e0e0e;border:1px solid var(--card-line);border-radius:3px;color:var(--text);padding:9px">
        <input id="ngUrl" placeholder="images/your-photo.jpg" style="background:#0e0e0e;border:1px solid var(--card-line);border-radius:3px;color:var(--text);padding:9px">
        <button class="btn btn-gold" id="ngAdd" style="padding:10px 16px">Add</button>
      </div>
      <p class="muted" style="font-size:.82rem;margin-top:12px">Image URL should be the path to a photo already uploaded to the site (e.g. <code>images/photo.jpg</code>), or a full https:// link. Edits to label/URL save automatically when you click away from a field.</p>`;

    document.querySelectorAll('[data-galf]').forEach(inp => inp.onchange = async () => {
      await api(`/api/admin/gallery/${inp.dataset.id}`, { method: 'PATCH', body: JSON.stringify({ [inp.dataset.galf]: inp.value }) });
      renderGallery();
    });
    document.querySelectorAll('[data-delgal]').forEach(b => b.onclick = async () => { if (confirm('Delete this photo?')) { await api(`/api/admin/gallery/${b.dataset.delgal}`, { method: 'DELETE' }); renderGallery(); } });
    $('#ngAdd').onclick = async () => {
      const p = { label: $('#ngLabel').value.trim(), image_url: $('#ngUrl').value.trim() };
      if (!p.label) return alert('Please enter a label.');
      await api('/api/admin/gallery', { method: 'POST', body: JSON.stringify(p) }); renderGallery();
    };
  }

  async function renderServices() {
    const rows = await (await api('/api/admin/services')).json();
    panel().innerHTML = `
      <h3 style="font-size:1.2rem;margin-bottom:14px">Services &amp; prices</h3>
      <div id="svcList">${rows.map(s => `
        <div class="card" style="padding:16px;margin-bottom:10px;display:grid;grid-template-columns:1.4fr 1fr 1fr auto;gap:10px;align-items:center">
          <input value="${esc(s.name)}" data-f="name" data-id="${s.id}" style="background:#0e0e0e;border:1px solid var(--card-line);border-radius:3px;color:var(--text);padding:9px">
          <div style="display:flex;align-items:center;gap:6px"><input type="number" value="${s.duration_min}" data-f="duration_min" data-id="${s.id}" style="width:70px;background:#0e0e0e;border:1px solid var(--card-line);border-radius:3px;color:var(--text);padding:9px"><span class="muted" style="font-size:.8rem">min</span></div>
          <div style="display:flex;align-items:center;gap:6px"><span class="muted">${money('')}</span><input type="number" step="0.5" value="${s.price}" data-f="price" data-id="${s.id}" style="width:80px;background:#0e0e0e;border:1px solid var(--card-line);border-radius:3px;color:var(--text);padding:9px"></div>
          <button class="mini" data-delsvc="${s.id}" style="border:1px solid var(--card-line);border-radius:4px;padding:8px 12px;color:#ff8e8e">Delete</button>
        </div>`).join('')}</div>
      <h3 style="font-size:1.1rem;margin:26px 0 12px">Add a service</h3>
      <div class="card" style="display:grid;grid-template-columns:1.4fr 1fr 1fr auto;gap:10px;align-items:center">
        <input id="nsName" placeholder="Name" style="background:#0e0e0e;border:1px solid var(--card-line);border-radius:3px;color:var(--text);padding:9px">
        <input id="nsDur" type="number" placeholder="min" style="background:#0e0e0e;border:1px solid var(--card-line);border-radius:3px;color:var(--text);padding:9px">
        <input id="nsPrice" type="number" step="0.5" placeholder="price" style="background:#0e0e0e;border:1px solid var(--card-line);border-radius:3px;color:var(--text);padding:9px">
        <button class="btn btn-gold" id="nsAdd" style="padding:10px 16px">Add</button>
      </div>
      <p class="muted" style="font-size:.82rem;margin-top:12px">Edits save automatically when you click away from a field.</p>`;

    document.querySelectorAll('[data-f]').forEach(inp => inp.onchange = async () => {
      const val = inp.dataset.f === 'name' ? inp.value : Number(inp.value);
      await api(`/api/admin/services/${inp.dataset.id}`, { method: 'PATCH', body: JSON.stringify({ [inp.dataset.f]: val }) });
    });
    document.querySelectorAll('[data-delsvc]').forEach(b => b.onclick = async () => { if (confirm('Delete this service?')) { await api(`/api/admin/services/${b.dataset.delsvc}`, { method: 'DELETE' }); renderServices(); } });
    $('#nsAdd').onclick = async () => {
      const p = { name: $('#nsName').value.trim(), duration_min: Number($('#nsDur').value), price: Number($('#nsPrice').value) };
      if (!p.name || !p.duration_min || !p.price) return alert('Fill in name, duration and price.');
      await api('/api/admin/services', { method: 'POST', body: JSON.stringify(p) }); renderServices();
    };
  }

  /* ---------- NEWSLETTER ---------- */
  async function renderNewsletter() {
    const data = await (await api('/api/admin/subscribers')).json();
    panel().innerHTML = `
      <div class="grid" style="grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:22px">
        ${stat(data.total, 'Total subscribers')}${stat(data.this_month, 'This month')}${stat(data.this_week, 'This week')}
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
        <input id="subSearch" placeholder="Search name or email\u2026" style="flex:1;min-width:200px;background:#0e0e0e;border:1px solid var(--card-line);border-radius:3px;color:var(--text);padding:11px 14px">
        <a class="btn btn-ghost" href="/api/admin/subscribers.csv" style="padding:11px 20px">Export CSV</a>
      </div>
      <div id="subTable"></div>`;
    const draw = (d) => {
      $('#subTable').innerHTML = d.subscribers.length ? `<table class="data" style="width:100%;border-collapse:collapse;font-size:.86rem">
        <thead><tr>${['Name', 'Email', 'Phone', 'Joined', ''].map(h => `<th style="text-align:left;font-size:.66rem;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);padding:10px 12px;border-bottom:1px solid var(--line)">${h}</th>`).join('')}</tr></thead>
        <tbody>${d.subscribers.map(s => `<tr>
          <td style="padding:12px;border-bottom:1px solid var(--card-line)">${esc(s.full_name)}</td>
          <td style="padding:12px;border-bottom:1px solid var(--card-line)">${esc(s.email)}</td>
          <td style="padding:12px;border-bottom:1px solid var(--card-line)">${esc(s.phone) || '\u2014'}</td>
          <td style="padding:12px;border-bottom:1px solid var(--card-line)">${new Date(s.subscribed_at).toLocaleDateString()}</td>
          <td style="padding:12px;border-bottom:1px solid var(--card-line)"><button class="mini" data-delsub="${s.id}" style="border:1px solid var(--card-line);border-radius:4px;padding:5px 10px;color:#ff8e8e">Delete</button></td>
        </tr>`).join('')}</tbody></table>` : '<p class="empty-note">No subscribers yet.</p>';
      document.querySelectorAll('[data-delsub]').forEach(b => b.onclick = async () => { if (confirm('Delete this subscriber?')) { await api(`/api/admin/subscribers/${b.dataset.delsub}`, { method: 'DELETE' }); renderNewsletter(); } });
    };
    draw(data);
    let t; $('#subSearch').oninput = e => { clearTimeout(t); t = setTimeout(async () => { draw(await (await api('/api/admin/subscribers?q=' + encodeURIComponent(e.target.value))).json()); }, 250); };
  }

  /* ---------- REVIEWS ---------- */
  async function renderReviews() {
    const rows = await (await api('/api/admin/reviews')).json();
    panel().innerHTML = `
      <h3 style="font-size:1.2rem;margin-bottom:14px">Reviews</h3>
      <div>${rows.map(r => `
        <div class="card" style="padding:18px;margin-bottom:10px;display:flex;justify-content:space-between;gap:16px;align-items:flex-start">
          <div><div style="color:var(--gold);letter-spacing:2px">${'\u2605'.repeat(r.rating)}</div>
          <p style="font-family:var(--font-accent);font-style:italic;font-size:1.1rem;margin:6px 0">\u201c${esc(r.text)}\u201d</p>
          <span class="muted" style="font-size:.78rem;letter-spacing:.1em;text-transform:uppercase">${esc(r.name)} \u00b7 ${r.approved ? 'shown on site' : 'hidden'}</span></div>
          <div style="white-space:nowrap"><button class="mini" data-toggle="${r.id}" data-app="${r.approved}" style="border:1px solid var(--card-line);border-radius:4px;padding:6px 11px;color:var(--gold-light)">${r.approved ? 'Hide' : 'Show'}</button>
          <button class="mini" data-delrev="${r.id}" style="border:1px solid var(--card-line);border-radius:4px;padding:6px 11px;color:#ff8e8e;margin-left:5px">Delete</button></div>
        </div>`).join('')}</div>
      <h3 style="font-size:1.1rem;margin:24px 0 12px">Add a review</h3>
      <div class="card">
        <div class="field"><label>Name</label><input id="rvName"></div>
        <div class="field"><label>Rating (1\u20135)</label><input id="rvRating" type="number" min="1" max="5" value="5"></div>
        <div class="field"><label>Review</label><textarea id="rvText"></textarea></div>
        <button class="btn btn-gold" id="rvAdd">Add review</button>
      </div>`;
    document.querySelectorAll('[data-toggle]').forEach(b => b.onclick = async () => { await api(`/api/admin/reviews/${b.dataset.toggle}`, { method: 'PATCH', body: JSON.stringify({ approved: b.dataset.app === '1' ? 0 : 1 }) }); renderReviews(); });
    document.querySelectorAll('[data-delrev]').forEach(b => b.onclick = async () => { if (confirm('Delete this review?')) { await api(`/api/admin/reviews/${b.dataset.delrev}`, { method: 'DELETE' }); renderReviews(); } });
    $('#rvAdd').onclick = async () => {
      const p = { name: $('#rvName').value.trim(), rating: Number($('#rvRating').value), text: $('#rvText').value.trim() };
      if (!p.name || !p.text) return alert('Name and review text are required.');
      await api('/api/admin/reviews', { method: 'POST', body: JSON.stringify(p) }); renderReviews();
    };
  }

  /* ---------- SETTINGS ---------- */
  async function renderSettings() {
    const s = await (await api('/api/admin/settings')).json();
    const f = (id, label, val, hint = '') => `<div class="field"><label>${label}</label><input id="${id}" value="${esc(val || '')}">${hint ? `<span class="muted" style="font-size:.76rem">${hint}</span>` : ''}</div>`;
    const ta = (id, label, val, hint) => `<div class="field"><label>${label}</label><textarea id="${id}" style="min-height:120px">${esc(val || '')}</textarea><span class="muted" style="font-size:.76rem">${hint}</span></div>`;
    panel().innerHTML = `
      <h3 style="font-size:1.2rem;margin-bottom:14px">Studio details</h3>
      <div class="card" style="margin-bottom:20px">
        ${f('set_business_name', 'Business name', s.business_name)}
        ${f('set_general_area', 'General area shown publicly', s.general_area, 'Neighbourhood only \u2014 never the exact address.')}
        ${f('set_whatsapp_number', 'WhatsApp number', s.whatsapp_number, 'Digits only with country code, e.g. 15550102030')}
        ${f('set_currency_symbol', 'Currency symbol', s.currency_symbol)}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          ${f('set_slot_interval_min', 'Slot interval (min)', s.slot_interval_min, 'Start times every N minutes')}
          ${f('set_booking_lead_min', 'Minimum notice (min)', s.booking_lead_min, 'Earliest bookable time from now')}
        </div>
      </div>
      <h3 style="font-size:1.2rem;margin-bottom:14px">Messages</h3>
      <div class="card" style="margin-bottom:20px">
        ${ta('set_confirmation_message', 'Booking confirmation', s.confirmation_message, 'Placeholders: {name} {business} {date} {time} {service} {location}')}
        ${ta('set_location_message', 'Location message', s.location_message, 'Sent as {location} inside the confirmation.')}
        ${ta('set_reminder_message', '30-day return reminder', s.reminder_message, 'Placeholders: {name} {business}')}
      </div>
      <div class="form-msg ok" id="setMsg"></div>
      <button class="btn btn-gold" id="setSave">Save settings</button>

      <h3 style="font-size:1.2rem;margin:34px 0 14px">Change password</h3>
      <div class="card">
        <div class="field"><label>Current password</label><input id="pwCur" type="password"></div>
        <div class="field"><label>New password</label><input id="pwNew" type="password"></div>
        <div class="form-msg" id="pwMsg"></div>
        <button class="btn btn-ghost" id="pwSave">Update password</button>
      </div>`;
    $('#setSave').onclick = async () => {
      const keys = ['business_name', 'general_area', 'whatsapp_number', 'currency_symbol', 'slot_interval_min', 'booking_lead_min', 'confirmation_message', 'location_message', 'reminder_message'];
      const body = {}; keys.forEach(k => body[k] = $('#set_' + k).value);
      await api('/api/admin/settings', { method: 'PATCH', body: JSON.stringify(body) });
      $('#setMsg').textContent = 'Saved.'; setTimeout(() => $('#setMsg').textContent = '', 2500);
    };
    $('#pwSave').onclick = async () => {
      const r = await fetch('/api/admin/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current: $('#pwCur').value, next: $('#pwNew').value }) });
      const d = await r.json(); const m = $('#pwMsg');
      m.className = 'form-msg ' + (r.ok ? 'ok' : 'err'); m.textContent = r.ok ? 'Password updated.' : d.error;
      if (r.ok) { $('#pwCur').value = ''; $('#pwNew').value = ''; }
    };
  }

  /* ---------- BOOT: check session ---------- */
  (async () => {
    try {
      const r = await fetch('/api/admin/me');
      if (r.ok) dashboard(); else showLogin();
    } catch { showLogin(); }
  })();
});