# L04 · Frontend guiado por contrato

## Objetivo

Entender por qué una interfaz confiable no empieza dibujando pantallas aisladas: empieza consumiendo estados, permisos y errores que el sistema puede sostener.

## 1. Contract-driven UI

Una UI guiada por contrato deriva sus decisiones del OpenAPI y de tipos generados:

```text
OpenAPI → tipos compartidos → adaptadores de UI → componentes → pantallas
```

Si el backend cambia un enum, el compilador o un fallback visible debe hacerlo evidente. Mantener una segunda lista manual de estados crea dos fuentes de verdad.

En EDU-MENTOR:

- `StatusChip` recibe el enum del contrato;
- labels y tonos viven en un traductor central;
- un valor desconocido no desaparece: se presenta como estado no reconocido;
- `error.code`, no el mensaje técnico, decide el copy localizado.

## 2. Tipos que expresan reglas de UX

Una unión discriminada puede convertir una regla de diseño en una regla del compilador:

```ts
type ButtonProps =
  | { disabled?: false; disabledReason?: never }
  | { disabled: true; disabledReason: string };
```

Esto impide compilar un botón deshabilitado que no explique el motivo. El tipo no sustituye la investigación UX, pero evita que una decisión aprobada se pierda en una pantalla nueva.

## 3. Cuatro gates distintos

### Typecheck

Comprueba coherencia estática: propiedades opcionales, enums y firmas.

### Lint

Busca patrones riesgosos: Hooks, navegación de Next, JSX y accesibilidad.

### Build

Ejecuta el empaquetador real. Puede fallar aunque TypeScript pase; por ejemplo, un alias válido para el compilador puede no ser resoluble por Turbopack.

### Smoke test

Levanta el artefacto y prueba una ruta. Demuestra que el proceso responde, renderiza contenido y aplica cabeceras.

Por eso el orden útil es:

```text
install → typecheck/lint → tests → build → smoke
```

## 4. Navegación no es autorización

Ocultar un enlace según el rol mejora la experiencia, pero no protege datos. La API debe volver a validar:

1. identidad;
2. rol/capacidad;
3. organización;
4. ownership del recurso;
5. transición de estado permitida.

La interfaz es una cortesía; el backend es la frontera de seguridad.

## 5. La capa temporal debe ser fácil de borrar

`fixtures.ts` permite trabajar antes de disponer de auth, pero está aislado. La pantalla no debería conocer si los datos vienen de JSON o HTTP.

La siguiente evolución es:

```text
page → interfaz de cliente → fixture provisional
                         ↘ HTTP tipado cuando auth esté listo
```

Esa frontera reduce el costo de reemplazo y permite que frontend y backend avancen en paralelo.

## 6. Ejercicio práctico

1. Agrega un estado ficticio al traductor y observa el fallback.
2. Intenta crear un `Button` con `disabled` sin `disabledReason`.
3. Ejecuta `pnpm --filter @edu-mentor/web typecheck`.
4. Cambia un import interno para terminar en `.js` y compara typecheck con `next build`.
5. Revierte el experimento y ejecuta `pnpm check`.

## 7. Cómo explicarlo en entrevista o demo

> Construí la interfaz desde un contrato OpenAPI generado, no desde mocks independientes. Convertí reglas de UX en tipos, mantuve fallbacks para cambios de enum y separé navegación de autorización real. Además usé gates distintos —typecheck, lint, build y smoke— porque cada uno detecta una clase diferente de fallo.

Eso muestra criterio de AI Engineer y software engineer: integración de contratos, seguridad por capas y automatización de calidad, no solo maquetación.
