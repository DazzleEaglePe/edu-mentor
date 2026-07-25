# Práctica · Autenticación, sesiones y autorización

## Objetivo

Entender por qué “tener login” no equivale a tener una frontera segura y poder explicarlo como
ingeniero, como proveedor de software y en una entrevista técnica.

## 1. Autenticación y autorización no son lo mismo

**Autenticación** responde “¿quién eres?”. En EDU-MENTOR se demuestra con contraseña y después
con una sesión válida.

**Autorización** responde “¿puedes hacer esto sobre este recurso?”. Combina:

- rol: participante, mentor o admin;
- organización: un usuario no sale de su tenant;
- ownership: un participante accede a sus propios recursos;
- relación de dominio: un mentor necesita assignment, no solo el texto `MENTOR`.

Un botón oculto mejora la UX, pero no autoriza. El backend repite la decisión en cada request.

## 2. Access y refresh resuelven problemas distintos

El access token es un JWT corto:

```text
vida=15 minutos
contenido=userId + sessionId
firma=HS256
validaciones=algoritmo + typ + issuer + audience + expiración
```

El refresh es un secreto opaco largo:

```text
vida=7 días
contenido visible=aleatorio, sin claims
persistencia=solo HMAC
uso=obtener una nueva pareja access/refresh
```

Un JWT corto reduce la ventana de exposición. La sesión persistida permite revocarlo antes de
que expire: cada request valida que su `sessionId` siga activo.

## 3. Rotación y detección de replay

La rotación transforma cada refresh en un secreto de un solo uso:

```text
login
  → sesión A activa

refresh A
  → sesión A revocada y reemplazada por B
  → sesión B activa

refresh A otra vez
  → A ya fue reemplazada
  → posible robo/replay
  → revocar toda la familia, incluida B
```

Sin el vínculo familiar, el servidor sabría que A ya no sirve, pero no podría invalidar el token
nuevo que posiblemente quedó en manos del atacante.

La operación usa una transacción y bloqueo de fila. Así, dos refresh concurrentes no crean dos
descendientes válidos.

## 4. Hash, cifrado y HMAC

Son herramientas diferentes:

- **hash de contraseña:** scrypt lento y con salt único; dificulta probar millones de candidatos;
- **cifrado:** reversible con una clave; no se necesita para verificar contraseñas;
- **HMAC de refresh:** determinista con un pepper del servidor; permite buscar el token sin
  guardar el secreto original.

El salt puede almacenarse junto al hash. El pepper debe vivir como secreto de entorno.

Para scrypt se usa el perfil mínimo recomendado como alternativa por
[OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html):
`N=2^17`, `r=8`, `p=1`.

## 5. Cookies, XSS y CSRF

`HttpOnly` evita que JavaScript lea la cookie directamente, lo que reduce el impacto de ciertos
ataques XSS. Pero el navegador adjunta cookies automáticamente: por eso aparece el riesgo CSRF.

EDU-MENTOR combina defensas:

1. `SameSite=Lax`;
2. token CSRF stateful vinculado a un navegador;
3. header `X-CSRF-Token`;
4. validación de `Origin` o `Referer`;
5. rechazo de `Sec-Fetch-Site: cross-site`;
6. path restringido para la cookie refresh.

OWASP recomienda usar tokens y validación de origen como capas complementarias:
[CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

## 6. Defensa frente a enumeración y fuerza bruta

Un login seguro no responde “este correo no existe”. Cuenta inexistente y contraseña incorrecta
devuelven el mismo error.

Además, la cuenta inexistente ejecuta trabajo scrypt equivalente para reducir diferencias
temporales. Redis limita intentos por:

- par IP/correo: protege una cuenta;
- IP: frena barridos de muchas cuentas;
- claves HMAC: Redis no recibe IP o correo en texto claro.

## 7. RBAC y ownership

RBAC es útil para capacidades amplias:

```text
ADMIN  → administración
MENTOR → operación de mentoría
```

No basta para decidir sobre una fila concreta. Ownership y scoping responden:

```text
¿el recurso pertenece a la organización de la sesión?
¿el usuario es owner?
¿existe una asignación activa que lo relacione?
```

Cuando un recurso ajeno no debe revelar su existencia, la policy devuelve 404 en lugar de 403.

## 8. Auditoría

Logs técnicos y audit log no son intercambiables:

- log técnico: ayuda a operar y diagnosticar;
- audit log: registra actor, acción, entidad, organización, antes/después y trace ID.

Login, rotación, replay, logout y cambio de contraseña dejan evidencia transaccional sin guardar
passwords, refresh tokens o IP cruda.

## 9. Laboratorio reproducible

Pruebas rápidas:

```bash
pnpm --filter @edu-mentor/api test
```

Gate completo:

```bash
pnpm check
```

Con PostgreSQL y Redis:

```bash
bash tools/ci/data-runtime-smoke.sh
```

Busca deliberadamente estas fallas:

1. login sin CSRF → 403;
2. refresh anterior reutilizado → 409 y familia revocada;
3. JWT de familia revocada → 401;
4. contraseña anterior después del cambio → 401;
5. access después de logout-all → 401;
6. recurso de otra organización → 404.

## 10. Cómo explicarlo a un cliente

> EDU-MENTOR no solo valida una contraseña. Mantiene sesiones revocables, detecta si un token de
> renovación vuelve a usarse, bloquea solicitudes desde orígenes no autorizados y registra los
> eventos sensibles. Esto reduce el riesgo de acceso persistente y permite investigar acciones
> sin almacenar secretos.

## 11. Cómo explicarlo en entrevista

> Implementé autenticación web con access JWT corto y refresh opaco rotatorio en cookies
> HttpOnly. El refresh se persiste como HMAC y cada rotación crea una sesión enlazada; un replay
> revoca toda la familia bajo transacción. Añadí CSRF stateful con validación de origen, scrypt,
> rate limiting en Redis, guards RBAC y una policy de ownership multi-tenant. Cerré el slice con
> pruebas negativas y un flujo HTTP real sobre PostgreSQL y Redis.

El JWT sigue las validaciones explícitas recomendadas por
[RFC 8725](https://www.rfc-editor.org/info/rfc8725/) y la rotación/replay se alinea con
[RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html).
