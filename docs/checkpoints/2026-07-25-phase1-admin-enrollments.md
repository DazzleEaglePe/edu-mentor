# Checkpoint · Enrollments y cupos concurrentes

Fecha: 2026-07-25

Fase: 1 · Fundaciones

Rama: `agent/phase1-admin-program-setup`

PR: [#6](https://github.com/DazzleEaglePe/edu-mentor/pull/6)

Base apilada: `agent/phase1-admin-user-lifecycle` · PR #5

Estado: sub-slice Enrollments cerrado; setup administrativo continúa.

## Resultado

1. `GET /admin/enrollments` con paginación, filtros y scoping por organización;
2. `POST /admin/enrollments` idempotente;
3. validación de usuario activo con rol `PARTICIPANT`;
4. validación de oleada accesible y no cerrada;
5. unicidad persona/oleada;
6. cupo protegido con el mismo row lock usado al editar capacidad;
7. `PATCH /admin/enrollments/{enrollmentId}` con `expectedVersion`;
8. estado `ACTIVE → WITHDRAWN|COMPLETED`, con terminales de solo lectura;
9. fase lineal `FASE_0 → FASE_1 → FASE_2 → FINISHED`;
10. semana limitada a Fase 1 y graduación fechada al entrar en Fase 2;
11. auditoría before/after y aislamiento cross-organization;
12. reserva idempotente revertida junto con cualquier fallo de negocio.

## Evidencia

```text
local_pnpm_check=ok
local_unit_tests=44_passed
prisma_schema=valid
github_ci_run=30179731503
quality_job=passed
data_runtime_job=passed_in_1m13s
enrollment_last_slot_race=passed
seed_integrations=4_passed
pr_mergeable=MERGEABLE
pr_merge_state=CLEAN
```

[GitHub Actions run 30179731503](https://github.com/DazzleEaglePe/edu-mentor/actions/runs/30179731503)

## Carrera probada

Dos participantes compiten por una oleada de capacidad 1:

1. un request obtiene `201`;
2. el otro obtiene `409 OLEADA_CAPACITY_REACHED`;
3. queda una sola inscripción activa;
4. queda una sola auditoría y una sola respuesta idempotente;
5. la reserva perdedora se revierte;
6. al retirar al ganador, el mismo request perdedor y la misma key pueden completar con `201`;
7. el siguiente replay devuelve exactamente la respuesta guardada.

## Errores estables nuevos

| Código | Significado |
|---|---|
| `ENROLLMENT_TARGET_INVALID` | persona u oleada no accesible en el tenant |
| `USER_NOT_ELIGIBLE_FOR_ENROLLMENT` | persona inactiva o sin rol participante |
| `OLEADA_CAPACITY_REACHED` | no queda cupo activo |
| `ENROLLMENT_ALREADY_EXISTS` | ya existe el par persona/oleada |
| `ENROLLMENT_TERMINAL` | inscripción retirada/completada de solo lectura |
| `INVALID_ENROLLMENT_STATUS_TRANSITION` | transición operativa no permitida |
| `INVALID_PHASE_TRANSITION` | salto o retroceso de fase |
| `PHASE_WEEK_MISMATCH` | semana informada fuera de Fase 1 |

También se reutilizan `OLEADA_CLOSED`, `IDEMPOTENCY_KEY_REUSED`, `VERSION_CONFLICT` y `FORBIDDEN`.

## Conceptos aprendidos

- invariant que abarca múltiples filas;
- row lock como frontera de serialización;
- rollback de reserva idempotente;
- concurrencia pesimista y optimista combinadas;
- ejes independientes de estado y fase;
- prueba de carrera HTTP sobre PostgreSQL real.

Lección:
[Invariantes transaccionales en enrollments](../learning/08-enrollment-transactional-invariants.md).

## Siguiente

1. publicar gestión runtime de mentor assignments;
2. validar mentor activo, rol y capability;
3. soportar alcance de oleada o enrollment;
4. cerrar asignación sin borrar historial;
5. probar carreras de asignación y aislamiento multi-tenant.
