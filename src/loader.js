/**
 * Vexel Scaled Loader v3
 * Client-side license validation + section rendering engine.
 * Reads shell sections from DOM, validates license, renders all HTML client-side.
 */
(function() {
  'use strict';

  var config = window.VexelConfig || {};
  var apiUrl = config.apiUrl || '';
  var licenseKey = config.licenseKey || '';
  var shopDomain = config.shopDomain || window.location.hostname;
  var permanentDomain = config.permanentDomain || (window.Shopify && window.Shopify.shop ? window.Shopify.shop : '');
  var colors = config.colors || {};
  var brandName = config.brandName || '';
  var logoUrl = config.logoUrl || null;

  // ─── CSS Variables Helper ──────────────────────────────────────
  function cv(name) { return 'var(--' + name + ')'; }

  // ─── Escape HTML ───────────────────────────────────────────────
  function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ─── Format Money ──────────────────────────────────────────────
  function formatMoney(cents) {
    return '$' + (cents / 100).toFixed(2);
  }

  // ─── Hide Loader ───────────────────────────────────────────────
  var loaderHidden = false;
  function hideLoader() {
    if (loaderHidden) return;
    loaderHidden = true;
    document.body.classList.remove('is-loading');
    var loader = document.getElementById('vx-loader');
    if (loader) {
      loader.classList.add('is-hidden');
      setTimeout(function() { loader.remove(); }, 500);
    }
  }

  // ─── Cart API ──────────────────────────────────────────────────
  window.VexelCart = {
    get: function() { return fetch('/cart.js').then(function(r) { return r.json(); }); },
    add: function(id, qty) {
      return fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ id: id, quantity: qty || 1 }] })
      }).then(function(r) { return r.json(); }).then(function(data) {
        document.dispatchEvent(new CustomEvent('cart:refresh'));
        return data;
      });
    },
    update: function(updates) {
      return fetch('/cart/update.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: updates })
      }).then(function(r) { return r.json(); }).then(function(data) {
        document.dispatchEvent(new CustomEvent('cart:refresh'));
        return data;
      });
    }
  };

  // ─── No License Key — Show Setup Page ──────────────────────────
  if (!licenseKey || licenseKey.trim() === '') {
    document.addEventListener('DOMContentLoaded', function() {
      hideLoader();
      showSetupPage();
    });
    return;
  }

  // ─── Shopify Editor Bypass ─────────────────────────────────────
  var isEditor = window.Shopify && window.Shopify.designMode;

  // ─── SessionStorage Cache ──────────────────────────────────────
  var CACHE_KEY = 'vx_license';
  var CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  function getCachedResult() {
    try {
      var raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var cached = JSON.parse(raw);
      if (Date.now() > cached.expiresAt) {
        sessionStorage.removeItem(CACHE_KEY);
        return null;
      }
      return cached;
    } catch(e) { return null; }
  }

  function setCachedResult(status, plan) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        status: status,
        plan: plan,
        expiresAt: Date.now() + CACHE_TTL
      }));
    } catch(e) {}
  }

  // ─── Setup Page (No License) ──────────────────────────────────
  function showSetupPage() {
    document.querySelectorAll('[data-vx-section]').forEach(function(el) {
      el.style.display = 'none';
    });
    document.body.innerHTML =
      '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#000;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;padding:20px">' +
      '<div style="max-width:460px;width:100%;text-align:center">' +
        '<div style="width:72px;height:72px;margin:0 auto 24px;border-radius:50%;background:rgba(59,130,246,0.1);display:flex;align-items:center;justify-content:center">' +
          '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
        '</div>' +
        '<h1 style="color:#fff;font-size:24px;font-weight:700;margin-bottom:8px;letter-spacing:-0.5px">Theme Setup Required</h1>' +
        '<p style="color:#9ca3af;font-size:15px;line-height:1.6;margin-bottom:32px">Enter your license key to activate this theme and unlock all features.</p>' +
        '<div style="background:#111;border:1px solid #222;border-radius:12px;padding:24px;text-align:left;margin-bottom:24px">' +
          '<div style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid #1a1a1a">' +
            '<div style="flex-shrink:0;width:28px;height:28px;border-radius:50%;background:rgba(25,212,0,0.1);color:#19d400;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center">1</div>' +
            '<div><div style="color:#fff;font-size:14px;font-weight:600;margin-bottom:2px">Open Theme Settings</div><div style="color:#6b7280;font-size:13px">Click the gear icon in the theme editor sidebar</div></div>' +
          '</div>' +
          '<div style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid #1a1a1a">' +
            '<div style="flex-shrink:0;width:28px;height:28px;border-radius:50%;background:rgba(25,212,0,0.1);color:#19d400;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center">2</div>' +
            '<div><div style="color:#fff;font-size:14px;font-weight:600;margin-bottom:2px">Go to License &amp; Protection</div><div style="color:#6b7280;font-size:13px">Scroll down to find the License section</div></div>' +
          '</div>' +
          '<div style="display:flex;align-items:flex-start;gap:12px;padding:10px 0">' +
            '<div style="flex-shrink:0;width:28px;height:28px;border-radius:50%;background:rgba(25,212,0,0.1);color:#19d400;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center">3</div>' +
            '<div><div style="color:#fff;font-size:14px;font-weight:600;margin-bottom:2px">Enter Your License Key</div><div style="color:#6b7280;font-size:13px">Paste your XXXX-XXXX-XXXX-XXXX key, then click Save</div></div>' +
          '</div>' +
        '</div>' +
        '<div style="background:#0a0f1a;border:1px solid rgba(59,130,246,0.2);border-radius:8px;padding:14px 18px;display:flex;align-items:center;gap:10px">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>' +
          '<span style="color:#93c5fd;font-size:13px">Don\'t have a license? <a href="https://vexelthemes.com" target="_blank" style="color:#fff;font-weight:600;text-decoration:underline">Purchase here</a></span>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // ─── Invalid License Page ─────────────────────────────────────
  function showInvalidLicense(reason) {
    var messages = {
      'invalid_key': 'This license key is not valid or has been deactivated.',
      'expired': 'This license has expired. Please renew to continue.',
      'domain_mismatch': 'This license is registered to a different store.',
      'rate_limited': 'Too many requests. Please try again in a minute.'
    };
    var message = messages[reason] || 'This theme license is not valid.';

    document.body.innerHTML =
      '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#000;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;padding:20px">' +
      '<div style="max-width:420px;width:100%;text-align:center">' +
        '<div style="width:72px;height:72px;margin:0 auto 24px;border-radius:50%;background:rgba(239,68,68,0.1);display:flex;align-items:center;justify-content:center">' +
          '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>' +
        '</div>' +
        '<h1 style="color:#fff;font-size:24px;font-weight:700;margin-bottom:8px;letter-spacing:-0.5px">License Invalid</h1>' +
        '<p style="color:#9ca3af;font-size:15px;line-height:1.6;margin-bottom:24px">' + esc(message) + '</p>' +
        '<a href="https://vexelthemes.com" target="_blank" style="display:inline-flex;align-items:center;gap:8px;padding:14px 32px;border-radius:50px;background:#19d400;color:#000;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.03em;text-decoration:none;transition:transform 0.2s">Get Your License Now</a>' +
        '<div style="margin-top:20px;background:#110a0a;border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:14px 18px;display:flex;align-items:center;gap:10px">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' +
          '<span style="color:#fca5a5;font-size:13px">Check your license key in Theme Settings &gt; License</span>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION RENDERERS
  // ═══════════════════════════════════════════════════════════════

  // ─── SVG Icon Helper ───────────────────────────────────────────
  var icons = {
    star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    headset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    starFilled: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>',
    cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#0a0a0a"/></svg>',
    discord: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>'
  };

  function getIcon(name) { return icons[name] || icons.star; }

  // ─── 1. Urgency Bar ────────────────────────────────────────────
  function renderUrgencyBar(s) {
    var accent = s.accent_color || '#19d400';
    var bgColor = s.bg_color || '#000000';
    var textColor = s.text_color || '#ffffff';
    var iconColor = s.icon_color || accent;
    var dotColor = s.dot_color || '#39ff14';
    var dividerColor = s.divider_color || '#333';
    var borderColor = s.border_color || '#1a1a1a';
    var speed = s.scroll_speed || 30;
    var barHeight = s.bar_height || 36;
    var fontSize = s.font_size || 13;
    var reveal = s.reveal_on_scroll;
    var revealDist = s.reveal_distance || 80;
    var minV = s.min_viewers || 10;
    var maxV = s.max_viewers || 100;

    var items = '';
    function addItem(html) {
      items += '<span class="vx-urgency-item">' + html + '</span><span class="vx-urgency-divider"></span>';
    }

    if (s.show_countdown) {
      addItem('<span class="vx-urgency-icon">' + icons.clock + '</span>' + esc(s.countdown_prefix || 'Price goes up in') + ' <span class="accent" id="vx-countdown">0m 00s</span>');
    }
    if (s.show_rating) {
      addItem('<span class="vx-urgency-icon vx-urgency-icon--filled">' + icons.starFilled + '</span>Rated <span class="accent">' + esc(s.rating_value || '4.96/5') + '</span> by <span class="accent">' + esc(s.rating_count || '2,400+') + '</span> resellers');
    }
    if (s.show_viewers) {
      addItem('<span class="vx-urgency-dot"></span><span class="accent" id="vx-viewers">' + minV + '</span> ' + esc(s.viewers_text || 'people viewing right now'));
    }
    if (s.show_private) {
      addItem('<span class="vx-urgency-icon">' + icons.lock + '</span>' + esc(s.private_text || 'Private suppliers not found anywhere else'));
    }
    if (s.show_personally_verified) {
      addItem('<span class="vx-urgency-icon">' + icons.check + '</span>' + esc(s.personally_verified_text || 'All suppliers personally verified'));
    }
    if (s.blocks) {
      s.blocks.forEach(function(b) {
        if (b.type === 'custom_item' && b.settings && b.settings.text) {
          addItem(esc(b.settings.text));
        }
      });
    }

    var track = '<div class="vx-urgency-track">' + items + items + '</div>';

    var css = '<style>' +
      '.vx-urgency-wrap{position:fixed;top:0;left:0;right:0;z-index:1000;transition:transform 0.4s cubic-bezier(0.16,1,0.3,1);}' +
      (reveal ? '.vx-urgency-wrap{transform:translateY(-100%)}.vx-urgency-wrap.is-visible{transform:translateY(0)}' : '') +
      '.vx-urgency-bar{background:' + bgColor + ';color:' + textColor + ';height:' + barHeight + 'px;overflow:hidden;position:relative;border-bottom:1px solid ' + borderColor + '}' +
      '.vx-urgency-bar:hover .vx-urgency-track{animation-play-state:paused}' +
      '.vx-urgency-track{display:flex;align-items:center;height:100%;white-space:nowrap;animation:vxUrgScroll ' + speed + 's linear infinite;width:max-content}' +
      '.vx-urgency-item{display:inline-flex;align-items:center;gap:6px;padding:0 24px;font-size:' + fontSize + 'px;font-weight:500;letter-spacing:0.02em}' +
      '.vx-urgency-item .accent{color:' + accent + ';font-weight:700}' +
      '.vx-urgency-icon{display:inline-flex;align-items:center;flex-shrink:0}.vx-urgency-icon svg{width:14px;height:14px;stroke:' + iconColor + ';fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}' +
      '.vx-urgency-icon--filled svg{fill:' + iconColor + ';stroke:' + iconColor + '}' +
      '.vx-urgency-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:' + dotColor + ';animation:vxPulseDot 1.5s ease-in-out infinite}' +
      '.vx-urgency-divider{display:inline-block;width:4px;height:4px;border-radius:50%;background:' + dividerColor + ';margin:0 4px;flex-shrink:0}' +
      '@keyframes vxUrgScroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}' +
      '@keyframes vxPulseDot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(1.4)}}' +
      '</style>';

    return css + '<div class="vx-urgency-wrap" id="vx-urgency-wrap" data-reveal="' + (reveal ? 'true' : 'false') + '" data-reveal-distance="' + revealDist + '">' +
      '<div class="vx-urgency-bar" role="marquee">' + track + '</div></div>';
  }

  function attachUrgencyBar(s) {
    var minV = s.min_viewers || 10;
    var maxV = s.max_viewers || 100;
    var wrap = document.getElementById('vx-urgency-wrap');

    // Reveal on scroll
    if (wrap && wrap.dataset.reveal === 'true') {
      var dist = parseInt(wrap.dataset.revealDistance, 10) || 80;
      var shown = false;
      function checkScroll() {
        var y = window.pageYOffset || document.documentElement.scrollTop;
        if (y >= dist && !shown) { wrap.classList.add('is-visible'); shown = true; }
        else if (y < dist && shown) { wrap.classList.remove('is-visible'); shown = false; }
        document.documentElement.style.setProperty('--urgency-bar-height', shown ? wrap.offsetHeight + 'px' : '0px');
      }
      window.addEventListener('scroll', checkScroll, { passive: true });
      checkScroll();
    } else if (wrap) {
      document.documentElement.style.setProperty('--urgency-bar-height', wrap.offsetHeight + 'px');
    }

    // Countdown
    function updateCountdown() {
      var now = new Date();
      var next = new Date(now); next.setMinutes(60, 0, 0);
      var diff = next - now;
      var m = Math.floor(diff / 60000);
      var sec = Math.floor((diff % 60000) / 1000);
      var str = m + 'm ' + String(sec).padStart(2, '0') + 's';
      var el = document.getElementById('vx-countdown');
      if (el) el.textContent = str;
    }
    if (document.getElementById('vx-countdown')) {
      updateCountdown();
      setInterval(updateCountdown, 1000);
    }

    // Viewer count drift
    var viewers = Math.floor(Math.random() * (maxV - minV + 1)) + minV;
    var viewerEl = document.getElementById('vx-viewers');
    if (viewerEl) {
      viewerEl.textContent = viewers;
      function driftViewers() {
        var change = Math.floor(Math.random() * 4) - 1;
        if (Math.random() < 0.3) change = -Math.abs(change);
        viewers = Math.max(minV, Math.min(maxV, viewers + change));
        if (viewerEl) viewerEl.textContent = viewers;
        setTimeout(driftViewers, (60 + Math.floor(Math.random() * 120)) * 1000);
      }
      setTimeout(driftViewers, (60 + Math.floor(Math.random() * 120)) * 1000);
    }
  }

  // ─── 2. Header ─────────────────────────────────────────────────
  function renderHeader(s) {
    var navColor = s.nav_color || '#ffffff';
    var navHover = s.nav_hover_color || '#19d400';
    var brandColor = s.brand_color || '#ffffff';
    var bText = s.brand_text || brandName || 'Vexel';
    var hDesk = s.header_height_desktop || 70;
    var hMob = s.header_height_mobile || 58;
    var lwDesk = s.logo_width_desktop || 200;
    var lwMob = s.logo_width_mobile || 120;
    var badgeBg = s.badge_bg || '#19d400';
    var badgeTextColor = s.badge_text_color || '#000000';
    var dropdownBg = s.dropdown_bg || '#0a0a0a';
    var scrollBg = s.scroll_bg || 'rgba(0,0,0,0.85)';
    var scrollBorder = s.scroll_border || '#1a1a1a';
    var headerLogo = s.logo_url || logoUrl;
    var navLinks = s.nav_links || [];

    var navHtml = '';
    var mobileNavHtml = '';
    if (navLinks.length) {
      navLinks.forEach(function(link) {
        navHtml += '<a href="' + esc(link.url) + '">' + esc(link.title) + '</a>';
        mobileNavHtml += '<a href="' + esc(link.url) + '">' + esc(link.title) + '</a>';
      });
    } else {
      navHtml = '<a href="/">Home</a><a href="/collections/all">Products</a>';
      mobileNavHtml = '<a href="/">Home</a><a href="/collections/all">Products</a>';
    }

    var logoHtml = headerLogo
      ? '<div class="vx-header__logo"><img src="' + esc(headerLogo) + '" alt="' + esc(bText) + '" width="' + lwDesk + '" loading="eager"></div>'
      : '<span class="vx-header__brand">' + esc(bText) + '</span>';

    var css = '<style>' +
      '.vx-header{position:fixed;left:0;right:0;top:var(--urgency-bar-height,0px);z-index:999;background:linear-gradient(180deg,rgba(10,10,10,0.95) 0%,rgba(0,0,0,0.85) 100%);border-bottom:1px solid rgba(255,255,255,0.06);transition:background 0.3s ease,border-color 0.3s ease,top 0.4s cubic-bezier(0.16,1,0.3,1)}' +
      '.vx-header.scrolled{background:' + scrollBg + ';border-bottom-color:' + scrollBorder + ';backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}' +
      '.vx-header__inner{display:flex;align-items:center;justify-content:space-between;max-width:1400px;margin:0 auto;padding:0 32px;height:' + hDesk + 'px}' +
      '.vx-header__logo-link{display:flex;align-items:center;flex-shrink:0}' +
      '.vx-header__logo img{width:' + lwDesk + 'px;height:auto;display:block}' +
      '.vx-header__brand{font-family:' + cv('font-heading') + ';font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:0.08em;color:' + brandColor + '}' +
      '.vx-header__right{display:flex;align-items:center;gap:32px}' +
      '.vx-header__nav{display:flex;align-items:center;gap:32px}' +
      '.vx-header__nav a{font-family:' + cv('font-body') + ';font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:' + navColor + ';transition:color 0.2s;text-decoration:none}' +
      '.vx-header__nav a:hover{color:' + navHover + '}' +
      '.vx-header__cart{position:relative;display:flex;align-items:center;justify-content:center;width:38px;height:38px;color:' + navColor + ';transition:color 0.2s;text-decoration:none}' +
      '.vx-header__cart:hover{color:' + navHover + '}.vx-header__cart svg{width:20px;height:20px}' +
      '.vx-cart-badge{position:absolute;top:1px;right:1px;background:' + badgeBg + ';color:' + badgeTextColor + ';font-size:10px;font-weight:800;min-width:16px;height:16px;border-radius:8px;display:none;align-items:center;justify-content:center;padding:0 3px}' +
      '.vx-cart-badge.has-items{display:flex}' +
      '.vx-hamburger{display:none;flex-direction:column;gap:5px;cursor:pointer;padding:4px;color:' + navColor + ';background:none;border:none}' +
      '.vx-hamburger span{display:block;width:22px;height:2px;background:currentColor;border-radius:2px;transition:transform 0.3s,opacity 0.3s}' +
      '.vx-hamburger.open span:nth-child(1){transform:translateY(7px) rotate(45deg)}.vx-hamburger.open span:nth-child(2){opacity:0}.vx-hamburger.open span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}' +
      '.vx-mobile-nav{display:none;position:absolute;top:100%;left:0;right:0;background:' + dropdownBg + ';border-bottom:1px solid ' + scrollBorder + ';z-index:998;padding:8px 0;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}' +
      '.vx-mobile-nav.open{display:block}' +
      '.vx-mobile-nav a{display:block;padding:14px 32px;font-family:' + cv('font-body') + ';font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:' + navColor + ';border-bottom:1px solid ' + scrollBorder + ';transition:color 0.2s;text-decoration:none}' +
      '.vx-mobile-nav a:last-child{border-bottom:none}.vx-mobile-nav a:hover{color:' + navHover + '}' +
      '@media(max-width:768px){.vx-header__inner{height:' + hMob + 'px;padding:0 16px}.vx-header__logo img{width:' + lwMob + 'px}.vx-header__nav{display:none}.vx-hamburger{display:flex}}' +
      '</style>';

    return css +
      '<header class="vx-header" id="vx-header">' +
      '<div class="vx-header__inner">' +
        '<a href="/" class="vx-header__logo-link" aria-label="Home">' + logoHtml + '</a>' +
        '<div class="vx-header__right">' +
          '<nav class="vx-header__nav" aria-label="Main navigation">' + navHtml + '</nav>' +
          '<a href="/cart" class="vx-header__cart" aria-label="Cart">' + icons.cart + '<span class="vx-cart-badge" id="vx-cart-badge"></span></a>' +
          '<button class="vx-hamburger" id="vx-hamburger" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>' +
        '</div>' +
      '</div>' +
      '<div class="vx-mobile-nav" id="vx-mobile-nav">' + mobileNavHtml + '</div>' +
      '</header>';
  }

  function attachHeader() {
    var toggle = document.getElementById('vx-hamburger');
    var menu = document.getElementById('vx-mobile-nav');
    var header = document.getElementById('vx-header');

    if (toggle && menu) {
      toggle.addEventListener('click', function() {
        var open = menu.classList.toggle('open');
        toggle.classList.toggle('open', open);
        toggle.setAttribute('aria-expanded', open);
      });
      document.addEventListener('click', function(e) {
        if (!e.target.closest('#vx-header')) {
          menu.classList.remove('open');
          toggle.classList.remove('open');
          toggle.setAttribute('aria-expanded', 'false');
        }
      });
    }

    if (header) {
      var ticking = false;
      window.addEventListener('scroll', function() {
        if (!ticking) {
          window.requestAnimationFrame(function() {
            header.classList.toggle('scrolled', window.scrollY > 50);
            ticking = false;
          });
          ticking = true;
        }
      });
    }

    // Cart count
    fetch('/cart.js').then(function(r) { return r.json(); }).then(function(c) {
      var badge = document.getElementById('vx-cart-badge');
      if (badge && c.item_count > 0) {
        badge.textContent = c.item_count;
        badge.classList.add('has-items');
      }
    }).catch(function() {});

    // Hook cart link to open drawer
    document.addEventListener('click', function(e) {
      var cartLink = e.target.closest('.vx-header__cart');
      if (cartLink && window.CartDrawer) {
        e.preventDefault();
        window.CartDrawer.open();
      }
    });
  }

  // ─── 3. Hero ───────────────────────────────────────────────────
  function renderHero(s) {
    var titleBefore = s.title_before || 'START YOUR';
    var titleHighlight = s.title_highlight || 'RESELLING';
    var titleAfter = s.title_after || 'JOURNEY TODAY';
    var highlightColor = s.highlight_color || '#39ff14';
    var titleColor = s.title_color || '#ffffff';
    var titleSizeDesktop = s.title_size_desktop || 48;
    var titleSizeMobile = s.title_size_mobile || 28;
    var trustPrefix = s.trust_prefix || 'Trusted By';
    var trustCount = s.trust_count || '10,000+';
    var trustSuffix = s.trust_suffix || 'Resellers';
    var trustCountColor = s.trust_count_color || '#fbbf24';
    var trustTextColor = s.trust_text_color || '#9ca3af';
    var showAvatars = s.show_avatars !== false;
    var showGlow = s.show_glow !== false;
    var glowColor = s.glow_color || '#39ff14';
    var paddingTop = s.padding_top || 80;
    var paddingBottom = s.padding_bottom || 60;
    var avatarSize = s.avatar_size || 36;
    var heroFont = s.hero_font || 'Satoshi';
    var trustFontSize = s.trust_font_size || 15;

    var avatarsHtml = '';
    if (showAvatars) {
      avatarsHtml = '<div style="display:flex;justify-content:center;margin-top:20px">';
      for (var i = 1; i <= 10; i++) {
        var av = s['avatar_' + i];
        var ml = i === 1 ? '0' : '-10px';
        if (av) {
          avatarsHtml += '<img src="' + esc(av) + '" alt="Customer" loading="lazy" style="width:' + avatarSize + 'px;height:' + avatarSize + 'px;border-radius:50%;border:2px solid #000;margin-left:' + ml + ';object-fit:cover">';
        } else {
          avatarsHtml += '<div style="width:' + avatarSize + 'px;height:' + avatarSize + 'px;border-radius:50%;border:2px solid #000;margin-left:' + ml + ';display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;background:linear-gradient(135deg,' + cv('color-accent') + ',#22c55e);color:#000">' + i + '</div>';
        }
      }
      avatarsHtml += '</div>';
    }

    var glowCss = showGlow ? '.vx-hero::before{content:\'\';position:absolute;top:50%;left:50%;width:600px;height:600px;transform:translate(-50%,-50%);background:radial-gradient(ellipse,' + glowColor + '15 0%,transparent 70%);pointer-events:none;z-index:0}@media(max-width:768px){.vx-hero::before{width:300px;height:300px;background:radial-gradient(ellipse,' + glowColor + '10 0%,transparent 70%)}}' : '';

    var css = '<style>' +
      '.vx-hero{text-align:center;padding:' + paddingTop + 'px 20px ' + paddingBottom + 'px;position:relative;overflow:hidden}' +
      glowCss +
      '.vx-hero__content{position:relative;z-index:1}' +
      '.vx-hero__title{font-family:\'' + heroFont + '\',' + cv('font-heading') + ';font-size:clamp(' + titleSizeMobile + 'px,6vw,' + titleSizeDesktop + 'px);font-weight:900;text-transform:uppercase;letter-spacing:-1px;line-height:1.1;color:' + titleColor + ';margin-bottom:24px}' +
      '.vx-hero__highlight{background:linear-gradient(135deg,' + highlightColor + ',' + highlightColor + 'cc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}' +
      '</style>';

    return css +
      '<section class="vx-hero">' +
      '<div class="vx-hero__content container">' +
        '<h1 class="vx-hero__title">' + esc(titleBefore) + ' <span class="vx-hero__highlight">' + esc(titleHighlight) + '</span> ' + esc(titleAfter) + '</h1>' +
        '<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:16px;font-size:' + trustFontSize + 'px;color:' + trustTextColor + '">' +
          '<span>' + esc(trustPrefix) + '</span><span style="color:' + trustCountColor + ';font-weight:800">' + esc(trustCount) + '</span><span>' + esc(trustSuffix) + '</span>' +
        '</div>' +
        avatarsHtml +
      '</div>' +
      '</section>';
  }

  // ─── 4. Product Grid (glassmorphic, matches original Liquid) ────
  function renderProductGrid(s, products) {
    if (!products || !products.length) return '<p style="text-align:center;color:var(--color-text-muted);padding:40px;">No products found.</p>';

    var accent = colors.accent1 || '#19d400';
    var cardBg = s.card_bg || '#111111';
    var cardBorder = s.card_border || '#2a2a2a';
    var cardHoverBorder = s.card_hover_border || '#19d400';
    var imageBg = s.image_bg || '#0a0a0a';
    var titleColor = s.title_color || '#ffffff';
    var priceColor = s.price_color || accent;
    var compareColor = s.compare_price_color || '#6b7280';
    var btnBg = s.buy_btn_bg || accent;
    var btnText = s.buy_btn_text_color || '#1a1a1a';
    var btnLabel = s.buy_btn_label || 'BUY NOW';
    var btnRadius = s.buy_btn_radius || 50;
    var btnAction = s.buy_btn_action || 'product';
    var showInfoBtn = s.show_info_btn !== false;
    var glassmorphic = s.glassmorphic !== false;
    var showGlow = s.show_glow !== false;
    var glowColor = s.glow_color || accent;
    var glowIntensity = s.glow_intensity || 35;
    var showTopFade = s.show_top_fade;
    var showOverlay = s.show_overlay_title !== false;
    var overlayGreen = s.overlay_green_color || accent;
    var overlayWhite = s.overlay_white_color || '#ffffff';
    var overlayFontSize = s.overlay_font_size || 14;
    var showBadge = s.show_sale_badge !== false;
    var badgeLabel = s.sale_badge_label || 'SALE';
    var badgeBg = s.sale_badge_bg || 'rgba(0,0,0,0.5)';
    var badgeTextColor = s.sale_badge_text_color || '#ffffff';
    var badgePosY = s.sale_badge_position_y || 'top';
    var badgePosX = s.sale_badge_position_x || 'right';
    var colsDesk = s.columns_desktop || 4;
    var colsMob = s.columns_mobile || 2;
    var padTop = s.padding_top || 40;
    var padBot = s.padding_bottom || 60;

    var glowA = (glowIntensity / 100).toFixed(2);
    var glowAMid = (glowA * 0.85).toFixed(2);
    var glowALow = (glowA * 0.6).toFixed(2);

    // Glassmorphic card shadows
    var cardShadow = glassmorphic ? 'box-shadow:inset 0 0 0 1px rgba(255,255,255,0.03),inset 1.8px 3px 0px -2px rgba(255,255,255,0.15),inset -2px -2px 0px -2px rgba(255,255,255,0.12),0 2px 8px rgba(0,0,0,0.4);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);' : '';
    var cardHoverShadow = glassmorphic
      ? 'inset 0 0 0 1px rgba(255,255,255,0.06),inset 1.8px 3px 0px -2px rgba(255,255,255,0.2),inset -2px -2px 0px -2px rgba(255,255,255,0.15),0 8px 32px ' + cardHoverBorder + '33,0 2px 12px rgba(0,0,0,0.3)'
      : '0 8px 32px ' + cardHoverBorder + '33,0 2px 12px rgba(0,0,0,0.3)';

    var css = '<style>' +
      '.vx-pg{padding:' + padTop + 'px 20px ' + padBot + 'px;position:relative;overflow:hidden}' +
      (showGlow ? '.vx-pg::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse 1200px 800px at 10% 15%,rgba(25,212,0,' + glowA + ') 0%,transparent 60%),radial-gradient(ellipse 1000px 700px at 80% 25%,rgba(25,212,0,' + glowAMid + ') 0%,transparent 65%),radial-gradient(ellipse 1400px 900px at 90% 85%,rgba(25,212,0,' + glowA + ') 0%,transparent 70%),radial-gradient(ellipse 800px 600px at 5% 70%,rgba(25,212,0,' + glowALow + ') 0%,transparent 50%);pointer-events:none;z-index:0}' : '') +
      (showTopFade ? '.vx-pg::after{content:"";position:absolute;top:0;left:0;right:0;height:350px;background:linear-gradient(to bottom,var(--color-bg,#000) 10%,transparent 100%);pointer-events:none;z-index:1}' : '') +
      '.vx-pg-inner{position:relative;z-index:2;max-width:var(--max-width,1200px);margin:0 auto}' +
      '.vx-pg-grid{display:grid;grid-template-columns:repeat(' + colsDesk + ',1fr);gap:var(--grid-gap,16px)}' +
      '@media(max-width:768px){.vx-pg-grid{grid-template-columns:repeat(' + colsMob + ',1fr)}' +
        (showGlow ? '.vx-pg::before{background:radial-gradient(ellipse 600px 400px at 10% 10%,rgba(25,212,0,0.15) 0%,transparent 60%),radial-gradient(ellipse 500px 350px at 90% 20%,rgba(25,212,0,0.12) 0%,transparent 65%)!important}' : '') +
      '}' +
      '.vx-pc{background:' + cardBg + ';border:1px solid ' + cardBorder + ';border-radius:var(--radius-card,12px);overflow:hidden;transition:transform .3s,border-color .3s,box-shadow .3s;' + cardShadow + '}' +
      '.vx-pc:hover{transform:translateY(-3px);border-color:' + cardHoverBorder + ';box-shadow:' + cardHoverShadow + '}' +
      '.vx-pc-img{position:relative;aspect-ratio:1;background:' + imageBg + ';overflow:hidden;display:block;cursor:pointer}' +
      '.vx-pc-img img{width:100%;height:100%;object-fit:cover;transition:transform .4s}' +
      '.vx-pc:hover .vx-pc-img img{transform:scale(1.03)}' +
      '.vx-pc-overlay{position:absolute;top:12px;left:12px;font-family:var(--font-heading);font-size:' + overlayFontSize + 'px;line-height:1.3;text-transform:uppercase;z-index:2}' +
      '.vx-pc-badge{position:absolute;' + badgePosY + ':10px;' + badgePosX + ':10px;background:' + badgeBg + ';color:' + badgeTextColor + ';font-size:11px;font-weight:700;text-transform:uppercase;padding:4px 12px;border-radius:999px;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.15);z-index:2}' +
      '.vx-pc-info{padding:16px 16px 18px}' +
      '.vx-pc-title{font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:.02em;color:' + titleColor + ';margin-bottom:10px;line-height:1.3}' +
      '.vx-pc-title a{color:inherit;text-decoration:none}' +
      '.vx-pc-prices{display:flex;align-items:baseline;gap:10px;margin-bottom:14px}' +
      '.vx-price-sale{color:' + priceColor + ';font-weight:800;font-size:22px}' +
      '.vx-price-compare{color:' + compareColor + ';text-decoration:line-through;font-size:18px}' +
      '.vx-pc-actions{display:flex;gap:10px}' +
      '.vx-btn-info{width:54px;height:54px;border-radius:50%;background:linear-gradient(180deg,#262626 0%,#181818 50%,#121212 100%);border:1.5px solid rgba(255,255,255,0.12);box-shadow:inset 0 1px 0 rgba(255,255,255,0.1),inset 0 -1px 0 rgba(0,0,0,0.2),0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.7);transition:border-color .2s,color .2s;flex-shrink:0;cursor:pointer;position:relative;overflow:hidden}' +
      '.vx-btn-info:hover{border-color:rgba(255,255,255,0.25);color:#fff}' +
      '.vx-btn-buy{flex:1;height:54px;border-radius:' + btnRadius + 'px;background:linear-gradient(180deg,color-mix(in srgb,' + btnBg + ' 85%,#fff) 0%,' + btnBg + ' 50%,color-mix(in srgb,' + btnBg + ' 85%,#000) 100%);color:' + btnText + ';font-weight:800;font-size:18px;text-transform:uppercase;letter-spacing:.06em;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;border:1.5px solid rgba(255,255,255,0.3);box-shadow:inset 0 1px 0 rgba(255,255,255,0.25),inset 0 -1px 0 rgba(0,0,0,0.15),0 0 20px color-mix(in srgb,' + btnBg + ' 25%,transparent),0 2px 8px rgba(0,0,0,0.3);transition:transform .2s,box-shadow .2s;cursor:pointer;text-decoration:none}' +
      '.vx-btn-buy:hover{transform:translateY(-2px);box-shadow:inset 0 1px 0 rgba(255,255,255,0.3),inset 0 -1px 0 rgba(0,0,0,0.15),0 0 30px color-mix(in srgb,' + btnBg + ' 40%,transparent),0 4px 16px rgba(0,0,0,0.3)}' +
      '.vx-detail-modal{position:fixed;inset:0;z-index:10000;display:none;align-items:center;justify-content:center;padding:20px}' +
      '.vx-detail-modal.open{display:flex}' +
      '.vx-detail-modal__bg{position:absolute;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}' +
      '.vx-detail-modal__box{position:relative;width:100%;max-width:500px;max-height:80vh;overflow-y:auto;background:rgba(17,17,17,0.95);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:28px;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.04),0 20px 60px rgba(0,0,0,0.6);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}' +
      '.vx-detail-modal__close{position:absolute;top:16px;right:16px;width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:18px;display:flex;align-items:center;justify-content:center;cursor:pointer}' +
      '.vx-detail-modal__close:hover{background:rgba(255,255,255,0.12)}' +
      '.vx-section-title{text-align:center;font-family:var(--font-heading);font-size:clamp(24px,4vw,36px);text-transform:uppercase;letter-spacing:-.5px;margin-bottom:32px;color:#fff}' +
      '</style>';

    var titleHtml = s.title ? '<h2 class="vx-section-title">' + esc(s.title) + '</h2>' : '';

    var cardsHtml = products.map(function(p) {
      var hasCompare = p.comparePrice && p.comparePrice > p.price;

      // Overlay title
      var overlayHtml = '';
      if (showOverlay && p.overlayGreen) {
        overlayHtml = '<div class="vx-pc-overlay">' +
          '<span style="color:' + overlayGreen + ';font-style:italic;font-weight:600">' + esc(p.overlayGreen) + '</span>' +
          (p.overlayWhite ? '<br><span style="color:' + overlayWhite + ';font-weight:800">' + esc(p.overlayWhite) + '</span>' : '') +
          '</div>';
      }

      // Sale badge
      var badgeHtml = '';
      if (showBadge && (hasCompare || s.always_show_sale_badge)) {
        badgeHtml = '<span class="vx-pc-badge">' + esc(badgeLabel) + '</span>';
      }

      // Info button
      var infoBtnHtml = '';
      if (showInfoBtn) {
        infoBtnHtml = '<button class="vx-btn-info" data-vx-desc="' + esc(p.handle) + '" aria-label="Product details">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>' +
          '</button>';
      }

      // Buy button
      var buyBtnHtml = '';
      if (btnAction === 'checkout') {
        buyBtnHtml = '<button class="vx-btn-buy" data-vx-checkout="' + p.variantId + '">' + esc(btnLabel) + '</button>';
      } else if (btnAction === 'add_to_cart') {
        buyBtnHtml = '<button class="vx-btn-buy" data-vx-add="' + p.variantId + '">' + esc(btnLabel) + '</button>';
      } else {
        buyBtnHtml = '<a href="' + esc(p.url) + '" class="vx-btn-buy">' + esc(btnLabel) + '</a>';
      }

      return '<div class="vx-pc" data-product-id="' + p.id + '">' +
        '<div style="border-radius:calc(var(--radius-card,12px) - 1px);overflow:hidden">' +
          '<a href="' + esc(p.url) + '" class="vx-pc-img" aria-label="' + esc(p.title) + '">' +
            (p.image ? '<img src="' + esc(p.image) + '" alt="' + esc(p.imageAlt || p.title) + '" loading="lazy" width="600" height="600">' : '<div style="width:100%;height:100%;background:' + imageBg + '"></div>') +
            overlayHtml +
            badgeHtml +
          '</a>' +
          '<div class="vx-pc-info">' +
            '<h3 class="vx-pc-title"><a href="' + esc(p.url) + '">' + esc(p.title) + '</a></h3>' +
            '<div class="vx-pc-prices">' +
              (hasCompare ? '<span class="vx-price-compare">' + formatMoney(p.comparePrice) + '</span>' : '') +
              '<span class="vx-price-sale">' + formatMoney(p.price) + '</span>' +
            '</div>' +
            '<div class="vx-pc-actions">' + infoBtnHtml + buyBtnHtml + '</div>' +
          '</div>' +
        '</div>' +
        '<script type="text/template" data-vx-product-desc="' + esc(p.handle) + '">' + esc(p.description || '') + '</script>' +
      '</div>';
    }).join('');

    // Detail modal
    var modalHtml = showInfoBtn ? '<div class="vx-detail-modal" id="vx-detail-modal"><div class="vx-detail-modal__bg"></div><div class="vx-detail-modal__box"><button class="vx-detail-modal__close">&times;</button><h3 id="vx-pdm-title" style="font-family:var(--font-heading);font-size:20px;font-weight:800;text-transform:uppercase;margin-bottom:16px;padding-right:40px"></h3><div id="vx-pdm-body" style="font-size:14px;line-height:1.7;color:var(--color-text-muted,#9ca3af)"></div><div id="vx-pdm-price" style="display:flex;align-items:center;gap:10px;margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.08)"></div></div></div>' : '';

    return css +
      '<div class="vx-pg">' +
        '<div class="vx-pg-inner">' +
          titleHtml +
          '<div class="vx-pg-grid">' + cardsHtml + '</div>' +
        '</div>' +
      '</div>' +
      modalHtml;
  }

  function attachProductGrid() {
    // Add to cart buttons
    document.addEventListener('click', function(e) {
      var addBtn = e.target.closest('[data-vx-add]');
      if (addBtn) {
        e.preventDefault();
        var vid = addBtn.getAttribute('data-vx-add');
        addBtn.textContent = 'ADDING...';
        addBtn.disabled = true;
        window.VexelCart.add(Number(vid)).then(function() {
          addBtn.textContent = 'ADDED!';
          setTimeout(function() { addBtn.textContent = addBtn.getAttribute('data-original-text') || 'ADD TO CART'; addBtn.disabled = false; }, 1500);
          // Update badge
          window.VexelCart.get().then(function(c) {
            var badge = document.getElementById('vx-cart-badge');
            if (badge) { badge.textContent = c.item_count; badge.classList.toggle('has-items', c.item_count > 0); }
          });
          // Open cart drawer
          if (window.CartDrawer) window.CartDrawer.open();
        }).catch(function() { addBtn.textContent = 'ERROR'; addBtn.disabled = false; });
        return;
      }

      // Checkout buttons
      var checkBtn = e.target.closest('[data-vx-checkout]');
      if (checkBtn) {
        e.preventDefault();
        var vid2 = checkBtn.getAttribute('data-vx-checkout');
        fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: [{ id: Number(vid2), quantity: 1 }] })
        }).then(function() { window.location.href = '/checkout'; }).catch(function(err) { console.error(err); });
        return;
      }

      // Description popup
      var descBtn = e.target.closest('[data-vx-desc]');
      if (descBtn) {
        e.preventDefault();
        var handle = descBtn.getAttribute('data-vx-desc');
        var tmpl = document.querySelector('[data-vx-product-desc="' + handle + '"]');
        if (tmpl) {
          var overlay = document.createElement('div');
          overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
          overlay.innerHTML = '<div style="background:#111;border:1px solid #2a2a2a;border-radius:16px;padding:32px;max-width:500px;width:100%;max-height:80vh;overflow-y:auto;color:#fff;font-size:14px;line-height:1.7;position:relative"><button style="position:absolute;top:12px;right:12px;background:none;border:none;color:#fff;font-size:24px;cursor:pointer">&times;</button><div style="margin-top:20px">' + tmpl.textContent + '</div></div>';
          overlay.addEventListener('click', function(ev) { if (ev.target === overlay || ev.target.tagName === 'BUTTON') overlay.remove(); });
          document.body.appendChild(overlay);
        }
      }
    });
  }

  // ─── 5. Testimonials ───────────────────────────────────────────
  function renderTestimonials(s) {
    var title = s.title || 'What Our Customers Say';
    var titleColor = s.title_color || '#ffffff';
    var speed = s.scroll_speed || 20;
    var imgHeight = s.image_height || 250;
    var imgHeightMobile = s.image_height_mobile || 180;
    var imgRadius = s.image_radius || 12;
    var bgColor = s.bg_color || '#000000';
    var paddingTop = s.padding_top || 60;
    var paddingBottom = s.padding_bottom || 60;
    var gap = s.gap || 16;
    var maxWidth = s.max_width || 1400;
    var imgHeight2x = imgHeight * 2;

    var imgHtml = '';
    for (var i = 1; i <= 20; i++) {
      var img = s['image_' + i];
      if (img) {
        imgHtml += '<img src="' + esc(img) + '" alt="Customer testimonial ' + i + '" loading="lazy" style="height:' + imgHeight + 'px;width:auto;border-radius:' + imgRadius + 'px;object-fit:cover;flex-shrink:0">';
      }
    }

    if (!imgHtml) return '';

    var css = '<style>' +
      '.vx-testimonials{background:' + bgColor + ';padding:' + paddingTop + 'px 0 ' + paddingBottom + 'px;overflow:hidden}' +
      '.vx-testimonials__title{text-align:center;font-family:' + cv('font-heading') + ';font-size:clamp(24px,4vw,36px);text-transform:uppercase;color:' + titleColor + ';margin-bottom:32px;padding:0 20px}' +
      '.vx-testimonials__wrap{position:relative;max-width:' + maxWidth + 'px;margin:0 auto;-webkit-mask-image:linear-gradient(to right,transparent,black 10%,black 90%,transparent);mask-image:linear-gradient(to right,transparent,black 10%,black 90%,transparent)}' +
      '.vx-testimonials__track{display:flex;gap:' + gap + 'px;width:max-content;animation:vxTestScroll ' + speed + 's linear infinite}' +
      '.vx-testimonials__track:hover{animation-play-state:paused}' +
      '@media(max-width:768px){.vx-testimonials__track img{height:' + imgHeightMobile + 'px!important}}' +
      '@keyframes vxTestScroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}' +
      '</style>';

    return css +
      '<section class="vx-testimonials">' +
      (title ? '<h2 class="vx-testimonials__title">' + esc(title) + '</h2>' : '') +
      '<div class="vx-testimonials__wrap"><div class="vx-testimonials__track">' +
        imgHtml + imgHtml +
      '</div></div></section>';
  }

  // ─── 6. FAQ ────────────────────────────────────────────────────
  function renderFAQ(s) {
    var title = s.title || 'Frequently Asked Questions';
    var titleColor = s.title_color || '#ffffff';
    var cardBg = s.card_bg || '#111111';
    var cardBorder = s.card_border || '#2a2a2a';
    var cardBorderOpen = s.card_border_open || '#19d400';
    var questionColor = s.question_color || '#ffffff';
    var answerColor = s.answer_color || '#9ca3af';
    var toggleBg = s.toggle_bg || '#1a1a1a';
    var toggleBgOpen = s.toggle_bg_open || '#19d400';
    var toggleIconColor = s.toggle_icon_color || '#ffffff';
    var toggleIconOpen = s.toggle_icon_open || '#1a1a1a';
    var maxWidth = s.max_width || 700;
    var cardRadius = s.card_radius || 12;
    var cardPadding = s.card_padding || 18;
    var itemGap = s.item_gap || 12;
    var questionFontSize = s.question_font_size || 15;
    var answerFontSize = s.answer_font_size || 14;
    var toggleSize = s.toggle_size || 32;
    var paddingTop = s.padding_top || 60;
    var paddingBottom = s.padding_bottom || 60;

    var faqs = (s.blocks || []).filter(function(b) { return b.type === 'question'; });
    if (!faqs.length) return '';

    var faqHtml = faqs.map(function(faq, idx) {
      return '<div class="vx-faq-item' + (idx === 0 ? ' open' : '') + '">' +
        '<button class="vx-faq-question" data-vx-faq-toggle>' +
          '<span>' + esc(faq.settings.question) + '</span>' +
          '<span class="vx-faq-toggle"><svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>' +
        '</button>' +
        '<div class="vx-faq-answer"' + (idx === 0 ? ' style="max-height:500px"' : '') + '><div class="vx-faq-answer-inner">' + (faq.settings.answer || '') + '</div></div>' +
      '</div>';
    }).join('');

    var css = '<style>' +
      '.vx-faq{padding:' + paddingTop + 'px 20px ' + paddingBottom + 'px}' +
      '.vx-faq__title{text-align:center;font-family:' + cv('font-heading') + ';font-size:clamp(24px,4vw,36px);text-transform:uppercase;color:' + titleColor + ';margin-bottom:40px}' +
      '.vx-faq__list{max-width:' + maxWidth + 'px;margin:0 auto;display:flex;flex-direction:column;gap:' + itemGap + 'px}' +
      '.vx-faq-item{background:' + cardBg + ';border:1px solid ' + cardBorder + ';border-radius:' + cardRadius + 'px;overflow:hidden;transition:border-color 0.3s}' +
      '.vx-faq-item.open{border-color:' + cardBorderOpen + '}' +
      '.vx-faq-question{display:flex;align-items:center;justify-content:space-between;padding:' + cardPadding + 'px;cursor:pointer;gap:16px;width:100%;background:none;border:none;text-align:left;color:' + questionColor + ';font-size:' + questionFontSize + 'px;font-weight:600;font-family:inherit}' +
      '.vx-faq-toggle{width:' + toggleSize + 'px;height:' + toggleSize + 'px;border-radius:50%;background:' + toggleBg + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background 0.3s,transform 0.3s}' +
      '.vx-faq-toggle svg{width:14px;height:14px;stroke:' + toggleIconColor + ';transition:stroke 0.3s}' +
      '.vx-faq-item.open .vx-faq-toggle{background:' + toggleBgOpen + ';transform:rotate(180deg)}' +
      '.vx-faq-item.open .vx-faq-toggle svg{stroke:' + toggleIconOpen + '}' +
      '.vx-faq-answer{max-height:0;overflow:hidden;transition:max-height 0.4s ease}' +
      '.vx-faq-answer-inner{padding:0 ' + cardPadding + 'px ' + cardPadding + 'px;font-size:' + answerFontSize + 'px;color:' + answerColor + ';line-height:1.7}' +
      '</style>';

    return css +
      '<section class="vx-faq"><h2 class="vx-faq__title">' + esc(title) + '</h2><div class="vx-faq__list">' + faqHtml + '</div></section>';
  }

  function attachFAQ() {
    document.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-vx-faq-toggle]');
      if (!btn) return;
      var item = btn.closest('.vx-faq-item');
      var answer = item.querySelector('.vx-faq-answer');
      var isOpen = item.classList.contains('open');

      document.querySelectorAll('.vx-faq-item.open').forEach(function(el) {
        el.classList.remove('open');
        el.querySelector('.vx-faq-answer').style.maxHeight = '0';
      });

      if (!isOpen) {
        item.classList.add('open');
        answer.style.maxHeight = answer.scrollHeight + 'px';
      }
    });
  }

  // ─── 7. Reviews ────────────────────────────────────────────────
  function renderReviews(s) {
    var title = s.title || 'Customer Reviews';
    var subtitle = s.subtitle || 'See what our customers are saying';
    var titleColor = s.title_color || '#ffffff';
    var subtitleColor = s.subtitle_color || '#9ca3af';
    var starColor = s.star_color || '#fbbf24';
    var rating = s.rating || '4.9';
    var reviewCount = s.review_count || '15';
    var cardBg = s.card_bg || '#111111';
    var cardBorder = s.card_border || '#2a2a2a';
    var avatarBg = s.avatar_bg || '#19d400';
    var avatarTextColor = s.avatar_text_color || '#000000';
    var writeBtnBg = s.write_btn_bg || '#19d400';
    var writeBtnText = s.write_btn_text_color || '#000000';
    var columns = s.columns || 3;
    var avatarSize = s.avatar_size || 40;
    var cardPadding = s.card_padding || 20;
    var paddingTop = s.padding_top || 60;
    var paddingBottom = s.padding_bottom || 60;

    var reviews = (s.blocks || []).filter(function(b) { return b.type === 'review'; });

    var reviewCardsHtml = reviews.map(function(r) {
      var initials = (r.settings.name || 'A').slice(0, 2).toUpperCase();
      var starsHtml = '';
      for (var i = 1; i <= 5; i++) {
        starsHtml += i <= (r.settings.stars || 5) ? '\u2605' : '\u2606';
      }
      return '<div style="background:' + cardBg + ';border:1px solid ' + cardBorder + ';border-radius:var(--radius-md,12px);padding:' + cardPadding + 'px">' +
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">' +
          '<div style="width:' + avatarSize + 'px;height:' + avatarSize + 'px;border-radius:50%;background:' + avatarBg + ';color:' + avatarTextColor + ';display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;flex-shrink:0">' + esc(initials) + '</div>' +
          '<div><div style="font-weight:700;font-size:14px">' + esc(r.settings.name) + '</div><div style="font-size:12px;color:' + cv('color-text-muted') + '">' + esc(r.settings.date || 'Recently') + '</div></div>' +
        '</div>' +
        '<div style="color:' + starColor + ';font-size:14px;margin-bottom:8px;letter-spacing:1px">' + starsHtml + '</div>' +
        '<div style="font-size:14px;color:' + cv('color-text-muted') + ';line-height:1.6">' + esc(r.settings.text) + '</div>' +
      '</div>';
    }).join('');

    var css = '<style>' +
      '.vx-reviews{padding:' + paddingTop + 'px 20px ' + paddingBottom + 'px;max-width:var(--max-width,1200px);margin:0 auto}' +
      '@media(max-width:768px){.vx-reviews__grid{grid-template-columns:1fr!important}}' +
      '</style>';

    return css +
      '<section class="vx-reviews">' +
      '<div style="text-align:center;margin-bottom:32px">' +
        '<h2 style="font-family:' + cv('font-heading') + ';font-size:clamp(24px,4vw,36px);text-transform:uppercase;color:' + titleColor + ';margin-bottom:8px">' + esc(title) + '</h2>' +
        '<p style="color:' + subtitleColor + ';font-size:15px;margin-bottom:20px">' + esc(subtitle) + '</p>' +
        '<div style="display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;margin-bottom:16px">' +
          '<span style="color:' + starColor + ';font-size:20px;letter-spacing:2px">\u2605\u2605\u2605\u2605\u2605</span>' +
          '<span style="font-weight:800;font-size:18px">' + esc(rating) + '</span>' +
          '<span style="color:' + cv('color-text-muted') + ';font-size:14px">(' + esc(reviewCount) + ' reviews)</span>' +
        '</div>' +
        '<button class="vx-write-review" style="display:inline-flex;align-items:center;gap:6px;padding:10px 24px;border-radius:999px;background:' + writeBtnBg + ';color:' + writeBtnText + ';font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:0.03em;cursor:pointer;border:none;transition:box-shadow 0.3s" data-vx-open-review>+ Write a Review</button>' +
      '</div>' +
      '<div class="vx-reviews__grid" style="display:grid;grid-template-columns:repeat(' + columns + ',1fr);gap:16px;margin-top:32px">' +
        reviewCardsHtml +
      '</div>' +
      // Write review modal
      '<div class="vx-review-modal" id="vx-review-modal" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:300;display:none;align-items:center;justify-content:center;padding:20px">' +
        '<div style="background:#111;border:1px solid #2a2a2a;border-radius:16px;padding:32px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto">' +
          '<button style="float:right;background:none;border:none;color:#fff;font-size:24px;cursor:pointer" data-vx-close-review>&times;</button>' +
          '<h3 style="font-family:' + cv('font-heading') + ';font-size:22px;text-transform:uppercase;margin-bottom:20px">Write a Review</h3>' +
          '<label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;color:#ccc">Rating</label>' +
          '<div id="vx-star-selector" style="display:flex;gap:6px;margin-bottom:16px"><span data-star="1" style="font-size:28px;cursor:pointer;color:' + starColor + '">\u2605</span><span data-star="2" style="font-size:28px;cursor:pointer;color:' + starColor + '">\u2605</span><span data-star="3" style="font-size:28px;cursor:pointer;color:' + starColor + '">\u2605</span><span data-star="4" style="font-size:28px;cursor:pointer;color:' + starColor + '">\u2605</span><span data-star="5" style="font-size:28px;cursor:pointer;color:' + starColor + '">\u2605</span></div>' +
          '<label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;color:#ccc">Name</label>' +
          '<input type="text" placeholder="Your name" style="width:100%;padding:12px;border-radius:8px;border:1px solid #2a2a2a;background:#0a0a0a;color:#fff;font-size:14px;margin-bottom:16px;font-family:inherit;box-sizing:border-box">' +
          '<label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;color:#ccc">Review</label>' +
          '<textarea placeholder="Share your experience..." style="width:100%;padding:12px;border-radius:8px;border:1px solid #2a2a2a;background:#0a0a0a;color:#fff;font-size:14px;margin-bottom:16px;font-family:inherit;min-height:100px;resize:vertical;box-sizing:border-box"></textarea>' +
          '<button style="width:100%;padding:14px;border-radius:8px;background:' + writeBtnBg + ';color:' + writeBtnText + ';font-weight:800;font-size:14px;text-transform:uppercase;border:none;cursor:pointer" data-vx-submit-review>Submit Review</button>' +
        '</div>' +
      '</div>' +
      '</section>';
  }

  function attachReviews() {
    document.addEventListener('click', function(e) {
      if (e.target.closest('[data-vx-open-review]')) {
        var modal = document.getElementById('vx-review-modal');
        if (modal) modal.style.display = 'flex';
      }
      if (e.target.closest('[data-vx-close-review]') || e.target.id === 'vx-review-modal') {
        var modal = document.getElementById('vx-review-modal');
        if (modal) modal.style.display = 'none';
      }
      if (e.target.closest('[data-vx-submit-review]')) {
        alert('Thank you for your review!');
        var modal = document.getElementById('vx-review-modal');
        if (modal) modal.style.display = 'none';
      }
      var starBtn = e.target.closest('#vx-star-selector span');
      if (starBtn) {
        var n = parseInt(starBtn.getAttribute('data-star'), 10);
        document.querySelectorAll('#vx-star-selector span').forEach(function(s, i) {
          s.style.color = i < n ? (s.getAttribute('data-active-color') || '#fbbf24') : '#333';
        });
      }
    });
  }

  // ─── 8. Trust Badges ───────────────────────────────────────────
  function renderTrustBadges(s) {
    var bgColor = s.bg_color || '#000000';
    var borderTop = s.border_top || '#1a1a1a';
    var borderBot = s.border_bot || '#1a1a1a';
    var iconColor = s.icon_color || '#19d400';
    var textColor = s.text_color || '#ffffff';
    var speed = s.scroll_speed || 30;
    var showSep = s.show_separator !== false;

    var badgesHtml = '';
    for (var i = 1; i <= 4; i++) {
      var text = s['badge_' + i + '_text'];
      var icon = s['badge_' + i + '_icon'] || 'star';
      if (text) {
        badgesHtml += '<span class="vx-trust-badge"><span class="vx-trust-badge__icon" style="color:' + iconColor + '">' + getIcon(icon) + '</span>' + esc(text) + '</span>';
        if (showSep) badgesHtml += '<span class="vx-trust-badge__sep">\u2726</span>';
      }
    }
    if (!badgesHtml) return '';

    var css = '<style>' +
      '.vx-trust-badges{background:' + bgColor + ';border-top:1px solid ' + borderTop + ';border-bottom:1px solid ' + borderBot + ';overflow:hidden;height:48px;display:flex;align-items:center}' +
      '.vx-trust-badges:hover .vx-trust-badges__track{animation-play-state:paused}' +
      '.vx-trust-badges__track{display:flex;align-items:center;gap:0;white-space:nowrap;animation:vxTrustScroll ' + speed + 's linear infinite;will-change:transform}' +
      '.vx-trust-badge{display:inline-flex;align-items:center;gap:8px;padding:0 28px;font-size:13px;font-weight:600;color:' + textColor + ';white-space:nowrap;flex-shrink:0}' +
      '.vx-trust-badge__icon{display:flex;align-items:center;flex-shrink:0}.vx-trust-badge__icon svg{width:16px;height:16px}' +
      '.vx-trust-badge__sep{color:' + iconColor + ';font-size:10px;opacity:0.5;padding:0 4px}' +
      '@keyframes vxTrustScroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}' +
      '</style>';

    return css +
      '<div class="vx-trust-badges"><div class="vx-trust-badges__track">' + badgesHtml + badgesHtml + '</div></div>';
  }

  // ─── 9. Footer ─────────────────────────────────────────────────
  function renderFooter(s) {
    var bg = s.bg_color || '#0a0a0a';
    var borderTop = s.border_color || '#1a1a1a';
    var brandColor = s.brand_color || '#ffffff';
    var linkColor = s.link_color || '#6b7280';
    var linkHover = s.link_hover_color || '#ffffff';
    var copyColor = s.copyright_color || '#6b7280';
    var iconColor = s.social_icon_color || '#19d400';
    var iconSize = s.social_icon_size || 20;
    var bText = s.brand_text || brandName || 'Vexel';
    var brandFontSize = s.brand_font_size || 26;
    var paddingTop = s.padding_top || 48;
    var paddingBottom = s.padding_bottom || 48;
    var ctaText = s.cta_text || 'Get this store design';
    var ctaUrl = s.cta_url || 'https://vexelthemes.com';
    var ctaColor = s.cta_color || '#19d400';
    var ctaTextColor = s.cta_text_color || '#000000';
    var footerLogo = s.logo_url || null;
    var logoHeight = s.logo_height || 40;

    var brandHtml = footerLogo
      ? '<div style="margin-bottom:24px"><img src="' + esc(footerLogo) + '" alt="' + esc(bText) + '" style="height:' + logoHeight + 'px;margin:0 auto"></div>'
      : '<div style="font-family:' + cv('font-heading') + ';font-size:' + brandFontSize + 'px;font-weight:900;text-transform:uppercase;letter-spacing:0.06em;color:' + brandColor + ';margin-bottom:24px">' + esc(bText) + '</div>';

    var socialHtml = '';
    var socialLinks = [
      { url: s.instagram_url, icon: icons.instagram, label: 'Instagram' },
      { url: s.tiktok_url, icon: icons.tiktok, label: 'TikTok' },
      { url: s.youtube_url, icon: icons.youtube, label: 'YouTube' },
      { url: s.discord_url, icon: icons.discord, label: 'Discord' }
    ];
    var hasSocials = socialLinks.some(function(l) { return l.url; });
    if (hasSocials) {
      socialHtml = '<div style="display:flex;justify-content:center;gap:16px;margin-bottom:24px">';
      socialLinks.forEach(function(l) {
        if (l.url) {
          socialHtml += '<a href="' + esc(l.url) + '" target="_blank" rel="noopener" aria-label="' + l.label + '" style="display:flex;align-items:center;justify-content:center;width:' + (iconSize + 16) + 'px;height:' + (iconSize + 16) + 'px;color:' + iconColor + ';transition:transform 0.2s,opacity 0.2s;opacity:0.8;text-decoration:none"><span style="width:' + iconSize + 'px;height:' + iconSize + 'px;display:flex">' + l.icon + '</span></a>';
        }
      });
      socialHtml += '</div>';
    }

    var policyHtml = '';
    if (s.show_policies !== false) {
      policyHtml = '<div style="display:flex;justify-content:center;align-items:center;gap:24px;flex-wrap:wrap;margin-bottom:24px">' +
        '<a href="/policies/refund-policy" style="color:' + linkColor + ';font-size:13px;text-decoration:none">' + esc(s.label_refund || 'Refund') + '</a>' +
        '<a href="/policies/shipping-policy" style="color:' + linkColor + ';font-size:13px;text-decoration:none">' + esc(s.label_shipping || 'Shipping') + '</a>' +
        '<a href="/policies/privacy-policy" style="color:' + linkColor + ';font-size:13px;text-decoration:none">' + esc(s.label_privacy || 'Privacy') + '</a>' +
        '<a href="/policies/terms-of-service" style="color:' + linkColor + ';font-size:13px;text-decoration:none">' + esc(s.label_terms || 'Terms') + '</a>' +
      '</div>';
    }

    var copyrightHtml = '';
    if (s.show_copyright !== false) {
      copyrightHtml = '<div style="color:' + copyColor + ';font-size:12px">&copy; ' + new Date().getFullYear() + ' ' + esc(s.copyright_name || bText) + '. All rights reserved.</div>';
    }

    var ctaHtml = '';
    if (s.show_cta !== false) {
      ctaHtml = '<div style="margin-top:24px"><a href="' + esc(ctaUrl) + '" style="display:inline-flex;align-items:center;gap:8px;padding:12px 32px;font-family:' + cv('font-body') + ';font-size:14px;font-weight:600;color:' + ctaTextColor + ';background:linear-gradient(180deg,color-mix(in srgb,' + ctaColor + ' 85%,#ffffff) 0%,' + ctaColor + ' 50%,color-mix(in srgb,' + ctaColor + ' 85%,#000000) 100%);border:1.5px solid rgba(255,255,255,0.3);border-radius:50px;text-decoration:none;position:relative;overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,0.25),inset 0 -1px 0 rgba(0,0,0,0.15),0 0 20px color-mix(in srgb,' + ctaColor + ' 25%,transparent),0 2px 8px rgba(0,0,0,0.3);transition:transform 0.2s,box-shadow 0.2s">' + esc(ctaText) + ' <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg></a></div>';
    }

    // Vexel attribution link (protected by footer monitor)
    var vexelLink = '<div style="margin-top:16px"><a href="https://vexelthemes.com" target="_blank" rel="noopener" data-vx-attribution style="color:' + linkColor + ';font-size:11px;text-decoration:none;opacity:0.6">Powered by Vexel</a></div>';

    return '<footer class="vx-footer" data-vx-footer style="background:' + bg + ';border-top:1px solid ' + borderTop + ';padding:' + paddingTop + 'px 20px ' + paddingBottom + 'px;text-align:center">' +
      brandHtml + socialHtml + policyHtml + copyrightHtml + ctaHtml + vexelLink +
    '</footer>';
  }

  // ─── 10. Cart Drawer ───────────────────────────────────────────
  function renderCartDrawer(s) {
    var drawerBg = s.drawer_bg || '#0a0a0a';
    var overlayOpacity = (s.overlay_opacity || 60) / 100;
    var borderColor = s.border_color || '#1a1a1a';
    var textColor = s.text_color || '#ffffff';
    var mutedColor = s.muted_color || '#6b7280';
    var accent = s.accent_color || '#19d400';
    var btnText = s.btn_text_color || '#000000';
    var itemBg = s.item_bg || '#111111';
    var drawerWidth = s.drawer_width || 400;
    var drawerTitle = s.title || 'Your Cart';
    var checkoutText = s.checkout_text || 'Checkout';

    var css = '<style>' +
      '.vx-cart-overlay{position:fixed;inset:0;background:rgba(0,0,0,' + overlayOpacity + ');z-index:9999;opacity:0;visibility:hidden;transition:opacity 0.3s ease,visibility 0.3s ease;cursor:pointer}' +
      '.vx-cart-overlay.is-open{opacity:1;visibility:visible}' +
      '.vx-cart-drawer{position:fixed;top:0;right:0;bottom:0;width:' + drawerWidth + 'px;max-width:100vw;background:' + drawerBg + ';border-left:1px solid ' + borderColor + ';z-index:10000;display:flex;flex-direction:column;transform:translateX(100%);transition:transform 0.35s cubic-bezier(0.16,1,0.3,1)}' +
      '.vx-cart-drawer.is-open{transform:translateX(0)}' +
      '.vx-cart-drawer__header{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid ' + borderColor + ';flex-shrink:0}' +
      '.vx-cart-drawer__title{font-family:' + cv('font-heading') + ';font-size:18px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:' + textColor + '}' +
      '.vx-cart-drawer__count{font-family:' + cv('font-body') + ';font-size:13px;font-weight:500;color:' + mutedColor + ';margin-left:8px}' +
      '.vx-cart-drawer__close{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:8px;color:' + mutedColor + ';transition:color 0.2s,background 0.2s;cursor:pointer;background:none;border:none}' +
      '.vx-cart-drawer__close:hover{color:' + textColor + ';background:' + itemBg + '}.vx-cart-drawer__close svg{width:18px;height:18px}' +
      '.vx-cart-drawer__body{flex:1;overflow-y:auto;padding:16px 24px;scrollbar-width:none}.vx-cart-drawer__body::-webkit-scrollbar{display:none}' +
      '.vx-cart-item{display:flex;gap:14px;padding:16px;background:' + itemBg + ';border-radius:12px;margin-bottom:12px;position:relative}' +
      '.vx-cart-item__img{width:72px;height:72px;border-radius:8px;overflow:hidden;flex-shrink:0;background:' + borderColor + '}.vx-cart-item__img img{width:100%;height:100%;object-fit:cover}' +
      '.vx-cart-item__info{flex:1;display:flex;flex-direction:column;gap:4px;min-width:0}' +
      '.vx-cart-item__title{font-size:14px;font-weight:600;color:' + textColor + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.vx-cart-item__variant{font-size:12px;color:' + mutedColor + '}' +
      '.vx-cart-item__price{font-size:14px;font-weight:700;color:' + accent + ';margin-top:auto}' +
      '.vx-cart-item__remove{position:absolute;top:12px;right:12px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;color:' + mutedColor + ';cursor:pointer;transition:color 0.2s;border-radius:4px;background:none;border:none}.vx-cart-item__remove:hover{color:#ef4444}.vx-cart-item__remove svg{width:14px;height:14px}' +
      '.vx-cart-item__qty{display:flex;align-items:center;margin-top:8px;width:fit-content;border:1px solid ' + borderColor + ';border-radius:6px;overflow:hidden}' +
      '.vx-cart-item__qty button{width:28px;height:28px;display:flex;align-items:center;justify-content:center;color:' + mutedColor + ';font-size:14px;font-weight:600;cursor:pointer;background:transparent;border:none}' +
      '.vx-cart-item__qty button:hover{color:' + textColor + '}' +
      '.vx-cart-item__qty span{width:32px;text-align:center;font-size:13px;font-weight:600;color:' + textColor + '}' +
      '.vx-cart-drawer__footer{flex-shrink:0;padding:20px 24px;border-top:1px solid ' + borderColor + '}' +
      '.vx-cart-drawer__checkout{display:block;width:100%;padding:14px;font-family:' + cv('font-body') + ';font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;text-align:center;color:' + btnText + ';background:linear-gradient(180deg,color-mix(in srgb,' + accent + ' 85%,#ffffff) 0%,' + accent + ' 50%,color-mix(in srgb,' + accent + ' 85%,#000000) 100%);border:1.5px solid rgba(255,255,255,0.3);border-radius:50px;cursor:pointer;text-decoration:none;box-shadow:inset 0 1px 0 rgba(255,255,255,0.25),0 0 20px color-mix(in srgb,' + accent + ' 25%,transparent),0 2px 8px rgba(0,0,0,0.3);transition:transform 0.2s}' +
      '.vx-cart-drawer__checkout:hover{transform:translateY(-2px)}' +
      '.vx-cart-item.is-loading{opacity:0.5;pointer-events:none}' +
      '@media(max-width:480px){.vx-cart-drawer{width:100vw}}' +
      '</style>';

    return css +
      '<div class="vx-cart-overlay" id="vx-cart-overlay"></div>' +
      '<div class="vx-cart-drawer" id="vx-cart-drawer" aria-label="Shopping cart">' +
        '<div class="vx-cart-drawer__header">' +
          '<div style="display:flex;align-items:baseline"><span class="vx-cart-drawer__title">' + esc(drawerTitle) + '</span><span class="vx-cart-drawer__count" id="vx-cart-count"></span></div>' +
          '<button class="vx-cart-drawer__close" id="vx-cart-close" aria-label="Close cart"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
        '</div>' +
        '<div class="vx-cart-drawer__body" id="vx-cart-body"></div>' +
        '<div class="vx-cart-drawer__footer" id="vx-cart-footer" style="display:none">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><span style="font-size:14px;font-weight:500;color:' + mutedColor + ';text-transform:uppercase;letter-spacing:0.05em">Subtotal</span><span style="font-family:' + cv('font-heading') + ';font-size:20px;font-weight:700;color:' + textColor + '" id="vx-cart-subtotal"></span></div>' +
          '<a href="/checkout" class="vx-cart-drawer__checkout">' + esc(checkoutText) + '</a>' +
        '</div>' +
      '</div>';
  }

  function attachCartDrawer() {
    var overlay = document.getElementById('vx-cart-overlay');
    var drawer = document.getElementById('vx-cart-drawer');
    var closeBtn = document.getElementById('vx-cart-close');
    var body = document.getElementById('vx-cart-body');
    var footer = document.getElementById('vx-cart-footer');
    var countEl = document.getElementById('vx-cart-count');
    var subtotalEl = document.getElementById('vx-cart-subtotal');

    if (!drawer) return;

    function open() {
      drawer.classList.add('is-open');
      overlay.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      refreshCart();
    }
    function close() {
      drawer.classList.remove('is-open');
      overlay.classList.remove('is-open');
      document.body.style.overflow = '';
    }

    overlay.addEventListener('click', close);
    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') close(); });

    function refreshCart() {
      fetch('/cart.js').then(function(r) { return r.json(); }).then(function(cart) { renderCart(cart); }).catch(function() {});
    }

    function renderCart(cart) {
      var badge = document.getElementById('vx-cart-badge');
      if (badge) {
        if (cart.item_count > 0) { badge.textContent = cart.item_count; badge.classList.add('has-items'); }
        else { badge.classList.remove('has-items'); }
      }
      countEl.textContent = cart.item_count > 0 ? '(' + cart.item_count + ')' : '';

      if (cart.item_count === 0) {
        body.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:60px 20px;gap:16px">' +
          '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.4;color:#6b7280"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>' +
          '<p style="font-size:15px;color:#6b7280">Your cart is empty</p>' +
          '<a href="/collections/all" style="font-size:14px;font-weight:600;color:#19d400;text-decoration:none">Continue shopping</a>' +
        '</div>';
        footer.style.display = 'none';
        return;
      }

      footer.style.display = '';
      subtotalEl.textContent = formatMoney(cart.total_price);

      var html = '';
      cart.items.forEach(function(item) {
        var imgSrc = item.image ? item.image.replace(/(\.[a-z]+)(\?|$)/, '_180x$1$2') : '';
        html += '<div class="vx-cart-item" data-key="' + item.key + '">' +
          '<div class="vx-cart-item__img">' + (imgSrc ? '<img src="' + imgSrc + '" alt="' + esc(item.title) + '" loading="lazy">' : '') + '</div>' +
          '<div class="vx-cart-item__info">' +
            '<span class="vx-cart-item__title">' + esc(item.product_title) + '</span>' +
            (item.variant_title ? '<span class="vx-cart-item__variant">' + esc(item.variant_title) + '</span>' : '') +
            '<div class="vx-cart-item__qty">' +
              '<button data-action="minus">\u2212</button><span>' + item.quantity + '</span><button data-action="plus">+</button>' +
            '</div>' +
            '<span class="vx-cart-item__price">' + formatMoney(item.final_line_price) + '</span>' +
          '</div>' +
          '<button class="vx-cart-item__remove" data-action="remove" aria-label="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
        '</div>';
      });
      body.innerHTML = html;
    }

    body.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var item = btn.closest('.vx-cart-item');
      var key = item.dataset.key;
      var action = btn.dataset.action;
      var qtySpan = item.querySelector('.vx-cart-item__qty span');
      var qty = parseInt(qtySpan.textContent, 10);
      if (action === 'minus') qty = Math.max(0, qty - 1);
      else if (action === 'plus') qty += 1;
      else if (action === 'remove') qty = 0;
      item.classList.add('is-loading');
      fetch('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: key, quantity: qty })
      }).then(function(r) { return r.json(); }).then(function(cart) { renderCart(cart); }).catch(function() { item.classList.remove('is-loading'); });
    });

    document.addEventListener('cart:open', open);
    document.addEventListener('cart:refresh', refreshCart);
    window.CartDrawer = { open: open, close: close, refresh: refreshCart };
  }

  // ═══════════════════════════════════════════════════════════════
  // FOOTER PROTECTION
  // ═══════════════════════════════════════════════════════════════
  function startFooterProtection() {
    var footerSignature = null;

    function checkFooter() {
      var footer = document.querySelector('[data-vx-footer]');
      if (!footer) {
        nukeForTamper();
        return;
      }
      var display = window.getComputedStyle(footer).display;
      if (display === 'none') {
        footer.style.cssText = 'display:block!important;visibility:visible!important;opacity:1!important';
      }
      // Check attribution link
      var attr = footer.querySelector('[data-vx-attribution]');
      if (!attr) {
        nukeForTamper();
        return;
      }
      if (!footerSignature && footer.innerHTML.trim().length > 10) {
        footerSignature = footer.innerHTML.length;
      } else if (footerSignature && footer.innerHTML.length < footerSignature * 0.2) {
        nukeForTamper();
      }
    }

    function nukeForTamper() {
      document.body.innerHTML = '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#000"><div class="vx-loader__spinner" style="width:48px;height:48px;border:3px solid transparent;border-top-color:' + (colors.accent1 || '#19d400') + ';border-radius:50%;animation:vxSpin 1s linear infinite"></div></div><style>@keyframes vxSpin{to{transform:rotate(360deg)}}</style>';
    }

    setInterval(checkFooter, 10000);
    try {
      var footer = document.querySelector('[data-vx-footer]');
      if (footer) {
        new MutationObserver(function() { setTimeout(checkFooter, 500); }).observe(footer, { childList: true, subtree: true, attributes: true });
      }
    } catch(e) {}
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER ENGINE
  // ═══════════════════════════════════════════════════════════════

  var renderers = {
    'urgency-bar': { render: renderUrgencyBar, attach: attachUrgencyBar },
    'header': { render: renderHeader, attach: attachHeader },
    'hero': { render: renderHero },
    'product-grid': { render: renderProductGrid },
    'testimonials': { render: renderTestimonials },
    'faq': { render: renderFAQ, attach: attachFAQ },
    'reviews': { render: renderReviews, attach: attachReviews },
    'trust-badges': { render: renderTrustBadges },
    'footer': { render: renderFooter },
    'cart-drawer': { render: renderCartDrawer, attach: attachCartDrawer }
  };

  function renderAllSections() {
    var shells = document.querySelectorAll('[data-vx-section]');
    var attachQueue = [];

    shells.forEach(function(shell) {
      var type = shell.getAttribute('data-vx-section');
      var renderer = renderers[type];
      if (!renderer) return;

      // Read settings JSON
      var settings = {};
      var settingsEl = document.querySelector('script[data-vx-settings="' + type + '"]');
      if (settingsEl) {
        try { settings = JSON.parse(settingsEl.textContent); } catch(e) {}
      }

      // Read products JSON (if applicable)
      var products = null;
      var productsEl = document.querySelector('script[data-vx-products="' + type + '"]');
      if (productsEl) {
        try { products = JSON.parse(productsEl.textContent); } catch(e) {}
      }

      // Render
      var html = products !== null ? renderer.render(settings, products) : renderer.render(settings);
      if (html) {
        shell.innerHTML = html;
        shell.classList.remove('vx-shell--loading');
        shell.classList.add('vx-shell--loaded');
      }

      if (renderer.attach) {
        attachQueue.push({ attach: renderer.attach, settings: settings });
      }
    });

    // Attach interactive behaviors after all sections are rendered
    attachQueue.forEach(function(item) {
      item.attach(item.settings);
    });

    // Attach product grid interactions
    attachProductGrid();

    // Start footer protection
    startFooterProtection();
  }

  // ═══════════════════════════════════════════════════════════════
  // LICENSE VALIDATION + BOOT
  // ═══════════════════════════════════════════════════════════════

  function boot() {
    // Editor bypass — always render
    if (isEditor) {
      renderAllSections();
      hideLoader();
      return;
    }

    // Check cache
    var cached = getCachedResult();
    if (cached) {
      if (cached.status === 'ok') {
        renderAllSections();
        hideLoader();
      } else {
        hideLoader();
        showInvalidLicense(cached.reason || 'invalid_key');
      }
      return;
    }

    // Validate with server
    fetch(apiUrl + '/api/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        licenseKey: licenseKey,
        domain: shopDomain,
        permanentDomain: permanentDomain
      })
    })
    .then(function(response) {
      if (response.status === 403) {
        return response.json().then(function(data) {
          setCachedResult('invalid', data.reason);
          hideLoader();
          showInvalidLicense(data.reason);
          throw new Error('invalid');
        });
      }
      if (response.status === 429) {
        hideLoader();
        showInvalidLicense('rate_limited');
        throw new Error('rate_limited');
      }
      if (!response.ok) throw new Error('server_error');
      return response.json();
    })
    .then(function(data) {
      if (data.status === 'ok') {
        setCachedResult('ok', data.plan);
        renderAllSections();
        hideLoader();
      } else {
        setCachedResult('invalid', data.reason);
        hideLoader();
        showInvalidLicense(data.reason);
      }
    })
    .catch(function(err) {
      if (err.message === 'invalid' || err.message === 'rate_limited') return;
      // FAIL OPEN — if server is down, render anyway
      console.warn('[Vexel] Server unreachable, rendering in fail-open mode');
      renderAllSections();
      hideLoader();
    });
  }

  // ─── Start ─────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
