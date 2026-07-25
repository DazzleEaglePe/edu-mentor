# @edu-mentor/web

Portal de EDU-MENTOR. Owner: Claude Code (`docs/09-claude-code-coordination.md`).

## Estado

**Scaffold inicial de Fase 1 verificado por Codex.** Instalación, lint, typecheck, build de producción, gate completo y smoke test de `/sesiones` finalizan correctamente:

```bash
pnpm install --frozen-lockfile
pnpm --filter @edu-mentor/web lint
pnpm --filter @edu-mentor/web typecheck
pnpm --filter @edu-mentor/web build
pnpm check
```

La evidencia y las correcciones realizadas están en
`docs/checkpoints/2026-07-25-phase1-web-scaffold.md`.

## Qué hay

| Archivo | Qué resuelve |
|---|---|
| `src/lib/domain/labels.ts` | **Traductor único enum → etiqueta.** Un enum desconocido falla visible |
| `src/lib/domain/navigation.ts` | Lista blanca de navegación por rol; ninguna pantalla `FUTURE` puede entrar |
| `src/lib/api/errors.ts` | Copy redactado desde `error.code`, nunca desde `message` |
| `src/lib/format.ts` | Fechas en la `timezone` de la sesión, con la zona visible |
| `src/lib/api/fixtures.ts` | Lee los fixtures de `docs/api/fixtures/` — **provisional** hasta que exista auth |
| `src/components/ui/status-chip.tsx` | Glifo + texto, nunca solo color |
| `src/components/ui/button.tsx` | `disabled` **exige** `disabledReason` en el tipo |
| `src/components/ui/states.tsx` | Loading, empty, error y sin acceso |
| `src/components/shell/app-shell.tsx` | Navegación · contenido · contexto, responsive |
| `src/app/(portal)/sesiones/page.tsx` | P2 · primera pantalla real sobre el contrato |
| `src/app/tokens.css` | Copia de `docs/design/tokens/tokens.css` |

## Reglas que el código hace cumplir

1. Ningún componente escribe un hex: todo pasa por un token semántico.
2. Ningún componente escribe una etiqueta de estado a mano.
3. Un `disabled` sin motivo **no compila**.
4. La UI no simula éxito: sin respuesta del backend, no hay cambio de estado.
5. Ocultar en el frontend es cortesía; la autorización la valida el backend.

## Pendiente

- Integrar `POST /auth/login` y `GET /auth/me` cuando exista el slice de auth.
- Sustituir `fixtures.ts` por el cliente HTTP tipado.
- Convertir las 27 planchas restantes de `docs/design/wireframes/`.
- Revisión de accesibilidad con implementación real: orden de tabulación, foco en modales, `aria-live`, lector de pantalla.
