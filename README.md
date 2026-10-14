# 🏘️ Pueblo Loco

**Constructor de barrio con las mecánicas de los city-builders tipo EA — código, arte y personajes 100% originales.**

Juego web jugable en desktop y móvil. Construye edificios en una cuadrícula, recolecta
monedas, manda a tus vecinos a hacer tareas temporizadas, sube de nivel, expande el
terreno y completa 12 misiones encadenadas.

## 🎮 Cómo jugar

1. Abre `index.html` en cualquier navegador (no requiere servidor ni instalación).
2. Pulsa **▶ Empezar a construir**.
3. **Construir** → elige un edificio → tócalo en una zona verde del terreno.
4. **Recolectar** (💰) o toca un edificio con burbuja de monedas para cobrar.
5. **Amigos** (🧑‍🤝‍🧑) → toca un vecino → dale una tarea (⏳ temporizada).
   Cuando termine, reclama la recompensa — o acelérala con 🍩.
6. **Misiones** (📋) → sigue la cadena de objetivos para ganar donas y XP.
7. **Terreno** (🌱) → compra parcelas más grandes cuando tengas monedas.

### Mecánicas implementadas (equivalentes al género)

| Mecánica | Implementación |
|---|---|
| Cuadrícula de construcción | Terreno 6x6 → 12x12, edificios 1x1 a 3x3 |
| Moneda blanda | 🪙 Monedas por ciclos de producción de cada edificio |
| Moneda premium | 🍩 Donas (desbloqueo de personajes, acelerar tareas) |
| Tareas temporizadas | 5 min a 12 h por personaje, timers reales |
| Progresión offline | Producción y tareas avanzan mientras no juegas (tope 8 h) |
| XP y niveles | Curva `80·n^1.55`, desbloquea edificios y adornos |
| Misiones | 12 misiones encadenadas con recompensas |
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
│   ├── test-core.mjs       # 60 tests del núcleo (Node)
│   └── verify-browser.mjs  # 24 verificaciones en navegador real (Playwright)
└── screenshots/        # Capturas de verificación
```

**Arquitectura:** el núcleo (`core/economy.js`) no importa nada del motor ni del DOM,
así que las reglas se pueden ejecutar y medir sin navegador. `game.js` es una capa
fina de render sobre él. Los tests derivan del mismo núcleo que usa el juego.

## ✅ Verificación (ejecutada, no prometida)

```bash
node tools/test-core.mjs        # → 60 pasaron, 0 fallaron (núcleo + playthrough 30 días)
node tools/verify-browser.mjs   # → 24 pasaron, 0 fallaron (Edge headless + capturas)
```

El playthrough simulado (bot headless de 30 días × 20 semillas) completa las
**12/12 misiones** llegando a nivel ~51, sin deadlocks de progresión.

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
