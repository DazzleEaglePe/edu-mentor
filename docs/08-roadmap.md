# 08 · Roadmap de Entregas

Las duraciones son una hipótesis inicial para un equipo pequeño. Se recalibran después de Fase 0 según capacidad, disponibilidad de stakeholders y profundidad del diseño.

## Vista resumida

| Iteración | Producto/Backend | Diseño/Frontend (Claude Code) | Gate |
|---|---|---|---|
| Sprint 0 | Alcance, decisiones, modelo y API | Journeys, inventario y design system | Contratos aprobados |
| Sprint 1 | Fundaciones, auth y core domain | Shell, login y navegación por rol | Base reproducible |
| Sprint 2 | Agenda vertical slice 1:1 | Agenda participante/mentor | Crear-ver-confirmar |
| Sprint 3 | Agenda grupal, conflictos y reprogramación | Calendario/admin/estados | Agenda aceptada |
| Sprint 4 | Entregables, uploads y submissions | Entregables participante | Enviar revisión |
| Sprint 5 | Evaluación, devolución, historial y top 3 | Evaluación mentor/admin | Entregables aceptados |
| Sprint 6 | Outbox, recordatorios y admin mínimo | Estados operativos y polish | Operación completa |
| Sprint 7 | Hardening, accesibilidad y UAT | Correcciones UAT/responsive | Go-live ready |
| Sprint 8 | Piloto controlado | Soporte visual/UX | Decisión post-piloto |

## Sprint 0 · Cierre de definición

### Prioridad

- resolver decisiones P0;
- corregir ERD/API;
- separar MVP/futuro;
- aprobar journeys;
- fijar versiones;
- definir ownership de archivos entre Codex y Claude.

### Salida

Contratos que permiten implementar frontend y backend sin inventar reglas.

## Sprint 1 · Foundation

- monorepo;
- CI;
- infraestructura local;
- Prisma/migraciones;
- auth/roles/ownership;
- users/oleadas/enrollments/mentor assignments;
- shell web/design tokens;
- fixtures compartidos.

## Sprints 2–3 · Agenda

### Orden vertical

1. crear/ver/confirmar 1:1;
2. sesión grupal;
3. attendance;
4. conflicts;
5. reschedule request/decision;
6. cancel/completed;
7. admin supervision.

No empezar por un calendario visual completo; primero debe funcionar el ciclo de negocio.

## Sprints 4–5 · Entregables

### Orden vertical

1. consigna;
2. draft/upload;
3. submit revision;
4. pending review;
5. evaluate/return;
6. resubmit/history;
7. top 3/admin.

El preview avanzado de documentos es secundario frente a upload seguro, permisos e historial.

## Sprint 6 · Automatización y administración

- reminders/outbox;
- delivery integration;
- retries/dead-letter;
- admin setup;
- audit/operational views.

## Sprint 7 · Hardening y UAT

- seguridad;
- accesibilidad;
- performance;
- backup/restore;
- observabilidad;
- runbook;
- UAT.

## Sprint 8 · Piloto

- onboarding;
- activación controlada;
- soporte;
- medición;
- retrospectiva.

## Camino crítico

```text
Decisiones P0
  → modelo/API aprobados
  → auth + core domain
  → Agenda
  → Entregables
  → notificaciones/admin
  → hardening/UAT
  → piloto
```

Diseño puede avanzar en paralelo, pero no puede saltarse `modelo/API aprobados` para interacciones con reglas de negocio.

## Dependencias externas

| Dependencia | Se necesita antes de |
|---|---|
| Decisión landing pública | Cerrar arquitectura frontend |
| Canal/proveedor de notificaciones | Sprint 6 |
| Política de archivos/retención | Sprint 4 |
| VPS/DNS/secrets owner | Sprint 7 |
| Stakeholders UAT | Sprint 0 y Sprint 7 |
| Datos iniciales autorizados | Sprint 8 |

## Release strategy

- `dev`: integración continua;
- `staging`: datos ficticios y UAT;
- `production`: piloto;
- migraciones forward-only con backup/rollback operativo;
- feature gates no sustituyen pruebas ni autorización;
- módulos futuros permanecen apagados y fuera de navegación.

## Roadmap posterior

El orden post-piloto se decide con evidencia:

1. corregir fricciones del piloto;
2. Job Search Tracking/Fase 2;
3. mentoría par;
4. módulo IA de CV con evaluación;
5. Demo Day/certificados;
6. citas psicológicas;
7. múltiples oleadas/organizaciones si existe demanda real.

