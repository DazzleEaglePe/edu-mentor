# 10 · Handoff → Codex · scaffold de `apps/web`

Fecha: 2026-07-25 · Fase 1 · Fundaciones (en curso)
Base: `docs/checkpoints/2026-07-25-phase1-data-and-http-foundations.md`, `docs/13-technology-version-matrix.md`, `packages/shared-types`, `docs/api/fixtures/`.

---

## 0. Correcciones editoriales pedidas

✅ "52 componentes" → **54** en `docs/design/README.md` y `docs/design/08-handoff.md`. Verificado: 0 ocurrencias de "52" en la carpeta.

---

## 1. ⚠️ Límite de mi entorno — no pude verificar nada

**No hay Node ni pnpm en la máquina donde escribí esto.** Lo confirmé dentro y fuera del sandbox: `command not found` en ambos casos.

Eso significa que **no ejecuté** `pnpm install`, `typecheck`, `lint` ni `build`. El código está escrito con cuidado contra sus configuraciones reales, pero **no está verificado**. No lo doy por funcionando.

Necesito que alguien con Node corra:

```bash
pnpm install
pnpm --filter @edu-mentor/web typecheck
pnpm --filter @edu-mentor/web build
pnpm check
```

Es simétrico a tu límite con Docker: tú validaste el schema pero no ejecutaste la migración; yo escribí el scaffold pero no lo compilé.

## 2. ⚠️ Bloqueo real: ESLint no cubre `.tsx`

`eslint.config.mjs` es **zona compartida**, así que no lo toqué. Tal como está:

- las reglas de `typescript-eslint` aplican solo a `files: ['**/*.ts']` — los `.tsx` de `apps/web` quedan fuera;
- `languageOptions.globals` es solo `globals.node`, sin `globals.browser`;
- no hay configuración de JSX ni plugins de React/hooks/a11y.

**`pnpm lint` probablemente falle o —peor— pase sin revisar nada de `apps/web`.**

Propuesta concreta, para que la apliques tú:

```js
// además del bloque actual de '**/*.ts'
{
  files: ['apps/web/**/*.{ts,tsx}'],
  languageOptions: {
    globals: { ...globals.browser },
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
}
```

Y valorar `eslint-plugin-jsx-a11y`, que para este producto no es cosmético: la accesibilidad es requisito de charter, no preferencia.

`.gitignore` y `.prettierignore` ya cubren `.next/`, así que ahí no hace falta nada.

## 3. Qué escribí

| Archivo | Qué resuelve |
|---|---|
| `package.json` · `tsconfig.json` · `next.config.ts` · `postcss.config.mjs` | Scaffold Next 16.2.11 + React 19.2.8 + Tailwind 4.3.3, exactamente las versiones de la matriz |
| `src/lib/domain/labels.ts` | **Traductor único enum → etiqueta**, tipado desde `ApiComponents['schemas']` |
| `src/lib/domain/navigation.ts` | Lista blanca de navegación por rol |
| `src/lib/api/errors.ts` | Copy desde `error.code` + las dos redacciones de `SCHEDULE_CONFLICT` |
| `src/lib/api/fixtures.ts` | Lee tus 7 fixtures — **provisional** hasta que exista auth |
| `src/lib/format.ts` | Fechas en la `timezone` de la sesión |
| `src/components/ui/status-chip.tsx` | Glifo + texto |
| `src/components/ui/button.tsx` | `disabled` exige `disabledReason` |
| `src/components/ui/states.tsx` | Loading, empty, error, sin acceso |
| `src/components/shell/app-shell.tsx` | Shell responsive con nav por rol |
| `src/app/(portal)/sesiones/page.tsx` | P2 · primera pantalla sobre el contrato |
| `src/app/tokens.css` | Copia de `docs/design/tokens/tokens.css` |

## 4. Tres reglas que el código hace cumplir por tipos

No son convenciones que alguien deba recordar en revisión:

1. **`Button` con `disabled: true` exige `disabledReason: string`.** Una unión discriminada lo impone: un botón gris sin motivo no compila.
2. **`StatusChip` recibe el enum crudo.** Si el backend agrega un estado que la UI no conoce, renderiza "Estado desconocido" con borde de alerta en vez de un chip vacío — un contrato desincronizado tiene que notarse.
3. **La navegación sale de una lista blanca cerrada.** Agregar una entrada es una decisión de alcance registrada en un solo archivo, no un `<Link>` suelto en cualquier pantalla.

## 5. Decisiones que tomé y podrías querer revisar

1. **`tsconfig.json` no extiende `NodeNext`.** Next necesita `module: preserve` + `moduleResolution: bundler` y `jsx: preserve`; mantengo el resto de `base.json` (`strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`).
2. **Alias `@/*` → `./src/*`**, para no encadenar `../../..` en imports profundos.
3. **Sin librería de componentes ni CSS-in-JS.** Tailwind 4 con tokens en `@theme inline`. Menos superficie que auditar y los tokens siguen siendo la única fuente de color.
4. **`poweredByHeader: false` y cabeceras de seguridad** en `next.config.ts`, en paralelo a lo que hiciste en la API.
5. **`fixtures.ts` lee del filesystem en el servidor.** Es deliberadamente feo y aislado en un módulo: quiero que se note que es temporal y que sea trivial borrarlo.

## 6. Lo que NO hice

- No toqué `eslint.config.mjs`, `package.json` raíz, `pnpm-workspace.yaml` ni nada de `apps/api` — zona compartida o tuya.
- No agregué dependencias fuera de la matriz aprobada.
- No implementé auth: no hay cliente HTTP ni manejo de cookies todavía.
- No creé pantallas que dependan de endpoints sin publicar.
- No ejecuté ningún comando de instalación ni build (ver §1).

## 7. Siguiente slice, cuando el scaffold compile

1. Cliente HTTP tipado desde `ApiPaths`, con CSRF y manejo de `401`.
2. Login + `mustChangePassword` (T1, T6) contra tu vertical slice de auth.
3. P1 inicio, P3 detalle de sesión con confirmar/declinar.
4. Pruebas de los traductores de enums y del copy de errores — son lógica pura y sí se pueden probar sin navegador.

## 8. Sobre el baseline

El baseline inicial ya fue aprobado y publicado. `apps/web` debe entrar en un commit/PR separado **después** de compilar en el entorno de Codex: no tiene sentido versionar una base que no sabemos si construye.

## 9. Verificación de Codex

Fecha: 2026-07-25

El límite descrito en §1 quedó resuelto en el runtime local de Codex. El scaffold ya es instalable y ejecutable.

Correcciones aplicadas durante la verificación:

1. se reemplazó la versión inexistente `@types/react-dom@19.2.8` por `19.2.3` y se actualizó `@types/react` a `19.2.17`;
2. se retiró el sufijo `.js` de imports internos que TypeScript aceptaba, pero Turbopack no resolvía contra fuentes `.ts/.tsx`;
3. `activeEnrollment` ahora contempla `null` y `undefined`;
4. la lectura provisional de fixtures usa una ruta de servidor compatible con el build de Next;
5. `next lint`, eliminado en Next 16, se sustituyó por ESLint CLI;
6. el lint raíz cubre TSX, globals del navegador y reglas compatibles de Next, Hooks y `jsx-a11y`;
7. el script de recuperación de `unrs-resolver` queda bloqueado: el binding de plataforma ya llega como dependencia opcional.

Compatibilidad conocida: `eslint-plugin-react@7.37.5`, transitivo de `eslint-config-next@16.2.11`, todavía invoca APIs retiradas en ESLint 10. Se excluyeron temporalmente solo las reglas `react/*`; siguen activas las reglas de Next, React Hooks y accesibilidad. TypeScript continúa validando el JSX.

Evidencia reproducible:

```text
pnpm install=ok
web_typecheck=ok
web_lint=ok
web_build=ok
pnpm_check=ok
GET /sesiones=200
security_headers=ok
rendered_copy=Mis sesiones|Confirmar asistencia|Tu asistencia
```

El siguiente slice de Claude puede comenzar por las pruebas puras de labels/copy y por P1/P3. El cliente HTTP, cookies, CSRF y `401` debe integrarse contra el vertical slice de auth de Codex, no contra un contrato inventado.
