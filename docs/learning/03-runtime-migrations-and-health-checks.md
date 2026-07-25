# L03 · Runtime, migraciones y health checks

## Objetivo

Aprender a distinguir “el código existe” de “el sistema puede operar” y a construir evidencia para cada nivel.

## 1. Tag frente a digest

Un tag como `postgres:16.14-bookworm` es legible, pero el publicador podría moverlo. Un digest identifica exactamente un manifest:

```text
postgres:16.14-bookworm@sha256:...
```

EDU-MENTOR conserva ambos: el tag explica la versión y el digest hace reproducible el binario. El manifest seleccionado incluye `amd64` y `arm64`, útil para CI/VPS y Mac Apple Silicon.

## 2. Schema, migración generada y migración aplicada

Son tres evidencias distintas:

1. **schema válido:** Prisma entiende modelos y relaciones;
2. **migración generada:** existe SQL versionado para transformar una base vacía;
3. **migración aplicada:** PostgreSQL ejecutó ese SQL y Prisma registró su historial.

En este checkpoint existen las tres: las dos primeras se validan localmente y GitHub Actions aplica la migración sobre un PostgreSQL efímero real. El entorno local todavía no tiene Docker, pero esa limitación ya no se confunde con falta de evidencia ejecutable.

Prisma Migrate es híbrido: genera SQL desde el modelo declarativo, pero permite añadir SQL imperativo para reglas que el schema no expresa, como `CHECK`.

## 3. Liveness frente a readiness

### Liveness

Responde: “¿el proceso está vivo?”. No consulta dependencias. Si falla repetidamente, el orquestador puede reiniciar el proceso.

### Readiness

Responde: “¿este proceso puede recibir tráfico útil?”. Consulta PostgreSQL y Redis. Si una dependencia cae, devuelve 503 y el balanceador deja de enviar tráfico sin reiniciar innecesariamente la aplicación.

```text
proceso caído       → live falla
proceso vivo,
dependencia caída   → live 200, ready 503
todo operativo      → live 200, ready 200
```

## 4. Fail-closed

En producción no se usan silenciosamente URLs locales cuando faltan variables. `DATABASE_URL` y `REDIS_URL` son obligatorias y sus protocolos se validan antes de iniciar.

El readiness revela solo estados sanitizados:

```json
{
  "dependencies": {
    "postgres": "unavailable",
    "redis": "ok"
  }
}
```

Nunca muestra la URL, contraseña, stack o mensaje del driver.

## 5. Hallazgo de toolchain

TypeScript con `tsc` emitía metadata suficiente para la inyección del controller, pero el runner `tsx` no reprodujo ese comportamiento. El build pasó y el smoke test falló.

La solución fue declarar la inyección explícitamente:

```ts
constructor(@Inject(HealthService) private readonly healthService: HealthService) {}
```

Lección: typecheck, unit tests y smoke tests cubren clases de fallo diferentes.

## 6. Cómo explicarlo en entrevista

> Separé liveness de readiness para evitar reinicios cuando solo falla una dependencia. Fijé imágenes por tag y digest, generé una migración versionada con constraints SQL y mantuve abierto el gate hasta ejecutarla contra PostgreSQL. Además, un smoke test detectó una diferencia entre el metadata emitido por tsc y el runner de desarrollo, que resolví con inyección explícita.
