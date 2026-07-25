# 10 · Learning Track — Software Engineer → AI Engineer

La formación acompaña el proyecto sin forzar IA donde no corresponde. Agenda y Entregables son principalmente software engineering; esa base es necesaria para operar después un módulo de IA confiable.

## Formato por checkpoint

Cada entrega incluirá:

1. concepto y definición;
2. problema real que resuelve;
3. decisión y alternativas;
4. walkthrough del código;
5. laboratorio o prueba de fallo;
6. explicación para cliente;
7. explicación para entrevista técnica;
8. evidencia de portafolio.

## Mapa de competencias

| Fase | Conceptos | Evidencia |
|---|---|---|
| 0 | Product discovery, scope, ADR, domain modeling, API-first | Contratos y trade-offs defendibles |
| 1 | Monorepo, NestJS, Next.js, Prisma, auth, RBAC, ownership | Base segura y reproducible |
| 2 | Concurrencia, idempotencia, state machines, outbox | Agenda sin dobles reservas/duplicados |
| 3 | Storage, uploads seguros, versionado, optimistic locking | Evidencias y feedback auditables |
| 4 | BullMQ, retries, dead-letter, n8n, observabilidad | Automatización recuperable |
| 5 | Testing pyramid, seguridad, accesibilidad, SLO/runbook | Sistema preparado para producción |
| 6 | UAT, métricas, canary, feedback loop | Resultado real de producto |
| 7 IA | RAG/LLM, evals, grounding, privacidad, human review | Módulo IA medido, no solo demo |

## Módulos de aprendizaje

### L01 · Modelado de dominio

- entidad vs. agregado;
- organización vs. cohorte;
- roles vs. capacidades;
- invariantes en service y DB;
- state machines.

Lección práctica: [learning/01-domain-modeling-and-state-machines.md](./learning/01-domain-modeling-and-state-machines.md).

### L02 · Seguridad de aplicación

- autenticación vs. autorización;
- RBAC vs. ownership/ABAC;
- refresh rotation;
- cookies, XSS y CSRF;
- audit logs.

Lección práctica:
[learning/04-authentication-sessions-and-authorization.md](./learning/04-authentication-sessions-and-authorization.md).

### L03 · Sistemas distribuidos prácticos

- retry vs. idempotencia;
- at-least-once delivery;
- transactional outbox;
- locks y optimistic concurrency;
- dead-letter queues.

### L04 · Datos y archivos

- migraciones;
- constraints;
- revisiones inmutables;
- storage abstraction;
- MIME, quarantine, antivirus y backups.

### L05 · Frontend de producto

- server/client state;
- accesibilidad;
- estados de error;
- contratos tipados;
- diseño por rol sin usar UI como seguridad.

### L06 · Operación

- logs, métricas y trazas;
- health/readiness;
- incidentes;
- backup/restore;
- SLOs y runbooks.

### L07 · Ingeniería de IA

- formular el problema antes del modelo;
- construir baseline humano;
- dataset/evaluation set;
- prompting y structured outputs;
- RAG y grounding si aplica;
- abstención y human-in-the-loop;
- costo, latencia y calidad;
- monitoreo de regresiones.

## Narrativa profesional progresiva

### Después del MVP

> Diseñé e implementé una plataforma modular de mentoría y empleabilidad con agenda concurrente, workflows de entregables, autorización por ownership, automatizaciones idempotentes y operación observable.

### Después del módulo IA

> Incorporé un asistente de revisión de CV dentro de un workflow humano, con rúbrica, set de evaluación, trazabilidad, controles de privacidad y métricas de calidad/costo.

La segunda afirmación no se utilizará hasta que exista evidencia real.

## Próxima personalización

Cuando se incorpore el CV:

- mapear experiencia actual;
- detectar brechas para roles AI Engineer;
- priorizar laboratorios;
- preparar bullets con métricas;
- construir preguntas de system design/LLM engineering;
- elegir artefactos públicos sin datos de EDU-US.

## Checklist de aprendizaje

- [x] Publicar material y laboratorio de L01 durante Fase 0.
- [x] Publicar material y laboratorio práctico de autenticación durante Fase 1.
- [ ] Completar la autoevaluación de L01 con el usuario.
- [ ] Explicar DEC-001, DEC-002 y DEC-010 sin leer documentos.
- [ ] Dibujar la arquitectura MVP.
- [ ] Implementar y romper una regla de ownership en laboratorio.
- [ ] Demostrar doble reserva y su solución.
- [ ] Demostrar retry duplicado y su idempotencia.
- [ ] Restaurar una revisión anterior de entregable.
- [ ] Ejecutar un game day.
- [ ] Diseñar el evaluation plan del módulo IA.
- [ ] Presentar demo técnica y demo orientada a cliente.
