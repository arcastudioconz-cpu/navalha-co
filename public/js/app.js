/* ===================================================================
   NAVALHA & CO — shared site behaviour
   Injects nav, footer, floating buttons, concierge chat and the
   newsletter popup on every page so branding stays consistent.
   =================================================================== */
(function () {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $all = (s, el = document) => [...el.querySelectorAll(s)];
  const SITE = { name: 'Navalha & Co', area: '', whatsapp: '', currency: '$', locationMsg: '' };

  const NAV_ITEMS = [
    ['index.html', 'Home'], ['about.html', 'About'], ['services.html', 'Services'],
    ['gallery.html', 'Gallery'], ['reviews.html', 'Reviews'],
    ['location.html', 'Location'], ['faq.html', 'FAQ']
  ];
  const current = () => {
    const p = location.pathname.split('/').pop();
    return p === '' ? 'index.html' : p;
  };

  /* ---------- NAV ---------- */
  function buildNav() {
    const here = current();
    const links = NAV_ITEMS.map(([href, label]) =>
      `<a href="${href}" class="${here === href ? 'active' : ''}">${label}</a>`).join('');
    const nav = document.createElement('header');
    nav.className = 'nav';
    nav.innerHTML = `
      <a class="brand" href="index.html">NAVALHA <b>&amp;</b> CO<small>APPOINTMENT-ONLY BARBER</small></a>
      <nav class="nav-links" id="navLinks" aria-label="Primary">
        ${links}
        <a class="btn btn-gold" href="booking.html">Book Appointment</a>
      </nav>
      <button class="burger" id="burger" aria-label="Toggle menu" aria-expanded="false"><span></span><span></span><span></span></button>`;
    document.body.prepend(nav);
    $('#burger').addEventListener('click', () => {
      const o = $('#navLinks').classList.toggle('open');
      $('#burger').setAttribute('aria-expanded', o);
    });
    window.addEventListener('scroll', () => nav.classList.toggle('scrolled', window.scrollY > 30));
  }

  /* ---------- FOOTER ---------- */
  function buildFooter() {
    const f = document.createElement('footer');
    f.className = 'site';
    f.innerHTML = `
      <div class="foot-inner">
        <div>
          <div class="brand">NAVALHA <b style="color:var(--gold)">&amp;</b> CO</div>
          <p>A private, appointment-only barber studio. Precision cuts, beard work and grooming \u2014 built around your personal style.</p>
        </div>
        <div class="foot-col"><h4>Explore</h4>
          <a href="about.html">About</a><a href="services.html">Services</a>
          <a href="gallery.html">Gallery</a><a href="reviews.html">Reviews</a><a href="faq.html">FAQ</a></div>
        <div class="foot-col"><h4>Visit</h4>
          <a href="booking.html">Book appointment</a><a href="location.html">Location</a>
          <a href="contact.html">Contact</a><a href="admin.html" style="color:#6a6a6a">Owner login</a></div>
      </div>
      <div class="foot-bottom">
        <span>&copy; ${new Date().getFullYear()} Navalha &amp; Co. All rights reserved.</span>
        <span class="arca">Website designed &amp; developed by <a href="https://arca-chatbot-production.up.railway.app/site/" target="_blank" rel="noopener"><b>ARCA Studio</b></a></span>
      </div>`;
    document.body.appendChild(f);
  }

  /* ---------- FLOATING BUTTONS + CHAT + POPUP ---------- */
  function waLink(text) {
    const base = SITE.whatsapp ? `https://wa.me/${SITE.whatsapp}` : 'https://wa.me/';
    return base + '?text=' + encodeURIComponent(text || `Hi ${SITE.name}, I'd like to book an appointment.`);
  }

  function buildWidgets() {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <button class="float wa" id="waFloat" aria-label="Chat on WhatsApp" title="WhatsApp">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.1-.6.2-.2.3-.7.9-.8 1-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5 0-.2 0-.4 0-.5s-.6-1.5-.9-2c-.2-.5-.4-.5-.6-.5h-.5c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.3A10 10 0 1 0 12 2z"/></svg>
      </button>
      <button class="float chat" id="chatFloat" aria-label="Open concierge chat" title="Concierge">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3C6.5 3 2 6.8 2 11.5c0 2.3 1.1 4.4 2.9 5.9-.1 1-.5 2.3-1.3 3.4 1.6-.3 3-.9 4-1.6 1.3.5 2.8.8 4.4.8 5.5 0 10-3.8 10-8.5S17.5 3 12 3z"/></svg>
      </button>
      <div class="chat-panel" id="chatPanel" role="dialog" aria-label="Concierge chat">
        <div class="chat-head"><span class="dot"></span>
          <div><b>Navalha Concierge</b><small>Usually replies instantly</small></div>
          <button class="x" id="chatClose" aria-label="Close chat">&times;</button></div>
        <div class="chat-body" id="chatBody"></div>
        <div class="chat-quick" id="chatQuick"></div>
        <div style="text-align:center;padding:6px 0;font-size:.66rem;letter-spacing:.08em;color:var(--muted);border-top:1px solid var(--card-line)">Powered by <a href="https://arca-chatbot-production.up.railway.app/site/" target="_blank" rel="noopener" style="color:var(--gold-light)">ARCA Studio</a></div>
        <form class="chat-input" id="chatForm">
          <input id="chatInput" placeholder="Ask about booking, services\u2026" autocomplete="off" />
          <button type="submit" aria-label="Send">&rarr;</button></form>
      </div>
      <div class="overlay" id="popup" role="dialog" aria-label="Newsletter signup" aria-modal="true">
        <div class="popup">
          <button class="close" id="popupClose" aria-label="Close">&times;</button>
          <div id="popupForm">
            <span class="eyebrow">Navalha &amp; Co Community</span>
            <h3>Stay Sharp with Navalha &amp; Co</h3>
            <p class="sub">Join our community for exclusive grooming tips, special offers, appointment reminders, and updates on new services.</p>
            <div class="field"><label>Full name *</label><input id="nlName" type="text" placeholder="Your full name" /></div>
            <div class="field"><label>Email address *</label><input id="nlEmail" type="email" placeholder="you@email.com" /></div>
            <div class="field"><label>Phone number (optional)</label><input id="nlPhone" type="tel" placeholder="Optional" /></div>
            <div class="form-msg err" id="nlMsg"></div>
            <button class="btn btn-gold" id="nlSubmit" style="width:100%">Join the Community</button>
          </div>
          <div class="popup-success" id="popupSuccess" style="display:none">
            <div class="tick">&check;</div>
            <h3>Welcome aboard.</h3>
            <p class="sub" style="margin-top:10px">Thank you for joining the Navalha &amp; Co community. We'll keep you updated with exclusive offers, grooming advice, and news.</p>
          </div>
          <div style="text-align:center;margin-top:18px;padding-top:14px;border-top:1px solid var(--card-line);font-size:.66rem;letter-spacing:.08em;color:var(--muted)">Powered by <a href="https://arca-chatbot-production.up.railway.app/site/" target="_blank" rel="noopener" style="color:var(--gold-light)">ARCA Studio</a></div>
        </div>
      </div>`;
    document.body.appendChild(wrap);

    $('#waFloat').addEventListener('click', () => window.open(waLink(), '_blank'));
    initChat();
    initPopup();
  }

  /* ---------- CONCIERGE CHAT (state persists across pages via sessionStorage) ---------- */
  function initChat() {
    const panel = $('#chatPanel'), body = $('#chatBody');
    const KEY = 'na_chat';
    const load = () => { try { return JSON.parse(sessionStorage.getItem(KEY)) || []; } catch { return []; } };
    const save = (m) => sessionStorage.setItem(KEY, JSON.stringify(m));
    let messages = load();

    function paint() {
      body.innerHTML = '';
      messages.forEach(m => addBubble(m.text, m.who, false));
      body.scrollTop = body.scrollHeight;
    }
    function addBubble(text, who) {
      const el = document.createElement('div');
      el.className = 'msg ' + who; el.textContent = text;
      body.appendChild(el); body.scrollTop = body.scrollHeight;
    }
    function push(text, who) { messages.push({ text, who }); save(messages); addBubble(text, who); }
    function quick(items) {
      const q = $('#chatQuick'); q.innerHTML = '';
      items.forEach(t => { const b = document.createElement('button'); b.textContent = t; b.onclick = () => handle(t); q.appendChild(b); });
    }
    function typing() {
      const el = document.createElement('div'); el.className = 'msg bot';
      el.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
      body.appendChild(el); body.scrollTop = body.scrollHeight; return el;
    }
    function reply(text, q) {
      const t = typing();
      setTimeout(() => { t.remove(); push(text, 'bot'); if (q) quick(q); }, 700 + Math.random() * 500);
    }
    function open() {
      panel.classList.add('open');
      if (messages.length === 0) {
        push('Welcome to Navalha & Co \u2014 I\u2019m the studio concierge. I can help with services, prices, booking, or how the private location works. What can I help you with?', 'bot');
      }
      quick(['Book an appointment', 'Services & prices', 'Where are you located?', 'How long does a cut take?']);
    }
    function handle(text) {
      push(text, 'me'); $('#chatQuick').innerHTML = '';
      const r = concierge(text.toLowerCase());
      reply(r.text, r.quick);
      if (r.nav) setTimeout(() => { location.href = r.nav; }, 1400);
    }

    $('#chatFloat').addEventListener('click', () => panel.classList.contains('open') ? panel.classList.remove('open') : open());
    $('#chatClose').addEventListener('click', () => panel.classList.remove('open'));
    $('#chatForm').addEventListener('submit', e => {
      e.preventDefault(); const v = $('#chatInput').value.trim(); if (!v) return;
      $('#chatInput').value = ''; handle(v);
    });
    paint();

    function concierge(q) {
      const has = (...w) => w.some(x => q.includes(x));
      const c = SITE.currency;
      if (has('book', 'appointment', 'reserve', 'booking')) return { text: 'Booking takes about a minute \u2014 your details, service, the look you want, then a date and time Eduardo has open. Taking you to the booking page now.', nav: 'booking.html' };
      if (has('price', 'cost', 'how much')) return { text: `Haircut ${c}35 (60 min), Beard ${c}22 (30 min), Haircut + Beard ${c}50 (90 min), Eyebrow ${c}12 (15 min). Want to book one?`, quick: ['Book an appointment', 'See full menu'] };
      if (has('service', 'offer', 'cut', 'beard', 'eyebrow')) return { text: 'Eduardo offers haircuts, beard shaping, the haircut + beard combo, and eyebrow tidying \u2014 each with a consultation and hot-towel finish.', quick: ['Book an appointment', 'Prices'] };
      if (has('where', 'location', 'address', 'located', 'find you')) return { text: `The studio is private and appointment-only${SITE.area ? ', in the ' + SITE.area : ''}. For privacy the exact address isn\u2019t published \u2014 you\u2019ll receive it over WhatsApp once your booking is confirmed.`, quick: ['Book an appointment'] };
      if (has('how long', 'duration', 'take', 'minutes')) return { text: 'A haircut is about 60 minutes, a beard 30, and the combo 90. The calendar reserves the right amount of time automatically.', quick: ['Book an appointment'] };
      if (has('walk', 'drop in', 'without appointment')) return { text: 'No walk-ins \u2014 it\u2019s a one-chair, one-on-one studio, so every visit is booked in advance. That keeps your appointment private and unhurried.', quick: ['Book an appointment'] };
      if (has('cancel', 'reschedule', 'change')) return { text: 'Just message on WhatsApp from your confirmation thread to reschedule \u2014 the earlier the better so the slot can reopen for someone else.', quick: ['Book an appointment'] };
      if (has('hi', 'hello', 'hey', 'yo ')) return { text: 'Hey! Welcome to Navalha & Co. I can help with services, prices, or getting you booked in.', quick: ['Book an appointment', 'Services & prices'] };
      if (has('thank')) return { text: 'Any time. Ready to grab a chair?', quick: ['Book an appointment'] };
      return { text: 'I can help with services, prices, booking, timing, or how the private location works \u2014 which would you like?', quick: ['Services & prices', 'Book an appointment', 'Where are you?'] };
    }
  }

  /* ---------- NEWSLETTER POPUP ---------- */
  function initPopup() {
    const overlay = $('#popup');
    const shown = sessionStorage.getItem('na_popup_shown');
    const subscribed = localStorage.getItem('na_subscribed');
    const onBooking = current() === 'booking.html';
    if (!shown && !subscribed && !onBooking) {
      setTimeout(() => { overlay.classList.add('open'); sessionStorage.setItem('na_popup_shown', '1'); }, 5000);
    }
    $('#popupClose').addEventListener('click', () => overlay.classList.remove('open'));
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });

    $('#nlSubmit').addEventListener('click', async () => {
      const msg = $('#nlMsg'); msg.textContent = '';
      const payload = {
        full_name: $('#nlName').value.trim(),
        email: $('#nlEmail').value.trim(),
        phone: $('#nlPhone').value.trim(),
        source: 'popup'
      };
      try {
        const r = await fetch('/api/newsletter', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const data = await r.json();
        if (!r.ok) { msg.textContent = data.error || 'Something went wrong.'; return; }
        localStorage.setItem('na_subscribed', '1');
        $('#popupForm').style.display = 'none';
        $('#popupSuccess').style.display = 'block';
        setTimeout(() => overlay.classList.remove('open'), 3200);
      } catch { msg.textContent = 'Network error. Please try again.'; }
    });
  }

  /* ---------- FAQ accordion (if present) ---------- */
  function initFaq() {
    $all('[data-faq]').forEach(b => b.addEventListener('click', () => {
      const open = b.getAttribute('aria-expanded') === 'true';
      b.setAttribute('aria-expanded', !open);
      const a = b.nextElementSibling;
      a.style.maxHeight = open ? null : a.scrollHeight + 'px';
    }));
  }

  /* ---------- Public settings + shared renderers ---------- */
  async function loadSettings() {
    try {
      const s = await (await fetch('/api/public/settings')).json();
      SITE.name = s.business_name || SITE.name;
      SITE.area = s.general_area || '';
      SITE.whatsapp = s.whatsapp_number || '';
      SITE.currency = s.currency_symbol || '$';
      SITE.locationMsg = s.location_message || '';
    } catch { /* offline: keep defaults */ }
  }

  // expose helpers for page scripts
  window.NA = {
    $, $all, SITE, waLink,
    money: (n) => SITE.currency + n,
    async services() { try { return await (await fetch('/api/services')).json(); } catch { return []; } },
    async reviews() { try { return await (await fetch('/api/reviews')).json(); } catch { return []; } },
    async gallery() { try { return await (await fetch('/api/gallery')).json(); } catch { return []; } },
    initFaq
  };

  /* ---------- Boot ---------- */
  document.addEventListener('DOMContentLoaded', async () => {
    buildNav();
    await loadSettings();
    buildFooter();
    buildWidgets();
    // wire any WhatsApp CTAs on the page
    $all('[data-wa]').forEach(el => el.addEventListener('click', e => {
      e.preventDefault(); window.open(waLink(el.dataset.wa || ''), '_blank');
    }));
    // fill area text placeholders
    $all('[data-area]').forEach(el => { if (SITE.area) el.textContent = SITE.area; });
    document.dispatchEvent(new Event('na:ready'));
  });
})();
