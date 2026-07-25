# Checkpoint · Acceso multi-tenant y seed reproducible

Fecha: 2026-07-25

Fase: 1 · Fundaciones

Rama: `agent/phase1-core-access`

PR: [#4](https://github.com/DazzleEaglePe/edu-mentor/pull/4)

Estado del gate: slice cerrado; Fase 1 continúa.

## Resultado

La policy creada en el slice de autenticación ya protege un recurso funcional:

1. seed sintético explícito para dos organizaciones;
2. usuarios `PARTICIPANT`, `MENTOR` y `ADMIN`;
3. capacidades `SPECIALIST` y `PEER`;
4. oleada, enrollment y mentor assignment coherentes;
5. `GET /admin/users` limitado a la organización autenticada;
6. `PATCH /admin/users/{userId}` con roles múltiples;
7. optimistic locking mediante `expectedVersion`;
8. ocultamiento cross-organization con `404 RESOURCE_NOT_FOUND`;
9. auditoría before/after en la misma transacción;
10. revocación de sesiones al desactivar una cuenta;
11. fixture `ParticipantDashboard` coherente para frontend;
12. bloqueo del seed sintético en producción.

El runtime del dashboard no se adelantó. Sus fuentes de sesiones y entregables permanecen en Fases
2 y 3.

## Invariantes demostradas

| Riesgo | Control | Evidencia |
|---|---|---|
| Un admin enumera otro tenant | `WHERE organizationId` en lista | Solo devuelve 3 usuarios; excluye el cuarto |
| Un admin modifica otro tenant | policy + scoping defensivo en repository | Mismo 404 que un recurso ausente |
| Un participante usa administración | guard `ADMIN` | GET devuelve 403 |
| Dos ediciones se pisan | `WHERE version = expectedVersion` | Primera escritura crea v2; repetir v1 devuelve 409 |
| Una cuenta desactivada conserva acceso | revocación transaccional de sesiones | Invariante implementada en repository |
| La mutación queda sin trazabilidad | audit log transaccional | actor, entidad, before/after y trace ID verificados |
| El seed duplica registros | upsert + baseline determinista | Se ejecuta dos veces antes de la suite HTTP |
| Datos demo llegan a producción | guard `NODE_ENV=production` | El comando termina con error sanitizado |

## Hallazgo de CI

El primer run aplicó migraciones, ejecutó auth y completó el seed dos veces, pero
`GET /admin/users` devolvió 500.

La causa no era PostgreSQL ni Prisma. Los tests HTTP arrancan Nest con `tsx`, que no emite el
metadata de parámetros que sí genera `tsc`. El DTO de query no se transformó y `limit=20` llegó a
Prisma como string.

Se extrajo una fábrica común de `ValidationPipe` y los controllers fijan explícitamente
`expectedType`. Así:

- `tsx` y el build productivo validan la misma clase;
- `limit` se transforma a número;
- `limit=101` tiene una regresión que exige 422;
- auth conserva la misma validación explícita en ambos runtimes.

## Evidencia reproducible

Validación local:

```text
pnpm_check=ok
format_check=ok
eslint=ok
openapi_lint=ok
typecheck=ok
unit_tests=25_passed
build=ok
prisma_schema=valid
production_seed_guard=blocked
```

Validación real:

```text
github_ci_run=30177425838
quality_job=passed_in_47s
data_runtime_job=passed_in_61s
migrations_applied=1
existing_integration_tests=2_passed
synthetic_seed_runs=2_passed
core_access_http_tests=1_passed
data_runtime_smoke=ok
pr_mergeable=MERGEABLE
pr_merge_state=CLEAN
```

Evidencia:
[GitHub Actions run 30177425838](https://github.com/DazzleEaglePe/edu-mentor/actions/runs/30177425838).

## Conceptos aprendidos

- seed vs. fixture vs. migración;
- idempotencia y estado convergente;
- RBAC vs. tenant scoping vs. ownership;
- ocultamiento 404 para evitar enumeración;
- optimistic locking y lost updates;
- auditoría transaccional;
- diferencias entre el runtime de tests y el build productivo.

Lección:
[Datos sintéticos, multi-tenancy y optimistic locking](../learning/05-multi-tenant-data-and-optimistic-locking.md).

## Límites explícitos

- `POST /admin/users` y password reset todavía no están implementados.
- Oleadas, enrollments y assignments existen en schema/seed, pero no tienen todavía operaciones
  administrativas runtime.
- El seed es solo para desarrollo/CI; antes del piloto se necesita provisionamiento explícito de
  roles y del primer admin.
- Secret scanning y dependency audit siguen pendientes.
- El dashboard continúa como fixture hasta que Agenda y Entregables aporten fuentes reales.

## Siguiente slice backend

1. implementar creación de usuario y reset administrativo;
2. publicar gestión mínima de oleadas y enrollments;
3. cerrar mentor assignments con vigencia e historial;
4. añadir secret scanning y dependency audit;
5. integrar auth real en `apps/web` cuando el slice frontend esté reconciliado.
