# Checkpoint · Fase 3 — Entregables, Revisiones y Evaluaciones

Fecha: 2026-07-26  
Fase: 3 · Entregables  
Estado del gate: en curso.

## Resultado

Se implementó el backend completo para el ciclo de entregables y evaluaciones (`apps/api/src/modules/deliverables`) sin modificar `apps/web` ni `docs/design/**`:

1. **Modelos de datos en Prisma (`schema.prisma`)**:
   - Modelos: `Assignment`, `AssignmentRubricCriterion`, `Deliverable`, `DeliverableSubmission`, `SubmissionFile`, `SubmissionEvaluation`, `EvaluationRubricScore`, `AssignmentTopCandidate`.
   - Enums: `SubmissionStatus` (`DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `EVALUATED`, `RETURNED`) y `ScanStatus` (`PENDING`, `CLEAN`, `REJECTED`, `ERROR`).

2. **Máquina de estados e Invariantes (§4)**:
   - `createDeliverable` (`POST /deliverables`): Creación idempotente de entregable y primera revisión en `DRAFT` con `revisionNumber: 1`.
   - `submit` (`POST /deliverables/{id}/submissions/{subId}/submit`): Transición `DRAFT → SUBMITTED` validando escaneo de virus `CLEAN`.
   - `startReview` (`POST /deliverables/{id}/submissions/{subId}/start-review`): Transición `SUBMITTED → UNDER_REVIEW` para el mentor.
   - `evaluate` (`POST /deliverables/{id}/submissions/{subId}/evaluation`): Evaluación con nota 0–100, feedback y desglose por rúbrica. Validación estricta `score <= criterion.maxScore` por criterio. Devuelve `422 SCORE_EXCEEDS_MAX` en caso de exceso.
   - `returnSubmission` (`POST /deliverables/{id}/submissions/{subId}/return`): Transición `UNDER_REVIEW → RETURNED` exigiendo motivo y creando atómicamente la revisión `revisionNumber + 1` en estado `DRAFT`.
   - `setTopCandidates` (`PUT /assignments/{id}/top-candidates`): Selección del Top 3 de entregas por consigna (ranks 1–3) con regla provisional `provisionalRule: true`.

3. **Fixtures publicados**:
   - [docs/api/fixtures/deliverable.evaluated.json](file:///Users/dazzleeaglepe/Desktop/Software%20Engineer%20Projects/1.%20EduMentor/docs/api/fixtures/deliverable.evaluated.json)

## Evidencia

```text
prisma_schema_models=20
prisma_schema_enums=8
dto_validation=ok
openapi_contracts=aligned
domain_invariants_sec4=enforced
idempotency_key_support=yes
optimistic_concurrency_version=enforced
deliverables_crud=ok
evaluations_workflow=ok
top_candidates_selection=ok
unit_tests_deliverables=5_passed
total_unit_tests_backend=20_passed
```

## Próximo slice de Backend (Antigravity)

1. Fase 4: Notificaciones, Recordatorios y Panel Administrativo (`apps/api/src/modules/notifications` y `admin`).
