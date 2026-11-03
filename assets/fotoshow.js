/* Foto-Showroom: Hotspots direkt im echten Foto. Zoom, Blenden, Effekte auf dem Bild.
   Lorenz Höller Webdesign. Reines JS, keine Bibliotheken. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function sv(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var UID = 0;

  /* ---------------- Effekte ---------------- */
  var FX = {};

  /* Wasserstrahl von einer Armatur in ein Becken */
  FX.water = function (st, c) {
    var g = st.g('fx-water'), a = st.p(c.from), b = st.p(c.to), w = c.w || 5, id = st.uid('wg');
    var grad = sv('linearGradient', { id: id, x1: 0, y1: 0, x2: 0, y2: 1 }, st.defs);
    sv('stop', { offset: 0, 'stop-color': '#e6f6ff', 'stop-opacity': .95 }, grad);
    sv('stop', { offset: 1, 'stop-color': '#8fcdf3', 'stop-opacity': .8 }, grad);
    var d = 'M' + a.x + ' ' + a.y + ' C ' + a.x + ' ' + (a.y + (b.y - a.y) * .45) + ', ' + b.x + ' ' + (a.y + (b.y - a.y) * .6) + ', ' + b.x + ' ' + b.y;
    var path = sv('path', { d: d, stroke: 'url(#' + id + ')', 'stroke-width': w, fill: 'none', 'stroke-linecap': 'round' }, g);
    var hl = sv('path', { d: d, stroke: '#fff', 'stroke-width': w * .3, fill: 'none', 'stroke-linecap': 'round', 'stroke-dasharray': '5 9', opacity: .85 }, g);
    sv('animate', { attributeName: 'stroke-dashoffset', from: 0, to: -28, dur: '0.45s', repeatCount: 'indefinite' }, hl);
    for (var i = 0; i < 3; i++) {
      var e = sv('ellipse', { cx: b.x, cy: b.y, rx: 1, ry: .5, fill: 'none', stroke: '#fff', 'stroke-width': 1.2, opacity: 0 }, g);
      sv('animate', { attributeName: 'rx', from: 2, to: w * 4.5, dur: '1.4s', begin: (i * .46) + 's', repeatCount: 'indefinite' }, e);
      sv('animate', { attributeName: 'ry', from: .8, to: w * 1.5, dur: '1.4s', begin: (i * .46) + 's', repeatCount: 'indefinite' }, e);
      sv('animate', { attributeName: 'opacity', from: .9, to: 0, dur: '1.4s', begin: (i * .46) + 's', repeatCount: 'indefinite' }, e);
    }
    var steam = st.steam(g, b.x, b.y - w, w * 2.2);
    return { update: function (s) {
      var on = !!s[c.key]; g.vis = on;
      var t = c.tempKey ? Number(s[c.tempKey]) : 0; steam.style.opacity = (on && t >= 36) ? Math.min(1, (t - 35) / 7) : 0;
      path.setAttribute('stroke-width', w * (c.flowKey ? .45 + .55 * (Number(s[c.flowKey]) / 100) : 1));
    } };
  };

  /* Regen oder Dusche in einem Bereich */
  FX.rain = function (st, c) {
    var id = st.clip(c.poly), g = st.g('fx-rain'); g.setAttribute('clip-path', 'url(#' + id + ')');
    var bb = st.bbox(c.poly), n = c.n || 46, len = c.len || 26;
    for (var i = 0; i < n; i++) {
      var x = rnd(bb.x, bb.x + bb.w), l = len * rnd(.6, 1.4), dur = rnd(.55, .95);
      var ln = sv('line', { x1: x, y1: -l, x2: x + (c.slant || 0), y2: 0, stroke: '#e4f3ff', 'stroke-width': rnd(1.3, 2.4), 'stroke-linecap': 'round', opacity: rnd(.5, .95) }, g);
      sv('animateTransform', { attributeName: 'transform', type: 'translate', from: '0 ' + bb.y, to: '0 ' + (bb.y + bb.h + l), dur: dur + 's', begin: (-rnd(0, 1)) + 's', repeatCount: 'indefinite' }, ln);
    }
    if (c.mist !== false) {
      var m = sv('ellipse', { cx: bb.x + bb.w / 2, cy: bb.y + bb.h, rx: bb.w * .7, ry: bb.h * .12, fill: '#fff', opacity: .22 }, g);
      sv('animate', { attributeName: 'opacity', values: '.12;.3;.12', dur: '2.6s', repeatCount: 'indefinite' }, m);
    }
    return { update: function (s) { g.vis = !!s[c.key]; } };
  };

  /* Wasser steigt in einer Wanne */
  FX.fill = function (st, c) {
    var id = st.clip(c.poly), g = st.g('fx-fill'); g.setAttribute('clip-path', 'url(#' + id + ')');
    var bb = st.bbox(c.poly), gid = st.uid('fg');
    var grad = sv('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, st.defs);
    sv('stop', { offset: 0, 'stop-color': (c.colors || [])[0] || '#bfe6fb', 'stop-opacity': .5 }, grad);
    sv('stop', { offset: 1, 'stop-color': (c.colors || [])[1] || '#4ea6d8', 'stop-opacity': .62 }, grad);
    var body = sv('path', { fill: 'url(#' + gid + ')' }, g);
    var wave = sv('path', { fill: 'none', stroke: '#fff', 'stroke-width': 1.4, opacity: .7 }, g);
    var steam = st.steam(g, bb.x + bb.w / 2, bb.y, bb.w * .5, 9);
    var top = st.p([0, c.top]).y, bottom = st.p([0, c.bottom]).y, lvl = 0, target = 0, raf = null, ramp = null, phase = 0;
    function draw(ts) {
      phase = (ts || 0) / 900;
      var y = bottom - (bottom - top) * lvl, d = 'M' + (bb.x - 5) + ' ' + y;
      for (var x = bb.x - 5; x <= bb.x + bb.w + 5; x += 8) d += ' L' + x + ' ' + (y + Math.sin(x / 22 + phase) * 1.6);
      wave.setAttribute('d', d);
      body.setAttribute('d', d + ' L' + (bb.x + bb.w + 5) + ' ' + (bb.y + bb.h + 5) + ' L' + (bb.x - 5) + ' ' + (bb.y + bb.h + 5) + ' Z');
    }
    function loop(ts) { lvl += (target - lvl) * .06; draw(ts); if (Math.abs(target - lvl) > .002 || lvl > 0) raf = requestAnimationFrame(loop); else raf = null; }
    return { update: function (s) {
      target = clamp(Number(s[c.key]) / 100, 0, 1);
      g.vis = target > .01;
      steam.style.opacity = (target > .1 && c.tempKey && Number(s[c.tempKey]) >= 36) ? 1 : 0;
      if (!raf) raf = requestAnimationFrame(loop);
      if (c.onKey) {
        if (s[c.onKey] && !ramp) ramp = setInterval(function () { if (st.state[c.key] < 88) { st.state[c.key] = Math.min(88, Number(st.state[c.key]) + 1.5); st.update(); } else { clearInterval(ramp); ramp = null; } }, 90);
        if (!s[c.onKey] && ramp) { clearInterval(ramp); ramp = null; }
      }
    } };
  };

  /* Ein Stück des Fotos bewegt sich: Lade fährt heraus, Tür klappt auf */
  FX.slice = function (st, c) {
    var r = c.rect, inside = el('div', 'fx-inside fx-inside-' + c.mode), slice = el('div', 'fx-slice fx-slice-' + c.mode);
    var pos = 'left:' + r[0] + '%;top:' + r[1] + '%;width:' + r[2] + '%;height:' + r[3] + '%;';
    inside.style.cssText = pos + (c.insideStyle || '');
    if (c.inside) inside.innerHTML = c.inside;
    var lit = el('div', 'fx-inside-lit'); inside.appendChild(lit);
    slice.style.cssText = pos + 'background-image:url("' + st.src + '");background-size:' + (10000 / r[2]) + '% ' + (10000 / r[3]) + '%;background-position:' + (r[2] >= 100 ? 0 : r[0] / (100 - r[2]) * 100) + '% ' + (r[3] >= 100 ? 0 : r[1] / (100 - r[3]) * 100) + '%;' + (c.delay ? 'transition-delay:' + c.delay + 'ms;' : '');
    if (c.delay) inside.style.transitionDelay = c.delay + 'ms';
    if (c.shape) { /* Umriss im Bild (Prozent) auf das Stück umrechnen, z. B. schräges Dachfenster */
      var cp = 'polygon(' + c.shape.map(function (pt) { return ((pt[0] - r[0]) / r[2] * 100).toFixed(2) + '% ' + ((pt[1] - r[1]) / r[3] * 100).toFixed(2) + '%'; }).join(',') + ')';
      slice.style.clipPath = cp; inside.style.clipPath = cp;
    }
    if (c.inside || c.insideStyle) st.html.appendChild(inside); st.html.appendChild(slice);
    return { update: function (s) {
      var on = !!s[c.key]; slice.classList.toggle('open', on); inside.classList.toggle('open', on);
      if (c.lightKey) lit.classList.toggle('on', !!s[c.lightKey]);
      if (c.mode === 'spin') { var k = c.speedKey ? clamp(Number(s[c.speedKey]) / 12, .2, 1) : 1; slice.style.setProperty('--spd', (2.6 - 2.2 * k).toFixed(2) + 's'); }
    } };
  };

  /* Lichtschein */
  FX.glow = function (st, c) {
    var d = el('div', 'fx-glow');
    d.style.cssText = 'left:' + (c.at[0] - c.rx) + '%;top:' + (c.at[1] - c.ry) + '%;width:' + (c.rx * 2) + '%;height:' + (c.ry * 2) + '%;background:radial-gradient(ellipse at center,' + (c.color || '#ffe3b0') + ' 0%,' + (c.color || '#ffe3b0') + '66 28%,transparent 68%)';
    st.html.appendChild(d);
    return { update: function (s) { var on = s[c.key] || (c.nightKey && s[c.nightKey]); var k = c.dimFn ? clamp(c.dimFn(s), 0, 1) : (c.dimKey ? Number(s[c.dimKey]) / 100 : 1); d.style.opacity = on ? (k * (c.max || 1)) : 0; } };
  };

  /* Abend hinter dem Fenster */
  FX.night = function (st, c) {
    var id = st.clip(c.poly), g = st.g('fx-night'); g.setAttribute('clip-path', 'url(#' + id + ')');
    var bb = st.bbox(c.poly), gid = st.uid('ng');
    var grad = sv('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, st.defs);
    sv('stop', { offset: 0, 'stop-color': '#16244d' }, grad);
    sv('stop', { offset: .5, 'stop-color': '#2b3f72' }, grad);
    sv('stop', { offset: 1, 'stop-color': '#5a5a6e' }, grad);
    sv('rect', { x: bb.x - 2, y: bb.y - 2, width: bb.w + 4, height: bb.h + 4, fill: 'url(#' + gid + ')', style: 'mix-blend-mode:multiply', opacity: .82 }, g);
    sv('rect', { x: bb.x - 2, y: bb.y - 2, width: bb.w + 4, height: bb.h + 4, fill: '#1a2a5a', style: 'mix-blend-mode:multiply', opacity: .22 }, g);
    for (var i = 0; i < 26; i++) {
      var s = sv('circle', { cx: rnd(bb.x + 3, bb.x + bb.w - 3), cy: rnd(bb.y + 3, bb.y + bb.h * .45), r: rnd(.5, 1.4), fill: '#fff', opacity: rnd(.4, .95) }, g);
      sv('animate', { attributeName: 'opacity', values: '.2;1;.2', dur: rnd(1.5, 3.5) + 's', begin: (-rnd(0, 3)) + 's', repeatCount: 'indefinite' }, s);
    }
    sv('circle', { cx: bb.x + bb.w * (c.moon ? c.moon[0] : .78), cy: bb.y + bb.h * (c.moon ? c.moon[1] : .2), r: 7, fill: '#fff6d8', opacity: .95 }, g);
    sv('circle', { cx: bb.x + bb.w * (c.moon ? c.moon[0] : .78), cy: bb.y + bb.h * (c.moon ? c.moon[1] : .2), r: 14, fill: '#fff6d8', opacity: .18 }, g);
    return { update: function (s) { var on = !!s[c.key]; g.vis = on; st.stage.classList.toggle('fx-isnight', on); } };
  };

  /* Farbe über einer Fläche, Luminanz bleibt */
  FX.tint = function (st, c) {
    /* Wert: [key, label, farbe, blend, deckkraft] oder [key, label, [[farbe, blend, deckkraft], ...]] für mehrere Ebenen */
    var d = st.path(c.poly, c.holes), paths = [];
    for (var i = 0; i < (c.layers || 2); i++) paths.push(sv('path', { d: d, 'fill-rule': 'evenodd', class: 'fx-tint', opacity: 0 }, st.svg));
    return { update: function (s) {
      var v = null; (c.values || []).forEach(function (x) { if (String(x[0]) === String(s[c.key])) v = x; });
      var layers = !v || !v[2] ? [] : (Array.isArray(v[2]) ? v[2] : [[v[2], v[3], v[4]]]);
      paths.forEach(function (p, i) {
        var L = layers[i]; if (!L) { p.style.opacity = 0; return; }
        p.setAttribute('fill', L[0]); p.style.mixBlendMode = L[1] || 'color'; p.style.opacity = L[2] == null ? 1 : L[2];
      });
    } };
  };

  /* Wärme: Schein plus Flimmern über dem Heizkörper */
  FX.heat = function (st, c) {
    var r = c.rect, fid = st.uid('hf');
    var f = sv('filter', { id: fid, x: '-10%', y: '-10%', width: '120%', height: '120%' }, st.defs);
    var tb = sv('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.02 0.06', numOctaves: 2, seed: 3, result: 'n' }, f);
    sv('animate', { attributeName: 'baseFrequency', values: '0.02 0.06;0.025 0.08;0.02 0.06', dur: '1.6s', repeatCount: 'indefinite' }, tb);
    sv('feDisplacementMap', { 'in': 'SourceGraphic', in2: 'n', scale: 7, xChannelSelector: 'R', yChannelSelector: 'G' }, f);
    var sh = el('div', 'fx-shimmer');
    var top = Math.max(0, r[1] - r[3] * .6), h = r[1] + r[3] * .3 - top;
    sh.style.cssText = 'left:' + r[0] + '%;top:' + top + '%;width:' + r[2] + '%;height:' + h + '%;background-image:url("' + st.src + '");background-size:' + (10000 / r[2]) + '% ' + (10000 / h) + '%;background-position:' + (r[0] / (100 - r[2]) * 100) + '% ' + (top / (100 - h) * 100) + '%;filter:url(#' + fid + ')';
    st.html.appendChild(sh);
    var glow = el('div', 'fx-glow');
    glow.style.cssText = 'left:' + (r[0] - r[2] * .6) + '%;top:' + (r[1] - r[3] * .2) + '%;width:' + (r[2] * 2.2) + '%;height:' + (r[3] * 1.4) + '%;background:radial-gradient(ellipse at center,#ff9a4a 0%,#ff9a4a55 30%,transparent 68%)';
    st.html.appendChild(glow);
    return { update: function (s) { var t = Number(s[c.key]) || 0, k = clamp((t - 22) / 38, 0, 1); glow.style.opacity = k * .9; sh.style.opacity = k > .15 ? Math.min(1, k * 1.4) : 0; } };
  };

  /* Gasflammen */
  FX.flame = function (st, c) {
    var g = st.g('fx-flames'), rings = [];
    c.points.forEach(function (pt) {
      var p = st.p(pt), ring = sv('g', { transform: 'translate(' + p.x + ' ' + p.y + ')' }, g), parts = [];
      for (var i = 0; i < 10; i++) {
        var a = i / 10 * Math.PI * 2, x = Math.cos(a) * (c.r || 11), y = Math.sin(a) * (c.r || 11) * .38;
        var fl = sv('path', { d: 'M0 0 C -1.6 -2, -1.4 -4.5, 0 -7 C 1.4 -4.5, 1.6 -2, 0 0 Z', fill: '#4aa9ff', opacity: .9, transform: 'translate(' + x + ' ' + y + ')', class: 'fx-flame', style: 'animation-delay:' + (-i * .13) + 's' }, ring);
        parts.push(fl);
      }
      rings.push({ g: ring, parts: parts, p: p });
    });
    return { update: function (s) {
      var on = !!s[c.key], k = c.sizeKey ? clamp(Number(s[c.sizeKey]) / 9, .25, 1) : 1;
      g.vis = on;
      rings.forEach(function (r) { r.g.setAttribute('transform', 'translate(' + r.p.x + ' ' + r.p.y + ') scale(' + (.6 + .7 * k) + ')'); });
    } };
  };

  /* Spülung im WC */
  FX.swirl = function (st, c) {
    var p = st.p(c.at), g = sv('g', { class: 'fx-swirl', opacity: 0, transform: 'translate(' + p.x + ' ' + p.y + ')' }, st.svg), last = 0;
    var sp = sv('path', { d: 'M0 0 m-1 0 a1 .5 0 1 0 2 0 a2 1 0 1 0 -4 0 a3 1.5 0 1 0 6 0 a4 2 0 1 0 -8 0 a5 2.5 0 1 0 10 0', fill: 'none', stroke: '#dff3ff', 'stroke-width': 1.3, 'stroke-linecap': 'round' }, g);
    var rot = sv('animateTransform', { attributeName: 'transform', type: 'rotate', from: '0', to: '1080', dur: '1.8s', begin: 'indefinite' }, sp);
    sv('ellipse', { cx: 0, cy: 0, rx: c.rx || 4, ry: c.ry || 1.8, fill: '#bfe6fb', opacity: .55 }, g);
    return { update: function (s) {
      if (s[c.key] && s[c.key] !== last) {
        last = s[c.key]; g.style.opacity = 1; try { rot.beginElement(); } catch (e) { }
        setTimeout(function () { g.style.opacity = 0; }, 1900);
      }
    } };
  };

  /* Rauch aus dem Kamin */
  FX.smoke = function (st, c) {
    var g = st.g('fx-smoke'), p = st.p(c.at);
    for (var i = 0; i < 8; i++) {
      var ci = sv('circle', { cx: p.x, cy: p.y, r: rnd(3, 6), fill: '#e8e8ea', opacity: 0 }, g), dur = rnd(2.6, 4), b = (-rnd(0, 3)) + 's';
      sv('animateTransform', { attributeName: 'transform', type: 'translate', from: '0 0', to: (rnd(-14, 24)) + ' ' + (-rnd(40, 70)), dur: dur + 's', begin: b, repeatCount: 'indefinite' }, ci);
      sv('animate', { attributeName: 'opacity', values: '0;.55;0', dur: dur + 's', begin: b, repeatCount: 'indefinite' }, ci);
      sv('animate', { attributeName: 'r', from: 2, to: 11, dur: dur + 's', begin: b, repeatCount: 'indefinite' }, ci);
    }
    return { update: function (s) { g.vis = !!s[c.key]; } };
  };

  /* Sicherungsreihen: aus = rot */
  FX.leds = function (st, c) {
    var items = c.rows.map(function (row) {
      var r = row.rect, g = st.g('fx-row'); g.vis = true;
      var a = st.p([r[0], r[1]]), b = st.p([r[0] + r[2], r[1] + r[3]]);
      var cover = sv('rect', { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y, rx: 4, fill: '#d33', opacity: 0, style: 'transition:opacity .4s' }, g);
      var led = sv('circle', { cx: b.x + 9, cy: (a.y + b.y) / 2, r: 4.5, fill: '#2ecc71', stroke: '#fff', 'stroke-width': 1.2 }, g);
      return { row: row, cover: cover, led: led };
    });
    return { update: function (s) {
      items.forEach(function (it) {
        var off = s[it.row.key] === false || s[c.tripKey] === 'trip';
        it.cover.style.opacity = off ? .32 : 0; it.led.setAttribute('fill', off ? '#e03131' : '#2ecc71');
      });
    } };
  };

  /* Stromfluss entlang von Leitungen */
  FX.wires = function (st, c) {
    var g = st.g('fx-wires');
    c.lines.forEach(function (ln, i) {
      var pts = ln.map(function (pt) { var p = st.p(pt); return p.x + ',' + p.y; }).join(' ');
      sv('polyline', { points: pts, fill: 'none', stroke: '#0b1a2b', 'stroke-width': 3.2, opacity: .35, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
      var w = sv('polyline', { points: pts, fill: 'none', stroke: c.color || '#4fe3ff', 'stroke-width': 2, 'stroke-dasharray': '5 11', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
      sv('animate', { attributeName: 'stroke-dashoffset', from: 0, to: -32, dur: (0.7 + i * .08) + 's', repeatCount: 'indefinite' }, w);
    });
    return { update: function (s) { g.vis = !!s[c.key]; } };
  };

  /* Aufkleber, Schild im Bild */
  FX.sticker = function (st, c) {
    var d = el('div', 'fx-sticker', c.html);
    d.style.cssText = 'left:' + c.rect[0] + '%;top:' + c.rect[1] + '%;width:' + c.rect[2] + '%;' + (c.style || '');
    st.html.appendChild(d);
    return { update: function (s) { d.classList.toggle('on', !!s[c.key]); } };
  };

  /* Abklebeband entlang von Kanten */
  FX.tape = function (st, c) {
    var g = st.g('fx-tape'), lines = [];
    c.lines.forEach(function (ln) {
      var pts = ln.map(function (pt) { var p = st.p(pt); return p.x + ',' + p.y; }).join(' ');
      var l = sv('polyline', { points: pts, fill: 'none', stroke: '#6fb6ff', 'stroke-width': 4, opacity: .85, 'stroke-linecap': 'butt' }, g);
      lines.push(l);
    });
    return { update: function (s) {
      var on = !!s[c.key]; g.vis = on;
      requestAnimationFrame(function () { lines.forEach(function (l) {
        if (!l._L && on) { l._L = l.getTotalLength(); l.style.strokeDasharray = l._L; l.style.strokeDashoffset = l._L; void l.getBoundingClientRect(); }
        if (l._L) l.style.strokeDashoffset = on ? 0 : l._L;
      }); });
    } };
  };

  /* Schallwellen oder Luftbewegung: Ringe, die sich ausbreiten */
  FX.rings = function (st, c) {
    var g = st.g('fx-rings'), p = st.p(c.at);
    for (var i = 0; i < (c.n || 4); i++) {
      var e = sv('ellipse', { cx: p.x, cy: p.y, rx: 4, ry: 2, fill: 'none', stroke: c.color || '#fff', 'stroke-width': 1.6, opacity: 0 }, g), b = (i * .7) + 's';
      sv('animate', { attributeName: 'rx', from: 6, to: c.r || 160, dur: '2.8s', begin: b, repeatCount: 'indefinite' }, e);
      sv('animate', { attributeName: 'ry', from: 3, to: (c.r || 160) * .55, dur: '2.8s', begin: b, repeatCount: 'indefinite' }, e);
      sv('animate', { attributeName: 'opacity', values: '.8;0', dur: '2.8s', begin: b, repeatCount: 'indefinite' }, e);
    }
    return { update: function (s) { g.vis = !!s[c.key]; } };
  };

  /* Dampf oder Nebel an einer Stelle */
  FX.steamfx = function (st, c) {
    var g = st.g('fx-steam'), p = st.p(c.at);
    st.steam(g, p.x, p.y, c.spread || 30, c.n || 10).style.opacity = 1;
    return { update: function (s) { g.vis = !!s[c.key]; } };
  };

  /* Zeiger auf einem Manometer */
  FX.needle = function (st, c) {
    var p = st.p(c.at), g = sv('g', { transform: 'translate(' + p.x + ' ' + p.y + ')' }, st.svg), r = c.r || 9, cur = c.start || 0, target = cur, raf = null;
    sv('circle', { cx: 0, cy: 0, r: r + 1.5, fill: 'none', stroke: '#fff', 'stroke-width': .8, opacity: .5 }, g);
    var n = sv('line', { x1: 0, y1: 0, x2: 0, y2: -r, stroke: '#ff3b30', 'stroke-width': 1.4, 'stroke-linecap': 'round' }, g);
    sv('circle', { cx: 0, cy: 0, r: 1.4, fill: '#fff' }, g);
    function loop() { cur += (target - cur) * .12; n.setAttribute('transform', 'rotate(' + cur + ')'); if (Math.abs(target - cur) > .2) raf = requestAnimationFrame(loop); else raf = null; }
    return { update: function (s) { var v = typeof c.angle === 'function' ? c.angle(s) : Number(s[c.key]); target = v; if (!raf) raf = requestAnimationFrame(loop); } };
  };

  /* Blasen in einem Behälter, kurz nach einem Auslöser */
  FX.bubbles = function (st, c) {
    var id = st.clip(c.poly), g = st.g('fx-bubbles'); g.setAttribute('clip-path', 'url(#' + id + ')');
    var bb = st.bbox(c.poly), last = 0;
    for (var i = 0; i < (c.n || 26); i++) {
      var x = rnd(bb.x + bb.w * .15, bb.x + bb.w * .85), dur = rnd(1.2, 2.2), b = (-rnd(0, 2)) + 's';
      var ci = sv('circle', { cx: x, cy: bb.y + bb.h, r: rnd(1.5, 4), fill: '#fff', opacity: 0 }, g);
      sv('animateTransform', { attributeName: 'transform', type: 'translate', from: '0 0', to: rnd(-8, 8) + ' ' + (-bb.h * rnd(.6, 1)), dur: dur + 's', begin: b, repeatCount: 'indefinite' }, ci);
      sv('animate', { attributeName: 'opacity', values: '0;.75;0', dur: dur + 's', begin: b, repeatCount: 'indefinite' }, ci);
    }
    sv('rect', { x: bb.x, y: bb.y, width: bb.w, height: bb.h, fill: '#9fd8ff', opacity: .18 }, g);
    return { update: function (s) {
      if (s[c.key] && s[c.key] !== last) { last = s[c.key]; g.vis = true; clearTimeout(g._off); g._off = setTimeout(function () { g.vis = false; }, c.dur || 4200); }
    } };
  };

  /* Auto fährt in den Carport */
  FX.car = function (st, c) {
    var d = el('div', 'fx-car', '<svg viewBox="0 0 200 90" preserveAspectRatio="xMidYMid meet"><path d="M14 62 L24 38 Q30 26 44 24 L116 22 Q136 22 150 36 L186 46 Q196 50 194 62 L190 66 L14 66 Z" fill="' + (c.color || '#2b3340') + '"/><path d="M48 30 L112 28 Q128 28 138 40 L52 42 Q44 40 48 30 Z" fill="#9fc7e8" opacity=".9"/><rect x="60" y="43" width="78" height="3" fill="#1b212b" opacity=".5"/><g class="wheel"><circle cx="52" cy="66" r="13" fill="#1b1f26"/><circle cx="52" cy="66" r="6" fill="#aab3bd"/><path d="M52 60v12M46 66h12" stroke="#1b1f26" stroke-width="2"/></g><g class="wheel"><circle cx="152" cy="66" r="13" fill="#1b1f26"/><circle cx="152" cy="66" r="6" fill="#aab3bd"/><path d="M152 60v12M146 66h12" stroke="#1b1f26" stroke-width="2"/></g><rect x="186" y="50" width="6" height="5" rx="1" fill="#ffd57a"/><rect x="14" y="52" width="6" height="5" rx="1" fill="#ff5a4a"/></svg>');
    d.style.cssText = 'left:' + c.rect[0] + '%;top:' + c.rect[1] + '%;width:' + c.rect[2] + '%;';
    st.html.appendChild(d);
    return { update: function (s) { d.classList.toggle('in', !!s[c.key]); } };
  };

  /* Ein Zustand zieht andere nach, z. B. Abend setzt den Speicherstand */
  FX.link = function (st, c) {
    var last;
    return { update: function (s) {
      var v = !!s[c.key]; if (v === last) return; last = v;
      var set = v ? c.on : c.off; if (!set) return;
      setTimeout(function () { Object.assign(st.state, set); st.update(); }, c.delay || 300);
    } };
  };

  /* ---------------- Inhalte für geöffnete Laden und Schränke ---------------- */
  var INSIDE = {
    towels: '<svg viewBox="0 0 100 40" preserveAspectRatio="none"><rect x="4" y="12" width="26" height="22" rx="4" fill="#d9e3ea"/><rect x="33" y="10" width="26" height="24" rx="4" fill="#9fb7c9"/><rect x="62" y="12" width="26" height="22" rx="4" fill="#e8dfd0"/><path d="M4 22h26M33 20h26M62 22h26" stroke="#ffffff66" stroke-width="2"/></svg>',
    bath: '<svg viewBox="0 0 100 40" preserveAspectRatio="none"><rect x="5" y="8" width="18" height="26" rx="3" fill="#cfd8dc"/><rect x="26" y="14" width="14" height="20" rx="2" fill="#f4e9d8"/><rect x="43" y="6" width="10" height="28" rx="5" fill="#8aa4b8"/><rect x="56" y="12" width="20" height="22" rx="3" fill="#dcd3c7"/><rect x="80" y="10" width="14" height="24" rx="3" fill="#b9c7d1"/></svg>',
    cutlery: '<svg viewBox="0 0 100 40" preserveAspectRatio="none"><rect x="4" y="6" width="92" height="28" rx="3" fill="#2f2a26"/><rect x="8" y="9" width="20" height="22" rx="2" fill="#3b352f"/><rect x="31" y="9" width="20" height="22" rx="2" fill="#3b352f"/><rect x="54" y="9" width="20" height="22" rx="2" fill="#3b352f"/><rect x="77" y="9" width="16" height="22" rx="2" fill="#3b352f"/><path d="M12 12v16M16 12v16M20 12v16M36 12v16M40 12v16M60 13v14M64 13v14M68 13v14M82 12v16" stroke="#d9d9d9" stroke-width="1.6"/></svg>',
    pots: '<svg viewBox="0 0 100 40" preserveAspectRatio="none"><rect x="6" y="14" width="26" height="20" rx="3" fill="#9aa1a8"/><rect x="36" y="10" width="20" height="24" rx="3" fill="#b8bec4"/><rect x="60" y="16" width="34" height="18" rx="3" fill="#7d8790"/><rect x="2" y="10" width="34" height="4" rx="2" fill="#c9cfd4"/></svg>',
    cabinet: '<svg viewBox="0 0 100 100" preserveAspectRatio="none"><rect x="0" y="0" width="100" height="100" fill="#1f2a33"/><rect x="0" y="30" width="100" height="2" fill="#e3c9a3"/><rect x="0" y="62" width="100" height="2" fill="#e3c9a3"/><rect x="0" y="94" width="100" height="2" fill="#e3c9a3"/><rect x="8" y="12" width="9" height="18" rx="2" fill="#d7e3ea"/><rect x="20" y="8" width="7" height="22" rx="3" fill="#8aa4b8"/><rect x="32" y="16" width="14" height="14" rx="2" fill="#f1e3cf"/><rect x="60" y="6" width="10" height="24" rx="2" fill="#c7d2d9"/><rect x="74" y="14" width="18" height="16" rx="2" fill="#e8e1d6"/><rect x="10" y="44" width="22" height="18" rx="2" fill="#f4f1ec"/><rect x="36" y="40" width="9" height="22" rx="3" fill="#b0c3cf"/><rect x="50" y="48" width="16" height="14" rx="2" fill="#dfd5c6"/><rect x="70" y="42" width="8" height="20" rx="3" fill="#7f9db0"/><rect x="82" y="46" width="10" height="16" rx="2" fill="#efe7da"/><rect x="8" y="72" width="30" height="22" rx="2" fill="#cfd8dd"/><rect x="42" y="76" width="22" height="18" rx="2" fill="#e5dccf"/><rect x="68" y="70" width="24" height="24" rx="2" fill="#aebfc9"/><rect x="0" y="0" width="100" height="3" fill="#fff4d6" opacity=".9"/></svg>',
    wardrobe: '<svg viewBox="0 0 100 100" preserveAspectRatio="none"><rect width="100" height="100" fill="#2a2f36"/><rect x="6" y="8" width="88" height="2" fill="#c9ced6"/><g fill="#8aa4b8"><rect x="10" y="10" width="9" height="34" rx="2"/><rect x="22" y="10" width="9" height="36" rx="2" fill="#d9d2c7"/><rect x="34" y="10" width="9" height="33" rx="2" fill="#5f6c7a"/><rect x="46" y="10" width="9" height="37" rx="2" fill="#b9c7d1"/><rect x="58" y="10" width="9" height="35" rx="2" fill="#8c7b6a"/><rect x="70" y="10" width="9" height="34" rx="2" fill="#e8e1d6"/><rect x="82" y="10" width="8" height="36" rx="2" fill="#6f8aa0"/></g><rect x="6" y="56" width="88" height="1.5" fill="#e3c9a3"/><rect x="6" y="76" width="88" height="1.5" fill="#e3c9a3"/><rect x="10" y="60" width="24" height="14" rx="1.5" fill="#d7dde3"/><rect x="38" y="60" width="24" height="14" rx="1.5" fill="#c9bfae"/><rect x="66" y="60" width="24" height="14" rx="1.5" fill="#aebfc9"/><rect x="10" y="80" width="80" height="14" rx="1.5" fill="#3b424a"/></svg>',
    shelves: '<svg viewBox="0 0 100 100" preserveAspectRatio="none"><rect width="100" height="100" fill="#2a2f36"/><rect x="0" y="24" width="100" height="1.5" fill="#e3c9a3"/><rect x="0" y="49" width="100" height="1.5" fill="#e3c9a3"/><rect x="0" y="74" width="100" height="1.5" fill="#e3c9a3"/><rect x="12" y="8" width="76" height="14" rx="2" fill="#d7dde3"/><rect x="12" y="33" width="76" height="14" rx="2" fill="#c9bfae"/><rect x="12" y="58" width="34" height="14" rx="2" fill="#aebfc9"/><rect x="52" y="58" width="36" height="14" rx="2" fill="#e8e1d6"/><rect x="12" y="82" width="76" height="12" rx="2" fill="#8c7b6a"/></svg>',
    window: '<svg viewBox="0 0 100 100" preserveAspectRatio="none"><rect width="100" height="100" fill="#2b2420"/><rect x="10" y="40" width="80" height="60" fill="#3d332c"/><rect x="0" y="0" width="100" height="100" fill="url(#g)"/><ellipse cx="50" cy="55" rx="40" ry="30" fill="#ffd9a0" opacity=".35"/></svg>'
  };

  /* ---------------- Szenen ---------------- */
  var SCENES = [
    {
      id: 'bad-berg', test: /drack-installationen\/img\/bad\.jpg(\?|$)/, ar: 1168 / 880,
      hint: 'Tippen Sie auf einen Punkt im Foto',
      initial: { shower: false, temp: 38, led: false, mirror: false, mlight: false, tap: false, drawers: false, night: false, tub: false, level: 0, bath: 38, floor: false },
      effects: [
        ['rain', { key: 'shower', poly: [[9, 9], [20, 9], [23, 80], [4, 82]], n: 50 }],
        ['glow', { key: 'led', at: [13, 31], rx: 8, ry: 6, color: '#ffe6b8', nightKey: 'night', max: .9 }],
        ['slice', { key: 'mirror', mode: 'doorL', rect: [31.6, 15.8, 18.1, 23.6], inside: INSIDE.cabinet }],
        ['glow', { key: 'mlight', at: [40.5, 27.5], rx: 15, ry: 17, color: '#fff1d2', nightKey: 'night', max: .75 }],
        ['water', { key: 'tap', from: [42.6, 42.4], to: [42.8, 46.9], w: 5, tempKey: 'temp' }],
        ['slice', { key: 'drawers', mode: 'drawer', rect: [30.2, 50.2, 26.8, 6.4], inside: INSIDE.towels }],
        ['slice', { key: 'drawers', mode: 'drawer', rect: [30.2, 56.7, 26.8, 7.6], inside: INSIDE.bath, delay: 220 }],
        ['night', { key: 'night', poly: [[64.6, 21.8], [92.3, 21.8], [92.3, 47.3], [64.6, 47.3]], moon: [.8, .22] }],
        ['glow', { key: 'night', at: [52, 10], rx: 10, ry: 7, color: '#ffe9c4', max: .7 }],
        ['water', { key: 'tub', from: [92.7, 50.8], to: [90.6, 57.2], w: 4.5, tempKey: 'bath' }],
        ['fill', { key: 'level', onKey: 'tub', tempKey: 'bath', poly: [[69.4, 56.5], [76, 55.4], [86, 54.8], [96, 55.1], [99.4, 56.2], [99.2, 58.2], [92, 59.2], [84, 59.6], [76, 59.7], [70.4, 58.7]], top: 55.6, bottom: 59.8 }],
        ['glow', { key: 'floor', at: [50, 86], rx: 42, ry: 15, color: '#ffb470', max: .45 }]
      ],
      hotspots: [
        { id: 'dusche', at: [14.2, 7.5], zoom: [16, 24, 1.9], kicker: 'Walk-in-Dusche', title: 'Regendusche, bodengleich', text: 'Kopfbrause 30 cm, Handbrause, Ablaufrinne ohne Schwelle. Thermostat hält die Temperatur, auch wenn nebenan jemand Wasser aufdreht.',
          options: [{ type: 'toggle', key: 'shower', label: 'Wasser an' }, { type: 'range', key: 'temp', label: 'Temperatur', min: 20, max: 45, unit: ' °C' }, { type: 'toggle', key: 'led', label: 'Nische beleuchten' }],
          auto: [['shower', true, 500], ['led', true, 1300]], callouts: [{ at: [13, 33], to: [27, 20], text: 'Ablagenische mit LED' }, { at: [14.2, 10.5], to: [30, 8], text: 'Kopfbrause 30 cm, Thermostat' }],
          info: function (s) { return s.shower ? 'Mischer auf ' + s.temp + ' °C, ca. 9 Liter pro Minute' : 'Wasser aus'; } },
        { id: 'spiegel', at: [40.5, 27], zoom: [40, 30, 2.3], kicker: 'Spiegelschrank', title: 'Spiegelschrank mit Lichtrahmen', text: 'Drei Fächer, Steckdose innen, Licht in der Tür. Tippen Sie, und er geht auf.',
          options: [{ type: 'toggle', key: 'mirror', label: 'Schrank öffnen' }, { type: 'toggle', key: 'mlight', label: 'Spiegellicht' }], auto: [['mlight', true, 400], ['mirror', true, 900]],
          callouts: [{ at: [49.5, 20], to: [54, 10], text: 'Tür mit Dämpfung, 120 cm breit' }] },
        { id: 'waschtisch', at: [43.2, 44.8], zoom: [44, 47, 2.6], kicker: 'Waschplatz', title: 'Aufsatzbecken mit Wandarmatur', text: 'Armatur aus der Wand, nichts steht im Weg beim Putzen. Darunter zwei Laden mit Vollauszug.',
          options: [{ type: 'toggle', key: 'tap', label: 'Wasser an' }, { type: 'range', key: 'temp', label: 'Temperatur', min: 20, max: 45, unit: ' °C' }, { type: 'toggle', key: 'drawers', label: 'Laden öffnen' }],
          auto: [['tap', true, 450], ['drawers', true, 1250]], callouts: [{ at: [55.5, 53.5], to: [50, 61.5], text: 'Vollauszug, Softclose' }],
          info: function (s) { return (s.tap ? 'Warmwasser ' + s.temp + ' °C' : 'Wasser aus') + (s.drawers ? ' · Laden offen' : ''); } },
        { id: 'fenster', at: [85, 25], zoom: [80, 34, 1.7], kicker: 'Fenster', title: 'Holz-Alu-Fenster mit Bergblick', text: 'Dreifach verglast, innen Holz, außen pflegefrei. Am Abend wird es gemütlich.',
          options: [{ type: 'toggle', key: 'night', label: 'Abendstimmung' }], auto: [['night', true, 500]],
          callouts: [{ at: [64.5, 30], to: [60, 16], text: 'Dreifachglas, Ug 0,6' }] },
        { id: 'wanne', at: [84, 66], zoom: [84, 63, 1.8], kicker: 'Badewanne', title: 'Freistehende Wanne, 180 cm', text: 'Standarmatur mit Handbrause. Einlassen, Temperatur wählen, fertig.',
          options: [{ type: 'toggle', key: 'tub', label: 'Wasser einlassen' }, { type: 'range', key: 'bath', label: 'Temperatur', min: 30, max: 42, unit: ' °C' }, { type: 'range', key: 'level', label: 'Füllstand', min: 0, max: 90, unit: ' %' }],
          auto: [['tub', true, 500]], callouts: [{ at: [93.3, 52], to: [78, 46], text: 'Standarmatur, Edelstahl' }],
          info: function (s) { return s.level > 5 ? Math.round(s.level * 2.1) + ' Liter, ' + s.bath + ' °C' : 'Wanne leer'; } },
        { id: 'boden', at: [50, 86], zoom: [50, 80, 1.6], kicker: 'Boden', title: 'Feinsteinzeug mit Fußbodenheizung', text: 'Großformat 60 × 120, wenig Fugen. Fußbodenheizung läuft im Sommer als Trocknung für den Duschbereich mit.',
          options: [{ type: 'toggle', key: 'floor', label: 'Fußbodenheizung' }], auto: [['floor', true, 400]],
          callouts: [{ at: [52, 84], to: [60, 93], text: 'Rutschfest R10, Fuge 2 mm' }] }
      ]
    },
    {
      id: 'bad-grau', test: /(installateur\/bad\.jpg|musterbetrieb\/img\/bad\.jpg)(\?|$)/, ar: 1168 / 880,
      initial: { shower: false, temp: 38, led: false, night: false, flush: 0, tap: false, drawers: false, mirror: false, mlight: false, rad: 22 },
      effects: [
        ['rain', { key: 'shower', poly: [[11, 11], [24, 11], [27, 70], [9, 72]], n: 50 }],
        ['glow', { key: 'led', at: [17.5, 32.5], rx: 7, ry: 5.5, color: '#ffe6b8', nightKey: 'night', max: .9 }],
        ['night', { key: 'night', poly: [[36, 17], [53.6, 17], [53.6, 43.2], [36, 43.2]], moon: [.75, .2] }],
        ['glow', { key: 'night', at: [43, 6], rx: 9, ry: 6, color: '#ffe9c4', max: .6 }],
        ['swirl', { key: 'flush', at: [55.2, 57.5], rx: 4.5, ry: 2 }],
        ['water', { key: 'tap', from: [84.3, 50.6], to: [83.9, 55.2], w: 5, tempKey: 'temp' }],
        ['slice', { key: 'drawers', mode: 'drawer', rect: [58.5, 57, 31.2, 13.2], inside: INSIDE.towels }],
        ['slice', { key: 'drawers', mode: 'drawer', rect: [58.5, 71, 31.2, 16.5], inside: INSIDE.bath, delay: 220 }],
        ['slice', { key: 'mirror', mode: 'doorL', rect: [70.5, 8.5, 29.5, 31.3], inside: INSIDE.cabinet }],
        ['glow', { key: 'mlight', at: [80, 5], rx: 17, ry: 5, color: '#fff4dc', nightKey: 'night', max: 1 }],
        ['glow', { key: 'mlight', at: [85, 25], rx: 16, ry: 16, color: '#fff1d2', nightKey: 'night', max: .55 }],
        ['heat', { key: 'rad', rect: [92.2, 15, 7.8, 31] }]
      ],
      hotspots: [
        { id: 'dusche', at: [17.5, 9.5], zoom: [20, 25, 1.9], kicker: 'Walk-in-Dusche', title: 'Regendusche, bodengleich', text: 'Kopfbrause 25 cm, Handbrause an der Stange, Rinne an der Wand. Kein Rand, kein Stolpern.',
          options: [{ type: 'toggle', key: 'shower', label: 'Wasser an' }, { type: 'range', key: 'temp', label: 'Temperatur', min: 20, max: 45, unit: ' °C' }, { type: 'toggle', key: 'led', label: 'Nische beleuchten' }],
          auto: [['shower', true, 500], ['led', true, 1300]], callouts: [{ at: [17.5, 12.5], to: [34, 9], text: 'Kopfbrause 25 cm, Thermostat' }],
          info: function (s) { return s.shower ? 'Mischer auf ' + s.temp + ' °C' : 'Wasser aus'; } },
        { id: 'fenster', at: [45, 22], zoom: [45, 30, 2.1], kicker: 'Fenster', title: 'Holzfenster mit Lüftungsstellung', text: 'Dreifach verglast. Feuchte raus, Wärme bleibt drin.',
          options: [{ type: 'toggle', key: 'night', label: 'Abendstimmung' }], auto: [['night', true, 500]] },
        { id: 'wc', at: [55, 60], zoom: [58, 55, 2.4], kicker: 'WC', title: 'Wand-WC, spülrandlos', text: 'Vorwandelement, 2-Mengen-Spülung mit 3 und 6 Litern. Kein Spülrand, leicht zu reinigen.',
          options: [{ type: 'buttons', label: 'Spülung', values: [{ label: 'Spülen', set: function () { return { flush: Date.now() }; } }] }], auto: [['flush', 'auto', 700]],
          callouts: [{ at: [61.8, 43.5], to: [69, 39.5], text: 'Betätigungsplatte, 2 Mengen' }] },
        { id: 'waschtisch', at: [84.3, 50], zoom: [80, 55, 2.3], kicker: 'Waschplatz', title: 'Waschtisch auf Eiche, 120 cm', text: 'Keramikbecken, schwarze Armatur, zwei Laden mit Vollauszug und Dämpfung.',
          options: [{ type: 'toggle', key: 'tap', label: 'Wasser an' }, { type: 'range', key: 'temp', label: 'Temperatur', min: 20, max: 45, unit: ' °C' }, { type: 'toggle', key: 'drawers', label: 'Laden öffnen' }],
          auto: [['tap', true, 450], ['drawers', true, 1250]], callouts: [{ at: [89.7, 64], to: [81, 66.5], text: 'Vollauszug, Softclose' }],
          info: function (s) { return (s.tap ? 'Warmwasser ' + s.temp + ' °C' : 'Wasser aus') + (s.drawers ? ' · Laden offen' : ''); } },
        { id: 'spiegel', at: [85, 24], zoom: [82, 24, 1.9], kicker: 'Spiegelschrank', title: 'Spiegelschrank mit Lichtleiste', text: 'Beleuchtung oben, Steckdose innen, drei Fächer. Tippen Sie, und er geht auf.',
          options: [{ type: 'toggle', key: 'mirror', label: 'Schrank öffnen' }, { type: 'toggle', key: 'mlight', label: 'Licht' }], auto: [['mlight', true, 400], ['mirror', true, 900]] },
        { id: 'heizkoerper', at: [96.5, 30], zoom: [90, 30, 2.2], kicker: 'Handtuchwärmer', title: 'Handtuchheizkörper, elektrisch oder am Heizkreis', text: 'Warm, wenn man aus der Dusche kommt. Schieben Sie die Temperatur hoch.',
          options: [{ type: 'range', key: 'rad', label: 'Vorlauf', min: 22, max: 60, unit: ' °C' }], auto: [['rad', 55, 500]],
          info: function (s) { return s.rad < 26 ? 'Aus' : s.rad < 40 ? 'Lauwarm, ' + s.rad + ' °C' : 'Warm, ' + s.rad + ' °C'; } }
      ]
    },
    {
      id: 'kueche', test: /tischler\/kueche\.jpg(\?|$)/, ar: 1168 / 880,
      initial: { gas: false, gasp: 6, lamp: false, dim: 80, tap: false, drawers: false, wood: 'eiche', top: 'stein', night: false },
      effects: [
        ['flame', { key: 'gas', sizeKey: 'gasp', points: [[10.5, 45.8], [17.8, 46.3]], r: 7 }],
        ['glow', { key: 'lamp', dimKey: 'dim', at: [28.2, 21.5], rx: 10, ry: 8, color: '#ffd9a0', nightKey: 'night' }],
        ['glow', { key: 'lamp', dimKey: 'dim', at: [22.2, 24.5], rx: 10, ry: 8, color: '#ffd9a0', nightKey: 'night' }],
        ['water', { key: 'tap', from: [72.5, 45.2], to: [69.2, 50.6], w: 4 }],
        ['slice', { key: 'drawers', mode: 'drawer', rect: [82.6, 54.5, 16.8, 9.2], inside: INSIDE.cutlery }],
        ['slice', { key: 'drawers', mode: 'drawer', rect: [82.6, 64.3, 16.8, 8.6], inside: INSIDE.pots, delay: 200 }],
        ['slice', { key: 'drawers', mode: 'drawer', rect: [82.6, 73.9, 16.8, 8.2], inside: INSIDE.towels, delay: 400 }],
        ['tint', { key: 'wood', poly: [[12.6, 60], [58.4, 61.5], [58.2, 99.5], [13, 99.5]], values: [['eiche', 'Eiche natur', null], ['nuss', 'Nussbaum', '#5a3a24', 'multiply', .8], ['esche', 'Esche hell', '#efe6d4', 'soft-light', 1], ['anthrazit', 'Anthrazit matt', '#2d3136', 'multiply', .92]] }],
        ['tint', { key: 'top', poly: [[4.6, 52], [58.5, 49.6], [60.5, 61.5], [13.5, 67.8]], values: [['stein', 'Naturstein hell', null], ['quarz', 'Quarz weiß', '#f4f4f1', 'screen', .75], ['eiche', 'Eiche massiv', '#a8763f', 'multiply', .7], ['granit', 'Granit schwarz', '#23262a', 'multiply', .88]] }],
        ['night', { key: 'night', poly: [[71, 17], [95.6, 17], [95.6, 45.2], [71, 45.2]], moon: [.7, .2] }]
      ],
      hotspots: [
        { id: 'herd', at: [14, 46], zoom: [16, 46, 2.4], kicker: 'Kochstelle', title: 'Gasherd in der Nische', text: 'Die Nische ist aufs Gerät gebaut, Abzug dahinter versteckt. Schalten Sie die Flamme ein.',
          options: [{ type: 'toggle', key: 'gas', label: 'Flamme an' }, { type: 'range', key: 'gasp', label: 'Stufe', min: 1, max: 9 }], auto: [['gas', true, 500]] },
        { id: 'leuchten', at: [28.3, 20.5], zoom: [25, 24, 1.9], kicker: 'Licht', title: 'Pendelleuchten über der Insel', text: 'Dimmbar, warmweiß. Abends wird aus der Werkstatt ein Wohnraum.',
          options: [{ type: 'toggle', key: 'lamp', label: 'Licht an' }, { type: 'range', key: 'dim', label: 'Helligkeit', min: 10, max: 100, unit: ' %' }, { type: 'toggle', key: 'night', label: 'Abendstimmung' }], auto: [['lamp', true, 400], ['night', true, 1100]] },
        { id: 'spuele', at: [72.5, 44.5], zoom: [70, 48, 2.5], kicker: 'Spülstein', title: 'Keramikspüle mit Messingarmatur', text: 'Unterbau aus Massivholz, Arbeitsplatte läuft drüber. Messing wird mit den Jahren schöner.',
          options: [{ type: 'toggle', key: 'tap', label: 'Wasser an' }], auto: [['tap', true, 500]], callouts: [{ at: [66.5, 51.5], to: [62.5, 41], text: 'Keramik, 80 cm, unterbaut' }] },
        { id: 'laden', at: [91, 60], zoom: [88, 66, 2.1], kicker: 'Stauraum', title: 'Laden mit Vollauszug', text: 'Besteck oben, Töpfe in der Mitte, Textil unten. Jede Lade trägt 40 Kilo und schließt gedämpft.',
          options: [{ type: 'toggle', key: 'drawers', label: 'Laden öffnen' }], auto: [['drawers', true, 500]], callouts: [{ at: [99, 59], to: [90, 50], text: 'Muschelgriff, Gusseisen' }] },
        { id: 'fronten', at: [40, 72], zoom: [38, 74, 1.6], kicker: 'Fronten', title: 'Holzart der Fronten', text: 'Massivholz, geölt. Wählen Sie eine Holzart, die Insel zeigt sie.',
          options: [{ type: 'swatch', key: 'wood', label: 'Holzart', values: [['eiche', 'Eiche natur', '#c9a070'], ['nuss', 'Nussbaum', '#6b4a2e'], ['esche', 'Esche hell', '#e9dcc3'], ['anthrazit', 'Anthrazit matt', '#3a3d42']] }], auto: [['wood', 'nuss', 600], ['wood', 'eiche', 2600]] },
        { id: 'platte', at: [30, 51], zoom: [30, 56, 1.7], kicker: 'Arbeitsplatte', title: 'Arbeitsplatte, 4 cm', text: 'Naturstein, Quarz, Massivholz oder Granit. Tippen Sie durch.',
          options: [{ type: 'swatch', key: 'top', label: 'Material', values: [['stein', 'Naturstein hell', '#d9d2c4'], ['quarz', 'Quarz weiß', '#f4f4f1'], ['eiche', 'Eiche massiv', '#b9875a'], ['granit', 'Granit schwarz', '#2a2a2a']] }], auto: [['top', 'granit', 600], ['top', 'stein', 2600]] }
      ]
    },
    {
      id: 'verteiler', test: /elektriker\/schaltschrank\.jpg(\?|$)/, ar: 1168 / 880,
      initial: { r1: true, r2: true, r3: true, fi: 'ok', flow: false, labels: false },
      effects: [
        ['leds', { tripKey: 'fi', rows: [{ key: 'r1', rect: [27.6, 19.6, 25.6, 9] }, { key: 'r2', rect: [27.6, 36, 25.6, 9] }, { key: 'r3', rect: [27.6, 52.6, 25.6, 9] }] }],
        ['wires', { key: 'flow', lines: [[[29, 9], [29, 19], [31, 30], [31, 36], [33, 46], [33, 53]], [[36, 9], [35, 19]], [[42, 9], [42, 19]], [[48, 9], [48, 19]], [[55.5, 9], [56, 30], [56, 70]], [[30, 62], [30, 69]], [[39, 62], [39, 69]]] }],
        ['sticker', { key: 'labels', rect: [66, 30, 22], html: '<b>Stromkreise</b><span>1 Küche Herd</span><span>2 Küche Steckdosen</span><span>3 Bad, WC</span><span>4 Wohnen, Essen</span><span>5 Schlafzimmer</span><span>6 Außen, Garage</span><span>7 Wärmepumpe</span><span>8 Wallbox</span>' }]
      ],
      hotspots: [
        { id: 'reihen', at: [40, 24], zoom: [40, 26, 2.3], kicker: 'Sicherungen', title: 'Leitungsschutzschalter, sauber nach Räumen', text: 'Jede Reihe ein Bereich. Schalten Sie eine Reihe aus, sie wird rot markiert.',
          options: [{ type: 'toggle', key: 'r1', label: 'Reihe 1: Küche' }, { type: 'toggle', key: 'r2', label: 'Reihe 2: Bad, WC' }, { type: 'toggle', key: 'r3', label: 'Reihe 3: Wohnräume' }], auto: [['r2', false, 600], ['r2', true, 1800]],
          callouts: [{ at: [53.5, 24], to: [56, 10], text: '16 A, Charakteristik B' }] },
        { id: 'fi', at: [33, 74], zoom: [36, 72, 2.6], kicker: 'Personenschutz', title: 'FI-Schutzschalter, 30 mA', text: 'Schaltet in 30 Millisekunden ab, wenn Strom den falschen Weg nimmt. Testen Sie ihn.',
          options: [{ type: 'buttons', label: 'Prüftaste', values: [{ label: 'FI-Test auslösen', set: function () { return { fi: 'trip' }; } }, { label: 'Wieder einschalten', set: function () { return { fi: 'ok' }; } }] }], auto: [['fi', 'trip', 700], ['fi', 'ok', 2300]],
          info: function (s) { return s.fi === 'trip' ? 'Ausgelöst, alle Reihen stromlos' : 'Bereit, Schutz aktiv'; } },
        { id: 'draht', at: [52, 12], zoom: [45, 16, 2.4], kicker: 'Verdrahtung', title: 'Sauber verdrahtet, beschriftet', text: 'Jede Ader hat ihren Weg, jede Klemme ihre Nummer. So findet auch in zehn Jahren jeder alles.',
          options: [{ type: 'toggle', key: 'flow', label: 'Stromfluss zeigen' }], auto: [['flow', true, 500]] },
        { id: 'tuer', at: [88, 45], zoom: [80, 45, 1.5], kicker: 'Dokumentation', title: 'Stromkreisplan in der Tür', text: 'Sie bekommen den Plan ausgedruckt in die Tür und als PDF.',
          options: [{ type: 'toggle', key: 'labels', label: 'Plan einblenden' }], auto: [['labels', true, 500]] }
      ]
    },
    {
      id: 'wohnraum', test: /maler\/innen\.jpg(\?|$)/, ar: 1168 / 880,
      initial: { wall: 'salbei', lamp: false, night: false, tape: false },
      effects: [
        ['tint', { key: 'wall', poly: [[16, 1.5], [86, 1.5], [86, 60], [27, 60], [27, 50], [16, 50]], holes: [[[38.4, 23], [60.9, 23], [60.9, 42.2], [38.4, 42.2]], [[31, 48.5], [68, 48.5], [68, 60.5], [31, 60.5]]], values: [['salbei', 'Salbei', null], ['terrakotta', 'Terrakotta', '#c4714b', 'color', 1], ['blau', 'Nachtblau', '#2f4d78', 'color', 1], ['sand', 'Sand', '#d8c3a0', 'color', 1], ['grau', 'Warmgrau', '#9a9690', 'color', 1], ['weiss', 'Weiß', '#f3f1ec', 'screen', .78]] }],
        ['glow', { key: 'lamp', at: [20, 30], rx: 11, ry: 9, color: '#ffe2b0', nightKey: 'night', max: .95 }],
        ['night', { key: 'night', poly: [[0, 1.5], [11.6, 1.5], [11.6, 48], [0, 48]], moon: [.6, .2] }],
        ['tape', { key: 'tape', lines: [[[16, 59.5], [27, 59.5]], [[68, 60], [86, 60.2]], [[16, 2], [86, 2]], [[86, 2], [86, 60]]] }]
      ],
      hotspots: [
        { id: 'wand', at: [62, 20], zoom: [55, 30, 1.5], kicker: 'Wandfarbe', title: 'Wandfarbe wählen', text: 'Die Wand zeigt die Farbe sofort. So entscheiden Sie am Bildschirm, bevor der erste Eimer aufgeht.',
          options: [{ type: 'swatch', key: 'wall', label: 'Farbton', values: [['salbei', 'Salbei', '#8c9a7e'], ['terrakotta', 'Terrakotta', '#c4714b'], ['blau', 'Nachtblau', '#2f4d78'], ['sand', 'Sand', '#d8c3a0'], ['grau', 'Warmgrau', '#9a9690'], ['weiss', 'Weiß', '#f3f1ec']] }], auto: [['wall', 'terrakotta', 600], ['wall', 'blau', 1900], ['wall', 'salbei', 3200]] },
        { id: 'lampe', at: [20, 33], zoom: [22, 36, 2], kicker: 'Licht', title: 'Farbe im Abendlicht', text: 'Farben wirken bei Kunstlicht anders. Drehen Sie die Lampe auf und sehen Sie den Unterschied.',
          options: [{ type: 'toggle', key: 'lamp', label: 'Stehleuchte' }, { type: 'toggle', key: 'night', label: 'Abendstimmung' }], auto: [['night', true, 400], ['lamp', true, 900]] },
        { id: 'kanten', at: [50, 61.5], zoom: [50, 56, 1.8], kicker: 'Handwerk', title: 'Kanten scharf, Decke streifenfrei', text: 'Sockelleisten und Decke werden abgeklebt, Übergänge mit dem Pinsel gezogen. Blau zeigt, wo das Band sitzt.',
          options: [{ type: 'toggle', key: 'tape', label: 'Abklebung zeigen' }], auto: [['tape', true, 500]], callouts: [{ at: [50, 61], to: [63, 70], text: 'Sockelleiste, Kante gezogen' }] }
      ]
    },
    {
      id: 'gaube', test: /dach\/gaube\.jpg(\?|$)/, ar: 1168 / 880,
      initial: { win: false, rain: false, tile: 'anthrazit', wood: 'laerche', smoke: false, light: false },
      effects: [
        ['slice', { key: 'win', lightKey: 'light', mode: 'flapUp', rect: [72, 29.5, 19.5, 19.5], shape: [[75, 31], [91, 29.5], [85.5, 48.5], [72.5, 48.5]], insideStyle: 'background:radial-gradient(ellipse at 50% 70%,#4a3626,#15100c 75%)' }],
        ['rain', { key: 'rain', poly: [[0, 0], [100, 0], [100, 100], [0, 100]], n: 70, len: 26, slant: -2, mist: false }],
        ['wires', { key: 'rain', color: '#bfe8ff', lines: [[[11, 70.5], [55, 77.2], [93.2, 84.6]], [[82.4, 85], [82.4, 100]]] }],
        ['tint', { key: 'tile', poly: [[10.5, 66.8], [55, 74.6], [93.3, 83], [100, 76], [100, 8.3], [91.5, 9.6], [80.5, 11.5], [76, 12.5], [62, 11], [50, 8.8], [39.5, 7.5], [48, 14.5], [57, 24.5], [62, 23.5], [62, 44.5], [51, 52], [51, 59.5], [33.5, 59.5], [33.5, 52], [25, 55.5]], holes: [[[75, 31], [91, 29.5], [85.5, 48.5], [72.5, 48.5]]], values: [['anthrazit', 'Anthrazit', null], ['rot', 'Naturrot', [['#8a3a2a', 'screen', .8], ['#b24f36', 'color', 1]]], ['braun', 'Kastanie', [['#5a3a26', 'screen', .75], ['#6e4a33', 'color', 1]]], ['grau', 'Steingrau', [['#9a9da1', 'screen', .5]]]] }],
        ['tint', { key: 'wood', poly: [[33.5, 57.5], [33.5, 29.5], [31.5, 28.5], [40, 12.5], [55, 27.5], [62, 24.5], [62, 44.5], [51, 52], [50.5, 57.5]], holes: [[[36.5, 35], [51.5, 35], [51.5, 56], [36.5, 56]]], values: [['laerche', 'Lärche natur', null], ['grau', 'Silbergrau', '#9a9a96', 'color', 1], ['anthrazit', 'Anthrazit', '#3b3f45', 'multiply', .9], ['weiss', 'Weiß', '#ececea', 'screen', .85]] }],
        ['smoke', { key: 'smoke', at: [85.6, 2.5] }]
      ],
      hotspots: [
        { id: 'fenster', at: [82, 39], zoom: [82, 40, 2.2], kicker: 'Dachfenster', title: 'Dachflächenfenster, elektrisch', text: 'Klappt nach außen, Regensensor schließt automatisch. Innen Dämmrahmen, außen Eindeckrahmen aus Alu.',
          options: [{ type: 'toggle', key: 'win', label: 'Fenster öffnen' }, { type: 'toggle', key: 'light', label: 'Licht im Zimmer' }], auto: [['win', true, 500], ['light', true, 1200]],
          callouts: [{ at: [89.5, 32], to: [94, 22], text: 'Eindeckrahmen, dicht' }] },
        { id: 'rinne', at: [55, 77], zoom: [60, 76, 2], kicker: 'Regenwasser', title: 'Kupferrinne mit Fallrohr', text: 'Kupfer hält 50 Jahre und wird mit der Zeit braun bis grün. Lassen Sie es regnen.',
          options: [{ type: 'toggle', key: 'rain', label: 'Regen' }], auto: [['rain', true, 500]], callouts: [{ at: [82.4, 92], to: [70, 95], text: 'Fallrohr 100 mm, Laubfang' }] },
        { id: 'ziegel', at: [40, 62], zoom: [40, 60, 1.5], kicker: 'Eindeckung', title: 'Dachziegel in Farbe', text: 'Glasiert oder engobiert, in Anthrazit, Naturrot, Kastanie oder Steingrau. Das Dach zeigt es gleich.',
          options: [{ type: 'swatch', key: 'tile', label: 'Farbe', values: [['anthrazit', 'Anthrazit', '#3c3f43'], ['rot', 'Naturrot', '#b24f36'], ['braun', 'Kastanie', '#6e4a33'], ['grau', 'Steingrau', '#9a9da1']] }], auto: [['tile', 'rot', 600], ['tile', 'anthrazit', 2600]] },
        { id: 'gaube', at: [44, 24], zoom: [46, 32, 1.8], kicker: 'Gaube', title: 'Gaube mit Holzverschalung', text: 'Lärche vergraut von selbst, oder wir streichen sie in Ihrer Farbe. Dahinter 20 cm Dämmung.',
          options: [{ type: 'swatch', key: 'wood', label: 'Verschalung', values: [['laerche', 'Lärche natur', '#c89a63'], ['grau', 'Silbergrau', '#9a9a96'], ['anthrazit', 'Anthrazit', '#3b3f45'], ['weiss', 'Weiß', '#ececea']] }], auto: [['wood', 'grau', 600], ['wood', 'laerche', 2600]] },
        { id: 'kamin', at: [85.5, 6], zoom: [84, 9, 2.3], kicker: 'Kamin', title: 'Kaminverkleidung in Blech', text: 'Verblecht mit Alu in Dachfarbe, Regenhaube drauf. Kein Putz, der abplatzt.',
          options: [{ type: 'toggle', key: 'smoke', label: 'Ofen heizt' }], auto: [['smoke', true, 500]] }
      ]
    },
    {
      id: 'waermepumpe', test: /installateur\/waermepumpe\.jpg|musterbetrieb\/img\/waermepumpe\.jpg|drack-installationen\/img\/waermepumpe\.jpg/, ar: 1168 / 880, priority: 1,
      initial: { run: false, kw: 8, flow: false, defrost: false, sound: false, dist: 3 },
      effects: [
        ['slice', { key: 'run', mode: 'spin', speedKey: 'kw', rect: [53.8, 40.2, 16.9, 22.8] }],
        ['rings', { key: 'sound', at: [62, 52], r: 220, color: '#ffffff', n: 4 }],
        ['steamfx', { key: 'defrost', at: [62, 48], spread: 90, n: 14 }],
        ['wires', { key: 'flow', color: '#ff9f5a', lines: [[[88.5, 56.5], [95.5, 56.5], [95.5, 66]], [[88.5, 60.5], [93, 60.5], [93, 67]]] }]
      ],
      hotspots: [
        { id: 'ventilator', at: [62.2, 51.7], zoom: [68, 50, 1.9], kicker: 'Wärmepumpe', title: 'Luft-Wasser-Wärmepumpe, Monoblock', text: 'Außen steht nur das Gerät, innen der Speicher. Starten Sie sie, der Ventilator dreht, je nach Leistung schneller.',
          options: [{ type: 'toggle', key: 'run', label: 'Anlage läuft' }, { type: 'range', key: 'kw', label: 'Leistung', min: 2, max: 12, unit: ' kW' }, { type: 'toggle', key: 'defrost', label: 'Abtauen im Winter' }],
          auto: [['run', true, 500]], callouts: [{ at: [75, 38], to: [62, 26], text: 'Modulierend, 2 bis 12 kW' }],
          info: function (s) { return s.run ? s.kw + ' kW, ca. ' + Math.round(33 + s.kw * 1.2) + ' dB(A) in 3 m Abstand' : 'Anlage aus'; } },
        { id: 'leise', at: [40, 62], zoom: [50, 58, 1.5], kicker: 'Schall', title: 'So leise wie ein Kühlschrank', text: 'Nachts läuft sie im Flüstermodus. Die Ringe zeigen, wie weit man sie hört.',
          options: [{ type: 'toggle', key: 'sound', label: 'Schall zeigen' }, { type: 'range', key: 'dist', label: 'Abstand zum Nachbarn', min: 1, max: 15, unit: ' m' }],
          auto: [['sound', true, 500]], info: function (s) { return 'Beim Nachbarn ca. ' + Math.max(20, Math.round(50 - 20 * Math.log10(s.dist))) + ' dB(A), Grenzwert nachts 35 dB(A)'; } },
        { id: 'anschluss', at: [91, 58], zoom: [86, 58, 2.3], kicker: 'Hydraulik', title: 'Anschluss ins Haus, gedämmt', text: 'Zwei gedämmte Leitungen durch die Wand, innen Pufferspeicher. Keine Frostgefahr, weil ständig Wasser bewegt wird.',
          options: [{ type: 'toggle', key: 'flow', label: 'Wärmefluss zeigen' }], auto: [['flow', true, 500]],
          callouts: [{ at: [92, 52], to: [80, 44], text: 'Vorlauf 35 °C, Rücklauf 28 °C' }] },
        { id: 'fundament', at: [70, 80], zoom: [68, 78, 1.8], kicker: 'Aufstellung', title: 'Kiesbett und Schwingungsdämpfer', text: 'Steht auf Gummipuffern, Kondenswasser versickert im Kies. Kein Betonsockel, der Schall ins Haus trägt.',
          callouts: [{ at: [62, 70], to: [50, 66], text: 'Gummipuffer gegen Körperschall' }, { at: [76, 88], to: [86, 94], text: 'Kiesbett, Kondensat versickert' }] }
      ]
    },
    {
      id: 'pool', test: /installateur\/pool\.jpg/, ar: 1168 / 880, priority: 1,
      initial: { pump: false, backwash: 0, temp: 26, mode: 'filtern', press: 0 },
      effects: [
        ['wires', { key: 'pump', color: '#dff4ff', lines: [[[36, 53], [36, 31], [14, 31]], [[46, 52], [46, 48], [58, 48], [58, 34], [90, 34]], [[84, 57], [84, 74], [96, 74], [96, 84]], [[64, 42], [64, 55]]] }],
        ['bubbles', { key: 'backwash', poly: [[7, 40], [14, 34], [26, 33], [34, 38], [36, 50], [34, 68], [26, 78], [14, 78], [7, 68], [5, 52]], n: 30, dur: 4500 }],
        ['needle', { at: [21.8, 23.9], r: 8.5, start: -120, angle: function (s) { var m = { filtern: -20, rueckspuelen: 70, nachspuelen: 20, zirkulieren: -60 }; return s.pump ? (m[s.mode] != null ? m[s.mode] : -20) + (s.backwash ? 40 : 0) : -120; } }],
        ['glow', { key: 'temp', at: [72, 58], rx: 10, ry: 16, color: '#ff9a4a', max: .65, dimFn: function (s) { return (s.temp - 22) / 10; } }],
        ['link', { key: 'pump', on: { press: 1 }, off: { press: 0 } }]
      ],
      hotspots: [
        { id: 'pumpe', at: [43, 66], zoom: [45, 62, 2], kicker: 'Umwälzung', title: 'Frequenzgeregelte Pumpe', text: 'Läuft leise mit kleiner Drehzahl, braucht ein Drittel vom Strom einer alten Pumpe. Starten Sie, das Wasser fließt durch die Leitungen.',
          options: [{ type: 'toggle', key: 'pump', label: 'Pumpe läuft' }], auto: [['pump', true, 500]],
          callouts: [{ at: [44, 61], to: [56, 70], text: 'Frequenzgeregelt, 0,55 kW' }], info: function (s) { return s.pump ? '12 m³/h, Beckeninhalt in 4 Stunden einmal durch' : 'Pumpe aus'; } },
        { id: 'filter', at: [20, 52], zoom: [22, 46, 1.7], kicker: 'Filter', title: 'Sandfilterkessel, 600 mm', text: 'Rückspülen heißt: Wasser fließt kurz andersherum und spült den Schmutz aus dem Sand. Drücken Sie.',
          options: [{ type: 'buttons', label: 'Wartung', values: [{ label: 'Rückspülen', set: function () { return { backwash: Date.now(), pump: true }; } }] }], auto: [['pump', true, 300], ['backwash', 'auto', 900]],
          info: function (s) { return s.backwash && Date.now() - s.backwash < 4500 ? 'Rückspülung läuft, Druck steigt' : 'Filterbetrieb'; } },
        { id: 'ventil', at: [24, 24], zoom: [24, 27, 2.4], kicker: 'Steuerung', title: 'Mehrwegeventil mit Manometer', text: 'Eine Stellung für Filtern, Rückspülen, Nachspülen und Zirkulieren. Der Zeiger zeigt den Druck.',
          options: [{ type: 'choice', key: 'mode', label: 'Stellung', values: [['filtern', 'Filtern'], ['rueckspuelen', 'Rückspülen'], ['nachspuelen', 'Nachspülen'], ['zirkulieren', 'Zirkulieren']] }], auto: [['pump', true, 300], ['mode', 'rueckspuelen', 1200], ['mode', 'filtern', 2600]],
          info: function (s) { var m = { filtern: '0,8 bar, normal', rueckspuelen: '1,6 bar, spült', nachspuelen: '1,1 bar', zirkulieren: '0,4 bar, ohne Filter' }; return s.pump ? m[s.mode] : 'Pumpe aus, 0 bar'; } },
        { id: 'tauscher', at: [72, 58], zoom: [74, 55, 2], kicker: 'Heizung', title: 'Plattenwärmetauscher', text: 'Die Heizung des Hauses wärmt das Beckenwasser, ohne dass sich die Kreisläufe mischen. Schieben Sie die Temperatur.',
          options: [{ type: 'range', key: 'temp', label: 'Beckenwasser', min: 20, max: 32, unit: ' °C' }], auto: [['temp', 30, 500]],
          info: function (s) { return s.temp >= 28 ? 'Warm, ' + s.temp + ' °C' : 'Sportlich, ' + s.temp + ' °C'; } }
      ]
    },
    {
      id: 'pv', test: /elektriker\/pv\.jpg/, ar: 1168 / 880, priority: 1,
      initial: { sun: false, kwp: 8, level: 60, night: false, disp: false },
      effects: [
        ['wires', { key: 'sun', color: '#ffd45a', lines: [[[20, 43], [20, 78], [42, 78], [42, 72]], [[22, 43], [22, 76]], [[30, 43], [30, 73], [42, 73]]] }],
        ['glow', { key: 'disp', at: [27.4, 38], rx: 5, ry: 3.5, color: '#9fe0ff', max: .9, nightKey: 'sun' }],
        ['fill', { key: 'level', poly: [[42.6, 14.6], [65.6, 13.2], [66, 73.8], [42.6, 72.6]], top: 14.5, bottom: 73, colors: ['#9ff0b0', '#2bb85a'] }],
        ['night', { key: 'night', poly: [[85.6, 9.5], [100, 9.5], [100, 42], [85.6, 42]], moon: [.65, .25] }],
        ['glow', { key: 'night', at: [30, 50], rx: 30, ry: 30, color: '#ffe3b0', max: .25 }],
        ['link', { key: 'night', on: { level: 18, sun: false }, off: { level: 85 } }]
      ],
      hotspots: [
        { id: 'wechselrichter', at: [26, 24], zoom: [28, 32, 2], kicker: 'Wechselrichter', title: 'Hybrid-Wechselrichter', text: 'Macht aus Dachstrom Hausstrom und lädt den Speicher. Lassen Sie die Sonne scheinen, der Strom fließt.',
          options: [{ type: 'toggle', key: 'sun', label: 'Sonne scheint' }, { type: 'range', key: 'kwp', label: 'Anlagengröße', min: 4, max: 15, unit: ' kWp' }], auto: [['sun', true, 500], ['disp', true, 600]],
          callouts: [{ at: [36, 20], to: [48, 10], text: '10 kW, Notstromfähig' }], info: function (s) { return s.sun ? 'Jetzt ' + (s.kwp * .72).toFixed(1) + ' kW, heute ca. ' + Math.round(s.kwp * 3.6) + ' kWh' : 'Keine Erzeugung'; } },
        { id: 'speicher', at: [54, 44], zoom: [54, 44, 1.7], kicker: 'Speicher', title: 'Batteriespeicher, 10 kWh', text: 'Tagsüber wird er voll, abends versorgt er Herd, Licht und Fernseher. Der Füllstand zeigt es grün.',
          options: [{ type: 'range', key: 'level', label: 'Füllstand', min: 0, max: 100, unit: ' %' }, { type: 'toggle', key: 'night', label: 'Abend' }], auto: [['level', 95, 500]],
          info: function (s) { return Math.round(s.level / 10) + ' kWh gespeichert, reicht ca. ' + Math.round(s.level / 10 * 2.5) + ' Stunden'; } },
        { id: 'fenster', at: [93, 25], zoom: [88, 30, 1.8], kicker: 'Abend', title: 'Nach Sonnenuntergang', text: 'Keine Sonne, der Speicher übernimmt. Erst wenn er leer ist, kommt Strom aus dem Netz.',
          options: [{ type: 'toggle', key: 'night', label: 'Abend' }], auto: [['night', true, 500]],
          callouts: [{ at: [86, 30], to: [76, 22], text: 'Speicher versorgt das Haus' }] }
      ]
    },
    {
      id: 'fassade', test: /maler\/fassade\.jpg/, ar: 1168 / 880, priority: 1,
      initial: { wall: 'weiss', shut: 'holz', lamp: false },
      effects: [
        ['tint', { key: 'wall', poly: [[17, 37], [37, 9.5], [68.5, 29], [68.5, 80], [17, 80]], holes: [[[22, 29], [38, 29], [38, 44], [22, 44]], [[41, 26], [60, 26], [60, 43], [41, 43]], [[22, 55], [38, 55], [38, 72], [22, 72]], [[41, 55], [60, 55], [60, 72], [41, 72]]], values: [['weiss', 'Weiß', null], ['creme', 'Creme', '#efe4c8', 'multiply', .92], ['sand', 'Sand', '#e3cfa6', 'multiply', .9], ['grau', 'Hellgrau', '#c3c6ca', 'multiply', .9], ['salbei', 'Salbei', '#b8c2a6', 'multiply', .9], ['graphit', 'Graphit', '#6a6e74', 'multiply', .88]] }],
        ['tint', { key: 'shut', poly: [[22.3, 30], [26.5, 30], [26.5, 43.5], [22.3, 43.5]], holes: [[[33.5, 30], [37.7, 30], [37.7, 43.5], [33.5, 43.5]], [[41, 27], [45.5, 27], [45.5, 42.5], [41, 42.5]], [[54.5, 27], [59, 27], [59, 42.5], [54.5, 42.5]], [[22.3, 56], [26.5, 56], [26.5, 71], [22.3, 71]], [[33.5, 56], [37.7, 56], [37.7, 71], [33.5, 71]], [[41, 56], [45.5, 56], [45.5, 71], [41, 71]], [[54.5, 56], [59, 56], [59, 71], [54.5, 71]]], values: [['holz', 'Holz natur', null], ['anthrazit', 'Anthrazit', '#2f3338', 'multiply', .85], ['gruen', 'Tannengrün', '#3f5a3c', 'color', 1], ['blau', 'Taubenblau', '#4a6a8e', 'color', 1], ['weiss', 'Weiß', '#f2f0ea', 'screen', .8]] }],
        ['glow', { key: 'lamp', at: [74.5, 61], rx: 9, ry: 8, color: '#ffe2b0', max: .95 }]
      ],
      hotspots: [
        { id: 'fassade', at: [50, 48], zoom: [45, 45, 1.4], kicker: 'Fassade', title: 'Fassadenfarbe wählen', text: 'Silikatfarbe, diffusionsoffen, hält 15 Jahre. Tippen Sie durch die Töne, das Haus zeigt sie sofort.',
          options: [{ type: 'swatch', key: 'wall', label: 'Farbton', values: [['weiss', 'Weiß', '#f4f3ef'], ['creme', 'Creme', '#efe4c8'], ['sand', 'Sand', '#e3cfa6'], ['grau', 'Hellgrau', '#c3c6ca'], ['salbei', 'Salbei', '#b8c2a6'], ['graphit', 'Graphit', '#6a6e74']] }],
          auto: [['wall', 'sand', 600], ['wall', 'grau', 1900], ['wall', 'weiss', 3200]] },
        { id: 'laeden', at: [30, 36], zoom: [32, 38, 2], kicker: 'Fensterläden', title: 'Fensterläden lackieren', text: 'Holz geschliffen, grundiert, zweimal lackiert. Klassisch in Holz oder in Farbe.',
          options: [{ type: 'swatch', key: 'shut', label: 'Farbe', values: [['holz', 'Holz natur', '#b7773a'], ['anthrazit', 'Anthrazit', '#2f3338'], ['gruen', 'Tannengrün', '#3f5a3c'], ['blau', 'Taubenblau', '#4a6a8e'], ['weiss', 'Weiß', '#f2f0ea']] }],
          auto: [['shut', 'anthrazit', 600], ['shut', 'gruen', 1900], ['shut', 'holz', 3200]], callouts: [{ at: [26.5, 32], to: [22, 22], text: 'Beschläge bleiben, nur Lack neu' }] },
        { id: 'eingang', at: [80, 60], zoom: [78, 58, 1.9], kicker: 'Eingang', title: 'Vordach und Haustür', text: 'Holz am Vordach geölt, Sockel mit Sockelputz gegen Spritzwasser. Lampe an, und das Haus wirkt am Abend.',
          options: [{ type: 'toggle', key: 'lamp', label: 'Außenlicht' }], auto: [['lamp', true, 500]],
          callouts: [{ at: [86, 76], to: [92, 84], text: 'Sockelputz, 30 cm, wasserabweisend' }] }
      ]
    },
    {
      id: 'schrank', test: /tischler\/schrank\.jpg/, ar: 1168 / 880, priority: 1,
      initial: { doors: false, wood: 'eiche', lamp: false, night: false },
      effects: [
        ['slice', { key: 'doors', mode: 'doorL', rect: [25.3, 0, 14.5, 91], inside: INSIDE.wardrobe }],
        ['slice', { key: 'doors', mode: 'doorR', rect: [61.2, 30.7, 8.1, 48.8], inside: INSIDE.shelves, delay: 250 }],
        ['tint', { key: 'wood', poly: [[6, 0], [40, 0], [76, 48], [76, 75], [6, 92]], values: [['eiche', 'Eiche hell', null], ['nuss', 'Nussbaum', '#5a3a24', 'multiply', .8], ['weiss', 'Weiß matt', '#f1efe9', 'screen', .85], ['schwarz', 'Schwarz', '#2a2d31', 'multiply', .9], ['gruen', 'Salbeigrün', '#5e6b58', 'color', 1]] }],
        ['glow', { key: 'lamp', at: [93.3, 57], rx: 9, ry: 8, color: '#ffe2b0', nightKey: 'night', max: .95 }],
        ['night', { key: 'night', poly: [[93, 26], [100, 26], [100, 56], [93, 56]], moon: [.5, .25] }]
      ],
      hotspots: [
        { id: 'tueren', at: [32, 45], zoom: [34, 45, 1.6], kicker: 'Einbauschrank', title: 'Türen ohne Griffe, Tip-on', text: 'Antippen, und die Tür springt auf. Innen Kleiderstange, Fächer und Laden, alles auf Maß.',
          options: [{ type: 'toggle', key: 'doors', label: 'Türen öffnen' }], auto: [['doors', true, 500]],
          callouts: [{ at: [46, 20], to: [52, 10], text: 'Tip-on, kein Griff nötig' }] },
        { id: 'holz', at: [18, 70], zoom: [30, 55, 1.4], kicker: 'Oberfläche', title: 'Furnier oder Lack', text: 'Eiche furniert, geölt. Oder lackiert in Ihrer Farbe. Die Front zeigt es.',
          options: [{ type: 'swatch', key: 'wood', label: 'Oberfläche', values: [['eiche', 'Eiche hell', '#d9c3a0'], ['nuss', 'Nussbaum', '#6b4a2e'], ['weiss', 'Weiß matt', '#f1efe9'], ['schwarz', 'Schwarz', '#2a2d31'], ['gruen', 'Salbeigrün', '#7d8a76']] }],
          auto: [['wood', 'nuss', 600], ['wood', 'weiss', 1900], ['wood', 'eiche', 3200]] },
        { id: 'schraege', at: [66, 28], zoom: [62, 32, 1.8], kicker: 'Maßarbeit', title: 'Millimetergenau an die Dachschräge', text: 'Jede Tür folgt der Schräge, kein Spalt, kein toter Winkel. Aufgemessen mit Laser, gefertigt in der Werkstatt.',
          callouts: [{ at: [70, 36], to: [80, 26], text: 'Schräge 32°, Fuge 2 mm' }, { at: [52, 60], to: [60, 66], text: 'Sockel bündig zum Boden' }] },
        { id: 'licht', at: [94, 55], zoom: [86, 50, 1.8], kicker: 'Abend', title: 'Nachtkästchen mit Leuchte', text: 'Das Kästchen passend zum Schrank. Abends warmes Licht, die Front wirkt ruhig.',
          options: [{ type: 'toggle', key: 'lamp', label: 'Leuchte' }, { type: 'toggle', key: 'night', label: 'Abend' }], auto: [['night', true, 400], ['lamp', true, 900]] }
      ]
    },
    {
      id: 'carport', test: /dach\/carport\.jpg/, ar: 1168 / 880, priority: 1,
      initial: { wood: 'laerche', car: false, led: false, rain: false },
      effects: [
        ['tint', { key: 'wood', poly: [[18.5, 19.5], [80, 23.5], [80, 28.5], [18.5, 26]], holes: [[[19.7, 26], [22.7, 26], [22.7, 72.7], [19.7, 72.7]], [[75, 33], [77.5, 33], [77.5, 70.5], [75, 70.5]], [[22.7, 38], [35, 41.5], [35, 66], [22.7, 71]], [[35, 40], [63, 40], [63, 60], [35, 60]], [[22.7, 26], [75, 28.5], [63, 40], [35, 40]]], values: [['laerche', 'Lärche natur', null], ['grau', 'Silbergrau', '#8f8f8b', 'color', 1], ['anthrazit', 'Anthrazit', '#3a3d42', 'multiply', .9], ['weiss', 'Weiß', '#efede8', 'screen', .85], ['nuss', 'Dunkel geölt', '#5c3d27', 'multiply', .85]] }],
        ['car', { key: 'car', rect: [33, 44, 34] }],
        ['glow', { key: 'led', at: [49, 31], rx: 26, ry: 9, color: '#ffe0b0', max: .85 }],
        ['rain', { key: 'rain', poly: [[0, 0], [100, 0], [100, 100], [0, 100]], n: 60, len: 26, slant: -2, mist: false }],
        ['wires', { key: 'rain', color: '#bfe8ff', lines: [[[66.5, 10], [66.5, 16], [68, 17], [68, 60]]] }]
      ],
      hotspots: [
        { id: 'holz', at: [48, 20], zoom: [50, 25, 1.6], kicker: 'Holz', title: 'Lärche, sichtbar verschraubt', text: 'Lärche vergraut von selbst silbrig. Oder geölt, lasiert, gestrichen. Tippen Sie durch.',
          options: [{ type: 'swatch', key: 'wood', label: 'Oberfläche', values: [['laerche', 'Lärche natur', '#c89a63'], ['grau', 'Silbergrau', '#8f8f8b'], ['anthrazit', 'Anthrazit', '#3a3d42'], ['weiss', 'Weiß', '#efede8'], ['nuss', 'Dunkel geölt', '#5c3d27']] }],
          auto: [['wood', 'grau', 600], ['wood', 'anthrazit', 1900], ['wood', 'laerche', 3200]] },
        { id: 'auto', at: [50, 64], zoom: [50, 55, 1.4], kicker: 'Platz', title: 'Platz für ein Auto und die Räder', text: '3 × 6 Meter, mit Sichtschutz zum Nachbarn. Fahren Sie ein.',
          options: [{ type: 'toggle', key: 'car', label: 'Einparken' }], auto: [['car', true, 400]],
          callouts: [{ at: [29, 55], to: [20, 48], text: 'Sichtschutz, Lärchenlatten' }] },
        { id: 'licht', at: [50, 31], zoom: [50, 35, 1.7], kicker: 'Licht', title: 'LED-Leiste unter dem Dach', text: 'Mit Bewegungsmelder. Abends leuchtet der Stellplatz, nicht der ganze Garten.',
          options: [{ type: 'toggle', key: 'led', label: 'Licht' }], auto: [['led', true, 500]] },
        { id: 'dach', at: [65, 14], zoom: [60, 16, 1.9], kicker: 'Flachdach', title: 'Flachdach mit Folie, 2 % Gefälle', text: 'EPDM-Folie, Attika aus Alu in Anthrazit, Entwässerung an der Hauswand. Lassen Sie es regnen.',
          options: [{ type: 'toggle', key: 'rain', label: 'Regen' }], auto: [['rain', true, 500]],
          callouts: [{ at: [72, 15], to: [80, 8], text: 'Attika Alu anthrazit' }] }
      ]
    },
    /* ---------- Hero-Fotos (1344 × 752): werden über die Lichtbox geöffnet ---------- */
    {
      id: 'hero-technik', test: /(installateur\/hero\.jpg|musterbetrieb\/img\/hero\.jpg)(\?|$)/, ar: 1344 / 752, priority: 0,
      caption: 'Heizraum: Wärmepumpe, Hydraulik, Speicher. Tippen Sie auf die Punkte.',
      initial: { run: false, temp: 35, night: false, ww: 55, check: false },
      effects: [
        ['glow', { key: 'run', at: [60.6, 8.5], rx: 3, ry: 5.5, color: '#9fe0ff', max: .9 }],
        ['rings', { key: 'run', at: [70, 40], n: 3, r: 150, color: '#fff' }],
        ['wires', { key: 'run', color: '#ff9a4a', lines: [[[50.3, 1], [50.3, 73]]] }],
        ['wires', { key: 'run', color: '#6fc8ff', lines: [[[52.8, 1], [52.8, 73]]] }],
        ['fill', { key: 'ww', poly: [[89.2, 0], [100, 0], [100, 98], [89.2, 98]], top: 2, bottom: 97, colors: ['#ffe0c0', '#ffb070'] }],
        ['night', { key: 'night', poly: [[10.5, 0], [30.5, 0], [30.5, 19.5], [10.5, 19.5]], moon: [.7, .35] }],
        ['sticker', { key: 'check', rect: [7, 33, 7.5], html: '<b>Wartung</b><span>Geprüft 03/2026</span><span>Vordruck 1,5 bar</span><span>Nächste 03/2027</span>' }],
        ['link', { key: 'night', on: { run: true }, delay: 700 }]
      ],
      hotspots: [
        { id: 'waermepumpe', at: [66, 30], zoom: [66, 34, 1.6], kicker: 'Wärmepumpe', title: 'Innengerät, flüsterleise', text: 'Holt Wärme aus der Luft, auch bei minus 15 Grad. Starten Sie, das Display leuchtet und die Rohre werden warm.',
          options: [{ type: 'toggle', key: 'run', label: 'Anlage läuft' }, { type: 'range', key: 'temp', label: 'Vorlauf', min: 28, max: 55, unit: ' °C' }], auto: [['run', true, 500]],
          callouts: [{ at: [61, 9], to: [74, 12], text: 'Display: Status und Verbrauch' }],
          info: function (s) { return s.run ? 'Vorlauf ' + s.temp + ' °C, ca. ' + (s.temp <= 35 ? '4,5' : s.temp <= 45 ? '3,6' : '2,9') + ' kWh Wärme je kWh Strom' : 'Bereit'; } },
        { id: 'rohre', at: [51.5, 50], zoom: [52, 42, 2], kicker: 'Hydraulik', title: 'Vor- und Rücklauf, gedämmt', text: 'Warm hinaus, kühler zurück. Jede Leitung isoliert, damit die Wärme im Haus bleibt und nicht im Keller.',
          options: [{ type: 'toggle', key: 'run', label: 'Anlage läuft' }], auto: [['run', true, 400]],
          callouts: [{ at: [50.3, 30], to: [40, 24], text: 'Vorlauf, 35 °C' }, { at: [52.8, 58], to: [62, 64], text: 'Rücklauf, 30 °C' }] },
        { id: 'gefaess', at: [10.5, 36], zoom: [14, 40, 2], kicker: 'Wartung', title: 'Ausdehnungsgefäß und Jahresservice', text: 'Fängt die Ausdehnung des Heizwassers ab. Beim Jahresservice prüfen wir Vordruck, Filter und Einstellungen.',
          options: [{ type: 'toggle', key: 'check', label: 'Wartungsnachweis' }], auto: [['check', true, 500]] },
        { id: 'fenster', at: [20, 9], zoom: [22, 14, 1.9], kicker: 'Abend', title: 'Läuft auch nachts, ohne dass Sie es hören', text: 'Abends springt die Anlage an, wenn das Haus Wärme braucht. Im Keller hört man sie kaum, draußen gar nicht.',
          options: [{ type: 'toggle', key: 'night', label: 'Abend' }], auto: [['night', true, 500]] },
        { id: 'speicher', at: [94, 45], zoom: [88, 45, 1.6], kicker: 'Warmwasser', title: 'Warmwasserspeicher, 300 Liter', text: 'Reicht für zwei volle Bäder hintereinander. Schieben Sie den Füllstand, so viel warmes Wasser ist gerade da.',
          options: [{ type: 'range', key: 'ww', label: 'Warmwasser', min: 0, max: 100, unit: ' %' }], auto: [['ww', 90, 500]],
          info: function (s) { return Math.round(s.ww * 3) + ' Liter warm, reicht für ' + Math.max(1, Math.round(s.ww / 40)) + (Math.round(s.ww / 40) > 1 ? ' Vollbäder' : ' Vollbad'); } }
      ]
    },
    {
      id: 'hero-almtal', test: /drack-installationen\/img\/hero\.jpg(\?|$)/, ar: 1344 / 752, priority: 0,
      caption: 'Unterwegs im Almtal: Heizung, Notdienst, Werkstattwagen. Tippen Sie auf die Punkte.',
      initial: { heiz: false, night: false, rain: false, decal: false },
      effects: [
        ['smoke', { key: 'heiz', at: [93.2, 5] }],
        ['night', { key: 'night', poly: [[0, 0], [82, 0], [82, 4], [59, 38], [55, 40], [50, 42], [46, 43], [41, 40], [36, 39], [22, 29], [0, 24]], moon: [.3, .25] }],
        ['glow', { key: 'night', at: [76, 52], rx: 7, ry: 8, color: '#ffe2b0', max: .95 }],
        ['glow', { key: 'night', at: [70, 53], rx: 5, ry: 4.5, color: '#ffd9a0', max: .6 }],
        ['glow', { key: 'night', at: [88.5, 54], rx: 5, ry: 4.5, color: '#ffd9a0', max: .6 }],
        ['rain', { key: 'rain', poly: [[0, 0], [100, 0], [100, 100], [0, 100]], n: 70, len: 26, slant: -3, mist: true }],
        ['sticker', { key: 'decal', rect: [2, 46, 8], html: '<b>Notdienst 24 h</b><span>07615 / 30235</span><span>Heizung · Sanitär</span>' }],
        ['link', { key: 'night', on: { heiz: true }, delay: 600 }]
      ],
      hotspots: [
        { id: 'kamin', at: [93.3, 7], zoom: [86, 14, 1.9], kicker: 'Heizung', title: 'Pellets oder Wärmepumpe', text: 'Raus aus dem Öl: Pelletskessel oder Wärmepumpe, mit Förderung vom Land. Schalten Sie die Heizung ein.',
          options: [{ type: 'toggle', key: 'heiz', label: 'Heizung läuft' }], auto: [['heiz', true, 400]],
          callouts: [{ at: [90, 14], to: [78, 10], text: 'Pellets: 94 % Wirkungsgrad' }] },
        { id: 'haus', at: [77, 53], zoom: [78, 52, 1.8], kicker: 'Notdienst', title: 'Rund um die Uhr erreichbar', text: 'Heizung kalt um 22 Uhr? Anrufen, wir kommen. Machen Sie es Abend, das Licht geht an.',
          options: [{ type: 'toggle', key: 'night', label: 'Abend' }], auto: [['night', true, 500]],
          callouts: [{ at: [76, 50], to: [66, 44], text: 'Außenlicht mit Bewegungsmelder' }] },
        { id: 'bus', at: [19, 45], zoom: [22, 48, 1.6], kicker: 'Werkstattwagen', title: 'Ersatzteile an Bord', text: 'Für die meisten Reparaturen haben wir das Teil schon im Wagen. Einmal kommen, fertig.',
          options: [{ type: 'toggle', key: 'decal', label: 'Beschriftung' }], auto: [['decal', true, 500]],
          callouts: [{ at: [16, 44], to: [26, 36], text: 'Pumpen, Ventile, Dichtungen' }] },
        { id: 'wetter', at: [55, 12], zoom: [52, 16, 1.5], kicker: 'Wetter', title: 'Auch bei Sauwetter', text: 'Rohrbruch bei Regen, Heizung aus im Schnee. Wir fahren trotzdem. Lassen Sie es regnen.',
          options: [{ type: 'toggle', key: 'rain', label: 'Regen' }], auto: [['rain', true, 500]] }
      ]
    },
    {
      id: 'hero-verteiler', test: /elektriker\/hero\.jpg(\?|$)/, ar: 1344 / 752, priority: 0,
      caption: 'Neuer Verteiler im Altbau: Sicherungen, FI, Verdrahtung. Tippen Sie auf die Punkte.',
      initial: { k: true, b: true, w: true, g: true, fi: 'ok', flow: false, night: false, licht: false },
      effects: [
        ['leds', { tripKey: 'fi', rows: [{ key: 'k', rect: [64.5, 22.5, 9.5, 4.2] }, { key: 'b', rect: [68.5, 33, 5.5, 4.2] }, { key: 'w', rect: [68.5, 48, 5.5, 4.2] }, { key: 'g', rect: [64.5, 64.5, 9.5, 5] }] }],
        ['wires', { key: 'flow', color: '#4fe3ff', lines: [[[76.5, 1], [76.5, 92]], [[64.5, 2], [64.5, 20]], [[70, 2], [70, 21]], [[78.5, 1], [78.5, 90]]] }],
        ['night', { key: 'night', poly: [[7.5, 27.5], [22.5, 27.5], [22.5, 60.5], [7.5, 60.5]], moon: [.6, .3] }],
        ['glow', { key: 'licht', at: [16, 72], rx: 16, ry: 8, color: '#ffe2b0', max: .8 }],
        ['link', { key: 'night', on: { licht: true }, delay: 900 }]
      ],
      hotspots: [
        { id: 'sicherungen', at: [70, 25], zoom: [70, 38, 1.8], kicker: 'Verteiler', title: 'Sicherungen nach Räumen sortiert', text: 'Jede Reihe ein Bereich. Schalten Sie eine ab, sie wird rot. So finden Sie auch ohne uns die richtige Sicherung.',
          options: [{ type: 'toggle', key: 'k', label: 'Küche' }, { type: 'toggle', key: 'b', label: 'Bad' }, { type: 'toggle', key: 'w', label: 'Wohnen' }, { type: 'toggle', key: 'g', label: 'Garage, Außen' }], auto: [['b', false, 600], ['b', true, 1900]],
          callouts: [{ at: [74, 24], to: [84, 16], text: '16 A, Charakteristik B' }] },
        { id: 'fi', at: [67, 66], zoom: [68, 62, 2.2], kicker: 'Personenschutz', title: 'FI-Schutzschalter, 30 mA', text: 'Schaltet in 30 Millisekunden ab, wenn Strom den falschen Weg nimmt. Testen Sie ihn.',
          options: [{ type: 'buttons', label: 'Prüftaste', values: [{ label: 'FI-Test auslösen', set: function () { return { fi: 'trip' }; } }, { label: 'Wieder einschalten', set: function () { return { fi: 'ok' }; } }] }], auto: [['fi', 'trip', 700], ['fi', 'ok', 2300]],
          info: function (s) { return s.fi === 'trip' ? 'Ausgelöst, alles stromlos' : 'Bereit, Schutz aktiv'; } },
        { id: 'kabel', at: [77, 50], zoom: [76, 46, 2], kicker: 'Verdrahtung', title: 'Sauber verlegt, jede Ader beschriftet', text: 'Gelb-grün ist der Schutzleiter, blau der Neutralleiter, jede Klemme hat ihre Nummer. Zeigen Sie den Stromfluss.',
          options: [{ type: 'toggle', key: 'flow', label: 'Stromfluss zeigen' }], auto: [['flow', true, 500]],
          callouts: [{ at: [78, 40], to: [88, 34], text: 'Klemmen nummeriert, Plan als PDF' }] },
        { id: 'smart', at: [15, 44], zoom: [18, 46, 1.7], kicker: 'Abend', title: 'Licht per App oder Schalter', text: 'Abends Licht an, bevor Sie heimkommen. Oder ganz klassisch am Schalter. Beides geht.',
          options: [{ type: 'toggle', key: 'night', label: 'Abend' }, { type: 'toggle', key: 'licht', label: 'Licht an' }], auto: [['night', true, 400], ['licht', true, 1100]] }
      ]
    },
    {
      id: 'hero-altbau', test: /maler\/hero\.jpg(\?|$)/, ar: 1344 / 752, priority: 0,
      caption: 'Altbauwohnung: Wand, Heizkörper, Parkett. Tippen Sie auf die Punkte, die Farben wechseln im Foto.',
      initial: { wall: 'weiss', rad: 'weiss', boden: 'natur', night: false },
      effects: [
        ['tint', { key: 'wall', poly: [[48, 4], [84, 4], [84, 75], [48, 75]], holes: [[[56, 20], [60, 20], [61, 25], [63.5, 27], [63, 40], [62.5, 60], [62.5, 74.5], [55.5, 74.5], [55.5, 45], [55, 30]], [[64, 24], [66.5, 11.5], [70.5, 12.5], [66, 27]]], values: [['weiss', 'Weiß', null], ['creme', 'Creme', '#f0e3c9', 'multiply', .9], ['salbei', 'Salbei', '#c3cdb4', 'multiply', .9], ['terrakotta', 'Terrakotta', '#d8a083', 'multiply', .9], ['blau', 'Taubenblau', '#aabbd0', 'multiply', .9], ['greige', 'Greige', '#d4cdc2', 'multiply', .9]] }],
        ['tint', { key: 'rad', poly: [[0.8, 60.5], [17, 60.5], [17, 77.5], [0.8, 77.5]], holes: [[[32.8, 56.5], [39.5, 56.5], [39.5, 68.5], [32.8, 68.5]], [[92.6, 50.5], [96.8, 50.5], [96.8, 57.5], [92.6, 57.5]]], values: [['weiss', 'Weiß', null], ['anthrazit', 'Anthrazit', '#3a3d42', 'multiply', .9], ['silber', 'Silber', '#b9bcc2', 'multiply', .9], ['schwarz', 'Schwarz matt', '#222', 'multiply', .9]] }],
        ['tint', { key: 'boden', poly: [[0, 78], [32, 78], [33, 80], [40, 84], [46, 93], [38, 100], [0, 100]], holes: [[[85.5, 64], [100, 62], [100, 100], [86, 100]]], values: [['natur', 'Eiche natur', null], ['dunkel', 'Dunkel geölt', '#6b4a2e', 'multiply', .75], ['weiss', 'Weiß geölt', '#efe6d8', 'screen', .7], ['grau', 'Grau geölt', '#8d8a85', 'color', .9]] }],
        ['glow', { key: 'night', at: [62, 40], rx: 30, ry: 26, color: '#ffe3b0', max: .3 }],
        ['night', { key: 'night', poly: [[0, 0], [18, 0], [18, 57], [0, 57]], moon: [.6, .3] }]
      ],
      hotspots: [
        { id: 'wand', at: [78, 40], zoom: [70, 40, 1.4], kicker: 'Wandfarbe', title: 'Farbe wählen, die Wand zeigt sie', text: 'Dispersionsfarbe, zweimal gestrichen, Kanten mit Band geschnitten. Tippen Sie durch die Töne.',
          options: [{ type: 'swatch', key: 'wall', label: 'Farbton', values: [['weiss', 'Weiß', '#f4f3ef'], ['creme', 'Creme', '#f0e3c9'], ['salbei', 'Salbei', '#c3cdb4'], ['terrakotta', 'Terrakotta', '#d8a083'], ['blau', 'Taubenblau', '#aabbd0'], ['greige', 'Greige', '#d4cdc2']] }],
          auto: [['wall', 'salbei', 600], ['wall', 'terrakotta', 1900], ['wall', 'weiss', 3200]] },
        { id: 'heizkoerper', at: [36, 62], zoom: [30, 60, 2], kicker: 'Heizkörper', title: 'Heizkörper lackieren statt tauschen', text: 'Geschliffen, grundiert, mit Heizkörperlack gespritzt. Hält die Hitze aus und vergilbt nicht.',
          options: [{ type: 'swatch', key: 'rad', label: 'Farbe', values: [['weiss', 'Weiß', '#f4f3ef'], ['anthrazit', 'Anthrazit', '#3a3d42'], ['silber', 'Silber', '#b9bcc2'], ['schwarz', 'Schwarz matt', '#222']] }],
          auto: [['rad', 'anthrazit', 600], ['rad', 'silber', 1900], ['rad', 'weiss', 3200]] },
        { id: 'boden', at: [15, 88], zoom: [22, 84, 1.8], kicker: 'Parkett', title: 'Parkett schleifen und ölen', text: 'Der alte Boden bleibt, wird geschliffen und geölt. Natur, dunkel oder weiß gekalkt.',
          options: [{ type: 'swatch', key: 'boden', label: 'Oberfläche', values: [['natur', 'Eiche natur', '#d2a874'], ['dunkel', 'Dunkel geölt', '#6b4a2e'], ['weiss', 'Weiß geölt', '#efe6d8'], ['grau', 'Grau geölt', '#8d8a85']] }],
          auto: [['boden', 'dunkel', 600], ['boden', 'weiss', 1900], ['boden', 'natur', 3200]] },
        { id: 'abend', at: [9, 25], zoom: [14, 30, 1.7], kicker: 'Abend', title: 'Farbe bei Kunstlicht', text: 'Dieselbe Wand wirkt abends wärmer. Wir beraten mit Musterflächen, bei Tag und bei Licht.',
          options: [{ type: 'toggle', key: 'night', label: 'Abend' }], auto: [['night', true, 500]] }
      ]
    },
    {
      id: 'hero-werkstatt', test: /tischler\/hero\.jpg(\?|$)/, ar: 1344 / 752, priority: 0,
      caption: 'In der Werkstatt: Massivholz, Handwerkzeug, Abendlicht. Tippen Sie auf die Punkte.',
      initial: { holz: 'natur', night: false },
      effects: [
        ['tint', { key: 'holz', poly: [[35, 66], [44, 62], [64, 61.5], [86, 62], [88, 72], [82, 87], [60, 91], [35, 74]], values: [['natur', 'Eiche natur', null], ['geoelt', 'Geölt', '#c48a4a', 'multiply', .8], ['rauch', 'Räuchereiche', '#5a3a24', 'multiply', .8], ['weiss', 'Weiß geölt', '#f0e6d6', 'screen', .75], ['schwarz', 'Schwarz', '#2a2d31', 'multiply', .85]] }],
        ['night', { key: 'night', poly: [[0, 0], [10, 0], [10, 44], [0, 44]], moon: [.5, .3] }],
        ['glow', { key: 'night', at: [60, 50], rx: 32, ry: 22, color: '#ffd9a0', max: .35 }]
      ],
      hotspots: [
        { id: 'holz', at: [75, 73], zoom: [68, 70, 1.5], kicker: 'Massivholz', title: 'Eiche, von Hand gehobelt', text: 'Jedes Möbel aus dem Stamm, geölt statt lackiert. Tippen Sie durch die Oberflächen.',
          options: [{ type: 'swatch', key: 'holz', label: 'Oberfläche', values: [['natur', 'Eiche natur', '#d9b887'], ['geoelt', 'Geölt', '#c48a4a'], ['rauch', 'Räuchereiche', '#5a3a24'], ['weiss', 'Weiß geölt', '#f0e6d6'], ['schwarz', 'Schwarz', '#2a2d31']] }],
          auto: [['holz', 'geoelt', 600], ['holz', 'rauch', 1900], ['holz', 'natur', 3200]] },
        { id: 'werkzeug', at: [88, 18], zoom: [85, 20, 1.6], kicker: 'Werkstatt', title: 'Werkzeug, das älter ist als wir', text: 'Stemmeisen und Hobel, von Hand geschärft. Weil die Maschine das Feine nicht kann.',
          callouts: [{ at: [82, 12], to: [72, 6], text: 'Stemmeisen, handgeschärft' }, { at: [94, 42], to: [84, 52], text: 'Hobel, Buche' }] },
        { id: 'hobel', at: [53, 47], zoom: [55, 50, 2], kicker: 'Handarbeit', title: 'Rauhbank, Span für Span', text: 'Der Hobel nimmt einen Zehntelmillimeter. Dafür ist die Fläche glatt wie Glas.',
          callouts: [{ at: [58, 56], to: [68, 48], text: 'Späne: 0,1 mm dünn' }] },
        { id: 'fenster', at: [5, 18], zoom: [14, 25, 1.7], kicker: 'Abend', title: 'Abends in der Werkstatt', text: 'Wenn es ruhig wird, entstehen die besten Stücke. Machen Sie es Abend.',
          options: [{ type: 'toggle', key: 'night', label: 'Abend' }], auto: [['night', true, 500]] }
      ]
    },
    {
      id: 'hero-dach', test: /dach\/hero\.jpg(\?|$)/, ar: 1344 / 752, priority: 0,
      caption: 'Neueindeckung: Ziegel, Unterbau, Gerüst, Wetter. Tippen Sie auf die Punkte.',
      initial: { ziegel: 'rot', rain: false, night: false },
      effects: [
        ['tint', { key: 'ziegel', poly: [[33, 43], [46, 40], [60, 43], [83, 64], [83, 96], [60, 98], [39, 78]], holes: [[[48, 43.5], [57, 43.5], [57, 66], [48, 66]], [[11, 28], [25, 27], [25, 44], [11, 44]]], values: [['rot', 'Naturrot', null], ['anthrazit', 'Anthrazit', '#3b3f44', 'multiply', .85], ['braun', 'Dunkelbraun', '#5a3a2a', 'multiply', .85], ['engobe', 'Rot engobiert', '#b8412a', 'multiply', .6]] }],
        ['rain', { key: 'rain', poly: [[0, 0], [100, 0], [100, 100], [0, 100]], n: 70, len: 26, slant: -3, mist: true }],
        ['wires', { key: 'rain', color: '#bfe8ff', lines: [[[33, 76], [55, 86], [83, 96]]] }],
        ['night', { key: 'night', poly: [[0, 0], [100, 0], [100, 20], [72, 24], [50, 22], [30, 24], [12, 28], [0, 22]], moon: [.75, .3] }]
      ],
      hotspots: [
        { id: 'ziegel', at: [68, 70], zoom: [65, 68, 1.5], kicker: 'Eindeckung', title: 'Tondachziegel, 30 Jahre Garantie', text: 'Naturrot, engobiert oder anthrazit. Tippen Sie durch, das Dach zeigt es.',
          options: [{ type: 'swatch', key: 'ziegel', label: 'Ziegel', values: [['rot', 'Naturrot', '#c0603f'], ['anthrazit', 'Anthrazit', '#3b3f44'], ['braun', 'Dunkelbraun', '#5a3a2a'], ['engobe', 'Rot engobiert', '#b8412a']] }],
          auto: [['ziegel', 'anthrazit', 600], ['ziegel', 'braun', 1900], ['ziegel', 'rot', 3200]] },
        { id: 'lattung', at: [25, 48], zoom: [26, 46, 2], kicker: 'Unterbau', title: 'Lattung und Unterdeckbahn', text: 'Konterlattung, Unterdeckbahn winddicht verklebt, Lattung im Ziegelmaß. Das sieht nachher keiner, hält aber 50 Jahre.',
          callouts: [{ at: [22, 42], to: [12, 34], text: 'Konterlattung 30 × 50 mm' }, { at: [30, 55], to: [40, 62], text: 'Unterdeckbahn, winddicht' }] },
        { id: 'geruest', at: [78, 62], zoom: [75, 70, 1.6], kicker: 'Sicherheit', title: 'Gerüst und Absturzsicherung', text: 'Gerüst mit Fanglage, Dachschutzwand, alles geprüft. Ihr Haus und unsere Leute bleiben heil.',
          callouts: [{ at: [85, 70], to: [92, 60], text: 'Dachfanggerüst, geprüft' }] },
        { id: 'wetter', at: [70, 12], zoom: [60, 50, 1.3], kicker: 'Wetter', title: 'Regen? Das Dach führt ihn ab', text: 'Dachrinne, Kehlen und Anschlüsse aus Blech. Lassen Sie es regnen, das Wasser läuft in die Rinne.',
          options: [{ type: 'toggle', key: 'rain', label: 'Regen' }, { type: 'toggle', key: 'night', label: 'Abend' }], auto: [['rain', true, 500]] }
      ]
    }
  ];

  function sceneFor(src) { if (!src) return null; var s; try { s = new URL(String(src), location.href).pathname; } catch (e) { s = String(src); } for (var i = 0; i < SCENES.length; i++) if (SCENES[i].test.test(s)) return SCENES[i]; return null; }

  /* ---------------- Bühne ---------------- */
  var TRANS = ['iris', 'wipe', 'blinds', 'flash'];
  var STAGES = [];
  var trIndex = 0;

  function Stage(container, scene, src, opts) {
    var self = this; opts = opts || {};
    this.scene = scene; this.src = src; this.opts = opts;
    this.state = JSON.parse(JSON.stringify(scene.initial || {}));
    this.H = 1000 / (scene.ar || 1.327);
    this.root = el('div', 'fx' + (opts.lightbox ? ' fx-inlb' : ''));
    this.root.style.setProperty('--ar', scene.ar || 1.327);
    this.root.innerHTML =
      '<div class="fx-stage" style="aspect-ratio:' + (scene.ar || 1.327) + '">' +
        '<div class="fx-cam"><img src="' + esc(src) + '" alt="" draggable="false"><div class="fx-html"></div><svg class="fx-svg" viewBox="0 0 1000 ' + this.H.toFixed(2) + '" preserveAspectRatio="none"><defs></defs></svg><div class="fx-co-layer"></div><div class="fx-marks"></div></div>' +
        '<div class="fx-tr"></div>' +
        '<div class="fx-hint">' + esc(scene.hint || 'Tippen Sie auf einen Punkt im Foto') + '</div>' +
        '<div class="fx-tour"></div>' +
        '<button type="button" class="fx-back" hidden>‹ Ganzes Bild</button>' +
      '</div>' +
      '<aside class="fx-panel" hidden></aside>';
    container.appendChild(this.root);
    this.stage = $('.fx-stage', this.root); this.cam = $('.fx-cam', this.root); this.img = $('img', this.cam);
    this.html = $('.fx-html', this.cam); this.svg = $('.fx-svg', this.cam); this.defs = $('defs', this.svg);
    this.coLayer = $('.fx-co-layer', this.cam); this.marks = $('.fx-marks', this.cam);
    this.tr = $('.fx-tr', this.root); this.panel = $('.fx-panel', this.root); this.back = $('.fx-back', this.root); this.tourEl = $('.fx-tour', this.root);
    this.timers = []; this.open = null; this.controls = [];
    this.effects = (scene.effects || []).map(function (e) { return FX[e[0]](self, e[1]); });
    this.buildMarkers(); this.buildCallouts();
    this.update();
    this.back.addEventListener('click', function () { self.close(); });
    this.root.addEventListener('pointerdown', function () { self.stopTour(); }, { passive: true });
    this.stage.addEventListener('click', function (e) { if (e.target === self.img && self.open) self.close(); });
    addEventListener('keydown', function (e) { if (e.key === 'Escape' && self.open && self.root.closest('.lb.on, body')) self.close(); });
    if (opts.tour !== false && !REDUCED) this.setupTour();
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { try { if (e.isIntersecting) self.svg.unpauseAnimations(); else self.svg.pauseAnimations(); } catch (x) { } });
      }, { threshold: 0 }).observe(this.stage);
    }
  }

  /* Hilfen für Effekte */
  Stage.prototype.p = function (pt) { return { x: pt[0] * 10, y: pt[1] * this.H / 100 }; };
  Stage.prototype.g = function (cls) {
    var g = sv('g', { class: cls, style: 'transition:opacity .6s', opacity: 0 }, this.svg), self = this;
    g.style.display = 'none';
    /* opacity über diese Hilfe setzen: 0 = nach der Blende ausblenden und Animationen anhalten */
    Object.defineProperty(g, 'vis', { set: function (on) {
      clearTimeout(g._hid);
      if (on) { g.style.display = ''; requestAnimationFrame(function () { g.style.opacity = 1; }); }
      else { g.style.opacity = 0; g._hid = setTimeout(function () { g.style.display = 'none'; }, 700); }
    } });
    return g;
  };
  Stage.prototype.uid = function (pre) { return 'fx' + pre + (++UID); };
  Stage.prototype.path = function (poly, holes) {
    var self = this; function one(pl) { return pl.map(function (pt, i) { var p = self.p(pt); return (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1); }).join(' ') + ' Z'; }
    return one(poly) + (holes || []).map(one).join(' ');
  };
  Stage.prototype.clip = function (poly) { var id = this.uid('c'), cp = sv('clipPath', { id: id }, this.defs); sv('path', { d: this.path(poly) }, cp); return id; };
  Stage.prototype.bbox = function (poly) {
    var xs = poly.map(function (p) { return p[0]; }), ys = poly.map(function (p) { return p[1]; });
    var a = this.p([Math.min.apply(null, xs), Math.min.apply(null, ys)]), b = this.p([Math.max.apply(null, xs), Math.max.apply(null, ys)]);
    return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
  };
  Stage.prototype.steam = function (parent, x, y, spread, n) {
    var g = sv('g', { style: 'transition:opacity .8s', opacity: 0 }, parent);
    for (var i = 0; i < (n || 6); i++) {
      var c = sv('circle', { cx: x + rnd(-spread / 2, spread / 2), cy: y, r: rnd(2, 4), fill: '#fff', opacity: 0 }, g), dur = rnd(1.8, 3), b = (-rnd(0, 2)) + 's';
      sv('animateTransform', { attributeName: 'transform', type: 'translate', from: '0 0', to: rnd(-8, 8) + ' ' + (-rnd(20, 40)), dur: dur + 's', begin: b, repeatCount: 'indefinite' }, c);
      sv('animate', { attributeName: 'opacity', values: '0;.5;0', dur: dur + 's', begin: b, repeatCount: 'indefinite' }, c);
      sv('animate', { attributeName: 'r', from: 2, to: 8, dur: dur + 's', begin: b, repeatCount: 'indefinite' }, c);
    }
    return g;
  };

  Stage.prototype.buildMarkers = function () {
    var self = this;
    this.scene.hotspots.forEach(function (hs) {
      var b = el('button', 'fx-mark', '<i></i><span>' + esc(hs.title) + '</span>');
      b.type = 'button'; b.style.left = hs.at[0] + '%'; b.style.top = hs.at[1] + '%'; b.setAttribute('aria-label', hs.title);
      b.addEventListener('click', function (e) { e.stopPropagation(); self.openHotspot(hs); });
      hs._btn = b; self.marks.appendChild(b);
    });
  };

  Stage.prototype.buildCallouts = function () {
    var self = this;
    this.scene.hotspots.forEach(function (hs) {
      hs._co = [];
      (hs.callouts || []).forEach(function (c) {
        var a = self.p(c.at), b = self.p(c.to);
        var g = sv('g', { class: 'fx-co-g' }, self.svg);
        sv('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: '#0b1220', 'stroke-width': 3, opacity: .45 }, g);
        var ln = sv('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: '#fff', 'stroke-width': 1.6 }, g);
        sv('circle', { cx: a.x, cy: a.y, r: 3.2, fill: '#fff', stroke: '#0b1220', 'stroke-width': 1 }, g);
        var L = Math.hypot(b.x - a.x, b.y - a.y); ln.style.strokeDasharray = L; ln.style.strokeDashoffset = L;
        var lab = el('div', 'fx-co', esc(c.text)); lab.style.left = c.to[0] + '%'; lab.style.top = c.to[1] + '%';
        self.coLayer.appendChild(lab);
        hs._co.push({ g: g, ln: ln, lab: lab });
      });
    });
  };

  Stage.prototype.showCallouts = function (hs, on) {
    (hs._co || []).forEach(function (c, i) {
      c.g.classList.toggle('on', on); c.lab.classList.toggle('on', on);
      c.ln.style.transitionDelay = on ? (i * 180) + 'ms' : '0ms'; c.lab.style.transitionDelay = on ? (200 + i * 180) + 'ms' : '0ms';
      c.ln.style.strokeDashoffset = on ? 0 : c.ln.style.strokeDasharray;
    });
  };

  Stage.prototype.setCam = function (cx, cy, s) {
    var tx = s === 1 ? 0 : clamp(50 - cx * s, 100 - 100 * s, 0), ty = s === 1 ? 0 : clamp(50 - cy * s, 100 - 100 * s, 0);
    this.cam.style.transform = 'translate(' + tx.toFixed(2) + '%,' + ty.toFixed(2) + '%) scale(' + s + ')';
    this.cam.style.setProperty('--z', s);
    this.stage.classList.toggle('zoomed', s !== 1);
  };

  Stage.prototype.transition = function (type, x, y) {
    var tr = this.tr, self = this;
    if (REDUCED) return;
    tr.className = 'fx-tr'; void tr.offsetWidth;
    if (type === 'iris') {
      var t0 = performance.now(), dur = 1150; tr.style.opacity = 1;
      (function f(now) {
        var k = Math.min(1, (now - t0) / dur), r = k < .42 ? 110 - 98 * ease(k / .42) : 12 + 150 * ease((k - .42) / .58);
        tr.style.background = 'radial-gradient(ellipse at ' + x + '% ' + y + '%, transparent ' + r + '%, rgba(6,10,18,.8) ' + (r + 16) + '%)';
        if (k < 1) requestAnimationFrame(f); else { tr.style.opacity = 0; tr.style.background = ''; }
      })(t0);
    } else {
      tr.classList.add('fx-tr-' + type);
      setTimeout(function () { tr.classList.remove('fx-tr-' + type); }, 1300);
    }
    this.cam.classList.add('moving'); setTimeout(function () { self.cam.classList.remove('moving'); }, 520);
  };

  Stage.prototype.clearTimers = function () { this.timers.forEach(clearTimeout); this.timers = []; };
  Stage.prototype.later = function (fn, ms) { this.timers.push(setTimeout(fn, ms)); };

  Stage.prototype.openHotspot = function (hs, fromTour) {
    var self = this;
    if (!fromTour) this.stopTour();
    if (this.open && this.open !== hs) this.showCallouts(this.open, false);
    this.clearTimers();
    this.open = hs;
    this.scene.hotspots.forEach(function (h) { h._btn.classList.toggle('active', h === hs); });
    var z = hs.zoom || [hs.at[0], hs.at[1], 2];
    this.transition(hs.tr || TRANS[trIndex++ % TRANS.length], hs.at[0], hs.at[1]);
    this.setCam(z[0], z[1], z[2]);
    this.back.hidden = false;
    this.later(function () { self.renderPanel(hs); }, 320);
    this.later(function () { self.showCallouts(hs, true); }, 900);
    (hs.auto || []).forEach(function (a) {
      self.later(function () { self.state[a[0]] = a[1] === 'auto' ? Date.now() : a[1]; self.update(); }, a[2]);
    });
  };

  Stage.prototype.close = function () {
    var self = this; if (!this.open) return;
    this.clearTimers(); this.showCallouts(this.open, false);
    this.open = null; this.scene.hotspots.forEach(function (h) { h._btn.classList.remove('active'); });
    /* Schalter (Fenster, Licht, Regen) gehen beim Zurück wieder zu, gewählte Farben bleiben */
    var init = this.scene.initial || {}, changed = false;
    for (var k in init) if (typeof init[k] === 'boolean' && this.state[k] !== init[k]) { this.state[k] = init[k]; changed = true; }
    if (changed) this.update();
    this.setCam(50, 50, 1); this.back.hidden = true;
    this.panel.classList.remove('on'); this.later(function () { self.panel.hidden = true; }, 350);
    this.cam.classList.add('moving'); setTimeout(function () { self.cam.classList.remove('moving'); }, 520);
  };

  Stage.prototype.renderPanel = function (hs) {
    var self = this;
    this.panel.hidden = false; this.panel.classList.remove('on'); void this.panel.offsetWidth;
    this.panel.innerHTML = '<button type="button" class="fx-x" aria-label="Schließen">×</button><span class="sr-kicker">' + esc(hs.kicker || '') + '</span><h3>' + esc(hs.title) + '</h3><p>' + esc(hs.text || '') + '</p><div class="fx-opts"></div><div class="fx-info"></div>';
    $('.fx-x', this.panel).addEventListener('click', function () { self.close(); });
    this.controls = this.renderControls($('.fx-opts', this.panel), hs.options || []);
    this.info = $('.fx-info', this.panel);
    this.sync(); this.panel.classList.add('on');
  };

  Stage.prototype.renderControls = function (box, opts) {
    var self = this, list = [];
    opts.forEach(function (o) {
      var row = el('div', 'sr-opt sr-opt-' + o.type), ctrl = { sync: function () { } };
      if (o.type === 'choice' || o.type === 'swatch') {
        row.innerHTML = '<label>' + esc(o.label) + '</label><div class="sr-choices"></div>';
        var bx = $('.sr-choices', row), btns = o.values.map(function (v) {
          var b = el('button', 'sr-choice', o.type === 'swatch' ? '<i style="background:' + (v[2] || v[0]) + '"></i><span>' + esc(v[1]) + '</span>' : esc(v[1]));
          b.type = 'button'; b.dataset.value = v[0]; b.addEventListener('click', function () { self.clearTimers(); self.state[o.key] = v[0]; self.update(); }); bx.appendChild(b); return b;
        });
        ctrl.sync = function () { btns.forEach(function (b) { b.classList.toggle('active', String(self.state[o.key]) === String(b.dataset.value)); }); };
      } else if (o.type === 'range') {
        row.innerHTML = '<label>' + esc(o.label) + ' <output></output></label><input type="range" min="' + o.min + '" max="' + o.max + '" step="' + (o.step || 1) + '">';
        var inp = $('input', row), out = $('output', row);
        inp.addEventListener('input', function () { self.state[o.key] = Number(inp.value); self.update(); });
        ctrl.sync = function () { inp.value = self.state[o.key]; out.textContent = Math.round(self.state[o.key]) + (o.unit || ''); };
      } else if (o.type === 'toggle') {
        row.innerHTML = '<button type="button" class="sr-switch" role="switch"><span class="knob"></span></button><label>' + esc(o.label) + '</label>';
        var sw = $('button', row); sw.addEventListener('click', function () { self.state[o.key] = !self.state[o.key]; self.update(); });
        $('label', row).addEventListener('click', function () { sw.click(); });
        ctrl.sync = function () { sw.setAttribute('aria-checked', self.state[o.key] ? 'true' : 'false'); };
      } else if (o.type === 'buttons') {
        row.innerHTML = '<label>' + esc(o.label) + '</label><div class="sr-choices"></div>';
        var bb = $('.sr-choices', row);
        o.values.forEach(function (v) { var b = el('button', 'sr-choice', esc(v.label)); b.type = 'button'; b.addEventListener('click', function () { Object.assign(self.state, typeof v.set === 'function' ? v.set(self.state) : v.set); self.update(); }); bb.appendChild(b); });
      }
      box.appendChild(row); list.push(ctrl);
    });
    return list;
  };

  Stage.prototype.sync = function () {
    this.controls.forEach(function (c) { c.sync(); });
    if (this.info && this.open) { var t = this.open.info ? this.open.info(this.state) : ''; this.info.textContent = t; this.info.hidden = !t; }
  };

  Stage.prototype.update = function () {
    var s = this.state;
    this.effects.forEach(function (e) { e.update(s); });
    this.stage.classList.toggle('fx-trip', s.fi === 'trip');
    this.sync();
  };

  Stage.prototype.setupTour = function () {
    var self = this, started = false;
    this.tourStopped = false;
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting && e.intersectionRatio >= .55 && !started) { started = true; io.disconnect(); self.later(function () { self.runTour(); }, 900); }
      });
    }, { threshold: [.55] });
    io.observe(this.stage);
  };

  Stage.prototype.runTour = function () {
    var self = this, list = this.scene.hotspots.filter(function (h) { return h.tour !== false; }), i = 0;
    if (this.userTook || this.open) return;
    this.touring = true;
    function step() {
      if (!self.touring) return;
      if (i >= list.length) { self.touring = false; self.tourEl.classList.remove('on'); self.close(); return; }
      var hs = list[i++];
      self.tourEl.textContent = 'Vorführung: ' + hs.title + ' · Tippen, um selbst zu steuern'; self.tourEl.classList.add('on');
      self.openHotspot(hs, true);
      self.tourTimer = setTimeout(step, 4600);
    }
    step();
  };

  Stage.prototype.stopTour = function () {
    this.userTook = true;
    if (!this.touring) return;
    this.touring = false; clearTimeout(this.tourTimer); this.tourEl.classList.remove('on');
  };

  Stage.prototype.destroy = function () { this.clearTimers(); this.stopTour(); this.root.remove(); };

  /* ---------------- Einbau ---------------- */
  function mount(container, src, opts) {
    var scene = sceneFor(src); if (!scene) return null;
    var st = new Stage(container, scene, src, opts); STAGES.push(st); return st;
  }

  function featureBlock(src, caption) {
    var box = el('div', 'fx-feature');
    box.innerHTML = '<div class="fx-feature-head"><span class="fx-badge">Zum Anklicken</span><p>' + esc(caption || 'Tippen Sie im Foto auf die leuchtenden Punkte. Das Bild zoomt hin, Wasser läuft, Laden gehen auf, Farben wechseln.') + '</p></div>';
    mount(box, src, {});
    return box;
  }

  function init() {
    initHero();
    /* Ausdrücklich gesetzte Blöcke */
    $$('[data-fotoshow]').forEach(function (n) {
      var src = n.getAttribute('data-src'); if (!src) return;
      var b = featureBlock(src, n.getAttribute('data-caption')); n.appendChild(b);
    });
    /* Galerie: erstes Foto mit Szene wird groß und anklickbar */
    var photos = $('.photos');
    if (photos && !$('[data-fotoshow]')) {
      var figs = $$('figure', photos), first = null, best = -1;
      figs.forEach(function (f) {
        var im = $('img', f); if (!im) return;
        var src = im.getAttribute('src'), sc = sceneFor(src);
        if (sc) { f.classList.add('fx-fig'); var pr = sc.priority == null ? 2 : sc.priority; if (pr > best) { best = pr; first = src; } }
      });
      if (first) photos.parentNode.insertBefore(featureBlock(first), photos);
    }
  }

  /* ---------------- Hero: Hintergrundfoto anklickbar ---------------- */
  var OV = null, OVSTAGE = null;
  function closeOverlay() {
    if (!OV) return; OV.classList.remove('on'); document.body.style.overflow = '';
    setTimeout(function () { if (OVSTAGE) { OVSTAGE.destroy(); OVSTAGE = null; } }, 350);
  }
  function openOverlay(src, hsId) {
    var scene = sceneFor(src); if (!scene) return;
    if (!OV) {
      OV = el('div', 'lb fx-ov', '<button class="lb-x" aria-label="Schließen">×</button><div class="lb-fx"></div><figcaption></figcaption>');
      document.body.appendChild(OV);
      $('.lb-x', OV).addEventListener('click', closeOverlay);
      OV.addEventListener('click', function (e) { if (e.target === OV) closeOverlay(); });
      addEventListener('keydown', function (e) { if (e.key === 'Escape' && OV.classList.contains('on')) closeOverlay(); });
    }
    if (OVSTAGE) { OVSTAGE.destroy(); OVSTAGE = null; }
    var box = $('.lb-fx', OV); box.innerHTML = ''; box.style.setProperty('--ar', scene.ar);
    OVSTAGE = mount(box, src, { lightbox: true, tour: false });
    $('figcaption', OV).textContent = scene.caption || '';
    OV.classList.add('on'); document.body.style.overflow = 'hidden';
    if (hsId && OVSTAGE) setTimeout(function () {
      var hs = scene.hotspots.filter(function (h) { return h.id === hsId; })[0];
      if (hs && OVSTAGE) OVSTAGE.openHotspot(hs);
    }, 450);
  }

  function heroSetup(hero, src, scene) {
    var marks = el('div', 'fx-hero-marks'); hero.appendChild(marks);
    var items = scene.hotspots.map(function (hs) {
      var b = el('button', 'fx-mark', '<i></i><span>' + esc(hs.title) + '</span>'); b.type = 'button'; b.setAttribute('aria-label', hs.title);
      b.addEventListener('click', function () { openOverlay(src, hs.id); });
      marks.appendChild(b); return { b: b, hs: hs };
    });
    var wrap = $('.wrap', hero) || hero;
    var cta = el('button', 'fx-hero-cta', '<i></i>Foto erkunden'); cta.type = 'button';
    cta.addEventListener('click', function () { openOverlay(src, null); });
    hero.appendChild(cta);
    function layout() {
      var w = hero.clientWidth, h = hero.clientHeight, ar = scene.ar;
      var rw = Math.max(w, h * ar), rh = rw / ar, ox = (w - rw) / 2, oy = (h - rh) / 2;
      var hr = hero.getBoundingClientRect(), right = 0;
      $$('.wrap > *', hero).forEach(function (c) {
        if (c === cta || c.classList.contains('scrollcue')) return;
        var parts = c.children.length && /flex|grid/.test(getComputedStyle(c).display) ? $$(':scope > *', c) : [c];
        parts.forEach(function (q) { var rg = document.createRange(); rg.selectNodeContents(q); var r = rg.getBoundingClientRect(); if (r.width) right = Math.max(right, r.right - hr.left); });
      });
      var wide = w > 720;
      items.forEach(function (it) {
        var x = ox + it.hs.at[0] / 100 * rw, y = oy + it.hs.at[1] / 100 * rh;
        var ok = wide && x > Math.max(right + 40, w * .58) && x < w - 30 && y > 40 && y < h - 40;
        it.b.hidden = !ok; it.b.style.left = x + 'px'; it.b.style.top = y + 'px'; it.b.classList.toggle('fx-mark-r', x > w - 190);
      });
    }
    layout(); addEventListener('resize', layout); addEventListener('load', layout);
    if (window.ResizeObserver) new ResizeObserver(layout).observe(hero);
  }

  function initHero() {
    var hero = $('.hero'); if (!hero) return;
    var bg = getComputedStyle(hero).backgroundImage || '', m = /url\(["']?([^"')]+)["']?\)/.exec(bg);
    var src = m && m[1], scene = src && sceneFor(src);
    if (scene) heroSetup(hero, src, scene);
  }

  window.FotoShow = { sceneFor: sceneFor, mount: mount, openOverlay: openOverlay, scenes: SCENES, stages: STAGES };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
