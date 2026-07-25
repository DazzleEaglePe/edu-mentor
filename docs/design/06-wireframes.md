# 06 · Wireframes MVP

Kit navegable: [`wireframes/index.html`](./wireframes/index.html) — publicado en
`https://claude.ai/code/artifact/fad91626-d242-4479-8b91-88e976d3303e`

Estado: **sincronizado con el contrato cerrado** (2026-07-25). 27 planchas cubriendo el alcance MVP completo, sin ninguna CCR abierta.

---

## 1. Qué es y qué no es

Definen **estructura, jerarquía y comportamiento responsive**. El color y la tipografía viven en `02-design-tokens.md`.

Son **monocromos a propósito**: cuando un wireframe llega con la marca puesta, la revisión se vuelve una conversación sobre tonos de verde y nadie discute si la información está donde debe. Además obliga a algo que el MVP necesita igual — **el estado se codifica con glifo + texto, nunca solo con color** (WCAG 1.4.1).

| Glifo | Significado | Enums |
|---|---|---|
| ✓ | Avanzó | `CONFIRMED` · `ATTENDED` · `EVALUATED` · `APPROVED` · `CLEAN` |
| ○ | Esperando a alguien | `PENDING` (confirmación, solicitud, scan) · `SUBMITTED` |
| ◐ | En proceso | `UNDER_REVIEW` |
| ↩ | Volvió atrás | `RETURNED` |
| ✕ | No avanzó | `DECLINED` · `ABSENT` · `REJECTED` |
| ◇ | Sin empezar | `DRAFT` |
| ◍ | Analizando archivo | `scanStatus: PENDING` |
| ─ (punteado) | Cerrado o inactivo | `SCHEDULED` · `COMPLETED` · `CANCELLED` · `RESCHEDULED` |

## 2. Cobertura

| Rol | Planchas | Pantallas |
|---|---|---|
| Transversal | 4 | T1 login · T4 perfil · T5 estados · **T6 cambio obligatorio** |
| Participante | 7 | P1 · P2 · P3+P4+P5 · P6 · P7 · P8+P9 · P10+P11 |
| Mentor | 10 | M1 · M2+M3 · M4 · M5+M8+M9 · M6+M7 · M10 · M11 · M12+M13+M14+M16 · **M15 solicitudes** · M17 |
| Admin | 6 | A1+A2 · A3 · A4 · A5 · **A6+A7+A8 setup** · A10+A11 *(diferida a Fase 4)* |

**Sin plancha propia** porque se resuelven dentro de otra: P12 recorrido (dentro de P1), P13 y M18 descargas (dentro de P10 y M13), T7 cerrar todas las sesiones (dentro de T4), A9 conflictos (**eliminada**, CCR-006).

## 3. Comportamiento responsive

Un solo marcado que refluye por `container-query`, no dos dibujos separados. El conmutador Escritorio / Móvil 390 del kit cambia el ancho del contenedor.

| Breakpoint | Comportamiento |
|---|---|
| `< 640` | Una columna · nav lateral → barra inferior · tablas → tarjetas · acción primaria fija abajo · calendario a 2 días |
| `640–1023` | Dos columnas · sidebar en íconos |
| `1024–1279` | Sidebar completa, sin columna de contexto |
| `≥ 1280` | Tres zonas: navegación · contenido · contexto |

**Qué es móvil y qué no:**

| Journey | Móvil | Motivo |
|---|---|---|
| Cambiar contraseña inicial (T6) | **Primario** | La mayoría entra por primera vez desde el celular |
| Confirmar o declinar asistencia | **Primario** | ~12 veces por participante |
| Ver sesiones y entregables | Primario | Consulta rápida |
| Decidir solicitudes de reprogramación | Soportado | Corto y urgente; el mentor puede estar fuera |
| Registrar asistencia | Soportado | Se hace al terminar la sesión |
| Subir y enviar entregable | Soportado | Selector de archivos del sistema |
| Agendar / reprogramar | Consulta | Formulario largo con detección de conflictos |
| Evaluar revisión | **Escritorio** | Exige ver el documento y escribir a la vez |
| Configurar la oleada | Escritorio | Tarea de setup |

El contenido ancho scrollea dentro de su contenedor. **La página nunca scrollea horizontalmente.**

## 4. Decisiones de diseño

1. **Declinar y solicitar reprogramación son cosas distintas**, y la pantalla lo dice. Declinar = "no voy, la sesión sigue". Solicitar = "pido otra fecha para todos". La segunda es más pesada, así que va como enlace, no como botón.
2. **Ningún chip agregado de confirmación.** Una sesión grupal es "Programada" con "5 de 8 confirmaron" al lado. Inventar un estado "Parcial" contradiría DEC-007.
3. **"Tomar y evaluar", no "Evaluar".** El contrato exige `start-review` explícito; el botón dice lo que realmente hace.
4. **Enviar espera al scan**, y el botón deshabilitado siempre dice qué falta. Un botón gris sin explicación es el peor patrón posible.
5. **Reenviar crea una revisión nueva**, con la anterior visible en solo lectura al lado.
6. **El Top 3 se muestra con la etiqueta "Regla provisional"** porque Producto no la ratificó. Diseñarlo como aprobado sería fingir una decisión que nadie tomó.
7. **Lista antes que calendario** para el participante (~12 sesiones en todo el programa); calendario para el mentor, que sí tiene densidad.
8. **Una sola acción primaria por pantalla.**
9. **El copy del envío es parte del diseño:** "si te pide ajustes, podrás reenviar sin perder lo anterior" es lo que elimina el miedo a enviar.
10. **Las acciones destructivas cuantifican su consecuencia** y ofrecen la alternativa menos destructiva.
11. **Setup de oleada en 4 pasos guiados**, no un formulario gigante.
12. **Sin datos de contacto en listados.**
13. **Sin creación masiva de sesiones** en el piloto: multiplicaría conflictos y riesgo transaccional.

## 5. Qué cambió en la reconciliación con el contrato

| Cambio | Origen |
|---|---|
| `CONFIRMED` sale de todos los chips de sesión | DEC-007 |
| `DECLINED` entra como acción del participante ("No podré asistir") | DEC-007 |
| `attendanceStatus` pierde `CONFIRMED`: solo `PENDING/ATTENDED/ABSENT` | DEC-007 |
| Rutas de entregables apuntan a `submissionId` | DEC-010/011 |
| P11 "crear revisión nueva" reemplaza a "editar y reenviar" | `12-domain-state-machines` §4 |
| M12 "tomar revisión" se vuelve un paso visible | Ídem |
| M9 "completar sesión" aparece como acción | Ídem §1 |
| M15 solicitudes de reprogramación: pantalla nueva | CCR-001 |
| T6 cambio de contraseña obligatorio: pantalla nueva | CCR-007 |
| T2 recuperar contraseña: **eliminada** | CCR-007 |
| A7 panel de conflictos: **eliminado** | CCR-006 |
| Dashboards pasan a 3 endpoints server-side | CCR-004 |
| Rúbrica configurable por consigna | CCR-005 |
| `scanStatus` por archivo bloquea el envío | DEC-021 |
| `timezone` explícito al agendar | Contrato |
| `expectedVersion` → `409` de versión en todo formulario | DEC-028 |
| `Idempotency-Key` protege del doble clic | DEC-014 |
| Paginación por `hasNextPage` | Contrato |
| El `409` de traslape tiene dos redacciones según `canViewConflictingSession` | CCR-010 |
| Se eliminó toda promesa de "siguiente horario libre" | CCR-010 |
| Confirmar y declinar se deshabilitan con motivo cuando `canConfirm: false` | CCR-011 |
| Setup de oleada completo: oleadas, enrollments y asignaciones | CCR-012 |
| Asignación de mentor por participante **o** por oleada completa | `enrollmentId` nullable |
| Reasignar cierra la asignación anterior en vez de borrarla | `MentorAssignment.status` |
| La proporción de confirmaciones sale de `confirmationSummary` | Contrato |

## 6. Qué cambió respecto de los mockups v1

| Se quitó | Motivo |
|---|---|
| Postulaciones, Matching, Fases y graduación, Apoyo emocional, Reportes (nav admin) | DEC-015 · `RECHAZADA_MVP` |
| Checkpoints Fase 2 y Mensajes (nav mentor) | Ídem |
| "Satisfacción 4.8/5 sobre 32 respuestas" | No existe encuesta en el modelo |
| "▲20% vs semana pasada", "36h mentoradas" | No existe serie histórica |
| Estrellas 4.8/5 | El contrato define `score` 0–100 |
| Estado "Pendiente" en entregables | No existe en el enum |
| Tipo "Taller", estado "Por programar" | No existen en el enum |
| "Solicitudes de sesión · Confirmar/Rechazar" | CCR-003 rechazada |
| Campana y feed de recordatorios | CCR-009 |
| "¿Olvidaste tu contraseña?" | CCR-007 |

| Se conservó | Motivo |
|---|---|
| Estructura de tres zonas | Funciona y escala |
| Tarjetas de sesión del participante | Buena densidad y jerarquía |
| Tabla de evaluación del mentor | Correcta para una cola de trabajo |
| Resumen por semana del admin | La métrica que sí se sostiene con datos reales |

## 7. Fixtures

Sin PII. Personas ficticias (Martín, Nancy G., María L., Daniel V., Ana T., Carlos R., Pedro G.), oleada "Tecnología e Innovación", 18 participantes, semana 4 de 6, agosto 2026, `America/Lima`. Ningún correo, teléfono ni documento en pantalla.

Codex publicó **7 fixtures sintéticos** en `docs/api/fixtures/` con la misma forma (oleada de tecnología, `FASE_1` semana 4, dominio `@example.test`). Son compatibles con lo que muestran los wireframes; el reemplazo uno a uno se hará al construir `apps/web`, donde los fixtures del contrato pasan a ser la fuente única.

## 8. Accesibilidad verificada en el kit

Estado con glifo + texto · foco visible en todos los controles · contenido ancho con scroll propio · tema claro y oscuro por tokens · `prefers-reduced-motion` · 44px en acciones primarias móviles · `tabular-nums` en columnas numéricas.

Pendiente de verificar con implementación real: orden de tabulación, foco atrapado en modales, anuncios `aria-live`, lector de pantalla y zoom al 200%.

## 9. Siguiente paso

El contrato está cerrado; el diseño ya no espera nada de Codex.

1. Revisión con Proyectos: journeys (`05`) + estas pantallas.
2. Decisiones de Producto que aún cambian pantallas: regla del Top 3, rúbricas reales, política de archivos.
3. Fase 1: convertir estas planchas en componentes reales de `apps/web` sobre los tipos generados del OpenAPI.
