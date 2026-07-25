# 01 · Arquitectura Técnica — Plataforma EDU-MENTOR

Módulos en alcance: **Agenda y Sesiones** + **Entregables**.
Contexto: VPS privado · piloto 1 oleada (15-20 usuarios) · visión de escalar a intranet.

---

## 1. Principios de diseño

1. **Simplicidad primero, escalabilidad preparada.** Monolito modular hoy; fronteras claras para extraer microservicios mañana sin reescribir.
2. **Módulos aislados.** Cada módulo no conoce el interior de otro; se comunican por interfaces o eventos.
3. **Service-Repository consistente.** Lógica de negocio en services, acceso a datos en repositories.
4. **Feature gates.** Módulos activables por config para el enfoque de activación progresiva.
5. **Austeridad operativa.** Footprint mínimo en el VPS; escalar solo tras validar adopción.

---

## 2. Stack tecnológico

### Resumen

| Capa | Tecnología | Por qué |
|------|-----------|---------|
| Frontend | **Next.js 16** (App Router) + TypeScript 6 | SSR/SSG para landing pública, React para portal privado, un solo framework para ambas caras |
| UI | **Tailwind CSS** + shadcn/ui | Rápido, consistente, temeable con branding EDU-US |
| Backend | **NestJS** (monolito modular) + TypeScript | Modularidad nativa, DI, guards de auth, listo para extraer microservicios |
| ORM | **Prisma 7** + adapter PostgreSQL | Velocidad de desarrollo, migraciones explícitas y tipado end-to-end |
| DB | **PostgreSQL 16** | Relacional robusto, JSON cuando se necesita, maduro en VPS |
| Cache/colas | **Redis** + **BullMQ** | Recordatorios de sesiones, jobs de notificación, rate limiting |
| Storage | **Filesystem del VPS** (piloto) → S3-compatible (escala) | Entregables/archivos; empezar local, migrar a MinIO/S3 al escalar |
| Automatización | **n8n self-hosted** | Notificaciones, recordatorios, integraciones sin código |
| Auth | Cookies seguras + access JWT + refresh session persistida | Rotación/revocación sin exponer tokens a JavaScript |
| Reverse proxy | **Nginx** | SSL, routing, servir estáticos |
| Contenedores | **Docker + Docker Compose** | Reproducibilidad, deploy simple en VPS |
| Proceso Node | **Docker restart + healthchecks** | Un solo supervisor por proceso |

Las versiones exactas y el spike de compatibilidad viven en `13-technology-version-matrix.md`.

### Sobre el ORM: Prisma vs TypeORM

Recomiendo **Prisma** para el piloto:
- Schema declarativo → migraciones automáticas y legibles.
- Tipado generado end-to-end (menos bugs).
- Velocidad de desarrollo alta, ideal para validar rápido.

Cuándo preferirías TypeORM: si quisieras el patrón Repository nativo del ORM con herencia de entidades muy compleja, o control fino de SQL en cada query. Para nuestro dominio (agenda + entregables) Prisma sobra y va más rápido. Envolvemos Prisma en nuestros propios repositories, así que el patrón Service-Repository se mantiene independiente del ORM (y podríamos cambiarlo sin tocar los services).

---

## 3. Organización del monorepo

```
edu-mentor/
├── apps/
│   ├── web/                  # Next.js 16 (landing pública + portal privado)
│   │   ├── app/
│   │   │   ├── (public)/     # landing, info del programa
│   │   │   └── (portal)/     # portal autenticado por rol
│   │   └── ...
│   └── api/                  # NestJS monolito modular
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── users/
│       │   │   ├── agenda/       # ← MÓDULO PRIORITARIO 1
│       │   │   ├── deliverables/ # ← MÓDULO PRIORITARIO 2 (entregables)
│       │   │   ├── oleadas/      # soporte mínimo (contexto de sesiones/entregables)
│       │   │   └── notifications/
│       │   ├── common/          # guards, decorators, filters, pipes
│       │   ├── config/          # feature gates, env
│       │   └── main.ts
│       └── prisma/
│           └── schema.prisma
├── packages/
│   ├── shared-types/         # tipos/DTOs compartidos front↔back
│   └── config/               # eslint, tsconfig base
├── docker-compose.yml
├── docker-compose.prod.yml
└── package.json              # workspaces
```

**Workspaces:** pnpm workspaces con lockfile estricto.

---

## 4. Arquitectura del backend (monolito modular)

### Anatomía de un módulo

Cada módulo sigue la misma estructura (ejemplo: `agenda`):

```
modules/agenda/
├── agenda.module.ts          # feature gate aquí
├── agenda.controller.ts      # endpoints REST
├── agenda.service.ts         # lógica de negocio
├── agenda.repository.ts      # acceso a datos (envuelve Prisma)
├── dto/
│   ├── create-session.dto.ts
│   ├── reschedule-session.dto.ts
│   └── ...
├── entities/                 # tipos de dominio
└── events/                   # eventos que emite (ej: SessionScheduledEvent)
```

### Reglas de aislamiento (clave para escalar después)

- Un módulo **nunca** importa el repository o service interno de otro módulo.
- Si Agenda necesita saber de un usuario, lo hace por una **interfaz pública** (`UsersFacade`) o por **eventos**, no accediendo a las tablas de users directamente.
- Los eventos durables se escriben en un **transactional outbox** junto con el cambio de dominio. BullMQ los procesa/reintenta y n8n queda en la periferia de integraciones.

Esto significa: el día que Agenda deba ser su propio servicio, ya está desacoplado.

### Feature gates

```typescript
// config/features.ts
export const FEATURES = {
  agenda: process.env.FEATURE_AGENDA === 'true',
  deliverables: process.env.FEATURE_DELIVERABLES === 'true',
} as const;
```

**Nota Fase 2:** Agenda soporta checkpoints mediante `SESSION.phase` + `type CHECKPOINT`. Job Search Tracking no tiene módulo, tabla ni ruta en el piloto; se diseñará post-piloto si su gate es aprobado.

Cada módulo se registra condicionalmente en `AppModule`:

```typescript
const featureModules = [
  FEATURES.agenda && AgendaModule,
  FEATURES.deliverables && DeliverablesModule,
].filter(Boolean);

@Module({ imports: [/* core */, ...featureModules] })
export class AppModule {}
```

Beneficio: activás módulos por entorno sin tocar código, y desplegás solo lo del piloto.

---

## 5. Capas de la aplicación (request lifecycle)

```
HTTP Request
   ↓
Nginx (SSL, reverse proxy)
   ↓
NestJS
   ├── Guard (cookies/auth + roles)
   ├── Pipe (validación DTO con class-validator)
   ├── Controller (routing, sin lógica)
   ├── Service (lógica de negocio, reglas)
   ├── Repository (Prisma → PostgreSQL)
   └── Outbox DB → BullMQ → proveedor/n8n (entrega async)
   ↓
HTTP Response
```

### Autorización por rol (RBAC)

- `@Roles('mentor')` decorator + `RolesGuard`.
- Verificación de **ownership** a nivel service (un participante solo ve SUS sesiones/entregables).
- Los roles son múltiples; `mentor_assignment` y ownership limitan el alcance real.

---

## 6. Frontend (Next.js 16)

- **`(public)`** route group: landing del programa, SSG/ISR para SEO y velocidad.
- **`(portal)`** route group: portal autenticado; la API sigue siendo la autoridad de sesión y permisos.
- **Data fetching:** Server Components para lectura; Server Actions o fetch a la API NestJS para mutaciones.
- **Estado de servidor:** TanStack Query en cliente para listas que se refrescan (agenda, entregables).
- **UI por rol:** el mismo portal renderiza vistas distintas según el rol del token.

---

## 7. Deployment en VPS privado

### Topología Docker Compose

```yaml
# docker-compose.prod.yml (esquema conceptual)
services:
  nginx:          # reverse proxy + SSL (Let's Encrypt / Certbot)
    ports: ["80:80", "443:443"]
  web:            # Next.js (build standalone)
  api:            # NestJS
  postgres:       # PostgreSQL 16 + volumen persistente
  redis:          # Redis para BullMQ
  n8n:            # opcional; se activa cuando se elija integración/canal
volumes:
  postgres_data:
  n8n_data:
  uploads:        # entregables (filesystem en piloto)
```

### Recursos estimados (piloto, VPS austero)

| Servicio | RAM aprox |
|----------|-----------|
| PostgreSQL | 256-512 MB |
| Redis | 64-128 MB |
| NestJS API | 256-512 MB |
| Next.js | 256-512 MB |
| n8n | 256-512 MB |
| Nginx | 32-64 MB |
| **Total** | **~1.5-2.5 GB** → un VPS de 4 GB va holgado |

Es una hipótesis inicial, no una prueba de capacidad. Se validará con métricas de contenedor y prueba de carga antes del piloto.

### Consideraciones de producción

- **SSL:** Certbot + renovación automática.
- **Backups:** dump diario de PostgreSQL + backup del volumen de uploads (cron → almacenamiento externo).
- **Logs:** stdout de contenedores → agregar (Loki/Grafana opcional, o simplemente `docker logs` + rotación en el piloto).
- **Migraciones:** `prisma migrate deploy` en el arranque del contenedor api.
- **Variables sensibles:** `.env` fuera del repo, secrets del VPS.

---

## 8. Camino de escalamiento (cuando el piloto valide)

| Necesidad futura | Cómo se resuelve (sin reescribir) |
|------------------|-----------------------------------|
| Un módulo recibe mucha carga | Se extrae como microservicio (ya está aislado + comunicado por eventos) |
| Varias oleadas en paralelo | Scope por `organization_id` + cohorte `oleada_id` |
| Storage crece | Filesystem → MinIO/S3 (interfaz de storage ya abstraída) |
| BullMQ deja de cubrir el volumen | Outbox → broker dedicado conservando contratos e idempotency keys |
| Más tráfico web | Nginx load balancing + réplicas del contenedor api |

**Principio:** las decisiones de hoy (aislamiento, eventos, interfaces, storage abstraído) son exactamente lo que hace barato el escalamiento mañana.

---

## 9. Resumen de decisiones

- **Monorepo** con workspaces (pnpm).
- **Backend monolito modular NestJS**, módulos aislados listos para extraer.
- **Feature gates** para activación progresiva.
- **Prisma + PostgreSQL**, repositories propios que envuelven Prisma.
- **Redis + BullMQ** para jobs/recordatorios; **n8n** para automatizaciones sin código.
- **Docker Compose + Nginx** en VPS privado; ~2 GB RAM para el piloto.
- **Service-Repository + roles + assignments + ownership** consistente en todos los módulos.
