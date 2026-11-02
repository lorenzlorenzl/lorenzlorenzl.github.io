/* Showroom: anklickbare Szenen je Gewerk. Reines JavaScript, keine externen Dateien.
   Jede Szene hat Reiter (Tabs). Jeder Reiter ist eine SVG-Zeichnung mit leuchtenden Punkten (Hotspots).
   Tippt man auf einen Punkt, zoomt die Kamera hin, etwas bewegt sich, und rechts erscheinen Details mit Optionen. */
(function () {
  'use strict';

  var SCENES = {};
  var TRANSITIONS = ['push', 'wipe', 'zoom', 'flip', 'fade'];
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function rep(n, fn) { var out = []; for (var i = 0; i < n; i++) out.push(fn(i)); return out.join(''); }
  function mix(a, b, t) { // Farben #rrggbb mischen
    var pa = [1, 3, 5].map(function (i) { return parseInt(a.substr(i, 2), 16); });
    var pb = [1, 3, 5].map(function (i) { return parseInt(b.substr(i, 2), 16); });
    return '#' + pa.map(function (v, i) { var x = Math.round(v + (pb[i] - v) * t); return ('0' + x.toString(16)).slice(-2); }).join('');
  }
  function fmt(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  /* ---------- Engine ---------- */
  function Showroom(root, scene) {
    this.root = root; this.scene = scene; this.tabIndex = -1; this.trIndex = 0; this.open = null; this.controls = [];
    root.classList.add('sr');
    root.innerHTML =
      '<div class="wrap">' +
      '<span class="kicker2">' + esc(root.dataset.kicker || 'Zum Anklicken') + '</span>' +
      '<h2>' + esc(root.dataset.title || scene.title) + '</h2>' +
      '<p class="lead">' + esc(root.dataset.lead || scene.lead) + '</p>' +
      '<div class="sr-tabs" role="tablist"></div>' +
      '<div class="sr-body">' +
      '<div class="sr-stagecol"><div class="sr-toolbar"></div><div class="sr-stage-wrap"><div class="sr-hint">Tippen Sie auf die leuchtenden Punkte</div></div></div>' +
      '<aside class="sr-panel" hidden></aside>' +
      '</div></div>';
    this.tabsEl = root.querySelector('.sr-tabs');
    this.toolbarEl = root.querySelector('.sr-toolbar');
    this.wrap = root.querySelector('.sr-stage-wrap');
    this.panel = root.querySelector('.sr-panel');
    var self = this;
    scene.tabs.forEach(function (t, i) {
      var b = el('button', 'sr-tab', esc(t.label)); b.type = 'button'; b.setAttribute('role', 'tab');
      b.addEventListener('click', function () { self.showTab(i); });
      self.tabsEl.appendChild(b);
    });
    this.showTab(0);
    this.setupTour();
  }

  /* Automatische Kamerafahrt: sobald der Showroom sichtbar ist, fliegt die Kamera einmal alle Punkte ab,
     bis der Besucher selbst eingreift. */
  Showroom.prototype.setupTour = function () {
    var self = this, done = false, label = el('div', 'sr-tourlabel');
    this.wrap.appendChild(label);
    function stop() { done = true; self.touring = false; label.classList.remove('on'); clearTimeout(self.tourTimer); }
    this.root.addEventListener('pointerdown', stop, true);
    this.tabsEl.addEventListener('click', stop, true);
    if (reduced || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting || done) return;
      io.disconnect(); done = true; self.touring = true;
      var hs = (self.tab.hotspots || []).filter(function (h) { return h.at; }), i = 0;
      function step() {
        if (!self.touring) return;
        if (i >= hs.length) { label.classList.remove('on'); self.zoomTo(null); self.touring = false; return; }
        var h = hs[i++], target = self.svg.querySelector(h.zoom || '[data-hs="' + h.id + '"]:not(.sr-marker)'), box = null;
        try { box = target && target.getBBox(); } catch (e) { box = null; }
        self.zoomTo(box && box.width ? box : null);
        label.textContent = h.title; label.classList.add('on');
        Array.prototype.forEach.call(self.svg.querySelectorAll('.sr-marker'), function (m) { m.classList.toggle('active', m.getAttribute('data-hs') === h.id); });
        self.tourTimer = setTimeout(step, 2300);
      }
      self.tourTimer = setTimeout(step, 900);
    }, { threshold: .6 });
    io.observe(this.wrap);
  };

  Showroom.prototype.showTab = function (i) {
    if (i === this.tabIndex) return;
    this.closePanel(true);
    var dir = i > this.tabIndex ? 1 : -1;
    this.tabIndex = i;
    var tab = this.tab = this.scene.tabs[i];
    Array.prototype.forEach.call(this.tabsEl.children, function (b, k) { b.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
    if (!tab.state) tab.state = JSON.parse(JSON.stringify(tab.initial || {}));
    this.state = tab.state;

    var stage = el('div', 'sr-stage');
    stage.innerHTML = tab.svg();
    var svg = this.svg = stage.querySelector('svg');
    this.vb0 = svg.getAttribute('viewBox').split(/\s+/).map(Number); this.vb = this.vb0.slice();
    this.addMarkers(tab, svg);
    var self = this;
    svg.addEventListener('click', function (e) { self.onSvgClick(e); });
    if (tab.drag) this.bindDrag(svg, tab);

    var old = this.wrap.querySelector('.sr-stage');
    var tr = reduced ? 'fade' : TRANSITIONS[this.trIndex++ % TRANSITIONS.length];
    stage.dataset.dir = dir;
    this.wrap.appendChild(stage);
    if (old) {
      old.dataset.dir = dir; old.classList.add('out-' + tr); stage.classList.add('in-' + tr);
      setTimeout(function () { old.remove(); stage.classList.remove('in-' + tr); }, 850);
    }
    this.renderToolbar(tab);
    var hint = this.wrap.querySelector('.sr-hint'); if (hint) hint.textContent = tab.hint || 'Tippen Sie auf die leuchtenden Punkte';
    if (tab.init) tab.init(svg, this.state, this);
    this.update();
  };

  Showroom.prototype.addMarkers = function (tab, svg) {
    var ns = 'http://www.w3.org/2000/svg';
    (tab.hotspots || []).forEach(function (hs) {
      if (!hs.at) return;
      var g = document.createElementNS(ns, 'g');
      g.setAttribute('class', 'sr-marker'); g.setAttribute('data-hs', hs.id);
      g.setAttribute('transform', 'translate(' + hs.at[0] + ' ' + hs.at[1] + ')');
      g.innerHTML = '<circle class="pulse" r="18"/><circle class="dot" r="8"/><title>' + esc(hs.title) + '</title>';
      svg.appendChild(g);
    });
  };

  Showroom.prototype.onSvgClick = function (e) {
    var act = e.target.closest ? e.target.closest('[data-act]') : null;
    if (act && this.svg.contains(act)) {
      var key = act.getAttribute('data-act');
      this.state[key] = !this.state[key];
      this.update();
      e.stopPropagation();
      return;
    }
    var t = e.target.closest ? e.target.closest('[data-hs]') : null;
    if (t && this.svg.contains(t)) this.openHotspot(t.getAttribute('data-hs'));
  };

  Showroom.prototype.bindDrag = function (svg, tab) {
    var self = this, down = false;
    function pos(e) {
      var r = svg.getBoundingClientRect();
      var x = self.vb[0] + (e.clientX - r.left) / r.width * self.vb[2];
      var y = self.vb[1] + (e.clientY - r.top) / r.height * self.vb[3];
      return [x, y];
    }
    svg.addEventListener('pointerdown', function (e) { down = true; svg.setPointerCapture(e.pointerId); var p = pos(e); tab.drag(self.state, p[0], p[1]); self.update(); });
    svg.addEventListener('pointermove', function (e) { if (!down) return; var p = pos(e); tab.drag(self.state, p[0], p[1]); self.update(); });
    svg.addEventListener('pointerup', function () { down = false; });
    svg.addEventListener('pointercancel', function () { down = false; });
  };

  Showroom.prototype.zoomTo = function (box) {
    var target;
    if (!box) target = this.vb0.slice();
    else {
      var minW = this.vb0[2] * 0.38;
      var w = Math.max(box.width * 1.35, minW), h = Math.max(box.height * 1.35, minW * this.vb0[3] / this.vb0[2]);
      var ar = this.vb0[2] / this.vb0[3];
      if (w / h < ar) w = h * ar; else h = w / ar;
      w = Math.min(w, this.vb0[2]); h = Math.min(h, this.vb0[3]);
      var x = box.x + box.width / 2 - w / 2, y = box.y + box.height / 2 - h / 2;
      x = Math.max(this.vb0[0], Math.min(x, this.vb0[0] + this.vb0[2] - w));
      y = Math.max(this.vb0[1], Math.min(y, this.vb0[1] + this.vb0[3] - h));
      target = [x, y, w, h];
    }
    var from = this.vb.slice(), self = this, svg = this.svg, t0 = null, dur = reduced ? 1 : 750;
    if (this.raf) cancelAnimationFrame(this.raf);
    function step(ts) {
      if (!t0) t0 = ts;
      var t = Math.min(1, (ts - t0) / dur), k = ease(t);
      self.vb = from.map(function (v, i) { return v + (target[i] - v) * k; });
      svg.setAttribute('viewBox', self.vb.join(' '));
      if (t < 1) self.raf = requestAnimationFrame(step);
    }
    this.raf = requestAnimationFrame(step);
  };

  Showroom.prototype.openHotspot = function (id) {
    var hs = (this.tab.hotspots || []).filter(function (h) { return h.id === id; })[0];
    if (!hs) return;
    this.touring = false; clearTimeout(this.tourTimer);
    var tl = this.wrap.querySelector('.sr-tourlabel'); if (tl) tl.classList.remove('on');
    if (this.open && this.open !== hs) Object.assign(this.state, this.open.onClose || {});
    this.open = hs;
    Object.assign(this.state, hs.onOpen || {});
    var target = this.svg.querySelector(hs.zoom || '[data-hs="' + id + '"]:not(.sr-marker)');
    var box = null;
    try { box = target && target.getBBox(); } catch (e) { box = null; }
    this.zoomTo(box && box.width ? box : null);
    this.renderPanel(hs);
    this.panel.hidden = false;
    this.root.classList.add('sr-open');
    Array.prototype.forEach.call(this.svg.querySelectorAll('.sr-marker'), function (m) { m.classList.toggle('active', m.getAttribute('data-hs') === id); });
    this.update();
    if (window.innerWidth < 900) this.panel.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' });
  };

  Showroom.prototype.closePanel = function (silent) {
    if (!this.open) return;
    Object.assign(this.state, this.open.onClose || {});
    this.open = null;
    this.panel.hidden = true;
    this.root.classList.remove('sr-open');
    if (this.svg) Array.prototype.forEach.call(this.svg.querySelectorAll('.sr-marker'), function (m) { m.classList.remove('active'); });
    if (!silent) { this.zoomTo(null); this.update(); }
  };

  Showroom.prototype.renderPanel = function (hs) {
    var self = this;
    this.panel.innerHTML =
      '<button type="button" class="sr-close" aria-label="Schließen">×</button>' +
      (hs.kicker ? '<div class="sr-kicker">' + esc(hs.kicker) + '</div>' : '') +
      '<h3>' + esc(hs.title) + '</h3>' +
      '<p>' + hs.text + '</p>' +
      '<div class="sr-opts"></div><div class="sr-info"></div>';
    this.panel.querySelector('.sr-close').addEventListener('click', function () { self.closePanel(false); });
    this.panelControls = this.renderControls(this.panel.querySelector('.sr-opts'), hs.options || []);
    this.refreshInfo();
  };

  Showroom.prototype.renderToolbar = function (tab) {
    this.toolbarEl.innerHTML = '';
    this.toolbarControls = this.renderControls(this.toolbarEl, tab.toolbar || []);
    this.toolbarEl.hidden = !(tab.toolbar && tab.toolbar.length);
  };

  Showroom.prototype.renderControls = function (container, opts) {
    var self = this, list = [];
    opts.forEach(function (o) {
      var row = el('div', 'sr-opt sr-opt-' + o.type);
      var ctrl = { sync: function () {} };
      if (o.type === 'choice' || o.type === 'swatch') {
        row.innerHTML = '<label>' + esc(o.label) + '</label><div class="sr-choices"></div>';
        var box = row.querySelector('.sr-choices');
        var btns = o.values.map(function (v) {
          var b = el('button', 'sr-choice', o.type === 'swatch' ? '<i style="background:' + (v[2] || v[0]) + '"></i><span>' + esc(v[1]) + '</span>' : esc(v[1]));
          b.type = 'button'; b.dataset.value = v[0];
          b.addEventListener('click', function () { self.state[o.key] = v[0]; self.update(); });
          box.appendChild(b); return b;
        });
        ctrl.sync = function () { btns.forEach(function (b) { b.classList.toggle('active', String(self.state[o.key]) === String(b.dataset.value)); }); };
      } else if (o.type === 'range') {
        row.innerHTML = '<label>' + esc(o.label) + ' <output></output></label><input type="range" min="' + o.min + '" max="' + o.max + '" step="' + (o.step || 1) + '">';
        var inp = row.querySelector('input'), out = row.querySelector('output');
        inp.addEventListener('input', function () { self.state[o.key] = Number(inp.value); self.update(); });
        ctrl.sync = function () { inp.value = self.state[o.key]; out.textContent = (o.format ? o.format(self.state[o.key]) : self.state[o.key] + (o.unit || '')); };
      } else if (o.type === 'toggle') {
        row.innerHTML = '<button type="button" class="sr-switch" role="switch"><span class="knob"></span></button><label>' + esc(o.label) + '</label>';
        var sw = row.querySelector('button');
        sw.addEventListener('click', function () { self.state[o.key] = !self.state[o.key]; self.update(); });
        row.querySelector('label').addEventListener('click', function () { sw.click(); });
        ctrl.sync = function () { sw.setAttribute('aria-checked', self.state[o.key] ? 'true' : 'false'); };
      } else if (o.type === 'buttons') {
        row.innerHTML = '<label>' + esc(o.label) + '</label><div class="sr-choices"></div>';
        var bx = row.querySelector('.sr-choices');
        o.values.forEach(function (v) {
          var b = el('button', 'sr-choice', esc(v.label)); b.type = 'button';
          b.addEventListener('click', function () { Object.assign(self.state, typeof v.set === 'function' ? v.set(self.state) : v.set); self.update(); });
          bx.appendChild(b);
        });
      }
      container.appendChild(row);
      list.push(ctrl);
    });
    return list;
  };

  Showroom.prototype.refreshInfo = function () {
    if (!this.open) return;
    var info = this.panel.querySelector('.sr-info');
    if (info) info.innerHTML = this.open.info ? this.open.info(this.state) : '';
  };

  Showroom.prototype.update = function () {
    if (this.tab.update) this.tab.update(this.svg, this.state, this);
    (this.toolbarControls || []).forEach(function (c) { c.sync(); });
    (this.panelControls || []).forEach(function (c) { c.sync(); });
    this.refreshInfo();
  };

  /* ---------- gemeinsame Zeichenhilfen ---------- */
  var DEFS = {
    chrome: '<linearGradient id="chrome" x1="0" x2="1"><stop offset="0" stop-color="#f4f6f8"/><stop offset=".5" stop-color="#9aa3ad"/><stop offset="1" stop-color="#e3e7eb"/></linearGradient>',
    black: '<linearGradient id="black" x1="0" x2="1"><stop offset="0" stop-color="#3a3d42"/><stop offset=".5" stop-color="#15171a"/><stop offset="1" stop-color="#3a3d42"/></linearGradient>',
    brass: '<linearGradient id="brass" x1="0" x2="1"><stop offset="0" stop-color="#f3dc9a"/><stop offset=".5" stop-color="#b8892e"/><stop offset="1" stop-color="#ecd28a"/></linearGradient>',
    water: '<linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fdcff" stop-opacity=".95"/><stop offset="1" stop-color="#2f93dc" stop-opacity=".8"/></linearGradient>',
    glass: '<linearGradient id="glass" x1="0" x2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".45"/><stop offset="1" stop-color="#cfe6f5" stop-opacity=".3"/></linearGradient>',
    led: '<radialGradient id="led"><stop offset="0" stop-color="#fff8d6"/><stop offset="1" stop-color="#fff8d6" stop-opacity="0"/></radialGradient>',
    sky: '<linearGradient id="skyday" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fc9ff"/><stop offset="1" stop-color="#e8f4ff"/></linearGradient><linearGradient id="skynight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1a33"/><stop offset="1" stop-color="#1f3358"/></linearGradient>',
    tiles: '<pattern id="tl" width="50" height="50" patternUnits="userSpaceOnUse"><rect width="50" height="50" fill="#eef1f4"/><path d="M0 0H50V50" fill="none" stroke="#dfe4ea" stroke-width="2"/></pattern><pattern id="tf" width="60" height="60" patternUnits="userSpaceOnUse"><rect width="60" height="60" fill="#c9ccd1"/><path d="M0 0H60V60" fill="none" stroke="#b9bdc4" stroke-width="2"/></pattern>',
    parquet: '<pattern id="pq" width="120" height="24" patternUnits="userSpaceOnUse"><rect width="120" height="24" fill="#d9b98a"/><path d="M0 12H120M60 0V12M0 12V24M120 12V24" stroke="#c49a62" stroke-width="2" fill="none"/></pattern>'
  };
  function wood(id, a, b) {
    return '<pattern id="' + id + '" width="60" height="200" patternUnits="userSpaceOnUse"><rect width="60" height="200" fill="' + a + '"/>' +
      '<path d="M8 0c6 40-6 80 2 120s-4 60 0 80M28 0c-6 40 8 80 0 120s6 60 2 80M48 0c4 40-8 80-2 120s8 60 4 80" fill="none" stroke="' + b + '" stroke-width="2" opacity=".7"/></pattern>';
  }
  var SVG_OPEN = '<svg viewBox="0 0 1000 600" xmlns="http://www.w3.org/2000/svg" role="img">';

  /* ---------- INSTALLATEUR ---------- */
  SCENES.installateur = {
    title: 'Erleben Sie Bad, Heizung und Schwimmbad, bevor gebaut wird',
    lead: 'Jeder Punkt lässt sich antippen: Wasser läuft, Türen öffnen sich, die Wärmepumpe springt an, die Poolpumpe rechnet mit. So besprechen wir Ihr Projekt, bevor der erste Handgriff passiert.',
    tabs: [
      {
        label: 'Bad',
        initial: { finish: 'chrom', flow: 6, water: false, mcOpen: false, led: false, rain: false, temp: 20, heat: false },
        svg: function () {
          return SVG_OPEN + '<defs>' + DEFS.tiles + DEFS.chrome + DEFS.black + DEFS.brass + DEFS.water + DEFS.glass + DEFS.led + '</defs>' +
            '<rect width="1000" height="440" fill="url(#tl)"/><rect y="440" width="1000" height="160" fill="url(#tf)"/>' +
            '<rect x="700" y="60" width="200" height="130" rx="6" fill="#dff1ff" stroke="#fff" stroke-width="8"/><path d="M800 60V190M700 125H900" stroke="#fff" stroke-width="6"/>' +
            // Dusche
            '<g data-hs="sh" class="sr-hs">' +
            '<rect x="70" y="70" width="240" height="380" fill="url(#glass)" stroke="#aeb7c0" stroke-width="3"/>' +
            '<rect x="178" y="70" width="16" height="60" fill="url(#chrome)"/><path d="M146 130h88l-6 14h-76z" fill="url(#chrome)"/>' +
            '<g id="sh-rain" class="rain" style="display:none" stroke="#6fbdf0" stroke-width="3" stroke-linecap="round">' +
            rep(9, function (i) { return '<line x1="' + (154 + i * 9) + '" y1="148" x2="' + (150 + i * 9) + '" y2="440"/>'; }) + '</g>' +
            '<rect x="80" y="440" width="220" height="8" fill="#9aa3ad"/>' +
            '<rect x="96" y="250" width="12" height="60" rx="3" fill="url(#chrome)"/><circle cx="102" cy="246" r="9" fill="url(#chrome)"/>' +
            '</g>' +
            // Waschtisch
            '<g data-hs="wb" class="sr-hs">' +
            '<rect x="400" y="330" width="220" height="18" rx="4" fill="#f7f8fa" stroke="#cfd5db"/>' +
            '<rect x="420" y="348" width="180" height="92" rx="6" fill="#ffffff" stroke="#cfd5db"/><rect x="430" y="392" width="160" height="4" fill="#dfe4ea"/>' +
            '<ellipse cx="510" cy="340" rx="70" ry="14" fill="#fff" stroke="#cfd5db"/><ellipse cx="510" cy="340" rx="56" ry="9" fill="#e9eef3"/>' +
            '<g id="wb-tap" fill="url(#chrome)"><rect x="502" y="290" width="16" height="44" rx="4"/><path d="M510 296c0-16 32-16 32 0v20h-10v-18c0-7-12-7-12 0z"/><rect x="496" y="282" width="28" height="8" rx="3"/></g>' +
            '<g id="wb-water" style="display:none"><path id="wb-stream" d="M537 316v22" stroke="#3aa0e6" stroke-width="5" opacity=".85" stroke-linecap="round" fill="none"/>' +
            '<ellipse class="ripple" cx="537" cy="340" rx="8" ry="2.5" fill="none" stroke="#6fbdf0" stroke-width="1.5"/><ellipse class="ripple r2" cx="537" cy="340" rx="8" ry="2.5" fill="none" stroke="#6fbdf0" stroke-width="1.5"/></g>' +
            '</g>' +
            // Spiegelschrank
            '<g data-hs="mc" class="sr-hs">' +
            '<rect x="420" y="100" width="180" height="160" rx="6" fill="#f3f5f7" stroke="#b9c0c8" stroke-width="3"/>' +
            '<g id="mc-inside"><rect x="426" y="106" width="168" height="148" fill="#e8ecf0"/><path d="M426 160H594M426 210H594" stroke="#b9c0c8" stroke-width="3"/>' +
            '<rect x="440" y="130" width="14" height="28" rx="3" fill="#2b7fd5"/><rect x="460" y="124" width="12" height="34" rx="3" fill="#e0a21b"/><rect x="500" y="136" width="30" height="22" rx="3" fill="#f28c8c"/><rect x="545" y="118" width="18" height="40" rx="4" fill="#4caf7f"/>' +
            '<rect x="440" y="186" width="40" height="22" rx="3" fill="#9fb6c9"/><rect x="500" y="178" width="12" height="30" rx="3" fill="#333"/><rect x="516" y="178" width="12" height="30" rx="3" fill="#e14e4e"/><rect x="548" y="190" width="30" height="18" rx="3" fill="#fff" stroke="#b9c0c8"/></g>' +
            '<g id="mc-ledglow" style="display:none"><ellipse cx="510" cy="100" rx="140" ry="34" fill="url(#led)"/></g>' +
            '<rect id="mc-led" x="430" y="96" width="160" height="4" rx="2" fill="#d8dde3"/>' +
            '<g id="mc-doorL" class="sr-door" style="transform-origin:420px 180px"><rect x="420" y="100" width="90" height="160" rx="4" fill="#dfe9f1" stroke="#b9c0c8" stroke-width="2"/><path d="M430 240L500 120" stroke="#fff" stroke-width="6" opacity=".7"/><rect x="498" y="170" width="6" height="22" rx="2" fill="#9aa3ad"/></g>' +
            '<g id="mc-doorR" class="sr-door" style="transform-origin:600px 180px"><rect x="510" y="100" width="90" height="160" rx="4" fill="#dfe9f1" stroke="#b9c0c8" stroke-width="2"/><path d="M520 240L590 120" stroke="#fff" stroke-width="6" opacity=".7"/><rect x="516" y="170" width="6" height="22" rx="2" fill="#9aa3ad"/></g>' +
            '</g>' +
            // Handtuchheizkörper
            '<g data-hs="rad" class="sr-hs">' +
            '<rect x="770" y="230" width="12" height="200" rx="6" fill="#f2f4f6" stroke="#aeb7c0"/><rect x="878" y="230" width="12" height="200" rx="6" fill="#f2f4f6" stroke="#aeb7c0"/>' +
            '<g id="rad-rungs" stroke="#dfe4ea" stroke-width="8" stroke-linecap="round">' + rep(10, function (i) { return '<line x1="776" y1="' + (248 + i * 20) + '" x2="884" y2="' + (248 + i * 20) + '"/>'; }) + '</g>' +
            '<rect x="800" y="300" width="60" height="70" rx="6" fill="#f7a9a9"/>' +
            '<g id="rad-heat" class="shimmer" style="display:none" fill="none" stroke="#ff9a5c" stroke-width="3" opacity=".7"><path d="M790 222c10-15 10-25 0-40"/><path d="M830 222c10-15 10-25 0-40"/><path d="M870 222c10-15 10-25 0-40"/></g>' +
            '</g>' +
            '<g><rect x="930" y="400" width="40" height="40" rx="4" fill="#b78f6a"/><circle cx="950" cy="385" r="28" fill="#5aa96b"/></g>' +
            '</svg>';
        },
        update: function (svg, s) {
          var q = function (id) { return svg.querySelector('#' + id); };
          q('wb-water').style.display = s.water ? '' : 'none';
          q('wb-stream').setAttribute('stroke-width', 2 + s.flow * 0.7);
          q('wb-tap').setAttribute('fill', { chrom: 'url(#chrome)', schwarz: 'url(#black)', messing: 'url(#brass)' }[s.finish]);
          q('mc-doorL').style.transform = s.mcOpen ? 'scaleX(.18) skewY(-14deg)' : '';
          q('mc-doorR').style.transform = s.mcOpen ? 'scaleX(.18) skewY(14deg)' : '';
          q('mc-led').setAttribute('fill', s.led ? '#fff2b3' : '#d8dde3');
          q('mc-ledglow').style.display = s.led ? '' : 'none';
          q('sh-rain').style.display = s.rain ? '' : 'none';
          var t = (s.temp - 20) / 40;
          q('rad-rungs').setAttribute('stroke', mix('#dfe4ea', '#ff6b3d', t));
          q('rad-heat').style.display = s.heat && s.temp > 25 ? '' : 'none';
        },
        hotspots: [
          { id: 'wb', at: [560, 300], kicker: 'Sanitär', title: 'Waschtisch mit Einhebelmischer', text: 'Tippen Sie, und das Wasser läuft. Oberfläche, Durchfluss und Unterschrank stimmen wir auf Ihr Bad ab. Montage samt Anschluss an einem Tag.',
            onOpen: { water: true }, onClose: { water: false },
            options: [{ type: 'choice', key: 'finish', label: 'Oberfläche der Armatur', values: [['chrom', 'Chrom'], ['schwarz', 'Schwarz matt'], ['messing', 'Messing gebürstet']] }, { type: 'range', key: 'flow', label: 'Durchfluss', min: 3, max: 9, unit: ' l/min' }],
            info: function (s) { return '<b>Verbrauch:</b> ' + (s.flow * 3) + ' Liter bei drei Minuten Händewaschen. Mit Durchflussbegrenzer sparen Sie ' + Math.round((1 - s.flow / 9) * 100) + ' % gegenüber 9 l/min.'; } },
          { id: 'mc', at: [510, 110], kicker: 'Möbel & Licht', title: 'Spiegelschrank mit LED', text: 'Die Türen öffnen sich, und Sie sehen, was hineinpasst: drei Böden in Griffhöhe, Steckdose innen, Licht über dem Spiegel.',
            onOpen: { mcOpen: true, led: true }, onClose: { mcOpen: false, led: false },
            options: [{ type: 'toggle', key: 'mcOpen', label: 'Türen offen' }, { type: 'toggle', key: 'led', label: 'LED-Beleuchtung' }],
            info: function () { return '<b>Stauraum:</b> drei Böden, zusammen etwa 90 cm Ablage. <b>Licht:</b> warmweiß, dimmbar, 8 Watt.'; } },
          { id: 'sh', at: [190, 110], kicker: 'Dusche', title: 'Bodengleiche Dusche mit Regenbrause', text: 'Ohne Stufe, mit Glaswand und Rinne. Regenbrause oben, Handbrause an der Stange. Rutschhemmende Fliesen im Duschbereich.',
            onOpen: { rain: true }, onClose: { rain: false },
            options: [{ type: 'toggle', key: 'rain', label: 'Regenbrause an' }],
            info: function () { return '<b>Einbau:</b> Duschrinne mit Gefälle im Estrich, 3 bis 4 Tage Bauzeit inklusive Abdichtung nach ÖNORM B 3407.'; } },
          { id: 'rad', at: [830, 220], kicker: 'Wärme', title: 'Handtuchheizkörper', text: 'Warm, wenn Sie aus der Dusche kommen. Elektrisch oder am Heizkreis, mit Thermostat. Schieben Sie die Temperatur hoch und sehen Sie ihn glühen.',
            onOpen: { heat: true, temp: 45 }, onClose: { heat: false, temp: 20 },
            options: [{ type: 'range', key: 'temp', label: 'Vorlauftemperatur', min: 20, max: 60, unit: ' °C' }],
            info: function (s) { return '<b>Leistung:</b> etwa ' + Math.round(300 + (s.temp - 20) * 12) + ' Watt bei ' + s.temp + ' °C. Reicht für ein Bad bis 8 m².'; } }
        ]
      },
      {
        label: 'Heizung',
        initial: { typ: 'luft', fan: false, ufh: false, tank: 500, target: 21, solar: false },
        svg: function () {
          return SVG_OPEN + '<defs>' + DEFS.sky + DEFS.chrome + '</defs>' +
            '<rect width="1000" height="520" fill="url(#skyday)"/><rect y="520" width="1000" height="80" fill="#7d8c5a"/>' +
            '<rect x="150" y="520" width="600" height="70" fill="#8d8f96"/>' + // Keller
            '<g id="hz-rooms"><rect x="160" y="160" width="290" height="175" fill="#fbf7ef"/><rect x="450" y="160" width="290" height="175" fill="#fbf7ef"/><rect x="160" y="335" width="290" height="185" fill="#fbf7ef"/><rect x="450" y="335" width="290" height="185" fill="#fbf7ef"/></g>' +
            '<path d="M150 160L450 40L750 160" fill="#b2503a"/><rect x="150" y="160" width="600" height="360" fill="none" stroke="#5a4634" stroke-width="8"/><path d="M450 160V520M150 335H750" stroke="#5a4634" stroke-width="6"/>' +
            '<g id="hz-solar" data-hs="sol" class="sr-hs"><g id="hz-solarpanel" style="display:none"><path d="M520 130L600 98L690 128L610 162z" fill="#1d3a6b" stroke="#9fc1ff" stroke-width="2"/><path d="M548 118l80-32M575 106l80 32M604 146l80-32" stroke="#9fc1ff" stroke-width="1.5"/></g><circle cx="900" cy="90" r="36" fill="#ffd66b"/></g>' +
            // Heizkörper oben
            '<rect x="190" y="280" width="110" height="46" rx="4" fill="#fff" stroke="#9aa3ad"/><path d="M200 280v46M215 280v46M230 280v46M245 280v46M260 280v46M275 280v46M290 280v46" stroke="#cfd5db"/>' +
            '<rect x="620" y="280" width="110" height="46" rx="4" fill="#fff" stroke="#9aa3ad"/><path d="M630 280v46M645 280v46M660 280v46M675 280v46M690 280v46M705 280v46M720 280v46" stroke="#cfd5db"/>' +
            // Fußbodenheizung unten links
            '<g data-hs="ufh" class="sr-hs"><rect x="166" y="490" width="278" height="26" fill="#e9e4d8"/>' +
            '<path id="hz-ufh" class="flow" d="M175 496h260c6 0 6 7 0 7h-260c-6 0-6 7 0 7h260" fill="none" stroke="#e06a3a" stroke-width="3"/></g>' +
            // Thermostat unten rechts
            '<g data-hs="thermo" class="sr-hs"><rect x="560" y="400" width="70" height="44" rx="6" fill="#fff" stroke="#9aa3ad" stroke-width="2"/><text id="hz-temp" x="595" y="430" text-anchor="middle" font-size="22" font-family="system-ui" fill="#1b222c">21°</text></g>' +
            '<rect x="470" y="420" width="90" height="100" fill="#c9a079"/><rect x="660" y="430" width="60" height="90" fill="#8cb6d8" opacity=".7"/>' + // Möbel
            // Pufferspeicher Keller
            '<g data-hs="tank" class="sr-hs"><rect x="440" y="528" width="70" height="60" rx="10" fill="#d8dde3" stroke="#7b848d" stroke-width="2"/><rect id="hz-level" x="444" y="560" width="62" height="24" rx="6" fill="#ff8a5c"/><text x="475" y="596" text-anchor="middle" font-size="11" font-family="system-ui" fill="#1b222c">Puffer</text></g>' +
            '<path id="hz-pipe" class="flow" d="M820 500H760V560H512" fill="none" stroke="#e06a3a" stroke-width="4"/><path d="M820 512H770V572H512" fill="none" stroke="#3c8dd6" stroke-width="4" class="flow rev"/>' +
            // Wärmepumpe
            '<g data-hs="hp" class="sr-hs"><rect x="800" y="420" width="130" height="100" rx="8" fill="#eceff2" stroke="#7b848d" stroke-width="3"/><circle cx="845" cy="470" r="34" fill="#dfe4ea" stroke="#7b848d" stroke-width="2"/>' +
            '<g id="hz-fan" class="spin" style="--spd:1.4s"><path d="M845 470l-4-28h8zM845 470l24 14-4 7zM845 470l-24 14 4 7z" fill="#5a6473"/></g><circle cx="845" cy="470" r="5" fill="#7b848d"/><rect x="890" y="440" width="28" height="60" rx="3" fill="#cfd5db"/></g>' +
            '</svg>';
        },
        update: function (svg, s) {
          var q = function (id) { return svg.querySelector('#' + id); };
          q('hz-fan').style.display = s.fan ? '' : 'none';
          q('hz-fan').style.setProperty('--spd', { luft: '1.4s', erde: '2.2s', pellets: '3s' }[s.typ]);
          q('hz-ufh').classList.toggle('flow', s.ufh); q('hz-ufh').setAttribute('stroke', s.ufh ? '#e06a3a' : '#c9b9a8');
          q('hz-pipe').classList.toggle('flow', s.fan);
          var lvl = 12 + (s.tank - 300) / 700 * 44;
          q('hz-level').setAttribute('y', 584 - lvl); q('hz-level').setAttribute('height', lvl);
          q('hz-temp').textContent = s.target + '°';
          var warm = mix('#fbf7ef', '#ffd9b8', (s.target - 18) / 6);
          Array.prototype.forEach.call(svg.querySelectorAll('#hz-rooms rect'), function (r) { r.setAttribute('fill', warm); });
          q('hz-solarpanel').style.display = s.solar ? '' : 'none';
        },
        hotspots: [
          { id: 'hp', at: [865, 410], kicker: 'Heizung', title: 'Wärmepumpe statt Öl oder Gas', text: 'Der Ventilator läuft, sobald Sie hinsehen. Luft-Wasser-Wärmepumpen stellen wir in wenigen Tagen um, Erdwärme braucht eine Bohrung, Pellets einen Lagerraum.',
            onOpen: { fan: true }, onClose: { fan: false },
            options: [{ type: 'choice', key: 'typ', label: 'Wärmequelle', values: [['luft', 'Luft-Wasser'], ['erde', 'Erdwärme'], ['pellets', 'Pellets']] }],
            info: function (s) { return { luft: '<b>Luft-Wasser:</b> Außengerät, kein Bohren, meist 8 bis 12 kW für ein Einfamilienhaus. Förderung Bund und Land Oberösterreich möglich.', erde: '<b>Erdwärme:</b> Tiefenbohrung 80 bis 120 m, sehr leise, höchste Effizienz, auch zum Kühlen im Sommer.', pellets: '<b>Pellets:</b> Holz aus der Region, Lagerraum etwa 6 m², Ascheentleerung wenige Male im Jahr.' }[s.typ]; } },
          { id: 'ufh', at: [300, 480], kicker: 'Wärmeverteilung', title: 'Fußbodenheizung', text: 'Das Wasser fließt durch die Rohrschlangen im Estrich. Niedrige Vorlauftemperatur, ideal mit Wärmepumpe, keine Heizkörper im Weg.',
            onOpen: { ufh: true }, onClose: { ufh: false },
            options: [{ type: 'toggle', key: 'ufh', label: 'Heizkreis an' }],
            info: function () { return '<b>Vorlauf:</b> 30 bis 35 °C statt 55 °C beim Heizkörper. Nachrüstung auch als Dünnschichtsystem ab 2 cm Aufbau.'; } },
          { id: 'tank', at: [475, 528], kicker: 'Speicher', title: 'Pufferspeicher', text: 'Er hält Wärme vor, damit die Pumpe nicht ständig anspringt. Die Größe hängt von Haus und Warmwasserbedarf ab.',
            options: [{ type: 'range', key: 'tank', label: 'Speichergröße', min: 300, max: 1000, step: 50, unit: ' Liter' }],
            info: function (s) { return '<b>Passt für:</b> ' + (s.tank < 500 ? 'ein Haus mit 2 bis 3 Personen' : s.tank < 800 ? 'eine Familie mit 4 bis 5 Personen' : 'ein Mehrfamilienhaus oder Solarthermie') + '. Platzbedarf etwa ' + Math.round(60 + s.tank / 20) + ' cm Durchmesser.'; } },
          { id: 'thermo', at: [595, 390], kicker: 'Regelung', title: 'Raumthermostat und App', text: 'Jeder Raum bekommt seine Temperatur. Steuerung am Thermostat oder vom Handy aus, auch von der Baustelle.',
            options: [{ type: 'range', key: 'target', label: 'Wunschtemperatur', min: 18, max: 24, unit: ' °C' }],
            info: function (s) { return '<b>Faustregel:</b> jedes Grad weniger spart etwa 6 % Heizkosten. Bei ' + s.target + ' °C statt 22 °C sind das rund ' + Math.round((22 - s.target) * 6) + ' %.'; } },
          { id: 'sol', at: [610, 90], kicker: 'Dach', title: 'Solarthermie oder Photovoltaik', text: 'Die Sonne hilft mit: Solarthermie macht Warmwasser, Photovoltaik macht Strom für die Wärmepumpe. Wir planen beides mit dem Elektriker.',
            onOpen: { solar: true }, onClose: { solar: false },
            options: [{ type: 'toggle', key: 'solar', label: 'Kollektor am Dach' }],
            info: function () { return '<b>Ertrag:</b> 6 m² Kollektor decken im Sommer das Warmwasser einer Familie, im Jahr etwa 60 %.'; } }
        ]
      },
      {
        label: 'Schwimmbad',
        initial: { model: 'eco', volume: 45, filter: 'sand', backwash: false, temp: 26, heat: false, light: 'none' },
        svg: function () {
          return SVG_OPEN + '<defs>' + DEFS.sky + DEFS.chrome + '<radialGradient id="plglow"><stop offset="0" stop-color="var(--pl, #fff)" stop-opacity=".9"/><stop offset="1" stop-color="var(--pl, #fff)" stop-opacity="0"/></radialGradient></defs>' +
            '<rect width="1000" height="300" fill="url(#skyday)"/><rect y="300" width="1000" height="300" fill="#8a7a62"/>' +
            '<circle cx="900" cy="80" r="36" fill="#ffd66b"/>' +
            '<g fill="#5aa96b"><ellipse cx="70" cy="250" rx="60" ry="40"/><ellipse cx="960" cy="240" rx="70" ry="50"/><rect x="60" y="250" width="20" height="30" fill="#8a5a3a"/><rect x="950" y="240" width="22" height="40" fill="#8a5a3a"/></g>' +
            '<path d="M0 282h1000v-14c-80 0-120-10-200-10s-120 10-200 10-120-8-200-8-120 10-200 10-120-6-200-6z" fill="#6f9a52"/>' +
            '<g><rect x="160" y="240" width="110" height="14" rx="6" fill="#e8e0c8"/><path d="M160 247l-20-30h30" fill="#e8e0c8"/><rect x="170" y="254" width="8" height="26" fill="#c9c0a8"/><rect x="250" y="254" width="8" height="26" fill="#c9c0a8"/><rect x="290" y="150" width="6" height="130" fill="#c9c0a8"/><path d="M230 160h130l-20 0 0 0" fill="none"/><path d="M225 160h135l-25-20h-85z" fill="#e8741c" opacity=".9"/></g>' +
            '<rect x="0" y="280" width="1000" height="22" fill="#d9cfb8"/>' +
            // Becken
            '<g data-hs="light" class="sr-hs"><path d="M80 300V520H560V300" fill="#dfe8ec" stroke="#aeb7c0" stroke-width="6"/>' +
            '<rect id="pl-water" x="83" y="322" width="474" height="196" fill="#3aa8e0" opacity=".85"/>' +
            '<path class="wave" d="M83 322c40-12 80-12 120 0s80 12 120 0 80-12 120 0 80 12 114 0v12H83z" fill="#8fd6ff" opacity=".8"/>' +
            '<circle id="pl-lampglow" cx="300" cy="470" r="120" fill="url(#plglow)" style="display:none"/><circle cx="300" cy="470" r="12" fill="#fff" stroke="#aeb7c0" stroke-width="3"/>' +
            '<rect x="540" y="310" width="26" height="30" fill="#e9eef3" stroke="#aeb7c0"/></g>' + // Skimmer
            // Technik
            '<rect x="600" y="300" width="360" height="220" fill="#c9ccd1" stroke="#7b848d" stroke-width="4"/><text x="780" y="330" text-anchor="middle" font-size="16" font-family="system-ui" fill="#5a6473">Technikraum</text>' +
            '<path id="pl-in" class="flow" d="M566 330H640V400H660" fill="none" stroke="#2f93dc" stroke-width="6"/>' +
            '<path id="pl-mid" class="flow" d="M740 440H860V420" fill="none" stroke="#2f93dc" stroke-width="6"/>' +
            '<path id="pl-out" class="flow" d="M860 340V330H700V480H120V495" fill="none" stroke="#2f93dc" stroke-width="6"/>' +
            // Pumpe
            '<g data-hs="pump" class="sr-hs"><rect x="690" y="420" width="60" height="60" rx="6" fill="#4a4f57"/><circle cx="700" cy="440" r="40" fill="#e6e9ed" stroke="#7b848d" stroke-width="3"/>' +
            '<g id="pl-imp" class="spin" style="--spd:.9s"><path d="M700 440l-6-30h12zM700 440l28 10-4 10zM700 440l-24 18-6-9z" fill="#2f93dc"/></g><circle cx="700" cy="440" r="6" fill="#4a4f57"/></g>' +
            // Filter
            '<g data-hs="filter" class="sr-hs"><rect x="830" y="340" width="60" height="100" rx="30" fill="#dfe4ea" stroke="#7b848d" stroke-width="3"/><rect id="pl-sand" x="836" y="380" width="48" height="52" rx="20" fill="#e5c882"/><rect x="846" y="330" width="28" height="14" rx="4" fill="#4a4f57"/></g>' +
            // Poolwärmepumpe
            '<g data-hs="heat" class="sr-hs"><rect x="620" y="340" width="60" height="50" rx="6" fill="#eceff2" stroke="#7b848d" stroke-width="2"/><circle cx="650" cy="365" r="16" fill="#dfe4ea" stroke="#7b848d"/><g id="pl-hpfan" class="spin" style="--spd:1.2s;display:none"><path d="M650 365l-2-13h4zM650 365l11 6-2 3zM650 365l-11 6 2 3z" fill="#5a6473"/></g></g>' +
            '<text id="pl-tempt" x="320" y="420" text-anchor="middle" font-size="40" font-family="system-ui" font-weight="700" fill="#fff" opacity=".85">26 °C</text>' +
            '</svg>';
        },
        update: function (svg, s) {
          var q = function (id) { return svg.querySelector('#' + id); };
          var M = { std: { kw: 0.55, q: 8, spd: '1.3s', name: 'Standardpumpe 0,55 kW' }, eco: { kw: 0.45, q: 10, spd: '1s', name: 'Eco-Pumpe mit variabler Drehzahl' }, pro: { kw: 1.1, q: 16, spd: '.55s', name: 'Hochleistungspumpe 1,1 kW' } }[s.model];
          q('pl-imp').style.setProperty('--spd', M.spd);
          ['pl-in', 'pl-mid', 'pl-out'].forEach(function (id) { q(id).classList.toggle('rev', s.backwash); });
          q('pl-sand').setAttribute('fill', s.filter === 'sand' ? '#e5c882' : '#bfe3e8');
          q('pl-sand').classList.toggle('shake', s.backwash);
          q('pl-water').setAttribute('fill', mix('#2f8fd0', '#39c2c8', (s.temp - 22) / 8));
          q('pl-tempt').textContent = s.temp + ' °C';
          q('pl-hpfan').style.display = s.heat ? '' : 'none';
          var col = { none: null, weiss: '#ffffff', blau: '#4db8ff', tuerkis: '#3ff0d0', violett: '#b48bff' }[s.light];
          q('pl-lampglow').style.display = col ? '' : 'none';
          if (col) svg.style.setProperty('--pl', col);
        },
        hotspots: [
          { id: 'pump', at: [700, 395], kicker: 'Schwimmbadtechnik', title: 'Filterpumpe wählen und anpassen', text: 'Das Laufrad dreht sich je nach Pumpe schneller oder langsamer. Stellen Sie Ihr Beckenvolumen ein, und wir rechnen Umwälzzeit und Stromkosten vor.',
            options: [{ type: 'choice', key: 'model', label: 'Pumpe', values: [['std', 'Standard 0,55 kW'], ['eco', 'Eco variabel'], ['pro', 'Hochleistung 1,1 kW']] }, { type: 'range', key: 'volume', label: 'Beckenvolumen', min: 15, max: 90, step: 5, unit: ' m³' }],
            info: function (s) {
              var M = { std: [0.55, 8], eco: [0.45, 10], pro: [1.1, 16] }[s.model];
              var hours = s.volume / M[1], daily = hours * 2, cost = daily * M[0] * 0.30;
              return '<b>Umwälzzeit:</b> ' + hours.toFixed(1) + ' Stunden für einmal Beckeninhalt. <b>Laufzeit:</b> ' + daily.toFixed(1) + ' h am Tag bei zwei Umwälzungen. <b>Strom:</b> etwa ' + cost.toFixed(2).replace('.', ',') + ' € am Tag, rund ' + fmt(cost * 150) + ' € pro Saison (Beispiel 30 ct/kWh).' + (s.model === 'eco' ? ' Die Eco-Pumpe läuft nachts gedrosselt und spart so bis zu 70 %.' : '');
            } },
          { id: 'filter', at: [860, 320], kicker: 'Wasserpflege', title: 'Filterkessel', text: 'Sand oder Filterglas, dazu Rückspülen auf Knopfdruck. Beim Rückspülen kehrt die Strömung um, das sehen Sie an den Leitungen.',
            onClose: { backwash: false },
            options: [{ type: 'choice', key: 'filter', label: 'Filtermedium', values: [['sand', 'Quarzsand'], ['glas', 'Filterglas']] }, { type: 'toggle', key: 'backwash', label: 'Rückspülen' }],
            info: function (s) { return s.filter === 'sand' ? '<b>Quarzsand:</b> bewährt, günstig, Tausch alle 3 bis 5 Jahre.' : '<b>Filterglas:</b> feinere Filterung, weniger Rückspülwasser, hält 10 Jahre und länger.'; } },
          { id: 'heat', at: [650, 325], kicker: 'Komfort', title: 'Pool-Wärmepumpe', text: 'Verlängert die Saison von Mai bis September. Die Wassertemperatur stellen Sie ein, die Farbe des Wassers zeigt, wie warm es wird.',
            onOpen: { heat: true }, onClose: { heat: false },
            options: [{ type: 'range', key: 'temp', label: 'Wassertemperatur', min: 22, max: 30, unit: ' °C' }],
            info: function (s) { return '<b>Leistung:</b> für ' + s.volume + ' m³ empfehlen wir etwa ' + Math.round(s.volume / 5) + ' kW. Mit Abdeckung halbieren sich die Heizkosten.'; } },
          { id: 'light', at: [300, 445], kicker: 'Abend', title: 'Unterwasserbeleuchtung', text: 'LED-Scheinwerfer in der Beckenwand, Farbe per Fernbedienung oder App. Tippen Sie eine Farbe an.',
            onOpen: { light: 'blau' }, onClose: { light: 'none' },
            options: [{ type: 'swatch', key: 'light', label: 'Lichtfarbe', values: [['weiss', 'Weiß', '#ffffff'], ['blau', 'Blau', '#4db8ff'], ['tuerkis', 'Türkis', '#3ff0d0'], ['violett', 'Violett', '#b48bff']] }],
            info: function () { return '<b>Technik:</b> 12 Volt, 20 Watt je Scheinwerfer, Einbau auch nachträglich in bestehende Becken.'; } }
        ]
      }
    ]
  };
  /* ---------- ELEKTRIKER ---------- */
  SCENES.elektriker = {
    title: 'Licht, Sicherung, Sonnenstrom: alles zum Ausprobieren',
    lead: 'Schalten Sie das Licht in jedem Raum, fahren Sie die Rollläden, öffnen Sie den Verteiler und legen Sie Module aufs Dach. Was Sie hier anklicken, bauen wir ein.',
    tabs: [
      {
        label: 'Smart Home',
        initial: { night: false, l1: false, l2: false, l3: false, l4: false, roll: 0, target: 21 },
        toolbar: [{ type: 'toggle', key: 'night', label: 'Nacht' }],
        svg: function () {
          function room(x, y, n) {
            return '<g><rect class="eh-room" x="' + x + '" y="' + y + '" width="290" height="175" fill="#fbf7ef"/>' +
              '<rect class="eh-win" x="' + (x + 30) + '" y="' + (y + 30) + '" width="70" height="90" fill="#bfe0ff" stroke="#fff" stroke-width="4"/>' +
              '<rect id="eh-roll' + n + '" x="' + (x + 30) + '" y="' + (y + 30) + '" width="70" height="0" fill="#9aa3ad"/>' +
              '<g data-act="l' + n + '" class="sr-act"><line x1="' + (x + 180) + '" y1="' + y + '" x2="' + (x + 180) + '" y2="' + (y + 40) + '" stroke="#5a6473" stroke-width="2"/>' +
              '<path d="M' + (x + 160) + ' ' + (y + 60) + 'l20-22 20 22z" fill="#5a6473"/><circle id="eh-lamp' + n + '" cx="' + (x + 180) + '" cy="' + (y + 60) + '" r="7" fill="#d8dde3"/>' +
              '<ellipse id="eh-glow' + n + '" cx="' + (x + 180) + '" cy="' + (y + 100) + '" rx="90" ry="70" fill="url(#led)" style="display:none"/></g>' +
              '<rect x="' + (x + 200) + '" y="' + (y + 120) + '" width="70" height="40" rx="6" fill="#c9a079"/></g>';
          }
          return SVG_OPEN + '<defs>' + DEFS.sky + DEFS.led + '</defs>' +
            '<rect id="eh-sky" width="1000" height="520" fill="url(#skyday)"/><g id="eh-stars" style="display:none" fill="#fff">' + rep(30, function (i) { return '<circle cx="' + ((i * 97) % 1000) + '" cy="' + ((i * 53) % 150 + 10) + '" r="' + (1 + i % 2) + '"/>'; }) + '</g>' +
            '<circle id="eh-sun" cx="900" cy="90" r="36" fill="#ffd66b"/><path id="eh-moon" d="M900 54a36 36 0 1 0 0 72 28 28 0 1 1 0-72z" fill="#f4f1dc" style="display:none"/>' +
            '<rect y="520" width="1000" height="80" fill="#7d8c5a"/>' +
            room(160, 160, 1) + room(450, 160, 2) + room(160, 335, 3) + room(450, 335, 4) +
            '<path d="M150 160L450 40L750 160" fill="#5f6b78"/><rect x="150" y="160" width="600" height="360" fill="none" stroke="#5a4634" stroke-width="8"/><path d="M450 160V520M150 335H750" stroke="#5a4634" stroke-width="6"/>' +
            '<g data-hs="licht"><rect x="440" y="100" width="20" height="20" fill="none"/></g>' +
            '<g data-hs="rollo" class="sr-hs"><rect x="180" y="180" width="80" height="100" fill="none"/></g>' +
            '<g data-hs="thermo" class="sr-hs"><rect x="560" y="400" width="70" height="44" rx="6" fill="#fff" stroke="#9aa3ad" stroke-width="2"/><text id="eh-temp" x="595" y="430" text-anchor="middle" font-size="22" font-family="system-ui" fill="#1b222c">21°</text></g>' +
            '<g data-hs="wall" class="sr-hs"><rect x="800" y="380" width="120" height="140" rx="8" fill="#eceff2" stroke="#7b848d" stroke-width="3"/><rect x="820" y="400" width="80" height="50" rx="4" fill="#1b222c"/><text id="eh-wall" x="860" y="432" text-anchor="middle" font-size="18" font-family="system-ui" fill="#5df2a6">11 kW</text><path d="M860 450v70" stroke="#4a4f57" stroke-width="8"/><rect x="930" y="470" width="50" height="50" fill="none"/><rect x="880" y="505" width="90" height="15" rx="3" fill="#3b4a5a"/><circle cx="900" cy="520" r="10" fill="#1b222c"/><circle cx="950" cy="520" r="10" fill="#1b222c"/></g>' +
            '</svg>';
        },
        update: function (svg, s) {
          var q = function (id) { return svg.querySelector('#' + id); };
          q('eh-sky').setAttribute('fill', s.night ? 'url(#skynight)' : 'url(#skyday)');
          q('eh-stars').style.display = s.night ? '' : 'none'; q('eh-sun').style.display = s.night ? 'none' : ''; q('eh-moon').style.display = s.night ? '' : 'none';
          var rooms = svg.querySelectorAll('.eh-room');
          for (var n = 1; n <= 4; n++) {
            var on = s['l' + n];
            q('eh-lamp' + n).setAttribute('fill', on ? '#fff0a8' : '#d8dde3');
            q('eh-glow' + n).style.display = on ? '' : 'none';
            rooms[n - 1].setAttribute('fill', s.night ? (on ? '#f3e6c8' : '#2d3340') : '#fbf7ef');
            q('eh-roll' + n).setAttribute('height', 90 * s.roll / 100);
          }
          Array.prototype.forEach.call(svg.querySelectorAll('.eh-win'), function (w) { w.setAttribute('fill', s.night ? '#1f3358' : '#bfe0ff'); });
          q('eh-temp').textContent = s.target + '°';
        },
        hotspots: [
          { id: 'licht', at: [450, 110], kicker: 'Smart Home', title: 'Licht in jedem Raum', text: 'Tippen Sie direkt auf eine Lampe im Haus oder schalten Sie hier. Szenen wie „Abend“ oder „Alles aus“ legen wir auf einen Taster neben der Haustür und aufs Handy.',
            options: [{ type: 'toggle', key: 'l1', label: 'Schlafzimmer' }, { type: 'toggle', key: 'l2', label: 'Bad' }, { type: 'toggle', key: 'l3', label: 'Wohnzimmer' }, { type: 'toggle', key: 'l4', label: 'Küche' },
              { type: 'buttons', label: 'Szenen', values: [{ label: 'Alles an', set: { l1: true, l2: true, l3: true, l4: true } }, { label: 'Abend', set: { l1: false, l2: false, l3: true, l4: true, night: true } }, { label: 'Alles aus', set: { l1: false, l2: false, l3: false, l4: false } }] }],
            info: function (s) { var n = ['l1', 'l2', 'l3', 'l4'].filter(function (k) { return s[k]; }).length; return '<b>Gerade an:</b> ' + n + ' von 4 Räumen. Mit LED etwa ' + (n * 9) + ' Watt statt ' + (n * 60) + ' Watt mit Glühbirnen.'; } },
          { id: 'rollo', at: [220, 170], kicker: 'Beschattung', title: 'Rollläden mit Motor', text: 'Fahren Sie die Rollläden. Nachrüstung mit Funkmotor ohne Stemmarbeiten, Zeitsteuerung und Sonnensensor inklusive.',
            onOpen: { roll: 60 }, onClose: { roll: 0 },
            options: [{ type: 'range', key: 'roll', label: 'Position', min: 0, max: 100, step: 10, unit: ' %' }],
            info: function () { return '<b>Nutzen:</b> im Sommer bis zu 5 °C kühlere Räume, im Winter weniger Wärmeverlust über die Fenster.'; } },
          { id: 'thermo', at: [595, 390], kicker: 'Regelung', title: 'Heizung vom Handy', text: 'Thermostate je Raum, verbunden mit der Heizung. Urlaub, Heimkommen, Nachtabsenkung: alles automatisch.',
            options: [{ type: 'range', key: 'target', label: 'Wunschtemperatur', min: 18, max: 24, unit: ' °C' }],
            info: function (s) { return '<b>Ersparnis:</b> rund ' + Math.round((22 - s.target) * 6) + ' % Heizkosten gegenüber 22 °C.'; } },
          { id: 'wall', at: [860, 370], kicker: 'E-Mobilität', title: 'Wallbox fürs E-Auto', text: 'Laden über Nacht mit 11 kW, Lastmanagement mit dem Haus und Überschussladen von der Photovoltaik. Förderfähig.',
            info: function () { return '<b>Dauer:</b> 60 kWh in etwa 5,5 Stunden. Anmeldung beim Netzbetreiber übernehmen wir.'; } }
        ]
      },
      {
        label: 'Verteiler',
        initial: { door: false, fi: true },
        svg: function () {
          var labels = ['Küche', 'Bad', 'Wohnen', 'Schlafen', 'Keller', 'Garage', 'Herd', 'Spüler', 'Waschen', 'Außen', 'Heizung', 'Licht EG', 'Licht OG', 'Steckd. OG', 'PV', 'Wallbox', 'Reserve', 'Reserve'];
          var rows = rep(3, function (r) {
            return '<rect x="330" y="' + (150 + r * 120) + '" width="340" height="8" fill="#7b848d"/>' +
              rep(6, function (c) {
                var i = r * 6 + c;
                return '<g data-act="b' + i + '" class="sr-act"><rect x="' + (340 + c * 54) + '" y="' + (120 + r * 120) + '" width="44" height="70" rx="3" fill="#f4f6f8" stroke="#9aa3ad"/>' +
                  '<rect id="vt-lev' + i + '" x="' + (352 + c * 54) + '" y="' + (134 + r * 120) + '" width="20" height="22" rx="3" fill="#2f8f5a"/>' +
                  '<text x="' + (362 + c * 54) + '" y="' + (204 + r * 120) + '" text-anchor="middle" font-size="9" font-family="system-ui" fill="#5a6473">' + labels[i] + '</text></g>';
              });
          });
          return SVG_OPEN + '<defs>' + DEFS.tiles + '</defs><rect width="1000" height="600" fill="#eef1f4"/><rect y="520" width="1000" height="80" fill="#c9ccd1"/>' +
            '<g data-hs="fi" class="sr-hs"><rect x="110" y="120" width="120" height="100" rx="4" fill="#fff" stroke="#9aa3ad" stroke-width="2"/><text x="170" y="150" text-anchor="middle" font-size="16" font-weight="700" font-family="system-ui" fill="#1b222c">FI 30 mA</text><rect id="vt-fi" x="150" y="165" width="40" height="30" rx="4" fill="#2f8f5a"/><text x="170" y="212" text-anchor="middle" font-size="10" font-family="system-ui" fill="#5a6473">Test monatlich</text></g>' +
            '<g data-hs="spd" class="sr-hs"><rect x="110" y="260" width="120" height="80" rx="4" fill="#fff" stroke="#9aa3ad" stroke-width="2"/><text x="170" y="290" text-anchor="middle" font-size="14" font-weight="700" font-family="system-ui" fill="#1b222c">Überspannung</text><path d="M160 300l10 14-8 0 8 16-18-18 8 0z" fill="#e0a21b"/></g>' +
            '<g data-hs="door" class="sr-hs"><rect x="300" y="80" width="400" height="440" rx="6" fill="#f7f8fa" stroke="#7b848d" stroke-width="4"/>' + rows +
            '<g id="vt-door" class="sr-door" style="transform-origin:300px 300px"><rect x="300" y="80" width="400" height="440" rx="6" fill="#eceff2" stroke="#7b848d" stroke-width="4"/><rect x="660" y="280" width="10" height="40" rx="3" fill="#7b848d"/><text x="500" y="300" text-anchor="middle" font-size="22" font-family="system-ui" fill="#9aa3ad">Verteiler</text></g></g>' +
            '<g data-hs="smart" class="sr-hs"><rect x="780" y="120" width="120" height="180" rx="6" fill="#fff" stroke="#9aa3ad" stroke-width="2"/><rect x="795" y="135" width="90" height="60" rx="4" fill="#1b222c"/><text x="840" y="172" text-anchor="middle" font-size="14" font-family="system-ui" fill="#5df2a6">3,2 kW</text><text x="840" y="225" text-anchor="middle" font-size="12" font-family="system-ui" fill="#5a6473">Smart Meter</text><rect x="800" y="240" width="80" height="40" rx="4" fill="#dfe4ea"/></g>' +
            '</svg>';
        },
        init: function (svg, s) { for (var i = 0; i < 18; i++) if (s['b' + i] === undefined) s['b' + i] = true; },
        update: function (svg, s) {
          svg.querySelector('#vt-door').style.transform = s.door ? 'scaleX(.12) skewY(-10deg)' : '';
          for (var i = 0; i < 18; i++) { var lev = svg.querySelector('#vt-lev' + i); if (lev) { lev.setAttribute('fill', s['b' + i] ? '#2f8f5a' : '#d64545'); lev.setAttribute('y', (134 + Math.floor(i / 6) * 120) + (s['b' + i] ? 0 : 26)); } }
          svg.querySelector('#vt-fi').setAttribute('fill', s.fi ? '#2f8f5a' : '#d64545');
        },
        hotspots: [
          { id: 'door', at: [500, 70], kicker: 'Verteiler', title: 'Ihr neuer Sicherungskasten', text: 'Die Tür geht auf. Jeder Stromkreis hat seinen Automaten und ist beschriftet. Tippen Sie auf einen Schalter, um ihn auszulösen.',
            onOpen: { door: true }, onClose: { door: false },
            options: [{ type: 'buttons', label: 'Alle Stromkreise', values: [{ label: 'Alle ein', set: function () { var o = {}; for (var i = 0; i < 18; i++) o['b' + i] = true; return o; } }, { label: 'Nur Licht', set: function () { var o = {}; for (var i = 0; i < 18; i++) o['b' + i] = (i === 11 || i === 12); return o; } }] }],
            info: function (s) { var off = 0; for (var i = 0; i < 18; i++) if (!s['b' + i]) off++; return '<b>Stand:</b> ' + (18 - off) + ' von 18 Stromkreisen eingeschaltet. Verteiler nach ÖVE/ÖNORM E 8101, mit Platzreserve für PV und Wallbox.'; } },
          { id: 'fi', at: [170, 110], kicker: 'Schutz', title: 'FI-Schutzschalter', text: 'Löst in 30 Millisekunden aus, wenn Strom über einen Menschen fließt. Pflicht in Bad, Küche und außen. Einmal im Monat die Prüftaste drücken.',
            options: [{ type: 'toggle', key: 'fi', label: 'FI eingeschaltet' }],
            info: function (s) { return s.fi ? '<b>Zustand:</b> alles geschützt.' : '<b>Ausgelöst:</b> so sieht es aus, wenn ein Gerät einen Fehler hat. Wir finden die Ursache und tauschen das Gerät oder die Leitung.'; } },
          { id: 'spd', at: [170, 250], kicker: 'Schutz', title: 'Überspannungsschutz', text: 'Ein Blitz in der Nähe reicht, um Fernseher, Wärmepumpe und Router zu zerstören. Der Ableiter im Verteiler fängt die Spitze ab.',
            info: function () { return '<b>Pflicht</b> bei neuen Anlagen seit 2019, Nachrüstung in einer Stunde.'; } },
          { id: 'smart', at: [840, 110], kicker: 'Messen', title: 'Smart Meter und Energiemonitor', text: 'Sie sehen am Handy, was das Haus gerade verbraucht und was die PV liefert. Große Verbraucher laufen automatisch dann, wenn die Sonne scheint.',
            info: function () { return '<b>Beispiel:</b> Waschmaschine startet um 11 Uhr bei Sonnenschein, Wallbox lädt mit PV-Überschuss.'; } }
        ]
      },
      {
        label: 'Photovoltaik',
        initial: { mods: 12, battery: true, sun: true },
        svg: function () {
          return SVG_OPEN + '<defs>' + DEFS.sky + '</defs><rect width="1000" height="520" fill="url(#skyday)"/><rect y="520" width="1000" height="80" fill="#7d8c5a"/>' +
            '<g id="pv-sun" class="spin" style="--spd:30s"><g stroke="#ffd66b" stroke-width="6" stroke-linecap="round">' + rep(8, function (i) { var a = i * Math.PI / 4; return '<line x1="' + (880 + Math.cos(a) * 50) + '" y1="' + (90 + Math.sin(a) * 50) + '" x2="' + (880 + Math.cos(a) * 68) + '" y2="' + (90 + Math.sin(a) * 68) + '"/>'; }) + '</g></g><circle cx="880" cy="90" r="40" fill="#ffd66b"/>' +
            '<rect x="200" y="280" width="500" height="240" fill="#fbf7ef" stroke="#5a4634" stroke-width="8"/>' +
            '<g data-hs="roof" class="sr-hs"><path id="pv-roof" d="M180 280L450 110L720 280z" fill="#7d8591"/><g id="pv-mods"></g></g>' +
            '<rect x="420" y="400" width="60" height="120" fill="#5a4634"/><rect x="250" y="330" width="80" height="80" fill="#bfe0ff" stroke="#fff" stroke-width="4"/><rect x="560" y="330" width="80" height="80" fill="#bfe0ff" stroke="#fff" stroke-width="4"/>' +
            '<g data-hs="bat" class="sr-hs"><rect x="760" y="400" width="90" height="120" rx="8" fill="#eceff2" stroke="#7b848d" stroke-width="3"/><rect x="772" y="412" width="66" height="96" rx="4" fill="#dfe4ea"/><rect id="pv-level" x="772" y="460" width="66" height="48" rx="4" fill="#2f8f5a"/><text x="805" y="470" text-anchor="middle" font-size="12" font-family="system-ui" fill="#fff">Speicher</text></g>' +
            '<path id="pv-flow1" class="flow" d="M700 300H740V420H760" fill="none" stroke="#e0a21b" stroke-width="5"/>' +
            '<g data-hs="wr" class="sr-hs"><rect x="880" y="430" width="80" height="60" rx="6" fill="#fff" stroke="#7b848d" stroke-width="2"/><text x="920" y="455" text-anchor="middle" font-size="11" font-family="system-ui" fill="#5a6473">Wechselrichter</text><text id="pv-kw" x="920" y="478" text-anchor="middle" font-size="16" font-weight="700" font-family="system-ui" fill="#2f8f5a">5,2 kW</text></g>' +
            '<path class="flow" d="M850 460H880" fill="none" stroke="#e0a21b" stroke-width="5"/>' +
            '</svg>';
        },
        update: function (svg, s) {
          var g = svg.querySelector('#pv-mods'), out = '', n = s.mods, perRow = [4, 6, 8, 10], y = 0, i = 0;
          // Module in Reihen von oben nach unten ins Dachdreieck
          for (var r = 0; r < perRow.length && i < n; r++) {
            var count = Math.min(perRow[r], n - i), rowY = 150 + r * 34, width = count * 44;
            for (var c = 0; c < count; c++, i++) out += '<rect x="' + (450 - width / 2 + c * 44 + 2) + '" y="' + rowY + '" width="40" height="30" rx="2" fill="#17325e" stroke="#8fc1ff" stroke-width="1.5"/>';
          }
          g.innerHTML = out;
          var kwp = n * 0.43;
          svg.querySelector('#pv-kw').textContent = (kwp * (s.sun ? 0.75 : 0)).toFixed(1).replace('.', ',') + ' kW';
          svg.querySelector('#pv-level').style.display = s.battery ? '' : 'none';
          svg.querySelector('#pv-flow1').classList.toggle('flow', s.sun);
          svg.querySelector('#pv-sun').style.display = s.sun ? '' : 'none';
        },
        hotspots: [
          { id: 'roof', at: [450, 100], kicker: 'Photovoltaik', title: 'Module aufs Dach legen', text: 'Schieben Sie den Regler, und das Dach füllt sich. Wir rechnen Leistung und Jahresertrag mit, abgestimmt auf Dachneigung und Ausrichtung.',
            options: [{ type: 'range', key: 'mods', label: 'Module', min: 4, max: 28, step: 2, unit: ' Stück' }],
            info: function (s) { var kwp = s.mods * 0.43, kwh = kwp * 1050; return '<b>Leistung:</b> ' + kwp.toFixed(1).replace('.', ',') + ' kWp. <b>Ertrag:</b> etwa ' + fmt(kwh) + ' kWh im Jahr in Oberösterreich, das sind rund ' + fmt(kwh * 0.25) + ' € weniger Stromkosten (Beispiel 25 ct/kWh, 70 % Eigenverbrauch mit Speicher).'; } },
          { id: 'bat', at: [805, 390], kicker: 'Speicher', title: 'Batteriespeicher', text: 'Tagsüber laden, abends kochen, nachts das Auto laden. Der Speicher hebt den Eigenverbrauch von 30 auf 70 %.',
            options: [{ type: 'toggle', key: 'battery', label: 'Speicher dabei' }],
            info: function (s) { return s.battery ? '<b>Größe:</b> für ' + (s.mods * 0.43).toFixed(1).replace('.', ',') + ' kWp passen etwa ' + Math.round(s.mods * 0.43 * 1.2) + ' kWh Speicher.' : '<b>Ohne Speicher:</b> Überschuss geht ins Netz, Vergütung derzeit niedrig.'; } },
          { id: 'wr', at: [920, 420], kicker: 'Technik', title: 'Wechselrichter', text: 'Macht aus Gleichstrom vom Dach Wechselstrom fürs Haus. Mit App, Notstromfunktion und Anbindung an Wärmepumpe und Wallbox.',
            options: [{ type: 'toggle', key: 'sun', label: 'Sonne scheint' }],
            info: function (s) { return s.sun ? '<b>Jetzt:</b> das Haus läuft auf Sonnenstrom, der Rest lädt den Speicher.' : '<b>Nacht:</b> das Haus zieht aus dem Speicher, dann aus dem Netz.'; } }
        ]
      }
    ]
  };

  /* ---------- MALER ---------- */
  var PALETTE = [['#f4f1ea', 'Reinweiß'], ['#d9dcd6', 'Lichtgrau'], ['#b7c4a8', 'Salbei'], ['#c9684a', 'Terrakotta'], ['#243a5e', 'Nachtblau'], ['#e3cfa8', 'Sand'], ['#e8b9b3', 'Puderrosa'], ['#6f7a4e', 'Olive'], ['#2d6e7e', 'Petrol'], ['#4a4f57', 'Graphit'], ['#d8a638', 'Curry'], ['#6e2a3a', 'Bordeaux']];
  SCENES.maler = {
    title: 'Farbe ausprobieren, bevor der erste Pinselstrich fällt',
    lead: 'Tippen Sie auf eine Farbe, und die Rolle streicht die Wand vor Ihren Augen. Ziehen Sie den Vorher-Nachher-Regler, vergleichen Sie Techniken. So fällt die Entscheidung leicht.',
    tabs: [
      {
        label: 'Farbwahl',
        initial: { color: '#d9dcd6', accent: false, accentColor: '#2d6e7e', finish: 'matt', _painted: '#d9dcd6' },
        svg: function () {
          return SVG_OPEN + '<defs>' + DEFS.parquet + '<linearGradient id="gloss" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".2"/></linearGradient></defs>' +
            '<g data-hs="wall" class="sr-hs"><rect id="ml-wall" width="1000" height="440" fill="#d9dcd6"/><rect id="ml-wipe" x="0" y="0" width="1000" height="440" fill="#d9dcd6" style="transform-origin:0 0;transform:scaleX(0)"/><rect id="ml-gloss" width="1000" height="440" fill="url(#gloss)" style="display:none"/></g>' +
            '<g data-hs="accent" class="sr-hs"><rect id="ml-accent" x="0" y="0" width="330" height="440" fill="#2d6e7e" style="display:none"/></g>' +
            '<rect y="440" width="1000" height="160" fill="url(#pq)"/><rect y="432" width="1000" height="12" fill="#fff"/>' +
            '<rect x="620" y="80" width="220" height="180" rx="4" fill="#dff1ff" stroke="#fff" stroke-width="10"/><path d="M730 80V260M620 170H840" stroke="#fff" stroke-width="6"/>' +
            '<rect x="150" y="120" width="120" height="90" fill="#fff" stroke="#5a4634" stroke-width="6"/><path d="M160 200l30-40 25 25 20-30 30 45z" fill="#7d8c5a"/>' +
            '<g id="ml-roller" style="display:none"><rect x="470" y="200" width="60" height="110" rx="30" fill="#f4f6f8" stroke="#9aa3ad" stroke-width="3"/><rect id="ml-rollerfill" x="474" y="204" width="52" height="102" rx="26" fill="#d9dcd6"/><path d="M530 255h40v120" fill="none" stroke="#5a6473" stroke-width="8"/><rect x="560" y="370" width="20" height="60" rx="6" fill="#c9a079"/></g>' +
            '<rect x="280" y="330" width="320" height="110" rx="14" fill="#8a9bb0"/><rect x="260" y="360" width="40" height="90" rx="10" fill="#7a8ba0"/><rect x="580" y="360" width="40" height="90" rx="10" fill="#7a8ba0"/><rect x="300" y="300" width="280" height="50" rx="12" fill="#9fb0c4"/>' +
            '<rect x="880" y="380" width="50" height="60" rx="4" fill="#b78f6a"/><circle cx="905" cy="350" r="40" fill="#5aa96b"/>' +
            '<circle cx="80" cy="200" r="22" fill="#fff2b3" stroke="#9aa3ad" stroke-width="3"/><path d="M80 178V60" stroke="#5a6473" stroke-width="3"/>' +
            '</svg>';
        },
        update: function (svg, s, sr) {
          var q = function (id) { return svg.querySelector('#' + id); };
          if (s.color !== s._painted) {
            var wipe = q('ml-wipe'), wall = q('ml-wall'), roller = q('ml-roller');
            s._painted = s.color;
            wipe.setAttribute('fill', s.color); q('ml-rollerfill').setAttribute('fill', s.color);
            if (reduced) { wall.setAttribute('fill', s.color); }
            else {
              roller.style.display = ''; roller.classList.remove('rolling'); void roller.getBBox(); roller.classList.add('rolling');
              wipe.classList.remove('wiping'); void wipe.getBBox(); wipe.classList.add('wiping');
              setTimeout(function () { wall.setAttribute('fill', s.color); wipe.classList.remove('wiping'); roller.style.display = 'none'; roller.classList.remove('rolling'); }, 1500);
            }
          }
          q('ml-accent').style.display = s.accent ? '' : 'none'; q('ml-accent').setAttribute('fill', s.accentColor);
          q('ml-gloss').style.display = s.finish === 'seidenglanz' ? '' : 'none';
        },
        hotspots: [
          { id: 'wall', at: [500, 60], kicker: 'Innenraum', title: 'Wandfarbe wählen', text: 'Tippen Sie eine Farbe an, die Rolle streicht los. Wir bringen echte Farbmuster mit und streichen eine Probefläche, bevor Sie sich festlegen.',
            options: [{ type: 'swatch', key: 'color', label: 'Farbton', values: PALETTE.map(function (p) { return [p[0], p[1], p[0]]; }) }, { type: 'choice', key: 'finish', label: 'Oberfläche', values: [['matt', 'Matt'], ['seidenglanz', 'Seidenglanz']] }],
            info: function (s) { var n = PALETTE.filter(function (p) { return p[0] === s.color; })[0]; return '<b>' + (n ? n[1] : 'Farbton') + ':</b> ' + (s.finish === 'matt' ? 'stumpfmatte Dispersionsfarbe, Nassabrieb Klasse 2, kaschiert kleine Unebenheiten.' : 'Latexfarbe, abwaschbar, ideal für Küche, Flur und Kinderzimmer.'); } },
          { id: 'accent', at: [165, 300], kicker: 'Gestaltung', title: 'Akzentwand', text: 'Eine Wand in kräftiger Farbe, die anderen hell: das gibt dem Raum Tiefe, ohne ihn kleiner zu machen.',
            onOpen: { accent: true }, onClose: { accent: false },
            options: [{ type: 'toggle', key: 'accent', label: 'Akzentwand' }, { type: 'swatch', key: 'accentColor', label: 'Akzentfarbe', values: PALETTE.slice(2).map(function (p) { return [p[0], p[1], p[0]]; }) }],
            info: function () { return '<b>Tipp:</b> die Wand hinter dem Sofa oder dem Bett, nie die Fensterwand.'; } }
        ]
      },
      {
        label: 'Vorher / Nachher',
        hint: 'Ziehen Sie den Griff nach links und rechts',
        initial: { split: 50 },
        toolbar: [{ type: 'range', key: 'split', label: 'Vorher / Nachher', min: 0, max: 100, unit: ' %' }],
        drag: function (s, x) { s.split = Math.max(0, Math.min(100, Math.round(x / 10))); },
        svg: function () {
          return SVG_OPEN + '<defs>' + DEFS.parquet + '<clipPath id="ml-clip"><rect id="ml-cliprect" x="0" y="0" width="500" height="600"/></clipPath></defs>' +
            // Vorher
            '<g><rect width="1000" height="440" fill="#cfc7b4"/><ellipse cx="300" cy="150" rx="90" ry="40" fill="#8a7a5a" opacity=".35"/><ellipse cx="700" cy="300" rx="120" ry="50" fill="#6b5a3a" opacity=".3"/><path d="M520 0c-10 60 30 90 10 160s40 110 20 180" stroke="#6b5a3a" stroke-width="3" fill="none"/><path d="M120 440c20-40 10-80 40-120" stroke="#6b5a3a" stroke-width="2" fill="none"/>' +
            '<path d="M0 380c60 10 120-20 180 0s120 30 180 10v50H0z" fill="#b5ad9a"/><rect y="440" width="1000" height="160" fill="#b89a73"/><rect y="432" width="1000" height="12" fill="#d9d2c3"/>' +
            '<text x="80" y="60" font-size="26" font-weight="700" font-family="system-ui" fill="#5a4634" opacity=".7">VORHER</text></g>' +
            // Nachher
            '<g clip-path="url(#ml-clip)"><rect width="1000" height="440" fill="#eef0ea"/><rect width="330" height="440" fill="#2d6e7e"/><rect y="440" width="1000" height="160" fill="url(#pq)"/><rect y="432" width="1000" height="12" fill="#fff"/>' +
            '<rect x="620" y="80" width="220" height="180" rx="4" fill="#dff1ff" stroke="#fff" stroke-width="10"/><path d="M730 80V260M620 170H840" stroke="#fff" stroke-width="6"/>' +
            '<rect x="280" y="330" width="320" height="110" rx="14" fill="#8a9bb0"/><rect x="300" y="300" width="280" height="50" rx="12" fill="#9fb0c4"/>' +
            '<text x="80" y="60" font-size="26" font-weight="700" font-family="system-ui" fill="#fff">NACHHER</text></g>' +
            '<g id="ml-handle"><line x1="500" y1="0" x2="500" y2="600" stroke="#fff" stroke-width="4"/><circle cx="500" cy="300" r="26" fill="#fff" stroke="#1b222c" stroke-width="2"/><path d="M488 300l8-8v16zM512 300l-8-8v16z" fill="#1b222c"/></g>' +
            '</svg>';
        },
        update: function (svg, s) {
          var x = s.split * 10;
          svg.querySelector('#ml-cliprect').setAttribute('width', x);
          svg.querySelector('#ml-handle').setAttribute('transform', 'translate(' + (x - 500) + ' 0)');
        },
        hotspots: []
      },
      {
        label: 'Techniken',
        initial: { tech: 'glatt' },
        svg: function () {
          var techs = [['glatt', 'Glatt'], ['spachtel', 'Spachteltechnik'], ['lasur', 'Lasur'], ['streifen', 'Streifen'], ['tapete', 'Tapete']];
          return SVG_OPEN + '<defs>' + DEFS.parquet +
            '<pattern id="t-spachtel" width="80" height="80" patternUnits="userSpaceOnUse"><rect width="80" height="80" fill="#d8cdbb"/><path d="M0 60c20-30 40 10 80-30M-10 20c20-30 40 10 80-30" stroke="#fff" stroke-width="10" opacity=".45" fill="none"/><path d="M0 80c30-20 50 0 80-20" stroke="#b9a98f" stroke-width="6" opacity=".4" fill="none"/></pattern>' +
            '<linearGradient id="t-lasur" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9c9a8"/><stop offset=".5" stop-color="#c98b5e"/><stop offset="1" stop-color="#e3b48f"/></linearGradient>' +
            '<pattern id="t-streifen" width="60" height="10" patternUnits="userSpaceOnUse"><rect width="30" height="10" fill="#dfe6e9"/><rect x="30" width="30" height="10" fill="#9fb8c4"/></pattern>' +
            '<pattern id="t-tapete" width="70" height="70" patternUnits="userSpaceOnUse"><rect width="70" height="70" fill="#f1ece2"/><circle cx="35" cy="35" r="16" fill="none" stroke="#9c8f74" stroke-width="2"/><circle cx="0" cy="0" r="16" fill="none" stroke="#9c8f74" stroke-width="2"/><circle cx="70" cy="70" r="16" fill="none" stroke="#9c8f74" stroke-width="2"/><circle cx="70" cy="0" r="16" fill="none" stroke="#9c8f74" stroke-width="2"/><circle cx="0" cy="70" r="16" fill="none" stroke="#9c8f74" stroke-width="2"/></pattern></defs>' +
            '<rect id="mt-wall" width="1000" height="380" fill="#e6e2d8"/><rect y="380" width="1000" height="220" fill="url(#pq)"/><rect y="372" width="1000" height="12" fill="#fff"/>' +
            techs.map(function (t, i) {
              var fill = { glatt: '#e6e2d8', spachtel: 'url(#t-spachtel)', lasur: 'url(#t-lasur)', streifen: 'url(#t-streifen)', tapete: 'url(#t-tapete)' }[t[0]];
              return '<g data-hs="' + t[0] + '" class="sr-hs mt-sample"><rect x="' + (60 + i * 180) + '" y="420" width="150" height="130" rx="6" fill="' + fill + '" stroke="#fff" stroke-width="6"/><text x="' + (135 + i * 180) + '" y="580" text-anchor="middle" font-size="15" font-family="system-ui" fill="#1b222c">' + t[1] + '</text></g>';
            }).join('') + '</svg>';
        },
        update: function (svg, s) {
          svg.querySelector('#mt-wall').setAttribute('fill', { glatt: '#e6e2d8', spachtel: 'url(#t-spachtel)', lasur: 'url(#t-lasur)', streifen: 'url(#t-streifen)', tapete: 'url(#t-tapete)' }[s.tech]);
          Array.prototype.forEach.call(svg.querySelectorAll('.mt-sample rect'), function (r, i) { r.setAttribute('stroke', ['glatt', 'spachtel', 'lasur', 'streifen', 'tapete'][i] === s.tech ? '#e07a1f' : '#fff'); });
        },
        hotspots: [
          { id: 'glatt', at: [135, 410], kicker: 'Technik', title: 'Glatt gespachtelt, Q3', text: 'Die klassische Wand: vollflächig gespachtelt, geschliffen, zweimal gestrichen. Kein Rautapeten-Gefühl, keine Risse.', onOpen: { tech: 'glatt' }, zoom: '#mt-wall', info: function () { return '<b>Dauer:</b> Wohnzimmer 25 m² in 2 Tagen inklusive Trocknung.'; } },
          { id: 'spachtel', at: [315, 410], kicker: 'Technik', title: 'Spachteltechnik', text: 'Mehrere Schichten eingefärbter Spachtelmasse, von Hand aufgezogen. Jede Wand ein Unikat, lebendig im Streiflicht.', onOpen: { tech: 'spachtel' }, zoom: '#mt-wall', info: function () { return '<b>Pflege:</b> wachsversiegelt, abwischbar, auch im Bad.'; } },
          { id: 'lasur', at: [495, 410], kicker: 'Technik', title: 'Lasurtechnik', text: 'Transparente Farbschichten mit dem Schwamm oder Pinsel. Warm und wolkig, perfekt für Altbau und Landhaus.', onOpen: { tech: 'lasur' }, zoom: '#mt-wall', info: function () { return '<b>Farben:</b> zwei bis drei Töne aus einer Familie, zum Beispiel Sand, Terrakotta, Ocker.'; } },
          { id: 'streifen', at: [675, 410], kicker: 'Technik', title: 'Streifen und Blöcke', text: 'Mit Präzisionsband abgeklebt, scharfe Kanten garantiert. Senkrecht macht den Raum höher, waagrecht breiter.', onOpen: { tech: 'streifen' }, zoom: '#mt-wall', info: function () { return '<b>Beliebt:</b> Kinderzimmer, Flur, Schlafzimmer hinter dem Bett.'; } },
          { id: 'tapete', at: [855, 410], kicker: 'Technik', title: 'Tapete und Vliestapete', text: 'Muster, Struktur oder Fototapete. Vlies lässt sich trocken abziehen, der Untergrund bleibt heil.', onOpen: { tech: 'tapete' }, zoom: '#mt-wall', info: function () { return '<b>Wir bringen</b> Musterbücher mit und tapezieren auch eine einzelne Wand.'; } }
        ]
      }
    ]
  };

  /* ---------- TISCHLER ---------- */
  var WOODS = [['eiche', 'Eiche', '#d9b98a', '#b8925e'], ['nuss', 'Nussbaum', '#7a5236', '#5b3a24'], ['esche', 'Esche', '#ecdfc4', '#cbb892'], ['weiss', 'Weiß lackiert', '#f6f6f3', '#e4e4df'], ['anthrazit', 'Anthrazit', '#4a4f57', '#3a3e45']];
  SCENES.tischler = {
    title: 'Öffnen Sie Türen und Laden, bevor das Holz geschnitten wird',
    lead: 'Breite, Holzart, Griffe: Stellen Sie Ihren Schrank und Ihre Küche selbst zusammen. Türen schwingen auf, Laden fahren aus. Was Ihnen gefällt, zeichnen wir maßgenau.',
    tabs: [
      {
        label: 'Einbauschrank',
        initial: { width: 200, wood: 'eiche', open: false, doors: 'dreh' },
        svg: function () {
          return SVG_OPEN + '<defs>' + DEFS.parquet + WOODS.map(function (w) { return wood('w-' + w[0], w[2], w[3]); }).join('') + '</defs>' +
            '<rect width="1000" height="440" fill="#eef0ea"/><rect y="440" width="1000" height="160" fill="url(#pq)"/><rect y="432" width="1000" height="12" fill="#fff"/>' +
            '<g data-hs="schrank" class="sr-hs"><g id="ts-body"></g></g><g data-hs="innen" class="sr-hs"><rect x="440" y="300" width="120" height="100" fill="none"/></g>' +
            '</svg>';
        },
        update: function (svg, s) {
          var scale = 2.2, w = s.width * scale, x = 500 - w / 2, y = 60, h = 400;
          var n = Math.max(2, Math.round(s.width / 50)), dw = w / n;
          var out = '<rect x="' + (x - 6) + '" y="' + (y - 6) + '" width="' + (w + 12) + '" height="' + (h + 12) + '" fill="#2b2b2b"/>';
          out += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="#f1ede4"/>';
          // Innenleben
          for (var i = 0; i < n; i++) {
            var cx = x + i * dw;
            if (i % 2 === 0) { out += '<path d="M' + (cx + 6) + ' ' + (y + 130) + 'H' + (cx + dw - 6) + 'M' + (cx + 6) + ' ' + (y + 230) + 'H' + (cx + dw - 6) + 'M' + (cx + 6) + ' ' + (y + 330) + 'H' + (cx + dw - 6) + '" stroke="#c9b9a8" stroke-width="6"/>'; out += '<rect x="' + (cx + 14) + '" y="' + (y + 100) + '" width="' + (dw - 28) + '" height="22" rx="3" fill="#8fb3d9"/><rect x="' + (cx + 14) + '" y="' + (y + 200) + '" width="' + (dw - 28) + '" height="22" rx="3" fill="#d9a08f"/>'; }
            else { out += '<path d="M' + (cx + 6) + ' ' + (y + 60) + 'H' + (cx + dw - 6) + '" stroke="#9aa3ad" stroke-width="5"/>'; for (var k = 0; k < 4; k++) out += '<path d="M' + (cx + 14 + k * (dw - 28) / 3.5) + ' ' + (y + 62) + 'v16l-10 14h20l-10-14" fill="none" stroke="#5a6473" stroke-width="2"/><rect x="' + (cx + 6 + k * (dw - 28) / 3.5) + '" y="' + (y + 92) + '" width="16" height="110" rx="6" fill="' + ['#6f8fb8', '#e2d8c3', '#8a9b7a', '#b06a5a'][k] + '"/>'; }
          }
          // Türen
          for (var d = 0; d < n; d++) {
            var dx = x + d * dw, hingeLeft = d % 2 === 0, origin = hingeLeft ? dx : dx + dw;
            var tr = '';
            if (s.open) tr = s.doors === 'dreh' ? 'scaleX(.14) skewY(' + (hingeLeft ? -12 : 12) + 'deg)' : 'translateX(' + (d % 2 === 0 ? dw * 0.92 : -dw * 0.92) + 'px)';
            var grip = s.doors === 'dreh' ? '<rect x="' + (hingeLeft ? dx + dw - 16 : dx + 10) + '" y="' + (y + h / 2 - 30) + '" width="6" height="60" rx="3" fill="#777"/>' : '<rect x="' + (dx + dw / 2 - 3) + '" y="' + (y + h / 2 - 30) + '" width="6" height="60" rx="3" fill="#777"/>';
            out += '<g class="sr-door" style="transform-origin:' + origin + 'px ' + (y + h / 2) + 'px;transform:' + (tr || 'none') + '"><rect x="' + (dx + 2) + '" y="' + (y + 2) + '" width="' + (dw - 4) + '" height="' + (h - 4) + '" fill="url(#w-' + s.wood + ')" stroke="#2b2b2b" stroke-width="2"/>' + grip + '</g>';
          }
          svg.querySelector('#ts-body').innerHTML = out;
        },
        hotspots: [
          { id: 'schrank', at: [500, 50], kicker: 'Maßmöbel', title: 'Einbauschrank nach Maß', text: 'Ziehen Sie die Breite auf, wählen Sie Holz und Türen. Wir messen vor Ort auf den Millimeter, schräge Wände und Dachschrägen inklusive.',
            options: [{ type: 'range', key: 'width', label: 'Breite', min: 100, max: 320, step: 20, unit: ' cm' }, { type: 'choice', key: 'wood', label: 'Front', values: WOODS.map(function (w) { return [w[0], w[1]]; }) }, { type: 'choice', key: 'doors', label: 'Türen', values: [['dreh', 'Drehtüren'], ['schieb', 'Schiebetüren']] }],
            info: function (s) { var n = Math.max(2, Math.round(s.width / 50)); return '<b>Aufteilung:</b> ' + n + ' Türen, je ' + Math.round(s.width / n) + ' cm. ' + (s.doors === 'schieb' ? 'Schiebetüren brauchen keinen Schwenkraum, ideal im Flur.' : 'Drehtüren geben den vollen Blick ins Fach frei.'); } },
          { id: 'innen', at: [500, 290], kicker: 'Innenleben', title: 'Innen genau so, wie Sie leben', text: 'Die Türen gehen auf. Böden, Kleiderstange, Laden und Schuhauszug planen wir nach dem, was Sie verstauen wollen.',
            onOpen: { open: true }, onClose: { open: false },
            options: [{ type: 'toggle', key: 'open', label: 'Türen offen' }],
            info: function () { return '<b>Ausstattung:</b> Böden 19 mm, Kleiderstange mit Beleuchtung, Laden mit Softeinzug.'; } }
        ]
      },
      {
        label: 'Küche',
        initial: { front: 'salbei', top: 'eiche', grip: 'leiste', drawer: false, udoor: false },
        svg: function () {
          return SVG_OPEN + '<defs>' + DEFS.parquet + WOODS.map(function (w) { return wood('w-' + w[0], w[2], w[3]); }).join('') + '<pattern id="stone" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="#8e9499"/><circle cx="10" cy="12" r="1.5" fill="#6e747a"/><circle cx="30" cy="28" r="1.2" fill="#b4b9be"/><circle cx="22" cy="6" r="1" fill="#6e747a"/></pattern></defs>' +
            '<rect width="1000" height="440" fill="#f3efe6"/><rect y="440" width="1000" height="160" fill="url(#pq)"/>' +
            '<rect x="60" y="60" width="200" height="130" rx="4" fill="#dff1ff" stroke="#fff" stroke-width="8"/>' +
            // Oberschränke
            '<g data-hs="ober" class="sr-hs">' + rep(4, function (i) { return '<rect x="' + (340 + i * 150) + '" y="60" width="146" height="150" fill="#2b2b2b"/>'; }) +
            rep(4, function (i) { return i === 1 ? '' : '<rect class="ki-front" x="' + (343 + i * 150) + '" y="63" width="140" height="144" fill="#b7c4a8"/>'; }) +
            '<g id="ki-udoor" class="sr-door" style="transform-origin:493px 135px"><rect class="ki-front" x="493" y="63" width="140" height="144" fill="#b7c4a8"/><rect class="ki-grip ki-grip-u" x="500" y="195" width="126" height="6" rx="2" fill="#555"/></g>' +
            '<g><rect x="496" y="66" width="134" height="138" fill="#f1ede4" style="display:none" id="ki-uinside"/><path id="ki-ushelf" d="M496 110H630M496 160H630" stroke="#c9b9a8" stroke-width="5" style="display:none"/></g>' +
            '<rect x="790" y="40" width="190" height="40" fill="#9aa3ad"/><rect x="820" y="80" width="130" height="30" fill="#cfd5db"/></g>' + // Haube
            // Arbeitsplatte
            '<g data-hs="platte" class="sr-hs"><rect id="ki-top" x="330" y="280" width="660" height="18" rx="3" fill="url(#w-eiche)"/><rect x="560" y="268" width="120" height="12" rx="3" fill="#9aa3ad"/><rect x="810" y="284" width="150" height="8" rx="2" fill="#1b222c"/><circle cx="845" cy="288" r="12" fill="#1b222c"/><circle cx="925" cy="288" r="12" fill="#1b222c"/></g>' +
            // Unterschränke
            '<g data-hs="fronten" class="sr-hs">' + rep(6, function (i) { return '<rect x="' + (330 + i * 110) + '" y="298" width="110" height="142" fill="#2b2b2b"/>' + (i === 1 ? '' : '<rect class="ki-front" x="' + (333 + i * 110) + '" y="301" width="104" height="136" fill="#b7c4a8"/><rect class="ki-grip" x="' + (340 + i * 110) + '" y="310" width="90" height="6" rx="2" fill="#555"/>'); }) +
            '<g id="ki-drawer" class="sr-door"><rect x="443" y="301" width="104" height="66" fill="#f1ede4"/><rect class="ki-front" x="443" y="301" width="104" height="66" fill="#b7c4a8"/><rect class="ki-grip" x="450" y="310" width="90" height="6" rx="2" fill="#555"/><g id="ki-drawerinside" style="display:none"><rect x="447" y="301" width="96" height="60" fill="#e8dfc9"/><rect x="452" y="305" width="20" height="50" fill="#c9b9a8"/><rect x="476" y="305" width="20" height="50" fill="#c9b9a8"/><rect x="500" y="305" width="20" height="50" fill="#c9b9a8"/></g></g>' +
            '<rect class="ki-front" x="443" y="371" width="104" height="66" fill="#b7c4a8"/><rect class="ki-grip" x="450" y="380" width="90" height="6" rx="2" fill="#555"/>' +
            '<rect x="330" y="440" width="660" height="12" fill="#2b2b2b"/></g>' +
            '</svg>';
        },
        update: function (svg, s) {
          var col = { weiss: '#f6f6f3', salbei: '#b7c4a8', anthrazit: '#4a4f57', nachtblau: '#243a5e', eiche: 'url(#w-eiche)', nuss: 'url(#w-nuss)' }[s.front];
          Array.prototype.forEach.call(svg.querySelectorAll('.ki-front'), function (r) { r.setAttribute('fill', col); });
          svg.querySelector('#ki-top').setAttribute('fill', { eiche: 'url(#w-eiche)', stein: 'url(#stone)', weiss: '#f2f2ee', schwarz: '#2b2b2b' }[s.top]);
          Array.prototype.forEach.call(svg.querySelectorAll('.ki-grip'), function (g) { g.style.display = s.grip === 'grifflos' ? 'none' : ''; g.setAttribute('height', s.grip === 'leiste' ? 6 : 10); g.setAttribute('rx', s.grip === 'leiste' ? 2 : 5); g.setAttribute('fill', s.grip === 'leiste' ? '#555' : '#1b222c'); });
          svg.querySelector('#ki-drawer').style.transform = s.drawer ? 'translate(0, 56px)' : '';
          svg.querySelector('#ki-drawerinside').style.display = s.drawer ? '' : 'none';
          svg.querySelector('#ki-udoor').style.transform = s.udoor ? 'scaleY(.12) skewX(14deg)' : '';
          svg.querySelector('#ki-uinside').style.display = s.udoor ? '' : 'none'; svg.querySelector('#ki-ushelf').style.display = s.udoor ? '' : 'none';
        },
        hotspots: [
          { id: 'fronten', at: [660, 470], kicker: 'Küche', title: 'Fronten und Griffe', text: 'Wählen Sie Farbe oder Holz der Fronten und wie Sie öffnen wollen: Griffleiste, Bügelgriff oder grifflos mit Tip-on.',
            options: [{ type: 'choice', key: 'front', label: 'Front', values: [['weiss', 'Weiß matt'], ['salbei', 'Salbei'], ['anthrazit', 'Anthrazit'], ['nachtblau', 'Nachtblau'], ['eiche', 'Eiche'], ['nuss', 'Nussbaum']] }, { type: 'choice', key: 'grip', label: 'Griffe', values: [['leiste', 'Griffleiste'], ['buegel', 'Bügelgriff'], ['grifflos', 'Grifflos']] }],
            info: function (s) { return s.grip === 'grifflos' ? '<b>Grifflos:</b> ruhige Front, Öffnen durch Antippen. Beliebt in kleinen Küchen.' : '<b>' + (s.grip === 'leiste' ? 'Griffleiste' : 'Bügelgriff') + ':</b> robust, leicht zu greifen, in Edelstahl oder Schwarz.'; } },
          { id: 'lade', at: [495, 290], kicker: 'Stauraum', title: 'Laden mit Vollauszug', text: 'Die Lade fährt aus und zeigt die Besteckeinteilung aus Eiche. Vollauszug, Softeinzug, 40 kg Tragkraft.',
            onOpen: { drawer: true }, onClose: { drawer: false }, zoom: '#ki-drawer',
            options: [{ type: 'toggle', key: 'drawer', label: 'Lade offen' }],
            info: function () { return '<b>Tipp:</b> unten breite Laden für Töpfe statt Türen, da findet man alles.'; } },
          { id: 'platte', at: [660, 262], kicker: 'Arbeitsplatte', title: 'Arbeitsplatte wählen', text: 'Massivholz zum Nachölen, Stein für die Ewigkeit oder Schichtstoff fürs Budget. Mit Kochfeld und Spüle flächenbündig.',
            options: [{ type: 'choice', key: 'top', label: 'Material', values: [['eiche', 'Eiche massiv'], ['stein', 'Naturstein'], ['weiss', 'Schichtstoff weiß'], ['schwarz', 'Schwarz matt']] }],
            info: function (s) { return { eiche: '<b>Eiche:</b> 40 mm, geölt, Kratzer lassen sich ausschleifen.', stein: '<b>Stein:</b> hitzefest, Stärke 20 mm, jede Platte ein Unikat.', weiss: '<b>Schichtstoff:</b> pflegeleicht und günstig, viele Dekore.', schwarz: '<b>Schwarz matt:</b> Fenix-Oberfläche, fingerabdruckfrei, Mikrokratzer heilen mit Wärme.' }[s.top]; } },
          { id: 'ober', at: [563, 50], kicker: 'Oberschrank', title: 'Oberschränke mit Klappe', text: 'Die Klappe schwingt nach oben, nichts steht im Weg. Innen Böden aus Glas oder Holz, auf Wunsch mit LED.',
            onOpen: { udoor: true }, onClose: { udoor: false }, zoom: '#ki-udoor',
            options: [{ type: 'toggle', key: 'udoor', label: 'Klappe offen' }],
            info: function () { return '<b>Höhe:</b> bis zur Decke, der letzte Boden für Dinge, die man selten braucht.'; } }
        ]
      },
      {
        label: 'Holzarten',
        initial: { pick: null },
        svg: function () {
          var list = WOODS.concat([['ahorn', 'Ahorn', '#f0e3c8', '#d9c9a6'], ['fichte', 'Fichte', '#eacb93', '#cfa96a']]).filter(function (w) { return w[0] !== 'weiss' && w[0] !== 'anthrazit'; });
          return SVG_OPEN + '<defs>' + DEFS.parquet + list.map(function (w) { return wood('w-' + w[0], w[2], w[3]); }).join('') + '</defs>' +
            '<rect width="1000" height="600" fill="#eef0ea"/><rect y="520" width="1000" height="80" fill="url(#pq)"/>' +
            '<text x="500" y="70" text-anchor="middle" font-size="22" font-family="system-ui" fill="#5a6473">Tippen Sie ein Holz an</text>' +
            list.map(function (w, i) { return '<g data-hs="' + w[0] + '" class="sr-hs"><rect x="' + (70 + i * 180) + '" y="120" width="150" height="360" rx="8" fill="url(#w-' + w[0] + ')" stroke="#2b2b2b" stroke-width="4"/><text x="' + (145 + i * 180) + '" y="508" text-anchor="middle" font-size="18" font-weight="700" font-family="system-ui" fill="#1b222c">' + w[1] + '</text></g>'; }).join('') +
            '</svg>';
        },
        hotspots: [
          { id: 'eiche', at: [145, 110], kicker: 'Holz', title: 'Eiche', text: 'Hart, langlebig, markante Maserung. Der Klassiker für Tische, Küchen und Stiegen.', info: function () { return '<b>Herkunft:</b> heimische Wälder, Oberfläche geölt oder lackiert.'; } },
          { id: 'nuss', at: [325, 110], kicker: 'Holz', title: 'Nussbaum', text: 'Dunkel, warm, edel. Für Möbel, die auffallen sollen: Sideboard, Esstisch, Bett.', info: function () { return '<b>Pflege:</b> geölt, einmal im Jahr nachölen.'; } },
          { id: 'esche', at: [505, 110], kicker: 'Holz', title: 'Esche', text: 'Hell und elastisch, lebendige Maserung. Gut für Sitzmöbel und Arbeitsplatten.', info: function () { return '<b>Besonderheit:</b> lässt sich dämpfen und biegen.'; } },
          { id: 'ahorn', at: [685, 110], kicker: 'Holz', title: 'Ahorn', text: 'Fast weiß, sehr gleichmäßig. Für ruhige, helle Räume und Kinderzimmer.', info: function () { return '<b>Hinweis:</b> dunkelt mit der Zeit leicht nach.'; } },
          { id: 'fichte', at: [865, 110], kicker: 'Holz', title: 'Fichte', text: 'Leicht, günstig, duftet. Für Zirben- und Fichtenbetten, Verkleidungen und Dachböden.', info: function () { return '<b>Preis:</b> das günstigste Massivholz, astig oder astrein.'; } }
        ]
      }
    ]
  };

  /* ---------- DACHDECKER ---------- */
  SCENES.dach = {
    title: 'Ihr Dach, Ziegel für Ziegel zum Durchprobieren',
    lead: 'Wechseln Sie die Eindeckung, öffnen Sie das Dachfenster, legen Sie Solar aufs Dach, lassen Sie es regnen. Was Sie hier sehen, bauen wir mit Gerüst, Lattung und Dämmung.',
    tabs: [
      {
        label: 'Eindeckung',
        initial: { type: 'ziegel', snow: false, gutter: 'zink' },
        svg: function () {
          return SVG_OPEN + '<defs>' + DEFS.sky +
            '<pattern id="d-ziegel" width="60" height="30" patternUnits="userSpaceOnUse"><rect width="60" height="30" fill="#b2503a"/><path d="M0 30a30 30 0 0 1 60 0" fill="#c45f47" stroke="#8a3a2a" stroke-width="2"/></pattern>' +
            '<pattern id="d-beton" width="60" height="30" patternUnits="userSpaceOnUse"><rect width="60" height="30" fill="#4a4f57"/><path d="M0 29H60M30 0V30" stroke="#2f3338" stroke-width="2"/></pattern>' +
            '<pattern id="d-blech" width="50" height="50" patternUnits="userSpaceOnUse"><rect width="50" height="50" fill="#5f6b78"/><path d="M8 0V50" stroke="#3f4954" stroke-width="4"/><path d="M14 0V50" stroke="#8c98a6" stroke-width="2"/></pattern>' +
            '<pattern id="d-schiefer" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="40" height="40" fill="#3b4046"/><path d="M0 39H40M39 0V40" stroke="#22262a" stroke-width="2"/></pattern></defs>' +
            '<rect width="1000" height="520" fill="url(#skyday)"/><rect y="520" width="1000" height="80" fill="#7d8c5a"/>' +
            '<rect x="200" y="300" width="600" height="220" fill="#fbf7ef" stroke="#5a4634" stroke-width="6"/><rect x="470" y="400" width="60" height="120" fill="#5a4634"/><rect x="260" y="340" width="80" height="80" fill="#bfe0ff" stroke="#fff" stroke-width="4"/><rect x="660" y="340" width="80" height="80" fill="#bfe0ff" stroke="#fff" stroke-width="4"/>' +
            '<g data-hs="kamin" class="sr-hs"><rect x="640" y="150" width="50" height="110" fill="#8a7a62"/><rect x="634" y="140" width="62" height="16" fill="#5a4634"/></g>' +
            '<g data-hs="dach" class="sr-hs"><path id="dc-roof" d="M170 300L500 90L830 300z" fill="url(#d-ziegel)" stroke="#5a4634" stroke-width="4"/><path d="M170 300L500 90L830 300" fill="none" stroke="#3b2d20" stroke-width="10" stroke-linejoin="round"/>' +
            '<g id="dc-snow" style="display:none" stroke="#9aa3ad" stroke-width="5" fill="none">' + rep(12, function (i) { var t = i / 11; return '<path d="M' + (220 + t * 240) + ' ' + (268 - t * 150) + 'l-4-12M' + (780 - t * 240) + ' ' + (268 - t * 150) + 'l4-12"/>'; }) + '</g></g>' +
            '<g data-hs="rinne" class="sr-hs"><path id="dc-gutter" d="M160 302H840" stroke="#8c98a6" stroke-width="12" stroke-linecap="round" fill="none"/><path id="dc-pipe" d="M840 302V520" stroke="#8c98a6" stroke-width="10" fill="none"/></g>' +
            '</svg>';
        },
        update: function (svg, s) {
          svg.querySelector('#dc-roof').setAttribute('fill', 'url(#d-' + s.type + ')');
          svg.querySelector('#dc-snow').style.display = s.snow ? '' : 'none';
          var gc = s.gutter === 'kupfer' ? '#b5733f' : '#8c98a6';
          svg.querySelector('#dc-gutter').setAttribute('stroke', gc); svg.querySelector('#dc-pipe').setAttribute('stroke', gc);
        },
        hotspots: [
          { id: 'dach', at: [500, 80], kicker: 'Eindeckung', title: 'Ziegel, Betonstein, Blech oder Schiefer', text: 'Tippen Sie durch die Eindeckungen. Jede hat ihr Gewicht, ihre Lebensdauer und ihren Preis. Wir prüfen, was Ihr Dachstuhl trägt.',
            options: [{ type: 'choice', key: 'type', label: 'Material', values: [['ziegel', 'Tondachziegel'], ['beton', 'Betondachstein'], ['blech', 'Stehfalzblech'], ['schiefer', 'Schiefer']] }, { type: 'toggle', key: 'snow', label: 'Schneefang' }],
            info: function (s) { return { ziegel: '<b>Tondachziegel:</b> 40 bis 45 kg/m², hält 60 Jahre und länger, Farbe bleibt.', beton: '<b>Betondachstein:</b> günstiger, 45 bis 50 kg/m², 40 bis 50 Jahre, anthrazit oder rot.', blech: '<b>Stehfalzblech:</b> leicht (5 bis 7 kg/m²), auch bei flacher Neigung, moderner Look.', schiefer: '<b>Schiefer:</b> Naturstein, 100 Jahre, handwerklich verlegt, für Altbau und Villen.' }[s.type] + (s.snow ? ' Schneefang schützt Gehwege und Rinne, in Oberösterreich meist Vorschrift.' : ''); } },
          { id: 'rinne', at: [300, 300], kicker: 'Entwässerung', title: 'Dachrinne und Fallrohr', text: 'Zink hält 40 Jahre, Kupfer ein Leben lang und bekommt seine grüne Patina. Wir setzen Laubfänger und prüfen das Gefälle.',
            options: [{ type: 'choice', key: 'gutter', label: 'Material', values: [['zink', 'Titanzink'], ['kupfer', 'Kupfer']] }],
            info: function () { return '<b>Größe:</b> halbrund 333 mm für Dächer bis 150 m² Grundfläche.'; } },
          { id: 'kamin', at: [665, 130], kicker: 'Anschlüsse', title: 'Kamin und Durchdringungen', text: 'Die häufigste Stelle für undichte Dächer. Wir machen Kamin, Antenne und Entlüftung mit Blei oder Blech dauerhaft dicht.',
            info: function () { return '<b>Kaminkopf:</b> Verblechung oder Neuaufmauerung, Abdeckplatte gegen Regen.'; } }
        ]
      },
      {
        label: 'Fenster & Solar',
        initial: { win: false, solar: false, mods: 10 },
        svg: function () {
          return SVG_OPEN + '<defs>' + DEFS.sky + '<pattern id="d-ziegel2" width="60" height="30" patternUnits="userSpaceOnUse"><rect width="60" height="30" fill="#b2503a"/><path d="M0 30a30 30 0 0 1 60 0" fill="#c45f47" stroke="#8a3a2a" stroke-width="2"/></pattern></defs>' +
            '<rect width="1000" height="520" fill="url(#skyday)"/><rect y="520" width="1000" height="80" fill="#7d8c5a"/><circle cx="900" cy="90" r="36" fill="#ffd66b"/>' +
            '<rect x="100" y="320" width="800" height="200" fill="#fbf7ef" stroke="#5a4634" stroke-width="6"/>' +
            '<path d="M80 320L80 180L920 180L920 320z" fill="url(#d-ziegel2)" stroke="#5a4634" stroke-width="4"/>' +
            '<g data-hs="fenster" class="sr-hs"><rect x="150" y="200" width="150" height="100" fill="#1b222c"/><g id="df-win" class="sr-door" style="transform-origin:225px 200px"><rect x="150" y="200" width="150" height="100" fill="#bfe0ff" stroke="#fff" stroke-width="6"/><path d="M225 200V300" stroke="#fff" stroke-width="4"/></g></g>' +
            '<g data-hs="solar" class="sr-hs"><rect x="360" y="190" width="520" height="120" fill="none"/><g id="df-mods"></g></g>' +
            '</svg>';
        },
        update: function (svg, s) {
          svg.querySelector('#df-win').style.transform = s.win ? 'scaleY(.25) skewX(-20deg)' : '';
          var out = '';
          if (s.solar) for (var i = 0; i < s.mods; i++) out += '<rect x="' + (365 + (i % 10) * 52) + '" y="' + (195 + Math.floor(i / 10) * 60) + '" width="48" height="54" rx="2" fill="#17325e" stroke="#8fc1ff" stroke-width="1.5"/>';
          svg.querySelector('#df-mods').innerHTML = out;
        },
        hotspots: [
          { id: 'fenster', at: [225, 190], kicker: 'Licht', title: 'Dachflächenfenster', text: 'Das Fenster klappt auf. Mehr Licht im Dachgeschoß, mit Rollo, Insektenschutz und Regensensor. Einbau an einem Tag.',
            onOpen: { win: true }, onClose: { win: false },
            options: [{ type: 'toggle', key: 'win', label: 'Fenster offen' }],
            info: function () { return '<b>Größe:</b> 78 × 118 cm oder 94 × 140 cm, Dreifachverglasung, elektrisch auf Wunsch.'; } },
          { id: 'solar', at: [620, 180], kicker: 'Energie', title: 'Photovoltaik vom Dachdecker', text: 'Wir legen die Module gleich mit der Eindeckung, mit passenden Haken und dichten Durchführungen. Der Elektriker schließt an.',
            onOpen: { solar: true }, onClose: { solar: false },
            options: [{ type: 'toggle', key: 'solar', label: 'Module am Dach' }, { type: 'range', key: 'mods', label: 'Anzahl', min: 4, max: 20, step: 2, unit: ' Module' }],
            info: function (s) { return '<b>Leistung:</b> ' + (s.mods * 0.43).toFixed(1).replace('.', ',') + ' kWp, Fläche etwa ' + (s.mods * 2) + ' m².'; } }
        ]
      },
      {
        label: 'Regen',
        initial: { rain: false, barrel: true, insul: false },
        toolbar: [{ type: 'toggle', key: 'rain', label: 'Es regnet' }],
        svg: function () {
          return SVG_OPEN + '<defs>' + DEFS.sky + '<pattern id="d-ziegel3" width="60" height="30" patternUnits="userSpaceOnUse"><rect width="60" height="30" fill="#b2503a"/><path d="M0 30a30 30 0 0 1 60 0" fill="#c45f47" stroke="#8a3a2a" stroke-width="2"/></pattern></defs>' +
            '<rect id="dr-sky" width="1000" height="520" fill="url(#skyday)"/><rect y="520" width="1000" height="80" fill="#7d8c5a"/>' +
            '<g id="dr-rain" class="rain" style="display:none" stroke="#6fbdf0" stroke-width="2" stroke-linecap="round">' + rep(40, function (i) { return '<line x1="' + (i * 25 + 10) + '" y1="0" x2="' + (i * 25) + '" y2="520"/>'; }) + '</g>' +
            '<rect x="200" y="300" width="600" height="220" fill="#fbf7ef" stroke="#5a4634" stroke-width="6"/>' +
            '<g data-hs="daemm" class="sr-hs"><path d="M170 300L500 90L830 300z" fill="url(#d-ziegel3)" stroke="#5a4634" stroke-width="4"/><path id="dr-insul" d="M200 290L500 110L800 290z" fill="#e8c35a" opacity="0"/></g>' +
            '<g data-hs="rinne" class="sr-hs"><path d="M160 302H840" stroke="#8c98a6" stroke-width="12" stroke-linecap="round" fill="none"/><path id="dr-flow" d="M170 302H840V500" stroke="#3aa0e6" stroke-width="5" fill="none" style="display:none"/><path d="M840 302V500" stroke="#8c98a6" stroke-width="10" fill="none"/></g>' +
            '<g data-hs="tonne" class="sr-hs"><rect x="800" y="440" width="80" height="80" rx="8" fill="#5f6b78"/><rect id="dr-level" x="806" y="500" width="68" height="14" rx="4" fill="#3aa0e6"/><text x="840" y="535" text-anchor="middle" font-size="11" font-family="system-ui" fill="#fff">Regentonne</text></g>' +
            '</svg>';
        },
        update: function (svg, s) {
          var q = function (id) { return svg.querySelector('#' + id); };
          q('dr-rain').style.display = s.rain ? '' : 'none';
          q('dr-sky').setAttribute('fill', s.rain ? '#9aa6b4' : 'url(#skyday)');
          q('dr-flow').style.display = s.rain ? '' : 'none'; q('dr-flow').classList.toggle('flow', s.rain);
          var lvl = q('dr-level'); lvl.classList.toggle('fill', s.rain);
          q('dr-insul').setAttribute('opacity', s.insul ? .85 : 0);
        },
        hotspots: [
          { id: 'rinne', at: [500, 300], kicker: 'Wasser', title: 'Wohin das Wasser geht', text: 'Lassen Sie es regnen und sehen Sie, wie Rinne und Fallrohr das Wasser abführen. Gefälle 3 mm pro Meter, Laubfang am Einlauf.',
            onOpen: { rain: true },
            info: function () { return '<b>Ein Dach mit 150 m²</b> liefert bei einem Starkregen in 10 Minuten rund 1.500 Liter.'; } },
          { id: 'tonne', at: [840, 430], kicker: 'Garten', title: 'Regenwasser nutzen', text: 'Regentonne oder Zisterne am Fallrohr: Gießwasser kostenlos, Kanal entlastet. Mit Überlauf und Filter.',
            onOpen: { rain: true },
            info: function () { return '<b>Zisterne:</b> 5.000 Liter reichen für Garten und WC-Spülung eines Haushalts.'; } },
          { id: 'daemm', at: [500, 80], kicker: 'Dämmung', title: 'Dämmung zwischen und auf den Sparren', text: 'Beim Neudecken dämmen wir gleich mit. Die gelbe Schicht zeigt die Aufsparrendämmung: lückenlos, kein Wärmeverlust, Räume bleiben innen gleich groß.',
            onOpen: { insul: true }, onClose: { insul: false },
            options: [{ type: 'toggle', key: 'insul', label: 'Dämmung zeigen' }],
            info: function () { return '<b>Ersparnis:</b> bis zu 30 % Heizkosten, Förderung über Sanierungsbonus möglich.'; } }
        ]
      }
    ]
  };

  /* ---------- Start ---------- */
  function mountAll() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-showroom]'), function (root) {
      var g = root.getAttribute('data-showroom');
      var scene = SCENES[g];
      if (!scene) { root.remove(); return; }
      new Showroom(root, scene);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountAll); else mountAll();
  window.Showroom = { scenes: SCENES };
})();
