# Contrato API ejecutable

## Archivos

- `openapi.yaml`: OpenAPI 3.1 inicial del piloto.
- `fixtures/auth-me.participant.json`: contexto autenticado del participante.
- `fixtures/session.detail.json`: sesión con confirmación y asistencia separadas.
- `fixtures/deliverable.detail.json`: entregable con submission inmutable.
- `fixtures/error.schedule-conflict.json`: error estable de doble reserva.
- `fixtures/admin.oleada.json`: oleada operable por administración.
- `fixtures/admin.enrollment.json`: inscripción y avance de participante.
- `fixtures/admin.mentor-assignment.json`: alcance vigente de mentor especialista.

Todos los datos son sintéticos y usan el dominio reservado `example.test`.

## Cobertura actual

Incluye:

- auth principal;
- dashboards participante/mentor/admin;
- Agenda, confirmación y asistencia;
- solicitudes de reprogramación;
- assignments y Top 3 provisional;
- entregables, submissions, archivos y evaluación;
- usuarios y reset manual;
- oleadas, enrollments y asignaciones de mentor.

El diseño completo de rutas sigue en `../03-api-design.md`. La cobertura administrativa mínima requerida por el piloto ya está representada. Antes de Gate 1 aún corresponde:

- generar tipos compartidos desde el contrato;
- implementar DTOs/decorators Nest y verificar drift en CI;
- incorporar los límites de archivos cuando Producto apruebe tipos, tamaño y retención.

El archivo se validó con Redocly CLI usando el ruleset `minimal`, sin errores ni warnings. En Fase 1 los DTO/decorators de Nest deberán generar o verificar este contrato en CI para evitar dos fuentes de verdad.

## Regla de fixtures

1. no usar nombres, emails, URLs ni archivos reales;
2. IDs deterministas y UUID válidos;
3. cada fixture valida contra su schema;
4. cambios incompatibles actualizan frontend, tests de contrato y checklist;
5. errores usan `code`, `message`, `traceId` y `details` sanitizados.
