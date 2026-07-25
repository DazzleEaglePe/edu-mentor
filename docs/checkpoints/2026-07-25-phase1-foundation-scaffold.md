# Checkpoint · Scaffold técnico de Fase 1

Fecha: 2026-07-25
Fase: 1 · Fundaciones
Estado del gate: en curso; no implica cierre de Gate 0 ni aprobación de Producto.

## Resultado

Se creó una base ejecutable sin editar `apps/web` ni `docs/design/**`, que continúan bajo ownership de Claude Code.

Entregado:

1. workspace pnpm 11.17.0 con lockfile único;
2. configuración TypeScript 6.0.3 estricta y compartida;
3. ESLint, Prettier y comandos raíz;
4. CI para instalación congelada y pipeline completo;
5. API NestJS modular mínima;
6. health checks de liveness y readiness;
7. feature flags tipados y fail-closed;
8. generación de `packages/shared-types` desde OpenAPI;
9. prueba unitaria inicial del parser de feature flags.

## Evidencia

```text
pnpm_version=11.17.0
node_local=v24.14.0
workspace_projects=5
openapi_operations=57
openapi_generation=ok
format_check=ok
eslint=ok
openapi_redocly_errors=0
openapi_redocly_warnings=0
typecheck=ok
tests=3_passed
tests_failed=0
build_api=ok
build_shared_types=ok
GET /api/v1/health/live={"service":"api","status":"ok"}
GET /api/v1/health/ready={"service":"api","status":"ok"}
```

CI repetirá el scaffold con Node 24.18.0, que es la versión objetivo. El Node local disponible es la misma major LTS, pero un patch anterior.

## Decisión de tooling

El producto compila con TypeScript 6.0.3. `openapi-typescript` 7.13.0 todavía declara peer `^5.x`, por lo que el generador vive aislado en `tools/openapi-generator` con TypeScript 5.9.3. El archivo generado se consume y valida después con TypeScript 6.0.3.

Este aislamiento evita dos malas prácticas:

- ignorar silenciosamente un peer dependency incompatible;
- rebajar todo el monorepo a TypeScript 5 solo por una herramienta de generación.

pnpm también bloqueó inicialmente el postinstall de `esbuild`. Se revisó que pertenece a `tsx` y se autorizó explícitamente en `allowBuilds`; no existe una autorización global de scripts.

## Archivos principales

- `package.json`
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`
- `.github/workflows/ci.yml`
- `packages/config/tsconfig/base.json`
- `packages/shared-types/src/generated/openapi.ts`
- `apps/api/src/main.ts`
- `apps/api/src/config/feature-flags.ts`
- `apps/api/src/modules/health/*`

## Límites actuales

- `apps/web` todavía no existe y pertenece a Claude Code.
- Readiness solo prueba que el proceso Nest inició; incorporará Postgres y Redis al configurarlos.
- Al cerrar este checkpoint aún no existían Prisma, migraciones, auth, RBAC, ownership ni auditoría. El avance posterior de Prisma y observabilidad está documentado en `2026-07-25-phase1-data-and-http-foundations.md`.
- El pipeline CI está configurado, pero solo podrá declararse “CI verde” después de ejecutarse en el proveedor.
- No se creó commit porque el baseline compartido continúa sin commit inicial.

## Siguiente slice técnico

1. Docker Compose local con PostgreSQL y Redis;
2. Prisma 7 con adapter PostgreSQL;
3. health/readiness real de dependencias;
4. manejo uniforme de errores y `traceId`;
5. primer vertical slice de auth session.
