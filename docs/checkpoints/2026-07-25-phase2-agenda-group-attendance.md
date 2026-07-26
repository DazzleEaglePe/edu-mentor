# Checkpoint · Fase 2 Agenda grupal, checkpoint y asistencia

Fecha: 2026-07-25  
Rama: `agent/phase2-agenda-sessions`  
Estado: implementación lista; integración PostgreSQL pendiente de confirmación en CI.

## Alcance

1. creación `GROUP` usando el agregado transaccional ya publicado;
2. ocho participantes con confirmaciones independientes;
3. fixture `confirmationSummary = 5 confirmed / 1 declined / 2 pending`;
4. creación `CHECKPOINT` de Fase 2;
5. exclusividad `weekNumber`/`checkpointMonth`;
6. `PUT /sessions/{sessionId}/participants/{enrollmentId}/attendance`;
7. ownership mentor de la sesión o Admin de la organización;
8. rechazo antes de `startsAt`;
9. `expectedVersion` sobre `SessionParticipant`;
10. primera asistencia terminal para mentor;
11. corrección administrativa auditable;
12. auditoría y outbox solo cuando cambia el estado.

## Evidencia local

```text
unit_tests=61 passed
api_typecheck=passed
openapi_lint=passed
postgres_integration=not_run_no_local_docker
```

La indisponibilidad local de Docker se registra como límite de infraestructura. La misma prueba se
ejecuta en el job `data-runtime` de GitHub Actions.

## Códigos estables añadidos

| Código | Significado |
|---|---|
| `SESSION_NOT_STARTED` | aún no corresponde registrar asistencia |
| `SESSION_NOT_ATTENDABLE` | sesión cancelada o reprogramada |
| `ATTENDANCE_ALREADY_RECORDED` | mentor intenta modificar una marca terminal |
| `VERSION_CONFLICT` | la fila participante cambió desde que la UI la leyó |

## Handoff a frontend

Claude puede consumir `docs/api/fixtures/session.group.json` para M2/M3/M4. El resumen esperado es:

```text
5 confirmaron · 1 no asistirá · 2 sin responder
```

La UI no debe deducir este resumen desde la página actual ni activar una mutación sin transporte
CSRF real. `confirmationSummary`, `canConfirm`, `confirmationClosesAt`, `timezone` y los errores
tipados son la autoridad.
