# 07 · Inventario de componentes

Derivado de los wireframes de `06-wireframes.md` y reconciliado con `docs/api/openapi.yaml`. Es el catálogo mínimo que cubre el MVP: si algo no está aquí, ninguna pantalla del piloto lo necesita.

Estado: **propuesta**. `apps/web` no existe todavía; el gate de Fase 1 está cerrado.

Convención: los componentes consumen **solo tokens semánticos** (`--edu-action-*`, `--edu-status-*`, `--edu-text-*`). Ningún componente escribe un hex.

---

## 1. Primitivos (12)

| Componente | Variantes | Notas |
|---|---|---|
| `Button` | primary · secondary · ghost · danger · link | Estados: default, hover, active, loading, disabled. 44px en móvil. El texto cambia al cargar ("Confirmando…"). **Un `disabled` siempre va acompañado del motivo** |
| `StatusChip` | confirmed · pending · review · returned · declined · neutral · inactive | **Siempre glifo + texto.** Recibe el enum crudo, nunca un color |
| `Tag` | neutral · outline | Metadatos no accionables: tipo de sesión, semana, rol, revisión |
| `Input` | text · email · password · number · url | `aria-invalid` + error por `aria-describedby`. El de contraseña permite ver y pegar |
| `Textarea` | — | Contador cuando hay `maxLength` (feedback: 4000; motivo: 1000) |
| `Select` | — | Nativo en móvil |
| `DateTimePicker` | date · time · datetime · timezone | `timezone` es campo propio: el contrato lo exige |
| `Checkbox` / `Radio` | — | |
| `Avatar` | sm · md · iniciales | Sin foto por defecto |
| `Card` | default · quiet · emphasis | `emphasis` = borde izquierdo de 3px para lo que requiere acción |
| `Divider` | — | |
| `ProgressBar` | determinate · indeterminate | Subida de archivos y progreso de fase |

## 2. Composición y layout (7)

| Componente | Uso |
|---|---|
| `AppShell` | Sidebar + topbar + contenido + contexto opcional. Refluye a barra inferior en móvil |
| `RoleNav` | Navegación por rol desde **una única lista blanca**; nada `FUTURE` puede entrar por accidente. Lee `roles[]`, que es un array |
| `TopBar` | Saludo, contexto de oleada/fase/semana (`activeEnrollment`), rol, avatar |
| `PageHeader` | Título, descripción, acciones, migas |
| `SectionHeader` | Título + acción secundaria |
| `SplitLayout` | Contenido + contexto (2 col → 1 col) |
| `DataTable` | Encabezado fijo, `overflow-x` propio, `tabular-nums`, → tarjetas en móvil. Paginación por `hasNextPage` |

## 3. Estado del sistema (8)

| Componente | Uso |
|---|---|
| `Skeleton` | Con la forma real del contenido. `aria-busy` en la región |
| `EmptyState` | Ícono, título, explicación, acción opcional. Cinco redacciones según el porqué |
| `ErrorState` | Mensaje, reintentar, código de soporte copiable |
| `ForbiddenState` | No revela existencia ni dueño del recurso |
| `InlineAlert` | info · warning · danger. Conflictos `409`, reglas `422`, avisos de consecuencia |
| `Toast` | Éxito y error. Nunca es la única evidencia |
| **`ConflictBanner`** | Los tres `409`: traslape, versión y estado. **Preserva lo que el usuario escribió**. En el traslape, ramifica por `canViewConflictingSession`: con `true` ofrece abrir la sesión, con `false` **no renderiza el enlace en absoluto**. Nunca sugiere un horario alternativo |
| **`ForcedPasswordGate`** | Bloquea el portal cuando `mustChangePassword`. Sin salida lateral |

## 4. Dominio — Agenda (8)

| Componente | Alimentado por | Notas |
|---|---|---|
| `SessionCard` | `GET /sessions` | Vista del participante. Muestra **su** `confirmationStatus` |
| `SessionListRow` | `GET /sessions` | Vista mentor/admin. `session.status` + `confirmationSummary` ("5 confirmaron · 1 no asistirá · 2 sin responder") |
| `ConfirmationControl` | `PUT …/participants/me/confirmation` | Confirmar / declinar, reversible. Envía `expectedVersion`. **Se deshabilita con el motivo visible cuando `canConfirm: false`**, y muestra `confirmationClosesAt` mientras está abierto |
| `AttendanceControl` | `PUT …/participants/{enrollmentId}/attendance` | Solo mentor/admin. Terminal. Muestra la confirmación como contexto, **nunca como valor por defecto** |
| `WeekCalendar` | `GET /sessions/calendar` | Estado por borde + texto. 2 días en móvil |
| `SessionForm` | `POST /sessions` | Campo condicional por fase: `FASE_1 → weekNumber`, `FASE_2 → checkpointMonth`. `timezone` obligatorio. Envía `Idempotency-Key` |
| `RescheduleDialog` | `POST /sessions/{id}/reschedule` | Antes → después, motivo obligatorio, consecuencia cuantificada |
| **`RescheduleRequestPanel`** | `GET /reschedule-requests` + approve/reject | Doble `expectedVersion`. Deja claro que la sesión **sigue programada** mientras se decide |

## 5. Dominio — Entregables (9)

| Componente | Alimentado por | Notas |
|---|---|---|
| `DeliverableCard` | `GET /deliverables` | Estado de la **revisión actual**, los 5 reales |
| `AssignmentBrief` | `GET /assignments/{id}` | Consigna, instrucciones, vencimiento con zona, **y la rúbrica antes de entregar** |
| `AssignmentForm` | `POST /assignments` · `PATCH /assignments/{id}` | Crear y editar. **Mentor y Admin**. Editable solo hasta la primera revisión enviada |
| `FileDropzone` | `POST …/submissions/{id}/files` | Formatos y límite espejo del backend. Progreso real |
| `FileList` | — | Muestra `scanStatus` por archivo. Quitar solo en `DRAFT` |
| `DraftNotesField` | `PATCH …/submissions/{submissionId}` | Notas para el mentor, editables mientras la revisión siga en `DRAFT` |
| **`ScanStatusChip`** | `file.scanStatus` | `PENDING/CLEAN/REJECTED/ERROR`. `CLEAN` no muestra chip: es lo normal |
| `SubmitPanel` | `POST …/submissions/{id}/submit` | Espera a que todos estén `CLEAN` **y dice qué falta**. Contiene el copy sobre inmutabilidad y reenvío |
| **`NewRevisionAction`** | `POST /deliverables/{id}/submissions` | "Crear revisión n+1", con la anterior en solo lectura al lado |
| `EvaluationForm` | `POST …/evaluation` · `…/return` | Feedback con placeholder guía, score 0–100, **rúbrica dinámica desde `assignment.rubric[]`** |
| **`TopCandidatesPanel`** | `PUT /assignments/{id}/top-candidates` | Puestos 1–3. **Muestra "regla provisional" mientras `provisionalRule: true`** |

## 6. Dominio — Administración (4)

| Componente | Alimentado por | Notas |
|---|---|---|
| **`OleadaSetupStepper`** | `/admin/oleadas` · `/admin/users` · `/admin/enrollments` · `/admin/mentor-assignments` | 4 pasos guiados. La ocupación sale de `activeEnrollmentCount`, sin pedir la lista |
| **`UserRolesEditor`** | `POST/PATCH /admin/users` | `roles[]` múltiple. Muestra `mustChangePassword` como "contraseña temporal" |
| **`EnrollmentTable`** | `/admin/enrollments` | `status`, `currentPhase`, `currentWeek`. Alta en `FASE_0` o `FASE_1` |
| **`MentorAssignmentTable`** | `GET/POST /admin/mentor-assignments` · `DELETE …/{id}?expectedVersion=` | Dos modos por `enrollmentId` nullable: por participante o por oleada completa. Cerrar es `DELETE` → `204`; la fila queda `CLOSED` con su periodo, sin acciones |

## 7. Utilidades transversales (4)

| Componente | Notas |
|---|---|
| `DateTime` | Formatea en la `timezone` de la sesión y la muestra. Tiempo relativo en colas |
| `ConfirmDialog` | Acciones destructivas. Cuantifica la consecuencia y ofrece la alternativa menos destructiva |
| `PhaseJourney` | Solo lectura desde `activeEnrollment` |
| `Metric` | Conteo del dashboard. **No acepta variaciones porcentuales**: no hay serie histórica |

---

## 8. Reglas de construcción

1. **Un solo traductor de enums.** `StatusChip` recibe `'RETURNED'`, no `{label, color}`. El mapeo vive en un lugar (`00-inventario-pantallas.md` §6) y así la UI no puede inventar un estado. Un enum desconocido debe fallar visible, no en silencio.
2. **Confirmación y asistencia nunca se derivan una de la otra.** Son componentes distintos porque son ejes distintos (DEC-007).
3. **Toda mutación lleva `expectedVersion` y sabe manejar el `409`** sin perder lo que el usuario escribió.
4. **Toda creación lleva `Idempotency-Key`.**
5. **Los componentes no deciden permisos.** Reciben qué acciones mostrar; la autorización la resuelve el backend.
6. **Ningún componente simula éxito.** Sin respuesta del backend, no hay cambio de estado en pantalla.
7. **Sin color como único portador de significado**, en ninguna variante.
8. **Cada componente entrega sus cuatro estados** cuando aplica.
9. **Nada de componentes para pantallas `FUTURE`.** No hay `JobFunnelChart` ni `PeerMentorCard`, aunque sea tentador dejarlos listos.

## 9. Total

**54 componentes** cubren el MVP. Doce nacieron de la reconciliación con el contrato, ninguno de un capricho de diseño:

`ConflictBanner` · `ForcedPasswordGate` · `RescheduleRequestPanel` · `ScanStatusChip` · `NewRevisionAction` · `TopCandidatesPanel` · `OleadaSetupStepper` · `UserRolesEditor` · `EnrollmentTable` · `MentorAssignmentTable` · `AssignmentForm` · `DraftNotesField`, más el desdoblamiento de confirmación y asistencia en dos controles independientes.

Si el número crece mucho durante la implementación, es señal de que se está construyendo algo fuera de alcance.
