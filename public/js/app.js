/* ===================================================================
   NAVALHA & CO — shared site behaviour
   Injects nav, footer, floating buttons, concierge chat and the
   newsletter popup on every page so branding stays consistent.
   =================================================================== */
(function () {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $all = (s, el = document) => [...el.querySelectorAll(s)];
  const SITE = { name: 'Navalha & Co', area: '', whatsapp: '', currency: '$', locationMsg: '', pixelId: '' };

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
    const digitsOnly = (SITE.whatsapp || '').replace(/\D/g, '');
    const base = digitsOnly ? `https://wa.me/${digitsOnly}` : 'https://wa.me/';
    return base + '?text=' + encodeURIComponent(text || `Hi ${SITE.name}, I'd like to book an appointment.`);
  }

  function buildWidgets() {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <button class="float wa" id="waFloat" aria-label="Chat on WhatsApp" title="WhatsApp">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.1-.6.2-.2.3-.7.9-.8 1-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5 0-.2 0-.4 0-.5s-.6-1.5-.9-2c-.2-.5-.4-.5-.6-.5h-.5c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.3A10 10 0 1 0 12 2z"/></svg>
      </button>
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
    loadArcaWidget();
    initPopup();
  }

  /* ---------- ARCA CHATBOT WIDGET ---------- */
  function loadArcaWidget() {
    if (document.getElementById('arcaWidgetScript')) return;
    const s = document.createElement('script');
    s.id = 'arcaWidgetScript';
    s.src = 'https://arca-chatbot-production.up.railway.app/widget/widget.js';
    s.setAttribute('data-api-key', 'arcabot_live_400236004daa78e76b002604cf68718695a1018aa659e7e739618131563f6d63');
    document.body.appendChild(s);
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
      SITE.pixelId = s.facebook_pixel_id || '';
    } catch { /* offline: keep defaults */ }
  }

  // expose helpers for page scripts
  window.NA = {
    $, $all, SITE, waLink,
    money: (n) => SITE.currency + n,
    async services() { try { return await (await fetch('/api/services')).json(); } catch { return []; } },
    async reviews() { try { return await (await fetch('/api/reviews')).json(); } catch { return []; } },
    async gallery() { try { return await (await fetch('/api/gallery')).json(); } catch { return []; } },
    initFaq, trackPixelEvent, getSessionId: getOrCreateSessionId
  };

  /* ---------- Site analytics (first-party, anonymous) ---------- */
  function getOrCreateSessionId() {
    const match = document.cookie.match(/(?:^|; )na_sid=([^;]*)/);
    if (match) return decodeURIComponent(match[1]);
    const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    const expires = new Date(Date.now() + 30 * 60 * 1000).toUTCString(); // 30 min session
    document.cookie = `na_sid=${id};expires=${expires};path=/;SameSite=Lax`;
    return id;
  }

  function trackPageview() {
    const sessionId = getOrCreateSessionId();
    fetch('/api/track', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, page_url: location.href, referrer: document.referrer }),
      keepalive: true
    }).catch(() => {});
    return sessionId;
  }

  /* ---------- Facebook Pixel ---------- */
  // Loads Meta's base Pixel code and fires the standard PageView event
  // on every page, only if Eduardo has actually set a Pixel ID in
  // Settings — completely inert otherwise. trackPixelEvent() is exposed
  // on window.NA so other page scripts (like the booking flow) can fire
  // real conversion events, e.g. once a booking is actually confirmed.
  function initFacebookPixel() {
    if (!SITE.pixelId || window.fbq) return;
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments)
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
      n.queue = []; t = b.createElement(e); t.async = !0;
      t.src = v; s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s)
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', SITE.pixelId);
    fbq('track', 'PageView');
  }

  function trackPixelEvent(eventName, params) {
    if (window.fbq) fbq('track', eventName, params || {});
  }

  /* ---------- Scroll fade-in ---------- */
  // Auto-tags common content blocks with .fade-up across every page, so
  // no individual HTML file needs manual class edits. Respects
  // prefers-reduced-motion automatically via the CSS media query.
  function initScrollAnimations() {
    const targets = $all('.card, .frame, .band, .booking-wrap .step, main > section .lead');
    targets.forEach((el, i) => { el.classList.add('fade-up'); el.style.transitionDelay = Math.min(i % 6, 5) * 0.06 + 's'; });
    if (!('IntersectionObserver' in window)) { targets.forEach(el => el.classList.add('visible')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('visible'); io.unobserve(entry.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });
    targets.forEach(el => io.observe(el));
  }

  /* ---------- Structured data (LocalBusiness) ---------- */
  // Helps search engines understand this is a real local barber business —
  // uses the same live settings already fetched for the rest of the site.
  function injectStructuredData() {
    if (document.getElementById('na-ldjson')) return;
    const data = {
      '@context': 'https://schema.org',
      '@type': 'HairSalon',
      name: SITE.name || 'Navalha & Co',
      description: 'A private, appointment-only barber studio.',
      url: window.location.origin,
      image: window.location.origin + '/images/og-image.png',
      priceRange: '$$',
      areaServed: SITE.area || undefined,
      address: SITE.area ? { '@type': 'PostalAddress', addressLocality: SITE.area } : undefined
    };
    const script = document.createElement('script');
    script.id = 'na-ldjson';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
  }

  /* ---------- Boot ---------- */
  document.addEventListener('DOMContentLoaded', async () => {
    buildNav();
    await loadSettings();
    buildFooter();
    buildWidgets();
    initFacebookPixel();
    trackPageview();
    // wire any WhatsApp CTAs on the page
    $all('[data-wa]').forEach(el => el.addEventListener('click', e => {
      e.preventDefault(); window.open(waLink(el.dataset.wa || ''), '_blank');
    }));
    // fill area text placeholders
    $all('[data-area]').forEach(el => { if (SITE.area) el.textContent = SITE.area; });
    initScrollAnimations();
    injectStructuredData();
    document.dispatchEvent(new Event('na:ready'));
  });
})();