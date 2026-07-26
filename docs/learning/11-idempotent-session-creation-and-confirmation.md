# Práctica · Creación idempotente y confirmación concurrente

## Objetivo

Entender cómo convertir “agendar una mentoría” en una unidad transaccional que tolere doble clic,
reintentos y solicitudes concurrentes sin duplicar sesiones ni dejar efectos parciales.

## 1. El agregado nace completo o no nace

Crear una sesión 1:1 produce varios registros:

```text
Session
  ├── SessionParticipant
  ├── ScheduleReservation(USER mentor)
  ├── ScheduleReservation(ENROLLMENT participante)
  ├── AuditLog
  ├── OutboxEvent
  └── IdempotencyRecord completado
```

Todos se escriben en una transacción. Si falla una reserva, también desaparecen la sesión, la
auditoría y la reserva de idempotencia provisional. No existe un estado “sesión creada pero sin
participante”.

## 2. Idempotencia no significa ignorar duplicados

El cliente envía `Idempotency-Key`. El servidor guarda dos hashes separados:

- hash de la key, para no persistirla en texto;
- fingerprint del request canónico.

Los resultados posibles son:

| Situación | Resultado |
|---|---|
| key nueva | ejecuta y guarda el `201` |
| misma key + mismo fingerprint | devuelve la respuesta original |
| misma key + otro fingerprint | `409 IDEMPOTENCY_KEY_REUSED` |

Antes de calcular el fingerprint se normalizan fechas, espacios, nulos y orden de enrollment IDs.
Dos representaciones equivalentes no deben convertirse en operaciones distintas.

## 3. La reserva provisional también es transaccional

La key se reserva al comenzar, pero solo se completa después de crear todo el agregado. Los fallos
de dominio lanzan un abort interno para forzar rollback.

Si se confirmara la reserva de idempotencia antes de terminar, un conflicto de horario dejaría una
respuesta incompleta y el siguiente intento ya no podría continuar.

## 4. Precheck útil, constraint autoritativo

Antes de escribir se busca un conflicto para producir un error claro. Ese precheck mejora la
experiencia, pero no garantiza exclusión:

```text
request A: precheck libre
request B: precheck libre
request A: inserta reservas
request B: intenta insertar → PostgreSQL 23P01
```

La base decide al ganador. El repositorio reconoce `23P01`, vuelve a consultar el intervalo
ocupado y devuelve `SCHEDULE_CONFLICT`.

## 5. Locks con la granularidad correcta

Las creaciones toman un lock compartido de oleada:

- varias sesiones pueden intentar crearse a la vez;
- cerrar o alterar la oleada no puede intercalarse;
- la protección temporal sigue a cargo del exclusion constraint.

Usar `FOR UPDATE` sobre la oleada habría serializado toda Agenda y ocultado la carrera que queríamos
probar.

En confirmación se usa:

```text
FOR SHARE  sobre Session
FOR UPDATE sobre SessionParticipant
```

Así participantes distintos de una sesión grupal podrán confirmar en paralelo, mientras una futura
cancelación que necesite lock exclusivo deberá esperar.

## 6. Optimistic locking para una decisión reversible

Confirmar y declinar son estados reversibles hasta `confirmationClosesAt`. Cada cambio recibe
`expectedVersion`:

```text
cliente leyó version 1
otro dispositivo cambió a CONFIRMED → version 2
cliente intenta DECLINED con expectedVersion 1
→ 409 VERSION_CONFLICT
```

Repetir el mismo estado con la versión vigente no incrementa versión ni duplica auditoría/outbox.
Eso conserva la semántica idempotente de `PUT`.

## 7. Confirmación no es asistencia

El cambio solo modifica:

- `confirmationStatus`;
- `confirmedAt`;
- `version`.

`attendanceStatus` permanece `PENDING`. Una persona puede confirmar y finalmente faltar, o declinar
y aun así asistir. Son hechos distintos y los reportes deben mantenerlos separados.

## 8. Outbox dentro de la transacción

La API no envía una notificación directamente. Persiste un `OutboxEvent` junto con el cambio:

```text
session.created
session.participant_confirmation_changed
```

La key del evento incorpora agregado, participante y versión. Un worker posterior podrá entregar
la notificación sin que un retry HTTP duplique el evento. El canal todavía no se elige: esa decisión
de Producto no se inventa en este slice.

## 9. Qué demuestra la integración

Sobre PostgreSQL real:

1. crea una sesión como mentor asignado;
2. repite la key y obtiene la misma respuesta sin efectos nuevos;
3. reutiliza la key con otro payload y obtiene `409`;
4. bloquea creación desde el rol participante;
5. confirma, repite el mismo estado y luego declina;
6. detecta una versión obsoleta;
7. rechaza cambios después del cutoff;
8. comprueba auditoría y outbox exactos;
9. hace competir dos creaciones y obtiene un `201` y un `409`;
10. verifica una sola sesión y dos reservas vivas.

## 10. Cómo explicarlo a un cliente

> Un doble clic o un reintento de red no duplica la mentoría. Si dos personas intentan ocupar el
> mismo horario, la base de datos garantiza un solo ganador y la otra recibe un conflicto claro.

## 11. Cómo explicarlo en entrevista

> Implementé la creación de un agregado Session con idempotencia semántica, auditoría y
> transactional outbox. Combiné un precheck para errores útiles con una exclusion constraint como
> autoridad concurrente, y usé optimistic locking para confirmaciones reversibles.
