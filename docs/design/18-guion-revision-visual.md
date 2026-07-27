# 18 · Guion de revisión visual

Fecha: 2026-07-27 · Rama `agent/phase1-web-mentor-agenda` (`5cad845`)

Es el **último gate sin sustituto automático**. Los cinco gates de código están verdes —172 pruebas, typecheck, lint, format y build— y ninguno de ellos ve un desbordamiento horizontal, un contraste insuficiente o un foco invisible.

Toma unos 15 minutos.

---

## Preparación

```bash
pnpm install
pnpm --filter @edu-mentor/web dev
```

Abre **http://localhost:3000**. En el navegador, herramientas de desarrollo → modo responsive → **390 px** de ancho.

Todas las pantallas se ven sin login: la autenticación aún no está conectada.

---

## 1. Los tres arreglos sin verificar

Son cambios que hice a ciegas, a partir de un hallazgo de la revisión anterior. **Si algo falla, lo más probable es que sea aquí.**

| # | Ruta | Qué debe pasar | Qué sería un fallo |
|---|---|---|---|
| 1 | `/admin/usuarios` | En 390 px se ven **tarjetas**, una por persona, con la etiqueta del campo encima del dato | Se ve una tabla · la **página entera** se desplaza de lado |
| 2 | Cualquiera de `/admin/*` | La barra inferior muestra 5 destinos y **se desplaza sola** si no caben | La barra empuja la página · algún destino queda inalcanzable |
| 3 | `/admin` o `/admin/usuarios` | Arriba a la derecha dice **"Admin"**, y la barra inferior muestra Dashboard · Sesiones · Entregables · Oleadas · Usuarios | Dice "Participante" · aparecen "Mis entregables" o "Mis sesiones" |

**La regla general:** ningún contenido debe hacer que la página entera se desplace en horizontal. Las tablas anchas sí pueden desplazarse **dentro de su propio recuadro**.

## 2. Las pantallas más densas

Donde hay más probabilidad de que algo se rompa al apilarse.

| Ruta | Qué mirar en 390 px |
|---|---|
| `/agenda/39999999-9999-4999-8999-999999999999` | La tabla de 8 participantes. Cada uno debe quedar como tarjeta con su confirmación, su asistencia y los dos botones |
| `/entregables/55555555-5555-4555-8555-555555555555` | La rúbrica lateral pasa debajo del contenido. Debe seguir leyéndose como "cómo se evalúa esto", no quedar suelta |
| `/admin` | Los tres bloques del panel apilados, sin que las cifras se aplasten |
| `/evaluaciones/55555555-5555-4555-8555-555555555555/77777777-7777-4777-8777-777777777777` | El formulario de evaluación con la rúbrica |

## 3. Recorrido completo

Rápido, para ver que nada esté vacío o roto:

```
/inicio · /sesiones · /sesiones/33333333-3333-4333-8333-333333333333
/entregables · /agenda · /agenda/nueva · /agenda/solicitudes
/evaluaciones · /evaluaciones/top-3
/admin · /admin/sesiones · /admin/entregables · /admin/oleadas
/admin/enrollments · /admin/asignaciones · /admin/usuarios
```

Y una ruta inventada, por ejemplo `/sesiones/no-existe`: debe decir **"Este contenido no está disponible"**, nunca "no existe".

## 4. Qué NO es un fallo

Para no perder tiempo reportando lo que es intencional:

- **Todos los botones de acción están deshabilitados** con un motivo escrito debajo. Confirmar, enviar, evaluar, agendar, aprobar: ninguno funciona todavía porque no hay cliente HTTP. Es deliberado — un botón que no hace nada sería peor.
- **Los datos son sintéticos.** "Participante Demo", "Mentora Demo", una sola oleada. No hay PII real.
- **`/admin/enrollments` y `/admin/asignaciones` no están en la barra de navegación**: se llega a ellas desde `/admin/oleadas`, porque las tres son un solo flujo de configuración.
- **Las mismas personas aparecen en varias pantallas** con datos que no siempre concuerdan entre sí. Los fixtures son escenarios independientes, no un mundo consistente.

## 5. Accesibilidad, si queda tiempo

Tres comprobaciones baratas y de alto valor:

1. **Teclado:** pulsa Tab desde el inicio de la página. Debe verse un recuadro claro alrededor de cada elemento enfocado, y el orden debe seguir el orden visual.
2. **Zoom al 200 %:** nada debe quedar cortado ni superpuesto.
3. **Estados sin color:** los chips de estado siempre llevan un símbolo y texto (✓ Confirmada, ✕ No asistiré). Ninguno debe distinguirse solo por el color.

## 6. Cómo reportar

Con la ruta, el ancho y qué esperabas basta. Una captura ayuda pero no es imprescindible:

> `/admin/usuarios` a 390 px — la página se desplaza de lado, se ve la tabla en vez de tarjetas.

Cualquier hallazgo se corrige en esta rama **antes** del merge: si el patrón responsive está mal, es mejor arreglarlo aquí que sobre `main`.
