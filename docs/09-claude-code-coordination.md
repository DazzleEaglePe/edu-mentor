# 09 · Coordinación Codex ↔ Claude Code

## Objetivo

Permitir trabajo paralelo sin producir dos productos distintos ni sobrescribir archivos.

## Responsabilidades

| Área | Owner primario | Revisión |
|---|---|---|
| Alcance, roadmap, checklist, gates | Codex | Usuario/Proyectos |
| Modelo de dominio y API | Codex | Claude consume/reporta gaps |
| Diseño visual, UX y componentes web | Claude Code | Codex revisa contratos/estados |
| `apps/web` | Claude Code | Codex revisa integración/seguridad |
| `apps/api` y persistencia | Codex | Claude valida necesidades UI |
| `packages/shared-types` | Compartido | Cambio con revisión cruzada |
| CI/deploy/observabilidad | Codex | Claude aporta necesidades web |
| UAT y aceptación | Usuario/Proyectos | Ambos preparan evidencia |

## Zonas de archivos

### Codex

- `docs/00-project-charter.md`
- `docs/05-gap-analysis.md`
- `docs/06-implementation-plan.md`
- `docs/07-checklist-master.md`
- `docs/08-roadmap.md`
- `docs/11-contract-decisions.md`
- `docs/12-domain-state-machines.md`
- `apps/api/**`
- packages de dominio/persistencia

### Claude Code

- `docs/design/**`
- `apps/web/**`
- storybook/component previews
- tokens y assets de marca

### Compartido con coordinación previa

- `CLAUDE.md`
- `AGENTS.md`
- `docs/01`–`04`
- `packages/shared-types/**`
- OpenAPI
- root configs/workspaces

## Protocolo antes de trabajar

1. Hacer `git status`.
2. Identificar gate activo.
3. Declarar archivos objetivo.
4. No tocar archivos con trabajo no integrado del otro agente.
5. Trabajar en una rama con alcance único.

Convención sugerida:

```text
planning/codex-<tema>
backend/codex-<tema>
design/claude-<tema>
frontend/claude-<tema>
```

No se hará commit inicial hasta que el usuario apruebe el baseline documental.

## Contrato de diseño para Claude

Claude puede usar `04-prompts-uxui.md` como referencia visual, pero debe:

- etiquetar cada pantalla `MVP` o `FUTURE`;
- no enlazar pantallas futuras en navegación del piloto;
- usar exactamente los estados aprobados;
- incluir loading, empty, error y forbidden;
- respetar WCAG 2.2 AA;
- usar fixtures sin PII;
- no simular éxito cuando falta una regla de backend.

Si falta un endpoint o estado, Claude registra una solicitud de contrato; no lo inventa silenciosamente.

## Solicitud de cambio de contrato

```markdown
## Contract change request

- Pantalla/flujo:
- Necesidad del usuario:
- Contrato actual:
- Cambio propuesto:
- Alternativa sin cambiar API:
- Impacto en datos/seguridad:
- Bloquea:
```

Codex responde en `docs/11-contract-decisions.md`, actualizando decisión, API/checklist o rechazando con alternativa.

## Handoff de diseño

Cada entrega de Claude debe incluir:

- rutas/pantallas creadas;
- componentes nuevos;
- datos mock usados;
- endpoints esperados;
- estados cubiertos;
- decisiones asumidas;
- accesibilidad revisada;
- capturas desktop/mobile;
- pruebas ejecutadas;
- gaps abiertos.

## Handoff técnico

Cada entrega de Codex debe incluir:

- contrato OpenAPI/tipos;
- reglas de ownership;
- estados/transiciones;
- errores esperados;
- fixtures de contrato;
- comandos de prueba;
- limitaciones conocidas.

## Revisión cruzada

Antes de integrar:

- frontend no expone acciones prohibidas y backend no confía en ello;
- UI y API usan los mismos estados;
- errores tienen UX definida;
- fechas usan timezone acordado;
- archivos respetan límites/seguridad;
- ninguna feature futura se activó;
- checklist y documentación se actualizaron.

## Conflictos

Si ambos modificaron el mismo contrato:

1. no resolver mecánicamente;
2. comparar intención;
3. decidir la regla de negocio;
4. actualizar documentos;
5. recién entonces resolver código.
