# 14 · Traspaso del carril backend

Fecha: 2026-07-26
Motivo: el agente anterior (Codex) quedó sin cuota hasta el 1 de agosto. Este documento traspasa **el carril backend** a un agente nuevo.

**No eres un tercer carril.** Reemplazas a Codex. Claude Code sigue en diseño y `apps/web`, sin cambios.

---

## 0. Lo primero que debes entender

**El contexto de este proyecto no vive en ninguna sesión de agente: vive en el repositorio.** Fue una decisión deliberada desde el día 1 (`docs/09-claude-code-coordination.md`). Todo lo que necesitas está en git, en `docs/` y en el contrato OpenAPI. No hay memoria perdida que recuperar.

Lo que **sí** debes hacer es leer antes de escribir. Este proyecto tiene 12 decisiones de contrato negociadas, y cambiar una sin darte cuenta cuesta más que cualquier feature.

## 1. Orden de lectura obligatorio

Lee en este orden. No empieces a escribir código hasta terminarlo.

| # | Archivo | Por qué |
|---|---|---|
| 1 | `CLAUDE.md` | Qué es el producto. **No es una herramienta de CV**; es la columna digital de un programa de empleabilidad |
| 2 | `AGENTS.md` | Reglas técnicas duras: monolito modular, controllers sin lógica, ownership en service |
| 3 | `docs/00-project-charter.md` | Alcance del piloto y qué está explícitamente fuera |
| 4 | `docs/11-contract-decisions.md` | **Las 12 CCR y las decisiones DEC-001…028.** El documento más importante |
| 5 | `docs/12-domain-state-machines.md` | Transiciones válidas e invariantes. Cambiar un estado tiene un procedimiento (§7) |
| 6 | `docs/api/openapi.yaml` | El contrato ejecutable: 57 operaciones. **Es la fuente de verdad** |
| 7 | `docs/07-checklist-master.md` | Qué está hecho y qué falta |
| 8 | `docs/13-technology-version-matrix.md` | Versiones fijadas con spike. No "actualices a latest" |
| 9 | `docs/09-claude-code-coordination.md` | Zonas de archivos y protocolo de handoff |
| 10 | `docs/learning/01`–`12` | Doce lecciones técnicas del carril backend. Léelas: explican *por qué* está hecho así |

Después, los checkpoints de `docs/checkpoints/` en orden cronológico te dan la película completa.

## 2. Estado real del repositorio

### `main` está en el baseline

```
main → 1a0fa23 "chore: establish EDU-MENTOR baseline"
```

**Nada está integrado todavía.** Los 7 PR están en *draft* y apilados: cada uno se basa en el anterior.

| PR | Rama | Contenido | Carril |
|---|---|---|---|
| #1 | `agent/phase1-data-runtime` | Prisma, Postgres, Redis, envelope de errores | backend |
| #2 | `agent/phase1-web-scaffold` | Scaffold Next.js | frontend |
| #3 | `agent/phase1-auth` | Auth con sesiones, rotación, revocación | backend |
| #4 | `agent/phase1-core-access` | Acceso scopeado por organización | backend |
| #5 | `agent/phase1-admin-user-lifecycle` | Usuarios admin idempotentes | backend |
| #6 | `agent/phase1-admin-program-setup` | Oleadas, enrollments, mentor assignments | backend |
| #7 | `agent/phase2-agenda-sessions` | Agenda 1:1, grupal y asistencia | backend |

**Orden de merge acordado: #1 → #2 → #3 → … → #7.** Fusionar fuera de orden produce conflictos en `pnpm-lock.yaml` y en migraciones.

Ramas de Claude aún no en PR: `agent/phase1-web-screens`, `agent/phase1-web-deliverables`, `agent/phase1-web-mentor-agenda`.

### ⚠️ Hay trabajo sin commitear que debes rescatar

Codex quedó a mitad de **Agenda 2C** (reprogramar, cancelar, completar, solicitudes de reprogramación). Cinco archivos quedaron sin commitear en el worktree `1. EduMentor-codex-backend`, rama `agent/phase2-agenda-lifecycle`:

```
 M apps/api/src/modules/sessions/session-mutation.ts
 M apps/api/src/modules/sessions/session-mutations.repository.ts
 M apps/api/src/modules/sessions/sessions.service.ts
?? apps/api/src/modules/sessions/dto/cancel-session.dto.ts
?? apps/api/src/modules/sessions/dto/complete-session.dto.ts
```

**Respaldo por si el worktree se pierde:**

```
Desktop/Software Engineer Projects/_respaldo-codex/agenda-2c-modificados.patch
Desktop/Software Engineer Projects/_respaldo-codex/agenda-2c-nuevos.tar.gz
```

Si el worktree sigue intacto, trabaja directamente ahí y **no apliques el patch**: sería duplicar. El respaldo es solo un seguro.

### Estructura de directorios

`1. EduMentor-codex-backend` es un **git worktree** del repo principal (`1. EduMentor`), no un clon. Comparten historia y remoto. Puedes trabajar en cualquiera de los dos, pero **no en la misma rama a la vez**: git lo impide.

## 3. Tu zona y la de Claude

Del protocolo (`docs/09-claude-code-coordination.md`):

| Zona | Dueño |
|---|---|
| `apps/api/**`, Prisma, migraciones | **Tuya** |
| `docs/api/openapi.yaml`, `docs/api/fixtures/**` | **Tuya** |
| `docs/00`, `05`–`08`, `11`–`13`, `docs/learning/**`, `docs/checkpoints/**` | **Tuya** |
| `apps/web/**`, `docs/design/**` | **De Claude — no la toques** |
| `packages/shared-types/**`, `eslint.config.mjs`, `package.json` raíz, `pnpm-workspace.yaml` | **Compartida — avisa antes de cambiar** |

Si necesitas que la UI cambie, **no edites `apps/web`**: escribe lo que necesitas en un checkpoint y Claude lo aplica. Al revés funciona igual: cuando Claude necesita un endpoint, abre una CCR y tú respondes.

## 4. Reglas que no se negocian

Estas costaron discusiones. Romperlas es regresión, no criterio.

1. **El contrato manda.** Si el diseño necesita algo que no está en OpenAPI, se abre una CCR; no se implementa en silencio. Ya hay 12 procesadas — el formato está en `docs/09` §"Solicitud de cambio de contrato".
2. **Ownership se valida en el service, siempre.** Nunca confíes solo en el rol. La suite negativa cross-user y cross-organization no es opcional.
3. **`404` para lo ajeno, no `403`.** El contrato oculta la existencia de recursos que no te pertenecen. La UI ya redacta "no está disponible" en vez de "no existe" precisamente por esto.
4. **`expectedVersion` en toda mutación**, `Idempotency-Key` en toda creación. Ya está en el contrato; respétalo.
5. **`error.code` estable y sanitizado.** La UI redacta el texto desde `code`; nunca muestra `message`. Cambiar un `code` rompe el frontend en silencio.
6. **`SCHEDULE_CONFLICT` no filtra datos ajenos.** `canViewConflictingSession: false` significa que `conflictingSessionId` viene en `null`. No lo "mejores" enviándolo igual.
7. **Confirmación y asistencia son ejes separados** (DEC-007). `CONFIRMED` no implica `ATTENDED`; `DECLINED` no implica `ABSENT`. `session.status` **no** tiene `CONFIRMED`.
8. **Fase y periodo son excluyentes** (DEC-009): `FASE_1` → `weekNumber` (1–6); `FASE_2` → `checkpointMonth` (**1, 2, 3 y 6**, no consecutivos). El `CHECK` en DB es obligatorio: la UI no valida el dominio.
9. **Nada fuera de alcance.** Job Tracking, mentor par, Demo Day, certificados, IA de CV y citas psicológicas **no se implementan** (DEC-015), aunque el modelo los contemple.
10. **Sin secretos ni PII real en el repo.** Los fixtures usan `@example.test`.

## 5. Cómo se trabaja aquí

```bash
pnpm install
pnpm check      # format + lint + contratos + typecheck + test + build
```

`pnpm check` es el gate. Verde o no se entrega.

**Ciclo de cada slice:**

1. Rama propia: `agent/<fase>-<tema>`, apilada sobre la anterior.
2. Vertical slice completo: contrato → modelo → service → controller → pruebas.
3. Pruebas unitarias **y** de integración contra PostgreSQL real. Las de concurrencia importan: hay invariantes que solo fallan con dos transacciones simultáneas.
4. `pnpm check` en verde.
5. Checkpoint en `docs/checkpoints/AAAA-MM-DD-<tema>.md` con evidencia reproducible (mira cualquiera de los 15 existentes: incluyen conteos exactos, no adjetivos).
6. Lección en `docs/learning/` si aprendiste algo transferible.
7. Actualizar `docs/07-checklist-master.md`.
8. PR draft apilada.

**Sobre la evidencia:** en este proyecto se reportan números exactos. "Las pruebas pasan" no vale; vale `tests=61_passed`. Y si algo no se pudo verificar, se dice — hay precedente de ambos lados (Codex no tenía Docker al principio; Claude no tiene Node y lo declara en cada handoff).

## 6. Tu primera tarea

**Terminar Agenda 2C**, que quedó a medias:

1. Completar sesión (`POST /sessions/{id}/complete`).
2. Cancelar y liberar reservas (`POST /sessions/{id}/cancel`).
3. Reprogramar conservando original y reemplazo (`POST /sessions/{id}/reschedule`, encadenado por `rescheduledFromId`).
4. Solicitudes de reprogramación: crear, aprobar, rechazar, cancelar.
5. Aprobación con auditoría, outbox y control de concurrencia.

Invariantes críticas de `docs/12-domain-state-machines.md` §3:

- mientras la solicitud está `PENDING`, **la sesión sigue `SCHEDULED`**;
- solo una solicitud `PENDING` por participante y sesión;
- aprobar exige `expectedSessionVersion` **y** `expectedRequestVersion`;
- un traslape al aprobar devuelve `409` y **deja la solicitud pendiente**: no hay aprobación parcial.

Todo eso ya está en el contrato. La UI de Claude lo asume, así que si lo implementas distinto, se rompe.

**Cuando publiques 2C, Claude puede construir M6, M7, M9 y M15** (la pantalla de decidir solicitudes, que nació de CCR-001 y es la última del contrato sin implementar).

## 7. Limitaciones conocidas del entorno

- **Claude no tiene Node ni navegador.** Escribe pruebas pero no las ejecuta, y no puede tomar capturas. Si tú tienes Node, validar su rama es un favor barato que desbloquea mucho.
- **La revisión visual sigue pendiente.** Doce pantallas construidas, ninguna revisada en 390 px y 1280 px por una persona. Codex alcanzó a encontrar dos fallos reales antes de quedarse sin cuota:
  - las páginas admin renderizan identidad y navegación de **Participante** (ya existe `auth-me.admin.json` para arreglarlo);
  - **`/admin/usuarios` provoca scroll horizontal de toda la página en 390 px**; la tabla de `/admin/asignaciones` sí contiene bien su overflow.

  Ambos son del carril de Claude y ya están en su cola.

## 8. Qué está pendiente de Producto, no de código

No los implementes "con un valor razonable": están esperando decisión de EDU-US.

- Regla del **Top 3** (CCR-008 · `provisionalRule: true` en el contrato).
- **Rúbricas reales** por consigna.
- **Tipos, tamaño y retención de archivos** — la UI muestra un placeholder heredado.
- **Canal de notificación** (DEC-020): bloquea plantillas y recuperación de contraseña.
- **Alcance de la landing pública**.

---

## Resumen en una línea

Lee `11-contract-decisions.md` y `openapi.yaml`, rescata el trabajo sin commitear de `agent/phase2-agenda-lifecycle`, termina Agenda 2C respetando las invariantes de `12-domain-state-machines.md` §3, y entrega con `pnpm check` verde y un checkpoint con números exactos.
