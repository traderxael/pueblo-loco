/*
 * Pueblo Loco — capa de render e interacción.
 * Consume window.PuebloCore (core/economy.js). Sin dependencias externas.
 */
(function () {
  'use strict';
  var C = window.PuebloCore;
  var S = null;              // estado del juego (del core)
  var cv = document.getElementById('cv');
  var ctx = cv.getContext('2d');

  /* ------------------------------------------------------------ utilidades */
  function fmt(n) {
    n = Math.floor(n);
    if (n >= 1e12) return (n / 1e12).toFixed(1) + 'B';
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'G';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e4) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
  }
  function fmtTime(sec) {
    sec = Math.max(0, Math.ceil(sec));
    if (sec < 60) return '0:' + String(sec).padStart(2, '0');
    if (sec < 3600) return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return h + 'h ' + m + 'm';
  }
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  /* ---------------------------------------------------------------- audio */
  var AC = null;
  function blip(freq, dur, type, vol) {
    try {
      if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
      if (AC.state === 'suspended') AC.resume();
      var o = AC.createOscillator(), g = AC.createGain();
      o.type = type || 'sine'; o.frequency.value = freq || 660;
      g.gain.setValueAtTime(vol || 0.08, AC.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + (dur || 0.12));
      o.connect(g); g.connect(AC.destination);
      o.start(); o.stop(AC.currentTime + (dur || 0.12));
    } catch (e) { /* sin audio, sin problema */ }
  }
  var sfx = {
    coin: function () { blip(880, 0.09, 'sine', 0.07); setTimeout(function(){ blip(1320, 0.1, 'sine', 0.06); }, 60); },
    tap: function () { blip(520, 0.06, 'triangle', 0.05); },
    place: function () { blip(300, 0.12, 'square', 0.05); setTimeout(function(){ blip(600, 0.14, 'square', 0.05); }, 70); },
    level: function () { blip(523, 0.12, 'sine', 0.08); setTimeout(function(){ blip(659, 0.12, 'sine', 0.08); }, 100); setTimeout(function(){ blip(784, 0.2, 'sine', 0.08); }, 200); },
    task: function () { blip(440, 0.1, 'triangle', 0.06); },
    err: function () { blip(180, 0.18, 'sawtooth', 0.05); }
  };

  /* --------------------------------------------------------------- toasts */
  function toast(msg, kind) {
    var t = el('div', 'toast ' + (kind || ''), msg);
    $('toasts').appendChild(t);
    setTimeout(function () { t.classList.add('fade'); }, 2400);
    setTimeout(function () { t.remove(); }, 3000);
  }

  /* ------------------------------------------------------------ partículas */
  var particles = [];
  var floats = [];
  function burstCoin(wx, wy, n) {
    for (var i = 0; i < (n || 8); i++) {
      particles.push({
        x: wx, y: wy,
        vx: (Math.random() - 0.5) * 90,
        vy: -60 - Math.random() * 90,
        life: 0.7 + Math.random() * 0.4, age: 0,
        ico: Math.random() < 0.8 ? '🪙' : '✨'
      });
    }
  }
  function floatText(wx, wy, txt, color) {
    floats.push({ x: wx, y: wy, txt: txt, color: color || '#ffd166', age: 0, life: 1.3 });
  }

  /* --------------------------------------------------------------- cámara */
  var cam = { x: 3, y: 3, scale: 1 };
  var TILE = 64;
  function fitView() {
    var size = C.landTier(S).size;
    var w = cv.clientWidth, h = cv.clientHeight;
    var s = Math.min(w / ((size + 1.5) * TILE), h / ((size + 3.2) * TILE));
    cam.scale = Math.max(0.45, Math.min(1.5, s));
    cam.x = size / 2; cam.y = size / 2 - 0.4;
  }
  function w2s(wx, wy) {
    var ts = TILE * cam.scale;
    return {
      x: (wx - cam.x) * ts + cv.clientWidth / 2,
      y: (wy - cam.y) * ts + cv.clientHeight / 2
    };
  }
  function s2w(sx, sy) {
    var ts = TILE * cam.scale;
    return {
      x: (sx - cv.clientWidth / 2) / ts + cam.x,
      y: (sy - cv.clientHeight / 2) / ts + cam.y
    };
  }

  /* ------------------------------------------------- posiciones de vecinos */
  var wander = {}; // def -> {x, y, tx, ty, next}
  function ensureWander() {
    var size = C.landTier(S).size;
    S.characters.forEach(function (c) {
      if (!c.unlocked) return;
      if (!wander[c.def]) {
        wander[c.def] = {
          x: Math.random() * (size - 2) + 1,
          y: Math.random() * (size - 2) + 1,
          tx: Math.random() * (size - 2) + 1,
          ty: Math.random() * (size - 2) + 1,
          next: 0
        };
      }
    });
  }
  function updateWander(dt, now) {
    var size = C.landTier(S).size;
    S.characters.forEach(function (c) {
      if (!c.unlocked) return;
      var w = wander[c.def];
      if (!w) return;
      var busy = !!c.task && !c.task.done;
      if (busy) return; // parado mientras trabaja
      if (now > w.next) {
        w.tx = Math.random() * (size - 2) + 1;
        w.ty = Math.random() * (size - 2) + 1;
        w.next = now + 2500 + Math.random() * 4000;
      }
      var dx = w.tx - w.x, dy = w.ty - w.y;
      var d = Math.hypot(dx, dy);
      if (d > 0.08) {
        var sp = 1.1 * dt; // tiles/seg
        w.x += dx / d * Math.min(sp, d);
        w.y += dy / d * Math.min(sp, d);
      }
    });
  }

  /* ---------------------------------------------------------------- dibujo */
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawTiles(size, t) {
    var occ = C.occupancyMap(S);
    var ts = TILE * cam.scale;
    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        var p = w2s(x, y);
        var free = !occ[x + ',' + y];
        // césped
        var g = ctx.createLinearGradient(p.x, p.y, p.x, p.y + ts);
        g.addColorStop(0, ((x + y) % 2 === 0) ? '#6faf4e' : '#68a748');
        g.addColorStop(1, '#5c9941');
        ctx.fillStyle = g;
        ctx.fillRect(p.x, p.y, ts + 0.5, ts + 0.5);
        // textura sutil
        if (cam.scale > 0.7) {
          ctx.fillStyle = 'rgba(255,255,255,0.045)';
          var wob = Math.sin(t / 900 + x * 7 + y * 3) * 0.5 + 0.5;
          ctx.fillRect(p.x + ts * 0.2 + wob * ts * 0.1, p.y + ts * 0.65, ts * 0.16, ts * 0.06);
          ctx.fillRect(p.x + ts * 0.6, p.y + ts * 0.3, ts * 0.12, ts * 0.05);
        }
      }
    }
    // borde del terreno
    var p0 = w2s(0, 0), p1 = w2s(size, size);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 3;
    ctx.strokeRect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y);
  }

  function drawBuilding(b, def, t, now) {
    var ts = TILE * cam.scale;
    var p = w2s(b.x, b.y);
    var w = ts * def.size, h = ts * def.size;
    var x = p.x, y = p.y;

    // sombra
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h - ts * 0.06, w * 0.42, h * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();

    var pad = ts * 0.08;
    var bw = w - pad * 2, bh = h * 0.62 - pad;
    var bx = x + pad, by = y + h * 0.32 - pad;

    switch (def.kind) {
      case 'house': {
        ctx.fillStyle = def.color; roundRect(bx, by + bh * 0.25, bw, bh * 0.75, ts * 0.05); ctx.fill();
        ctx.fillStyle = def.roof;
        ctx.beginPath();
        ctx.moveTo(bx - ts * 0.05, by + bh * 0.28);
        ctx.lineTo(bx + bw / 2, by - bh * 0.12);
        ctx.lineTo(bx + bw + ts * 0.05, by + bh * 0.28);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(bx + bw * 0.42, by + bh * 0.62, bw * 0.16, bh * 0.38); // puerta
        ctx.fillStyle = '#b3e5fc';
        ctx.fillRect(bx + bw * 0.14, by + bh * 0.4, bw * 0.18, bh * 0.2); // ventana izq
        ctx.fillRect(bx + bw * 0.68, by + bh * 0.4, bw * 0.18, bh * 0.2); // ventana der
        break;
      }
      case 'kiosk': {
        ctx.fillStyle = def.color; roundRect(bx, by + bh * 0.3, bw, bh * 0.7, ts * 0.06); ctx.fill();
        // rayas del techo
        ctx.save();
        roundRect(bx, by + bh * 0.3, bw, bh * 0.7, ts * 0.06); ctx.clip();
        for (var i = 0; i < 6; i++) {
          ctx.fillStyle = i % 2 ? def.roof : '#fff';
          ctx.fillRect(bx + (i * bw) / 6, by + bh * 0.3, bw / 6, bh * 0.16);
        }
        ctx.restore();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold ' + Math.max(8, ts * 0.16) + 'px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('DIARIOS', bx + bw / 2, by + bh * 0.62);
        break;
      }
      case 'shop': {
        ctx.fillStyle = def.color; roundRect(bx, by + bh * 0.2, bw, bh * 0.8, ts * 0.05); ctx.fill();
        ctx.save();
        roundRect(bx, by + bh * 0.2, bw, bh * 0.8, ts * 0.05); ctx.clip();
        for (var i = 0; i < 8; i++) {
          ctx.fillStyle = i % 2 ? def.roof : '#fff8f0';
          ctx.fillRect(bx + (i * bw) / 8, by + bh * 0.2, bw / 8, bh * 0.18);
        }
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(bx + bw * 0.1, by + bh * 0.62, bw * 0.3, bh * 0.3);
        ctx.fillRect(bx + bw * 0.6, by + bh * 0.62, bw * 0.3, bh * 0.3);
        ctx.restore();
        ctx.fillStyle = '#3e2723';
        ctx.font = 'bold ' + Math.max(8, ts * 0.13) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(def.def === 'panaderia' ? '🥐' : def.def === 'cafeteria' ? '☕' : '🌷', bx + bw / 2, by + bh * 0.5);
        break;
      }
      case 'garage': {
        ctx.fillStyle = def.color; roundRect(bx, by + bh * 0.15, bw, bh * 0.85, ts * 0.05); ctx.fill();
        ctx.fillStyle = '#455a64';
        roundRect(bx + bw * 0.12, by + bh * 0.45, bw * 0.76, bh * 0.55, ts * 0.04); ctx.fill();
        ctx.strokeStyle = '#90a4ae'; ctx.lineWidth = Math.max(1, ts * 0.015);
        for (var i = 1; i < 5; i++) {
          ctx.beginPath();
          ctx.moveTo(bx + bw * 0.12, by + bh * (0.45 + i * 0.11));
          ctx.lineTo(bx + bw * 0.88, by + bh * (0.45 + i * 0.11));
          ctx.stroke();
        }
        ctx.fillStyle = def.roof;
        ctx.fillRect(bx, by + bh * 0.08, bw, bh * 0.09);
        break;
      }
      case 'cinema': {
        ctx.fillStyle = def.color; roundRect(bx, by + bh * 0.25, bw, bh * 0.75, ts * 0.05); ctx.fill();
        ctx.fillStyle = '#3e2723';
        roundRect(bx + bw * 0.08, by + bh * 0.28, bw * 0.84, bh * 0.2, ts * 0.03); ctx.fill();
        ctx.fillStyle = '#ffe082';
        ctx.font = 'bold ' + Math.max(7, ts * 0.11) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CINE', bx + bw / 2, by + bh * 0.38);
        // lucecitas
        for (var i = 0; i < 7; i++) {
          var on = (Math.floor(t / 350) + i) % 3 !== 0;
          ctx.fillStyle = on ? '#ffeb3b' : 'rgba(255,235,59,0.25)';
          ctx.beginPath();
          ctx.arc(bx + bw * (0.12 + i * 0.13), by + bh * 0.62, Math.max(1.2, ts * 0.025), 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'school': {
        ctx.fillStyle = def.color; roundRect(bx, by + bh * 0.25, bw, bh * 0.75, ts * 0.04); ctx.fill();
        ctx.fillStyle = def.roof;
        ctx.fillRect(bx, by + bh * 0.18, bw, bh * 0.08);
        ctx.fillStyle = def.roof;
        ctx.fillRect(bx + bw * 0.36, by - bh * 0.18, bw * 0.28, bh * 0.46); // campanario
        ctx.beginPath();
        ctx.moveTo(bx + bw * 0.32, by - bh * 0.18);
        ctx.lineTo(bx + bw * 0.5, by - bh * 0.34);
        ctx.lineTo(bx + bw * 0.68, by - bh * 0.18);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(bx + bw * 0.44, by + bh * 0.6, bw * 0.12, bh * 0.4);
        ctx.fillStyle = '#b3e5fc';
        ctx.fillRect(bx + bw * 0.12, by + bh * 0.45, bw * 0.14, bh * 0.14);
        ctx.fillRect(bx + bw * 0.74, by + bh * 0.45, bw * 0.14, bh * 0.14);
        break;
      }
      case 'hospital': {
        ctx.fillStyle = def.color; roundRect(bx, by + bh * 0.18, bw, bh * 0.82, ts * 0.04); ctx.fill();
        ctx.fillStyle = def.roof;
        ctx.fillRect(bx, by + bh * 0.1, bw, bh * 0.09);
        ctx.fillStyle = '#e53935';
        var cx = bx + bw / 2 - bh * 0.13, cy = by + bh * 0.42, s = bh * 0.26;
        ctx.fillRect(cx + s * 0.3, cy, s * 0.4, s);
        ctx.fillRect(cx, cy + s * 0.3, s, s * 0.4);
        ctx.fillStyle = '#90a4ae';
        ctx.fillRect(bx + bw * 0.1, by + bh * 0.72, bw * 0.2, bh * 0.28);
        ctx.fillRect(bx + bw * 0.7, by + bh * 0.72, bw * 0.2, bh * 0.28);
        break;
      }
      case 'office': {
        ctx.fillStyle = def.color; roundRect(bx, by + bh * 0.12, bw, bh * 0.88, ts * 0.04); ctx.fill();
        ctx.fillStyle = def.roof;
        ctx.fillRect(bx, by + bh * 0.05, bw, bh * 0.08);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold ' + Math.max(8, ts * 0.15) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★', bx + bw / 2, by + bh * 0.45);
        ctx.fillStyle = '#1a5276';
        ctx.fillRect(bx + bw * 0.42, by + bh * 0.68, bw * 0.16, bh * 0.32);
        break;
      }
      case 'stadium': {
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h * 0.62, w * 0.44, h * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = def.roof;
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h * 0.62, w * 0.3, h * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#145a32';
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h * 0.62, w * 0.18, h * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
        // focos
        for (var i = 0; i < 4; i++) {
          var on = (Math.floor(t / 500) + i) % 2 === 0;
          ctx.fillStyle = on ? '#fff59d' : 'rgba(255,245,157,0.3)';
          ctx.beginPath();
          ctx.arc(x + w * (0.2 + i * 0.2), y + h * 0.3, Math.max(1.5, ts * 0.03), 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'tower': {
        ctx.fillStyle = def.color;
        roundRect(bx + bw * 0.18, by - bh * 0.35, bw * 0.64, bh * 1.35, ts * 0.04);
        ctx.fill();
        ctx.fillStyle = def.roof;
        ctx.fillRect(bx + bw * 0.18, by - bh * 0.42, bw * 0.64, bh * 0.09);
        // ventanas
        ctx.fillStyle = '#85c1e9';
        for (var r = 0; r < 4; r++)
          for (var c2 = 0; c2 < 3; c2++) {
            var lit = (Math.floor(t / 1200) + r * 3 + c2) % 4 !== 0;
            ctx.fillStyle = lit ? '#f9e79f' : '#2e4053';
            ctx.fillRect(bx + bw * (0.26 + c2 * 0.17), by + bh * (-0.2 + r * 0.28), bw * 0.11, bh * 0.15);
          }
        break;
      }
      default: {
        ctx.fillStyle = def.color; roundRect(bx, by, bw, bh, ts * 0.06); ctx.fill();
      }
    }

    // burbuja de monedas listas
    if (b.ready > 0) {
      var bob = Math.sin(t / 300 + b.x * 5) * ts * 0.05;
      var bx2 = x + w / 2, by2 = y - ts * 0.12 + bob;
      ctx.fillStyle = 'rgba(20,26,38,0.9)';
      ctx.beginPath(); ctx.arc(bx2, by2, ts * 0.21, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2; ctx.stroke();
      ctx.font = Math.max(10, ts * 0.2) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🪙', bx2, by2);
    }
  }

  function drawCharacter(cd, c, now, t) {
    if (!c.unlocked) return;
    var w = wander[c.def];
    if (!w) return;
    var ts = TILE * cam.scale;
    var p = w2s(w.x, w.y);
    var bob = Math.sin(t / 240 + w.x * 3) * ts * 0.02;
    var bodyH = ts * 0.34, headR = ts * 0.14;

    // sombra
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + bodyH * 0.55, ts * 0.16, ts * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();

    var cx = p.x, cy = p.y - bodyH * 0.35 + bob;
    // piernas
    ctx.fillStyle = '#37474f';
    ctx.fillRect(cx - ts * 0.07, cy + bodyH * 0.35, ts * 0.05, bodyH * 0.25);
    ctx.fillRect(cx + ts * 0.02, cy + bodyH * 0.35, ts * 0.05, bodyH * 0.25);
    // cuerpo
    ctx.fillStyle = cd.color;
    roundRect(cx - ts * 0.11, cy, ts * 0.22, bodyH * 0.55, ts * 0.05);
    ctx.fill();
    // brazos
    var swing = c.task ? 0 : Math.sin(t / 160 + w.x) * ts * 0.05;
    ctx.fillStyle = cd.color;
    ctx.fillRect(cx - ts * 0.15, cy + bodyH * 0.1 + swing, ts * 0.04, bodyH * 0.3);
    ctx.fillRect(cx + ts * 0.11, cy + bodyH * 0.1 - swing, ts * 0.04, bodyH * 0.3);
    // cabeza
    ctx.fillStyle = '#ffcc9e';
    ctx.beginPath(); ctx.arc(cx, cy - headR * 0.7, headR, 0, Math.PI * 2); ctx.fill();
    // pelo
    ctx.fillStyle = cd.hair;
    ctx.beginPath();
    ctx.arc(cx, cy - headR * 0.85, headR * 0.96, Math.PI, 0);
    ctx.fill();
    // ojos
    ctx.fillStyle = '#263238';
    ctx.beginPath(); ctx.arc(cx - headR * 0.35, cy - headR * 0.6, headR * 0.09, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + headR * 0.35, cy - headR * 0.6, headR * 0.09, 0, Math.PI * 2); ctx.fill();

    // burbuja de tarea
    if (c.task) {
      var done = c.task.done;
      var remain = Math.max(0, (c.task.endAt - now) / 1000);
      var prog = 1 - remain / (C.taskDef(c.def, c.task.taskId).sec);
      var br = ts * 0.24;
      var bxp = cx, byp = cy - headR * 1.9;
      ctx.fillStyle = done ? 'rgba(46,64,83,0.95)' : 'rgba(20,26,38,0.92)';
      ctx.beginPath(); ctx.arc(bxp, byp, br, 0, Math.PI * 2); ctx.fill();
      // arco de progreso
      ctx.strokeStyle = done ? '#6ee7a0' : '#ffb84d';
      ctx.lineWidth = ts * 0.05;
      ctx.beginPath();
      ctx.arc(bxp, byp, br - ts * 0.03, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, prog));
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold ' + Math.max(9, ts * 0.17) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (done) {
        ctx.fillStyle = '#6ee7a0';
        ctx.fillText('✓', bxp, byp);
      } else {
        ctx.fillText(fmtTime(remain), bxp, byp);
      }
    }
  }

  function drawGhost(t, now) {
    if (!build.def) return;
    var m = pointer.last; if (!m) return;
    var w = s2w(m.x, m.y);
    var gx = Math.floor(w.x), gy = Math.floor(w.y);
    var def = build.def;
    var size = C.landTier(S).size;
    var valid = gx >= 0 && gy >= 0 && gx + def.size <= size && gy + def.size <= size &&
      C.canPlaceBuilding(S, def.def, gx, gy).ok;
    var ts = TILE * cam.scale;
    var occ = C.occupancyMap(S);
    for (var dx = 0; dx < def.size; dx++)
      for (var dy = 0; dy < def.size; dy++) {
        var p = w2s(gx + dx, gy + dy);
        ctx.fillStyle = valid ? 'rgba(110,231,160,0.45)' : 'rgba(255,107,107,0.4)';
        ctx.fillRect(p.x, p.y, ts, ts);
        ctx.strokeStyle = valid ? '#6ee7a0' : '#ff6b6b';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x + 1, p.y + 1, ts - 2, ts - 2);
      }
    // silueta del edificio
    var p0 = w2s(gx, gy);
    ctx.globalAlpha = 0.55;
    drawBuilding({ x: gx, y: gy, ready: 0 }, def, t, now);
    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------------------ bucle main */
  var last = 0;
  function loop(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    var t = now;

    updateWander(dt, now);

    // partículas
    for (var i = particles.length - 1; i >= 0; i--) {
      var pa = particles[i];
      pa.age += dt;
      pa.x += pa.vx * dt; pa.y += pa.vy * dt; pa.vy += 260 * dt;
      if (pa.age > pa.life) particles.splice(i, 1);
    }
    for (var i = floats.length - 1; i >= 0; i--) {
      var fl = floats[i];
      fl.age += dt; fl.y -= 26 * dt;
      if (fl.age > fl.life) floats.splice(i, 1);
    }

    render(t);
    requestAnimationFrame(loop);
  }

  function render(t) {
    var dpr = window.devicePixelRatio || 1;
    var w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== w * dpr || cv.height !== h * dpr) {
      cv.width = w * dpr; cv.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // fondo
    var bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#2c3e57');
    bg.addColorStop(1, '#1a2332');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    var size = C.landTier(S).size;
    drawTiles(size, t);
    S.decor.forEach(function (d) { drawDecor(d); });
    S.buildings.forEach(function (b) {
      drawBuilding(b, C.buildingDef(b.def), t, Date.now());
    });
    S.characters.forEach(function (c) {
      drawCharacter(C.characterDef(c.def), c, Date.now(), t);
    });

    drawGhost(t, Date.now());

    // partículas (mundo → pantalla)
    var ts = TILE * cam.scale;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = Math.max(12, ts * 0.3) + 'px sans-serif';
    particles.forEach(function (pa) {
      var p = w2s(pa.x, pa.y);
      ctx.globalAlpha = Math.max(0, 1 - pa.age / pa.life);
      ctx.fillText(pa.ico, p.x, p.y);
    });
    floats.forEach(function (fl) {
      var p = w2s(fl.x, fl.y);
      ctx.globalAlpha = Math.max(0, 1 - fl.age / fl.life);
      ctx.fillStyle = fl.color;
      ctx.font = 'bold ' + Math.max(12, ts * 0.26) + 'px sans-serif';
      ctx.fillText(fl.txt, p.x, p.y);
    });
    ctx.globalAlpha = 1;
  }

  function drawDecor(d) {
    var ts = TILE * cam.scale;
    var p = w2s(d.x, d.y);
    var def = C.decorDef(d.def);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(p.x + ts / 2, p.y + ts * 0.8, ts * 0.2, ts * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = Math.max(14, ts * 0.5) + 'px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var ico = { farol: '🏮', arbusto: '🌳', banco: '🪑', fuente: '⛲', estatua: '🗿' }[d.def] || '🌿';
    ctx.fillText(ico, p.x + ts / 2, p.y + ts / 2);
  }

  /* ---------------------------------------------------------------- input */
  var pointer = { down: false, sx: 0, sy: 0, lx: 0, ly: 0, moved: false, last: null };
  var build = { def: null };

  cv.addEventListener('pointerdown', function (e) {
    cv.setPointerCapture(e.pointerId);
    pointer.down = true; pointer.moved = false;
    pointer.sx = e.clientX; pointer.sy = e.clientY;
    pointer.lx = e.clientX; pointer.ly = e.clientY;
    pointer.last = { x: e.clientX, y: e.clientY };
  });
  cv.addEventListener('pointermove', function (e) {
    pointer.last = { x: e.clientX, y: e.clientY };
    if (!pointer.down) return;
    var dx = e.clientX - pointer.lx, dy = e.clientY - pointer.ly;
    if (Math.abs(e.clientX - pointer.sx) + Math.abs(e.clientY - pointer.sy) > 10) pointer.moved = true;
    cam.x -= dx / (TILE * cam.scale);
    cam.y -= dy / (TILE * cam.scale);
    pointer.lx = e.clientX; pointer.ly = e.clientY;
  });
  cv.addEventListener('pointerup', function (e) {
    pointer.down = false;
    if (!pointer.moved) handleTap(e.clientX, e.clientY);
  });
  cv.addEventListener('pointercancel', function () { pointer.down = false; });
  cv.addEventListener('wheel', function (e) {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 0.89);
  }, { passive: false });

  function zoomAt(sx, sy, f) {
    var before = s2w(sx, sy);
    cam.scale = Math.max(0.4, Math.min(1.8, cam.scale * f));
    var after = s2w(sx, sy);
    cam.x += before.x - after.x;
    cam.y += before.y - after.y;
  }
  $('zIn').onclick = function () { zoomAt(cv.clientWidth / 2, cv.clientHeight / 2, 1.2); };
  $('zOut').onclick = function () { zoomAt(cv.clientWidth / 2, cv.clientHeight / 2, 0.83); };

  function handleTap(sx, sy) {
    var now = Date.now();
    var w = s2w(sx, sy);
    var gx = Math.floor(w.x), gy = Math.floor(w.y);
    var size = C.landTier(S).size;

    if (build.def) {
      if (gx < 0 || gy < 0 || gx >= size || gy >= size) { sfx.err(); return; }
      var r = C.placeBuilding(S, build.def.def, gx, gy, now);
      if (r.ok) {
        sfx.place();
        floatText(gx + build.def.size / 2, gy, '¡' + build.def.name + '!', '#6ee7a0');
        handleEvents(r.events);
        build.def = null; $('buildBar').classList.remove('open');
        syncHUD(); openShop();
      } else {
        sfx.err(); toast(r.reason, 'bad');
      }
      return;
    }

    // ¿personaje bajo el dedo?
    var ts = TILE * cam.scale;
    for (var i = 0; i < S.characters.length; i++) {
      var c = S.characters[i];
      if (!c.unlocked) continue;
      var wp = wander[c.def]; if (!wp) continue;
      if (Math.hypot(wp.x - w.x, wp.y - w.y) < 0.62) {
        sfx.tap();
        openTaskModal(c.def);
        return;
      }
    }

    // ¿edificio?
    var hit = null;
    S.buildings.forEach(function (b) {
      var def = C.buildingDef(b.def);
      if (gx >= b.x && gx < b.x + def.size && gy >= b.y && gy < b.y + def.size) hit = b;
    });
    if (hit) {
      sfx.tap();
      openBuildingMenu(hit);
      return;
    }
  }

  /* ------------------------------------------------------------- eventos */
  function handleEvents(events) {
    if (!events) return;
    events.forEach(function (e) {
      if (e.type === 'quest') {
        sfx.level();
        var rw = [];
        if (e.reward.coins) rw.push(fmt(e.reward.coins) + ' 🪙');
        if (e.reward.donas) rw.push(e.reward.donas + ' 🍩');
        if (e.reward.xp) rw.push(e.reward.xp + ' ⭐');
        toast('📋 ¡Misión completa! ' + e.quest.name + ' · +' + rw.join(' +'), 'good');
      }
    });
  }

  /* ---------------------------------------------------------------- HUD */
  function syncHUD() {
    var now = Date.now();
    $('coinsV').textContent = fmt(S.coins);
    $('donasV').textContent = fmt(S.donas);
    $('levelV').textContent = S.level;
    var need = C.xpForLevel(S.level);
    $('xpBar').style.width = Math.min(100, (S.xp / need) * 100) + '%';

    // badges
    var readyTasks = 0;
    S.characters.forEach(function (c) {
      if (c.task && c.task.done) readyTasks++;
    });
    var readyCoins = 0;
    S.buildings.forEach(function (b) { if (b.ready > 0) readyCoins++; });
    var tb = $('taskBadge');
    if (readyTasks > 0) { tb.style.display = 'flex'; tb.textContent = readyTasks; }
    else tb.style.display = 'none';
    var rb = $('readyBadge');
    if (readyCoins > 0) { rb.style.display = 'flex'; rb.textContent = readyCoins; }
    else rb.style.display = 'none';
  }

  /* --------------------------------------------------------------- modales */
  function openOv(id) { $(id).classList.add('open'); }
  function closeOv(id) { $(id).classList.remove('open'); }
  document.querySelectorAll('[data-close]').forEach(function (b) {
    b.onclick = function () { closeOv(b.dataset.close); sfx.tap(); };
  });
  document.querySelectorAll('.overlay').forEach(function (ov) {
    ov.addEventListener('pointerdown', function (e) { if (e.target === ov) ov.classList.remove('open'); });
  });

  /* --- tienda --- */
  var shopTab = 'buildings';
  document.querySelectorAll('.tab').forEach(function (t) {
    t.onclick = function () {
      document.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('on'); });
      t.classList.add('on');
      shopTab = t.dataset.shop;
      renderShop();
    };
  });

  function renderShop() {
    var grid = $('shopGrid');
    grid.innerHTML = '';
    var now = Date.now();
    if (shopTab === 'buildings') {
      $('shopSub').textContent = 'Toca uno y colócalo en el terreno';
      C.BUILDINGS.forEach(function (b) {
        var locked = S.level < b.level;
        var it = el('div', 'item' + (locked ? ' locked' : ''));
        var art = { house: '🏠', kiosk: '📰', shop: b.def === 'panaderia' ? '🥐' : b.def === 'cafeteria' ? '☕' : '🌷',
          garage: '🔧', cinema: '🎬', school: '🏫', hospital: '🏥', office: '🚓',
          stadium: '🏟️', tower: '🏢' }[b.kind] || '🏗️';
        it.innerHTML =
          '<div class="art">' + art + '</div>' +
          '<div class="nm">' + b.name + '</div>' +
          '<div class="ds">+' + b.coins + ' 🪙 cada ' + fmtTime(b.interval) +
          ' · ' + b.size + 'x' + b.size + (locked ? '<br><b style="color:#ff6b6b">Nivel ' + b.level + '</b>' : '') + '</div>' +
          '<div class="pr">' + (b.cost === 0 ? '<span style="color:#6ee7a0">¡Gratis!</span>' : '<span class="c">🪙 ' + fmt(b.cost) + '</span>') + '</div>';
        if (!locked) it.onclick = function () {
          sfx.tap();
          build.def = b;
          $('buildName').textContent = b.name;
          $('buildBar').classList.add('open');
          closeOv('shopOv');
        };
        grid.appendChild(it);
      });
    } else if (shopTab === 'characters') {
      $('shopSub').textContent = 'Desbloquea vecinos con 🍩';
      C.CHARACTERS.forEach(function (c) {
        var entry = S.characters.find(function (x) { return x.def === c.def; });
        var it = el('div', 'item' + (entry.unlocked ? ' owned' : ''));
        it.innerHTML =
          '<div class="art" style="font-size:30px">🧑</div>' +
          '<div class="nm">' + c.name + '</div>' +
          '<div class="ds">' + (entry.unlocked ? '✅ En tu barrio' : c.tasks.length + ' tareas disponibles') + '</div>' +
          '<div class="pr">' + (entry.unlocked ? '' : '<span class="d">🍩 ' + c.donas + '</span>') + '</div>';
        if (!entry.unlocked) it.onclick = function () {
          var r = C.unlockCharacter(S, c.def, now);
          if (r.ok) {
            sfx.level(); toast('🧑 ¡' + c.name + ' se mudó al barrio!', 'good');
            handleEvents(r.events); syncHUD(); renderShop();
          } else { sfx.err(); toast(r.reason, 'bad'); }
        };
        grid.appendChild(it);
      });
    } else {
      $('shopSub').textContent = 'Adornos para tu barrio';
      C.DECOR.forEach(function (d) {
        var locked = S.level < d.level;
        var it = el('div', 'item' + (locked ? ' locked' : ''));
        var art = { farol: '🏮', arbusto: '🌳', banco: '🪑', fuente: '⛲', estatua: '🗿' }[d.def];
        it.innerHTML =
          '<div class="art">' + art + '</div>' +
          '<div class="nm">' + d.name + '</div>' +
          '<div class="ds">Decoración' + (locked ? ' · <b style="color:#ff6b6b">Nivel ' + d.level + '</b>' : '') + '</div>' +
          '<div class="pr"><span class="c">🪙 ' + fmt(d.cost) + '</span></div>';
        if (!locked) it.onclick = function () {
          var r = C.buyDecor(S, d.def, now);
          if (r.ok) { sfx.place(); toast('🌳 ' + d.name + ' colocado', 'good'); handleEvents(r.events); syncHUD(); }
          else { sfx.err(); toast(r.reason, 'bad'); }
        };
        grid.appendChild(it);
      });
    }
  }
  function openShop() { renderShop(); openOv('shopOv'); }

  /* --- personajes y tareas --- */
  function openChars() {
    var body = $('charBody');
    body.innerHTML = '';
    var now = Date.now();
    C.CHARACTERS.forEach(function (cd) {
      var c = S.characters.find(function (x) { return x.def === cd.def; });
      if (!c.unlocked) return;
      var card = el('div', 'quest');
      var taskHtml = '<div class="ds" style="color:var(--muted);font-size:12.5px">Libre — tócalo para darle una tarea</div>';
      if (c.task) {
        var td = C.taskDef(cd.def, c.task.taskId);
        if (c.task.done) {
          taskHtml = '<div class="qobj ok">✅ ' + td.name + ' — ¡recompensa lista! (' + fmt(td.coins) + ' 🪙)</div>';
        } else {
          var remain = Math.max(0, (c.task.endAt - now) / 1000);
          var cost = C.rushCost(S, cd.def, now);
          taskHtml =
            '<div class="qobj">⏳ ' + td.name + ' — queda <b>' + fmtTime(remain) + '</b></div>' +
            '<div style="margin-top:8px;display:flex;gap:8px">' +
            '<button class="btn dona" data-rush="' + cd.def + '">⚡ Terminar ya · 🍩 ' + cost + '</button></div>';
        }
      }
      card.innerHTML = '<div class="qname">🧑 ' + cd.name + '</div>' + taskHtml;
      card.style.cursor = 'pointer';
      card.onclick = function (e) {
        if (e.target.dataset && e.target.dataset.rush) {
          var r = C.rushTask(S, e.target.dataset.rush, Date.now());
          if (r.ok) {
            sfx.coin(); burstCoin(cam.x, cam.y, 6);
            floatText(cam.x, cam.y - 0.5, '+' + fmt(r.coins), '#ffd166');
            handleEvents(r.events); syncHUD(); openChars();
          } else { sfx.err(); toast(r.reason, 'bad'); }
          return;
        }
        sfx.tap(); openTaskModal(cd.def);
      };
      body.appendChild(card);
    });
    openOv('charOv');
  }

  function openTaskModal(def) {
    var cd = C.characterDef(def);
    var c = S.characters.find(function (x) { return x.def === def; });
    $('taskTitle').textContent = '🧑 ' + cd.name;
    var body = $('taskBody');
    body.innerHTML = '';
    var now = Date.now();

    if (c.task) {
      var td = C.taskDef(def, c.task.taskId);
      var card = el('div', 'quest');
      if (c.task.done) {
        card.innerHTML =
          '<div class="qname">✅ ' + td.name + ' terminada</div>' +
          '<div class="qstory">Reclama tu recompensa: <b>' + fmt(td.coins) + ' 🪙</b> y ' + td.xp + ' ⭐</div>' +
          '<button class="btn big" id="claimBtn">Reclamar recompensa</button>';
        body.appendChild(card);
        $('claimBtn').onclick = function () {
          var r = C.completeTask(S, def, Date.now());
          if (r.ok) {
            sfx.coin();
            var p = wander[def];
            if (p) { burstCoin(p.x, p.y - 0.3, 10); floatText(p.x, p.y - 0.8, '+' + fmt(r.coins), '#ffd166'); }
            handleEvents(r.events); syncHUD(); closeOv('taskOv');
          }
        };
      } else {
        var remain = Math.max(0, (c.task.endAt - now) / 1000);
        var cost = C.rushCost(S, def, now);
        card.innerHTML =
          '<div class="qname">⏳ ' + td.name + '</div>' +
          '<div class="qstory">Trabajando… queda <b>' + fmtTime(remain) + '</b>. Recompensa: ' + fmt(td.coins) + ' 🪙 + ' + td.xp + ' ⭐</div>' +
          '<button class="btn dona big" id="rushBtn">⚡ Terminar ya por 🍩 ' + cost + '</button>';
        body.appendChild(card);
        $('rushBtn').onclick = function () {
          var r = C.rushTask(S, def, Date.now());
          if (r.ok) {
            sfx.coin();
            var p = wander[def];
            if (p) { burstCoin(p.x, p.y - 0.3, 10); floatText(p.x, p.y - 0.8, '+' + fmt(r.coins), '#ffd166'); }
            handleEvents(r.events); syncHUD(); openTaskModal(def);
          } else { sfx.err(); toast(r.reason, 'bad'); }
        };
      }
      openOv('taskOv');
      return;
    }

    cd.tasks.forEach(function (t) {
      var card = el('div', 'task');
      card.innerHTML =
        '<div class="tart">' + (t.sec >= 3600 ? '🌙' : t.sec >= 900 ? '☀️' : '⚡') + '</div>' +
        '<div class="tinfo"><div class="tname">' + t.name + '</div>' +
        '<div class="trew">' + fmtTime(t.sec) + ' · <b>' + fmt(t.coins) + ' 🪙</b> + ' + t.xp + ' ⭐</div></div>' +
        '<button class="btn">Iniciar</button>';
      card.querySelector('.btn').onclick = function () {
        var r = C.startTask(S, def, t.id, Date.now());
        if (r.ok) { sfx.task(); toast('▶ ' + t.name + ' iniciada', 'good'); closeOv('taskOv'); syncHUD(); }
        else { sfx.err(); toast(r.reason, 'bad'); }
      };
      body.appendChild(card);
    });
    openOv('taskOv');
  }

  /* --- misiones --- */
  function openQuests() {
    var body = $('questBody');
    body.innerHTML = '';
    var done = 0;
    C.QUESTS.forEach(function (q, i) {
      var status = i < S.questIndex ? 'done' : (i === S.questIndex ? 'active' : 'locked');
      if (status === 'done') done++;
      var card = el('div', 'quest ' + status);
      var objsHtml = '';
      if (status === 'done') {
        objsHtml = '<div class="qobj ok">✅ Completada</div>';
      } else if (status === 'active') {
        var prog = C.questProgress(S);
        objsHtml = prog.objs.map(function (o) {
          var label = objLabel(o.obj);
          return '<div class="qobj ' + (o.done ? 'ok' : '') + '">' + (o.done ? '✅' : '⬜') + ' ' + label + '</div>';
        }).join('');
      } else {
        objsHtml = '<div class="qobj" style="opacity:.5">🔒 Completa la misión anterior</div>';
      }
      var rw = [];
      if (q.reward.coins) rw.push(fmt(q.reward.coins) + ' 🪙');
      if (q.reward.donas) rw.push(q.reward.donas + ' 🍩');
      if (q.reward.xp) rw.push(q.reward.xp + ' ⭐');
      card.innerHTML =
        '<div class="qname">' + (status === 'active' ? '▶' : status === 'done' ? '✅' : '🔒') + ' ' + q.name + '</div>' +
        '<div class="qstory">' + q.story + '</div>' + objsHtml +
        '<div class="qrew">🎁 ' + rw.join(' · ') + '</div>';
      body.appendChild(card);
    });
    $('questSub').textContent = done + ' / ' + C.QUESTS.length + ' completadas';
    openOv('questOv');
  }
  function objLabel(o) {
    switch (o.type) {
      case 'build': return 'Construir: ' + C.buildingDef(o.def).name;
      case 'unlock': return 'Desbloquear: ' + C.characterDef(o.def).name;
      case 'level': return 'Alcanzar nivel ' + o.level;
      case 'coinsEarned': return 'Ganar ' + fmt(o.amount) + ' monedas en total';
      case 'tasksDone': return 'Completar ' + o.amount + ' tareas';
      case 'buildings': return 'Tener ' + o.amount + ' edificios';
      case 'decor': return 'Colocar ' + o.amount + ' adornos';
      default: return o.type;
    }
  }

  /* --- menú de edificio --- */
  function openBuildingMenu(b) {
    var def = C.buildingDef(b.def);
    var now = Date.now();
    C.accrueBuilding(b, now);
    $('bldTitle').textContent = def.name;
    var body = $('bldBody');
    body.innerHTML = '';
    var card = el('div', 'quest');
    var readyHtml = b.ready > 0
      ? '<button class="btn big" id="collectBtn">💰 Recolectar ' + fmt(b.ready) + ' 🪙</button>'
      : '<div class="qstory">Próxima producción en ' + fmtTime(Math.max(0, (b.lastAt + def.interval * 1000 - now) / 1000)) + '</div>';
    card.innerHTML =
      '<div class="qname">' + def.name + '</div>' +
      '<div class="qstory">Produce ' + def.coins + ' 🪙 cada ' + fmtTime(def.interval) + '</div>' +
      readyHtml +
      '<div style="margin-top:10px"><button class="btn sec" id="sellBtn">🏷️ Vender por ' + fmt(Math.floor(def.cost * 0.5)) + ' 🪙</button></div>';
    body.appendChild(card);
    if (b.ready > 0) {
      $('collectBtn').onclick = function () {
        var r = C.collectBuilding(S, b.id, Date.now());
        if (r.ok) {
          sfx.coin();
          burstCoin(b.x + def.size / 2, b.y + def.size / 2, 10);
          floatText(b.x + def.size / 2, b.y, '+' + fmt(r.amount), '#ffd166');
          handleEvents(r.events); syncHUD(); closeOv('bldOv');
        }
      };
    }
    $('sellBtn').onclick = function () {
      var r = C.sellBuilding(S, b.id, Date.now());
      if (r.ok) {
        sfx.place(); toast('🏷️ Vendido por ' + fmt(r.refund) + ' 🪙', 'good');
        handleEvents(r.events); syncHUD(); closeOv('bldOv');
      } else { sfx.err(); toast(r.reason, 'bad'); }
    };
    openOv('bldOv');
  }

  /* --- terreno --- */
  function openLand() {
    var next = C.nextLandTier(S);
    var body = $('landBody');
    body.innerHTML = '';
    var card = el('div', 'quest');
    var cur = C.landTier(S).size;
    if (next) {
      card.innerHTML =
        '<div class="qname">🌱 Terreno actual: ' + cur + 'x' + cur + '</div>' +
        '<div class="qstory">Expande el pueblo a ' + next.size + 'x' + next.size + ' para construir más.</div>' +
        '<button class="btn big" id="expandBtn">Expandir a ' + next.size + 'x' + next.size + ' · 🪙 ' + fmt(next.cost) + '</button>';
      body.appendChild(card);
      $('expandBtn').onclick = function () {
        var r = C.expandLand(S, Date.now());
        if (r.ok) {
          sfx.level(); toast('🌱 ¡Terreno ampliado a ' + r.size + 'x' + r.size + '!', 'good');
          fitView(); syncHUD(); closeOv('landOv');
        } else { sfx.err(); toast(r.reason, 'bad'); }
      };
    } else {
      card.innerHTML =
        '<div class="qname">🌱 Terreno máximo: ' + cur + 'x' + cur + '</div>' +
        '<div class="qstory">¡Tu pueblo ya es enorme! Sigue construyendo y completando misiones.</div>';
      body.appendChild(card);
    }
    openOv('landOv');
  }

  /* ------------------------------------------------------------ botones */
  $('btnShop').onclick = function () { sfx.tap(); openShop(); };
  $('btnChars').onclick = function () { sfx.tap(); openChars(); };
  $('btnQuests').onclick = function () { sfx.tap(); openQuests(); };
  $('btnLand').onclick = function () { sfx.tap(); openLand(); };
  $('buildCancel').onclick = function () { build.def = null; $('buildBar').classList.remove('open'); sfx.tap(); };
  $('btnCollect').onclick = function () {
    var r = C.collectAll(S, Date.now());
    if (r.ok) {
      sfx.coin();
      S.buildings.forEach(function (b) {
        if (b.ready === 0) burstCoin(b.x + 0.5, b.y + 0.5, 4);
      });
      floatText(cam.x, cam.y - 1, '+' + fmt(r.amount) + ' 🪙', '#ffd166');
      handleEvents(r.events); syncHUD();
    } else { sfx.err(); toast('Nada que recolectar todavía', ''); }
  };

  /* ------------------------------------------------------- tick y guardado */
  setInterval(function () {
    if (!S) return; // el juego aún no ha empezado
    var now = Date.now();
    C.tick(S, now);
    syncHUD();
    // refrescar modal de personaje abierto (timers)
    if ($('charOv').classList.contains('open')) openChars();
  }, 1000);

  setInterval(function () {
    if (!S) return;
    C.save(S, localStorage);
  }, 5000);
  window.addEventListener('beforeunload', function () { if (S) C.save(S, localStorage); });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && S) C.save(S, localStorage);
  });

  /* ---------------------------------------------------------------- inicio */
  function start() {
    var loaded = C.load(null, Date.now(), localStorage);
    S = loaded.state;
    ensureWander();
    fitView();
    syncHUD();
    if (loaded.offlineCoins > 0) {
      setTimeout(function () {
        toast('🌙 Mientras dormías: <b style="color:#ffd166">+' + fmt(loaded.offlineCoins) + ' 🪙</b> te esperan', 'good');
      }, 900);
    }
    var intro = $('intro');
    intro.style.opacity = '0';
    setTimeout(function () { intro.style.display = 'none'; }, 500);
    requestAnimationFrame(loop);
  }
  $('startBtn').onclick = function () { blip(660, 0.1); start(); };

  // API de test (usada por la verificación con Playwright)
  window.PL = {
    get state() { return S; },
    core: C,
    start: start,
    grant: function (coins, donas) { S.coins += coins; S.donas += donas; syncHUD(); },
    place: function (def, x, y) { return C.placeBuilding(S, def, x, y, Date.now()); },
    tick: function (sec) { return C.tick(S, Date.now() + sec * 1000); },
    collectAll: function () { return C.collectAll(S, Date.now()); },
    openShop: openShop, openChars: openChars, openQuests: openQuests
  };
})();
