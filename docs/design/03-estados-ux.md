# 03 · Catálogo de estados UX

Reconciliado con `docs/12-domain-state-machines.md` y `docs/api/openapi.yaml`.

Requisito del charter §4: **toda pantalla del MVP define loading, empty, error y forbidden.**
Principio: la UI nunca simula éxito. Si el backend no confirmó, la pantalla no dice que sí.

---

## 1. Loading

| Contexto | Patrón | Detalle |
|---|---|---|
| Carga inicial | Skeleton con la forma real del contenido | Nunca spinner a pantalla completa |
| Lista/tabla paginada | Skeleton de 3 filas | Encabezados visibles. Paginación por `hasNextPage`, sin total de páginas |
| Acción del usuario | Botón `loading` deshabilitado, con texto "Confirmando…" | El texto cambia, no solo el ícono |
| Subida de archivo | Progreso real por archivo + cancelar | Después de subir, el archivo queda `scanStatus: PENDING` — ver §6 |
| Refresco en segundo plano | Indicador sutil en el encabezado | No bloquear lo que ya está |

Accesibilidad: `aria-busy="true"` en la región; al terminar, `aria-live="polite"` anuncia el resultado.

## 2. Empty

| Caso | Pantalla | Mensaje | Acción |
|---|---|---|---|
| Nunca hubo datos | P2 Mis sesiones | "Todavía no tienes sesiones agendadas. Tu mentor las programará al iniciar la semana." | — |
| Nunca hubo datos | P6 Mis entregables | "Aún no hay consignas publicadas para tu semana." | — |
| Filtro sin resultados | A2 Sesiones | "Ningún resultado con estos filtros." | Limpiar filtros |
| Trabajo terminado | M11 Cola de evaluación | "No tienes entregas pendientes." | Ver evaluadas |
| Antes de empezar | A6 Oleadas | "Crea la primera oleada para empezar a operar el programa." | Crear oleada |
| Sin solicitudes | M15 Reprogramaciones | "No hay solicitudes pendientes." | — |

Regla: el empty del participante nunca ofrece una acción que él no puede ejecutar.

## 3. Error — contrato vigente

El backend devuelve siempre:

```json
{ "error": { "code": "SCHEDULE_CONFLICT", "message": "...", "traceId": "...", "details": { } } }
```

**La UI redacta el texto a partir de `code`**, no muestra `message` crudo (`09-copy.md` §8). `traceId` se muestra y se puede copiar.

| Situación | Patrón UI | Texto | Recuperación |
|---|---|---|---|
| Red / 5xx | Estado de pantalla | "No pudimos cargar tus sesiones." | Reintentar + `traceId` |
| `422` validación | Error inline en el campo | Mensaje específico | Foco en el primer campo con error |
| `401` | Modal | "Tu sesión expiró." | Login preservando la ruta destino |
| `403` | Ver §4 | | |
| `404` | Estado de pantalla | "Esta sesión ya no existe o fue cancelada." | Volver a la lista |
| **`409` traslape** | Banner en el formulario, sin perder lo escrito | Ver §3.1 — el texto depende de `canViewConflictingSession` | Elegir otro horario |
| **`422` confirmación cerrada** | Banner + control deshabilitado | "La confirmación cerró el {confirmationClosesAt}." | Avisar al mentor |
| **`409` versión** | Banner | "Alguien actualizó esto mientras trabajabas. Tus cambios no se guardaron." | Ver cambios · Recargar |
| **`409` estado** | Banner | "Esta revisión ya fue evaluada." | Recargar |
| **`409` idempotencia** | Silencioso | Se trata como éxito: la operación ya ocurrió | — |
| `413` / MIME inválido | Error en la zona de subida | "El archivo supera el límite." / "Formato no permitido." | Los archivos válidos se conservan |
| `422` regla de fase | Banner con la regla explicada | "Las sesiones de Fase 2 son solo para participantes graduados." | — |

> **`404` también significa "no es tuyo".** El contrato oculta por ownership devolviendo `404` (`NotFound: "Recurso ausente o deliberadamente oculto"`). La UI **no debe decir "no existe"** con certeza — el copy dice "no está disponible", que es verdad en ambos casos y no filtra información.

### Los tres `409` que más importan

El `409` es el error central de este sistema y significa tres cosas distintas. La UI las distingue por `error.code`:

1. **Traslape (`SCHEDULE_CONFLICT`)** — al crear, reprogramar o aprobar una solicitud. Acción: elegir otro horario.
2. **Versión (`expectedVersion`)** — alguien más modificó el recurso. Acción: recargar sin perder lo escrito. Aparece en *toda* mutación: editar, cancelar, completar, confirmar, evaluar, devolver, top 3.
3. **Estado inválido** — la transición ya no aplica (evaluar algo ya evaluado). Acción: recargar.

## 3.1 · `SCHEDULE_CONFLICT` — dos redacciones según lo que se puede revelar

El contrato entrega `details` tipado: `resourceType` (`USER` | `ENROLLMENT`), `resourceId`, `occupiedInterval` y `canViewConflictingSession` con `conflictingSessionId` nullable.

**La UI nunca muestra título, participantes ni mentor de una sesión que el actor no puede consultar.** Solo el intervalo ocupado.

| `canViewConflictingSession` | Texto | Acción |
|---|---|---|
| `true` | "{Nombre} ya tiene una sesión de 10:00 a 11:00 el {fecha}." | Elegir otro horario · **Ver la sesión** (usa `conflictingSessionId`) |
| `false` | "{Nombre} no está disponible de 10:00 a 11:00 el {fecha}." | Elegir otro horario |

Con `false`, `conflictingSessionId` viene en `null` y **no hay enlace**: el botón "Ver la sesión" no se renderiza, no se renderiza deshabilitado.

`resourceType` decide de quién hablamos: `USER` es el mentor, `ENROLLMENT` es un participante. El nombre sale de los datos que el formulario ya tiene en pantalla, no del error.

> **El MVP no promete "el siguiente horario libre".** El contrato no lo calcula, así que la UI no lo insinúa. Ofrecer un hueco que el backend no validó llevaría a un segundo `409`.

## 4. Forbidden

| Situación | Comportamiento |
|---|---|
| Rol sin la sección | No aparece en la navegación **y** la ruta responde `403` |
| Recurso ajeno | El backend devuelve `404`, no `403`. La UI muestra "Este contenido no está disponible" sin revelar existencia |
| Acción no permitida por estado | El botón no se renderiza; si se dispara igual, se muestra el error del backend |
| `mustChangePassword` | El portal entero queda bloqueado tras T6 hasta cambiar la contraseña |

La autorización real vive en el backend; ocultar en el frontend es cortesía, no seguridad.

## 5. Estados adicionales

| Estado | Cuándo | Patrón |
|---|---|---|
| Offline | Sin conexión | Banner persistente; se deshabilita la escritura |
| Solo lectura | Sesión `COMPLETED`/`CANCELLED`, oleada cerrada, revisión enviada | Contenido visible, acciones ocultas, nota explicativa |
| Éxito | Confirmar, enviar, evaluar | Toast + cambio de estado en pantalla. El toast nunca es la única evidencia |
| Destructivo | Cancelar sesión, quitar archivo, declinar | Consecuencia explícita: "Se notificará a 8 participantes" |
| Bloqueado por scan | Archivo en `PENDING` o `REJECTED` | El botón de enviar espera o explica el bloqueo — ver §6 |

## 6. Estados de dominio por pantalla

### Sesión — tres ejes que no se derivan uno del otro

```
session.status        SCHEDULED ──▶ COMPLETED
                              ├──▶ CANCELLED
                              └──▶ RESCHEDULED (crea sesión reemplazo)

confirmationStatus    PENDING ⇄ CONFIRMED ⇄ DECLINED     (lo cambia el participante, hasta confirmationClosesAt)
attendanceStatus      PENDING ──▶ ATTENDED | ABSENT      (lo registra el mentor, terminal)
```

- El participante ve **su** confirmación y, tras la sesión, su asistencia.
- El mentor y el admin ven el estado de la sesión **más `confirmationSummary`** (`total`, `pending`, `confirmed`, `declined`) — de ahí sale el "5 de 8".
- Nunca se muestra un estado agregado de confirmación como si fuera el estado de la sesión.
- `DECLINED` no se convierte automáticamente en `ABSENT`.

**Ventana de confirmación.** `SessionSummary` trae `confirmationClosesAt` (en el piloto coincide con `startsAt`) y `canConfirm`, que es contextual al usuario autenticado:

| `canConfirm` | Comportamiento |
|---|---|
| `true` | Confirmar y declinar activos |
| `false` | Ambos controles deshabilitados **con el motivo visible**: "La confirmación cerró el {fecha}." |

Un control deshabilitado sin explicación no es aceptable. Y si alguien lo intenta igual (pestaña vieja), el `422 CONFIRMATION_CLOSED` trae `confirmationClosesAt` en `details` para redactar el mismo mensaje.

### Solicitud de reprogramación

```
PENDING ──▶ APPROVED   (mentor/admin; crea la sesión reemplazo en la misma transacción)
        ├──▶ REJECTED   (mentor/admin, con motivo)
        └──▶ CANCELLED  (el participante se retracta)
```

Solo una solicitud `PENDING` por participante y sesión. Mientras se decide, **la sesión sigue `SCHEDULED`**: la UI no debe insinuar que ya se movió.

### Revisión de entregable

```
DRAFT ──enviar──▶ SUBMITTED ──mentor toma──▶ UNDER_REVIEW ──evaluar──▶ EVALUATED
                                                     │
                                                     └──devolver──▶ RETURNED
                                                                       │
                                                          crea revisión nueva
                                                                       ▼
                                                                    DRAFT (n+1)
```

`RETURNED → DRAFT` **crea otra revisión**, no recicla la anterior. La UI muestra el historial completo con la evaluación de cada revisión.

Quién puede editar y descargar, por estado:

| Estado | Edita archivos/notas | Descarga | Acción principal |
|---|:---:|:---:|---|
| `DRAFT` | dueño | dueño | Enviar |
| `SUBMITTED` | nadie | dueño + mentor | Tomar revisión |
| `UNDER_REVIEW` | nadie | dueño + reviewer | Evaluar o devolver |
| `RETURNED` | nadie | dueño + reviewer | Crear siguiente revisión |
| `EVALUATED` | nadie | dueño + reviewer | Consultar feedback |

### Archivo — `scanStatus`

```
PENDING ──▶ CLEAN | REJECTED | ERROR
```

| Estado | Etiqueta | Qué muestra la UI |
|---|---|---|
| `PENDING` | Analizando | Chip con progreso; **el botón de enviar espera**, con la razón visible |
| `CLEAN` | Listo | Sin chip: es lo normal |
| `REJECTED` | Bloqueado | El archivo no se puede enviar; se ofrece quitarlo y subir otro |
| `ERROR` | No se pudo analizar | Se ofrece reintentar; no se envía en silencio |

Enviar exige **todos los archivos `CLEAN`**. Un botón deshabilitado sin explicación es el peor patrón posible aquí: siempre se dice qué falta.
