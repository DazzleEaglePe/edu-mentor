# AGENTS.md — EDU-MENTOR

## Contexto obligatorio

Antes de modificar código o contratos:

1. leer `CLAUDE.md`;
2. leer `docs/00-project-charter.md`;
3. leer `docs/05-gap-analysis.md`;
4. leer `docs/11-contract-decisions.md`;
5. leer `docs/13-technology-version-matrix.md` antes de tocar dependencias;
6. revisar el gate activo en `docs/07-checklist-master.md`;
7. respetar `docs/09-claude-code-coordination.md`.

## Alcance activo

El piloto implementa:

- soporte mínimo: autenticación, usuarios/roles, oleadas y enrollments;
- Agenda y Sesiones;
- Entregables y Evaluaciones;
- notificaciones necesarias para esos flujos.

No implementar todavía:

- Job Search Tracking;
- Demo Day completo;
- certificados;
- postulación/scoring;
- IA de CV/LinkedIn;
- citas psicológicas;
- pantallas futuras aunque aparezcan en prompts de referencia.

## Reglas técnicas

- Monolito modular; no microservicios.
- TypeScript estricto.
- Controllers sin lógica de negocio.
- Services aplican reglas y ownership.
- Repositories encapsulan Prisma.
- Un módulo no importa internals de otro.
- Cambios de API, estados o modelo de datos requieren actualizar contratos y checklist.
- `docs/11-contract-decisions.md` es la baseline técnica; una decisión `PENDIENTE_PRODUCTO` no se presenta como aprobada.
- No confundir `oleada_id` con una frontera real de multi-tenancy.
- No almacenar secretos, archivos subidos ni datos personales reales en Git.

## Coordinación

- Codex mantiene planificación, contratos, checklist, roadmap y revisión técnica.
- Claude Code trabaja principalmente en diseño/UX y `apps/web`.
- `packages/shared-types` y contratos API son zona compartida: cualquier cambio requiere revisión cruzada.
- No editar simultáneamente el mismo archivo desde dos agentes.
