# EDU-MENTOR

Plataforma digital para operar y visibilizar el programa de mentoría y empleabilidad EDU-MENTOR de EDU-US.

## Ubicación

```text
/Users/dazzleeaglepe/Desktop/Software Engineer Projects/1. EduMentor
```

## Estado

Diseño y backend ya comparten contratos. Fase 0 mantiene decisiones de Producto pendientes y, en paralelo, avanzó la fundación técnica de Fase 1: workspace pnpm, API Nest, tipos OpenAPI, migraciones Prisma, PostgreSQL/Redis, auth revocable, seed por rol y setup administrativo de usuarios, oleadas y enrollments con aislamiento multi-tenant, idempotencia y control concurrente de cupos. `apps/web` permanece bajo ownership de Claude Code.

## Documentos de entrada

- [CLAUDE.md](./CLAUDE.md)
- [Índice de documentación](./docs/README.md)
- [Checklist maestro](./docs/07-checklist-master.md)
- [Roadmap](./docs/08-roadmap.md)
- [Baseline de decisiones](./docs/11-contract-decisions.md)
- [Máquinas de estado](./docs/12-domain-state-machines.md)
- [Matriz tecnológica](./docs/13-technology-version-matrix.md)
- [OpenAPI y fixtures](./docs/api/README.md)
- [Cierre de reconciliación de contratos](./docs/checkpoints/2026-07-25-contract-reconciliation-closure.md)
- [Scaffold técnico de Fase 1](./docs/checkpoints/2026-07-25-phase1-foundation-scaffold.md)
- [Persistencia y observabilidad iniciales](./docs/checkpoints/2026-07-25-phase1-data-and-http-foundations.md)
- [Runtime de datos y readiness](./docs/checkpoints/2026-07-25-phase1-data-runtime.md)
- [Acceso multi-tenant y seed reproducible](./docs/checkpoints/2026-07-25-phase1-core-access.md)
- [Ciclo administrativo idempotente de usuarios](./docs/checkpoints/2026-07-25-phase1-admin-user-lifecycle.md)
- [Oleadas idempotentes y estados protegidos](./docs/checkpoints/2026-07-25-phase1-admin-oleadas.md)
- [Enrollments y protección concurrente de cupos](./docs/checkpoints/2026-07-25-phase1-admin-enrollments.md)
- [Lección L01](./docs/learning/01-domain-modeling-and-state-machines.md)
- [Lección L02](./docs/learning/02-persistence-and-observability.md)
- [Lección L03](./docs/learning/03-runtime-migrations-and-health-checks.md)
- [Lección de multi-tenancy y optimistic locking](./docs/learning/05-multi-tenant-data-and-optimistic-locking.md)
- [Lección de idempotencia y reset de credenciales](./docs/learning/06-idempotent-user-creation-and-credential-reset.md)
- [Lección de estados y concurrencia de capacidad](./docs/learning/07-cohort-state-and-capacity-concurrency.md)
- [Lección de invariantes transaccionales en enrollments](./docs/learning/08-enrollment-transactional-invariants.md)
- [Coordinación con Claude Code](./docs/09-claude-code-coordination.md)

`newfiles.zip` se conserva como snapshot de contexto; los documentos extraídos son la fuente de trabajo.

## Comandos de desarrollo

Requisitos: Node 24 y pnpm 11.17.0.

```bash
pnpm install --frozen-lockfile
pnpm generate
pnpm --filter @edu-mentor/api db:validate
pnpm check
cp .env.example .env
pnpm infra:up
pnpm db:migrate
pnpm db:seed
pnpm dev:api
```

`pnpm infra:down` detiene los servicios sin borrar los volúmenes locales.
`pnpm db:seed` carga exclusivamente el baseline sintético de desarrollo/CI y se bloquea en
`NODE_ENV=production`.

Health checks locales:

```text
GET http://localhost:3001/api/v1/health/live
GET http://localhost:3001/api/v1/health/ready
```

`live` indica que el proceso responde. `ready` solo devuelve `200` cuando PostgreSQL y Redis están disponibles; en caso contrario devuelve `503 SERVICE_NOT_READY`.
