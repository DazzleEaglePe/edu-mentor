# Design · EDU-MENTOR

Zona de archivos de Claude Code según `docs/09-claude-code-coordination.md`.
Gate activo: **Fase 0 · Alineación y contratos**. No hay implementación autorizada.

**Estado: sincronizado con el contrato cerrado (2026-07-25)** — `docs/checkpoints/2026-07-25-contract-reconciliation-closure.md`, `docs/11-contract-decisions.md`, `docs/12-domain-state-machines.md`, `docs/api/openapi.yaml` (57 operaciones).

**12 CCR procesadas; 11 cerradas y CCR-008 pendiente de Producto.** Ninguna espera respuesta de Codex.

## Documentos

| Doc | Contenido | Cierra checklist |
|---|---|---|
| [00-inventario-pantallas.md](./00-inventario-pantallas.md) | Pantallas `MVP`/`FUTURE`, navegación por rol, **glosario enum↔UI vigente** | Fase 0 · UX: "Separar pantallas MVP de exploraciones futuras" |
| [01-auditoria-mockups-v1.md](./01-auditoria-mockups-v1.md) | Auditoría de `design-platform/screen-1..4.png` — **histórico**, previo al contrato | Insumo de "Validar journeys" |
| [02-design-tokens.md](./02-design-tokens.md) | Paleta accesible, tipografía, espaciado, elevación | Fase 0 · UX: "Aprobar design tokens y accesibilidad" |
| [03-estados-ux.md](./03-estados-ux.md) | Loading, empty, error, forbidden + máquinas de estado del dominio | Fase 0 · UX: "Definir estados empty/loading/error/forbidden" |
| [04-contract-change-requests.md](./04-contract-change-requests.md) | **12 procesadas · 11 cerradas** · CCR-008 pendiente de Producto | Revisión cruzada |
| [05-journeys.md](./05-journeys.md) | Journeys de los 3 roles con endpoint y estado real | Fase 0 · UX: "Validar journeys MVP" |
| [06-wireframes.md](./06-wireframes.md) | Spec, reglas responsive, qué cambió en la reconciliación | — |
| [07-componentes.md](./07-componentes.md) | 54 componentes que cubren el piloto | Base de `apps/web` |
| [08-handoff.md](./08-handoff.md) | Handoff a Codex + **confirmación de sincronización** | ✅ "Diseño y backend comparten estados/contratos" |
| [09-copy.md](./09-copy.md) | Errores, vacíos, confirmaciones, notificaciones, glosario | Insumo de UAT |
| [wireframes/index.html](./wireframes/index.html) | Kit navegable: 27 planchas, responsive, anotado | — |
| [tokens/](./tokens/) | `edu-mentor.tokens.json` · `tokens.css` | Base de `apps/web` |

Kit publicado: `https://claude.ai/code/artifact/fad91626-d242-4479-8b91-88e976d3303e`

## Reglas que sigo en este track

1. Cada pantalla se etiqueta `MVP` o `FUTURE`; ninguna `FUTURE` aparece en la navegación del piloto.
2. Uso exactamente los estados de `docs/api/openapi.yaml` y `docs/12-domain-state-machines.md`.
3. Si una pantalla necesita un endpoint, estado o regla que no existe, abro un CCR. No lo invento ni simulo éxito.
4. Fixtures sin PII.
5. Objetivo de accesibilidad: WCAG 2.2 AA.
6. La autorización real vive en el backend; el frontend solo oculta lo que no corresponde.
7. No modifico los documentos de planificación ni de contrato de Codex.

## Estado

- [x] Inventario MVP/FUTURE con glosario enum↔UI.
- [x] Auditoría de mockups v1.
- [x] Design tokens (pendiente aprobación de Producto).
- [x] Catálogo de estados UX.
- [x] Journeys por rol (pendiente validación con Proyectos).
- [x] Wireframes responsive · 27 planchas · cobertura MVP completa.
- [x] Inventario de componentes.
- [x] Copy deck.
- [x] Reconciliación con el contrato de Codex.
- [x] **Sincronización final: 11 CCR cerradas, CCR-008 en Producto, cero referencias obsoletas.**
- [x] Handoff con confirmación para cerrar el checkbox de contratos.
- [ ] Prototipo navegable de los dos journeys críticos.
- [ ] Iconografía y tipografía institucional.
- [ ] Sustituir fixtures propios por los 7 del contrato (al construir `apps/web`).

### Pendiente de Producto, no de contrato

- [ ] Ratificar la regla del Top 3 (hoy diseñada como provisional).
- [ ] Definir rúbricas reales por consigna.
- [ ] Fijar tipos, tamaño y retención de archivos — P8 usa un placeholder.
- [ ] Elegir canal de notificación (DEC-020) para cerrar las plantillas.
- [ ] Decidir el alcance de la landing pública.
- [ ] Aprobar charter, journeys y design tokens.
