# 00 · Project Charter — EDU-MENTOR

## 1. Problema

EDU-MENTOR necesita una columna digital para coordinar sesiones, evidencias y seguimiento del programa. Hoy el riesgo operativo está en agendas dispersas, confirmaciones manuales, entregables sin trazabilidad y dificultad para observar el recorrido de cada participante.

## 2. Resultado del piloto

Una plataforma usable por una primera oleada sectorial que permita:

- planificar sesiones grupales, 1:1 y checkpoints;
- invitar y confirmar participantes;
- reprogramar/cancelar con trazabilidad;
- emitir recordatorios;
- publicar consignas;
- cargar y versionar entregables;
- evaluar con feedback estructurado;
- supervisar el avance mediante roles y ownership.

## 3. Usuarios

| Actor | Necesidad principal |
|---|---|
| Participante | Saber qué sigue, asistir, entregar y recibir feedback |
| Mentor especialista | Gestionar agenda y evaluar evidencias |
| Admin/Proyectos | Configurar oleada y supervisar cumplimiento |
| Mentor par | Futuro: acompañamiento de Fase 2 |
| Psicólogo voluntario | Futuro: citas opt-in transversales |

## 4. Alcance MVP

### Habilitadores obligatorios

- autenticación y sesiones seguras;
- usuarios, roles y perfiles;
- oleadas, enrollments y asignaciones mentor-participante;
- autorización por rol y ownership;
- auditoría mínima.

### Módulo Agenda

- crear, consultar, confirmar, completar, cancelar y reprogramar;
- sesiones grupales, 1:1 y checkpoints;
- protección contra doble reserva;
- solicitudes de reprogramación del participante;
- recordatorios idempotentes;
- calendario filtrado por rol.

### Módulo Entregables

- consignas;
- borrador, carga de archivos y envío;
- revisiones/versiones preservadas;
- cola de evaluación;
- feedback, devolución y reenvío;
- selección top 3 con reglas explícitas.

### Shell de experiencia

- login;
- navegación por rol;
- dashboard mínimo;
- estados loading, empty, error y forbidden;
- accesibilidad objetivo WCAG 2.2 AA.

## 5. Fuera de alcance del piloto

- postulación, entrevistas y scoring de Fase 0;
- Job Search Tracking de Fase 2;
- emparejamiento operativo de mentor par;
- Demo Day completo;
- certificados;
- módulo IA de CV/LinkedIn;
- gestión de citas psicológicas;
- portal público completo, salvo que Proyectos lo priorice explícitamente.

Las entidades futuras pueden mapearse, pero no se construyen endpoints, workers ni UI funcional.

## 6. Supuestos del piloto

- una organización: EDU-US;
- una oleada activa;
- 15–20 participantes más mentores/admin;
- zona horaria `America/Lima`;
- archivos en storage abstraído;
- canales de notificación por confirmar;
- reuniones mediante URL provista, salvo integración aprobada.

## 7. Métricas propuestas

Estas metas requieren validación con Proyectos:

| Métrica | Propuesta inicial |
|---|---|
| Sesiones visibles para usuarios autorizados | 100% |
| Recordatorios procesados con trazabilidad | 100% |
| Doble reserva de mentor/participante | 0 |
| Entregables con historial preservado | 100% |
| Evaluaciones asociadas al mentor autorizado | 100% |
| Acceso cross-user/cross-oleada no autorizado | 0 |
| Errores críticos sin registro/auditoría | 0 |

## 8. Definition of MVP

El MVP está terminado cuando:

1. los dos flujos principales funcionan end-to-end;
2. roles y ownership tienen pruebas negativas;
3. Agenda resiste concurrencia y reintentos;
4. Entregables conserva revisiones y archivos;
5. notificaciones son reintentables e idempotentes;
6. admin puede configurar el contexto mínimo sin intervención en BD;
7. backup/restore y runbook fueron probados;
8. Proyectos ejecuta UAT y acepta el piloto.

