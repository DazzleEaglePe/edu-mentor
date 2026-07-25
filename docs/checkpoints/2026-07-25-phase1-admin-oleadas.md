# Checkpoint · Oleadas idempotentes y estados protegidos

Fecha: 2026-07-25

Fase: 1 · Fundaciones

Rama: `agent/phase1-admin-program-setup`

PR: [#6](https://github.com/DazzleEaglePe/edu-mentor/pull/6)

Base apilada: `agent/phase1-admin-user-lifecycle` · PR #5

Estado: sub-slice Oleadas cerrado; setup administrativo continúa.

## Resultado

1. `GET /admin/oleadas` con paginación, filtro y scoping por organización;
2. `POST /admin/oleadas` idempotente y concurrente;
3. `PATCH /admin/oleadas/{oleadaId}` con `expectedVersion`;
4. fechas de calendario estrictas y rango coherente;
5. `activeEnrollmentCount` calculado en la consulta;
6. capacidad nunca inferior al conteo activo;
7. estado lineal `DRAFT → OPEN → IN_PROGRESS → CLOSED`;
8. `CLOSED` de solo lectura;
9. row lock para coordinar capacidad con el próximo slice de enrollments;
10. auditoría before/after y 404 cross-organization;
11. protocolo de idempotencia extraído a `common/idempotency`.

## Evidencia

```text
local_pnpm_check=ok
local_unit_tests=39_passed
prisma_schema=valid
github_ci_run=30179058108
quality_job=passed_in_52s
data_runtime_job=passed_in_1m11s
seed_integrations=3_passed
oleada_concurrent_http_test=passed
data_runtime_smoke=ok
pr_mergeable=MERGEABLE
pr_merge_state=CLEAN
```

[GitHub Actions run 30179058108](https://github.com/DazzleEaglePe/edu-mentor/actions/runs/30179058108)

## Errores estables nuevos

| Código | Significado |
|---|---|
| `INVALID_DATE_RANGE` | `endDate` es anterior a `startDate` |
| `CAPACITY_BELOW_ACTIVE_ENROLLMENTS` | el nuevo cupo es menor que la ocupación |
| `INVALID_STATUS_TRANSITION` | se intentó saltar o retroceder un estado |
| `OLEADA_CLOSED` | se intentó modificar una oleada terminal |

También se reutilizan `IDEMPOTENCY_KEY_REUSED`, `VERSION_CONFLICT`, `RESOURCE_NOT_FOUND` y
`FORBIDDEN`.

## Conceptos aprendidos

- enum vs. máquina de estados;
- transición válida vs. versión vigente;
- row-level locking;
- frontera de serialización compartida;
- conteos derivados server-side;
- protocolo idempotente reusable.

Lección:
[Estados de oleada y concurrencia de capacidad](../learning/07-cohort-state-and-capacity-concurrency.md).

## Siguiente

1. implementar enrollments usando el mismo lock de oleada;
2. impedir sobrecapacidad bajo carrera;
3. validar usuario/oleada dentro del tenant;
4. aplicar transiciones de fase/estado y `expectedVersion`;
5. implementar luego mentor assignments con vigencia e historial.
