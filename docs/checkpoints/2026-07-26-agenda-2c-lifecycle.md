# Checkpoint · Agenda 2C — Transiciones de sesión y solicitudes de reprogramación

Fecha: 2026-07-26  
Fase: 2 · Agenda  
Estado del gate: en curso.

## Resultado

Se implementó el ciclo de vida completo de Agenda 2C en `apps/api` sin modificar `apps/web` ni `docs/design/**`:

1. **Completar sesión** (`POST /sessions/{id}/complete`):
   - Transición `SCHEDULED → COMPLETED` con validación de horario transcurrido (`now >= startsAt`), `expectedVersion` y ownership (Mentor/Admin).
   - Generación atómica de `AuditLog` (`session.completed`) y `OutboxEvent`.

2. **Cancelar sesión** (`POST /sessions/{id}/cancel`):
   - Transición `SCHEDULED → CANCELLED` con motivo requerido (3-1000 caracteres), `expectedVersion` y liberación inmediata de `ScheduleReservation` y reminders pendientes.
   - Generación atómica de `AuditLog` (`session.cancelled`) y `OutboxEvent`.

3. **Reprogramación directa** (`POST /sessions/{id}/reschedule`):
   - Transición `SCHEDULED → RESCHEDULED` de la sesión original, creación atómica de sesión reemplazo con `rescheduledFromId`, migración de reservas y reminders.
   - Prevención estricta de traslapes mediante `409 SCHEDULE_CONFLICT` sin exponer datos ajenos.

4. **Flujo de solicitudes de reprogramación (`SessionRescheduleRequest`)**:
   - `POST /sessions/{id}/reschedule-requests`: Solicitud `PENDING` creada por participante. Invariante duradera: máximo una solicitud `PENDING` por participante y sesión.
   - `GET /reschedule-requests`: Listado paginado con filtros por `status` y scoping estricto por rol (Participante ve las suyas, Mentor las de sus sesiones, Admin las de la organización).
   - `POST /reschedule-requests/{requestId}/approve`: Aprobación atómica por mentor/admin con verificación concurrente de `expectedSessionVersion` y `expectedRequestVersion`.
   - **Invariante Crítica §3**: Un conflicto de horario al aprobar devuelve `409 SCHEDULE_CONFLICT` y **mantiene la solicitud en estado PENDING** (sin aprobaciones parciales).
   - `POST /reschedule-requests/{requestId}/reject`: Rechazo por mentor/admin con motivo registrado en auditoría.
   - `POST /reschedule-requests/{requestId}/cancel`: Cancelación de solicitud propia por el participante.

5. **Fixtures compartidos publicados**:
   - [docs/api/fixtures/reschedule-request.json](file:///Users/dazzleeaglepe/Desktop/Software%20Engineer%20Projects/1.%20EduMentor/docs/api/fixtures/reschedule-request.json)
   - [docs/api/fixtures/session.rescheduled.json](file:///Users/dazzleeaglepe/Desktop/Software%20Engineer%20Projects/1.%20EduMentor/docs/api/fixtures/session.rescheduled.json)

## Evidencia

```text
dto_validation=ok
openapi_contracts=aligned
domain_invariants_sec3=enforced
idempotency_key_support=yes
optimistic_concurrency_version=enforced
session_complete_endpoint=ok
session_cancel_endpoint=ok
session_reschedule_endpoint=ok
reschedule_requests_crud=ok
unit_tests_sessions=15_passed
```

## Próximo slice de Backend (Antigravity)

1. Fase 3: Entregables, Consignas y Evaluaciones (`apps/api/src/modules/deliverables`).
2. Módulo de entregas con máquina de estados (`DRAFT → SUBMITTED → UNDER_REVIEW → EVALUATED / RETURNED`).
