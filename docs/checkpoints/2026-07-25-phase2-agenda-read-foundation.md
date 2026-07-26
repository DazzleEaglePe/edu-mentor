# Checkpoint · Fundación de Agenda y lecturas por rol

Fecha: 2026-07-25

Fase: 2 · Agenda y Sesiones

Rama: `agent/phase2-agenda-sessions`

PR: [#7](https://github.com/DazzleEaglePe/edu-mentor/pull/7)

Base apilada: `agent/phase1-admin-program-setup` · PR #6

Estado: primer incremento de Agenda verificado; las mutaciones continúan en el siguiente slice.

## Resultado

1. modelos `Session`, `SessionParticipant`, `SessionRescheduleRequest`, `ScheduleReservation` y
   `SessionReminder`;
2. invariantes SQL para fase/semana/checkpoint, intervalos, confirmación, asistencia, versiones,
   decisiones de reprogramación y locks de recordatorio;
3. exclusion constraint para impedir reservas vivas superpuestas;
4. seed sintético alineado con `docs/api/fixtures/session.detail.json`;
5. `GET /sessions` paginado y filtrable;
6. `GET /sessions/calendar` liviano por rango;
7. `GET /sessions/{sessionId}` con ocultamiento de recursos ajenos;
8. scoping por organización y unión de roles `ADMIN|MENTOR|PARTICIPANT`;
9. `confirmationSummary` derivado y `canConfirm` contextual;
10. pruebas unitarias e integración HTTP/PostgreSQL.

## Evidencia

```text
local_pnpm_check=ok
local_unit_tests=53_passed
prisma_schema=valid
github_ci_run=30181155955
quality_job=passed_in_55s
data_runtime_job=passed
migrations_applied=3
session_read_integrations=4_passed
schedule_overlap_constraint=passed
pr_mergeable=MERGEABLE
```

[GitHub Actions run 30181155955](https://github.com/DazzleEaglePe/edu-mentor/actions/runs/30181155955)

## Alcance deliberadamente pendiente

- creación idempotente 1:1 y grupal;
- confirmación y asistencia;
- cancelación, completado y reprogramación;
- outbox/recordatorios;
- auditoría de mutaciones;
- pruebas concurrentes de los flujos HTTP de escritura;
- integración y revisión visual del frontend.

## Conceptos aprendidos

- agregado de sesión vs. reserva de recurso;
- rangos temporales semiabiertos;
- exclusion constraints frente a condiciones de carrera;
- autorización aplicada dentro de la consulta;
- ocultamiento de existencia con `404`;
- campos derivados y contextuales.

Lección:
[Reservas temporales y lecturas limitadas por rol](../learning/10-temporal-reservations-and-role-scoped-reads.md).

## Siguiente

1. crear una sesión 1:1 de forma idempotente y transaccional;
2. reservar mentor y enrollment en la misma transacción;
3. traducir el conflicto SQL a `409 SCHEDULE_CONFLICT` sin filtrar sesiones ajenas;
4. confirmar participación con `expectedVersion`;
5. conectar las pantallas de Agenda cuando el transporte autenticado esté disponible.
