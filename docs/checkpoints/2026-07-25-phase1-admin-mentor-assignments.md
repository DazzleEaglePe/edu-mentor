# Checkpoint · Asignaciones de mentor con vigencia

Fecha: 2026-07-25

Fase: 1 · Fundaciones

Rama: `agent/phase1-admin-program-setup`

PR: [#6](https://github.com/DazzleEaglePe/edu-mentor/pull/6)

Base apilada: `agent/phase1-admin-user-lifecycle` · PR #5

Estado: setup administrativo runtime completo.

## Resultado

1. `GET /admin/mentor-assignments` con paginación, filtros y scoping por organización;
2. `POST /admin/mentor-assignments` idempotente;
3. elegibilidad por usuario activo, rol `MENTOR`, perfil y capability `SPECIALIST`;
4. alcance de oleada completa con `enrollmentId = null`;
5. alcance individual validado contra un enrollment activo de la misma oleada;
6. una asignación activa por alcance/capability;
7. carrera de altas serializada con row lock de oleada;
8. `DELETE /admin/mentor-assignments/{id}?expectedVersion=` como cierre sin borrado;
9. `ACTIVE|CLOSED` derivado de la vigencia;
10. auditoría before/after, versión y aislamiento cross-organization;
11. `PEER` explícitamente fuera del alta operativa del piloto.

## Evidencia

```text
local_pnpm_check=ok
local_unit_tests=49_passed
prisma_schema=valid
github_ci_run=30180049586
quality_job=passed_in_45s
data_runtime_job=passed_in_1m30s
seed_integrations=5_passed
mentor_scope_race=passed
pr_mergeable=MERGEABLE
pr_merge_state=CLEAN
```

[GitHub Actions run 30180049586](https://github.com/DazzleEaglePe/edu-mentor/actions/runs/30180049586)

## Errores estables nuevos

| Código | Significado |
|---|---|
| `INVALID_ASSIGNMENT_PERIOD` | fin anterior al inicio o periodo ya vencido |
| `MENTOR_ASSIGNMENT_TARGET_INVALID` | mentor, oleada o enrollment no accesible |
| `MENTOR_NOT_ELIGIBLE_FOR_ASSIGNMENT` | falta estado activo, rol, perfil o capability |
| `ACTIVE_MENTOR_ASSIGNMENT_EXISTS` | el scope ya tiene una asignación vigente |
| `MENTOR_ASSIGNMENT_CLOSED` | cierre repetido |
| `MENTOR_ASSIGNMENT_NOT_STARTED` | cierre anterior al inicio programado |

También se reutilizan `OLEADA_CLOSED`, `IDEMPOTENCY_KEY_REUSED`, `VERSION_CONFLICT`,
`RESOURCE_NOT_FOUND` y `FORBIDDEN`.

## Conceptos aprendidos

- autorización basada en asignación;
- nullable con significado de dominio;
- estado derivado de vigencia;
- cierre temporal vs. borrado físico;
- reasignación como dos hechos auditables;
- carrera concurrente por un scope lógico.

Lección:
[Alcance temporal en asignaciones de mentor](../learning/09-temporal-mentor-assignments.md).

## Siguiente

1. cerrar la PR apilada cuando sus bases se integren;
2. consumir los endpoints desde A5/A6/A7/A8;
3. iniciar el slice vertical de Agenda y sesiones;
4. mantener las decisiones de Producto pendientes fuera del runtime hasta resolución.
