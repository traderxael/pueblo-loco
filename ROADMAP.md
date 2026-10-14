# 🗺️ Roadmap — Pueblo Loco

Estado: **v1.1 — pulido completo** (74/74 tests núcleo, 43/43 navegador).

## ✅ Hecho (v1.1)

### Núcleo (v1.0)
- [x] Núcleo de reglas puro y testeado (economía, XP, misiones, tareas, terreno)
- [x] Juego jugable end-to-end en web (canvas + UI táctil)
- [x] 12 edificios, 8 personajes, 16 tareas, 5 adornos, 12 misiones
- [x] Progreso offline (8 h), autoguardado, rush con donas
- [x] Venta de edificios y expansión de terreno
- [x] Playthrough bot: 12/12 misiones en 30 días sin deadlocks
- [x] Verificación en navegador real (Edge headless) + capturas

### Pulido (v1.1)
- [x] Música de fondo generativa (WebAudio: bajo + melodía pentatónica, toggle con preferencia persistida)
- [x] Misiones diarias rotativas (3 al día, deterministas por fecha, recompensa en donas)
- [x] 12 logros con toasts especiales y panel dedicado
- [x] Tutorial guiado de 5 pasos con flecha animada y opción de saltar
- [x] Modo foto (oculta HUD/dock para capturas limpias)
- [x] Sonido especial al desbloquear logros

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
