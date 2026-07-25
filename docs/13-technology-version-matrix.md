# 13 · Matriz tecnológica verificada

Fecha del spike: 2026-07-25
Estado: baseline reproducible para scaffold; patches se actualizan solo mediante PR y CI.

## 1. Decisión

| Componente | Versión base | Política |
|---|---:|---|
| Node.js | 24 LTS; imagen inicial `24.18.0` | Misma major en local/CI/VPS; digest de imagen se fija al crear deploy. |
| pnpm | `11.17.0` | `packageManager` exacto y lockfile versionado. |
| TypeScript | `6.0.3` | No adoptar 7 todavía; reevaluar cuando el toolchain use su nueva API estable. |
| Next.js | `16.2.11` | App Router. |
| React / React DOM | `19.2.8` | Versiones idénticas. |
| NestJS | `11.1.28` | `common`, `core` y platform con el mismo patch. |
| Prisma / Client / adapter-pg | `7.9.0` | ESM + driver adapter obligatorio. |
| PostgreSQL | `16.x` | Imagen/digest exactos se fijan con Docker Compose. |
| Tailwind / PostCSS plugin | `4.3.3` | Mismo patch. |
| BullMQ | `5.81.2` | Redis es transporte de jobs, no autoridad del evento. |
| Redis client | `6.1.0` | Cliente Node; servidor se fija en el spike Docker. |
| `pg` | `8.22.0` | Driver usado por `@prisma/adapter-pg`. |

### Tooling del scaffold

| Herramienta | Versión | Nota |
|---|---:|---|
| ESLint | `10.7.0` | Flat config compartida; se evitó adoptar un patch con menos edad sin revisión. |
| typescript-eslint | `8.65.0` | Compatible con TypeScript `<6.1`, incluido el baseline `6.0.3`. |
| Prettier | `3.9.6` | Formato reproducible para código y configuración. |
| `openapi-typescript` | `7.13.0` | Generador aislado con TypeScript `5.9.3` porque su peer estable aún declara `^5.x`; el código generado se compila con TypeScript `6.0.3`. |
| `tsx` | `4.23.1` | Runner de desarrollo y pruebas de la API. |
| Redocly CLI | `2.40.0` | Lint del contrato OpenAPI en local y CI. |

## 2. Por qué TypeScript 6

TypeScript 7.0 es estable y mucho más rápido, pero su release inicial no expone la API programática que consume parte del ecosistema. El propio equipo documenta el modo side-by-side y recomienda mantener TypeScript 6 para tooling que aún depende de esa API. Para reducir fricción de ESLint, Nest y generadores durante el piloto, usamos 6.0.3 y dejamos una prueba de upgrade separada.

Fuentes oficiales:

- [TypeScript 7.0 y compatibilidad con tooling](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)
- [TypeScript 6.0 como versión puente](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/)

## 3. Requisitos verificados

- Next.js 16 requiere Node >=20.9 según su [guía de instalación](https://nextjs.org/docs/app/getting-started/installation).
- NestJS 11 requiere Node >=20 según su [guía de migración](https://docs.nestjs.com/migration-guide).
- Prisma 7 requiere Node `^20.19`, `^22.12` o `>=24` y TypeScript >=5.4 según [system requirements](https://docs.prisma.io/docs/orm/reference/system-requirements).
- Prisma 7 exige ESM y adapter de driver para conexión directa según su [documentación principal](https://www.prisma.io/docs/orm).
- Node 24 es LTS; Node 26 permanece Current al momento del análisis según [Node.js Releases](https://nodejs.org/en/about/previous-releases).

## 4. Evidencia del spike

Directorio temporal aislado; no modificó el proyecto.

```text
Node del spike       v24.14.0 (misma major LTS)
pnpm                 11.17.0
TypeScript           6.0.3
Next.js              16.2.11
NestJS               11.1.28
Prisma CLI/Client    7.9.0
Arquitectura         macOS arm64
Resultado            instalación y ejecutables OK
```

Paquetes instalados juntos: Next/React, Nest, Prisma/adapter-pg/pg, Tailwind, BullMQ y Redis client. `tsc --version`, `next --version` y `prisma --version` finalizaron correctamente.

La validación exacta con Node 24.18.0 y Linux se ejecutará en CI/Docker durante el scaffold; el entorno local disponible tenía 24.14.0.

## 5. Supply-chain y scripts de instalación

pnpm 11 bloqueó correctamente scripts hasta recibir allowlist. Baseline:

```yaml
allowBuilds:
  "@prisma/engines": true
  esbuild: true
  msgpackr-extract: false
  prisma: true
  sharp: true
  unrs-resolver: false
```

pnpm 11.17 usa `allowBuilds` para registrar la decisión positiva o negativa por paquete. `esbuild` se autorizó tras confirmar que es la dependencia directa de ejecución de `tsx`; su postinstall selecciona/verifica el binario de plataforma. `msgpackr-extract` se bloquea porque es una optimización nativa opcional. `unrs-resolver`, dependencia transitiva del resolver de imports de ESLint, ya instala el binding nativo de la plataforma mediante `optionalDependencies`; su postinstall de recuperación queda bloqueado. No se habilita una autorización global. Toda dependencia nueva que solicite script debe revisarse de forma explícita.

También se activará:

- lockfile estricto;
- instalación `--frozen-lockfile` en CI;
- edad mínima de releases y excepciones justificadas;
- auditoría de dependencias y secret scan;
- actualización por PR, nunca “latest” en deploy.

## 6. Pendientes del spike de infraestructura

1. imagen Linux exacta de Node y digest;
2. versiones/digests de PostgreSQL y Redis;
3. compatibilidad de Prisma migrations con los constraints SQL manuales;
4. imágenes arm64/amd64;
5. presupuesto de RAM medido;
6. estrategia de patches de seguridad.
