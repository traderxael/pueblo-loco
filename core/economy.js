/*
 * Pueblo Loco — Núcleo de reglas del juego (SIN DOM, sin dependencias).
 * UMD: funciona como global en el browser (window.PuebloCore) y en Node (require).
 *
 * Este archivo es la ÚNICA fuente de verdad de economía, progresión y misiones.
 * La capa de render (game.js) y los tests (tools/test-core.mjs) derivan de aquí.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PuebloCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = 1;
  var SAVE_KEY = 'puebloloco.save.v1';
  var OFFLINE_CAP_MS = 8 * 60 * 60 * 1000; // 8h de acumulación offline máxima
  var RUSH_WINDOW_SEC = 600; // 1 dona cada ~10 min restantes

  /* ---------------------------------------------------------------- catálogo */

  // Edificios: producen monedas por ciclos. size en tiles.
  var BUILDINGS = [
    { def: 'casa',       name: 'Casa de Luis',       cost: 0,      size: 1, interval: 30,  coins: 8,    xp: 10,  level: 1,  color: '#f5c96b', roof: '#c0392b', kind: 'house'   },
    { def: 'kiosco',     name: 'Kiosco de Diarios',  cost: 150,    size: 1, interval: 45,  coins: 16,   xp: 20,  level: 1,  color: '#7ec8e3', roof: '#2980b9', kind: 'kiosk'    },
    { def: 'floreria',   name: 'Florería',           cost: 1200,   size: 1, interval: 90,  coins: 34,   xp: 25,  level: 2,  color: '#a8e6a1', roof: '#27ae60', kind: 'shop'     },
    { def: 'panaderia',  name: 'Panadería',          cost: 600,    size: 2, interval: 120, coins: 48,   xp: 35,  level: 2,  color: '#f0b27a', roof: '#d35400', kind: 'shop'     },
    { def: 'taller',     name: 'Taller Mecánico',    cost: 3000,   size: 2, interval: 240, coins: 98,   xp: 50,  level: 3,  color: '#95a5a6', roof: '#5d6d7e', kind: 'garage'   },
    { def: 'cafeteria',  name: 'Cafetería',          cost: 7500,   size: 2, interval: 300, coins: 165,  xp: 65,  level: 4,  color: '#d7bde2', roof: '#7d3c98', kind: 'shop'     },
    { def: 'cine',       name: 'Cine del Barrio',    cost: 18000,  size: 2, interval: 480, coins: 330,  xp: 90,  level: 5,  color: '#f1948a', roof: '#943126', kind: 'cinema'   },
    { def: 'escuela',    name: 'Escuela',            cost: 35000,  size: 2, interval: 600, coins: 520,  xp: 120, level: 6,  color: '#f9e79f', roof: '#b7950b', kind: 'school'   },
    { def: 'hospital',   name: 'Hospital',           cost: 80000,  size: 3, interval: 720, coins: 960,  xp: 180, level: 8,  color: '#ffffff', roof: '#c0392b', kind: 'hospital' },
    { def: 'comisaria',  name: 'Comisaría',          cost: 150000, size: 2, interval: 900, coins: 1500, xp: 250, level: 10, color: '#aed6f1', roof: '#1a5276', kind: 'office'   },
    { def: 'estadio',    name: 'Estadio',            cost: 400000, size: 3, interval: 1200,coins: 3200, xp: 400, level: 12, color: '#abebc6', roof: '#148f77', kind: 'stadium'  },
    { def: 'torre',      name: 'Torre de Oficinas',  cost: 900000, size: 2, interval: 1800,coins: 6000, xp: 600, level: 14, color: '#d5dbdb', roof: '#2e4053', kind: 'tower'    }
  ];

  // Personajes: se desbloquean con donas; cada uno tiene tareas temporizadas.
  var CHARACTERS = [
    { def: 'luis',    name: 'Luis',       donas: 0,  color: '#3498db', hair: '#5d4037', tasks: [
      { id: 'regar',    name: 'Regar las plantas',    sec: 300,   coins: 60,   xp: 20  },
      { id: 'pintar',   name: 'Pintar la reja',       sec: 1800,  coins: 400,  xp: 90  },
      { id: 'siesta',   name: 'Dormir una siesta',    sec: 14400, coins: 1800, xp: 400 }
    ]},
    { def: 'nina',    name: 'Nina',       donas: 0,  color: '#e91e63', hair: '#f9e79f', tasks: [
      { id: 'tarea',    name: 'Hacer la tarea',       sec: 1200,  coins: 150,  xp: 50  },
      { id: 'jugar',    name: 'Jugar en la plaza',    sec: 600,   coins: 90,   xp: 30  }
    ]},
    { def: 'carmen',  name: 'Carmen',     donas: 10, color: '#e67e22', hair: '#212121', tasks: [
      { id: 'hornear',  name: 'Hornear pan',          sec: 900,   coins: 180,  xp: 45  },
      { id: 'entregar', name: 'Entregar pedidos',     sec: 3600,  coins: 800,  xp: 160 }
    ]},
    { def: 'bruno',   name: 'Bruno',      donas: 10, color: '#8d6e63', hair: '#8d6e63', tasks: [
      { id: 'cartero',  name: 'Perseguir al cartero', sec: 300,   coins: 70,   xp: 25  },
      { id: 'excavar',  name: 'Excavar el jardín',    sec: 1500,  coins: 300,  xp: 80  }
    ]},
    { def: 'ramon',   name: 'Don Ramón',  donas: 15, color: '#607d8b', hair: '#9e9e9e', tasks: [
      { id: 'aceite',   name: 'Cambiar aceite',       sec: 1800,  coins: 500,  xp: 100 },
      { id: 'motor',    name: 'Reparar motor',        sec: 7200,  coins: 2200, xp: 380 }
    ]},
    { def: 'ana',     name: 'Profe Ana',  donas: 20, color: '#9b59b6', hair: '#4e342e', tasks: [
      { id: 'corregir', name: 'Corregir exámenes',    sec: 3600,  coins: 700,  xp: 150 },
      { id: 'clase',    name: 'Preparar la clase',    sec: 2700,  coins: 450,  xp: 110 }
    ]},
    { def: 'sol',     name: 'Dra. Sol',   donas: 30, color: '#00acc1', hair: '#263238', tasks: [
      { id: 'guardia',  name: 'Turno de guardia',     sec: 7200,  coins: 2000, xp: 350 },
      { id: 'cirugia',  name: 'Cirugía',              sec: 28800, coins: 8000, xp: 900 }
    ]},
    { def: 'alcalde', name: 'Alcalde Vera', donas: 50, color: '#c0392b', hair: '#bdc3c7', tasks: [
      { id: 'discurso', name: 'Discurso en la plaza', sec: 10800, coins: 3500, xp: 500 },
      { id: 'parque',   name: 'Inaugurar el parque',  sec: 43200, coins: 12000,xp: 1200 }
    ]}
  ];

  // Decoración: cosmética + alimenta misiones. Se coloca automática en tile libre.
  var DECOR = [
    { def: 'farol',    name: 'Farol',      cost: 250,   level: 2,  color: '#f4d03f' },
    { def: 'arbusto',  name: 'Arbusto',    cost: 400,   level: 2,  color: '#52be80' },
    { def: 'banco',    name: 'Banco',      cost: 800,   level: 3,  color: '#a04000' },
    { def: 'fuente',   name: 'Fuente',     cost: 3000,  level: 4,  color: '#5dade2' },
    { def: 'estatua',  name: 'Estatua',    cost: 12000, level: 6,  color: '#b2babb' }
  ];

  // Terreno: parcelas que se compran para crecer.
  var LAND_TIERS = [
    { size: 6,  cost: 0      },
    { size: 8,  cost: 2000   },
    { size: 10, cost: 25000  },
    { size: 12, cost: 300000 }
  ];

  // Misiones encadenadas. Objetivos evaluados contra el estado.
  var QUESTS = [
    { id: 'q1',  name: '¡Bienvenido a Pueblo Loco!',  story: 'Construye tu primera casa junto al kiosco.',            objs: [{ type: 'build', def: 'casa' }],                                  reward: { donas: 10, xp: 50 } },
    { id: 'q2',  name: 'El barrio despierta',         story: 'Recolecta 60 monedas de tus edificios.',                objs: [{ type: 'coinsEarned', amount: 60 }],                           reward: { donas: 15, xp: 120 } },
    { id: 'q3',  name: 'Pan fresco cada mañana',      story: 'Levanta la panadería del barrio.',                      objs: [{ type: 'build', def: 'panaderia' }],                            reward: { donas: 20, xp: 150 } },
    { id: 'q4',  name: 'Conoce a Carmen',             story: 'Desbloquea a Carmen con donas.',                        objs: [{ type: 'unlock', def: 'carmen' }],                              reward: { donas: 25, xp: 180 } },
    { id: 'q5',  name: 'Manos a la obra',             story: 'Abre el taller mecánico y llega a nivel 4.',            objs: [{ type: 'build', def: 'taller' }, { type: 'level', level: 4 }],reward: { donas: 30, xp: 220 } },
    { id: 'q6',  name: 'Educación primero',           story: 'Construye la escuela y completa 10 tareas.',            objs: [{ type: 'build', def: 'escuela' }, { type: 'tasksDone', amount: 10 }], reward: { donas: 40, xp: 300 } },
    { id: 'q7',  name: 'Salud para todos',            story: 'El barrio necesita un hospital.',                       objs: [{ type: 'build', def: 'hospital' }],                             reward: { donas: 50, xp: 400 } },
    { id: 'q8',  name: 'Zona comercial',              story: 'Ten 5 edificios productivos en pie.',                   objs: [{ type: 'buildings', amount: 5 }],                               reward: { donas: 60, xp: 500 } },
    { id: 'q9',  name: 'Torre del progreso',          story: 'Construye la Torre de Oficinas a nivel 10.',            objs: [{ type: 'build', def: 'torre' }, { type: 'level', level: 10 }],reward: { donas: 100, xp: 700 } },
    { id: 'q10', name: 'El corazón del pueblo',       story: 'Decora con 4 adornos y llega a nivel 12.',              objs: [{ type: 'decor', amount: 4 }, { type: 'level', level: 12 }],  reward: { donas: 150, xp: 900 } },
    { id: 'q11', name: '¡Alcalde electo!',            story: 'Desbloquea al Alcalde Vera.',                           objs: [{ type: 'unlock', def: 'alcalde' }],                             reward: { donas: 200, xp: 1100 } },
    { id: 'q12', name: 'Pueblo Loco legendario',      story: 'Alcanza el nivel 15 para consagrar tu barrio.',         objs: [{ type: 'level', level: 15 }],                                   reward: { donas: 500, xp: 1500 } }
  ];

  /* ------------------------------------------------------------- progresión */

  function xpForLevel(level) {
    return Math.round(80 * Math.pow(level, 1.55));
  }

  function buildingDef(def) { return BUILDINGS.find(function (b) { return b.def === def; }); }
  function characterDef(def) { return CHARACTERS.find(function (c) { return c.def === def; }); }
  function decorDef(def) { return DECOR.find(function (d) { return d.def === def; }); }
  function taskDef(charDef, taskId) {
    var c = characterDef(charDef);
    if (!c) return null;
    return c.tasks.find(function (t) { return t.id === taskId; }) || null;
  }
  function landTier(state) { return LAND_TIERS[state.landTier]; }
  function nextLandTier(state) {
    var i = state.landTier + 1;
    return i < LAND_TIERS.length ? LAND_TIERS[i] : null;
  }

  /* ------------------------------------------------------------ estado base */

  function createState() {
    return {
      v: VERSION,
      coins: 500,
      donas: 30,
      xp: 0,
      level: 1,
      landTier: 0,
      buildings: [],   // {id, def, x, y, lastAt, ready}
      decor: [],       // {id, def, x, y}
      characters: CHARACTERS.map(function (c) {
        return { def: c.def, unlocked: c.donas === 0, task: null };
      }),
      questIndex: 0,
      stats: { coinsEarned: 0, tasksDone: 0, buildingsBuilt: 0 },
      lastSeen: Date.now()
    };
  }

  // Coloca el kiosco inicial para que el pueblo no nazca vacío.
  function seedStarter(state, now) {
    var mid = Math.floor(landTier(state).size / 2);
    var b = { id: nextId(), def: 'kiosco', x: mid - 1, y: mid, lastAt: now, ready: 0 };
    state.buildings.push(b);
    state.stats.buildingsBuilt++;
    return b;
  }

  var _idCounter = 1;
  function nextId() { return 'e' + (_idCounter++) + '_' + Math.floor(Math.random() * 1e6); }

  /* ------------------------------------------------------------- utilidades */

  function occupancyMap(state) {
    var map = {};
    state.buildings.forEach(function (b) {
      var def = buildingDef(b.def);
      for (var dx = 0; dx < def.size; dx++)
        for (var dy = 0; dy < def.size; dy++)
          map[(b.x + dx) + ',' + (b.y + dy)] = b;
    });
    state.decor.forEach(function (d) { map[d.x + ',' + d.y] = d; });
    return map;
  }

  function canPlaceBuilding(state, def, x, y) {
    var d = buildingDef(def);
    if (!d) return { ok: false, reason: 'Edificio desconocido' };
    if (state.level < d.level) return { ok: false, reason: 'Requiere nivel ' + d.level };
    if (state.coins < d.cost) return { ok: false, reason: 'Monedas insuficientes' };
    var size = landTier(state).size;
    if (x < 0 || y < 0 || x + d.size > size || y + d.size > size)
      return { ok: false, reason: 'Fuera del terreno' };
    var occ = occupancyMap(state);
    for (var dx = 0; dx < d.size; dx++)
      for (var dy = 0; dy < d.size; dy++)
        if (occ[(x + dx) + ',' + (y + dy)]) return { ok: false, reason: 'Espacio ocupado' };
    return { ok: true };
  }

  function freeTile(state) {
    var size = landTier(state).size;
    var occ = occupancyMap(state);
    for (var tries = 0; tries < 500; tries++) {
      var x = Math.floor(Math.random() * size);
      var y = Math.floor(Math.random() * size);
      if (!occ[x + ',' + y] && x > 0 && y > 0) return { x: x, y: y };
    }
    for (var x2 = 1; x2 < size - 1; x2++)
      for (var y2 = 1; y2 < size - 1; y2++)
        if (!occ[x2 + ',' + y2]) return { x: x2, y: y2 };
    return null;
  }

  /* ------------------------------------------------------------- acciones */

  function addXp(state, amount) {
    if (amount <= 0) return 0;
    state.xp += amount;
    var gained = 0;
    while (state.xp >= xpForLevel(state.level)) {
      state.xp -= xpForLevel(state.level);
      state.level++;
      gained++;
    }
    return gained;
  }

  function placeBuilding(state, defId, x, y, now) {
    var check = canPlaceBuilding(state, defId, x, y);
    if (!check.ok) return check;
    var d = buildingDef(defId);
    state.coins -= d.cost;
    state.buildings.push({ id: nextId(), def: defId, x: x, y: y, lastAt: now, ready: 0 });
    state.stats.buildingsBuilt++;
    addXp(state, d.xp);
    var events = evaluateQuests(state, now);
    return { ok: true, events: events };
  }

  function unlockCharacter(state, defId, now) {
    var c = characterDef(defId);
    if (!c) return { ok: false, reason: 'Personaje desconocido' };
    var entry = state.characters.find(function (ch) { return ch.def === defId; });
    if (entry.unlocked) return { ok: false, reason: 'Ya está desbloqueado' };
    if (state.donas < c.donas) return { ok: false, reason: 'Donas insuficientes' };
    state.donas -= c.donas;
    entry.unlocked = true;
    var events = evaluateQuests(state, now);
    return { ok: true, events: events };
  }

  function buyDecor(state, defId, now) {
    var d = decorDef(defId);
    if (!d) return { ok: false, reason: 'Adorno desconocido' };
    if (state.level < d.level) return { ok: false, reason: 'Requiere nivel ' + d.level };
    if (state.coins < d.cost) return { ok: false, reason: 'Monedas insuficientes' };
    var tile = freeTile(state);
    if (!tile) return { ok: false, reason: 'No hay espacio libre' };
    state.coins -= d.cost;
    state.decor.push({ id: nextId(), def: defId, x: tile.x, y: tile.y });
    var events = evaluateQuests(state, now);
    return { ok: true, events: events };
  }

  function expandLand(state, now) {
    var next = nextLandTier(state);
    if (!next) return { ok: false, reason: 'Terreno máximo alcanzado' };
    if (state.coins < next.cost) return { ok: false, reason: 'Monedas insuficientes' };
    state.coins -= next.cost;
    state.landTier++;
    var events = evaluateQuests(state, now);
    return { ok: true, events: events, size: landTier(state).size };
  }

  // Vender un edificio: reembolso del 50%. Necesario para reorganizar el
  // terreno cuando una misión pide un edificio grande y la cuadrícula está llena.
  function sellBuilding(state, buildingId, now) {
    var b = state.buildings.find(function (x) { return x.id === buildingId; });
    if (!b) return { ok: false, reason: 'Edificio no encontrado' };
    var def = buildingDef(b.def);
    var refund = Math.floor(def.cost * 0.5);
    state.coins += refund;
    state.buildings = state.buildings.filter(function (x) { return x.id !== buildingId; });
    var events = evaluateQuests(state, now);
    return { ok: true, refund: refund, events: events };
  }

  function sellDecor(state, decorId, now) {
    var d = state.decor.find(function (x) { return x.id === decorId; });
    if (!d) return { ok: false, reason: 'Adorno no encontrado' };
    var def = decorDef(d.def);
    var refund = Math.floor(def.cost * 0.5);
    state.coins += refund;
    state.decor = state.decor.filter(function (x) { return x.id !== decorId; });
    var events = evaluateQuests(state, now);
    return { ok: true, refund: refund, events: events };
  }

  function accrueBuilding(b, now) {
    var def = buildingDef(b.def);
    if (!def) return;
    var elapsed = now - b.lastAt;
    var step = def.interval * 1000;
    if (elapsed < step) return;
    var cycles = Math.floor(elapsed / step);
    var cap = Math.max(1, Math.floor(OFFLINE_CAP_MS / step));
    if (cycles > cap) cycles = cap;
    b.ready += cycles * def.coins;
    b.lastAt += cycles * step;
  }

  function collectBuilding(state, buildingId, now) {
    var b = state.buildings.find(function (x) { return x.id === buildingId; });
    if (!b) return { ok: false, reason: 'Edificio no encontrado' };
    accrueBuilding(b, now);
    if (b.ready <= 0) return { ok: false, reason: 'Nada que recolectar' };
    var amount = b.ready;
    state.coins += amount;
    state.stats.coinsEarned += amount;
    b.ready = 0;
    b.lastAt = now;
    var events = evaluateQuests(state, now);
    return { ok: true, amount: amount, events: events };
  }

  function collectAll(state, now) {
    var total = 0;
    state.buildings.forEach(function (b) {
      accrueBuilding(b, now);
      total += b.ready;
      b.ready = 0;
      b.lastAt = now;
    });
    if (total <= 0) return { ok: false, reason: 'Nada que recolectar' };
    state.coins += total;
    state.stats.coinsEarned += total;
    var events = evaluateQuests(state, now);
    return { ok: true, amount: total, events: events };
  }

  function startTask(state, charDefId, taskId, now) {
    var entry = state.characters.find(function (c) { return c.def === charDefId; });
    if (!entry || !entry.unlocked) return { ok: false, reason: 'Personaje no disponible' };
    if (entry.task) return { ok: false, reason: entry.task.done ? 'Reclama la recompensa primero' : 'Ya tiene una tarea en curso' };
    var t = taskDef(charDefId, taskId);
    if (!t) return { ok: false, reason: 'Tarea desconocida' };
    entry.task = { taskId: taskId, endAt: now + t.sec * 1000, done: false };
    return { ok: true, endAt: entry.task.endAt };
  }

  function completeTask(state, charDefId, now) {
    var entry = state.characters.find(function (c) { return c.def === charDefId; });
    if (!entry || !entry.task) return { ok: false, reason: 'Sin tarea' };
    if (!entry.task.done && now < entry.task.endAt)
      return { ok: false, reason: 'La tarea aún no termina' };
    var t = taskDef(charDefId, entry.task.taskId);
    state.coins += t.coins;
    state.stats.coinsEarned += t.coins;
    state.stats.tasksDone++;
    var gained = addXp(state, t.xp);
    entry.task = null;
    var events = evaluateQuests(state, now);
    return { ok: true, coins: t.coins, xp: t.xp, levels: gained, events: events };
  }

  function rushCost(state, charDefId, now) {
    var entry = state.characters.find(function (c) { return c.def === charDefId; });
    if (!entry || !entry.task) return 0;
    var remain = Math.max(0, entry.task.endAt - now);
    return Math.max(1, Math.ceil(remain / (RUSH_WINDOW_SEC * 1000)));
  }

  function rushTask(state, charDefId, now) {
    var cost = rushCost(state, charDefId, now);
    if (state.donas < cost) return { ok: false, reason: 'Donas insuficientes' };
    state.donas -= cost;
    var entry = state.characters.find(function (c) { return c.def === charDefId; });
    entry.task.done = true;
    entry.task.endAt = now;
    return completeTask(state, charDefId, now);
  }

  /* ---------------------------------------------------------------- tiempo */

  // Avanza producción y tareas. Devuelve resumen de lo que cambió.
  function tick(state, now) {
    var out = { coinsAccrued: 0, tasksReady: 0, levels: 0 };
    state.buildings.forEach(function (b) {
      var before = b.ready;
      accrueBuilding(b, now);
      out.coinsAccrued += b.ready - before;
    });
    state.characters.forEach(function (c) {
      if (c.task && !c.task.done && now >= c.task.endAt) {
        c.task.done = true;
        out.tasksReady++;
      }
    });
    var events = evaluateQuests(state, now);
    out.events = events;
    return out;
  }

  // Carga una partida: aplica progreso offline (limitado) y reevalúa misiones.
  // Si el JSON viene vacío, corrupto o de otra versión, arranca partida nueva.
  function load(json, now, storage) {
    now = now || Date.now();
    if (!json && storage && storage.getItem) json = storage.getItem(SAVE_KEY);
    var state = null;
    if (json) {
      try { state = JSON.parse(json); } catch (e) { state = null; }
    }
    if (!state || state.v !== VERSION) {
      var fresh = createState();
      seedStarter(fresh, now);
      var ev = evaluateQuests(fresh, now);
      return { state: fresh, offlineCoins: 0, events: ev, fresh: true };
    }
    return loadState(json, now);
  }

  // Carga una partida guardada: aplica progreso offline (limitado) y reevalúa misiones.
  function loadState(raw, now) {
    var state = typeof raw === 'string' ? JSON.parse(raw) : JSON.parse(JSON.stringify(raw));
    if (!state || state.v !== VERSION) state = createState();
    var elapsed = Math.max(0, Math.min(now - (state.lastSeen || now), 7 * 24 * 3600 * 1000));
    state.lastSeen = now;
    // Progreso offline: recolectar todo lo listo para que el jugador lo reclame.
    var offlineCoins = 0;
    state.buildings.forEach(function (b) {
      var def = buildingDef(b.def);
      if (!def) return;
      var step = def.interval * 1000;
      var cycles = Math.floor(Math.min(elapsed, OFFLINE_CAP_MS) / step);
      b.ready += cycles * def.coins;
      b.lastAt = now;
      offlineCoins += cycles * def.coins;
    });
    state.characters.forEach(function (c) {
      if (c.task && !c.task.done && now >= c.task.endAt) c.task.done = true;
    });
    var events = evaluateQuests(state, now);
    return { state: state, offlineCoins: offlineCoins, events: events };
  }

  /* -------------------------------------------------------------- misiones */

  function activeQuest(state) {
    return state.questIndex < QUESTS.length ? QUESTS[state.questIndex] : null;
  }

  function objectiveDone(state, o) {
    switch (o.type) {
      case 'build':      return state.buildings.some(function (b) { return b.def === o.def; });
      case 'unlock':     return state.characters.some(function (c) { return c.def === o.def && c.unlocked; });
      case 'level':      return state.level >= o.level;
      case 'coinsEarned':return state.stats.coinsEarned >= o.amount;
      case 'tasksDone':  return state.stats.tasksDone >= o.amount;
      case 'buildings':  return state.buildings.length >= o.amount;
      case 'decor':      return state.decor.length >= o.amount;
      default:           return false;
    }
  }

  function questProgress(state) {
    var q = activeQuest(state);
    if (!q) return null;
    return {
      quest: q,
      objs: q.objs.map(function (o) { return { obj: o, done: objectiveDone(state, o) }; }),
      complete: q.objs.every(function (o) { return objectiveDone(state, o); })
    };
  }

  // Evalúa y completa misiones encadenadas. Devuelve eventos para la UI.
  function evaluateQuests(state, now) {
    var events = [];
    var guard = 0;
    while (guard++ < 50) {
      var q = activeQuest(state);
      if (!q) break;
      if (!q.objs.every(function (o) { return objectiveDone(state, o); })) break;
      var r = q.reward || {};
      if (r.coins) { state.coins += r.coins; state.stats.coinsEarned += r.coins; }
      if (r.donas) state.donas += r.donas;
      if (r.xp) addXp(state, r.xp);
      state.questIndex++;
      events.push({ type: 'quest', quest: q, reward: r });
    }
    return events;
  }

  /* ------------------------------------------------------------------ I/O */

  function save(state, storage) {
    state.lastSeen = Date.now();
    var json = JSON.stringify(state);
    if (storage && storage.setItem) storage.setItem(SAVE_KEY, json);
    return json;
  }

  return {
    VERSION: VERSION, SAVE_KEY: SAVE_KEY, OFFLINE_CAP_MS: OFFLINE_CAP_MS,
    BUILDINGS: BUILDINGS, CHARACTERS: CHARACTERS, DECOR: DECOR,
    QUESTS: QUESTS, LAND_TIERS: LAND_TIERS,
    xpForLevel: xpForLevel,
    buildingDef: buildingDef, characterDef: characterDef, decorDef: decorDef,
    taskDef: taskDef, landTier: landTier, nextLandTier: nextLandTier,
    createState: createState, seedStarter: seedStarter,
    occupancyMap: occupancyMap, canPlaceBuilding: canPlaceBuilding, freeTile: freeTile,
    addXp: addXp,
    placeBuilding: placeBuilding, unlockCharacter: unlockCharacter, buyDecor: buyDecor,
    expandLand: expandLand, sellBuilding: sellBuilding, sellDecor: sellDecor,
    collectBuilding: collectBuilding, collectAll: collectAll,
    startTask: startTask, completeTask: completeTask, rushTask: rushTask, rushCost: rushCost,
    tick: tick, loadState: loadState,
    activeQuest: activeQuest, questProgress: questProgress, objectiveDone: objectiveDone,
    evaluateQuests: evaluateQuests,
    save: save, load: load
  };
});
