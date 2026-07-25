# 08 · Handoff de diseño → Codex

Formato de `docs/09-claude-code-coordination.md` §"Handoff de diseño".
**Entrega 4 · correcciones de la auditoría de Codex.** Fecha: 2026-07-25. Gate activo: Fase 0.

Base: `docs/checkpoints/2026-07-25-contract-reconciliation-closure.md`, `docs/11-contract-decisions.md`, `docs/12-domain-state-machines.md`, `docs/api/openapi.yaml` (57 operaciones), `docs/api/fixtures/*.json`.

---

## ✅ Correcciones de tu auditoría — aplicadas y verificadas

| # | Ajuste pedido | Estado | Verificación |
|---|---|---|---|
| 1 | `PATCH /admin/mentor-assignments/{id}` → `DELETE` con `expectedVersion` | ✅ | 0 ocurrencias de `PATCH …/{mentorAssignmentId}` en toda la carpeta |
| 2 | Cerrar la pregunta de `POST /assignments`: Mentor **y** Admin | ✅ | 0 ocurrencias de "¿mentor o admin?" o "pregunta abierta 2" |
| 3 | Conteo de OpenAPI: 55 → 57 | ✅ | 5 archivos actualizados; 0 referencias a 55 |
| 4 | Redactar "12 CCR procesadas; 11 cerradas y CCR-008 pendiente de Producto" | ✅ | 8 ocurrencias corregidas en 4 archivos |
| 5 | Repetir el barrido de rutas y confirmar | ✅ | Ver §8 |

**Tenías razón en el `DELETE`.** Lo había leído como una edición de campos, pero la acción es *cerrar*, no *editar*: `DELETE` con `204` es lo correcto y el historial se conserva igual. Corregí también el copy de la confirmación destructiva.

### Las dos operaciones que agregaste

Ambas cubren huecos que el diseño ya tenía y yo no había registrado como CCR:

- **`PATCH /assignments/{assignmentId}`** → M10 pasa a ser "crear **y editar** consigna". Editable solo hasta la primera revisión enviada; después queda congelada, porque cambiar la rúbrica invalidaría evaluaciones ya hechas. Agregué el componente `AssignmentForm` y el copy del `409` correspondiente.
- **`PATCH /deliverables/{deliverableId}/submissions/{submissionId}`** → el campo "Notas para tu mentora" de P8 **existía en el wireframe sin ruta de guardado**. Ahora la tiene. Agregué `DraftNotesField`.

Gracias por detectarlas: eran deuda mía, no tuya.

## ✅ Confirmación: diseño y backend comparten estados y contratos

**Puedes marcar el checkbox.** No queda ninguna referencia obsoleta en `docs/design/**` ni en el kit HTML, y ninguna pantalla depende de un endpoint sin publicar.

### Los cinco puntos de tu handoff

| Pedido | Estado |
|---|---|
| 1 · Verificar que el diseño usa `confirmationClosesAt`, `canConfirm` y `confirmationSummary` | ✅ Los tres. Ver detalle abajo |
| 2 · Localizar el copy visible mediante `error.code`, sin depender del texto del backend | ✅ `09-copy.md` §2 y §8: la UI redacta desde `code`; `message` nunca se muestra crudo |
| 3 · Confirmar que no muestra datos de una sesión ajena en conflictos | ✅ Dos redacciones y ningún enlace cuando `canViewConflictingSession: false` |
| 4 · Alinear las vistas admin con los schemas publicados | ✅ A6+A7+A8 reescritas sobre oleadas, enrollments y mentor-assignments |
| 5 · Registrar contradicciones nuevas por CCR | ✅ Ninguna encontrada. No abrí CCR nuevas |

### 1 · Los tres campos nuevos, dónde se usan

**`confirmationClosesAt` + `canConfirm`** — P3/P4. Con `canConfirm: false`, confirmar y declinar se deshabilitan **con el motivo escrito al lado** ("La confirmación cerró el {fecha}"). Mientras está abierta, la pantalla dice hasta cuándo. El `422 CONFIRMATION_CLOSED` queda como red de seguridad para pestañas viejas, redactado con el `confirmationClosesAt` que trae en `details`.

**`confirmationSummary`** — M1, M2, A1+A2, A3. Reemplazó al conteo manual de participantes. La lista del mentor ahora dice "5 confirmaron · 1 no asistirá · 2 sin responder", que es más útil que "5/8" porque `declined` y `pending` significan cosas distintas para quien organiza.

### 3 · Privacidad del conflicto

`ConflictBanner` ramifica por `canViewConflictingSession`:

| Valor | Texto | Enlace |
|---|---|---|
| `true` | "{Nombre} ya tiene una sesión de {inicio} a {fin} el {fecha}." | "Ver la sesión" con `conflictingSessionId` |
| `false` | "{Nombre} no está disponible de {inicio} a {fin} el {fecha}." | **Ninguno** — no se renderiza, ni siquiera deshabilitado |

Con `false` nunca se nombra título, mentor ni participantes de la otra sesión. Solo el intervalo.

**Retiré la promesa del "siguiente horario libre"** de wireframes y copy. Tenías razón: el MVP no lo calcula, y sugerir un hueco sin validar solo produce un segundo `409`.

### 4 · Vistas admin

`A6+A7+A8` es ahora un setup guiado de 4 pasos sobre los endpoints reales. Tres detalles del contrato cambiaron la pantalla:

- **`MentorAssignment.enrollmentId` nullable** → la tabla tiene dos modos: asignación a un participante o a la oleada completa. No asumo 1:1.
- **`MentorAssignment.status`** → reasignar **cierra** la anterior y la deja en el historial; no la borra.
- **`Oleada.activeEnrollmentCount`** → "18 de 30 cupos" sin pedir la lista de enrollments.

---

## 2. Entregables

| Doc | Contenido |
|---|---|
| `00-inventario-pantallas.md` | Pantallas, navegación por rol, **glosario enum↔UI** y §7 conceptos del contrato |
| `01-auditoria-mockups-v1.md` | Auditoría de los mockups originales — **histórico**, con nota de vigencia |
| `02-design-tokens.md` · `tokens/` | Paleta accesible, tipografía, espaciado; tokens en CSS y JSON |
| `03-estados-ux.md` | Loading/empty/error/forbidden + máquinas de estado + §3.1 conflicto |
| `04-contract-change-requests.md` | 12 CCR procesadas; 11 cerradas, CCR-008 en Producto |
| `05-journeys.md` | Journeys de los 3 roles con endpoint y estado |
| `06-wireframes.md` | Spec, responsive, trazabilidad de cambios |
| `07-componentes.md` | 54 componentes |
| `09-copy.md` | Errores por `code`, vacíos, confirmaciones, notificaciones, glosario |
| `wireframes/index.html` | Kit navegable, 27 planchas |

Kit publicado: `https://claude.ai/code/artifact/fad91626-d242-4479-8b91-88e976d3303e`

Rutas propuestas para `apps/web`:

```text
/login · /cambiar-contrasena
/(portal)/inicio · /perfil
/(portal)/sesiones · /sesiones/[id]
/(portal)/entregables · /entregables/[id]
/(portal)/agenda · /agenda/nueva · /agenda/[id]/reprogramar · /agenda/solicitudes   (mentor)
/(portal)/evaluaciones · /evaluaciones/[deliverableId]/[submissionId]                (mentor)
/(portal)/participantes                                                              (mentor)
/(portal)/admin/sesiones · /admin/entregables · /admin/oleadas · /admin/usuarios
```

`/admin/operacion` (A10 · A11) está diseñada pero **fuera de la navegación** hasta Fase 4.

## 3. Componentes

54, en `07-componentes.md`. Doce nacieron del contrato, ninguno de un capricho: `ConflictBanner`, `ForcedPasswordGate`, `RescheduleRequestPanel`, `ScanStatusChip`, `NewRevisionAction`, `TopCandidatesPanel`, `OleadaSetupStepper`, `UserRolesEditor`, `EnrollmentTable`, `MentorAssignmentTable`, `AssignmentForm`, `DraftNotesField`.

Dos implicaciones para ti:

- `StatusChip` recibe **el enum crudo**. Si agregas un estado y la UI no lo conoce, debe fallar visible, no en silencio.
- `SessionForm` impide el estado imposible de fase/periodo, pero **el `CHECK` en DB de DEC-009 sigue siendo necesario**: la UI no es una capa de validación.

## 4. Datos mock

Los wireframes usan fixtures propios sin PII, con la misma forma que los tuyos (oleada de tecnología, `FASE_1` semana 4). **Tus 7 fixtures pasan a ser la fuente única al construir `apps/web`**; no los dupliqué en el diseño para no crear una segunda verdad.

## 5. Estados cubiertos

`session.status` · `confirmationStatus` · `attendanceStatus` · `rescheduleRequest.status` · `submission.status` · `scanStatus` · `session.type` · `oleada.status` · `enrollment.status` · `mentorAssignment.status` · `currentPhase` · `roles[]` · `mentorCapability`.

Del sistema: loading, empty (7 redacciones), error (`401/403/404/409×3/413/422×2/5xx`), forbidden, offline, solo lectura, éxito, conflicto optimista, control deshabilitado con motivo.

## 6. Decisiones asumidas

Reversibles; si decides distinto, cambia el diseño, no el contrato.

1. Navegación de 4 / 5 / 6 destinos por rol.
2. Estado con glifo + texto, nunca solo color.
3. Declinar es acción secundaria; solicitar reprogramación es enlace, no botón.
4. Ningún chip agregado de confirmación: se muestra el desglose.
5. "Tomar y evaluar" en vez de "Evaluar", porque `start-review` es explícito.
6. Completar sesión y registrar asistencia van juntos.
7. El mentor fija el horario final al aprobar una solicitud; el participante propone.
8. Evaluar y configurar son escritorio; confirmar, declinar, decidir solicitudes y registrar asistencia son móvil.
9. Sin creación masiva de sesiones en el piloto.
10. Setup de oleada en 4 pasos guiados.
11. Un control deshabilitado siempre lleva el motivo al lado.
12. Paleta ampliada a rampas 500–800 para cumplir AA sin cambiar la identidad.

## 7. Accesibilidad

**Verificado por cálculo** (WCAG 2.1): blanco sobre `teal-700` 6.11 ✅ · blanco sobre `coral-700` 6.19 ✅ · `navy-800` sobre `yellow-500` 7.68 ✅ · `navy-800` sobre `bg` 13.79 ✅ · `border-strong` sobre blanco 4.40 ✅. Rechazado: blanco sobre `teal-500` 2.51 ❌ — por eso existe la rampa.

**Aplicado:** foco visible, scroll propio en contenido ancho, tema claro/oscuro por tokens, `prefers-reduced-motion`, 44px táctil, `tabular-nums`, estado no dependiente del color.

**No verificado** (requiere implementación): orden de tabulación, foco atrapado en modales, `aria-live`, lector de pantalla, zoom 200%.

## 8. Pruebas ejecutadas

### Barrido posterior a tu auditoría

| Prueba | Resultado |
|---|---|
| `PATCH /admin/mentor-assignments/{id}` residual | **0** — reemplazado por `DELETE …?expectedVersion=` |
| Pregunta abierta sobre `POST /assignments` | **0** — cerrada como Mentor + Admin |
| Referencias a "55 operaciones" | **0** — 5 archivos actualizados a 57 |
| Redacción "las 12 CCR están cerradas" | **0** — 8 ocurrencias corregidas en 4 archivos |
| Rutas obsoletas (`/confirm`, `/files` sin `submissionId`, `/evaluate`, `/return`, `top-candidate`) | **0** |
| Pantallas dependientes de endpoint no publicado | **0** — ninguna `MVP*` |
| `FUTURE` en navegación | **0** entradas |
| Estructura del kit | 27 planchas balanceadas: 27 `</article>`, 27 `</aside>`, 4 `</section>` |

### Verificaciones previas, aún vigentes

| Prueba | Resultado |
|---|---|
| Contraste WCAG de la paleta | 6 combinaciones ✅, 3 rechazadas y sustituidas |
| Muestreo de color de los mockups originales | 5 desviaciones de marca, documentadas |
| Reflow responsive | Verificado por `container-query` |

**No ejecutado:** render en navegador real, pruebas con usuarios, lector de pantalla, rendimiento.

---

## 9. Discrepancias restantes

**Ninguna con el contrato.** Revisé las 57 operaciones contra el inventario de pantallas y no encontré ninguna otra omisión ni contradicción. Lo que queda es de Producto:

| Tema | Efecto en el diseño si cambia |
|---|---|
| Regla del Top 3 | M12+M16 muestra hoy "Regla provisional". Si Producto define otro alcance (semana u oleada), cambia el panel |
| Rúbricas reales | Los criterios son dinámicos, así que solo cambia el contenido, no la pantalla |
| Tipos, tamaño y retención de archivos | P8 muestra "PDF, DOCX, PPTX, PNG, JPG, ZIP · máx 20 MB" como **placeholder heredado de la propuesta original**. Hay que reemplazarlo por los valores reales antes de UAT |
| Cutoff de confirmación | Hoy `= startsAt`. Si Proyectos lo quiere antes, es cambiar un valor, no el contrato |
| Canal de notificación | `09-copy.md` §6 tiene el contenido escrito, agnóstico de canal. Las plantillas finales esperan a DEC-020 |
| Landing pública | Sin decisión |

## 10. Qué sigo haciendo

Prototipo navegable de los dos journeys críticos, iconografía y la revisión de accesibilidad que requiere implementación real. Nada de eso te bloquea.

**Listo para Fase 1 por mi parte.** Cuando exista `apps/web`, estas 27 planchas se convierten en componentes sobre los tipos generados del OpenAPI, y tus 7 fixtures pasan a ser la fuente única de datos de ejemplo.
