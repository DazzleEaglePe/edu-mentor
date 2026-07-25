# Práctica · Estados de oleada y concurrencia de capacidad

## Objetivo

Entender cómo una entidad aparentemente simple —una oleada con fechas y cupos— se convierte en una
frontera de consistencia para enrollments, agenda y asignaciones.

## 1. Un enum no es una máquina de estados

El enum permite cuatro valores:

```text
DRAFT · OPEN · IN_PROGRESS · CLOSED
```

Eso no significa que todas las transiciones sean válidas. El piloto usa un flujo lineal:

```text
DRAFT → OPEN → IN_PROGRESS → CLOSED
```

No se salta de `DRAFT` a `IN_PROGRESS`, no se retrocede y `CLOSED` queda de solo lectura. Esta
regla evita reinterpretar después una cohorte cuyo programa ya terminó.

## 2. Versión y estado protegen cosas diferentes

`expectedVersion` detecta que otra persona editó la misma fila desde que el cliente la leyó.
La máquina de estados decide si la intención sigue siendo válida incluso con una versión vigente.

```text
versión obsoleta          → 409 VERSION_CONFLICT
transición no permitida   → 409 INVALID_STATUS_TRANSITION
oleada terminal           → 409 OLEADA_CLOSED
```

Una comprobación no reemplaza la otra.

## 3. La capacidad es una invariante concurrente

Esta condición debe mantenerse:

```text
activeEnrollmentCount <= capacity
```

Comprobar el conteo sin bloquear la oleada deja una carrera:

```text
admin reduce capacidad → lee 18
otro request inscribe  → crea el enrollment 19
admin guarda 18        → capacidad menor al estado real
```

`PATCH /admin/oleadas/{id}` y `POST /admin/enrollments` toman un lock `FOR UPDATE` sobre la misma
fila. Dos operaciones que afectan cupos se serializan en una frontera compartida.

## 4. Idempotencia reutilizable

Usuarios y oleadas necesitan la misma semántica:

- reservar una key por organización y operación;
- comparar el fingerprint;
- ejecutar el efecto una vez;
- guardar la respuesta original;
- reproducirla ante un reintento equivalente.

La reserva y el fingerprint se extrajeron a `common/idempotency`. Cada dominio conserva solamente:

- su payload canónico;
- su parser de respuesta;
- su transacción de negocio.

Esto evita copiar un protocolo concurrente delicado.

## 5. Qué demuestra la integración

Sobre PostgreSQL/Redis reales:

1. el admin solo lista oleadas de su organización;
2. `activeEnrollmentCount` sale del estado persistido;
3. dos POST concurrentes producen una fila y dos respuestas 201 iguales;
4. reutilizar la key con otro nombre devuelve 409;
5. editar otra organización devuelve el mismo 404 oculto;
6. saltar un estado devuelve 409;
7. una versión anterior devuelve `VERSION_CONFLICT`;
8. la secuencia completa termina en `CLOSED`;
9. una oleada cerrada no se puede editar;
10. un participante recibe 403.

## 6. Cómo explicarlo a un cliente

> La plataforma guía cada oleada desde preparación hasta cierre, evita cambios incoherentes y
> protege los cupos aun cuando dos personas administran al mismo tiempo.

## 7. Cómo explicarlo en entrevista

> Modelé la oleada como una máquina de estados lineal y combiné validación de transición con
> optimistic locking. Para proteger capacidad tomé un row lock que también será usado por el alta
> de enrollments, creando una frontera de serialización compartida. La creación reutiliza un
> protocolo idempotente común y tiene una prueba HTTP concurrente sobre PostgreSQL.

## 8. Límite actual

El lock ya protege ambos lados de la invariante de capacidad. La continuación del setup
administrativo es asignar mentores con alcance, vigencia e historial explícitos.
