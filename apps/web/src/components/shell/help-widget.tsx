/**
 * Widget de ayuda del sidebar, siguiendo las maquetas de referencia.
 *
 * Va **solo en escritorio**: en la barra inferior de móvil no hay sitio, y
 * ocupar un quinto de la pantalla de un celular con una tarjeta de ayuda le
 * quitaría espacio a lo que la persona vino a hacer.
 *
 * **Falta la mascota.** Las maquetas llevan la ardilla de EDU-US aquí, pero no
 * tengo el activo y no está confirmado con Comunicaciones si es oficial
 * (`docs/design/02-design-tokens.md` §7). La tarjeta se ve completa sin ella:
 * el texto y el enlace son lo que aporta valor. Cuando llegue el archivo, se
 * coloca en `public/mascota.png` y se descomenta el bloque de abajo — una
 * imagen rota sería peor que ninguna.
 *
 * **El coral es `coral-700`, no el naranja brillante de la maqueta.** Blanco
 * sobre `#E8461E` da 3.94:1 y AA exige 4.5; sobre `coral-700` da 6.19:1. Se
 * conserva la intención —una tarjeta cálida que destaca en el sidebar oscuro—
 * sin dejar el texto por debajo del mínimo legible.
 */
export function HelpWidget() {
  return (
    <aside
      className="mt-auto hidden flex-col gap-2 rounded-[var(--edu-radius-lg)] bg-[var(--edu-coral-700)] p-4 text-white md:flex"
      aria-labelledby="help-widget-title"
    >
      {/*
        Cuando exista el activo:
        <img src="/mascota.png" alt="" aria-hidden="true" width={72} height={72} />
      */}
      <p id="help-widget-title" className="text-sm font-bold">
        ¿Necesitas ayuda?
      </p>
      <p className="text-xs leading-snug text-white">
        Accede a guías y recursos para mentorías efectivas.
      </p>
      <a
        href="https://edu-us.example.org/ayuda"
        target="_blank"
        rel="noreferrer"
        className="mt-1 inline-flex min-h-[2rem] items-center justify-center gap-1.5 rounded-[var(--edu-radius-sm)] bg-[var(--edu-teal-800)] px-3 text-xs font-semibold text-white"
      >
        Ir a la ayuda
        <span aria-hidden="true">↗</span>
      </a>
    </aside>
  );
}
