# 🏘️ Pueblo Loco

**Constructor de barrio con las mecánicas de los city-builders tipo EA — código, arte y personajes 100% originales.**

Juego web jugable en desktop y móvil. Construye edificios en una cuadrícula, recolecta
monedas, manda a tus vecinos a hacer tareas temporizadas, sube de nivel, expande el
terreno y completa 12 misiones encadenadas.

## 🎮 Cómo jugar

1. Abre `index.html` en cualquier navegador (no requiere servidor ni instalación).
2. Pulsa **▶ Empezar a construir**.
3. El tutorial te guía: construye tu primera casa, recolecta, da una tarea a un vecino
   y abre las misiones (se puede saltar en cualquier momento).
4. **Construir** → elige un edificio → tócalo en una zona verde del terreno.
5. **Recolectar** (💰) o toca un edificio con burbuja de monedas para cobrar.
6. **Amigos** (🧑‍🤝‍🧑) → toca un vecino → dale una tarea (⏳ temporizada).
   Cuando termine, reclama la recompensa — o acelérala con 🍩.
7. **Misiones** (📋) → 3 misiones diarias (rotan a medianoche) + la cadena de 12 misiones.
8. **Logros** (🏆) → 12 desafíos con recompensa en donas.
9. **Terreno** (🌱) → compra parcelas más grandes cuando tengas monedas.
10. **📷 Modo foto** (arriba) → oculta la interfaz para capturar tu pueblo.

### Mecánicas implementadas (equivalentes al género)

| Mecánica | Implementación |
|---|---|
| Cuadrícula de construcción | Terreno 6x6 → 12x12, edificios 1x1 a 3x3 |
| Moneda blanda | 🪙 Monedas por ciclos de producción de cada edificio |
| Moneda premium | 🍩 Donas (desbloqueo de personajes, acelerar tareas) |
| Tareas temporizadas | 5 min a 12 h por personaje, timers reales |
| Progreso offline | Producción y tareas avanzan mientras no juegas (tope 8 h) |
| XP y niveles | Curva `80·n^1.55`, desbloquea edificios y adornos |
| Misiones | 12 misiones encadenadas + 3 diarias rotativas con recompensas |
| Logros | 12 logros persistentes con donas de recompensa |
| Tutorial | 5 pasos guiados con flecha animada, saltable y persistente |
| Música | Banda sonora generativa WebAudio (toggle + preferencia guardada) |
| Gestión de terreno | Vender edificios (50% reembolso) y expandir parcelas |
| Persistencia | Autoguardado en `localStorage` cada 5 s |

## 🗂️ Estructura

```
pueblo-loco/
├── index.html          # Juego completo (UI + estilos)
├── game.js             # Render canvas + interacción (cámara, input, modales)
├── core/
│   └── economy.js      # Núcleo de reglas PURA (sin DOM) — economía, XP, misiones
├── tools/
│   ├── test-core.mjs       # 74 tests del núcleo (Node)
│   ├── verify-browser.mjs  # 43 verificaciones en navegador real (Playwright)
│   └── build-standalone.mjs # Genera la versión de un solo archivo
└── screenshots/        # Capturas de verificación
```

**Arquitectura:** el núcleo (`core/economy.js`) no importa nada del motor ni del DOM,
así que las reglas se pueden ejecutar y medir sin navegador. `game.js` es una capa
fina de render sobre él. Los tests derivan del mismo núcleo que usa el juego.

## ✅ Verificación (ejecutada, no prometida)

```bash
node tools/test-core.mjs        # → 74 pasaron, 0 fallaron (núcleo + playthrough 30 días)
node tools/verify-browser.mjs   # → 43 pasaron, 0 fallaron (Edge headless + capturas)
```

El playthrough simulado (bot headless de 30 días × 20 semillas) completa las
**12/12 misiones** llegando a nivel ~51, sin deadlocks de progresión.

## 📱 Versión portable

`pueblo-loco-standalone.html` (100 KB) es el juego completo en **un solo archivo**:
ábrelo desde cualquier navegador o compártelo por WhatsApp — arranca solo, sin
servidor ni archivos adicionales. Regenerar tras cambios:

```bash
node tools/build-standalone.mjs
```

## 🎨 Arte

Todo el arte es procedural (canvas 2D): casas con techo, kiosco a rayas, panadería
con toldo, cine con lucecitas parpadeantes, hospital con cruz, estadio con focos…
Los vecinos caminan por el pueblo con animación de balanceo y burbujas de progreso
de tarea. Sin ningún asset con copyright.

## 📜 Origen

Inspirado en las mecánicas de *The Simpsons: Tapped Out* (EA), analizadas por
reverse engineering del APK `com.ea.game.simpsons4_row` v4.69.5 (motor Scorpio).
El juego original es propietario y no existe como código abierto; este proyecto
reimplementa las **mecánicas**, no los assets.

---

Hecho para **traderxael** · Código y arte originales.
