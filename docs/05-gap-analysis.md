# 05 · Gap Analysis y Registro de Decisiones

Fecha de análisis: 2026-07-25.

Este documento evita que contradicciones del contexto se conviertan en deuda de implementación. La resolución técnica detallada está en `11-contract-decisions.md`; `Pendiente Producto` no significa aprobación de negocio.

## Decisiones P0

| ID | Brecha | Riesgo | Recomendación | Estado |
|---|---|---|---|---|
| DEC-001 | `oleada_id` se llama multi-tenancy | Una cohorte no es una frontera organizacional; puede producir seguridad y terminología incorrectas | Modelar `organization`; Oleada es cohorte, no tenant | Resuelta técnica |
| DEC-002 | `USER.role` admite un solo rol | Una persona puede ser mentor y admin, o mentor especialista y par | Modelar `user_roles` y perfiles/asignaciones de mentor | Resuelta técnica |
| DEC-003 | `mentor_kind` tampoco admite ambos tipos | Contradice el texto “un mismo user puede ser mentor de ambos tipos” | Representar capacidades como relación | Resuelta técnica |
| DEC-004 | Faltan habilitadores administrables | Sin usuarios, oleadas, enrollments y asignaciones no se pueden operar Agenda/Entregables | Incluir soporte administrativo mínimo | Resuelta técnica |
| DEC-005 | Auth no tiene modelo de refresh sessions | Logout/rotación JWT no puede implementarse de forma segura/auditable | `auth_session`, hash, rotación, reuse y revocación | Resuelta técnica |
| DEC-006 | Tokens Bearer vs. portal web no definido | Riesgo de almacenar tokens en `localStorage` y exposición XSS | Cookies seguras + CSRF para web | Resuelta técnica |
| DEC-007 | `SESSION.status=CONFIRMED` duplica confirmación individual | Una sesión grupal puede tener confirmaciones mixtas | Separar lifecycle, confirmación y asistencia | Resuelta técnica |
| DEC-008 | No hay protección contra solapamientos | Mentor o participante puede quedar doblemente reservado | Reservas + transacción + exclusion constraint | Resuelta técnica |
| DEC-009 | Fase/semana/mes solo se valida en service | Imports, jobs o futuras rutas podrían insertar estados imposibles | DTO + service + `CHECK` DB | Resuelta técnica |
| DEC-010 | “Versionar” entregable incrementando un campo no preserva historial | Archivos y feedback anteriores pueden perderse o sobrescribirse | Deliverable lógico + submissions | Resuelta técnica |
| DEC-011 | Una evaluación única por deliverable impide reevaluar reenvíos | No existe historial de feedback | Evaluación por submission | Resuelta técnica |
| DEC-012 | `is_top_candidate` no limita ni ordena el top 3 | Se pueden marcar más de tres y sin ranking | Provisional: rank 1–3 por assignment | Pendiente Producto |
| DEC-013 | UI permite “Solicitar reprogramación”, API no | Claude puede diseñar un flujo sin backend | Recurso `reschedule-requests` | Resuelta técnica |
| DEC-014 | EventEmitter → BullMQ → n8n no define autoridad | Duplicados, recordatorios perdidos y estados divergentes | Outbox autoridad; BullMQ ejecuta; n8n periferia | Resuelta técnica |
| DEC-015 | Prompts incluyen Job Tracking y mentor par | Riesgo de implementar funcionalidad fuera de alcance | Excluir tablas, API y navegación del MVP | Rechazada MVP |
| DEC-016 | IA de CV es futura, pero el objetivo profesional es AI Engineer | Scope creep artificial o promesa de IA inexistente | Track posterior con evals y human review | Diferida |

## Decisiones P1 antes de piloto

| ID | Brecha | Recomendación | Estado |
|---|---|---|---|
| DEC-017 | `ASSIGNMENT` no aparece relacionado con Oleada en el ERD | Corregir relación y foreign keys | Resuelta diseño |
| DEC-018 | Mentor autorizado por oleada/participante no está modelado | Añadir asignaciones explícitas y verificarlas en services | Resuelta diseño |
| DEC-019 | Meeting provider no está definido | Piloto: URL manual; integrar Calendar/Meet solo con decisión y credenciales | Baseline URL manual |
| DEC-020 | Canales EMAIL/WHATSAPP no están priorizados | Elegir canal inicial, proveedor, plantillas y fallback | Propuesta |
| DEC-021 | Upload valida extensión/tipo declarado solamente | Detectar MIME real, nombres seguros, límites, antivirus/quarantine y path traversal | Propuesta |
| DEC-022 | Filesystem del VPS crea riesgo operacional | Abstraer storage, volumen dedicado y backup externo probado | Propuesta |
| DEC-023 | Falta audit log | Auditar auth, agenda, asistencia, entregas, evaluaciones, roles y descargas | Resuelta diseño |
| DEC-024 | No hay política de privacidad/retención | Crear gate legal y operativo para datos personales, archivos y logs | Propuesta |
| DEC-025 | Admin “gestiona usuarios/oleadas” pero API no lo especifica | Definir endpoints mínimos | Resuelta contrato + OpenAPI |
| DEC-026 | PM2 y restart de Docker aparecen como alternativas simultáneas | Usar Docker restart/healthchecks | Resuelta técnica |
| DEC-027 | No hay contrato de errores con `traceId`/código estable | Añadir `code`, `message`, `traceId`, `details` sanitizados | Resuelta contrato |
| DEC-028 | No hay estrategia de concurrencia para submit/evaluate/reschedule | Transacciones, optimistic version, idempotencia y `409` | Resuelta contrato |

## Auditoría de versiones

La matriz seleccionada, fuentes y evidencia están en `13-technology-version-matrix.md`. El registro público consultado el 2026-07-25 mostraba:

| Paquete | Versión detectada |
|---|---|
| Next.js | 16.2.11 |
| React | 19.2.8 |
| NestJS | 11.1.28 |
| Prisma / Client | 7.9.0 |
| TypeScript | 7.0.2 |
| Tailwind CSS | 4.3.3 |
| BullMQ | 5.81.2 |

No se adoptó “latest” automáticamente. El spike eligió Node 24 LTS, pnpm 11.17, TypeScript 6.0.3 y los patches documentados. TypeScript 7 queda como upgrade posterior por su transición de API de tooling.

## Preguntas para Proyectos/EDU-US

1. ¿Landing pública forma parte del piloto implementable o solo del diseño?
2. ¿Quién crea usuarios, oleadas, enrollments y asignaciones?
3. ¿Email, WhatsApp o ambos para el primer piloto?
4. ¿Se integra Google Calendar/Meet o se pegará un enlace manual?
5. ¿Participante puede solicitar reprogramación? ¿Quién aprueba y con qué SLA?
6. ¿Qué criterios y pesos forman la rúbrica 0–100 de cada consigna?
7. ¿Se ratifica que Top 3 sea por assignment, con puestos 1–3?
8. ¿Puede una persona tener más de un rol?
9. ¿Qué archivos reales se permitirán y por cuánto tiempo se conservarán?
10. ¿Quién realizará UAT y dará la aprobación final?
