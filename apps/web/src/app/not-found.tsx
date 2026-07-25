import Link from 'next/link';

/**
 * El backend oculta lo ajeno devolviendo `404`, así que esta pantalla **no
 * afirma que el recurso no existe**: dice que no está disponible, que es
 * verdad en ambos casos y no filtra información.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-bold">Este contenido no está disponible</h1>
      <p className="text-sm text-[var(--edu-text-secondary)]">
        Puede haber sido cancelado o ya no tienes acceso. Si crees que es un error, escribe a tu
        coordinación.
      </p>
      <Link
        href="/inicio"
        className="text-sm font-semibold text-[var(--edu-text-link)] underline underline-offset-2"
      >
        Volver a mi inicio
      </Link>
    </main>
  );
}
