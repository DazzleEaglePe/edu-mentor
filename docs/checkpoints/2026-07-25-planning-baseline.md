# Checkpoint · Planning Baseline

Fecha: 2026-07-25.

## Resultado

- EDU-MENTOR establecido como proyecto activo independiente.
- Contexto de `newfiles.zip` extraído.
- Alcance MVP separado de módulos futuros.
- Project charter creado.
- 28 brechas/decisiones registradas.
- Plan de implementación, checklist y roadmap creados.
- Protocolo Codex ↔ Claude Code creado.
- Learning track AI Engineer incorporado.
- Instrucciones persistentes para ambos agentes disponibles.

## Hallazgos que bloquean código

1. Oleada no debe tratarse automáticamente como tenant.
2. Roles/mentor kinds requieren cardinalidad múltiple.
3. Auth necesita sesiones persistidas y rotación.
4. Estado de sesión no debe duplicar confirmación individual.
5. Agenda necesita prevención de solapamientos.
6. Deliverables necesita revisiones/evaluaciones históricas reales.
7. Top 3 requiere regla y constraint.
8. UI/API no coinciden en solicitud de reprogramación.
9. Recordatorios necesitan una autoridad durable e idempotencia.
10. Pantallas futuras no deben entrar al MVP.

## Trabajo permitido mientras se decide

Claude Code puede:

- preparar inventario de pantallas MVP;
- crear design system/tokens;
- producir wireframes sin lógica inventada;
- documentar preguntas UX.

No debe crear todavía:

- schema Prisma definitivo;
- endpoints no aprobados;
- navegación a módulos futuros;
- auth productiva;
- workflows de Job Tracking/IA.

## Próximo checkpoint

Cierre de Fase 0:

- respuestas de Proyectos;
- decisiones P0 aprobadas;
- ERD corregido;
- API/OpenAPI corregida;
- journeys y design scope aprobados;
- matriz de versiones fijada.

