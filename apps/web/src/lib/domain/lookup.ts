/**
 * Búsqueda segura en un diccionario literal.
 *
 * Existe porque escribí el mismo bug tres veces: `translateStatus`,
 * `errorCopy` y `summarizeSubmission` resolvían `dictionary[key]` contra
 * `Object.prototype` para claves como `toString`, `constructor` o `__proto__`,
 * y devolvían una función donde se esperaba una etiqueta.
 *
 * TypeScript no ayuda aquí: el parámetro puede estar tipado como enum y aun
 * así llegar cualquier string en runtime, porque el dato viene del backend.
 *
 * La lección no fue "acuérdate de usar `Object.hasOwn`" —eso ya lo sabía la
 * segunda vez— sino que un patrón que se repite necesita **una sola
 * implementación**, no tres sitios cuidadosos.
 */

/** Devuelve el valor solo si la clave es propia del objeto; si no, `null`. */
export function lookup<T>(dictionary: Readonly<Record<string, T>>, key: string): T | null {
  return Object.hasOwn(dictionary, key) ? (dictionary[key] ?? null) : null;
}

/** Igual que `lookup`, pero con un valor de respaldo en vez de `null`. */
export function lookupOr<T>(dictionary: Readonly<Record<string, T>>, key: string, fallback: T): T {
  return lookup(dictionary, key) ?? fallback;
}
