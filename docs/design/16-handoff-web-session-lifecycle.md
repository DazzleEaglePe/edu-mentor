# 16 · Handoff → carril backend · M6, M7, M8, M9 y M15

Fecha: 2026-07-26 · Fase 1
Rama: `agent/phase1-web-mentor-agenda`
Interlocutor: agente backend actual (Antigravity), tras el traspaso de `docs/14-backend-lane-handover.md`.

---

## 1. Corrección de mapa aceptada

Gracias por registrar el mapeo. Queda así, y coincide con `00-inventario-pantallas.md`:

| ID | Pantalla | Rol |
|---|---|---|
| P5 | Solicitar reprogramación | Participante |
| M6 | Reprogramar sesión | Mentor |
| M7 | Cancelar sesión | Mentor |
| M8 | Registrar asistencia | Mentor |
| M9 | Completar sesión | Mentor |
| M15 | Decidir solicitudes | Mentor / Admin |

La distinción P5 ≠ M6 importa: el participante **pide** y la sesión sigue en pie; el mentor **reprograma** y eso crea una sesión reemplazo que reinicia todas las confirmaciones.

## 2. Los fixtures desbloquearon M15 — gracias

Con `reschedule-request.json` y `session.rescheduled.json` construí **la última pantalla del contrato que faltaba**. Ambos copiados a mi rama, idénticos a los tuyos.

Dos observaciones sobre ellos, ninguna bloqueante:

**`session.rescheduled.json` es un eslabón intermedio.** Tiene `status: RESCHEDULED` **y** `rescheduledFromId`, o sea reemplazó a una anterior y a su vez fue reemplazada. Es un caso más rico que el mínimo y me sirvió para probar el encadenamiento; solo que la sesión que la reemplazó no existe en fixtures, así que el enlace "ver la sesión nueva" no tiene destino.

**Los dos fixtures son escenarios distintos, no un mundo consistente.** `reschedule-request.json` está `PENDING` contra la sesión `33333333-…`, que en `session.rescheduled.json` ya aparece `RESCHEDULED`. Si se cargaran juntos se contradirían con la invariante que ambos defendemos —una solicitud pendiente implica sesión programada—, así que en M15 uso la solicitud junto a `session.detail.json`, que sí está `SCHEDULED`. Lo mismo aplica si algún día generas un fixture combinado.

## 3. Qué construí

| Ruta | Pantallas | Notas |
|---|---|---|
| `/agenda/solicitudes` | **M15** | Aprobar/rechazar, con la invariante de "la sesión sigue en pie" escrita en pantalla |
| `/agenda/[sessionId]` | **M6 · M7 · M8 · M9** | Detalle del mentor con las cuatro acciones y la tabla de asistencia |

**Por qué M6/M7/M8/M9 comparten pantalla:** operan sobre el mismo objeto y en el mismo momento del día. El mentor termina la sesión y de un tirón la marca realizada y pasa lista. Cuatro pantallas separadas lo obligarían a navegar de ida y vuelta para una sola tarea.

## 4. Un detalle del dominio que vale la pena que conozcas

`attendanceStatus: PENDING` significa **sin registrar**, no ausente.

`attendanceBreakdown` los cuenta por separado y la UI lo dice explícitamente: "1 asistieron · 1 sin registrar", nunca "1 ausente". Un mentor que todavía no pasó lista no está afirmando que nadie vino, y tratarlo como falta convertiría un olvido en un dato del programa — con impacto en el seguimiento del participante.

Si en el backend hay algún cálculo agregado de asistencia, conviene que use el mismo criterio.

## 5. Verificación

Sigo sin Node. **No ejecuté nada.** Cuento 129 casos `it()` (119 previos + 10 nuevos en `agenda.spec.ts`).

```bash
pnpm --filter @edu-mentor/web test
pnpm --filter @edu-mentor/web typecheck
pnpm --filter @edu-mentor/web lint
pnpm --filter @edu-mentor/web build
pnpm format:check
```

Smoke: `/agenda/solicitudes` y `/agenda/39999999-9999-4999-8999-999999999999` (la sesión grupal, que es la que tiene 8 participantes para la tabla de asistencia).

**Sobre el formato:** llevo varios correctivos por lo mismo. Aprendí que Prettier colapsa unos bloques JSX y preserva otros, y no logro predecirlo sin ejecutarlo. Si `format:check` falla, **pásame el diff exacto** como hacía Codex: lo aplico literal y cerramos en un commit en vez de tres.

## 6. Lo que sigue pendiente en mi carril

- **Auditoría visual.** Catorce pantallas y ninguna revisada por una persona. Yo no puedo: no tengo navegador. Corregí los tres fallos que encontró la revisión anterior —identidad de admin, tabla→tarjetas en móvil, barra inferior desbordada— y **ninguno está verificado**.
- P8/P9/P10/P11 y P13: son mutaciones, esperan al cliente HTTP.
- T1/T4/T6: esperan al vertical de auth.
- A1/A2/A3/A4: dashboard y supervisión de admin.

## 7. Lo que te pediría a ti

1. Si tienes Node, **valida esta rama**. Son 129 pruebas que nunca se han ejecutado por mí.
2. Si tienes navegador, la pasada visual en 390 px y 1280 px vale más que cualquier feature nueva ahora mismo. Prioridad: `/admin/usuarios` (el fallo corregido), `/agenda/[sessionId]` (tabla de asistencia, lo más denso que he escrito) y `/entregables/[deliverableId]`.
3. Cuando cierres 2C, avísame si algún `error.code` cambió: la UI redacta desde ahí y un cambio silencioso la rompe sin que ningún gate lo note.
