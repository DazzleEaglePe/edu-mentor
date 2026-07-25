# 01 · Auditoría de mockups v1

> **Documento histórico.** Se escribió el 2026-07-25 *antes* de que Codex publicara el contrato.
> Los hallazgos siguen siendo válidos, pero algunos estados que aquí se citan como "correctos" cambiaron después: `CONFIRMED` dejó de ser estado de sesión, la confirmación se separó de la asistencia y las rutas de entregables ahora apuntan a una revisión.
> El estado vigente está en `00-inventario-pantallas.md` §6. Este documento no se reescribe: sirve como registro de por qué el diseño cambió.

Archivos revisados: `design-platform/screen-1.png` … `screen-4.png` (1440×869).
Contraste evaluado con la fórmula WCAG 2.1; colores medidos sobre el PNG.

**Veredicto general:** la dirección visual es buena y consistente — jerarquía clara, densidad correcta por rol, buen uso de tarjetas y chips. Lo que **no** puede pasar a implementación tal cual es el *contenido*: hay funcionalidad fuera de alcance en la navegación, estados que no existen en el modelo y métricas sin fuente de datos. Se corrige en diseño, no en código.

Severidad: **B** bloqueante para implementar · **A** ajuste antes de aprobar · **N** nota.

---

## screen-1 · Participante — Inicio

| # | Hallazgo | Sev | Regla / referencia |
|---|---|---|---|
| 1.1 | Chips de entregable "Pendiente" y falta de "Devuelto"/"En evaluación" | B | Enum real: `DRAFT\|SUBMITTED\|UNDER_REVIEW\|EVALUATED\|RETURNED` |
| 1.2 | "Calificación 4.8 / 5" en estrellas | B | `evaluation.score` es 0–100. Una de las dos escalas debe morir → CCR-005 |
| 1.3 | "Solicitar cambio" bajo la sesión pendiente | B | No existe endpoint (DEC-013) → CCR-001 |
| 1.4 | Bloque "Apoyo emocional · Solicitar una cita" | B | Fuera de alcance del piloto (charter §5) |
| 1.5 | "Resumen de actividad": sesiones asistidas ▲20%, entregable enviado ▲100%, 4h30 de mentoría ▲15% | B | Ningún endpoint expone estas series ni comparativos → CCR-004. Además "▲100%" sobre n=1 no informa nada |
| 1.6 | "Próximos recordatorios" como feed del participante | A | `SESSION_REMINDER` es una cola de envío, no un feed de UI → CCR-009. Se resuelve mostrando las sesiones/entregables próximos, que sí existen |
| 1.7 | Chips "Confirmada/Pendiente" en la tarjeta de sesión | A | Correcto solo si representan **su** `attendance`, no `session.status`. Etiquetar "Tu asistencia:" para evitar la ambigüedad de DEC-007 |
| 1.8 | Botón "Confirmar asistencia" en naranja y "Ver detalles" en teal | A | La acción primaria del programa es confirmar; el resto debería ser secundario/ghost. Hoy compiten cuatro botones teal con uno naranja |
| 1.9 | Mascota "¿Necesitas ayuda?" ocupa ~20% del sidebar y ancla abajo | A | No está en el design system aprobado. Si se mantiene, va colapsable y con enlace real |
| 1.10 | Tarjeta "Mi Recorrido" (Fase 0/1/2, "Semana 4 de 6") | A | El dato existe (`current_phase`) pero el endpoint está listado como futuro → CCR-002 |
| 1.11 | Sin estado vacío: participante nuevo sin sesiones ni entregables | A | `03-estados-ux.md` |
| 1.12 | Fecha "Martes, 19 may 2026" sin zona horaria | N | Piloto en `America/Lima`; mostrar la zona cuando el usuario pueda estar fuera |

## screen-2 y screen-3 · Mentor — Inicio/Agenda

Las dos capturas son **la misma pantalla** con diferencias mínimas (el filtro dice "Todos los módulos" en screen-2 y "Todas las semanas" en screen-3, más ~2px de espaciado). Trato screen-3 como la versión válida: "semanas" es el eje del programa; "módulos" no existe en el dominio.

| # | Hallazgo | Sev | Regla / referencia |
|---|---|---|---|
| 2.1 | Sidebar incluye "Checkpoints (Fase 2)" y "Mensajes (Próximamente)" | B | DEC-015: ninguna pantalla futura se enlaza en la navegación del piloto. El badge "Próximamente" no lo salva |
| 2.2 | "Confirmaciones pendientes → Solicitud 1:1 de Daniel Vega · Rechazar / Confirmar" | B | El participante no puede solicitar sesiones en el contrato; solo confirma asistencia → CCR-003 |
| 2.3 | "Satisfacción promedio 4.8/5 basado en 32 respuestas" | B | No existe entidad de encuesta en el modelo → CCR-004 |
| 2.4 | "Candidatos Top 3: 2 de 3" | B | `is_top_candidate` es booleano sin cupo ni ranking (DEC-012) → CCR-008 |
| 2.5 | "Tu impacto: 36h20 mentoradas ▲18%, 24 sesiones ▲15%" | B | Sin fuente ni ventana de comparación definida → CCR-004 |
| 2.6 | Estado "Pendiente" en la tabla de entregables | B | Debe ser "Enviado" (`SUBMITTED`); "En evaluación" ya está correcto |
| 2.7 | Falta `RETURNED` en filtros y en la tabla | A | El ciclo devolver → reenviar es un slice completo (3C) |
| 2.8 | La agenda no ofrece reprogramar, cancelar ni marcar asistencia | B | Son capacidades MVP (M6, M7, M8). Hoy solo hay "+ Agendar sesión" implícito |
| 2.9 | Sin señal de conflicto/solapamiento en el calendario | A | DEC-008 es una regla central de Agenda |
| 2.10 | Correos reales visibles en la tabla (`maria.lopez@email.com`) | A | Fixtures sin PII; usar `@example.org` y evitar mostrar el correo en listados |
| 2.11 | Bloques del calendario sin estado visible (confirmada/pendiente) salvo por color | A | El color no puede ser el único portador de significado (WCAG 1.4.1) |
| 2.12 | Semana mostrada 17–23 ago pero el badge dice "Fase 1 · Semana 4" | N | Coherencia de fixtures entre pantallas |

## screen-4 · Admin / Coordinación

| # | Hallazgo | Sev | Regla / referencia |
|---|---|---|---|
| 4.1 | Sidebar con Postulaciones, Matching por oleada, Fases y graduación, Apoyo emocional, Reportes | B | Cinco entradas fuera de alcance (charter §5, DEC-015). Nav MVP: Dashboard · Sesiones · Entregables · Oleadas · Usuarios · Operación |
| 4.2 | Tipo de sesión "Taller" | B | Enum: `ONE_ON_ONE\|GROUP\|CHECKPOINT`. "Taller" es un título, no un tipo |
| 4.3 | Estado de sesión "Por programar" | B | No existe. Los estados son `SCHEDULED\|CONFIRMED\|COMPLETED\|CANCELLED\|RESCHEDULED` |
| 4.4 | "Calificación promedio 4.6/5" (estrellas otra vez) | B | CCR-005 |
| 4.5 | "2 conflictos de agenda con traslape de horario" | A | Excelente idea y alineada con DEC-008, pero necesita endpoint → CCR-006 |
| 4.6 | Badge de rol "Coordinación" | A | Los roles del sistema son Participante / Mentor / Admin. Si "Coordinación" es el nombre humano de Admin, documentarlo en el glosario; si es un cuarto rol, es DEC-002 |
| 4.7 | "Graduar participantes a Fase 2" en acciones rápidas | B | `POST /enrollments/:id/graduate` está marcado futuro |
| 4.8 | Tabla de sesiones sin acción de cancelar/reprogramar visible (solo íconos "···") | A | Las acciones destructivas necesitan etiqueta, no solo ícono |
| 4.9 | "Entregables esperados 18 · Entregados 15 (83%)" | N | Derivable de `GET /deliverables` + enrollments; se puede sostener sin endpoint nuevo. Es la métrica que sí conviene conservar |
| 4.10 | Sin estado de carga ni de tabla vacía en ninguna de las tres tablas | A | `03-estados-ux.md` |

---

## Hallazgos transversales de marca y accesibilidad

Colores medidos sobre los PNG vs. paleta declarada en `CLAUDE.md`:

| Elemento | En el mockup | Declarado | Consecuencia |
|---|---|---|---|
| Sidebar / topbar | ≈ `#031832` | navy `#16243B` | Es casi negro; pierde la identidad navy |
| Fondo de página | ≈ `#FDFDFD` | off-white `#F4F1EA` | Se pierde la calidez de marca y el contraste tarjeta/fondo |
| Teal de acción | ≈ `#039A98` – `#3DB0B1` | `#2DB6A8` | Tres teals distintos conviviendo |
| CTA principal | ≈ `#E97426` (naranja) | coral `#E8461E` | El naranja es un color nuevo, no de marca |
| Chips de éxito | ≈ `#3FA76D` (verde) | — | Verde no existe en la paleta |

**Contraste (bloqueante):**

| Combinación | Ratio | AA texto (4.5) |
|---|---|---|
| Blanco sobre teal `#2DB6A8` | 2.51 | ❌ |
| Blanco sobre amarillo `#F5A623` | 2.03 | ❌ |
| Blanco sobre coral `#E8461E` | 3.94 | ❌ (solo texto grande) |
| Navy `#16243B` sobre amarillo `#F5A623` | 7.68 | ✅ |
| Navy sobre off-white `#F4F1EA` | 13.79 | ✅ |

Todos los botones teal con texto blanco de los mockups fallan AA. `02-design-tokens.md` define las variantes accesibles (`teal-700 #0B6E66`, `coral-700 #B23414`) que resuelven esto sin cambiar la identidad.

**Otros:**

- Ninguna captura muestra estados loading / empty / error / forbidden (requisito de charter §4 y del contrato de diseño).
- No hay versión móvil ni tablet; el piloto se usará en celular para confirmar asistencia.
- Los chips diferencian por color casi exclusivamente; falta ícono o texto de apoyo (WCAG 1.4.1).
- Falta la pantalla de login, que es la primera del flujo.
- Foco de teclado no representado en ningún estado.

---

## Qué hago con esto

1. Las **B** se corrigen antes de cualquier wireframe navegable: quitar de la navegación lo `FUTURE`, alinear estados al enum, y esperar CCR para lo que necesita backend.
2. Las **A** entran en la siguiente iteración de diseño junto con tokens y estados.
3. Las **N** quedan como notas de fixtures.
4. Lo que **se conserva tal cual**: la estructura de tres zonas (nav / contenido / columna de contexto), la tabla de evaluación del mentor, las tarjetas de sesión del participante, el resumen por semana del admin y la alerta de conflictos. Es una base sólida.
