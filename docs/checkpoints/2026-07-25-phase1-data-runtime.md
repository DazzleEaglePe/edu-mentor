# Checkpoint · Runtime de datos y readiness

Fecha: 2026-07-25
Fase: 1 · Fundaciones
Rama: `agent/phase1-data-runtime`
Estado del gate: en curso.

## Resultado

Se implementó un slice backend aislado del trabajo de Claude en `apps/web`:

1. `compose.yaml` con PostgreSQL y Redis limitados a loopback;
2. tags exactos y manifests multi-arquitectura fijados por digest;
3. migración inicial versionada para los 12 modelos fundacionales;
4. constraints SQL de capacidad, periodos, versiones, semanas y expiración;
5. `DatabaseModule` con `PrismaPg` y pool PostgreSQL;
6. `RedisModule` con conexión explícita y timeout corto;
7. configuración runtime tipada y fail-closed en producción;
8. readiness concurrente de PostgreSQL/Redis;
9. liveness independiente de dependencias;
10. scripts raíz para levantar infraestructura y aplicar migraciones.

## Semántica observable

| Caso | Endpoint | Resultado |
|---|---|---|
| El proceso Nest responde | `/api/v1/health/live` | `200 {"service":"api","status":"ok"}` |
| PostgreSQL o Redis no responde | `/api/v1/health/ready` | `503 SERVICE_NOT_READY` |
| Ambas dependencias responden | `/api/v1/health/ready` | `200` con ambas en `ok` |

El error 503 solo muestra `postgres|redis = unavailable`; no devuelve hostname, puerto, credenciales, stack ni mensaje del driver.

## Hallazgo durante la prueba

El primer smoke test devolvió 500 en modo `tsx` aunque TypeScript compilaba. La causa fue que `tsx` no aporta al controller el mismo metadata de constructor que emite `tsc`; Nest recibió la dependencia como `undefined`.

Se corrigió usando `@Inject(HealthService)` explícito. El smoke test posterior devolvió el 503 contratado. Esto demuestra por qué el build y la prueba runtime cumplen funciones distintas.

## Evidencia disponible

```text
postgres_image=16.14-bookworm@sha256:92620d...
redis_image=8.2.7-bookworm@sha256:d30960f...
compose_services=2
compose_yaml=ok
prisma_models=12
prisma_migration_generated=yes
prisma_provider_lock=postgresql
foundation_check_constraints=10
github_ci_run=30172807828
github_quality_job=passed_in_42s
github_data_runtime_job=passed_in_58s
prisma_migrate_deploy=ok
prisma_migrate_status=up_to_date
database_integration_tests=1_passed
runtime_config_tests=4_passed
health_service_tests=2_passed
total_api_tests=12_passed
runtime_liveness_without_dependencies=200
runtime_readiness_without_dependencies=503
runtime_readiness_code=SERVICE_NOT_READY
runtime_dependency_details_sanitized=yes
runtime_liveness_with_dependencies=200
runtime_readiness_with_dependencies=200
runtime_postgres_status=ok
runtime_redis_status=ok
frozen_install=ok
format_check=ok
eslint=ok
openapi_lint=ok
typecheck=ok
build=ok
local_markdown_links=54
broken_local_markdown_links=0
```

La evidencia positiva se ejecutó en [GitHub Actions](https://github.com/DazzleEaglePe/edu-mentor/actions/runs/30172807828), usando exactamente las imágenes fijadas en Compose.

## Límite explícito

Docker, Podman, Colima, `psql` y `postgres` no están disponibles en el entorno local actual. La ejecución real fue trasladada a CI y permite cerrar los checkboxes técnicos, pero aún quedan pendientes:

- probar el flujo manual local cuando exista Docker;
- comprobar persistencia de volúmenes después de reiniciar;
- medir consumo de RAM;
- configurar `vm.overcommit_memory=1` en el host Linux del piloto, advertido por Redis;
- crear seed sintético reproducible.

## Siguiente slice

1. crear seed sintético de organización/roles;
2. iniciar auth session con rotación y revocación;
3. implementar el primer repository con scoping por organización;
4. probar ownership negativo.
