# Checkpoint · Fundación de autenticación

Fecha: 2026-07-25
Fase: 1 · Fundaciones
Rama: `agent/phase1-auth`
PR: [#3](https://github.com/DazzleEaglePe/edu-mentor/pull/3)
Estado del gate: auth cerrado; Fase 1 continúa.

## Resultado

Se convirtió el contrato de autenticación en un slice HTTP ejecutable:

1. `GET /auth/csrf`;
2. `POST /auth/login`;
3. `POST /auth/refresh`;
4. `POST /auth/logout` y `/auth/logout-all`;
5. `GET /auth/me`;
6. `POST /auth/change-password`;
7. access JWT de 15 minutos en cookie;
8. refresh opaco de 7 días, persistido solo como HMAC;
9. rotación refresh con detección de replay y revocación de familia;
10. scrypt con salt único para contraseñas;
11. rate limit de login respaldado por Redis;
12. guards globales de identidad, cambio obligatorio de contraseña, roles y CSRF;
13. policy reutilizable de organización/ownership;
14. auditoría transaccional de los eventos auth.

## Invariantes demostradas

| Riesgo | Control | Prueba |
|---|---|---|
| Robo desde JavaScript | Cookies `HttpOnly`, `SameSite=Lax`; refresh limitado a `/api/v1/auth` | Flags inspeccionadas en integración |
| CSRF | Challenge stateful, header, `Origin/Referer` y Fetch Metadata | Login sin challenge devuelve 403 |
| Fuga de refresh en DB | Solo se persiste HMAC derivado con pepper | Repository no recibe secreto crudo |
| Replay de refresh | Rotación enlazada por familia | Reutilizar el token anterior devuelve 409 y revoca la familia |
| JWT ambiguo | Algoritmo, `typ`, issuer y audience fijados | Tokens expirados o firmados con otra clave se rechazan |
| Enumeración de cuentas | Error genérico y trabajo scrypt equivalente | Usuario inexistente no revela su estado |
| Fuerza bruta | Límites por IP y por par IP/correo | El sexto intento del par devuelve 429 |
| Acceso posterior a logout | Sesión persistida validada en cada request | Access JWT deja de servir al revocar la sesión |
| Cambio de contraseña | Verifica actual, evita reutilización y revoca otras sesiones | Contraseña anterior falla y la nueva inicia sesión |
| Cruce de organización | Policy oculta recurso como 404 | Prueba negativa de organización |

La UI usa el rol para mostrar navegación, pero el backend nunca toma esa UI como prueba de
autorización.

## Evidencia reproducible

Validación local:

```text
pnpm check=ok
unit_tests=20_passed
format_check=ok
eslint=ok
openapi_lint=ok
typecheck=ok
build=ok
```

Validación con servicios reales:

```text
github_ci_run=30175676387
github_quality_job=passed_in_40s
github_data_runtime_job=passed_in_59s
database_integration_tests=2_passed
auth_http_flow=passed_in_2444ms
data_runtime_smoke=ok
pr_mergeable=MERGEABLE
pr_merge_state=CLEAN
```

GitHub Actions levantó PostgreSQL 16.14 y Redis 8.2.7, aplicó la migración, generó el cliente
Prisma, levantó Nest y ejecutó el flujo:

```text
CSRF negativo
  → login
  → /me
  → refresh
  → replay del refresh anterior
  → familia revocada
  → nuevo login
  → cambio de contraseña
  → login con contraseña anterior rechazado
  → login con contraseña nueva
  → logout-all
  → access rechazado
```

Evidencia:
[GitHub Actions run 30175676387](https://github.com/DazzleEaglePe/edu-mentor/actions/runs/30175676387).

## Hallazgo del pipeline

La primera ejecución falló porque `data-runtime` importó la API antes de generar el cliente
Prisma. `quality` sí lo había generado, pero los jobs de CI tienen filesystems independientes.

Se corrigió el smoke test para ejecutar `pnpm generate` dentro del mismo job. La siguiente
ejecución pasó completa. La lección es la misma que en un sistema distribuido: un artefacto
producido en otro proceso no existe localmente a menos que se publique y consuma explícitamente.

## Límites explícitos

- El PR sigue como borrador y depende del PR de runtime de datos.
- Los guards y la policy de ownership existen, pero falta aplicarlos a un recurso funcional y
  demostrar acceso cross-user en HTTP.
- La auditoría está completa para auth, no todavía para los demás módulos.
- No existen aún seed reutilizable, CRUD de usuarios/roles ni reset administrativo.
- Secret scanning y dependency audit siguen pendientes en el gate de Fase 1.
- El entorno local no tiene Docker; la ejecución PostgreSQL/Redis se realizó en CI.

## Siguiente slice backend

1. crear seed ficticio reproducible por rol;
2. implementar usuarios, roles, mentor capabilities, oleadas y enrollments mínimos;
3. aplicar scoping de organización y ownership a un endpoint funcional;
4. ejecutar prueba HTTP cross-user y cross-organization;
5. entregar a Claude el contrato real de sesión para sustituir fixtures.
