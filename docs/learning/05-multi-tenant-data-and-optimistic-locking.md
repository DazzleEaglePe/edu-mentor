# Práctica · Datos sintéticos, multi-tenancy y optimistic locking

## Objetivo

Entender cómo pasar de una policy de autorización aislada a una operación de negocio que protege
datos reales en todas sus capas. El caso práctico es la edición administrativa de usuarios en
EDU-MENTOR.

## 1. Seed, fixture y migración resuelven problemas diferentes

| Artefacto | Para qué sirve | Ejemplo |
|---|---|---|
| Migración | Cambiar la estructura durable de la base | Crear `user`, `role` y constraints |
| Seed | Crear un estado reproducible para desarrollo o pruebas | Dos organizaciones y tres roles |
| Fixture | Representar una respuesta de contrato sin exigir persistencia | `ParticipantDashboard` |

Una migración no debe cargar personas demo. Un fixture no demuestra que una consulta real funciona.
El seed sí toca la base, pero aquí rechaza `NODE_ENV=production` y usa exclusivamente
`example.test`.

Prisma 7 ejecuta el seed solo de forma explícita con `prisma db seed`; el comando se declara en
`prisma.config.ts`. Esto evita que un reset o una migración disparen datos demo por sorpresa:
[Prisma · Seeding](https://www.prisma.io/docs/orm/prisma-migrate/workflows/seeding).

## 2. Reproducible no significa “funcionó una vez”

El seed usa identificadores estables y operaciones `upsert`. El gate de CI lo ejecuta dos veces
antes de probar la API.

```text
primera ejecución  → crea el baseline sintético
segunda ejecución  → converge al mismo baseline, sin duplicar
suite HTTP         → consume ese estado conocido
```

La segunda ejecución es una prueba de idempotencia: repetir una operación produce el mismo estado
observable. En este seed la repetición también revoca sesiones demo y restablece versiones, roles y
contraseñas. Por eso es útil para desarrollo y CI, pero está deliberadamente prohibido en
producción.

## 3. RBAC, tenant y ownership son filtros distintos

Para `PATCH /admin/users/{userId}` se responden tres preguntas:

```text
1. ¿La sesión tiene rol ADMIN?
2. ¿El usuario objetivo pertenece a la misma organization?
3. ¿La mutación todavía apunta a la versión que leyó el admin?
```

El guard responde la primera. La policy de autorización responde la segunda. El repository vuelve
a incluir `organizationId` en el `WHERE`, aunque el service ya lo validó.

Esa repetición es defensa en profundidad:

```text
request
  → guard ADMIN
  → policy misma organización
  → UPDATE WHERE id + organizationId + version
  → audit log en la misma transacción
```

Si una refactorización omite la policy, la consulta sigue limitada. Si una consulta se escribe mal,
la prueba HTTP cross-organization debe detectarlo.

## 4. Por qué un recurso ajeno responde 404

Un `403` confirma que el recurso existe pero el actor no puede usarlo. En ciertos dominios esa
confirmación ya es una fuga.

EDU-MENTOR devuelve el mismo `404 RESOURCE_NOT_FOUND` para:

- un UUID inexistente;
- un usuario perteneciente a otra organización.

La respuesta no incluye nombre, email, organización ni una explicación diferente. El frontend debe
decir “no está disponible”, no afirmar “no existe”.

## 5. Optimistic locking evita sobrescribir trabajo reciente

Dos administradores pueden abrir la versión 3 del mismo usuario. El primero guarda y crea la
versión 4. El segundo todavía envía `expectedVersion: 3`.

La actualización se expresa como una sola condición atómica:

```sql
UPDATE "user"
SET ..., version = version + 1
WHERE id = :id
  AND organization_id = :organizationId
  AND version = :expectedVersion;
```

Si se actualizan cero filas y el recurso todavía existe, la API devuelve:

```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "details": {
      "expectedVersion": 3,
      "currentVersion": 4
    }
  }
}
```

Esto no “fusiona” cambios automáticamente. Obliga a refrescar, comparar y decidir, evitando el
problema de **lost update**.

## 6. Auditoría y revocación pertenecen a la transacción

La mutación de usuario, el reemplazo de roles y el `audit_log` se confirman juntos. Si falla una
parte, ninguna queda aplicada.

Cuando `isActive` cambia a `false`, también se revocan las sesiones activas del usuario dentro de
la misma transacción. Desactivar una cuenta sin cerrar sus sesiones dejaría una ventana de acceso
inconsistente.

El audit log conserva:

- actor;
- organización;
- entidad;
- valores anteriores y posteriores permitidos;
- trace ID.

No conserva password hash, tokens ni secretos.

## 7. Laboratorio reproducible

Controles rápidos:

```bash
pnpm check
pnpm --filter @edu-mentor/api db:validate
```

Con PostgreSQL y Redis:

```bash
bash tools/ci/data-runtime-smoke.sh
```

La integración demuestra:

1. el seed converge al ejecutarse dos veces;
2. el admin lista solo tres usuarios de su organización;
3. el cuarto usuario, de otra organización, no aparece;
4. intentar modificarlo devuelve el mismo 404 oculto;
5. modificar un usuario propio incrementa `version` y audita;
6. repetir la escritura con la versión anterior devuelve 409;
7. un participante recibe 403 al abrir la ruta administrativa.

## 8. Cómo explicarlo a un cliente

> Cada organización ve y modifica únicamente sus propios usuarios. Además, si dos personas editan
> el mismo registro, el sistema evita que una sobrescriba silenciosamente el trabajo de la otra y
> conserva una trazabilidad de quién hizo el cambio.

## 9. Cómo explicarlo en entrevista

> Implementé una mutación multi-tenant con autorización en capas: guard RBAC, policy de
> organización y scoping defensivo en repository. La escritura usa optimistic locking con
> `expectedVersion`, reemplaza roles y registra before/after dentro de una transacción. Cerré el
> slice con un seed sintético idempotente y pruebas HTTP negativas cross-role y
> cross-organization sobre PostgreSQL/Redis reales.

## 10. Límite de fase

El fixture de dashboard permite trabajar la UI, pero todavía no existe un endpoint runtime para
sus métricas. Las fuentes reales de sesiones y entregables se crearán en Fases 2 y 3. Presentar el
fixture como si fuera persistencia real falsearía el estado del producto.
