# Práctica · Invariantes transaccionales en enrollments

## Objetivo

Entender por qué “inscribir a una persona” no es un `INSERT` aislado: combina autorización
multi-tenant, elegibilidad, capacidad, idempotencia, máquinas de estado y auditoría.

## 1. Una invariante que involucra varias filas

La regla de cupo es:

```text
COUNT(enrollment WHERE oleada = X AND status = ACTIVE) <= oleada.capacity
```

Una restricción `CHECK` no puede contar otras filas. Leer el conteo y luego insertar tampoco basta:
dos requests podrían observar un cupo libre y ocuparlo simultáneamente.

La solución usa la oleada como punto de coordinación:

```text
BEGIN
  SELECT oleada FOR UPDATE
  validar tenant, estado y elegibilidad
  contar enrollments ACTIVE
  insertar si count < capacity
COMMIT
```

Todo alta y toda reducción de capacidad bloquean esa misma fila. PostgreSQL ordena las operaciones;
solo una puede decidir sobre el último cupo a la vez.

## 2. Rollback de una reserva idempotente fallida

El request crea primero una reserva de `Idempotency-Key`. Si después descubre que no hay cupo, no
debe dejar esa reserva incompleta:

```text
reserva creada
capacidad llena
ROLLBACK de toda la transacción, incluida la reserva
```

Si se confirmara la reserva sin respuesta, un reintento con la misma clave encontraría un registro
“en progreso” que nadie completará. En EDU-MENTOR, los fallos de negocio lanzan un aborto interno de
la transacción y luego se convierten en un error HTTP estable. Así, cuando se libera un cupo, el
mismo request puede intentarse nuevamente.

Esto separa dos conceptos:

- idempotencia de un efecto exitoso: se conserva y se reproduce;
- fallo previo al efecto: se revierte y sigue siendo reintentable.

## 3. Estado y fase son ejes distintos

`status` describe si la inscripción sigue operativa:

```text
ACTIVE → WITHDRAWN
ACTIVE → COMPLETED
```

`currentPhase` describe avance pedagógico:

```text
FASE_0 → FASE_1 → FASE_2 → FINISHED
```

No conviene fusionarlos. Una persona puede retirarse en cualquier fase, y llegar a `FINISHED` no
debe inventar automáticamente una decisión administrativa de `COMPLETED`.

`currentWeek` solo tiene sentido en `FASE_1`. Al avanzar a `FASE_2`, la transacción:

1. limpia `currentWeek`;
2. fija `phase1GraduatedAt`;
3. incrementa `version`;
4. escribe auditoría before/after.

## 4. Concurrencia pesimista y optimista juntas

Se usan dos estrategias porque protegen conflictos diferentes:

| Técnica | Protege |
|---|---|
| `FOR UPDATE` pesimista | el último cupo compartido por múltiples enrollments |
| `expectedVersion` optimista | dos ediciones del mismo enrollment desde pantallas desactualizadas |

El lock no sustituye la versión; la versión no protege un agregado de varias filas.

## 5. Defensa multi-tenant

La organización nunca llega desde el body. Se deriva de la sesión autenticada y participa en:

- filtro de listas;
- búsqueda y lock de oleada;
- validación de persona;
- lookup de enrollment;
- clave idempotente;
- auditoría.

Un UUID válido de otra organización no concede acceso. La API responde con un error neutral y no
revela datos del tenant ajeno.

## 6. Qué demuestra la prueba concurrente

La integración sobre PostgreSQL real hace competir dos participantes por una oleada de capacidad 1:

1. exactamente un POST devuelve `201`;
2. el otro devuelve `409 OLEADA_CAPACITY_REACHED`;
3. solo existen una fila, una auditoría y una respuesta idempotente completada;
4. la clave perdedora no queda reservada;
5. al retirar al ganador, repetir la solicitud perdedora con la misma clave devuelve `201`;
6. repetir ese éxito devuelve exactamente la misma respuesta.

También prueba aislamiento de organización, RBAC, filtros, versión obsoleta, avance lineal,
graduación de Fase 1 y estados terminales.

## 7. Cómo explicarlo a un cliente

> La plataforma nunca sobrevende cupos: incluso si dos administradores inscriben al mismo tiempo,
> la base de datos decide de forma ordenada y conserva trazabilidad de quién ocupó el lugar.

## 8. Cómo explicarlo en entrevista

> Implementé una invariante de capacidad que abarca una tabla padre y múltiples enrollments. Usé la
> oleada como frontera de serialización con row-level locking, mantuve `expectedVersion` para
> ediciones optimistas y diseñé la idempotencia para revertir reservas ante fallos de negocio. Lo
> validé con una carrera HTTP real en PostgreSQL donde dos usuarios compiten por el último cupo.
