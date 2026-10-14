/*
 * Genera pueblo-loco-standalone.html: juego completo en UN solo archivo
 * (CSS + núcleo + motor inline), con arranque automático.
 * Uso: node tools/build-standalone.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

const root = path.resolve(import.meta.dirname, '..');
const html = readFileSync(path.join(root, 'index.html'), 'utf8');
const economy = readFileSync(path.join(root, 'core/economy.js'), 'utf8');
const game = readFileSync(path.join(root, 'game.js'), 'utf8');

// Reemplaza los <script src> por bloques inline + arranque automático
const scriptsInline =
  '<script>\n' + economy + '\n</script>\n' +
  '<script>\n' + game + '\n</script>\n' +
  '<script>window.addEventListener(\'load\', function(){ setTimeout(function(){ try { window.PL.start(); } catch(e) {} }, 300); });</script>';

const out = html.replace(
  /<script src="core\/economy\.js"><\/script>\s*<script src="game\.js"><\/script>/,
  scriptsInline
);

if (out === html) {
  console.error('No se pudieron inline los scripts (patrón no encontrado)');
  process.exit(1);
}

const dest = path.join(root, 'pueblo-loco-standalone.html');
writeFileSync(dest, out, 'utf8');
console.log('standalone generado:', dest, '(' + Math.round(out.length / 1024) + ' KB)');
