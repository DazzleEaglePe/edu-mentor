# CLAUDE.md — Plataforma Digital EDU-MENTOR

> Este archivo da contexto persistente a Claude Code. Codex usa además `AGENTS.md`. Léelo al inicio de cada sesión.
> Proyecto: plataforma digital que opera el programa de mentoría EDU-MENTOR de la ONG EDU-US.
> Última actualización: jul-2026, tras propuesta consolidada v-final + alineación con Nancy (líder de proyecto asignada).

---

## Qué es este proyecto

**NO es una herramienta de revisión de CV.** Es la **columna digital que opera y visibiliza el programa EDU-MENTOR completo** — un programa intensivo de empleabilidad para jóvenes de 18-30 años.

La plataforma tiene **dos caras**:
- **Pública:** landing del programa + storytelling de la oleada en curso (captación).
- **Privada:** portal con roles (participante / mentor / admin) para operar las mentorías.

La IA de revisión de CV existe, pero es solo **un módulo de apoyo en la Semana 3** del programa, no el centro.

## Estructura del programa (dominio) — ACTUALIZADA

El programa es un **recorrido en dos grandes fases** + soporte transversal:

- **Fase 0 · Convocatoria y Selección** (2 sem): postulación → entrevista → scoring.
- **Fase 1 · "Hub de Empleabilidad" / Mentoría Intensiva** (6 sem): la fase fuerte. **Cada semana combina una sesión grupal temática + una mentoría 1:1 de seguimiento** con el mentor de empleabilidad (~2 sesiones/semana/participante). Semanas: S1 Autoconocimiento, S2 Objetivo profesional, S3 Alineación con mercado (IA de CV/LinkedIn aquí), S4 Realidad del sector (checkpoint: ajustar Plan 30 días), S5 Problemas reales con Design Thinking (checkpoint de mentor pre-Demo Day), S6 Demo Day.
- **Fase 2 · Acompañamiento en la Búsqueda de Empleo** (post-graduación, meses 1-6): **NO son sesiones semanales.** Un mentor joven (par/egresado) se empareja con el participante a largo plazo, con **checkpoints mensuales** (Mes 1 kickoff · Meses 1-3 seguimiento · Mes 3 corte mediano plazo · Mes 6 horizonte largo plazo). Se **trackea el funnel de búsqueda de empleo**: postulaciones realizadas, entrevistas obtenidas y hasta qué etapa del proceso llegó cada postulación. Comunicación menos frecuente pero acompañamiento continuo. Cadencia a validar con Proyectos y Relaciones Estratégicas.
- **Acompañamiento emocional (transversal a AMBAS fases):** psicólogos voluntarios, citas opt-in. *(El audio de Nancy corrige al PPT: aplica en Fase 1 Y Fase 2.)*

**La "graduación" importa:** el perfil del participante muestra su recorrido — "estás en Fase 1... te graduaste, pasas a Fase 2". El estado de fase es dato de primera clase (`current_phase` en enrollment).

**Oleadas sectoriales:** Negocios, Tecnología, Salud (+ futuras). Los **mentores evalúan** los entregables semana a semana y eligen top 3.

## Alcance ACTUAL (lo que estamos construyendo ahora)

Por decisión del equipo (jul-2026), se priorizan **2 módulos** del núcleo:

1. **Módulo Agenda y Sesiones** — planificación, invitaciones, confirmaciones, recordatorios y reprogramación de sesiones (grupales, 1:1 y checkpoints de Fase 2).
2. **Módulo Entregables** — carga de entregables por el participante, evaluación por el mentor, retroalimentación estructurada y evidencias.

**Fuera de alcance y sin schema/API implementable:** postulación/scoring, workflow, Demo Day, certificados y **Job Search Tracking de Fase 2**. Se retomarán con un gate y contrato posteriores.

**Enfoque:** piloto con la primera oleada (15-20 participantes, 1 sector). Validar la lógica y replicar/escalar después a intranet completa.

## Decisiones de arquitectura (ya tomadas)

- **Monorepo** (frontend + backend + shared types) con workspaces (pnpm).
- **Backend: monolito modular NestJS** — módulos aislados con fronteras claras, listos para extraerse a microservicio cuando escale. NO microservicios ahora.
- **Feature gates:** Agenda y Entregables pueden activarse por entorno. Los módulos futuros no se scaffoldean todavía.
- **Frontend: Next.js 16** (App Router); patches exactos en `docs/13-technology-version-matrix.md`.
- **DB: PostgreSQL** + **Prisma** como ORM (envuelto en repositories propios).
- **Deployment: VPS privado** con Docker Compose + Nginx + n8n self-hosted.
- **Patrón principal: Service-Repository** consistente; módulos comunicados por interfaces/eventos, nunca imports directos.
- **IA:** diferida hasta definir problema, dataset, evaluación, privacidad y revisión humana.

## Roles del sistema

| Rol | Puede |
|-----|-------|
| **Participante** | Ver sus sesiones, confirmar asistencia, subir entregables, ver feedback, ver su recorrido de fases |
| **Mentor** | Ver su agenda, crear/reprogramar sesiones, evaluar entregables, dar feedback, elegir top 3; en Fase 2: checkpoints y seguimiento de búsqueda |
| **Admin** | Gestionar usuarios/roles, configurar oleadas, supervisar todo, reportes, auditar |

## Gobernanza: 6 áreas de EDU-US (clientes internos)

| Área | Relación con la plataforma |
|------|---------------------------|
| **Proyectos** | Dueño del contenido semanal, calendario y cupos por oleada, coordinación del roadmap → cliente directo del módulo Agenda |
| **GTH** | Postulaciones, scoring, seguimiento de asistencia y encuestas |
| **Relaciones Estratégicas** | Mentores, psicólogos, empresas, jurados Demo Day |
| **Comunicaciones** | Convocatorias, testimonios, storytelling, certificados |
| **Innovación Digital** (nosotros) | Dueño técnico: plataforma, automatizaciones, datos |
| **Dirección/Liderazgo** | Nancy + líder de proyecto asignada → alineación constante |

## Convenciones de código

- **Idioma:** código y comentarios en inglés; términos de dominio (oleada, mentoria) permitidos si aportan claridad.
- **TypeScript** estricto en todo el stack.
- **Service-Repository:** lógica en services, datos en repositories. DTOs con class-validator.
- **Naming:** kebab-case archivos, PascalCase clases, camelCase variables.
- **Ownership SIEMPRE verificado en service** (un participante solo ve lo suyo), nunca confiar solo en el rol.

## Estructura de documentos

- `CLAUDE.md` (este archivo) — contexto maestro.
- `docs/01-arquitectura-tecnica.md` — stack, capas, patrones, deployment.
- `docs/02-modelo-datos.md` — ERD, tablas, relaciones (incluye entidades futuras de Fase 2).
- `docs/03-api-design.md` — endpoints REST, DTOs, auth.
- `docs/04-prompts-uxui.md` — prompts para mockups UX/UI.

## Branding

Paleta EDU-US: navy `#16243B`, teal `#2DB6A8`, amarillo `#F5A623`, coral `#E8461E`, off-white `#F4F1EA`.

## Qué NO hacer

- No construir microservicios todavía (monolito modular).
- No acoplar módulos entre sí directamente.
- No implementar los módulos fuera de alcance (Job Tracking, Demo Day, certificados) — solo dejar el modelo y los gates preparados.
- No hardcodear supuestos de Fase 1 en Agenda (ej: semana obligatoria) — las sesiones de Fase 2 usan checkpoints mensuales, no semanas.

## Coordinación con Codex

Antes de diseñar o implementar, leer:

- `docs/00-project-charter.md`;
- `docs/05-gap-analysis.md`;
- `docs/11-contract-decisions.md`;
- `docs/12-domain-state-machines.md`;
- `docs/13-technology-version-matrix.md`;
- `docs/07-checklist-master.md`;
- `docs/09-claude-code-coordination.md`.

Claude Code es owner primario de UX/UI y `apps/web`. No debe inventar endpoints, estados ni reglas de dominio. Las pantallas de Job Tracking, mentor par, IA, Demo Day y certificados son referencias futuras: no deben aparecer en la navegación MVP.

La matriz aprobada para scaffold está en `docs/13-technology-version-matrix.md`; prevalece sobre versiones históricas mencionadas arriba.
