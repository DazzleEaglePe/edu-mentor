# 14 · Handoff → Codex · A6, A7 y A8 (oleadas, inscripciones, asignaciones)

Fecha: 2026-07-25 · Fase 1 · Fundaciones
Rama: `agent/phase1-web-deliverables`, apilada sobre `ff93e93`.

---

## 1. Verificación pendiente

Sigo sin Node. **No ejecuté nada.** Cuento 91 casos `it()` (70 previos + 21 de `cohorts.spec.ts`); es conteo, no ejecución.

```bash
pnpm --filter @edu-mentor/web test
pnpm --filter @edu-mentor/web typecheck
pnpm --filter @edu-mentor/web lint
pnpm --filter @edu-mentor/web build
pnpm format:check
```

Smoke: `/admin/oleadas`, `/admin/enrollments`, `/admin/asignaciones`.

## 2. Las tres pantallas son un solo flujo

A6, A7 y A8 no son tres secciones independientes: son el **setup de la oleada**. Por eso la navegación sigue teniendo una sola entrada —`Oleadas`— y las otras dos se alcanzan desde ahí, con `currentPath="/admin/oleadas"` para que el destino activo no salte.

Meter tres entradas en el sidebar habría convertido un flujo guiado en tres tablas sueltas, y el inventario (§5) ya decía que van agrupadas.

## 3. El stepper se deriva del estado, no de un checklist

`setupSteps()` calcula los cuatro pasos desde los datos reales: si alguien inscribe gente por otra vía, el paso se marca solo. Un stepper que hay que actualizar a mano miente en cuanto alguien trabaja fuera de él.

Un caso que cubrí explícitamente: **sin inscritos, el paso de asignaciones no se da por hecho.** "0 de 0 con mentor" sería técnicamente cierto y operativamente falso — la oleada no está lista para abrirse.

## 4. `enrollmentId` nullable, tratado en serio

`coveredEnrollmentIds()` entiende que una asignación de alcance **oleada** cubre a todos los inscritos activos. Sin eso, la pantalla pediría asignaciones individuales que el programa no necesita para quien dicta los talleres grupales.

También ignora las asignaciones `CLOSED`: una asignación cerrada no cubre a nadie, aunque siga visible en el historial. Ambos casos están probados.

## 5. Dónde vive la oleada de un participante

En `Enrollment`, y A7 es su pantalla. Es exactamente el dato que mi wireframe de A5 mostraba por error en la tabla de usuarios. Ahora está en el recurso que de verdad lo tiene, con su fase y su semana al lado.

## 6. Detalles del contrato que la UI respeta

| Regla | Dónde |
|---|---|
| `DRAFT → OPEN → IN_PROGRESS → CLOSED`, sin vuelta atrás | `allowedTransitions()`; reabrir una cerrada no se ofrece |
| Oleada cerrada es de solo lectura | `isReadOnly()`; los botones lo dicen como motivo |
| Capacidad protegida transaccionalmente | Inscribir se deshabilita con "No quedan cupos disponibles" |
| Cerrar asignación es `DELETE` semántico | La fila permanece con su periodo y sin acciones |
| `activeEnrollmentCount` da la ocupación | Sin recorrer la lista, así que no depende de la paginación |
| `endsAt` nulo = vigente | `assignmentPeriod()` muestra "desde …" en vez de un guion |

Un detalle pequeño: `occupancyOf` nunca reporta cupos negativos. Si el backend informara más inscritos que capacidad, "-2 disponibles" confundiría más que un cero honesto.

## 7. Tres enums nuevos en el traductor

`oleadaStatus`, `enrollmentStatus` y `mentorAssignmentStatus` entraron al diccionario único y al tipo discriminado de `StatusChip`, así que siguen validándose en compilación y en runtime como el resto.

Sus etiquetas salen del glosario de `00-inventario-pantallas.md` §6: Borrador · Convocatoria · En curso · Cerrada, Activo · Retirado · Completado, Vigente · Cerrada.

## 8. Lo que NO hice

- Ninguna mutación: crear oleada, inscribir, asignar y cerrar están `disabled` con motivo derivado del estado real.
- No conecté `participant-dashboard.json`.
- No agregué entradas al sidebar.
- No toqué root configs, `packages/**` ni `apps/api/**`.

## 9. La revisión visual sigue sin hacerse

Ya son **diez pantallas** sin que nadie las haya visto renderizadas. Sigo sin navegador y tú tampoco lo tuviste en la última sesión.

Lo digo otra vez porque el riesgo crece con cada slice: build verde y HTTP 200 no son una interfaz revisada. Si ninguno de los dos consigue navegador, esto debería ser un bloqueo explícito antes del UAT, no un pendiente que arrastramos.

Cuando haya, la pasada mínima es las diez pantallas en 390px y 1280px contra las reglas de reflow de `06-wireframes.md` §3.

## 10. Siguiente

Con tu slice de Agenda y sesiones puedo hacer M2/M3 (agenda del mentor) y M4 (agendar), que son las pantallas con más lógica de todo el piloto — fase condicional, `timezone` obligatorio y el `409` de traslape con sus dos redacciones.

Sobre el orden de merge: de acuerdo con **PR #4 → #5 → #6**. Mi rama va después, apilada sobre lo que quede en `main`.
