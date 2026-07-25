# 02 · Design tokens EDU-MENTOR

Estado: **propuesta**, pendiente de aprobación (checklist Fase 0 · Producto/UX).
Fuente de marca: paleta EDU-US declarada en `CLAUDE.md`. Los tokens no inventan colores nuevos: derivan rampas de los cinco colores oficiales para poder cumplir WCAG 2.2 AA.

Implementación: `tokens/edu-mentor.tokens.json` (formato W3C Design Tokens) y `tokens/tokens.css` (custom properties). Cuando exista `apps/web`, la hoja CSS se importa una sola vez y nadie escribe hex sueltos.

---

## 1. Por qué hay rampas y no solo cinco colores

Los colores de marca funcionan como identidad, no como color de texto:

| Uso | Ratio | AA |
|---|---|---|
| Blanco sobre teal `#2DB6A8` | 2.51 | ❌ |
| Blanco sobre amarillo `#F5A623` | 2.03 | ❌ |
| Blanco sobre coral `#E8461E` | 3.94 | ❌ salvo texto ≥24px |
| `#2DB6A8` como borde sobre blanco | 2.51 | ❌ (mínimo 3.0 para UI) |

Regla resultante: **los colores 500 son de marca y de relleno decorativo; los 600–800 son los que llevan texto o dibujan bordes.**

## 2. Color

### Navy (estructura, texto)

| Token | Hex | Uso | Contraste |
|---|---|---|---|
| `navy-900` | `#0B1526` | Sidebar, topbar | blanco encima: 18.27 ✅ |
| `navy-800` | `#16243B` | **Marca.** Texto principal, headings | sobre `bg`: 13.79 ✅ |
| `navy-700` | `#1F3355` | Superficies navy elevadas, hover de nav | |
| `navy-600` | `#2C466F` | Bordes sobre fondo navy | |
| `navy-500` | `#5B6B82` | Texto secundario/metadatos | sobre `bg`: 4.81 ✅ |

> El sidebar de los mockups (`≈#031832`) se sustituye por `navy-900`: mantiene la profundidad sin volverse negro.

### Teal (acción primaria, estado positivo)

| Token | Hex | Uso | Contraste |
|---|---|---|---|
| `teal-800` | `#075049` | Texto sobre fondos teal claros | sobre `teal-50`: 8.73 ✅ |
| `teal-700` | `#0B6E66` | **Relleno de botón primario**, bordes, foco | blanco encima: 6.11 ✅ |
| `teal-600` | `#0F7C72` | Hover de enlaces teal, texto teal sobre blanco | 5.06 ✅ |
| `teal-500` | `#2DB6A8` | **Marca.** Acentos, gráficos, teal sobre navy | sobre navy: 6.20 ✅ |
| `teal-200` | `#A8E3DC` | Bloques de calendario, rellenos suaves | |
| `teal-100` | `#D9F3EF` | Fondo de chip "Confirmada/Evaluado" | |
| `teal-50` | `#EEFAF8` | Fondo de sección informativa | |

### Amarillo (atención, pendiente)

| Token | Hex | Uso | Contraste |
|---|---|---|---|
| `yellow-800` | `#7A5200` | Texto de estado pendiente sobre claro | 6.92 ✅ |
| `yellow-500` | `#F5A623` | **Marca.** Relleno de chip, indicador de progreso | texto `navy-800` encima: 7.68 ✅ |
| `yellow-200` | `#FBDFB0` | Bordes de aviso | |
| `yellow-100` | `#FDF1DC` | Fondo de chip "Por confirmar" | texto `yellow-800`: 6.19 ✅ |

### Coral (alerta, acción destructiva o urgente)

| Token | Hex | Uso | Contraste |
|---|---|---|---|
| `coral-800` | `#8F2A10` | Texto de error sobre fondo claro | |
| `coral-700` | `#B23414` | **Relleno de botón destructivo/urgente** | blanco encima: 6.19 ✅ |
| `coral-500` | `#E8461E` | **Marca.** Acento, badge de conteo, ilustración | |
| `coral-200` | `#F7B9A8` | Borde de alerta | |
| `coral-100` | `#FBE0D8` | Fondo de chip "Devuelto" | texto `coral-800`: 6.68 ✅ |

> El naranja `≈#E97426` de los mockups desaparece: no es de marca. Su función (llamar la atención sin ser error) la cubre `yellow-500`.
> El verde `≈#3FA76D` también desaparece: "Confirmada" y "Evaluado" son teal. Reducir de 6 hues a 4 hace el sistema legible.

### Neutros

| Token | Hex | Uso |
|---|---|---|
| `bg` | `#F4F1EA` | **Marca.** Fondo de página off-white |
| `surface` | `#FFFFFF` | Tarjetas, tablas, modales |
| `surface-sunken` | `#EEEAE1` | Zonas hundidas, encabezado de tabla |
| `border` | `#DCD7CC` | Divisores decorativos |
| `border-strong` | `#7E7869` | Bordes de input y controles (4.40 ✅, supera el 3.0 exigido) |
| `overlay` | `rgba(11,21,38,0.55)` | Fondo de modal |

### Semánticos (los únicos que se usan en componentes)

```
action.primary        = teal-700     action.primary.text  = #FFFFFF
action.secondary      = surface + border-strong + navy-800
action.danger         = coral-700    action.danger.text   = #FFFFFF
focus.ring            = teal-700, 2px, offset 2px

status.confirmed      = teal-100 / teal-800        CONFIRMED · ATTENDED · EVALUATED · APPROVED · CLEAN
status.pending        = yellow-100 / yellow-800    PENDING (confirmación · solicitud · scan) · SUBMITTED
status.review         = teal-50 / teal-800         UNDER_REVIEW
status.returned       = coral-100 / coral-800      RETURNED
status.declined       = coral-100 / coral-800      DECLINED · ABSENT · REJECTED
status.neutral        = surface-sunken / navy-500  DRAFT · SCHEDULED · attendance PENDING
status.inactive       = surface-sunken / navy-700  COMPLETED · CANCELLED · RESCHEDULED
```

`declined` y `returned` comparten color porque comparten significado para quien mira: *algo no avanzó*. Se distinguen por el glifo y la etiqueta, nunca solo por el color.

## 3. Tipografía

Inter (fallback: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`). Escala de 1.2 sobre 16px.

| Token | Tamaño / interlineado | Peso | Uso |
|---|---|---|---|
| `display` | 32 / 40 | 700 | Saludo del dashboard |
| `h1` | 26 / 34 | 700 | Título de pantalla |
| `h2` | 21 / 28 | 600 | Título de sección |
| `h3` | 18 / 26 | 600 | Título de tarjeta |
| `body` | 16 / 24 | 400 | Texto por defecto |
| `body-sm` | 14 / 20 | 400 | Metadatos, celdas densas |
| `caption` | 13 / 18 | 500 | Chips, etiquetas de campo |
| `mono` | 14 / 20 | 400 | IDs, `traceId` en errores |

Reglas: mínimo real 13px (los mockups bajan a ~11px en metadatos de tabla); nunca comunicar estado solo con peso o color; números tabulares en tablas y calendario.

## 4. Espaciado, radio, elevación

```
space   4 · 8 · 12 · 16 · 24 · 32 · 48 · 64      (base 4)
radius  sm 6 · md 10 · lg 14 · pill 999
shadow  sm  0 1px 2px rgba(11,21,38,.06)
        md  0 4px 12px rgba(11,21,38,.08)
        lg  0 12px 28px rgba(11,21,38,.12)
```

Grid del portal: sidebar 240px fijo · contenido fluido · columna de contexto 320px (se colapsa <1280px). Ancho máximo de contenido 1440px.

## 5. Breakpoints

| Token | Ancho | Comportamiento |
|---|---|---|
| `sm` | <640 | Una columna, nav inferior, tablas → tarjetas |
| `md` | 640–1023 | Dos columnas, sidebar colapsado a íconos |
| `lg` | 1024–1279 | Sidebar completo, sin columna de contexto |
| `xl` | ≥1280 | Layout de tres zonas (el de los mockups) |

El participante confirmará asistencia desde el celular: `sm` es un requisito, no un extra.

## 6. Accesibilidad — reglas no negociables

1. Texto normal ≥4.5:1, texto grande y componentes ≥3:1.
2. El color nunca es el único portador de significado: cada chip lleva texto y, en calendario, además un ícono o patrón.
3. Foco visible en todo elemento interactivo: anillo `teal-700` de 2px con 2px de offset (nunca `outline: none`).
4. Objetivo táctil mínimo 44×44 px.
5. Orden de tabulación = orden visual; `skip to content` en el shell.
6. Modales: foco atrapado, `Esc` cierra, foco devuelto al disparador.
7. Estados de formulario con `aria-invalid` + mensaje asociado por `aria-describedby`; el error se anuncia, no solo se pinta de rojo.
8. `prefers-reduced-motion`: sin animaciones de entrada ni transiciones de más de 150ms.
9. Idioma `lang="es"`; fechas y horas en `America/Lima` con zona explícita cuando aplique.

## 7. Pendientes de esta propuesta

- Confirmar si la mascota es un activo de marca oficial de EDU-US y en qué contextos aparece.
- Confirmar tipografía institucional (si EDU-US tiene una, reemplaza a Inter).
- Definir el set de iconografía (propuesta: Lucide, licencia ISC, estilo lineal 1.5px).
- Definir logo en versión clara para `navy-900` y área de resguardo.
