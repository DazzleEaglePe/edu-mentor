import type { ApiComponents } from '@edu-mentor/shared-types';

type Schemas = ApiComponents['schemas'];

export type AdminDashboard = Schemas['AdminDashboard'];

/**
 * El dashboard del admin responde **una sola pregunta**: ¿qué está en riesgo?
 *
 * Por eso los conteos se dividen en dos grupos con propósitos distintos, en vez
 * de una rejilla de once números iguales. Once cifras sin jerarquía obligan a
 * leerlas todas para descubrir cuál importa, que es justo lo contrario de un
 * panel operativo.
 */

export interface RiskItem {
  readonly label: string;
  readonly value: number;
  /** Qué hacer si el número no es cero. */
  readonly hint: string;
}

/**
 * Lo que requiere intervención humana. Se omite lo que está en cero: un panel
 * que anuncia "0 fallidos" entrena a la gente a ignorarlo.
 */
export function risks(dashboard: AdminDashboard): readonly RiskItem[] {
  const items: RiskItem[] = [];

  if (dashboard.failedJobs > 0) {
    items.push({
      label: 'Envíos fallidos',
      value: dashboard.failedJobs,
      hint: 'Alguien debe reintentarlos: nadie recibió esas notificaciones.',
    });
  }

  if (dashboard.pendingReviews > 0) {
    items.push({
      label: 'Entregas sin evaluar',
      value: dashboard.pendingReviews,
      hint: 'Esperan a un mentor.',
    });
  }

  if (dashboard.submissionsSummary.returned > 0) {
    items.push({
      label: 'Entregas devueltas',
      value: dashboard.submissionsSummary.returned,
      hint: 'Esperan a que el participante corrija.',
    });
  }

  if (dashboard.pendingDeliverables > 0) {
    items.push({
      label: 'Entregables pendientes',
      value: dashboard.pendingDeliverables,
      hint: 'Todavía no se han enviado.',
    });
  }

  return items;
}

/**
 * Avance de evaluación sobre el total de entregas.
 *
 * Se calcula sobre `total`, no sobre `evaluated + pending + returned`: si esos
 * tres no suman el total —porque hay borradores— el porcentaje seguiría siendo
 * correcto respecto de lo que de verdad se espera.
 */
export function evaluationProgress(dashboard: AdminDashboard): number {
  const { total, evaluated } = dashboard.submissionsSummary;
  return total === 0 ? 0 : Math.round((evaluated / total) * 100);
}

/**
 * Cuántas entregas no están contempladas en el desglose.
 *
 * Si `evaluated + pending + returned` no llega al total, el resto son
 * borradores u otros estados. Mostrarlo evita que alguien sume tres cifras,
 * vea que no cuadran con el total y desconfíe del panel entero.
 */
export function unaccountedSubmissions(dashboard: AdminDashboard): number {
  const { total, evaluated, pending, returned } = dashboard.submissionsSummary;
  return Math.max(0, total - evaluated - pending - returned);
}
