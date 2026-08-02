/* ===================================================================
   ARCA UNIVERSAL TRACKING SNIPPET
   Works on any website — WordPress, custom-built, anything with a
   <script> tag. Calls the exact same backend APIs the WordPress
   plugins use, so a custom site shows up in the ARCA dashboard and
   Client Portfolio view exactly like a WordPress client would.

   Usage:
   <script src="https://arca-chatbot-production.up.railway.app/arca-tracking.js"
           data-api-key="YOUR_CLIENT_API_KEY"></script>

   Automatic: fires a pageview on every page load, no extra code needed.

   Manual (call these from your own site's code, at the right moment):
     ARCA.trackLead({ name, email, phone, message })       — contact form submitted
     ARCA.trackConversion()                                 — a sale/booking/goal completed
     ARCA.trackSubscriber({ email, name, source })          — newsletter/signup form submitted
     ARCA.submitReview({ name, rating, text, product_name }) — a review was left (goes to pending, same as WordPress)
   =================================================================== */
(function () {
  'use strict';

  var scriptEl = document.currentScript;
  var API_KEY = scriptEl && scriptEl.getAttribute('data-api-key');
  var BASE_URL = 'https://arca-chatbot-production.up.railway.app';

  if (!API_KEY) {
    console.warn('ARCA tracking: no data-api-key set on the script tag — tracking disabled.');
    return;
  }

  function getOrCreateSessionId() {
    var match = document.cookie.match(/(?:^|; )arca_uid=([^;]*)/);
    if (match) return decodeURIComponent(match[1]);
    var id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    var expires = new Date(Date.now() + 30 * 60 * 1000).toUTCString(); // 30 min session, same as pageview-session convention
    document.cookie = 'arca_uid=' + encodeURIComponent(id) + ';expires=' + expires + ';path=/;SameSite=Lax';
    return id;
  }
  var sessionId = getOrCreateSessionId();

  function post(path, body) {
    return fetch(BASE_URL + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ api_key: API_KEY }, body)),
      keepalive: true
    }).then(function (r) { return r.json(); }).catch(function () { return { success: false, error: 'network error' }; });
  }

  // Automatic pageview — fires once per script load, same as every
  // other ARCA-connected site.
  post('/api/site-analytics/track', {
    session_id: sessionId, event_type: 'pageview',
    page_url: location.href, referrer: document.referrer
  });

  window.ARCA = {
    sessionId: sessionId,

    // A completed sale, booking, or any other goal — shows up as a
    // real conversion in Growth Scorecard's "Pull from ARCA Analytics".
    trackConversion: function () {
      return post('/api/site-analytics/track', {
        session_id: sessionId, event_type: 'conversion', page_url: location.href
      });
    },

    // A contact form (or similar) was submitted — triggers the same
    // instant email notification the Automation plugin sends.
    trackLead: function (data) {
      return post('/api/leads/capture', Object.assign({ source: 'contact_form' }, data || {}));
    },

    // A newsletter/signup form was submitted — adds a real subscriber,
    // manageable from the Email Marketing dashboard exactly like a
    // WordPress-captured one (sequences, tags, campaigns all work).
    trackSubscriber: function (data) {
      return post('/api/email-marketing/subscribe', Object.assign({ source: 'signup_form' }, data || {}));
    },

    // A review was left — starts pending, same protection as the
    // WordPress Reviews plugin, approved from the ARCA dashboard.
    submitReview: function (data) {
      return post('/api/reviews-plugin/submit', Object.assign({ source: 'general' }, data || {}));
    }
  };
})();
