# 07 · Checklist Maestro

Fuente de verdad del avance. Un checkbox se marca solo con evidencia reproducible.

## Estado

| Fase | Estado | Gate |
|---|---|---|
| 0 · Alineación y contratos | En curso | Pendiente |
| 1 · Fundaciones | En curso | Pendiente |
| 2 · Agenda | No iniciada | Pendiente |
| 3 · Entregables | No iniciada | Pendiente |
| 4 · Notificaciones/Admin | No iniciada | Pendiente |
| 5 · Hardening/UAT | No iniciada | Pendiente |
| 6 · Piloto | No iniciada | Pendiente |
| 7 · Post-piloto/IA | No iniciada | Pendiente |

## Fase 0 · Alineación y contratos

### Contexto

- [x] Crear carpeta activa EDU-MENTOR.
- [x] Extraer `CLAUDE.md` y documentos `01`–`04`.
- [x] Crear `AGENTS.md` para Codex.
- [x] Crear project charter.
- [x] Analizar brechas técnicas y funcionales.
- [x] Crear plan por fases.
- [x] Crear roadmap.
- [x] Crear protocolo Codex ↔ Claude Code.
- [x] Crear learning track AI Engineer.
- [ ] Aprobar project charter con Proyectos.
- [ ] Confirmar owner de producto y owner de UAT.

### Decisiones P0

- [x] Cerrar técnicamente DEC-001: organización vs. oleada.
- [x] Cerrar técnicamente DEC-002/003: roles y capacidades de mentor.
- [x] Cerrar técnicamente DEC-004: soporte administrativo mínimo.
- [x] Cerrar técnicamente DEC-005/006: auth sessions y transporte de tokens.
- [x] Cerrar técnicamente DEC-007: estados de sesión/confirmación.
- [x] Cerrar técnicamente DEC-008/009: conflictos y coherencia de fase.
- [x] Cerrar técnicamente DEC-010/011: revisiones/evaluaciones.
- [ ] Ratificar con Producto DEC-012: Top 3 por assignment y ranks 1–3.
- [x] Cerrar técnicamente DEC-013: solicitud de reprogramación.
- [x] Cerrar técnicamente DEC-014: outbox/BullMQ/n8n.
- [x] Cerrar técnicamente DEC-015/016: frontera futura/IA.
- [x] Fijar matriz compatible de versiones y ejecutar spike local.

### Producto/UX

- [ ] Validar journeys MVP de participante.
- [ ] Validar journeys MVP de mentor.
- [ ] Validar journeys MVP de admin.
- [ ] Decidir alcance de landing pública.
- [x] Separar pantallas MVP de exploraciones futuras.
- [x] Definir estados empty/loading/error/forbidden.
- [ ] Aprobar design tokens y accesibilidad.

### Datos/API

- [x] Corregir modelo de roles/mentor assignments.
- [x] Añadir auth sessions/audit log al diseño.
- [x] Corregir estados y constraints de Session.
- [x] Añadir prevención de solapamientos al diseño.
- [x] Diseñar Deliverable + Submission/Revision + Evaluation.
- [x] Diseñar selección top 3 provisional.
- [x] Añadir reschedule request.
- [x] Completar endpoints administrativos mínimos.
- [x] Definir contrato uniforme de errores.
- [x] Publicar OpenAPI inicial.
- [x] Generar fixtures compartidos sin PII real.
- [x] Tipificar `SCHEDULE_CONFLICT` sin exponer sesiones ajenas.
- [x] Definir corte de confirmación y error `CONFIRMATION_CLOSED`.
- [x] Completar OpenAPI administrativo de oleadas, enrollments y mentor assignments.
- [x] Reconciliar filtros, summaries y scoping solicitados por diseño.

### Dependencias

- [ ] Elegir canal de notificación inicial.
- [ ] Confirmar proveedor/cuenta de notificaciones.
- [ ] Decidir URL manual vs. Calendar/Meet.
- [ ] Confirmar VPS, DNS y responsables de secretos.
- [ ] Definir storage/backup de archivos.
- [ ] Definir política de datos/retención.

### Gate 0

- [ ] Brechas P0 cerradas.
- [ ] Documentos `01`–`04` alineados con decisiones.
- [x] Diseño y backend comparten estados/contratos.
- [ ] Stakeholders aprueban MVP y exclusiones.

## Fase 1 · Fundaciones

- [x] Inicializar Git y baseline aprobado.
- [x] Crear monorepo pnpm.
- [x] Crear `apps/web`, `apps/api`, `packages/shared-types`, config compartida.
- [x] Configurar TypeScript estricto.
- [x] Configurar lint, format, typecheck, tests y CI.
- [x] Generar `packages/shared-types` desde OpenAPI sin mantener un contrato manual paralelo.
- [ ] Configurar secret scan y dependency audit.
- [ ] Crear Docker Compose local.
- [ ] Configurar Postgres, Redis y health checks.
- [ ] Configurar Prisma y migraciones.
  - [x] Definir y validar el schema Prisma inicial de fundaciones.
  - [ ] Generar y ejecutar la migración inicial contra PostgreSQL.
- [x] Implementar config/feature gates tipados.
- [x] Implementar errors + traceId + logs estructurados.
- [ ] Implementar usuarios, roles y mentor capabilities.
- [ ] Implementar oleadas, enrollments y assignments.
- [ ] Implementar auth sessions y rotación/revocación.
- [ ] Implementar RBAC y ownership.
- [ ] Implementar audit log.
- [ ] Crear seed ficticio por rol.
- [x] Crear shell web y navegación por rol.
- [ ] Probar instalación limpia.

### Gate 1

- [ ] CI verde.
- [ ] Migración/seed reproducibles.
- [ ] Auth positive/negative tests.
- [ ] Ownership cross-user bloqueado.
- [ ] Layout responsive y accesible.
- [ ] Cero secretos/PII en repo.

## Fase 2 · Agenda y Sesiones

- [ ] Modelar Session, participant, reminder y reschedule request.
- [ ] Implementar repository y service con transacciones.
- [ ] Implementar lista/detalle/calendario con scoping por rol.
- [ ] Crear sesión 1:1.
- [ ] Crear sesión grupal.
- [ ] Crear checkpoint con reglas de fase.
- [ ] Confirmar participación.
- [ ] Marcar asistencia.
- [ ] Solicitar/decidir reprogramación.
- [ ] Reprogramar preservando historial.
- [ ] Cancelar/completar.
- [ ] Bloquear conflictos de mentor.
- [ ] Bloquear conflictos de participante.
- [ ] Emitir eventos/outbox idempotentes.
- [ ] Implementar UI participante.
- [ ] Implementar UI mentor.
- [ ] Implementar UI admin.
- [ ] Probar concurrencia, ownership y reintentos.

### Gate 2

- [ ] Tres vertical slices demostradas.
- [ ] Cero doble reserva en test concurrente.
- [ ] Estados UI/API/DB consistentes.
- [ ] Recordatorios no duplicados.

## Fase 3 · Entregables

- [ ] Modelar Assignment, Deliverable, Submission, File y Evaluation.
- [ ] Implementar storage interface.
- [ ] Implementar validación MIME/tamaño/nombre.
- [ ] Implementar quarantine/scan definido.
- [ ] Crear consigna.
- [ ] Crear/editar borrador.
- [ ] Subir/eliminar archivo autorizado.
- [ ] Enviar revisión inmutable.
- [ ] Abrir cola de evaluación.
- [ ] Evaluar revisión.
- [ ] Devolver para corrección.
- [ ] Reenviar preservando historial.
- [ ] Seleccionar/rankear top 3.
- [ ] Auditar descargas y evaluaciones.
- [ ] Implementar UI participante.
- [ ] Implementar UI mentor.
- [ ] Implementar UI admin.
- [ ] Probar concurrencia y ownership.

### Gate 3

- [ ] Historial de revisiones/evaluaciones preservado.
- [ ] Uploads inseguros rechazados.
- [ ] Descarga ajena bloqueada.
- [ ] Regla top 3 aplicada en DB/service.

## Fase 4 · Notificaciones y administración

- [ ] Implementar transactional outbox.
- [ ] Configurar BullMQ scheduler/workers.
- [ ] Crear idempotency keys.
- [ ] Implementar retry/backoff/dead-letter.
- [ ] Integrar canal inicial.
- [ ] Integrar n8n solo como periferia.
- [ ] Sincronizar delivery status.
- [ ] Implementar gestión mínima de usuarios.
- [ ] Implementar gestión de oleadas/enrollments.
- [ ] Implementar gestión de mentor assignments.
- [ ] Implementar vista operativa de jobs fallidos.
- [ ] Probar caída de Redis/n8n/proveedor.

### Gate 4

- [ ] Ningún evento durable se pierde.
- [ ] Retry no duplica notificación.
- [ ] Admin opera sin SQL manual.
- [ ] Fallos tienen owner y recuperación.

## Fase 5 · Hardening y UAT

- [ ] Completar unit/integration/contract/E2E.
- [ ] Ejecutar suite de autorización negativa.
- [ ] Ejecutar revisión WCAG 2.2 AA.
- [ ] Ejecutar prueba de carga.
- [ ] Ejecutar revisión de auth/uploads.
- [ ] Aprobar privacidad/retención.
- [ ] Configurar backups.
- [ ] Demostrar restore.
- [ ] Configurar métricas/alertas.
- [ ] Escribir runbook.
- [ ] Ejecutar game day.
- [ ] Preparar casos UAT.
- [ ] Corregir defectos críticos/altos.

### Gate 5

- [ ] UAT aprobado.
- [ ] Restore demostrado.
- [ ] Cero defectos críticos/altos.
- [ ] Soporte y rollback definidos.

## Fase 6 · Piloto

- [ ] Cargar datos iniciales autorizados.
- [ ] Capacitar roles.
- [ ] Activar piloto controlado.
- [ ] Monitorear diariamente la primera semana.
- [ ] Revisar feedback semanal.
- [ ] Medir métricas acordadas.
- [ ] Registrar incidentes y decisiones.
- [ ] Realizar retrospectiva.
- [ ] Priorizar backlog post-piloto.

### Gate 6

- [ ] Resultados documentados.
- [ ] Decisión de escalar/iterar/pausar.
- [ ] Operación transferida.

## Fase 7 · Post-piloto e IA

- [ ] Revalidar alcance Job Search Tracking.
- [ ] Revalidar mentoría par.
- [ ] Revalidar Demo Day/certificados.
- [ ] Revalidar citas psicológicas.
- [ ] Definir problema del módulo IA de CV.
- [ ] Aprobar datos/corpus.
- [ ] Crear baseline y rúbrica.
- [ ] Crear evaluation set.
- [ ] Definir human review/abstención.
- [ ] Implementar experimento aislado.
- [ ] Medir calidad, costo, latencia y riesgo.
- [ ] Aprobar o descartar integración.

## Evidencia requerida por checkpoint

1. checklist actualizado;
2. decisiones cerradas/abiertas;
3. archivos modificados;
4. comandos de validación;
5. resultados de tests;
6. demo o capturas;
7. conceptos aprendidos;
8. siguiente gate.
