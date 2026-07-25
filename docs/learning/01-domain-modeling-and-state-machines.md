# L01 · Modelado de dominio y máquinas de estado

Objetivo: poder explicar y defender por qué EDU-MENTOR no es solo un conjunto de pantallas y tablas.

## 1. Conceptos

### Entidad

Objeto con identidad e historia propias. Dos sesiones con el mismo título siguen siendo sesiones diferentes porque tienen IDs, participantes y transiciones distintas.

### Value object

Valor definido por su contenido, no por una identidad. Un intervalo `startsAt/endsAt/timezone` o un score de rúbrica puede modelarse así en código.

### Agregado

Frontera dentro de la cual una operación mantiene invariantes en una sola transacción.

- `Session` agrega participantes, reservas y la decisión de reprogramar.
- `Deliverable` agrega sus submissions; cada submission congela archivos y recibe su evaluación.

No significa que todo viva en una sola tabla.

### Invariante

Regla que siempre debe ser cierta después de una operación:

- un mentor no tiene dos sesiones superpuestas;
- una revisión enviada no cambia;
- un score está entre 0 y 100;
- un participante no lee el entregable de otro.

### Máquina de estados

Conjunto finito de estados y transiciones permitidas. Evita booleanos contradictorios como:

```text
isSubmitted=true
isDraft=true
isEvaluated=true
```

Un solo estado de workflow expresa la situación vigente; el historial conserva cómo llegó allí.

## 2. Tres decisiones del proyecto

### Organización no es oleada

`organization` es la frontera de confianza. `oleada` es una cohorte operada dentro de ella. Si mañana existe otra organización, sus admins no deben acceder a EDU-US aunque coincida un nombre de oleada.

### Rol no es ownership

“Mentor” responde qué clase de acción puede hacer. `mentor_assignment` responde sobre qué oleada o participante puede hacerla.

```text
autenticado
  → tiene rol MENTOR
    → está asignado al alcance
      → el recurso pertenece a ese alcance
        → transición permitida
```

### Versionar no es incrementar un número

Si se cambia el mismo registro y solo se incrementa `version`, se pierde el contenido anterior. Una revisión real es otra fila: tiene archivos, timestamp, estado y evaluación propios.

## 3. El fallo de concurrencia que queremos evitar

Implementación ingenua:

```typescript
if (!(await repository.hasConflict(mentorId, interval))) {
  await repository.createSession(input);
}
```

Dos requests concurrentes pueden leer “sin conflicto” antes de que cualquiera inserte. Ambas crean la reserva.

La solución del proyecto:

1. abrir transacción;
2. insertar reservas de mentor y participantes;
3. dejar que el exclusion constraint serialice el conflicto;
4. convertir la violación conocida en `409 SCHEDULE_CONFLICT`;
5. confirmar sesión y outbox juntos.

El service da intención de negocio; la DB arbitra la carrera.

## 4. Laboratorio de Fase 1

Cuando exista el schema:

1. crear mentor y dos participantes ficticios;
2. disparar dos requests en paralelo con el mismo intervalo;
3. verificar que solo una sesión se confirma;
4. verificar que la otra devuelve `409`;
5. comprobar que no queda sesión, reserva ni outbox parcial;
6. repetir con un participante compartido y mentores diferentes.

Evidencia: test de integración, log por `traceId` y consulta final de reservas.

## 5. Cómo explicarlo

### A un cliente

> La agenda no solo avisa que hay un choque: impide que el mismo mentor o participante sea reservado dos veces, incluso si dos personas intentan agendar al mismo tiempo.

### En una entrevista

> Modelé la agenda como un agregado transaccional. La validación de disponibilidad en aplicación mejora el error, pero la garantía final usa un exclusion constraint sobre rangos en PostgreSQL, porque una estrategia check-then-insert tiene race conditions. La mutación y su outbox se confirman en la misma transacción.

### Como AI Engineer

Este criterio reaparece en sistemas con IA:

- rol vs. ownership se convierte en autorización de documentos para RAG;
- revisiones inmutables permiten reproducir qué prompt/modelo produjo una salida;
- outbox/idempotencia evita duplicar jobs costosos;
- máquinas de estado separan “generado”, “evaluado”, “aprobado por humano” y “publicado”.

La ingeniería de IA fiable se apoya en estas mismas garantías.

## 6. Autoevaluación

Debes poder responder sin leer:

1. ¿por qué una oleada no es un tenant?
2. ¿por qué RBAC no basta para proteger un entregable?
3. ¿qué historial se pierde con un campo `version` sin tabla de submissions?
4. ¿por qué validar conflictos en service no elimina carreras?
5. ¿qué diferencia existe entre confirmación y asistencia?

## 7. Evidencia de portafolio

Artefactos publicables, siempre sin datos reales:

- ERD reducido de los agregados;
- diagrama de estados;
- test concurrente de doble reserva;
- ADR sobre ownership;
- explicación del patrón outbox;
- demo con datos sintéticos.
