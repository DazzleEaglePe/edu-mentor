# 09 · Copy deck

Texto de interfaz para las pantallas MVP. El copy es material de diseño, no decoración: en un piloto de 18 personas, una frase mal escrita genera más tickets que un bug.

Estado: **propuesta**. Español de Perú, trato de **tú** (el programa es para jóvenes de 18–30 y el tono del programa es cercano).

---

## 1. Principios

1. **Se nombra lo que la persona reconoce**, no cómo está construido el sistema. "Tu entrega", no "el deliverable". "Sesión", no "evento de agenda".
2. **El control dice exactamente qué pasa.** El botón dice "Enviar entregable" y el aviso posterior dice "Entregable enviado".
3. **Los errores explican qué pasó y cómo salir.** Sin disculpas, sin vaguedad, sin culpar a la persona.
4. **Voz activa y segunda persona.** "Confirma tu asistencia", no "La asistencia debe ser confirmada".
5. **Sin jerga técnica visible**, salvo el `traceId`, que es literalmente para soporte.
6. **Sin exclamaciones en cadena ni felicitaciones vacías.** El feedback del mentor es el elogio; la interfaz no compite con él.

## 2. Errores

| Código | Título | Cuerpo | Acción |
|---|---|---|---|
| Red / 500 | No pudimos cargar tus sesiones | Revisa tu conexión e inténtalo otra vez. Si sigue pasando, comparte este código con tu coordinación. | Reintentar · `traceId` |
| 400 | — | *(inline en el campo)* Ingresa una fecha válida. / El título no puede superar 160 caracteres. | Foco en el campo |
| 401 | Tu sesión expiró | Por seguridad cerramos tu sesión después de un tiempo sin actividad. | Iniciar sesión |
| 403 | No tienes acceso a este contenido | Si crees que es un error, escribe a tu coordinación. | Volver a mi inicio |
| 404 sesión | Esta sesión no está disponible | Puede haber sido cancelada o ya no tienes acceso. Revisa tu lista de sesiones. | Ver mis sesiones |
| 404 entregable | Este entregable no está disponible | Revisa tu lista de entregables. | Ver mis entregables |
| 409 traslape · *puede ver la sesión* | Hay un cruce de horario | {Nombre} ya tiene una sesión de {inicio} a {fin} el {fecha}. | Elegir otro horario · Ver la sesión |
| 409 traslape · *no puede verla* | Hay un cruce de horario | {Nombre} no está disponible de {inicio} a {fin} el {fecha}. | Elegir otro horario |
| 422 confirmación cerrada | Ya no puedes cambiar tu respuesta | La confirmación cerró el {fecha} a las {hora}. Avisa a tu mentora si tu situación cambió. | — |
| 409 versión | Alguien actualizó esto mientras trabajabas | Tus cambios no se guardaron para no sobrescribir los de otra persona. Copia lo que escribiste antes de recargar. | Ver cambios · Recargar |
| 409 estado | Esta revisión ya fue evaluada | Recarga para ver la evaluación actual. | Recargar |
| 409 solicitud | No pudimos aprobar la solicitud | Ese horario choca con otra sesión. La solicitud sigue pendiente. | Proponer otro horario |
| 413 | El archivo supera el límite | Comprímelo o divídelo en partes. Los archivos que ya subiste se conservan. | — |
| Tipo inválido | Este formato no se acepta | Puedes subir PDF, DOCX, PPTX, PNG, JPG o ZIP. | — |
| 422 fase | Esta sesión no corresponde a la fase del participante | Las sesiones de Fase 2 son solo para participantes graduados. {Nombre} está en Fase 1. | — |
| 422 estado | Esta revisión ya no está en borrador | Una vez enviada, no se pueden quitar archivos ni cambiar las notas. Si necesitas corregir, pide a tu mentora que te la devuelva. | — |
| 409 consigna con entregas | Esta consigna ya no se puede editar | {n} participantes ya enviaron su trabajo. Cambiar la rúbrica ahora invalidaría las evaluaciones hechas. | — |
| Offline | Sin conexión | Puedes seguir leyendo, pero no guardar cambios hasta que vuelva la conexión. | — |

**Regla del `traceId`:** se muestra siempre en errores 5xx y de red, en monoespaciada, seleccionable, con la etiqueta **"Código de soporte"** — la persona no sabe qué es un trace, pero sí que debe copiarlo.

**Regla del `404`:** el contrato oculta lo ajeno devolviendo `404`. El copy dice **"no está disponible"**, nunca "no existe": es verdad en ambos casos y no filtra si el recurso existe.

**Regla del `409`:** significa tres cosas distintas (traslape, versión, estado) y se distinguen por `error.code`. Cada una tiene su propia salida.

**Regla del traslape:** el texto depende de `canViewConflictingSession`. Con `false` se dice **"no está disponible"** y no se nombra ni se enlaza la otra sesión — el contrato ni siquiera entrega su id. **Nunca prometemos "el siguiente horario libre":** el backend no lo calcula, y sugerir un hueco sin validar produce un segundo error.

**Regla del control deshabilitado:** si `canConfirm` es `false`, confirmar y declinar se deshabilitan **con el motivo escrito al lado**. El `422` solo debería aparecer desde una pestaña vieja.

## 3. Estados vacíos

| Pantalla | Título | Cuerpo | Acción |
|---|---|---|---|
| P2 sin sesiones | Todavía no tienes sesiones agendadas | Tu mentor las programará al iniciar la semana. Te avisaremos cuando estén listas. | — |
| P2 pasadas vacías | Aún no tienes sesiones realizadas | Aquí verás tu historial de asistencia. | — |
| P6 sin consignas | Aún no hay consignas para tu semana | Cuando tu mentor publique la primera, aparecerá acá. | — |
| M11 cola vacía | No tienes entregas pendientes | Vuelve cuando tus participantes envíen sus trabajos. | Ver evaluadas |
| M2 semana vacía | No tienes sesiones esta semana | Agenda la sesión grupal y las 1:1 de la semana. | + Agendar sesión |
| M15 sin asignados | Aún no tienes participantes asignados | Tu coordinación los asignará al abrir la oleada. | — |
| A2 filtros sin resultado | Ningún resultado con estos filtros | Prueba ampliando el rango de fechas o quitando algún filtro. | Limpiar filtros |
| A6 sin oleadas | Crea la primera oleada | Una oleada agrupa a los participantes de un sector y define las fechas del programa. | Crear oleada |
| A5 sin usuarios | Todavía no hay usuarios | Empieza cargando a los participantes y mentores de la oleada. | Agregar usuario |
| A7 sin inscripciones | Nadie está inscrito todavía | Inscribe a los participantes que ya creaste para que puedan ver sus sesiones. | Inscribir participante |
| A8 sin asignaciones | Aún no hay mentores asignados | Asigna un mentor a cada participante, o uno para toda la oleada. | Asignar mentor |

## 4. Confirmaciones de acciones destructivas

| Acción | Título | Cuerpo | Botones |
|---|---|---|---|
| Cancelar sesión | ¿Cancelar esta sesión? | Se notificará a {n} participantes. Esta acción no se puede deshacer; si solo quieres mover la fecha, usa reprogramar. | Sí, cancelar · Volver |
| Reprogramar | ¿Confirmar la nueva fecha? | La sesión pasa del {fecha anterior} al {fecha nueva}. Se notificará a {n} participantes y tendrán que confirmar otra vez. | Confirmar · Volver |
| Quitar archivo | ¿Quitar {archivo}? | Podrás volver a subirlo mientras la entrega esté en borrador. | Quitar · Cancelar |
| Enviar entregable | ¿Enviar tu entregable? | Se congela esta versión con {n} archivos y tu mentor la recibe para evaluar. Si te pide ajustes, podrás reenviar sin perder lo anterior. | Enviar · Revisar otra vez |
| Devolver | ¿Devolver para corrección? | {Nombre} recibirá tu retroalimentación y podrá reenviar. El historial se conserva. | Devolver · Volver |
| Reasignar mentor | ¿Reasignar a {participante}? | Sus sesiones futuras seguirán con {mentor actual} hasta que las reprogrames. | Reasignar · Cancelar |
| Declinar asistencia | ¿No podrás asistir? | Tu mentora verá que no asistirás. Puedes cambiarlo mientras la sesión no haya ocurrido. | No asistiré · Volver |
| Aprobar reprogramación | ¿Mover la sesión al {fecha}? | Se reprograma para {n} participantes y tendrán que confirmar otra vez. | Aprobar · Volver |
| Rechazar reprogramación | ¿Rechazar la solicitud? | {Nombre} verá tu motivo y la sesión seguirá en su fecha original. | Rechazar · Volver |
| Completar sesión | ¿Marcar la sesión como realizada? | Después podrás registrar quién asistió. Esta acción no se puede deshacer. | Marcar realizada · Volver |
| Restablecer acceso | ¿Restablecer el acceso de {nombre}? | Se genera una contraseña temporal y se cierran todas sus sesiones. Tendrás que entregársela. | Restablecer · Cancelar |
| Abrir oleada | ¿Abrir la oleada {nombre}? | {n} participantes inscritos podrán entrar y ver sus sesiones. | Abrir · Volver |
| Reasignar mentoría | ¿Reasignar a {participante}? | La asignación con {mentor actual} se cierra y queda en el historial. Sus sesiones ya agendadas no cambian. | Reasignar · Cancelar |
| Cerrar asignación | ¿Cerrar la asignación de {mentor}? | Queda en el historial con su periodo. {Participante} se quedará sin mentor hasta que asignes otro. | Cerrar · Volver |
| Editar consigna publicada | ¿Guardar los cambios? | 18 participantes ya ven esta consigna. Podrás editarla hasta que llegue la primera entrega. | Guardar · Volver |

## 5. Confirmaciones de éxito

Se muestran como toast **y** el estado en pantalla cambia. El toast nunca es la única evidencia.

| Acción | Mensaje |
|---|---|
| Confirmar asistencia | Asistencia confirmada |
| Declinar | Avisamos que no asistirás |
| Solicitar reprogramación | Solicitud enviada. Tu mentora te responderá pronto. |
| Cancelar mi solicitud | Solicitud cancelada |
| Enviar revisión | Entregable enviado. Tu mentora lo recibirá para evaluar. |
| Guardar borrador | Borrador guardado |
| Crear revisión nueva | Revisión {n} creada. Sube tus archivos corregidos. |
| Cambiar contraseña | Contraseña actualizada. Cerramos tus otras sesiones. |
| Crear sesión | Sesión agendada. Se notificó a {n} participantes. |
| Reprogramar | Sesión reprogramada al {fecha} |
| Cancelar sesión | Sesión cancelada |
| Completar sesión | Sesión marcada como realizada |
| Marcar asistencia | Asistencia registrada |
| Aprobar solicitud | Sesión reprogramada al {fecha}. Avisamos a {n} participantes. |
| Rechazar solicitud | Solicitud rechazada. {Nombre} recibió tu motivo. |
| Tomar revisión | Estás revisando esta entrega |
| Guardar evaluación | Evaluación guardada. {Nombre} ya puede ver tu retroalimentación. |
| Devolver | Entrega devuelta a {nombre} |
| Guardar Top 3 | Top 3 actualizado |

## 6. Notificaciones salientes

> **Bloqueado por DEC-020:** no está decidido el canal (email, WhatsApp o ambos) ni el proveedor. Este copy es **agnóstico de canal**: título corto + cuerpo, adaptable a ambos. Las plantillas finales se cierran en Sprint 6.

| Evento | Título | Cuerpo |
|---|---|---|
| `session.scheduled` | Nueva sesión: {título} | {Fecha} a las {hora}. Confirma tu asistencia en la plataforma. |
| Recordatorio 24 h | Mañana: {título} | {Hora}, con {mentor}. {Si no confirmó: Aún no confirmas tu asistencia.} |
| Recordatorio 1 h | Tu sesión empieza en una hora | {Título}, {hora}. |
| `session.rescheduled` | Se movió tu sesión: {título} | Ahora es el {fecha nueva} a las {hora}. Motivo: {motivo}. Confirma tu asistencia otra vez. |
| `session.cancelled` | Se canceló: {título} | Motivo: {motivo}. Tu mentor coordinará una nueva fecha. |
| `deliverable.submitted` | Nueva entrega por revisar | {Participante} envió "{consigna}". |
| `deliverable.evaluated` | Tienes retroalimentación | Tu mentora evaluó "{consigna}". |
| `deliverable.returned` | Tu mentora pide ajustes | Revisa la retroalimentación de "{consigna}" y crea una revisión nueva cuando estés listo. |
| Consigna nueva | Nueva consigna de la Semana {n} | "{Título}". Entrega hasta el {fecha}. |
| Solicitud recibida | {Nombre} pide mover una sesión | "{Motivo}". Decide en la plataforma. |
| Solicitud aprobada | Se movió tu sesión | "{Título}" ahora es el {fecha} a las {hora}. Confirma tu asistencia otra vez. |
| Solicitud rechazada | Tu solicitud no fue aprobada | La sesión sigue el {fecha}. Motivo: {motivo}. |
| Cuenta creada | Tu acceso a EDU-MENTOR está listo | Ingresa con {correo} y la contraseña temporal que te dio tu coordinación. Deberás cambiarla al entrar. |

**Reglas:** una notificación = un evento = una acción. Nunca se agrupan eventos distintos. Toda notificación lleva enlace directo a la pantalla correspondiente. Los recordatorios son idempotentes (DEC-014): si el job reintenta, la persona no recibe el mensaje dos veces.

## 7. Etiquetas recurrentes

| Concepto | Etiqueta | Nunca |
|---|---|---|
| `DECLINED` | No asistiré / No asistirá | "Rechazada", "Cancelada" |
| `scanStatus: PENDING` | Analizando | "Procesando", "En cola" |
| `scanStatus: REJECTED` | Bloqueado | "Virus", "Infectado" |
| Revisión de entregable | Revisión 1, 2, 3… | "Versión", "Intento" |
| `start-review` | Tomar y evaluar | "Abrir" |
| Contraseña temporal | Contraseña temporal | "Provisional", "Genérica" |
| `traceId` | Código de soporte | "Trace", "ID de error" |
| Sesión 1:1 | Mentoría 1:1 | "One-on-one", "individual" |
| Sesión grupal | Sesión grupal | "Taller" como tipo (sí como título) |
| Checkpoint | Checkpoint | "Hito", "revisión de fase" |
| Entregable | Entregable / Tu entrega | "Deliverable", "tarea" |
| Consigna | Consigna | "Assignment", "actividad" |
| Retroalimentación | Retroalimentación / feedback | "Corrección", "nota" |
| Oleada | Oleada | "Cohorte", "batch", "tenant" |
| Mentor de Fase 1 | Mentor especialista | "Mentor senior" |
| Puntaje | Puntaje (0–100) | Estrellas, "calificación sobre 5" |
| Participante | Participante | "Alumno", "beneficiario", "usuario" |

## 8. Pendientes

- Validar el tuteo y el término "participante" con Comunicaciones (son dueños del tono de marca).
- Cerrar DEC-020 para escribir las plantillas del canal real.
- Traducir el copy de errores a mensajes que el backend pueda devolver en `message`, o decidir que el frontend los redacta a partir de `code`. **Recomiendo lo segundo**: el backend devuelve `code` estable y la UI redacta, así el texto se puede mejorar sin tocar la API.
