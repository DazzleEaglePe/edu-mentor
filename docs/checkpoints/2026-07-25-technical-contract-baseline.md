# Checkpoint · Baseline técnica de contratos

Fecha: 2026-07-25
Fase: 0 · Alineación y contratos
Estado del gate: pendiente de Producto; baseline técnica lista.

## Resultado

Se convirtió el contexto inicial y la auditoría UX de Claude en contratos implementables y consistentes. No se inició todavía código funcional ni se modificó `apps/web`.

## Evidencia completada

1. respuesta formal a CCR-001–009;
2. modelo MVP corregido;
3. API v3 con auth, permisos, administración, Agenda y Entregables;
4. máquinas de estado e invariantes;
5. matriz tecnológica con spike aislado;
6. OpenAPI 3.1 inicial y cuatro fixtures sintéticos;
7. primera lección práctica del track AI Engineer;
8. checklist maestro actualizado.

Al cierre existen 33 ítems completados y 144 abiertos en todo el roadmap. Los abiertos incluyen fases futuras; no representan 144 bloqueos inmediatos.

## Decisiones técnicas cerradas

- Organización separada de Oleada.
- Roles múltiples, capacidades y asignaciones de mentor.
- Soporte administrativo mínimo.
- Refresh sessions persistidas, cookies seguras y CSRF.
- Estado de sesión separado de confirmación y asistencia.
- Prevención transaccional de traslapes.
- Entregable lógico + submissions + evaluación por revisión.
- Solicitud de reprogramación del participante.
- Outbox como autoridad; BullMQ como ejecutor; n8n periférico.
- Job Tracking e IA fuera del MVP.
- Escala 0–100.
- Sin solicitud libre de sesión, satisfacción, variaciones históricas ni notification center.

## Decisiones abiertas para Producto

1. ratificar Top 3 por assignment y puestos 1–3;
2. entregar criterios/pesos reales de rúbrica;
3. elegir canal/proveedor de notificación;
4. aprobar tipos, tamaño y retención de archivos;
5. decidir landing pública del piloto;
6. aprobar charter/journeys y nombrar owners de Producto/UAT.

El reset manual de contraseña y la URL manual de reunión permiten pilotear sin bloquearse por email/Calendar.

## Matriz y spike

Baseline: Node 24 LTS, pnpm 11.17.0, TypeScript 6.0.3, Next 16.2.11, React 19.2.8, Nest 11.1.28, Prisma 7.9.0, Tailwind 4.3.3 y BullMQ 5.81.2.

Resultado:

```text
pnpm install        OK después de allowlist explícita
tsc --version       6.0.3
next --version      16.2.11
prisma --version    CLI/Client 7.9.0
Node del spike      24.14.0, macOS arm64
```

Pendiente en Fase 1: repetir con Node 24.18.0/Linux y fijar digests Docker.

## Validaciones documentales

```text
markdown_files=29
local_links=35
local_links_ok=true
referencias contractuales obsoletas fuera de diseño=0
openapi_redocly_errors=0
openapi_redocly_warnings=0
json_fixtures_valid=4
secretos/PII añadidos=0
```

Los usos restantes de términos antiguos en `05-gap-analysis.md` describen la brecha histórica, no el contrato vigente.

## Archivos principales de Codex

- `docs/01-arquitectura-tecnica.md`
- `docs/02-modelo-datos.md`
- `docs/03-api-design.md`
- `docs/05-gap-analysis.md`
- `docs/07-checklist-master.md`
- `docs/11-contract-decisions.md`
- `docs/12-domain-state-machines.md`
- `docs/13-technology-version-matrix.md`
- `docs/api/openapi.yaml`
- `docs/api/fixtures/*.json`
- `docs/learning/01-domain-modeling-and-state-machines.md`

Los artefactos de `docs/design/**`, `design-platform/**` y tokens pertenecientes al handoff de Claude fueron leídos pero no editados.

Durante el cierre apareció `docs/design/wireframes/index.html`, generado en paralelo con el contrato anterior. Sigue mostrando rutas antiguas como `/deliverables/:id/evaluate` y trata los nueve CCR como abiertos. Se conserva como borrador de diseño; Claude deberá reconciliarlo con `11`, `12` y `api/openapi.yaml` antes de construir frontend.

## Aprendizaje L01

Conceptos trabajados:

- entidad, value object y agregado;
- rol vs. ownership;
- organización vs. cohorte;
- invariante y máquina de estados;
- race condition `check-then-insert`;
- exclusion constraint;
- revisión inmutable;
- conexión de estas garantías con RAG, evals y human review.

Laboratorio programado: disparar dos reservas concurrentes y demostrar que solo una se confirma sin dejar sesión/outbox parcial.

## Control de cambios

No se creó commit porque:

1. el baseline inicial aún requiere aprobación del usuario;
2. Claude mantiene trabajo externo no comprometido en el mismo árbol;
3. mezclar ambos owners en un commit impediría una revisión limpia.

## Próximo gate

Tras la revisión:

1. Producto resuelve las seis decisiones abiertas;
2. Claude consume `11`, `12` y `13` y confirma alineación del diseño;
3. Codex completa los paths administrativos/uploads restantes y genera tipos;
4. se aprueba el baseline y se crea commit;
5. inicia Fase 1 con scaffold coordinado, CI, Postgres/Redis y primer vertical slice de auth.
