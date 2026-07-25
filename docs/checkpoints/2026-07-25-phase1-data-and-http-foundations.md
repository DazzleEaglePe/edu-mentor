# Checkpoint · Persistencia y observabilidad iniciales

Fecha: 2026-07-25  
Fase: 1 · Fundaciones  
Estado del gate: en curso.

## Resultado

Se implementó el siguiente slice del backend sin modificar `apps/web` ni `docs/design/**`:

1. Prisma 7 configurado mediante `prisma.config.ts`;
2. schema PostgreSQL inicial con 12 modelos y 6 enums de fundaciones;
3. generación reproducible del Prisma Client;
4. `traceId` nuevo por solicitud y encabezado `X-Trace-Id`;
5. envelope uniforme `{ error: { code, message, traceId, details? } }`;
6. mensajes seguros para excepciones del framework y errores inesperados;
7. logs estructurados para 5xx sin mensaje interno, query string ni datos de la solicitud;
8. corrección del glob de pruebas para incluir specs a cualquier profundidad.

El schema cubre organización, usuarios, roles, capacidades de mentor, oleadas, matrículas, asignaciones, sesiones de autenticación, auditoría y outbox. Agenda y Entregables permanecen fuera de este slice.

## Decisiones técnicas

- `organization_id` expresa la frontera de tenant; una oleada no reemplaza esa frontera.
- `version` prepara concurrencia optimista en entidades editables.
- la rotación de refresh token se representa mediante familia y relación con la sesión reemplazante;
- `AuditLog.traceId` permite enlazar una acción persistida con la solicitud HTTP;
- `OutboxEvent` prepara publicación durable sin convertir Redis o n8n en fuente de verdad;
- una excepción desconocida nunca devuelve su mensaje interno al cliente.

## Evidencia

```text
prisma_schema_models=12
prisma_schema_enums=6
prisma_validate=ok
prisma_client_generate=ok
openapi_generation=ok
typecheck=ok
tests=6_passed
tests_failed=0
build_api=ok
runtime_404_status=404
runtime_404_code=NOT_FOUND
runtime_trace_header_matches_body=yes
x_powered_by_header=absent
```

Prueba HTTP observada:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "No encontramos el recurso solicitado.",
    "traceId": "uuid-generado-por-el-servidor"
  }
}
```

## Límite explícito

El entorno de ejecución disponible no tiene Docker. Por eso:

- el schema sí está formateado, validado y genera cliente;
- todavía no existe una migración ejecutada contra PostgreSQL;
- `DatabaseModule`, readiness real y Redis se implementarán junto con la infraestructura;
- el checkbox conjunto “Configurar Prisma y migraciones” continúa abierto.

No se creó commit porque el repositorio aún no tiene un baseline inicial aprobado.

## Próximo slice de Codex

1. Docker Compose con PostgreSQL y Redis, versiones/digests revisados;
2. migración inicial y constraints SQL que Prisma no expresa;
3. `DatabaseModule` con `PrismaPg`;
4. readiness real de Postgres/Redis;
5. primer vertical slice de auth con rotación y revocación.

## Trabajo paralelo de Claude Code

Claude puede comenzar `apps/web` usando los tipos generados y los siete fixtures publicados. Su scope sigue siendo shell, navegación por rol, tokens, componentes, accesibilidad y prototipo; cualquier cambio de contrato se registra por CCR.
