# Documentación EDU-MENTOR

## Contexto y contratos

| Documento | Propósito |
|---|---|
| [00-project-charter.md](./00-project-charter.md) | Problema, alcance, actores, objetivos y Definition of MVP |
| [01-arquitectura-tecnica.md](./01-arquitectura-tecnica.md) | Arquitectura y stack propuestos |
| [02-modelo-datos.md](./02-modelo-datos.md) | Modelo conceptual de datos |
| [03-api-design.md](./03-api-design.md) | Contrato REST inicial |
| [04-prompts-uxui.md](./04-prompts-uxui.md) | Referencias para exploración UX/UI |

## Ejecución

| Documento | Propósito |
|---|---|
| [05-gap-analysis.md](./05-gap-analysis.md) | Brechas y decisiones que deben cerrarse |
| [06-implementation-plan.md](./06-implementation-plan.md) | Plan por fases y gates |
| [07-checklist-master.md](./07-checklist-master.md) | Fuente de verdad del avance |
| [08-roadmap.md](./08-roadmap.md) | Secuencia de entregas y dependencias |
| [09-claude-code-coordination.md](./09-claude-code-coordination.md) | División de trabajo y protocolo de handoff |
| [10-ai-engineer-learning-track.md](./10-ai-engineer-learning-track.md) | Aprendizaje técnico y evidencia profesional |
| [11-contract-decisions.md](./11-contract-decisions.md) | Baseline técnica y respuesta a CCR de diseño |
| [12-domain-state-machines.md](./12-domain-state-machines.md) | Estados, transiciones, actores e invariantes |
| [13-technology-version-matrix.md](./13-technology-version-matrix.md) | Versiones, compatibilidad y evidencia del spike |
| [api/README.md](./api/README.md) | OpenAPI inicial y fixtures sintéticos compartidos |
| [learning/01-domain-modeling-and-state-machines.md](./learning/01-domain-modeling-and-state-machines.md) | Primera lección práctica del track AI Engineer |
| [learning/02-persistence-and-observability.md](./learning/02-persistence-and-observability.md) | Schema, migraciones, concurrencia, auditoría y trace ID |
| [learning/03-runtime-migrations-and-health-checks.md](./learning/03-runtime-migrations-and-health-checks.md) | Compose, digests, migraciones aplicadas y semántica live/ready |
| [learning/04-authentication-sessions-and-authorization.md](./learning/04-authentication-sessions-and-authorization.md) | Sesiones, rotación refresh, cookies, CSRF, RBAC y ownership |
| [learning/05-multi-tenant-data-and-optimistic-locking.md](./learning/05-multi-tenant-data-and-optimistic-locking.md) | Seed reproducible, autorización multi-tenant y control de versiones |
| [learning/06-idempotent-user-creation-and-credential-reset.md](./learning/06-idempotent-user-creation-and-credential-reset.md) | Idempotencia concurrente, HMAC, credenciales temporales y revocación |
| [learning/07-cohort-state-and-capacity-concurrency.md](./learning/07-cohort-state-and-capacity-concurrency.md) | Máquinas de estado, locks de fila, capacidad y versiones |
| [learning/08-enrollment-transactional-invariants.md](./learning/08-enrollment-transactional-invariants.md) | Cupos concurrentes, rollback idempotente y transiciones de inscripción |
| [learning/09-temporal-mentor-assignments.md](./learning/09-temporal-mentor-assignments.md) | Alcance nullable, vigencia derivada y cierre sin borrado |
| [checkpoints/2026-07-25-planning-baseline.md](./checkpoints/2026-07-25-planning-baseline.md) | Primer checkpoint de planificación |
| [checkpoints/2026-07-25-technical-contract-baseline.md](./checkpoints/2026-07-25-technical-contract-baseline.md) | Contratos, estados, matriz y evidencia del spike |
| [checkpoints/2026-07-25-contract-reconciliation-closure.md](./checkpoints/2026-07-25-contract-reconciliation-closure.md) | Cierre de CCR-010–012 y contrato listo para consumo de diseño |
| [checkpoints/2026-07-25-phase1-foundation-scaffold.md](./checkpoints/2026-07-25-phase1-foundation-scaffold.md) | Workspace, API mínima, tipos generados y pipeline inicial |
| [checkpoints/2026-07-25-phase1-data-and-http-foundations.md](./checkpoints/2026-07-25-phase1-data-and-http-foundations.md) | Schema Prisma y frontera HTTP observable |
| [checkpoints/2026-07-25-phase1-data-runtime.md](./checkpoints/2026-07-25-phase1-data-runtime.md) | Runtime PostgreSQL/Redis, migración inicial y readiness real |
| [checkpoints/2026-07-25-phase1-auth-foundation.md](./checkpoints/2026-07-25-phase1-auth-foundation.md) | Auth persistida, rotación/replay, CSRF, guards y evidencia HTTP |
| [checkpoints/2026-07-25-phase1-core-access.md](./checkpoints/2026-07-25-phase1-core-access.md) | Seed por rol, administración multi-tenant y optimistic locking |
| [checkpoints/2026-07-25-phase1-admin-user-lifecycle.md](./checkpoints/2026-07-25-phase1-admin-user-lifecycle.md) | Creación idempotente, reset seguro y prueba concurrente real |
| [checkpoints/2026-07-25-phase1-admin-oleadas.md](./checkpoints/2026-07-25-phase1-admin-oleadas.md) | Oleadas idempotentes, estado lineal y capacidad protegida |
| [checkpoints/2026-07-25-phase1-admin-enrollments.md](./checkpoints/2026-07-25-phase1-admin-enrollments.md) | Enrollments multi-tenant y carrera por el último cupo |
| [checkpoints/2026-07-25-phase1-admin-mentor-assignments.md](./checkpoints/2026-07-25-phase1-admin-mentor-assignments.md) | Asignaciones de mentor con vigencia, scope e historial |

## Regla de precedencia

Si dos documentos se contradicen:

1. decisiones de Producto aprobadas y registradas;
2. baseline técnica de `11-contract-decisions.md`;
3. alcance de `00-project-charter.md`;
4. checklist y plan de implementación;
5. contratos `02`, `03` y `12`;
6. prompts visuales.

Los prompts UX/UI no autorizan funcionalidad fuera del MVP.
