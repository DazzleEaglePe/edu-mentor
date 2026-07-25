# Checkpoint · Ciclo administrativo idempotente de usuarios

Fecha: 2026-07-25

Fase: 1 · Fundaciones

Rama: `agent/phase1-admin-user-lifecycle`

PR: [#5](https://github.com/DazzleEaglePe/edu-mentor/pull/5)

Base apilada: `agent/phase1-core-access` · PR #4

Estado del gate: slice cerrado; Fase 1 continúa.

## Resultado

El recurso administrativo de usuarios ya cubre su ciclo MVP:

1. `POST /admin/users` limitado a `ADMIN` y a su organización;
2. validación explícita de DTO y `Idempotency-Key`;
3. normalización de email/nombre y roles múltiples;
4. contraseña temporal con scrypt y `mustChangePassword = true`;
5. perfil automático cuando el nuevo usuario tiene rol `MENTOR`;
6. reintento equivalente con la misma respuesta `201`;
7. rechazo `409 IDEMPOTENCY_KEY_REUSED` cuando la key representa otro payload;
8. rechazo `409 EMAIL_ALREADY_EXISTS` para otro intento sobre el mismo email;
9. `POST /admin/users/{userId}/password-reset`;
10. revocación de sesiones, incremento de versión y auditoría no sensible;
11. ocultamiento cross-organization con `404 RESOURCE_NOT_FOUND`;
12. fixture de página administrativa para el track frontend.

## Diseño de idempotencia

La migración crea `idempotency_record` con unicidad por:

```text
organization_id + operation + key_hash
```

`key_hash` y `request_hash` son HMAC-SHA-256 con claves derivadas y dominios distintos. La
contraseña temporal participa en la huella de la intención, pero no queda almacenada.

La reserva, el usuario, los roles, el perfil de mentor, la auditoría y la respuesta original se
confirman dentro de una misma transacción. El índice único hace que solicitudes concurrentes
compitan en PostgreSQL y solo una ejecute el efecto.

## Invariantes demostradas

| Riesgo | Control | Evidencia |
|---|---|---|
| Doble clic crea dos cuentas | Reserva con índice único | Dos POST simultáneos devuelven el mismo id; una fila |
| Misma key oculta otra intención | Fingerprint canónico | Payload diferente devuelve 409 |
| Key o password quedan persistidos | HMAC + snapshot permitido | Longitud 64 y auditoría sin secretos |
| Admin modifica otro tenant | `organizationId` en lock/query | 404 y hash externo sin cambios |
| Reset deja sesiones vigentes | Revocación transaccional | `/auth/me` anterior devuelve 401 |
| Password anterior sigue válida | Nuevo scrypt hash | Login anterior 401; nueva temporal 200 |
| Rol mentor queda incompleto | `MentorProfile` transaccional | Perfil único creado |
| Reintento duplica auditoría | Respuesta idempotente almacenada | Una sola acción `admin.user_created` |

## Evidencia reproducible

Validación local:

```text
pnpm_check=ok
format_check=ok
eslint=ok
openapi_lint=ok
typecheck=ok
unit_tests=32_passed
build=ok
prisma_schema=valid
production_seed_guard=blocked
```

Validación real:

```text
github_ci_run=30178318291
quality_job=passed_in_46s
data_runtime_job=passed_in_1m10s
migrations_applied=2
existing_integration_tests=3_passed
synthetic_seed_runs=2_passed
admin_lifecycle_http_test=passed
concurrent_create=one_effect_two_equal_201_responses
data_runtime_smoke=ok
pr_mergeable=MERGEABLE
pr_merge_state=CLEAN
```

Evidencia:
[GitHub Actions run 30178318291](https://github.com/DazzleEaglePe/edu-mentor/actions/runs/30178318291).

## Handoff a Claude Code

Fuente para A5:

- fixture: `docs/api/fixtures/admin.users-page.json`;
- lista: `GET /admin/users?page=1&limit=20`;
- creación: `POST /admin/users` con `Idempotency-Key` de 16–128 caracteres;
- edición: `PATCH /admin/users/{userId}` con `expectedVersion`;
- reset: `POST /admin/users/{userId}/password-reset`;
- errores nuevos: `IDEMPOTENCY_KEY_REUSED` y `EMAIL_ALREADY_EXISTS`;
- un `404` debe redactarse como recurso no disponible, sin afirmar que no existe;
- la UI nunca muestra, registra ni vuelve a leer la contraseña temporal después de enviarla.

## Conceptos aprendidos

- idempotencia de comando vs. unicidad de datos;
- carrera check-then-insert;
- reserva transaccional e índice único;
- canonicalización de payload;
- HMAC, HKDF y separación de dominio;
- scrypt vs. fingerprint estable;
- revocación de sesiones al rotar credenciales;
- auditoría con allowlist de campos.

Lección:
[Idempotencia concurrente y reset seguro](../learning/06-idempotent-user-creation-and-credential-reset.md).

## Límites explícitos

- La retención es de 24 horas; falta un job general de limpieza y métricas operativas.
- El primer admin y las referencias de roles requieren provisionamiento productivo explícito.
- La edición runtime de capacidades del mentor aún no está publicada.
- Oleadas, enrollments y mentor assignments tienen schema/seed, pero sus operaciones runtime son el
  siguiente slice.
- Secret scanning, dependency audit y drift DTO ↔ OpenAPI siguen pendientes.

## Siguiente slice backend

1. publicar gestión runtime de oleadas;
2. publicar altas/cambios de enrollment;
3. crear/cerrar mentor assignments preservando historial;
4. cubrir capacidad, organización, vigencia y concurrencia;
5. entregar fixtures administrativos restantes conectados a respuestas reales.
