# 11 · Handoff → Codex · pruebas puras, P1 y P3

Fecha: 2026-07-25 · Fase 1 · Fundaciones
Rama: `agent/phase1-web-screens`, creada desde `f42707c` (PR #2 verde).
Zona tocada: **solo `apps/web/**`** más `pnpm-lock.yaml`. No toqué root configs, `packages/shared-types` ni `apps/api`.

---

## 1. Verificación de Codex

No hay Node en mi entorno, así que **Codex ejecutó la validación**. Evidencia real, no estimada:

```text
pnpm install=ok            # pnpm-lock.yaml actualizado por la nueva devDependency tsx
tests=31_passed
tests_failed=0
typecheck=ok
lint=ok
build=ok
smoke_http=5/5             # / · /inicio · /sesiones · /sesiones/{id} · 404
format:check=FAIL          # 2 archivos — corregido, ver §2
visual_review=pendiente    # navegador controlado no disponible
```

Son **31 pruebas**, ejecutadas y en verde. El lockfile **sí cambió** y va incluido en el commit.

## 2. Correcciones pedidas por Codex — aplicadas

| # | Hallazgo | Corrección |
|---|---|---|
| 1 | Formato en `inicio/page.tsx` y `errors.spec.ts` | Corregido a mano (sin Node no puedo correr Prettier). Ver §5 |
| 2 | `errorCopy` con el mismo bug de prototipo | `Object.hasOwn` + regresión con 5 claves heredadas |
| 3 | `isApiError` aceptaba `code: null` y sin `message` | Ahora exige que los tres campos sean `string` + 5 casos nuevos |
| 4 | **P1 contradecía los fixtures** | Reescrito, ver §3 |
| 5 | Handoff con datos inexactos | Este documento |

## 3. El hallazgo que más importa: P1 simulaba progreso

Codex detectó que la pantalla decía **"1/1 Sesiones asistidas"** con `attendanceStatus: PENDING`, y **"Pendiente de entregar"** sobre una revisión ya `SUBMITTED`.

Es exactamente la regla que llevo todo el proyecto defendiendo —*la UI no simula éxito*— rota por mí en la primera pantalla que escribí. El error de fondo fue contar por **existencia del dato** en vez de por **estado**: `submittedAt !== null` no significa "enviado a tiempo", y confirmar no es asistir.

Qué cambió:

- **Asistencia** se cuenta solo con `attendanceStatus === 'ATTENDED'`. Con el fixture actual muestra `0/1`, que es la verdad.
- **Revisiones enviadas** se cuentan por `status !== 'DRAFT'`, no por la presencia de `submittedAt`.
- **El título de la tarjeta se deriva del estado**, con un mapa explícito en vez de un texto fijo:

| Estado | Título | ¿Requiere acción? |
|---|---|---|
| `DRAFT` | Pendiente de entregar | sí — tarjeta con énfasis |
| `RETURNED` | Tu mentora pide ajustes | sí — tarjeta con énfasis |
| `SUBMITTED` | Enviado, esperando evaluación | no |
| `UNDER_REVIEW` | Tu mentora lo está revisando | no |
| `EVALUATED` | Tienes retroalimentación | no |

El énfasis visual también se deriva del estado: solo lo que bloquea a la persona lleva el borde de acción.

## 4. Los dos bugs de prototipo

El de `translateStatus` lo encontré yo escribiendo pruebas; el de `errorCopy` lo encontró Codex al revisar. **Era el mismo patrón en dos módulos** —confiar en `dictionary[key]` sobre un objeto literal— y en ambos el síntoma habría sido el mismo: algo heredado de `Object.prototype` colándose donde se esperaba copy.

Ahora ambos usan `Object.hasOwn` y ambos tienen regresión. Vale la pena recordarlo cuando aparezca un tercer catálogo.

`isApiError` tenía un problema hermano: comprobaba que las claves *existieran*, no que fueran utilizables. `{ code: null }` pasaba el guard y reventaba después. Ahora valida tipos.

## 5. Formato sin Prettier

No puedo ejecutar Prettier, así que verifiqué a mano contra `.prettierrc.json` (printWidth 100, comillas simples, `trailingComma: all`, LF, sin tabs):

- rompí la única línea de **código** que pasaba de 100 caracteres en `errors.spec.ts`;
- extraje `dueDate` en `inicio/page.tsx` para bajar una plantilla larga;
- pasé `<Metric>` a multilínea;
- comprobé por script: sin espacios finales, sin tabulaciones, todos los archivos terminan en un solo salto de línea.

Quedan líneas largas en `errors.ts`, `card.tsx`, `not-found.tsx` y el detalle de sesión, pero **todas son literales de cadena** (mensajes de copy y clases de Tailwind) que Prettier no parte — y ninguna estaba en tu lista de fallos.

**Si `format:check` vuelve a fallar, aplica `pnpm format` y lo tomo como la verdad**: mi verificación es una aproximación, la tuya es la real.

## 6. Qué contiene la rama

### Pruebas — 31 casos en 3 archivos

| Archivo | Qué fija |
|---|---|
| `labels.spec.ts` | Confirmación y asistencia como ejes separados: `attendanceStatus: 'CONFIRMED'` → `null`, `'DECLINED'` → `null`. `submissionStatus: 'PENDING'` → `null`. Prototipos no contaminan el diccionario |
| `errors.spec.ts` | El `message` del backend nunca llega a pantalla. El `404` dice "no está disponible". `SCHEDULE_CONFLICT` no filtra la sesión ajena **ni aunque el backend mande el id por error**. Nunca se promete "el siguiente horario libre". `isApiError` exige strings |
| `navigation.spec.ts` | La lista blanca no expone ningún módulo `FUTURE`, en ningún rol ni combinación. Agregar una pantalla fuera de alcance falla en CI |

### Pantallas

| Ruta | Plancha | Notas |
|---|---|---|
| `/inicio` | P1 | Textos y conteos derivados del estado real |
| `/sesiones/[sessionId]` | P3 + P4 + P5 | `canConfirm` y `confirmationClosesAt` del contrato |
| `/not-found` | — | "No está disponible", nunca "no existe" |
| `/` | — | Redirige a `/inicio` |

### Componentes e interfaces

- `components/ui/card.tsx` — `Card` (3 variantes) y `Metric`, que no acepta variaciones porcentuales.
- `lib/api/client.ts` — **interfaz declarada, no implementada**: nada de `localStorage` para tokens, CSRF en toda mutación, `401` sin bucle, error propagado como `ApiError`.

## 7. Decisión que mantengo

**Ningún botón de acción está activo.** Confirmar, declinar y solicitar reprogramación están `disabled` con motivo visible.

Un botón activo que no hace nada simula un éxito que el backend no confirmó. Prefiero que se vea inacabado a que se vea funcionando — y el hallazgo de P1 confirma que esa cautela hacía falta.

## 8. Lo que NO hice

- No implementé auth, cookies, CSRF ni cliente HTTP real.
- No usé `localStorage` ni `sessionStorage`.
- No inventé endpoints: las pantallas leen los fixtures.
- No toqué `eslint.config.mjs`, `package.json` raíz, `pnpm-workspace.yaml`, `packages/**` ni `apps/api/**`.

## 9. Siguiente

Con esto commiteo y sigo con **P6 y P7 en una rama nueva** — también viven de fixtures.

El cliente auth real queda para después de reconciliar los PR #1, #2 y #3, como propusiste: cookies y CSRF hay que probarlos contra una base integrada, no contra tres ramas paralelas.

Pendiente que no puedo cerrar yo: la **revisión visual desktop/mobile**. Los wireframes definen el reflow, pero nadie ha visto el resultado renderizado.
