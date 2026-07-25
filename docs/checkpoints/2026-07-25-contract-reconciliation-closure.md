# Checkpoint · Cierre de reconciliación de contratos

Fecha: 2026-07-25
Fase: 0 · Alineación y contratos
Estado del gate: contrato técnico y diseño alineados; validaciones de Producto pendientes.

## Resultado

Codex incorporó la segunda revisión de Claude Code sin modificar `docs/design/**` ni `design-platform/**`. Los CCR-010–012 y las precisiones menores ya tienen una única respuesta normativa en modelo, API, OpenAPI, fixtures y checklist.

## Cambios cerrados

1. `SCHEDULE_CONFLICT` ahora devuelve detalles tipados del recurso y del intervalo ocupado.
2. `conflictingSessionId` solo se revela cuando el actor puede leer la sesión en conflicto.
3. La confirmación cierra en `startsAt`; la sesión persiste y expone `confirmationClosesAt`.
4. La API expone `canConfirm` y devuelve `422 CONFIRMATION_CLOSED` fuera de ventana.
5. `SessionSummary` incluye conteos de confirmación.
6. Los filtros de sesión usan `SessionPhase`; el filtro de entregables observa la revisión vigente.
7. Las solicitudes de reprogramación tienen scoping explícito por participante, mentor y admin.
8. OpenAPI incluye operación administrativa mínima para usuarios, oleadas, enrollments y mentor assignments.
9. Se añadieron fixtures sintéticos de los tres recursos administrativos.

## Privacidad del conflicto

El payload del conflicto puede indicar:

- `resourceType`;
- `resourceId`;
- `occupiedInterval`;
- `canViewConflictingSession`;
- `conflictingSessionId`, nullable.

No incluye título, participantes ni otros datos de una sesión que el actor no pueda consultar. El MVP tampoco promete calcular el “próximo horario libre”.

## Evidencia verificada

```text
openapi_redocly_errors=0
openapi_redocly_warnings=0
openapi_operations=57
duplicate_operation_ids=0
json_fixtures_valid=7
fixture_schema_structural_validation=7/7
markdown_files=33
local_markdown_links=46
local_markdown_links_ok=true
checklist_completed=42
checklist_open=140
```

Los formatos de los datos sintéticos también se revisaron al generar los fixtures; la validación AJV registrada aquí cubre estructura, campos requeridos, enums y propiedades adicionales. Los valores anteriores deben verificarse de nuevo después de cualquier edición de Claude.

## Estado del diseño

Claude entregó y Codex verificó la sincronización final:

1. cerrar mentor assignment usa `DELETE` con `expectedVersion`;
2. `POST /assignments` corresponde a Mentor y Admin;
3. diseño y contrato registran 57 operaciones;
4. el estado se redacta como “12 CCR procesadas; 11 cerradas y CCR-008 pendiente de Producto”;
5. no hay pantallas MVP dependientes de endpoints sin publicar.

El kit conserva 27 planchas balanceadas. El catálogo real suma 54 componentes; dos etiquetas editoriales aún dicen 52 y pueden limpiarse sin afectar el contrato.

## Archivos normativos

- `docs/02-modelo-datos.md`
- `docs/03-api-design.md`
- `docs/07-checklist-master.md`
- `docs/11-contract-decisions.md`
- `docs/12-domain-state-machines.md`
- `docs/api/openapi.yaml`
- `docs/api/fixtures/*.json`

## Cierre de la revisión cruzada

El checkbox “Diseño y backend comparten estados/contratos” quedó cerrado con evidencia. Cualquier contradicción futura vuelve al protocolo CCR.

## Pendientes reales de Gate 0

- ratificación de Top 3;
- rúbricas reales;
- canal/proveedor de notificación;
- política de archivos y retención;
- aprobación de charter, journeys, landing y tokens;
- owners de Producto y UAT.

La fundación técnica de Fase 1 ya inició en paralelo; su evidencia vive en `2026-07-25-phase1-foundation-scaffold.md`.
