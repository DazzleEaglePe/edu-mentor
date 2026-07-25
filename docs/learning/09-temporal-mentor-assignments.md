# Práctica · Alcance temporal en asignaciones de mentor

## Objetivo

Entender cómo modelar permisos de negocio que cambian con el tiempo sin borrar su historia ni
duplicar estados contradictorios.

## 1. La asignación también es autorización

El rol `MENTOR` permite entrar al módulo, pero no autoriza a leer cualquier participante. La
asignación responde:

```text
¿qué mentor puede actuar?
¿sobre qué oleada o persona?
¿con qué capability?
¿durante qué periodo?
```

Por eso una asignación forma parte del modelo de autorización, no solo de una pantalla
administrativa.

## 2. Un nullable con significado de dominio

`enrollmentId` tiene dos significados explícitos:

| Valor | Alcance |
|---|---|
| `null` | toda la oleada |
| UUID | un enrollment específico de esa oleada |

`null` no significa “dato faltante”. Es una decisión válida de alcance. La API comprueba que un UUID
pertenezca a la oleada, siga `ACTIVE` y no cruce organización.

## 3. Estado derivado, no duplicado

La tabla persiste `startsAt` y `endsAt`; la API deriva:

```text
endsAt ausente o futuro → ACTIVE
endsAt alcanzado        → CLOSED
```

Persistir además una columna `status` permitiría combinaciones imposibles, como
`status = ACTIVE` con un periodo ya terminado. Derivar elimina esa fuente de drift.

## 4. DELETE semántico no siempre significa borrar

El contrato usa:

```http
DELETE /admin/mentor-assignments/{id}?expectedVersion=3
```

La operación significa “cerrar el alcance”, no borrar la fila:

1. bloquea la asignación;
2. valida `expectedVersion`;
3. fija `endsAt`;
4. incrementa `version`;
5. registra auditoría before/after;
6. devuelve `204`.

El historial puede responder después quién acompañó a quién y en qué periodo. Esta es una forma de
soft delete basada en tiempo, más expresiva que un booleano `deleted`.

## 5. Reasignar son dos hechos

Reasignar no sobrescribe `mentorUserId`:

```text
asignación A: ACTIVE → CLOSED
asignación B: crear ACTIVE
```

Así se conserva la línea temporal. En el piloto solo puede existir una asignación activa por:

```text
oleada + enrollmentId + capability
```

Crear bloquea la oleada antes de buscar un scope activo. Dos requests concurrentes sobre el mismo
scope no pueden decidir ambos que está libre.

## 6. Elegibilidad en capas

Un mentor operativo debe cumplir simultáneamente:

- usuario del mismo tenant;
- usuario activo;
- rol `MENTOR`;
- `mentorProfile`;
- capability `SPECIALIST`.

Tener solo el rol no prueba especialidad; tener solo el perfil no concede acceso al módulo.

## 7. Qué demuestra la integración

La prueba HTTP sobre PostgreSQL:

1. hace competir dos POST por el mismo scope;
2. obtiene exactamente un `201` y un `409 ACTIVE_MENTOR_ASSIGNMENT_EXISTS`;
3. comprueba una sola fila, auditoría y reserva idempotente;
4. cierra la ganadora con `DELETE` sin borrarla;
5. reutiliza el scope con la misma key que antes perdió;
6. filtra por `ACTIVE` y `CLOSED`;
7. prueba versión obsoleta, cierre repetido, tenant ajeno y RBAC;
8. verifica dos periodos cerrados y su auditoría completa.

## 8. Cómo explicarlo a un cliente

> Reasignar una mentoría no borra el pasado: cerramos la vigencia anterior y abrimos una nueva,
> manteniendo una trazabilidad clara de responsables y periodos.

## 9. Cómo explicarlo en entrevista

> Modelé mentor assignments como autorización temporal con scope de cohorte o participante. Derivé
> el estado desde la vigencia, implementé DELETE como cierre auditable con optimistic locking y
> serialicé altas concurrentes por scope usando un row lock compartido.
