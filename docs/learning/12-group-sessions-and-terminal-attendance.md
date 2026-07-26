# Práctica · Estado individual dentro de una sesión grupal

## 1. Un agregado puede contener máquinas de estado independientes

Una sesión grupal tiene un solo ciclo de vida:

```text
SCHEDULED → COMPLETED | CANCELLED | RESCHEDULED
```

pero cada `SessionParticipant` mantiene por separado:

```text
confirmationStatus: PENDING ↔ CONFIRMED | DECLINED
attendanceStatus:   PENDING → ATTENDED | ABSENT
```

Por eso una sesión no se vuelve `CONFIRMED`. En el fixture de ocho personas hay cinco que
confirmaron, una que declinó y dos que no respondieron, mientras la sesión continúa `SCHEDULED`.
El resumen es una proyección derivada; la fuente de verdad sigue siendo cada participante.

## 2. El lock debe tener la granularidad del conflicto

Confirmar bloquea la fila `session_participant`, no todas las personas de la sesión. Dos
participantes pueden responder en paralelo porque actualizan filas diferentes. La sesión se toma
con lock compartido únicamente para impedir que una futura transición de ciclo de vida cambie su
estado al mismo tiempo.

Esta es una regla útil para sistemas concurrentes:

> Bloquea el recurso mínimo que protege la invariante; un lock más amplio reduce carreras, pero
> también elimina concurrencia válida.

## 3. Fase y periodo forman una unión exclusiva

El formulario y el backend implementan el mismo tipo conceptual:

```ts
type SessionPeriod =
  | { phase: 'FASE_1'; weekNumber: 1 | 2 | 3 | 4 | 5 | 6; checkpointMonth?: never }
  | { phase: 'FASE_2'; weekNumber?: never; checkpointMonth: 1 | 2 | 3 | 6 };
```

La validación de servicio produce `PHASE_PERIOD_MISMATCH` y PostgreSQL repite la invariante con un
`CHECK`. La doble defensa evita que otro proceso o una importación escriba combinaciones que la API
rechazaría.

## 4. Confirmación no predice asistencia

Una respuesta `CONFIRMED` no se convierte automáticamente en `ATTENDED`; alguien puede confirmar y
faltar. De igual forma, `DECLINED` no autoriza a inventar una ausencia antes de la sesión. Asistencia
solo se registra cuando `now >= startsAt`.

El flujo usa `expectedVersion` sobre `SessionParticipant`, porque confirmación y asistencia
modifican la misma fila. Una pantalla que leyó versión 1 no puede sobrescribir silenciosamente una
confirmación que ya produjo versión 2.

## 5. Terminal para operación, corregible con trazabilidad

El mentor puede hacer la primera marca `PENDING → ATTENDED|ABSENT`. Después:

- repetir exactamente el mismo estado devuelve éxito sin nuevo evento;
- cambiarlo como mentor devuelve `ATTENDANCE_ALREADY_RECORDED`;
- administración puede corregirlo y genera auditoría `before/after`.

Así el flujo normal es terminal, pero un error humano no obliga a editar la base manualmente. La
corrección no borra quién registró el valor anterior ni quién lo corrigió.

## 6. Qué demuestra la prueba de integración

La integración crea datos sintéticos y verifica:

1. una sesión `GROUP` con ocho reservas de participante y una de mentor;
2. seis identidades autenticadas que responden sobre filas independientes;
3. el resumen real `5/1/2`;
4. un `CHECKPOINT` de Fase 2 con `checkpointMonth=3` y sin `weekNumber`;
5. rechazo del mes 4;
6. rechazo de asistencia antes de `startsAt`;
7. prohibición para participante;
8. primera marca por mentor, reintento idempotente y corrección por Admin;
9. dos auditorías y dos eventos, uno por cambio real.

En una entrevista técnica, esto se puede resumir así:

> Modelé la sesión grupal como agregado con estados individuales por participante. Permití
> confirmaciones concurrentes con locks por fila, protegí fase/periodo en servicio y base de datos,
> y diseñé asistencia terminal con corrección administrativa auditable.
