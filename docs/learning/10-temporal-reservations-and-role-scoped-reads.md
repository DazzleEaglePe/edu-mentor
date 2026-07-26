# Práctica · Reservas temporales y lecturas limitadas por rol

## Objetivo

Entender por qué una agenda multiusuario necesita proteger los intervalos en la base de datos y
por qué el mismo registro puede producir respuestas distintas según la identidad autenticada.

## 1. Una sesión y una reserva no son lo mismo

`Session` guarda el hecho de negocio: título, fase, mentor, participantes, horario y estado.
`ScheduleReservation` protege un recurso durante un intervalo:

```text
Session
  ├── reserva USER para el mentor
  └── reserva ENROLLMENT para cada participante
```

Separarlas permite liberar reservas al cancelar o reprogramar sin borrar la sesión y conserva una
línea histórica auditable.

## 2. El intervalo se modela como semiabierto

La reserva usa `[startsAt, endsAt)`: incluye el inicio y excluye el final. Así dos sesiones
consecutivas son válidas:

```text
10:00 ───── 10:45
              10:45 ───── 11:30
```

En cambio, `10:30–11:00` se solapa con ambas. El constraint también exige `endsAt > startsAt`.

## 3. La base decide el conflicto

Hacer primero un `SELECT` y después un `INSERT` deja una carrera:

```text
request A: consulta → libre
request B: consulta → libre
request A: inserta
request B: inserta
```

Una exclusion constraint de PostgreSQL compara:

```text
resourceType igual
AND resourceId igual
AND rango temporal se solapa
AND releasedAt IS NULL
```

Solo una escritura puede ganar. La regla queda protegida incluso si otro worker o una futura
integración escribe sobre la misma tabla.

## 4. Por qué hay dos tipos de recurso

El mentor se reserva por `USER`, porque una persona mentora no puede facilitar dos sesiones
simultáneas. El participante se reserva por `ENROLLMENT`, porque su pertenencia y progreso están
acotados a una oleada.

El tipo forma parte de la identidad lógica. Un UUID nunca se interpreta sin saber primero qué clase
de recurso representa.

## 5. El read model depende de la identidad

La lista no consulta “todas las sesiones y luego oculta botones”. El filtro de acceso entra en la
consulta:

| Rol | Scope |
|---|---|
| `ADMIN` | sesiones de su organización |
| `MENTOR` | sesiones donde es el mentor |
| `PARTICIPANT` | sesiones donde participa su enrollment |

Si una persona tiene más de un rol, los scopes se unen. La organización sigue siendo el límite
exterior obligatorio.

## 6. Ocultar existencia también es autorización

Para un detalle ajeno se responde `404 RESOURCE_NOT_FOUND`, no `403`. Un `403` confirmaría que el ID
existe y podría filtrar actividad de otra organización. La misma política ya se aplica en los
módulos administrativos.

## 7. Campos contextuales y derivados

`confirmationSummary` se calcula desde participantes persistidos. `canConfirm` además depende de:

- que la sesión siga `SCHEDULED`;
- que la ventana no haya cerrado;
- que la identidad autenticada sea participante de esa sesión.

Por eso participante, mentor y admin pueden leer la misma sesión y recibir distinto `canConfirm`
sin que el estado global cambie.

## 8. Qué demuestra la integración

La prueba HTTP sobre PostgreSQL:

1. migra y siembra una sesión equivalente al fixture compartido;
2. consulta lista, calendario y detalle como participante;
3. consulta como mentor y admin con `canConfirm = false`;
4. oculta la sesión a otra organización;
5. rechaza rangos temporales inválidos;
6. rechaza lecturas sin autenticación;
7. intenta insertar una reserva superpuesta y recibe el error `23P01`.

## 9. Cómo explicarlo a un cliente

> La agenda impide dobles reservas en la propia base de datos y cada persona consulta únicamente las
> sesiones que le corresponden. Una cancelación libera el horario sin eliminar el historial.

## 10. Cómo explicarlo en entrevista

> Separé el agregado Session de sus reservas temporales y usé una exclusion constraint de
> PostgreSQL sobre rangos semiabiertos para cerrar carreras de doble reserva. Implementé read models
> con scoping multi-tenant y unión de roles, además de campos contextuales como `canConfirm`.
