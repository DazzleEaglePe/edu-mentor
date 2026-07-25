# 06 · Plan de Implementación por Fases

## Principio de avance

Cada fase produce una vertical slice demostrable y termina con un gate. No se avanza por porcentaje de archivos creados, sino por comportamiento verificado.

## Fase 0 · Alineación y contratos

### Objetivo

Cerrar alcance, modelo y responsabilidades antes de que diseño y backend diverjan.

### Entregables

- project charter aprobado;
- decisiones P0 cerradas;
- journeys MVP por rol;
- modelo de datos corregido;
- OpenAPI/contratos corregidos;
- matriz de permisos y ownership;
- matriz de versiones;
- estrategia de notificaciones y storage;
- plan de pruebas;
- protocolo Codex ↔ Claude Code.

### Gate 0

- ninguna brecha P0 permanece ambigua;
- Proyectos identifica owner de UAT;
- diseño distingue MVP de futuro;
- frontend y backend comparten contratos.

## Fase 1 · Fundaciones y habilitadores

### Objetivo

Crear una base reproducible, segura y suficiente para los dos módulos.

### Backend

- monorepo pnpm;
- NestJS modular;
- Prisma/Postgres y migraciones;
- auth sessions, cookies/tokens y RBAC;
- usuarios, roles, oleadas, enrollments y mentor assignments;
- auditoría;
- feature gates validados al iniciar;
- manejo uniforme de errores y `traceId`.

### Frontend

- Next.js App Router;
- design tokens EDU-US;
- layouts público/portal según alcance aprobado;
- login y navegación por rol;
- componentes de loading, empty, error y forbidden;
- cliente API generado o tipado desde contrato.

### Operación

- Docker Compose local;
- lint, format, typecheck, tests y CI;
- secret scan;
- `.env.example` sin secretos;
- health/readiness checks;
- seed exclusivamente ficticio.

### Gate 1

- instalación limpia reproducible;
- auth y ownership probados con roles positivos/negativos;
- migraciones up/down o estrategia de rollback verificada;
- CI en verde;
- diseño base accesible y responsive.

## Fase 2 · Agenda y Sesiones

### Vertical slice 2A

Mentor crea una sesión 1:1; participante autorizado la consulta y confirma.

### Vertical slice 2B

Mentor crea sesión grupal; participantes tienen confirmaciones independientes.

### Vertical slice 2C

Reprogramación/cancelación, solicitud del participante y trazabilidad.

### Capacidades

- lista/detalle/calendario por rol;
- creación con participantes autorizados;
- timezone y duración;
- detección de solapamientos;
- estados de sesión separados de attendance;
- confirmación y asistencia;
- reprogramación transaccional;
- eventos/outbox para notificaciones.

### Gate 2

- cero acceso ajeno en pruebas;
- doble reserva bloqueada bajo concurrencia;
- reintentos no duplican sesión/recordatorio;
- flujos UI/API coinciden;
- demo completa para participante, mentor y admin.

## Fase 3 · Entregables y Evaluación

### Vertical slice 3A

Admin/mentor publica consigna; participante crea borrador y sube archivo.

### Vertical slice 3B

Participante envía revisión; mentor evalúa con feedback.

### Vertical slice 3C

Mentor devuelve; participante reenvía sin perder historial; selección top 3.

### Capacidades

- storage abstraction;
- validación y quarantine de archivos;
- submission/revision inmutable;
- state machine explícita;
- evaluación por revisión;
- optimistic concurrency;
- cola pending review;
- selección/ranking con regla aprobada;
- descargas autorizadas y auditadas.

### Gate 3

- historial completo preservado;
- archivos no autorizados rechazados;
- descarga cross-user bloqueada;
- submit/evaluate concurrente produce conflicto controlado;
- demo end-to-end aceptada.

## Fase 4 · Notificaciones y operación administrativa

### Objetivo

Volver operable el piloto sin tareas manuales ocultas.

### Capacidades

- transactional outbox;
- BullMQ scheduler/workers;
- recordatorios idempotentes;
- n8n como integración periférica;
- status/retry/dead-letter;
- gestión mínima de usuarios, oleadas, enrollments y assignments;
- dashboard operativo básico;
- exportes mínimos aprobados.

### Gate 4

- caída de n8n/proveedor no pierde evento durable;
- retry no envía duplicados;
- admin configura la oleada sin SQL manual;
- jobs fallidos son visibles y reintentables.

## Fase 5 · Hardening y UAT

### Calidad

- tests unitarios, integración, contrato y E2E;
- pruebas de autorización negativas;
- accesibilidad WCAG 2.2 AA;
- performance con volumen superior al piloto;
- seguridad de uploads y auth;
- privacy/retention gate;
- backups y restore;
- observabilidad y alertas;
- runbook y game day.

### UAT

- escenarios escritos por rol;
- datos ficticios representativos;
- registro de defectos;
- criterios de severidad;
- acta de aceptación.

### Gate 5

- cero defectos críticos/altos abiertos;
- restore demostrado;
- UAT firmado;
- responsables y soporte del piloto confirmados.

## Fase 6 · Piloto controlado

- carga inicial;
- capacitación;
- canary por usuarios/rol si aplica;
- monitoreo diario inicial;
- feedback semanal;
- medición de métricas;
- retrospectiva y backlog post-piloto.

### Gate 6

- resultados y limitaciones documentados;
- decisión explícita: iterar, escalar o pausar;
- deuda operativa priorizada.

## Fase 7 · Post-piloto y módulo IA

Solo después de validar el núcleo:

- Job Search Tracking;
- mentoría par;
- Demo Day/certificados;
- citas psicológicas;
- landing pública completa;
- módulo IA de CV/LinkedIn.

### Gate específico de IA

Antes de construir IA:

- problema y usuario definidos;
- corpus/datos autorizados;
- baseline humano;
- rúbrica de calidad;
- set de evaluación;
- privacidad y retención;
- política de abstención/handoff;
- costo/latencia objetivo;
- revisión humana de recomendaciones.

La IA no debe emitir decisiones de selección ni afirmaciones laborales no verificadas.

## Track paralelo de diseño con Claude Code

Claude puede avanzar desde Fase 0 en:

- inventario de pantallas MVP;
- design system y tokens;
- wireframes y prototipo;
- responsive/accessibility;
- fixtures alineados al contrato.

Claude no debe:

- inventar endpoints;
- activar pantallas futuras en navegación MVP;
- cambiar estados/reglas sin registrar decisión;
- implementar lógica de autorización solo en frontend.

