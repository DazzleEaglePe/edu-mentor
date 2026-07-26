# Checkpoint · Vertical 2A de Agenda 1:1

Fecha: 2026-07-25

Fase: 2 · Agenda y Sesiones

Rama: `agent/phase2-agenda-sessions`

PR: [#7](https://github.com/DazzleEaglePe/edu-mentor/pull/7)

Base apilada: `agent/phase1-admin-program-setup` · PR #6

Estado: vertical crear → consultar → confirmar 1:1 verificada.

## Resultado

1. `POST /sessions` autorizado para `MENTOR|ADMIN`;
2. mentor usa su identidad y admin puede seleccionar mentor;
3. elegibilidad y asignación `SPECIALIST` vigentes para cada participante;
4. validación de fase, semana/checkpoint, timezone, tipo y cantidad de participantes;
5. request canónico e idempotencia con replay del `201`;
6. sesión, participante, reservas, auditoría, outbox e idempotencia en una transacción;
7. precheck de horario y exclusion constraint como autoridad concurrente;
8. `409 SCHEDULE_CONFLICT` tipado y redactado según permisos;
9. `PUT /sessions/{id}/participants/me/confirmation` con ventana y `expectedVersion`;
10. `PUT` repetido sin cambio no incrementa versión ni duplica efectos;
11. confirmación y asistencia permanecen separadas;
12. locks compatibles con confirmaciones paralelas de una futura sesión grupal.

## Evidencia

```text
local_pnpm_check=ok
local_unit_tests=58_passed
github_ci_run=30182049378
quality_job=passed_in_51s
data_runtime_job=passed_in_1m26s
seed_integration_tests=12_passed
one_to_one_workflow_tests=3_passed
idempotent_replay=passed
confirmation_version_and_cutoff=passed
schedule_race=one_201_and_one_409
live_reservations_after_race=2
pr_mergeable=MERGEABLE
```

[GitHub Actions run 30182049378](https://github.com/DazzleEaglePe/edu-mentor/actions/runs/30182049378)

La evidencia de PostgreSQL muestra el `23P01` real de
`schedule_reservation_no_overlap` durante la carrera; la API lo convirtió en el conflicto estable
del contrato.

## Errores estables implementados

| Código | Significado |
|---|---|
| `SESSION_TARGET_INVALID` | oleada, mentor o enrollment no disponible |
| `PHASE_PERIOD_MISMATCH` | semana/checkpoint incompatible con fase |
| `SESSION_PARTICIPANT_COUNT_INVALID` | cantidad incompatible con 1:1 o grupal |
| `PARTICIPANT_PHASE_MISMATCH` | enrollment activo en otra fase |
| `MENTOR_NOT_ELIGIBLE_FOR_SESSION` | mentor sin rol/perfil/capability |
| `MENTOR_NOT_ASSIGNED` | mentor sin alcance vigente |
| `SCHEDULE_CONFLICT` | reserva temporal ocupada |
| `IDEMPOTENCY_KEY_REUSED` | misma key con otro request |
| `VERSION_CONFLICT` | confirmación basada en versión antigua |
| `CONFIRMATION_CLOSED` | cutoff alcanzado |
| `SESSION_NOT_SCHEDULED` | estado global ya no editable |

## Alcance deliberadamente pendiente

- sesión grupal y checkpoint demostrados por integración;
- asistencia;
- reprogramación directa y por solicitud;
- cancelación y completado;
- recordatorios y worker de entrega;
- conexión del frontend al transporte autenticado;
- revisión visual responsive.

## Conceptos aprendidos

- agregado transaccional;
- idempotencia semántica;
- rollback de una reserva provisional;
- precheck vs. constraint autoritativo;
- locks compartidos y exclusivos;
- optimistic concurrency;
- transactional outbox.

Lección:
[Creación idempotente y confirmación concurrente](../learning/11-idempotent-session-creation-and-confirmation.md).

## Siguiente

1. demostrar creación grupal y confirmaciones independientes;
2. implementar registro de asistencia;
3. crear checkpoint con reglas de Fase 2;
4. continuar con reprogramación preservando el historial;
5. validar A6/A7/A8 cuando Claude entregue su handoff.
