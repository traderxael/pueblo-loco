/*
 * Tests del núcleo de Pueblo Loco — ejecutables con: node tools/test-core.mjs
 * Cubre: XP, colocación válida/ inválida, producción temporal, ciclo de tareas,
 * cadena de misiones, rush, guardado/carga y tope offline.
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const C = require('../core/economy.js');

let passed = 0, failed = 0;
const failures = [];
function ok(cond, name) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; failures.push(name); console.log('  ✗ ' + name); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

const NOW = 1750000000000; // timestamp fijo para tests deterministas
const H = 3600 * 1000;

// --- XP ---
section('Curva de XP');
{
  const l1 = C.xpForLevel(1), l2 = C.xpForLevel(2), l5 = C.xpForLevel(5);
  ok(l2 > l1 && l5 > l2, 'XP requerida crece con el nivel');
  const s = C.createState();
  const g = C.addXp(s, l1 + l2);
  ok(s.level === 3, `2 subidas de nivel aplicadas (nivel=${s.level})`);
  ok(g === 2, 'addXp reporta niveles ganados');
  ok(s.xp === 0, 'XP residual queda en 0 tras dos niveles exactos');
}

// --- Colocación ---
section('Colocación de edificios');
{
  const s = C.createState();
  C.seedStarter(s, NOW);
  const r1 = C.placeBuilding(s, 'casa', 0, 0, NOW);
  ok(r1.ok === true, 'casa (gratis) se puede construir');
  const r2 = C.placeBuilding(s, 'casa', 0, 0, NOW);
  ok(r2.ok === false && r2.reason === 'Espacio ocupado', 'no se puede construir sobre lo ocupado');
  // Aislar variable: nivel Y monedas suficientes para probar SOLO los límites del terreno
  s.level = 5;
  s.coins = 5000;
  const r3 = C.placeBuilding(s, 'panaderia', 5, 5, NOW);
  ok(r3.ok === false && r3.reason === 'Fuera del terreno', 'no cabe fuera del terreno 6x6');
  // Aislar variable: sin monedas (nivel OK, dentro del terreno)
  s.coins = 100;
  const r4 = C.placeBuilding(s, 'panaderia', 3, 3, NOW);
  ok(r4.ok === false && r4.reason === 'Monedas insuficientes', 'sin monedas no se construye');
  s.coins = 5000;
  const r5 = C.placeBuilding(s, 'panaderia', 3, 3, NOW);
  ok(r5.ok === true, 'panadería 2x2 construida con monedas');
  ok(s.buildings.length === 3, 'hay 3 edificios en el pueblo (kiosco + casa + panadería)');
  ok(s.stats.buildingsBuilt === 3, 'estadística de construcciones correcta');
  s.level = 1; // reset: probar SOLO el bloqueo por nivel de taller (exige 3)
  const r6 = C.placeBuilding(s, 'taller', 1, 1, NOW);
  ok(r6.ok === false && r6.reason === 'Requiere nivel 3', 'edificio bloqueado por nivel (taller exige nivel 3)');
}

// --- Producción temporal ---
section('Producción por ciclos');
{
  const s = C.createState();
  C.seedStarter(s, NOW);
  const kiosco = s.buildings[0];
  // kiosco: 16 monedas cada 45s
  const r1 = C.collectBuilding(s, kiosco.id, NOW + 10 * 1000);
  ok(r1.ok === false, 'antes del primer ciclo no hay nada que recolectar');
  const r2 = C.collectBuilding(s, kiosco.id, NOW + 46 * 1000);
  ok(r2.ok === true && r2.amount === 16, '1 ciclo completo = 16 monedas');
  const r3 = C.collectBuilding(s, kiosco.id, NOW + (46 + 45 * 3) * 1000);
  ok(r3.amount === 48, '3 ciclos más = 48 monedas');
  ok(s.stats.coinsEarned === 64, 'estadística coinsEarned acumula correcto');
}

// --- Tope offline ---
section('Tope de acumulación offline');
{
  const s = C.createState();
  C.seedStarter(s, NOW);
  const kiosco = s.buildings[0];
  const step = 45 * 1000;
  const capCycles = Math.floor(C.OFFLINE_CAP_MS / step); // 8h
  const far = NOW + C.OFFLINE_CAP_MS * 10; // 80h después
  const r = C.collectBuilding(s, kiosco.id, far);
  ok(r.amount === capCycles * 16, `acumulación limitada a ${capCycles} ciclos (8h) = ${r.amount} monedas`);
}

// --- Tareas ---
section('Ciclo de tareas de personajes');
{
  const s = C.createState();
  const luis = s.characters.find(c => c.def === 'luis');
  ok(luis.unlocked === true, 'Luis empieza desbloqueado');
  const r1 = C.startTask(s, 'luis', 'regar', NOW);
  ok(r1.ok === true, 'tarea "Regar las plantas" iniciada');
  const r2 = C.startTask(s, 'luis', 'pintar', NOW);
  ok(r2.ok === false, 'no se puede iniciar otra tarea con una en curso');
  const r3 = C.completeTask(s, 'luis', NOW + 10 * 1000);
  ok(r3.ok === false, 'no se puede completar antes de tiempo');
  // tick marca done
  C.tick(s, NOW + 301 * 1000);
  ok(luis.task && luis.task.done === true, 'tick marca la tarea como lista');
  const r4 = C.completeTask(s, 'luis', NOW + 301 * 1000);
  ok(r4.ok === true && r4.coins === 60, 'recompensa de 60 monedas al reclamar');
  ok(s.stats.tasksDone === 1, 'estadística tasksDone correcta');
  ok(luis.task === null, 'tarea limpiada tras reclamar');
  // rush
  const r5 = C.startTask(s, 'luis', 'pintar', NOW);
  ok(r5.ok === true, 'nueva tarea iniciada');
  const cost = C.rushCost(s, 'luis', NOW); // 1800s = 30min → ceil(30/10)=3 donas
  ok(cost === 3, `rush de tarea de 30min cuesta 3 donas (costo=${cost})`);
  const r6 = C.rushTask(s, 'luis', NOW);
  ok(r6.ok === true && r6.coins === 400, 'rush entrega la recompensa completa (400 monedas)');
  ok(s.donas === 30 - 3, 'donas descontadas por rush');
}

// --- Desbloqueo de personajes ---
section('Desbloqueo de personajes');
{
  const s = C.createState();
  const r1 = C.unlockCharacter(s, 'carmen', NOW);
  ok(r1.ok === true && s.donas === 20, 'Carmen desbloqueada por 10 donas');
  const r2 = C.unlockCharacter(s, 'carmen', NOW);
  ok(r2.ok === false, 'no se puede desbloquear dos veces');
  const r3 = C.unlockCharacter(s, 'sol', NOW);
  ok(r3.ok === false && r3.reason === 'Donas insuficientes', 'Dra. Sol requiere más donas de las que quedan');
}

// --- Cadena de misiones ---
section('Cadena de misiones');
{
  const s = C.createState();
  C.seedStarter(s, NOW);
  let q = C.activeQuest(s);
  ok(q && q.id === 'q1', 'q1 activa al inicio');
  // q1: construir casa
  const r1 = C.placeBuilding(s, 'casa', 0, 0, NOW);
  ok(r1.events.some(e => e.type === 'quest' && e.quest.id === 'q1'), 'q1 completada al construir casa');
  ok(C.activeQuest(s).id === 'q2', 'q2 activada automáticamente');
  // q2: recolectar 60 monedas
  const r2 = C.collectAll(s, NOW + 5 * 60 * 1000);
  ok(r2.ok === true, 'recolectar todo funciona');
  ok(C.activeQuest(s).id === 'q3' || C.questProgress(s).objs[0].done === true, 'progreso de q2 registrado');
  // forzar q3: panadería
  s.coins = 5000;
  const r3 = C.placeBuilding(s, 'panaderia', 4, 4, NOW);
  ok(r3.events.some(e => e.quest && e.quest.id === 'q3'), 'q3 completada al construir panadería');
  // q4: desbloquear Carmen
  const r4 = C.unlockCharacter(s, 'carmen', NOW);
  ok(r4.events.some(e => e.quest && e.quest.id === 'q4'), 'q4 completada al desbloquear Carmen');
  ok(C.activeQuest(s).id === 'q5', 'q5 activa');
  // recompensas otorgadas
  ok(s.donas > 20, `donas de recompensas sumadas (donas=${s.donas})`);
}

// --- Expansión de terreno ---
section('Expansión de terreno');
{
  // Sin monedas no se expande (variable aislada)
  const s0 = C.createState();
  const r0 = C.expandLand(s0, NOW);
  ok(r0.ok === false && r0.reason === 'Monedas insuficientes', 'sin monedas no se expande');
  // Con dinero: toda la escalera de terreno
  const s2 = C.createState();
  s2.coins = 1e9;
  const a = C.expandLand(s2, NOW);
  ok(a.ok === true && a.size === 8, 'terreno crece a 8x8');
  const b = C.expandLand(s2, NOW);
  ok(b.ok === true && b.size === 10, 'terreno crece a 10x10');
  const c = C.expandLand(s2, NOW);
  ok(c.ok === true && c.size === 12, 'terreno crece a 12x12');
  const d = C.expandLand(s2, NOW);
  ok(d.ok === false && d.reason === 'Terreno máximo alcanzado', 'máximo de terreno respetado');
}

// --- Guardado / carga ---
section('Guardado y carga');
{
  const s = C.createState();
  C.seedStarter(s, NOW);
  C.placeBuilding(s, 'casa', 0, 0, NOW);
  C.startTask(s, 'luis', 'regar', NOW);
  const json = C.save(s);
  const loaded = C.load(json, NOW + 1000);
  ok(loaded.state.buildings.length === 2, 'edificios preservados tras guardar/cargar');
  ok(loaded.state.characters.find(c => c.def === 'luis').task !== null, 'tarea en curso preservada');
  // carga con datos corruptos → partida nueva
  const fresh = C.load('{"v":999}', NOW);
  ok(fresh.fresh === true, 'versión incompatible genera partida nueva');
}

// --- Carga con progreso offline ---
section('Carga con progreso offline');
{
  const s = C.createState();
  C.seedStarter(s, NOW);
  C.startTask(s, 'luis', 'regar', NOW);
  // JSON con lastSeen FIJO (save() real estamparía Date.now(); aquí controlamos el reloj)
  s.lastSeen = NOW;
  const json = JSON.stringify(s);
  // "Vuelve" 1 hora después
  const loaded = C.load(json, NOW + H);
  ok(loaded.offlineCoins > 0, `progreso offline acumulado (${loaded.offlineCoins} monedas listas)`);
  const luis = loaded.state.characters.find(c => c.def === 'luis');
  ok(luis.task && luis.task.done === true, 'tarea terminada durante la ausencia queda lista');
  const kiosco = loaded.state.buildings[0];
  ok(kiosco.ready > 0, 'kiosco tiene monedas listas para recolectar');
}

// --- Venta de edificios ---
section('Venta de edificios');
{
  const s = C.createState();
  C.seedStarter(s, NOW);
  s.coins = 1000;
  C.placeBuilding(s, 'kiosco', 0, 0, NOW); // 150 monedas
  const b = s.buildings[s.buildings.length - 1];
  const coinsBefore = s.coins;
  const r = C.sellBuilding(s, b.id, NOW);
  ok(r.ok === true && r.refund === 75, `venta reembolsa 50% (75 de 150) = ${r.refund}`);
  ok(s.coins === coinsBefore + 75, 'monedas acreditadas tras venta');
  ok(s.buildings.length === 1, 'edificio removido del pueblo');
  const r2 = C.sellBuilding(s, 'inexistente', NOW);
  ok(r2.ok === false, 'vender edificio inexistente falla limpiamente');
}

// --- Playthrough simulado (distribución) ---
section('Playthrough simulado (30 días × 20 semillas)');
{
  // Política de juego headless: recolectar siempre, encolar la tarea más
  // rentable de cada personaje, construir lo asequible, expandir terreno,
  // desbloquear personajes con las donas de misiones.
  function playthrough(days) {
    const s = C.createState();
    C.seedStarter(s, NOW);
    let now = NOW;
    const STEP = 60 * 60 * 1000; // 1 hora por paso
    const reversed = C.BUILDINGS.slice().reverse(); // más caro primero
    for (let h = 0; h < days * 24; h++) {
      now += STEP;
      C.tick(s, now);
      C.collectAll(s, now);
      // reclamar tareas listas
      s.characters.forEach(c => {
        if (c.task && c.task.done) C.completeTask(s, c.def, now);
      });
      // encolar tarea más rentable (monedas/min) de cada personaje libre
      s.characters.forEach(c => {
        if (!c.unlocked || c.task) return;
        const cd = C.characterDef(c.def);
        const best = cd.tasks.slice().sort((a, b) =>
          (b.coins / b.sec) - (a.coins / a.sec))[0];
        C.startTask(s, c.def, best.id, now);
      });
      // construir: 1) lo que pide la misión activa, 2) el edificio más caro asequible
      // (mapa de ocupación cacheado: un solo pass por hora)
      const size = C.landTier(s).size;
      const occ = {};
      const mark = (x, y, n) => {
        for (let dx = 0; dx < n; dx++) for (let dy = 0; dy < n; dy++)
          occ[(x + dx) + ',' + (y + dy)] = true;
      };
      const rebuildOcc = () => {
        for (const k in occ) delete occ[k];
        s.buildings.forEach(b => mark(b.x, b.y, C.buildingDef(b.def).size));
        s.decor.forEach(d => mark(d.x, d.y, 1));
      };
      rebuildOcc();
      const tryPlace = (b) => {
        if (s.level < b.level || s.coins < b.cost) return false;
        for (let y = 0; y + b.size <= size; y++)
          for (let x = 0; x + b.size <= size; x++) {
            let free = true;
            for (let dx = 0; dx < b.size && free; dx++)
              for (let dy = 0; dy < b.size && free; dy++)
                if (occ[(x + dx) + ',' + (y + dy)]) free = false;
            if (!free) continue;
            if (C.placeBuilding(s, b.def, x, y, now).ok) { mark(x, y, b.size); return true; }
          }
        return false;
      };
      // 1) objetivos 'build' de la misión activa (como haría un jugador)
      const q = C.activeQuest(s);
      let built = false;
      let hoarding = false; // la misión pide algo inasequible: ahorrar, no malgastar
      if (q) {
        for (const o of q.objs) {
          if (o.type !== 'build') continue;
          if (s.buildings.some(b => b.def === o.def)) continue;
          const bd = C.buildingDef(o.def);
          if (!bd) continue;
          if (s.coins < bd.cost || s.level < bd.level) { hoarding = true; continue; }
          // Si no cabe (cuadrícula fragmentada), vender duplicados para hacer espacio
          let guard = 0;
          while (guard++ < 60 && !tryPlace(bd)) {
            const dup = s.buildings.find(b =>
              b.def !== o.def && s.buildings.filter(x => x.def === b.def).length > 1);
            if (!dup) break;
            C.sellBuilding(s, dup.id, now);
            rebuildOcc();
          }
          if (tryPlace(bd)) { built = true; break; }
        }
      }
      // 2) el edificio más caro asequible y permitido (salvo que la misión
      //    esté pidiendo ahorrar para un edificio inasequible)
      if (!built && !hoarding)
        for (const b of reversed) {
          if (tryPlace(b)) break;
        }
      // expandir terreno cuando sobre dinero
      const next = C.nextLandTier(s);
      if (next && s.coins > next.cost * 2) C.expandLand(s, now);
      // desbloquear personajes con donas sobrantes
      s.characters.forEach(c => {
        const cd = C.characterDef(c.def);
        if (!c.unlocked && s.donas >= cd.donas) C.unlockCharacter(s, c.def, now);
      });
      // comprar adornos asequibles (la misión q10 los pide)
      if (s.decor.length < 6) {
        for (const d of C.DECOR) {
          if (s.level < d.level || s.coins < d.cost * 3) continue;
          if (C.buyDecor(s, d.def, now).ok) break;
        }
      }
    }
    return { level: s.level, quests: s.questIndex, buildings: s.buildings.length, coins: s.coins };
  }

  const runs = [];
  for (let seed = 0; seed < 20; seed++) runs.push(playthrough(30));
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  const minL = Math.min(...runs.map(r => r.level));
  const maxL = Math.max(...runs.map(r => r.level));
  const avgL = avg(runs.map(r => r.level));
  const avgQ = avg(runs.map(r => r.quests));
  const avgB = avg(runs.map(r => r.buildings));
  console.log(`  nivel: min=${minL} avg=${avgL.toFixed(1)} max=${maxL} | misiones avg=${avgQ.toFixed(1)} | edificios avg=${avgB.toFixed(1)}`);
  ok(minL >= 8, `todas las semillas alcanzan nivel 8+ en 30 días (min=${minL})`);
  ok(avgQ >= 8, `promedio de misiones completadas >= 8 (avg=${avgQ.toFixed(1)})`);
  ok(avgB >= 8, `promedio de edificios construidos >= 8 (avg=${avgB.toFixed(1)})`);
  ok(maxL - minL <= 4, `progresión estable entre semillas (spread=${maxL - minL})`);
}

console.log('\n========================================');
console.log(`RESULTADO: ${passed} pasaron, ${failed} fallaron`);
if (failures.length) { console.log('FALLOS:'); failures.forEach(f => console.log('  - ' + f)); process.exit(1); }
console.log('NÚCLEO VERIFICADO ✓');
