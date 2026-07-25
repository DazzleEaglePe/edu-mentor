# 04 · Prompts UX/UI para GPT Image 2 — Plataforma EDU-MENTOR

> **Referencia histórica, no contrato.** Los estados, permisos y métricas de estos prompts pueden estar desactualizados. Para trabajo MVP usar `docs/design/00-inventario-pantallas.md`, `11-contract-decisions.md`, `12-domain-state-machines.md` y `03-api-design.md`. Por ejemplo, “Confirmada” describe la respuesta de un participante, no el estado global de una sesión.

Prompts listos para generar mockups de pantalla de los **2 módulos priorizados** (Agenda/Sesiones + Entregables), organizados **por rol** (Participante · Mentor · Admin).

Todos comparten el mismo design system para consistencia visual.

---

## Design System (pégalo al inicio de cada sesión de GPT)

> **Design system EDU-MENTOR.** Web app dashboard UI mockup, desktop 16:9, clean and modern SaaS style. Brand palette: navy `#16243B` (sidebar, headers), teal `#2DB6A8` (primary actions, active states), warm yellow `#F5A623` (accents, highlights), coral `#E8461E` (alerts, important CTAs), off-white `#F4F1EA` (page background), white cards. Rounded corners (8-12px), soft shadows, generous whitespace, sans-serif typography (Inter or similar). Left sidebar navigation with icons, top bar with user avatar and role badge. Accessible, professional, friendly — an education-employability NGO platform. High fidelity, realistic UI, no lorem-ipsus gibberish (use realistic Spanish labels). No brand logos of other companies.

**Tip de uso:** genera todas las pantallas en la misma conversación de GPT para mantener consistencia. Si una no cuadra, pide *"keep the same design system and layout, but [ajuste]"*.

---

# MÓDULO 1 — AGENDA Y SESIONES

## 1.1 · Participante — Mis sesiones

```
[design system]. Screen: "Mis Sesiones" for a PARTICIPANT in the EDU-MENTOR portal. Left sidebar with nav items: Inicio, Mis Sesiones (active), Entregables, Mi Perfil. Main area shows a weekly calendar/agenda view with upcoming mentoring sessions as cards: each card shows session title (e.g. "Mentoría 1:1 — Objetivo profesional"), date and time, mentor name with small avatar, session type badge (1:1 or Grupal), and status chip (Confirmada in teal, Pendiente in yellow). One highlighted upcoming session with a coral "Confirmar asistencia" button. Top bar shows participant name and "Participante" role badge. Clean, calm, easy to scan.
```

## 1.2 · Participante — Detalle de sesión + confirmar

```
[design system]. Screen: session detail modal/page for a PARTICIPANT. Shows: session title, full date and time, duration (45 min), mentor card with avatar and name, session type (1:1), a "Unirse a la reunión" teal button (meeting link), description text block, and attendance status. Primary coral button "Confirmar asistencia". Secondary ghost button "Solicitar reprogramación". Calm layout, single column, clear hierarchy.
```

## 1.3 · Mentor — Agenda del mentor

```
[design system]. Screen: "Mi Agenda" for a MENTOR in the EDU-MENTOR portal. Left sidebar: Inicio, Mi Agenda (active), Evaluaciones, Participantes. Main area: a weekly calendar grid (Mon-Fri columns, time rows) with scheduled mentoring sessions as colored blocks — teal for confirmed, yellow for pending confirmation, grey for completed. Right panel lists "Próximas sesiones" with participant names and quick actions. Top-right coral button "+ Agendar sesión". Top bar shows mentor name and "Mentor" role badge. Professional, information-dense but organized.
```

## 1.4 · Mentor — Agendar / crear sesión

```
[design system]. Screen: "Agendar sesión" form for a MENTOR. Modal or side panel form with fields: Título de la sesión (text), Tipo (toggle: 1:1 / Grupal), Semana del programa (dropdown S1-S6), Fecha y hora (date-time picker), Duración (dropdown, 45 min), Participantes (multi-select chips with participant names and avatars), Enlace de reunión (optional URL), Descripción (textarea). Bottom: teal "Guardar y notificar" primary button, ghost "Cancelar". Clean form layout, well-spaced fields, clear labels in Spanish.
```

## 1.5 · Mentor — Reprogramar sesión

```
[design system]. Screen: "Reprogramar sesión" for a MENTOR. Shows the original session info (greyed, struck-through date), a new date-time picker highlighted in teal, an optional "Motivo de reprogramación" textarea, and a note "Se notificará automáticamente a los participantes". Coral primary button "Confirmar reprogramación", ghost "Volver". Emphasis on the change from old to new date with an arrow between them.
```

## 1.6 · Admin — Supervisión de sesiones

```
[design system]. Screen: "Gestión de Sesiones" for an ADMIN. Left sidebar: Dashboard, Oleadas, Sesiones (active), Entregables, Usuarios, Reportes. Main area: a filterable data table of ALL sessions across the current oleada — columns: Sesión, Mentor, Tipo, Semana, Fecha, Participantes (count), Estado (color chips). Filters at top: Oleada (dropdown), Estado, Semana, rango de fechas. Summary stat cards above the table: Total sesiones, Confirmadas, Pendientes, Completadas. Top bar shows "Admin" role badge. Dense, powerful, control-panel feel.
```

---

# MÓDULO 2 — ENTREGABLES

## 2.1 · Participante — Mis entregables

```
[design system]. Screen: "Mis Entregables" for a PARTICIPANT. Left sidebar with Entregables active. Main area: list of assignment cards, each showing: assignment title (e.g. "Mi Mapa Profesional — Semana 1"), due date with a countdown chip (e.g. "Vence en 2 días" in yellow/coral), status chip (Borrador grey / Enviado teal / Evaluado green / Devuelto coral), and a primary action button that changes by state ("Subir entregable" / "Ver feedback"). One card expanded showing uploaded file chips. Encouraging, clear, deadline-aware layout.
```

## 2.2 · Participante — Subir entregable

```
[design system]. Screen: "Subir entregable" for a PARTICIPANT. Shows the assignment title and instructions at top in a light card, a large drag-and-drop file upload zone (dashed border, teal upload icon, "Arrastra tus archivos o haz clic para subir", accepted formats note: PDF, DOCX, PPTX, PNG, ZIP · máx 20MB), a list of already-uploaded files with names, sizes and remove icons, an optional "Notas para el mentor" textarea. Bottom: teal "Enviar entregable" primary button (with note "Podrás reenviar si el mentor lo devuelve"), ghost "Guardar borrador". Friendly, reassuring.
```

## 2.3 · Participante — Ver feedback recibido

```
[design system]. Screen: "Feedback de tu entregable" for a PARTICIPANT. Shows: assignment title, submitted files (as chips), an "Evaluado" green status, the mentor's evaluation card with mentor avatar/name, a score display (e.g. "85/100" in a teal circular badge, optional), a structured feedback text block, and if applicable a rubric breakdown (criteria with small bars). A subtle coral banner if it was returned for corrections ("Tu mentor pide ajustes"). Positive, growth-oriented tone.
```

## 2.4 · Mentor — Cola de evaluación

```
[design system]. Screen: "Entregables por evaluar" for a MENTOR. Left sidebar with Evaluaciones active. Main area: a queue/list of pending deliverables to review — each row shows participant name+avatar, assignment title, submitted date, week badge, file count, and a coral "Evaluar" button. Filter tabs at top: Pendientes (active), En revisión, Evaluados. A count badge showing "8 pendientes". Right side mini-stats: promedio de evaluación, entregas a tiempo. Efficient, actionable, review-focused.
```

## 2.5 · Mentor — Evaluar entregable

```
[design system]. Screen: "Evaluar entregable" for a MENTOR — a two-column layout. Left column: file preview area (document viewer with the participant's uploaded file, page thumbnails). Right column: evaluation form — participant name at top, a score input (0-100, optional), a structured "Retroalimentación" textarea (large), a rubric section with criteria rows (Innovación, Viabilidad, Análisis del problema) each with a small rating selector, a checkbox "Marcar como candidato Top 3" with a star icon, and at bottom two buttons: teal "Guardar evaluación" and coral "Devolver para corrección". Professional grading interface.
```

## 2.6 · Admin — Panel de entregables

```
[design system]. Screen: "Gestión de Entregables" for an ADMIN. Main area: a comprehensive data table of all deliverables in the oleada — columns: Participante, Consigna, Semana, Estado, Mentor evaluador, Score, Fecha entrega. Filters: Oleada, Semana, Estado, Mentor. Summary stat cards on top: Total entregas, Evaluadas, Pendientes, Tasa de entrega a tiempo, Candidatos Top 3. A small bar chart showing deliverables by status. Control-panel aesthetic, data-rich, with export button. "Admin" role badge in top bar.
```

---

# PANTALLAS NUEVAS — RECORRIDO DE FASES (actualización jul-2026)

## 3.1 · Participante — Mi recorrido (perfil con fases)

```
[design system]. Screen: "Mi Recorrido EDU-MENTOR" for a PARTICIPANT — the profile journey view. A horizontal stepper/timeline at top showing the program phases: "Fase 0 · Selección" (completed, teal check), "Fase 1 · Hub de Empleabilidad" (current, highlighted in yellow with progress "Semana 4 de 6"), "Fase 2 · Acompañamiento" (upcoming, greyed with lock icon). Below: current phase card with this week's focus, next session, pending deliverables. A celebratory hint of the upcoming graduation ("Al completar la Fase 1 te gradúas y pasas al acompañamiento en tu búsqueda de empleo"). Motivating, journey-focused, clear sense of progress.
```

## 3.2 · Participante — Graduación (transición Fase 1 → Fase 2)

```
[design system]. Screen: graduation/transition celebration for a PARTICIPANT. A congratulatory card: "¡Felicidades, te graduaste del Hub de Empleabilidad!" with a trophy/medal illustration in brand yellow and teal confetti accents. Below, a "Qué sigue: Fase 2 · Acompañamiento" section explaining: mentor par asignado (card with peer mentor avatar and name), checkpoints mensuales (small timeline: Mes 1 kickoff, Mes 3 corte, Mes 6 horizonte), and a teal button "Conocer a mi mentor par". Warm, celebratory but professional.
```

## 3.3 · Mentor par — Checkpoint de Fase 2

```
[design system]. Screen: "Checkpoint Mes 3" for a PEER MENTOR in Fase 2. Left: mentee profile summary card (name, oleada, graduation date). Center: job search funnel summary — stat chips: "12 postulaciones", "4 entrevistas", "1 proceso final", with a small funnel chart. A list of recent job applications with company, position and current stage chips (Postulado grey / Entrevista yellow / Final teal / Rechazado coral). Right: checkpoint notes textarea "Observaciones del checkpoint" and a teal button "Guardar checkpoint". Supportive follow-up interface, data-informed but human.
```

---

# PANTALLAS TRANSVERSALES (opcionales, refuerzan consistencia)

## T.1 · Login

```
[design system]. Login screen for EDU-MENTOR platform. Centered card on an off-white background with subtle navy/teal geometric shapes (puzzle-piece and route motifs from the brand). EDU-MENTOR wordmark at top, "Bienvenido de vuelta" heading, email and password fields, teal "Iniciar sesión" button, "¿Olvidaste tu contraseña?" link. Clean, welcoming, single card.
```

## T.2 · Dashboard por rol (landing tras login)

```
[design system]. Home dashboard after login, adaptable by role. Shows greeting "Hola, [nombre]", role badge, and a grid of summary cards relevant to the role: for a participant — próxima sesión, entregables pendientes, feedback nuevo; for a mentor — sesiones de hoy, entregas por evaluar, participantes asignados. Quick-action buttons. A friendly, motivating overview screen with the EDU-MENTOR brand accents.
```

---

## Notas de uso para GPT Image 2

1. **Consistencia:** genera todas las pantallas de un módulo en la misma sesión; el modelo recuerda el layout.
2. **Texto realista:** el prompt pide labels en español reales — si GPT los escribe mal, es normal en generación de imágenes; sirven como referencia visual, el texto final lo pones en Figma.
3. **Fidelidad:** estos son mockups de *dirección visual*, no specs pixel-perfect. Úsalos para alinear al equipo y como base en Figma.
4. **Estados:** para cada pantalla puedes pedir variantes — *"same screen but empty state / loading state / error state"*.
5. **Responsive:** si necesitas versión móvil, agrega *"mobile version, single column, 9:16"* al final del prompt.
6. **Flujo completo:** el orden de los prompts ya sigue el flujo natural de cada rol — útil para armar un prototipo navegable.
