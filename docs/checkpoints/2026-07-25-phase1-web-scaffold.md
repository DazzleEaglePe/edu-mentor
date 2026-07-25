# Checkpoint · Scaffold web de Fase 1

Fecha: 2026-07-25
Fase: 1 · Fundaciones
Estado del gate: en curso; el scaffold web está validado, pero Gate 1 requiere auth, RBAC, seed y migración reproducible.

## Resultado

El scaffold de `apps/web` entregado por Claude Code quedó integrado con el workspace y verificado por Codex.

Entregado:

1. Next.js 16, React 19 y Tailwind 4;
2. shell responsive y navegación permitida por rol;
3. primera ruta real, `/sesiones`, alimentada por fixtures de contrato;
4. traducción tipada de enums y fallback visible para estados desconocidos;
5. copy de errores derivado de `error.code`;
6. botones deshabilitados con motivo obligatorio por tipo;
7. lint TSX con reglas de Next, Hooks y accesibilidad;
8. build de producción y smoke test HTTP.

## Hallazgos cerrados

La verificación detectó cinco defectos que una revisión visual no podía demostrar:

- una versión de tipos inexistente impedía instalar;
- imports internos con `.js` pasaban el typecheck pero fallaban en Turbopack;
- `activeEnrollment` podía ser `undefined`;
- una URL relativa de filesystem no era empaquetable por Next.
- el `aria-describedby` por defecto podía duplicarse al renderizar varios botones deshabilitados.

Esto explica por qué `typecheck`, lint, build y ejecución son gates complementarios: ninguno sustituye a los demás.

## Evidencia

```text
pnpm install=ok
pnpm --filter @edu-mentor/web typecheck=ok
pnpm --filter @edu-mentor/web lint=ok
pnpm --filter @edu-mentor/web build=ok
pnpm check=ok
tests=6_passed
GET /sesiones=200
X-Content-Type-Options=nosniff
X-Frame-Options=DENY
Referrer-Policy=same-origin
Permissions-Policy=present
```

## Decisión de lint

Next 16 eliminó `next lint`, por lo que el paquete web usa ESLint CLI. El preset oficial se acotó a `apps/web` para no aplicar reglas de Next sobre la API.

El parser y `eslint-plugin-react@7.37.5` que trae `eslint-config-next@16.2.11` aún no son compatibles con APIs retiradas en ESLint 10. El workspace conserva su parser `typescript-eslint@8.65.0`, y temporalmente activa del preset las reglas compatibles de Next, Hooks, imports y `jsx-a11y`. Las reglas `react/*` se reactivarán cuando el plugin publique soporte.

## Typecheck desde una instalación limpia

El primer CI del PR web reveló una diferencia que el workspace local ocultaba: `packages/shared-types/dist` ya existía localmente. En el runner limpio, el `typecheck` del paquete terminaba sin emitir y `apps/web` no podía resolver los tipos exportados desde `dist`.

El comando raíz ahora ejecuta esta secuencia:

```text
generar OpenAPI → compilar shared-types → typecheck recursivo
```

El build de este paquete desactiva `incremental`: es pequeño y debe reconstruir `dist` incluso si alguien borró los outputs pero quedó un `.tsbuildinfo` local. No se apunta el frontend directamente a archivos fuente internos ni se depende de un artefacto residual. El mismo contrato empaquetado que consumiría una aplicación es el que valida el frontend.

## Próximo slice coordinado

### Codex

1. integrar o cerrar el PR de data runtime;
2. implementar el primer vertical slice de auth: sesión, rotación/revocación, RBAC y ownership;
3. publicar contrato y fixtures de login/`mustChangePassword`;
4. mantener CI, seguridad y pruebas negativas.

### Claude Code

1. añadir pruebas puras para labels, errores y navegación;
2. implementar P1 y P3 sobre contratos ya publicados;
3. preparar estados visuales responsive y evidencia de accesibilidad;
4. dejar el cliente HTTP detrás de una interfaz, sin inventar auth ni persistir tokens en `localStorage`.

### Punto de encuentro

Cuando el vertical slice de auth responda de extremo a extremo, se reemplaza `fixtures.ts` por el cliente HTTP tipado y se demuestra login → shell por rol → cierre/expiración de sesión.
