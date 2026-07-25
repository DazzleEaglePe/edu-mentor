# 12 · Handoff → Codex · P6 y P7 (entregables)

Fecha: 2026-07-25 · Fase 1 · Fundaciones
Rama: `agent/phase1-web-deliverables`, apilada sobre `fdde4f2` (`agent/phase1-web-screens`).
Zona tocada: **solo `apps/web/**`**. Sin cambios en el lockfile — no agregué dependencias.

---

## 1. ⚠️ Sin verificar de nuevo

Sigo sin Node. **No ejecuté nada.** Necesito la misma validación que la vez pasada:

```bash
pnpm --filter @edu-mentor/web test        # esperados: 31 previos + 19 nuevos = 50
pnpm --filter @edu-mentor/web typecheck
pnpm --filter @edu-mentor/web lint
pnpm --filter @edu-mentor/web build
pnpm format:check
```

Smoke útil: `/entregables` y `/entregables/55555555-5555-4555-8555-555555555555`.

## 2. Lo primero que hice fue borrar una duplicación mía

En el slice anterior dejé el mapa de "qué significa cada estado de revisión" **embebido en P1**. Al escribir P6 iba a necesitar exactamente el mismo texto, y ahí es donde nacen las contradicciones: dos pantallas que dicen cosas distintas del mismo dato.

Lo extraje a `lib/domain/deliverables.ts`. P1 y P6 ahora consumen la misma fuente, y el módulo está cubierto por pruebas.

## 3. Qué agregué

### `lib/domain/deliverables.ts` — 19 pruebas nuevas

| Función | Qué resuelve |
|---|---|
| `summarizeSubmission` | Título y `needsAction` por estado. `SUBMITTED` **no** es "pendiente de entregar" |
| `currentSubmission` | Busca la revisión vigente **por `currentSubmissionId`**, no la última del arreglo |
| `sortByRequiredAction` | Ordena por acción requerida: devuelto → borrador → enviado → en evaluación → evaluado. A igual urgencia, por vencimiento. No muta la entrada |
| `canSubmitRevision` | Devuelve **el motivo** del bloqueo, no un booleano |
| `formatFileSize` | Bytes → algo que una persona lee |

`canSubmitRevision` es el que más me importa: como devuelve `{ canSubmit: false, reason }`, quien lo llama **no puede deshabilitar el botón sin tener a mano qué decir**. Junto al tipo de `Button`, eso cierra el patrón por dos lados.

Cubre las cuatro razones reales de bloqueo del contrato: revisión ya enviada, sin archivos, archivos en `PENDING` de análisis, archivos `REJECTED`/`ERROR`. Con singular y plural, porque "Esperando el análisis de 1 archivos" es el tipo de detalle que hace ver amateur un producto.

### Pantallas

| Ruta | Plancha | Notas |
|---|---|---|
| `/entregables` | P6 | Ordenado por acción requerida; los 5 estados reales; énfasis visual solo en lo que bloquea |
| `/entregables/[deliverableId]` | P7 | Consigna, instrucciones y **la rúbrica antes de entregar** |

Dos decisiones que vale la pena mirar:

1. **La rúbrica se muestra antes de entregar**, no solo al recibir la nota. Sale de `assignment.rubric[]`, así que son los criterios reales de esa consigna — con su `maxScore` y su descripción — y no una lista escrita a mano.
2. **`scanStatus: CLEAN` no muestra chip.** Es lo normal y no merece ruido visual; solo `PENDING`, `REJECTED` y `ERROR` se anuncian.

También agregué en P1 el enlace al detalle del entregable, que faltaba.

## 4. Lo que NO hice

- No implementé subida de archivos ni envío: son mutaciones y esperan a auth.
- El botón de enviar está `disabled` con motivo derivado del estado real.
- No toqué root configs, `packages/**` ni `apps/api/**`.
- No agregué dependencias: el lockfile no cambia.

## 5. Sobre tu slice de dashboard

Cuando publiques `GET /dashboard/participant`, en P1 hay que reemplazar dos conteos que hoy derivo de los fixtures:

```ts
// apps/web/src/app/(portal)/inicio/page.tsx
const attendedSessions = …   // → dashboard.sessions.attended / .total
const submittedRevisions = … // → dashboard.deliverables.submitted / .expected
```

Son deliberadamente feos y locales para que sea trivial encontrarlos y borrarlos. El resto de P1 ya lee del dominio.

Y ojo con una diferencia de semántica: hoy muestro **"Revisiones enviadas"** (cuántas revisiones de este entregable salieron de `DRAFT`), mientras que el contrato expone **`deliverables.submitted / expected`** (cuántos entregables de la oleada se enviaron). No es lo mismo. Cuando llegue el endpoint, la etiqueta correcta es la del contrato — "Entregas enviadas" sobre el total esperado — y la mía desaparece.

## 6. Siguiente

Con el dashboard real puedo cerrar P1 de verdad. Mientras tanto quedan M11 y M12 (cola de evaluación y evaluar), que también viven de fixtures, aunque necesitarían un fixture de mentor que hoy no existe — dime si lo agregas tú o lo pido por CCR.

Sigue pendiente la **revisión visual desktop/mobile**: ya son seis pantallas sin que nadie las haya visto renderizadas.
