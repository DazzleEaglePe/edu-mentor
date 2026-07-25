# Práctica · Idempotencia concurrente y reset seguro de credenciales

## Objetivo

Entender por qué “si llega dos veces, primero consulto si ya existe” no evita duplicados bajo
concurrencia, y cómo completar un ciclo administrativo de credenciales sin almacenar secretos en
auditoría ni dejar sesiones antiguas activas.

## 1. Idempotencia no significa deduplicar por email

El email único impide dos filas iguales, pero no puede decir si una segunda solicitud es:

- el reintento legítimo de una respuesta perdida;
- otra intención que reutilizó accidentalmente la misma clave;
- una creación distinta con un email ya utilizado.

Por eso `POST /admin/users` exige `Idempotency-Key`. La identidad de la operación es:

```text
organizationId + operation + HMAC(idempotencyKey)
```

La clave queda aislada por organización y tipo de operación. La base nunca conserva su valor
original.

## 2. Check-then-insert tiene una carrera

Este patrón es incorrecto:

```text
request A → SELECT: no existe
request B → SELECT: no existe
request A → INSERT user
request B → INSERT user
```

EDU-MENTOR inserta primero una reserva con un índice único. En PostgreSQL, dos transacciones que
compiten por la misma clave se serializan sobre ese índice:

```text
A → reserva key → crea user + roles + audit → guarda respuesta → COMMIT
B → intenta reserva y espera → detecta conflicto → lee la respuesta de A
```

Usuario, roles, perfil de mentor, auditoría y respuesta idempotente viven en una sola transacción.
Si una parte falla, la reserva también desaparece; el cliente puede reintentar.

## 3. Misma clave, mismo significado

Se calcula una huella HMAC sobre un payload canónico:

- email normalizado;
- nombre sin espacios exteriores;
- roles ordenados;
- contraseña temporal.

Ordenar roles hace equivalentes `["MENTOR", "PARTICIPANT"]` y
`["PARTICIPANT", "MENTOR"]`. Cambiar cualquier dato significativo produce otra huella y la API
responde `409 IDEMPOTENCY_KEY_REUSED`.

La contraseña sí influye en la comparación, pero solo entra al HMAC. No se persiste en texto claro,
en la respuesta idempotente ni en el audit log.

## 4. Hash y HMAC resuelven problemas distintos

| Mecanismo | Uso aquí | Propiedad buscada |
|---|---|---|
| scrypt con salt | Contraseña del usuario | Costoso de probar por fuerza bruta |
| HMAC-SHA-256 | Clave idempotente y fingerprint | Comparación estable sin guardar el secreto |

Un hash rápido no es apropiado para contraseñas. Un password hash con salt tampoco sirve como
fingerprint estable porque cambia en cada ejecución.

La aplicación deriva claves HMAC separadas desde el pepper raíz mediante contextos distintos. Esa
separación de dominio evita reutilizar el mismo material criptográfico para propósitos diferentes.

## 5. Resetear no es solo cambiar `password_hash`

El reset administrativo ejecuta atómicamente:

1. bloquear y localizar el usuario dentro de la organización del admin;
2. almacenar el nuevo hash scrypt;
3. establecer `mustChangePassword = true`;
4. incrementar `version`;
5. revocar todas las sesiones activas;
6. registrar actor, entidad, versión y cantidad de sesiones revocadas.

La contraseña y su hash no entran al audit log. Un UUID de otra organización recibe el mismo
`404 RESOURCE_NOT_FOUND` que un recurso ausente.

## 6. Qué demuestra la integración

La prueba HTTP sobre PostgreSQL/Redis reales envía dos creaciones simultáneas y comprueba:

1. ambas respuestas son `201` y contienen el mismo usuario;
2. existe una sola fila de usuario, una reserva y una auditoría de creación;
3. la misma clave con otro payload devuelve 409;
4. un email repetido con otra clave devuelve `EMAIL_ALREADY_EXISTS`;
5. un participante recibe 403;
6. un admin no puede resetear credenciales de otra organización;
7. el reset invalida la sesión previa y la contraseña anterior;
8. la nueva temporal permite login y conserva `mustChangePassword = true`;
9. ningún secreto aparece en auditoría.

## 7. Cómo explicarlo a un cliente

> Si una conexión falla o alguien hace doble clic, la plataforma no crea cuentas duplicadas. Los
> restablecimientos de acceso cierran automáticamente las sesiones anteriores y obligan a que la
> persona cambie la contraseña temporal.

## 8. Cómo explicarlo en entrevista

> Implementé creación idempotente multi-tenant con una reserva transaccional protegida por índice
> único. Canonicalicé el payload y almacené solo HMACs con separación de dominio. Los reintentos
> equivalentes recuperan la respuesta original y una clave reutilizada con otro payload devuelve
> 409. El reset usa scrypt, revoca sesiones y audita metadatos no sensibles dentro de la misma
> transacción. La suite cubre una carrera HTTP real sobre PostgreSQL.

## 9. Límite de fase

La retención de las reservas es de 24 horas y el endpoint elimina una reserva vencida cuando esa
misma clave vuelve a usarse. Antes de producción conviene añadir un job general de limpieza y
métricas de reintentos/conflictos. El provisionamiento del primer admin tampoco depende de este
endpoint y necesita un procedimiento operativo explícito.
