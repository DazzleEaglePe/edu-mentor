# 17 · Handoff → carril backend · A2, A4 y dos observaciones de contrato

Fecha: 2026-07-26 · Fase 1
Rama: `agent/phase1-web-mentor-agenda`

---

## 1. ⚠️ Deriva de contrato: los `error.code` no están enumerados

Publicaste `422 SCORE_EXCEEDS_MAX` en Fase 3. **No existe en `docs/api/openapi.yaml`** — lo busqué: cero ocurrencias.

No es un descuido tuyo: el contrato **no enumera los códigos de error en ninguna parte**. `ErrorEnvelope.code` es un string con patrón `^[A-Z][A-Z0-9_]+$`, y solo dos códigos están fijados como `const` en sus schemas propios (`SCHEDULE_CONFLICT` y `CONFIRMATION_CLOSED`).

Eso importa más de lo que parece, porque acordamos que **la UI redacta el texto desde `code`**. Hoy mi catálogo tiene 11 códigos que fui recogiendo de checkpoints y conversaciones, no del contrato. Si el backend emite uno que no conozco, la persona ve el texto de respaldo genérico y **ningún gate lo detecta**: los tipos compilan, las pruebas pasan y el build es verde.

### CCR-013 · Enumerar los códigos de error en el contrato

- **Necesidad:** que la UI pueda redactar todos los errores que el backend emite, y que agregar uno rompa algo visible en vez de degradarse en silencio.
- **Propuesta:** un `ErrorCode` como enum en OpenAPI, referenciado desde `ErrorEnvelope.code`. Al regenerarse `shared-types`, mi catálogo pasaría a estar tipado contra él y un código sin copy sería un error de compilación.
- **Alternativa sin cambiar el schema:** una tabla de códigos en un documento, mantenida a mano. Funciona, pero vuelve a depender de que alguien se acuerde.
- **Mientras tanto:** agregué `SCORE_EXCEEDS_MAX` a mi catálogo con copy propio.

Es la misma clase de riesgo que ya nos mordió tres veces con el bug de prototipo: algo que ningún gate ve.

## 2. Sobre iniciar Fase 4 — hay un bloqueo de Producto

Preguntas si procedes con notificaciones. **La mitad sí, la mitad no.**

`DEC-020` sigue abierto: **no está elegido el canal** (email, WhatsApp o ambos) ni el proveedor. Está en la lista de pendientes de Producto desde Fase 0 y aparece en `11-contract-decisions.md` como validación pendiente.

Lo que sí se puede construir sin esa decisión:

- transactional outbox y su tabla;
- scheduler y workers de BullMQ;
- claves de idempotencia, retry, backoff y dead-letter;
- la vista operativa de jobs fallidos (A10, que ya está diseñada).

Lo que **no** se puede cerrar: la integración de entrega. Elegir un proveedor ahora sería tomar una decisión de Producto por ellos, y además condiciona la recuperación de contraseña (CCR-007 quedó resuelto con reset manual justamente porque no hay canal).

Sugerencia: construir el outbox con la entrega detrás de una interfaz, y dejar el adaptador real para cuando EDU-US decida. Mi copy de notificaciones (`09-copy.md` §6) ya está escrito **agnóstico de canal** por la misma razón.

## 3. Sobre P8, P9 y P11 — no los construyo todavía

Los pones en mi hoja de ruta, pero son **mutaciones puras**: subir archivo, enviar revisión, crear la siguiente tras una devolución.

No hay cliente HTTP —`lib/api/client.ts` es una interfaz declarada, sin implementación— y no hay auth. Construir un formulario de carga que no carga nada sería escenografía: se vería completo, no funcionaría, y alguien podría darlo por hecho en una demo.

Lo que sí existe hoy en `/entregables/[deliverableId]`: la lista de archivos con su `scanStatus`, las notas, y el botón de enviar que **dice exactamente qué falta** (`canSubmitRevision` cubre los cuatro bloqueos del contrato). Cuando llegue el cliente HTTP, es conectar — no rediseñar.

Prefiero avanzar en pantallas de lectura, que sí quedan terminadas.

## 4. Qué construí

| Ruta | Pantalla | Notas |
|---|---|---|
| `/admin/sesiones` | **A2** | Supervisión de toda la organización. Arriba, personas sin responder — no un total, que no le dice a nadie qué hacer |
| `/admin/entregables` | **A4** | Cumplimiento, no contenido. Separa "esperando al participante" de "esperando al mentor" |

En A4 no hay enlace para abrir archivos: **supervisar no es evaluar**. El contenido es del mentor y cada descarga se audita.

## 5. Fixtures que me faltan

| Fixture | Desbloquea |
|---|---|
| `dashboard.admin.json` | **A1**, el dashboard operativo. `GET /dashboard/admin` existe en el contrato pero no hay datos |
| `assignment.top-candidates.json` | **M16**, el Top 3. Recuerda que va con `provisionalRule: true` |

Con esos dos, el panel administrativo queda cerrado salvo A10/A11, que son de Fase 4.

## 6. Verificación

Sigo sin Node. **No ejecuté nada.** Cuento 158 casos `it()`.

```bash
pnpm --filter @edu-mentor/web test
pnpm --filter @edu-mentor/web typecheck
pnpm --filter @edu-mentor/web lint
pnpm --filter @edu-mentor/web build
pnpm format:check
```

Smoke: `/admin/sesiones` y `/admin/entregables`.

## 7. Lo de siempre, que ya pesa

**19 pantallas construidas. Ninguna vista por una persona.**

Los tres arreglos responsive del turno anterior —identidad de admin, tablas que se vuelven tarjetas en móvil, barra inferior desbordada— siguen **sin verificar**. Son cambios puramente visuales: ningún gate automático puede confirmarlos.

Cada slice que agrego sin esa pasada aumenta lo que habría que rehacer si el patrón responsive está mal. Si tienes navegador, esa revisión rinde más que cualquier pantalla nueva que yo escriba.
