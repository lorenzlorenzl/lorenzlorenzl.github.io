/* Erweiterungen für alle Entwürfe: Präsentations-Übergänge, Punkte-Navigation, Laufband, Zähler, Lichtbox,
   Richtpreis-Rechner, Terminanfrage, Ablauf, Erreichbarkeit. Reines JavaScript ohne externe Dateien. */
(function () {
  'use strict';
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(n) { return Math.round(n / 10) * 10 + ''; }
  function money(n) { return fmt(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' €'; }

  var page = document.body.dataset;
  var EMAIL = page.email || '', TEL = page.tel || '', GEWERK = page.gewerk || '';

  /* ---------- Fortschritt und Kopfzeile ---------- */
  var bar = el('div', 'progress'); document.body.appendChild(bar);
  var header = $('header');
  function onScroll() {
    var h = document.documentElement, max = h.scrollHeight - h.clientHeight;
    bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
    if (header) header.classList.toggle('scrolled', h.scrollTop > 40);
    var hero = $('.hero'); if (hero && !reduced) hero.style.setProperty('--py', Math.min(h.scrollTop, 600) + 'px');
  }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* Erreichbarkeit jetzt: Montag bis Freitag 7 bis 17 Uhr, sonst Rückruf; Notdienst, wenn die Seite einen hat */
  (function () {
    var nav = $('.nav'); if (!nav) return;
    var now = new Date(), d = now.getDay(), hr = now.getHours();
    var open = d >= 1 && d <= 5 && hr >= 7 && hr < 17, nd = !!$('.notdienst');
    var pill = el('span', 'open-pill' + (open ? '' : ' off'), '<i></i>' + (open ? 'Jetzt erreichbar' : nd ? 'Notdienst erreichbar' : 'Rückruf am nächsten Werktag'));
    nav.insertBefore(pill, nav.lastElementChild);
  })();

  /* ---------- Icons statt Nummern bei den Leistungen ---------- */
  (function () {
    var I = {
      flame: '<path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3 0-6 1-10z"/>',
      drop: '<path d="M12 2c4 5 7 9 7 13a7 7 0 0 1-14 0c0-4 3-8 7-13z"/>',
      sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
      bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
      roof: '<path d="M3 11l9-8 9 8M5 10v10h14V10"/>',
      saw: '<path d="M3 17L17 3l4 4L7 21zM14 6l4 4"/>',
      roller: '<path d="M3 5h12v5H3zM15 7h4v4h-6M11 11v3H9v6h4v-6z"/>',
      phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
      wrench: '<path d="M14 4a5 5 0 0 0-5 7L3 17l4 4 6-6a5 5 0 0 0 7-5l-3 3-3-1-1-3z"/>',
      fan: '<circle cx="12" cy="12" r="2"/><path d="M12 10c0-5 4-7 6-5-2 2-2 5-6 5zM14 12c5 0 7 4 5 6-2-2-5-2-5-6zM12 14c0 5-4 7-6 5 2-2 2-5 6-5zM10 12c-5 0-7-4-5-6 2 2 5 2 5 6z"/>',
      check: '<path d="M4 12l5 5L20 6"/>',
      home: '<path d="M3 11l9-8 9 8v10h-6v-6H9v6H3z"/>',
      window: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M12 4v16M4 12h16"/>',
      plug: '<path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4"/>',
      bulb: '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
      pool: '<path d="M2 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 21c2-2 4-2 6 0s4 2 6 0 4-2 6 0M8 15V5a2 2 0 0 1 4 0M12 15V5a2 2 0 0 1 4 0"/>',
      brush: '<path d="M4 20c3 0 4-2 4-4l8-8 2 2-8 8c-2 0-4 1-6 2zM14 6l4-4 4 4-4 4"/>',
      door: '<path d="M5 3h14v18H5zM15 12h1"/>',
      stairs: '<path d="M3 21h4v-4h4v-4h4V9h4V5"/>',
      shield: '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/>',
      euro: '<path d="M17 6a7 7 0 1 0 0 12M4 10h9M4 14h9"/>',
      car: '<path d="M3 13l2-5h14l2 5v6H3zM6 19v2M18 19v2"/><circle cx="7" cy="16" r="1"/><circle cx="17" cy="16" r="1"/>',
      ruler: '<path d="M3 17L17 3l4 4L7 21zM8 16l2 2M11 13l2 2M14 10l2 2"/>'
    };
    var KEYS = [[/notdienst|24.?h|störung|notfall/i, 'phone'], [/pool|schwimm/i, 'pool'], [/solar|photovoltaik|\bpv\b/i, 'sun'], [/heiz|wärme|pellet|kessel|therm/i, 'flame'], [/wasser|bad|sanitär|wc|dusch/i, 'drop'], [/lüft|klima/i, 'fan'], [/wallbox|e-auto|lade/i, 'car'], [/licht|beleucht|lampe/i, 'bulb'], [/smart|steck|netzwerk|lan|edv|daten/i, 'plug'], [/elektro|strom|verteiler|zähler/i, 'bolt'], [/dach|spengler|rinne|eindeck/i, 'roof'], [/fenster|verglas/i, 'window'], [/stiege|treppe/i, 'stairs'], [/tür|portal|tor/i, 'door'], [/holz|zimmer|carport|holzbau/i, 'saw'], [/küche|möbel|schrank|einbau|tischler|innenausbau/i, 'home'], [/maler|streich|anstrich|farbe|spachtel|tapet|fassade/i, 'roller'], [/lasur|lack|boden|parkett/i, 'brush'], [/planung|aufmaß|beratung|maß/i, 'ruler'], [/sanier|reparatur|service|wartung|umbau/i, 'wrench'], [/sicher|schutz|blitz|prüf/i, 'shield'], [/preis|kosten|förder/i, 'euro']];
    $$('#leistungen .card').forEach(function (c) {
      var ico = $('.ico', c), h = $('h3', c); if (!ico || !h) return;
      var txt = h.textContent + ' ' + ($('p', c) || {}).textContent, key = 'check';
      for (var i = 0; i < KEYS.length; i++) if (KEYS[i][0].test(h.textContent)) { key = KEYS[i][1]; break; }
      if (key === 'check') for (var k = 0; k < KEYS.length; k++) if (KEYS[k][0].test(txt)) { key = KEYS[k][1]; break; }
      ico.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + I[key] + '</svg>';
    });
  })();

  /* ---------- Hero: Wort für Wort, Lichtflecken, Spotlight ---------- */
  (function () {
    var hero = $('.hero'); if (!hero) return;
    var h1 = $('h1', hero);
    if (h1 && !reduced) { var words = h1.textContent.trim().split(/\s+/); h1.innerHTML = words.map(function (w, i) { return '<span class="w" style="--i:' + i + '">' + esc(w) + '</span>'; }).join(' '); h1.classList.add('words'); }
    hero.appendChild(el('i', 'blob b1')); hero.appendChild(el('i', 'blob b2'));
    if (fine) hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      hero.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
      hero.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
    });
  })();

  /* ---------- Laufband mit den Leistungen ---------- */
  (function () {
    var hero = $('.hero'), items = $$('#leistungen .card h3').map(function (h) { return h.textContent; });
    if (!hero || items.length < 3) return;
    var row = items.concat(items).map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('');
    var t = el('div', 'ticker', '<div>' + row + row + '</div>');
    hero.parentNode.insertBefore(t, hero.nextSibling);
  })();

  /* ---------- Erscheinen beim Scrollen ---------- */
  (function () {
    var types = ['up', 'left', 'zoom', 'wipe', 'right'];
    var blocks = $$('section, .sr, footer');
    blocks.forEach(function (sec, i) {
      var type = types[i % types.length];
      var targets = $$('.wrap > h2, .wrap > .lead, .wrap > .kicker2, .grid > .card, .photos figure, .about > *, .why > div, .rc-grid > *, .tm-grid > *, .ablauf li, .sr-tabs, .sr-body', sec);
      if (sec.tagName === 'FOOTER') targets = [sec.firstElementChild];
      targets.forEach(function (t, k) { if (!t || t.classList.contains('rv')) return; t.classList.add('rv', 'rv-' + (t.matches('.grid > .card, .photos figure, .why > div, .ablauf li') ? type : 'up')); t.style.setProperty('--i', k % 8); });
    });
    $$('.hero .wrap > *').forEach(function (t, k) { if (t.tagName === 'H1') return; t.classList.add('rv', 'rv-up'); t.style.setProperty('--i', k + 2); });
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: .12, rootMargin: '0px 0px -5% 0px' });
    $$('.rv').forEach(function (t) { io.observe(t); });
  })();

  /* ---------- Punkte-Navigation und Tastatur ---------- */
  (function () {
    var secs = $$('section[id], .sr[id], .hero').filter(function (s) { return s.offsetHeight > 100; });
    if (secs.length < 3) return;
    var nav = el('nav', 'dots'); nav.setAttribute('aria-label', 'Abschnitte');
    secs.forEach(function (s) {
      var name = s.classList.contains('hero') ? 'Start' : ($('h2', s) ? $('h2', s).textContent.replace(/^\d+\s*/, '') : s.id);
      var b = el('button', '', '<span>' + esc(name) + '</span>'); b.type = 'button';
      b.addEventListener('click', function () { s.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }); });
      nav.appendChild(b);
    });
    document.body.appendChild(nav);
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { var i = secs.indexOf(e.target); $$('button', nav).forEach(function (b, k) { b.classList.toggle('active', k === i); }); } }); }, { threshold: .4 });
    secs.forEach(function (s) { io.observe(s); });
    addEventListener('keydown', function (e) {
      if (e.target.matches('input, textarea, select, [contenteditable]')) return;
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'PageDown' && e.key !== 'PageUp') return;
      var y = scrollY + 10, cur = 0;
      secs.forEach(function (s, i) { if (s.offsetTop <= y + 1) cur = i; });
      var next = (e.key === 'ArrowDown' || e.key === 'PageDown') ? Math.min(secs.length - 1, cur + 1) : Math.max(0, cur - 1);
      e.preventDefault(); secs[next].scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    });
  })();

  /* ---------- Zahlen hochzählen ---------- */
  (function () {
    var nodes = $$('.trust b').filter(function (b) { return /\d/.test(b.textContent); });
    if (!nodes.length || reduced) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return; io.unobserve(e.target);
        var b = e.target, txt = b.textContent, m = txt.match(/\d+/), target = Number(m[0]), from = target > 1900 ? target - 40 : 0, t0 = null;
        (function step(ts) { if (!t0) t0 = ts; var t = Math.min(1, (ts - t0) / 1400), k = 1 - Math.pow(1 - t, 3); b.textContent = txt.replace(m[0], Math.round(from + (target - from) * k)); if (t < 1) requestAnimationFrame(step); })(performance.now());
      });
    }, { threshold: .5 });
    nodes.forEach(function (n) { io.observe(n); });
  })();

  /* ---------- Karten neigen ---------- */
  if (fine && !reduced) $$('.grid .card').forEach(function (c) {
    c.addEventListener('pointermove', function (e) { var r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; c.style.transform = 'perspective(800px) rotateX(' + (-y * 8) + 'deg) rotateY(' + (x * 8) + 'deg) translateY(-4px)'; });
    c.addEventListener('pointerleave', function () { c.style.transform = ''; });
  });

  /* ---------- Magnetische Knöpfe ---------- */
  if (fine && !reduced) $$('.btn.p, .call, .sr-tab, .rc-result .btn').forEach(function (b) {
    b.addEventListener('pointermove', function (e) { var r = b.getBoundingClientRect(); b.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * .18) + 'px,' + ((e.clientY - r.top - r.height / 2) * .3) + 'px)'; });
    b.addEventListener('pointerleave', function () { b.style.transform = ''; });
  });

  /* ---------- Mauszeiger-Punkt ---------- */
  if (fine && !reduced) (function () {
    var c = el('div', 'cursor'); document.body.appendChild(c); c.style.opacity = '0';
    addEventListener('pointermove', function (e) { c.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px) translate(-50%,-50%)'; c.style.opacity = ''; var t = e.target.closest && e.target.closest('a, button, .sr-hs, .sr-marker, figure, .sr-act'); c.classList.toggle('big', !!t); });
    document.addEventListener('pointerleave', function () { c.style.opacity = '0'; });
  })();

  /* ---------- Lichtbox ---------- */
  (function () {
    var figs = $$('.photos figure'); if (!figs.length) return;
    var lb = el('div', 'lb', '<button class="lb-x" aria-label="Schließen">×</button><button class="lb-p" aria-label="Zurück">‹</button><button class="lb-n" aria-label="Weiter">›</button><img alt=""><figcaption></figcaption><div class="lb-c"></div>');
    document.body.appendChild(lb);
    var img = $('img', lb), cap = $('figcaption', lb), cnt = $('.lb-c', lb), i = 0;
    function show(k) { i = (k + figs.length) % figs.length; var f = figs[i], im = $('img', f); img.src = im.currentSrc || im.src; img.alt = im.alt; cap.textContent = ($('figcaption', f) || {}).textContent || ''; cnt.textContent = (i + 1) + ' / ' + figs.length; lb.classList.add('on'); document.body.style.overflow = 'hidden'; }
    function hide() { lb.classList.remove('on'); document.body.style.overflow = ''; }
    figs.forEach(function (f, k) { f.addEventListener('click', function () { show(k); }); });
    $('.lb-x', lb).addEventListener('click', hide); $('.lb-p', lb).addEventListener('click', function () { show(i - 1); }); $('.lb-n', lb).addEventListener('click', function () { show(i + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) hide(); });
    addEventListener('keydown', function (e) { if (!lb.classList.contains('on')) return; if (e.key === 'Escape') hide(); if (e.key === 'ArrowRight') show(i + 1); if (e.key === 'ArrowLeft') show(i - 1); });
    var sx = null; lb.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true }); lb.addEventListener('touchend', function (e) { if (sx == null) return; var dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) show(dx < 0 ? i + 1 : i - 1); sx = null; });
  })();

  /* ---------- Richtpreis-Rechner ---------- */
  var CALC = {
    installateur: [
      { label: 'Badsanierung komplett', sub: 'Abbruch, Installation, Fliesen, Sanitärobjekte', fields: [{ k: 'm2', t: 'range', l: 'Badgröße', min: 4, max: 16, d: 7, u: ' m²' }, { k: 'aus', t: 'choice', l: 'Ausstattung', v: [['Standard', 1], ['Komfort', 1.35], ['Premium', 1.8]] }], f: function (v) { var b = v.m2 * 1900 * v.aus; return [b * .85, b * 1.15]; } },
      { label: 'Heizungstausch auf Wärmepumpe', sub: 'Gerät, Hydraulik, Inbetriebnahme, vor Förderung', fields: [{ k: 'kw', t: 'range', l: 'Heizlast', min: 6, max: 16, d: 10, u: ' kW' }, { k: 'q', t: 'choice', l: 'Wärmequelle', v: [['Luft-Wasser', 1], ['Erdwärme', 1.5]] }], f: function (v) { var b = (14000 + v.kw * 1100) * v.q; return [b * .9, b * 1.1]; } },
      { label: 'Waschtisch und Armaturen neu', sub: 'Material und Montage', fields: [{ k: 'n', t: 'range', l: 'Objekte', min: 1, max: 4, d: 2, u: ' Stück' }], f: function (v) { return [v.n * 650, v.n * 1400]; } }
    ],
    elektriker: [
      { label: 'Elektrik neu im Haus', sub: 'Leitungen, Dosen, Verteiler, Abnahme', fields: [{ k: 'm2', t: 'range', l: 'Wohnfläche', min: 50, max: 220, d: 120, step: 10, u: ' m²' }, { k: 's', t: 'choice', l: 'Ausstattung', v: [['Standard', 1], ['Mit Smart Home', 1.3]] }], f: function (v) { var b = v.m2 * 110 * v.s; return [b * .85, b * 1.15]; } },
      { label: 'Photovoltaik mit Speicher', sub: 'Module, Wechselrichter, Montage, Anmeldung', fields: [{ k: 'kwp', t: 'range', l: 'Leistung', min: 4, max: 15, d: 8, u: ' kWp' }, { k: 'b', t: 'choice', l: 'Speicher', v: [['Ohne', 0], ['Mit Speicher', 1]] }], f: function (v) { var b = v.kwp * 1500 + v.b * (v.kwp * 650); return [b * .9, b * 1.15]; } },
      { label: 'Wallbox fürs E-Auto', sub: '11 kW, Leitung bis 15 m, Anmeldung', fields: [{ k: 'l', t: 'range', l: 'Leitungslänge', min: 5, max: 40, d: 12, u: ' m' }], f: function (v) { return [1400 + v.l * 25, 2200 + v.l * 40]; } }
    ],
    maler: [
      { label: 'Wände und Decken streichen', sub: 'Abkleben, Spachteln, zwei Anstriche', fields: [{ k: 'm2', t: 'range', l: 'Fläche', min: 20, max: 400, d: 120, step: 10, u: ' m²' }, { k: 'q', t: 'choice', l: 'Untergrund', v: [['Gut', 1], ['Ausbessern nötig', 1.3]] }], f: function (v) { var b = v.m2 * 11 * v.q; return [b * .85, b * 1.2]; } },
      { label: 'Fassade streichen', sub: 'Gerüst, Reinigung, Grundierung, Anstrich', fields: [{ k: 'm2', t: 'range', l: 'Fassadenfläche', min: 50, max: 400, d: 180, step: 10, u: ' m²' }], f: function (v) { return [v.m2 * 38, v.m2 * 62]; } },
      { label: 'Spachteltechnik', sub: 'Mehrschichtig, versiegelt', fields: [{ k: 'm2', t: 'range', l: 'Wandfläche', min: 5, max: 60, d: 15, u: ' m²' }], f: function (v) { return [v.m2 * 65, v.m2 * 115]; } }
    ],
    tischler: [
      { label: 'Einbauschrank nach Maß', sub: 'Planung, Fertigung, Montage', fields: [{ k: 'b', t: 'range', l: 'Breite', min: 1, max: 4, d: 2, step: .5, u: ' m' }, { k: 'w', t: 'choice', l: 'Front', v: [['Dekor', 1], ['Furnier', 1.3], ['Massivholz', 1.7]] }], f: function (v) { var b = v.b * 1300 * v.w; return [b * .85, b * 1.2]; } },
      { label: 'Küche vom Tischler', sub: 'Korpus, Fronten, Arbeitsplatte, ohne Geräte', fields: [{ k: 'l', t: 'range', l: 'Küchenzeile', min: 3, max: 9, d: 5, step: .5, u: ' lfm' }], f: function (v) { return [v.l * 1900, v.l * 3300]; } },
      { label: 'Innentüren tauschen', sub: 'Tür, Zarge, Beschlag, Montage', fields: [{ k: 'n', t: 'range', l: 'Türen', min: 1, max: 12, d: 5, u: ' Stück' }], f: function (v) { return [v.n * 680, v.n * 1350]; } }
    ],
    dach: [
      { label: 'Dach neu eindecken', sub: 'Gerüst, Lattung, Folie, Eindeckung', fields: [{ k: 'm2', t: 'range', l: 'Dachfläche', min: 60, max: 300, d: 150, step: 10, u: ' m²' }, { k: 'e', t: 'choice', l: 'Eindeckung', v: [['Betondachstein', 1], ['Tondachziegel', 1.2], ['Stehfalzblech', 1.5]] }], f: function (v) { var b = v.m2 * 135 * v.e; return [b * .85, b * 1.15]; } },
      { label: 'Dachflächenfenster', sub: 'Fenster, Eindeckrahmen, Innenverkleidung', fields: [{ k: 'n', t: 'range', l: 'Fenster', min: 1, max: 6, d: 2, u: ' Stück' }], f: function (v) { return [v.n * 1700, v.n * 2900]; } },
      { label: 'Dachrinne und Fallrohr', sub: 'Titanzink, inklusive Montage', fields: [{ k: 'l', t: 'range', l: 'Rinnenlänge', min: 10, max: 60, d: 24, u: ' lfm' }], f: function (v) { return [v.l * 48, v.l * 85]; } }
    ]
  };
  (function () {
    var root = $('[data-rechner]'); if (!root) return;
    var items = CALC[GEWERK]; if (!items) { root.remove(); return; }
    root.innerHTML = '<div class="wrap"><span class="kicker2">In 30 Sekunden</span><h2>Was kostet das ungefähr?</h2><p class="lead">Schieben Sie die Regler, und Sie bekommen sofort einen Richtwert. Das genaue Angebot gibt es nach der Besichtigung, kostenlos.</p>' +
      '<div class="rc-grid"><div class="rc-items">' + items.map(function (it, i) { return '<button type="button" class="rc-item' + (i ? '' : ' active') + '"><b>' + esc(it.label) + '</b><small>' + esc(it.sub) + '</small></button>'; }).join('') + '</div>' +
      '<div class="rc-form"><div class="rc-fields"></div><div class="rc-result"><small>Richtwert inklusive Material und Arbeit</small><strong></strong><a class="btn"></a></div><div class="rc-note">Beispielwerte des Entwurfs. Die Zahlen werden durch die Preise des Betriebs ersetzt. Keine Angebote, keine Gewähr.</div></div></div></div>';
    var fields = $('.rc-fields', root), out = $('.rc-result strong', root), btn = $('.rc-result .btn', root), cur = 0, vals = {};
    function render() {
      var it = items[cur]; vals = {}; fields.innerHTML = '';
      it.fields.forEach(function (f) {
        var row = el('div', 'sr-opt');
        if (f.t === 'range') {
          vals[f.k] = f.d;
          row.innerHTML = '<label>' + esc(f.l) + ' <output>' + f.d + f.u + '</output></label><input type="range" min="' + f.min + '" max="' + f.max + '" step="' + (f.step || 1) + '" value="' + f.d + '">';
          var inp = $('input', row), o = $('output', row);
          inp.addEventListener('input', function () { vals[f.k] = Number(inp.value); o.textContent = inp.value.replace('.', ',') + f.u; calc(); });
        } else {
          vals[f.k] = f.v[0][1];
          row.innerHTML = '<label>' + esc(f.l) + '</label><div class="sr-choices">' + f.v.map(function (v, i) { return '<button type="button" class="sr-choice' + (i ? '' : ' active') + '" data-v="' + v[1] + '">' + esc(v[0]) + '</button>'; }).join('') + '</div>';
          $$('button', row).forEach(function (b) { b.addEventListener('click', function () { $$('button', row).forEach(function (x) { x.classList.remove('active'); }); b.classList.add('active'); vals[f.k] = Number(b.dataset.v); calc(); }); });
        }
        fields.appendChild(row);
      });
      calc();
    }
    function calc() {
      var it = items[cur], r = it.f(vals), txt = money(r[0]) + ' bis ' + money(r[1]);
      out.textContent = txt;
      var summary = it.label + ': ' + it.fields.map(function (f) { if (f.t === 'range') return f.l + ' ' + vals[f.k] + f.u; var c = f.v.filter(function (v) { return v[1] === vals[f.k]; })[0]; return f.l + ' ' + (c ? c[0] : ''); }).join(', ') + '. Richtwert laut Website: ' + txt + '.';
      if (EMAIL) { btn.textContent = 'Richtwert per E-Mail anfragen'; btn.href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent('Anfrage: ' + it.label) + '&body=' + encodeURIComponent('Guten Tag,\n\nich interessiere mich für: ' + summary + '\n\nBitte um Besichtigung und Angebot.\n\nName:\nTelefon:\nAdresse:'); }
      else { btn.textContent = 'Anrufen und besprechen'; btn.href = 'tel:' + TEL; }
    }
    $$('.rc-item', root).forEach(function (b, i) { b.addEventListener('click', function () { cur = i; $$('.rc-item', root).forEach(function (x) { x.classList.remove('active'); }); b.classList.add('active'); render(); }); });
    render();
  })();

  /* ---------- Ablauf ---------- */
  (function () {
    var root = $('[data-ablauf]'); if (!root) return;
    var steps = { installateur: [['Anruf oder Anfrage', 'Sie sagen kurz, worum es geht. Bei Notfällen kommen wir sofort.'], ['Besichtigung', 'Wir schauen uns Bad, Heizung oder Technik an und messen auf.'], ['Fixpreis-Angebot', 'Schriftlich, verständlich, ohne versteckte Posten.'], ['Umsetzung', 'Pünktlich, sauber, mit Übergabe und Einweisung.']],
      elektriker: [['Anfrage', 'Kurz schildern, was Sie brauchen, gern mit Foto vom Verteiler.'], ['Begehung', 'Wir prüfen die Anlage und besprechen Wünsche wie Smart Home oder PV.'], ['Angebot', 'Fixpreis mit Stückliste, Förderungen gleich mitgedacht.'], ['Montage und Abnahme', 'Mit Prüfprotokoll und Anmeldung beim Netzbetreiber.']],
      maler: [['Anfrage', 'Fotos der Räume reichen für eine erste Einschätzung.'], ['Besichtigung', 'Untergrund prüfen, Farbmuster mitbringen, Probefläche streichen.'], ['Angebot', 'Fixpreis pro Raum oder Fläche, Termin fix.'], ['Streichen', 'Abdecken, streichen, aufräumen. Sie ziehen nur die Bilder wieder auf.']],
      tischler: [['Idee besprechen', 'Skizze, Foto oder einfach erzählen, was Sie brauchen.'], ['Aufmaß vor Ort', 'Millimetergenau, auch bei schrägen Wänden.'], ['Zeichnung und Angebot', 'Sie sehen vorher, wie es aussieht. Fixpreis.'], ['Fertigung und Montage', 'Aus unserer Werkstatt, von uns montiert.']],
      dach: [['Anfrage', 'Auch bei Sturmschäden: anrufen, wir kommen.'], ['Dachcheck', 'Wir steigen aufs Dach und zeigen Ihnen Fotos vom Zustand.'], ['Angebot', 'Fixpreis mit Gerüst, Entsorgung und Material.'], ['Ausführung', 'Wetterfest in wenigen Tagen, mit Abnahme und Garantie.']] }[GEWERK];
    if (!steps) { root.remove(); return; }
    root.innerHTML = '<div class="wrap"><span class="kicker2">So läuft es</span><h2>Vom Anruf bis zur Übergabe</h2><ol>' + steps.map(function (s, i) { return '<li style="--i:' + i + '"><b>' + esc(s[0]) + '</b><p>' + esc(s[1]) + '</p></li>'; }).join('') + '</ol></div>';
    var ol = $('ol', root);
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (!e.isIntersecting) return; io.unobserve(e.target); ol.style.setProperty('--fill', '100%'); $$('li', ol).forEach(function (li, i) { setTimeout(function () { li.classList.add('on'); }, reduced ? 0 : 300 + i * 350); }); }); }, { threshold: .3 });
    io.observe(ol);
  })();

  /* ---------- Terminanfrage ---------- */
  (function () {
    var root = $('[data-termin]'); if (!root) return;
    var services = $$('#leistungen .card h3').map(function (h) { return h.textContent; });
    var tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    var min = tomorrow.toISOString().slice(0, 10);
    root.innerHTML = '<div class="wrap"><span class="kicker2">Termin</span><h2>Wunschtermin in einer Minute</h2><p class="lead">Tag und Zeitfenster wählen, kurz sagen, worum es geht. Die Anfrage geht direkt an den Betrieb, Sie bekommen eine Bestätigung.</p>' +
      '<div class="tm-grid"><form class="tm-form" novalidate>' +
      '<div><label>Worum geht es?</label><select name="anliegen">' + services.map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('') + '<option>Etwas anderes</option></select></div>' +
      '<div class="tm-row"><div><label>Wunschtag</label><input type="date" name="tag" min="' + min + '" value="' + min + '"></div><div><label>Zeitfenster</label><div class="tm-slots"><button type="button" class="active">Vormittag 7–12</button><button type="button">Nachmittag 12–17</button><button type="button">Egal</button></div></div></div>' +
      '<div class="tm-row"><div><label>Ihr Name</label><input name="name" autocomplete="name" placeholder="Max Mustermann"></div><div><label>Telefon für Rückruf</label><input name="tel" type="tel" autocomplete="tel" placeholder="0664 …"></div></div>' +
      '<div><label>Adresse und kurze Beschreibung</label><textarea name="msg" placeholder="Straße, Ort. Was soll gemacht werden?"></textarea></div>' +
      '<div class="tm-actions"><button type="submit" class="btn p">' + (EMAIL ? 'Anfrage per E-Mail senden' : 'Anfrage per SMS senden') + '</button>' + (TEL ? '<a class="btn o" href="tel:' + esc(TEL) + '">Lieber anrufen</a>' : '') + '</div>' +
      '</form><div class="tm-side"><div class="card"><h3>So geht es weiter</h3><p>Sie bekommen innerhalb eines Werktags eine Rückmeldung mit fixem Termin. Besichtigung und Angebot sind kostenlos.</p></div><div class="card"><h3>Ihre Nachricht</h3><div class="tm-preview"></div></div></div></div></div>';
    var form = $('form', root), prev = $('.tm-preview', root), slot = 'Vormittag 7–12';
    $$('.tm-slots button', root).forEach(function (b) { b.addEventListener('click', function () { $$('.tm-slots button', root).forEach(function (x) { x.classList.remove('active'); }); b.classList.add('active'); slot = b.textContent; build(); }); });
    function build() {
      var f = form.elements, d = f.tag.value ? new Date(f.tag.value).toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long' }) : 'nach Vereinbarung';
      var txt = 'Terminanfrage: ' + f.anliegen.value + '\nWunschtermin: ' + d + ', ' + slot + '\nName: ' + (f.name.value || '…') + '\nTelefon: ' + (f.tel.value || '…') + '\n' + (f.msg.value || '');
      prev.textContent = txt; return txt;
    }
    form.addEventListener('input', build); build();
    form.addEventListener('submit', function (e) {
      e.preventDefault(); var txt = build();
      if (EMAIL) location.href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent('Terminanfrage: ' + form.elements.anliegen.value) + '&body=' + encodeURIComponent(txt + '\n\nGesendet über die Website.');
      else if (TEL) location.href = 'sms:' + TEL.replace(/\s/g, '') + '?&body=' + encodeURIComponent(txt);
    });
  })();
})();
