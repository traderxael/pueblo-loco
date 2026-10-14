# 🗺️ Roadmap — Pueblo Loco

Estado: **v1.0 — vertical slice jugable y verificada** (60/60 tests núcleo, 24/24 navegador).

## ✅ Hecho (v1.0)

- [x] Núcleo de reglas puro y testeado (economía, XP, misiones, tareas, terreno)
- [x] Juego jugable end-to-end en web (canvas + UI táctil)
- [x] 12 edificios, 8 personajes, 16 tareas, 5 adornos, 12 misiones
- [x] Progreso offline (8 h), autoguardado, rush con donas
- [x] Venta de edificios y expansión de terreno
- [x] Playthrough bot: 12/12 misiones en 30 días sin deadlocks
- [x] Verificación en navegador real (Edge headless) + capturas

## 🔜 v1.1 — Pulido de juego

- [ ] Música de fondo + más efectos de sonido (WebAudio generativo)
- [ ] Misiones diarias rotativas con bonus de donas
- [ ] Logros / achievements con toasts especiales
- [ ] Tutorial guiado los primeros 5 minutos (flechas animadas)
- [ ] Modo foto (ocultar UI para capturas del pueblo)
- [ ] Balance fino: curva de precios late-game (estadio/torre)

## 🔜 v1.2 — Social y retención

- [ ] Ranking local de "pueblo más próspero" (puntaje por edificios+nivel)
- [ ] Eventos semanales (p.ej. "semana del cine": producción x2)
- [ ] Compartir pueblo por URL (estado serializado en el link)
- [ ] PWA: instalable en el teléfono (manifest + service worker)

## 🔜 v1.3 — Más sistemas

- [ ] Vecinos visitantes con pedidos (mini-economía de trueque)
- [ ] Coleccionables escondidos en el terreno al expandir
- [ ] Decoración con efectos de área (fuente +10% producción radio 2)
- [ ] Editor de pueblo (mover edificios ya construidos)

## 🔜 v2.0 — Multijugador / nube

- [ ] Cuenta + nube (Firebase o Supabase) para jugar en varios dispositivos
- [ ] Visitar pueblos de amigos, dejar "me gusta" y regalos
- [ ] Tabla de clasificación global
- [ ] API de misiones generadas por el servidor

## 💡 Ideas descartadas (por ahora)

- ~~Unity/godot build nativo~~ — la web ya cubre desktop+móvil sin instalar nada
- ~~Assets de Los Simpson~~ — copyright; el arte procedural propio se ve bien y es legal
