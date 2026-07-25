# L02 · Persistencia y observabilidad

## Objetivo

Entender cómo un modelo de negocio pasa de documentación a una base persistente y cómo seguir una operación desde la interfaz hasta el backend.

## 1. Cuatro conceptos que no son equivalentes

### Modelo de dominio

Describe conceptos y reglas del negocio: usuario, oleada, matrícula, asignación y sus relaciones. Puede existir antes de elegir una base de datos.

### Schema Prisma

Es una representación tipada de modelos, campos y relaciones. Prisma puede validarlo y generar un cliente aunque todavía no exista una base ejecutándose.

### Migración

Es un cambio versionado que transforma una base real. Crear el schema no significa haber ejecutado una migración. En EDU-MENTOR el checkbox permanece abierto hasta generar y probar el SQL contra PostgreSQL.

### Repositorio o servicio de persistencia

Es código de aplicación que usa el cliente dentro de casos de uso y transacciones. El controller no debe hablar directamente con Prisma.

Flujo:

```text
regla de negocio → schema → migración SQL → repositorio → service → controller
```

## 2. Decisiones aplicadas

### Frontera multi-tenant

`organization_id` impide confundir una cohorte con el dueño de los datos. Toda consulta futura deberá filtrar primero por organización y luego aplicar rol, asignación y ownership.

### Concurrencia optimista

El campo `version` permite detectar que dos personas editaron el mismo recurso. La operación compara `expectedVersion`; si ya cambió, responde `409 VERSION_CONFLICT` en vez de sobrescribir silenciosamente.

### Rotación de sesión

El refresh token no se almacena en texto plano. Su hash pertenece a una familia y cada rotación enlaza la sesión anterior con la nueva. Reutilizar un token anterior permitirá revocar la familia completa.

### Auditoría y outbox

- auditoría responde quién hizo qué, sobre qué entidad y con cuál `traceId`;
- outbox guarda el cambio de dominio y el evento en la misma transacción;
- Redis/BullMQ entrega trabajos, pero no se convierte en la fuente de verdad.

## 3. Qué aporta un trace ID

Un `traceId` es un identificador de correlación por solicitud:

```text
pantalla → request HTTP → log 5xx → audit_log
             mismo traceId
```

No arregla el error por sí mismo. Reduce el tiempo para localizarlo sin mostrar stack traces, SQL, tokens o información privada al usuario.

En esta implementación:

- el servidor genera un UUID nuevo;
- lo devuelve como `X-Trace-Id`;
- lo incluye en el envelope de error;
- los errores 5xx registran evento, método, path sin query string, status y nombre de excepción;
- el mensaje interno de una excepción desconocida nunca sale al cliente.

## 4. Ejercicio práctico

1. Ejecuta `pnpm dev:api`.
2. Consulta una ruta inexistente.
3. Compara el encabezado `X-Trace-Id` con `error.traceId`.
4. Cambia temporalmente el mensaje interno de una excepción en una prueba.
5. Verifica que la respuesta pública sigue siendo genérica.

## 5. Cómo explicarlo en entrevista o demo

> Separé modelo, schema y migración para no declarar infraestructura como terminada antes de probarla. Diseñé una frontera organizacional, concurrencia optimista y rotación de sesiones. En la frontera HTTP añadí códigos estables y trace IDs para que frontend, logs y auditoría puedan correlacionarse sin exponer datos internos.

Esa explicación demuestra criterio de backend y plataforma: no solo usar un ORM, sino proteger invariantes, operación y diagnóstico.
