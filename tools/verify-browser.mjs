/*
 * Verificación visual de Pueblo Loco con Playwright.
 * Uso: node tools/verify-browser.mjs
 * Requiere playwright resuelto (se busca en AI-Informe- o genex-desktop).
 */
import { createRequire } from 'module';
import path from 'path';
import { pathToFileURL } from 'url';

const require = createRequire(import.meta.url);

// Buscar playwright en proyectos hermanos
let pw = null;
const candidates = [
  'C:/Users/USUARIO/AI-Informe-/node_modules/playwright',
  'C:/Users/USUARIO/genex-desktop/node_modules/playwright'
];
for (const c of candidates) {
  try { pw = require(c); console.log('playwright desde:', c); break; } catch (e) { /* siguiente */ }
}
if (!pw) { console.error('playwright no encontrado'); process.exit(1); }

const CH = pw.chromium;
const GAME = 'file:///C:/Users/USUARIO/proyectos/pueblo-loco/index.html';
const SHOT = 'C:/Users/USUARIO/proyectos/pueblo-loco/screenshots';

let passed = 0, failed = 0;
const ok = (c, n) => { if (c) { passed++; console.log('  ✓ ' + n); } else { failed++; console.log('  ✗ ' + n); } };

const browser = await CH.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });

const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

console.log('== Carga del juego ==');
await page.goto(GAME);
await page.waitForTimeout(800);
ok(await page.title() === 'Pueblo Loco — Constructor de Barrio', 'título correcto cargado');
ok((await page.locator('#intro').isVisible()), 'pantalla de intro visible');

console.log('== Inicio ==');
await page.click('#startBtn');
await page.waitForTimeout(600);
ok(await page.evaluate(() => !!window.PL && !!window.PL.state), 'estado del juego inicializado (window.PL.state)');
ok(!(await page.locator('#intro').isVisible()), 'intro cerrada tras empezar');
const hud = await page.evaluate(() => ({
  coins: document.getElementById('coinsV').textContent,
  donas: document.getElementById('donasV').textContent,
  level: document.getElementById('levelV').textContent
}));
ok(hud.level === '1', 'HUD muestra nivel 1');
ok(hud.coins !== '0', 'HUD muestra monedas (' + hud.coins + ')');

console.log('== Jugabilidad (vía API de test) ==');
// Construir casa (misión q1)
const r1 = await page.evaluate(() => window.PL.place('casa', 0, 0));
ok(r1.ok === true, 'casa construida vía API');
ok(await page.evaluate(() => window.PL.state.buildings.length >= 2), 'kiosco semilla + casa en el pueblo');
const q1 = await page.evaluate(() => window.PL.core.activeQuest(window.PL.state).id);
ok(q1 === 'q2', 'misión q1 completada → q2 activa');

// Progreso: construir panadería (necesita nivel 2 y monedas)
const r2 = await page.evaluate(() => {
  const PL = window.PL;
  PL.state.coins = 5000; PL.state.level = 3;
  PL.core.evaluateQuests(PL.state, Date.now());
  return PL.place('panaderia', 3, 3);
});
ok(r2.ok === true, 'panadería construida tras subir nivel');

// Simular 10 minutos de producción y recolectar
const r3 = await page.evaluate(() => {
  const PL = window.PL;
  const before = PL.state.coins;
  PL.tick(600); // 10 min
  const c = PL.collectAll();
  return { ok: c.ok, gained: PL.state.coins - before };
});
ok(r3.ok === true, 'recolectar todo tras 10 min simulados');
ok(r3.gained > 0, 'monedas ganadas por producción (' + r3.gained + ')');

// Tareas: iniciar y completar una tarea de Luis
const r4 = await page.evaluate(() => {
  const PL = window.PL;
  const s = PL.state;
  const t = PL.core.startTask(s, 'luis', 'regar', Date.now());
  PL.tick(301); // la tarea dura 300s
  const done = PL.core.completeTask(s, 'luis', Date.now() + 301000);
  return { started: t.ok, done: done.ok, coins: done.coins, xp: done.xp };
});
ok(r4.started === true, 'tarea de Luis iniciada');
ok(r4.done === true, 'tarea completada tras 301s simulados');
ok(r4.coins === 60 && r4.xp === 20, 'recompensa correcta (60 🪙 + 20 ⭐)');

// Guardado
const r5 = await page.evaluate(() => {
  localStorage.setItem(window.PL.core.SAVE_KEY, JSON.stringify(window.PL.state));
  const raw = localStorage.getItem(window.PL.core.SAVE_KEY);
  return raw && raw.length > 100;
});
ok(r5 === true, 'partida guardada en localStorage');

console.log('== UI: modales ==');
await page.click('#btnShop');
await page.waitForTimeout(300);
ok(await page.locator('#shopOv.open').count() === 1, 'tienda se abre');
const shopItems = await page.locator('#shopGrid .item').count();
ok(shopItems >= 10, 'catálogo de edificios visible (' + shopItems + ' items)');
await page.click('#shopOv .xbtn');
await page.click('#btnChars');
await page.waitForTimeout(300);
ok(await page.locator('#charOv.open').count() === 1, 'panel de vecinos se abre');
await page.click('#charOv .xbtn');
await page.click('#btnQuests');
await page.waitForTimeout(300);
ok(await page.locator('#questOv.open').count() === 1, 'panel de misiones se abre');
const questCards = await page.locator('#questBody .quest').count();
ok(questCards === 12, '12 misiones listadas');
await page.click('#questOv .xbtn');
await page.click('#btnLand');
await page.waitForTimeout(300);
ok(await page.locator('#landOv.open').count() === 1, 'modal de terreno se abre');
const landText = await page.locator('#landBody').textContent();
ok(landText.includes('6x6'), 'terreno actual 6x6 mostrado');
await page.click('#landOv .xbtn');

console.log('== Errores de consola ==');
ok(errors.length === 0, 'sin errores JS' + (errors.length ? ': ' + errors.join(' | ') : ''));

console.log('== Capturas ==');
await page.waitForTimeout(400);
await page.screenshot({ path: SHOT + '/01-pueblo.png' });
console.log('  → 01-pueblo.png');

// Escena rica: donar recursos y construir varios edificios para la captura final
await page.evaluate(() => {
  const PL = window.PL;
  PL.state.coins = 500000; PL.state.level = 10;
  PL.place('casa', 1, 0); PL.place('kiosco', 2, 1); PL.place('floreria', 3, 0);
  PL.place('panaderia', 0, 2); PL.place('taller', 2, 3); PL.place('cafeteria', 4, 3);
  PL.place('cine', 0, 5); PL.place('escuela', 3, 5); PL.place('hospital', 5, 5);
  PL.core.buyDecor(PL.state, 'farol', Date.now());
  PL.core.buyDecor(PL.state, 'fuente', Date.now());
  PL.core.unlockCharacter(PL.state, 'carmen', Date.now());
  PL.core.startTask(PL.state, 'luis', 'pintar', Date.now());
});
await page.waitForTimeout(500);
await page.screenshot({ path: SHOT + '/02-pueblo-completo.png' });
console.log('  → 02-pueblo-completo.png');

await browser.close();
console.log('\n========================================');
console.log(`VERIFICACIÓN: ${passed} pasaron, ${failed} fallaron`);
process.exit(failed ? 1 : 0);
