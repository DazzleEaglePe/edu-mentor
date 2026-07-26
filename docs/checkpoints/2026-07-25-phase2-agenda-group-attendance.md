# Checkpoint · Fase 2 Agenda grupal, checkpoint y asistencia

Fecha: 2026-07-25  
Rama: `agent/phase2-agenda-sessions`  
Estado: vertical 2B verificada en PostgreSQL y Redis reales.

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

## Evidencia

```text
unit_tests=61 passed
api_typecheck=passed
openapi_lint=passed
quality_job=passed_in_48s
data_runtime_job=passed_in_1m29s
seed_integrations=14_passed
group_confirmations=5_confirmed_1_declined_2_pending
group_checkpoint_workflow=passed
terminal_attendance_workflow=passed
pr_mergeable=MERGEABLE
```

[GitHub Actions run 30183924599](https://github.com/DazzleEaglePe/edu-mentor/actions/runs/30183924599)

El primer run detectó que las identidades adicionales agotaban el límite de IP compartido entre
archivos de integración. No se debilitó la protección: el suite nuevo aísla el namespace temporal
`auth:login:*` antes y después de ejecutarse. El segundo run verificó que el flujo grupal, las
lecturas y la vertical 1:1 conviven sin `429`.

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
