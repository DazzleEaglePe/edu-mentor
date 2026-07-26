import { AppShell } from '@/components/shell/app-shell';
import { Button } from '@/components/ui/button';
import { Card, Metric } from '@/components/ui/card';
import { ResponsiveTable, type TableRow } from '@/components/ui/responsive-table';
import { EmptyState } from '@/components/ui/states';
import { loadAdminAuthMe, loadAdminUsers } from '@/lib/api/fixtures';
import {
  accountState,
  describeAccountState,
  describeRoles,
  pendingFirstAccess,
  sortByAttention,
} from '@/lib/domain/users';

/**
 * A5 · Usuarios y roles.
 *
 * `AdminUser` tiene siete campos y ninguno es "último acceso" ni "oleada".
 * El wireframe original mostraba ambas columnas; eran invención mía y aquí no
 * aparecen. La pertenencia a una oleada vive en `Enrollment` (A7).
 *
 * Lo que sí aporta valor operativo es `mustChangePassword`: durante la primera
 * semana del piloto distingue a quien todavía no logró entrar de quien ya está
 * operando, y es lo que ordena la lista.
 */
export default async function AdminUsuariosPage() {
  const [me, page] = await Promise.all([loadAdminAuthMe(), loadAdminUsers()]);
  const users = sortByAttention(page.data);
  const pending = pendingFirstAccess(page.data);

  const rows: readonly TableRow[] = users.map((user) => {
    const described = describeAccountState(accountState(user));

    return {
      key: user.id,
      cells: [
        <span key="name" className="font-medium">
          {user.fullName}
        </span>,
        <span key="email" className="break-all text-[var(--edu-text-secondary)]">
          {user.email}
        </span>,
        describeRoles(user.roles),
        <span key="state">
          <span className="font-medium">{described.label}</span>
          <span className="block text-xs text-[var(--edu-text-secondary)]">{described.hint}</span>
        </span>,
        <Button
          key="action"
          id={`reset-access-${user.id}`}
          variant="ghost"
          disabled
          disabledReason="Disponible cuando activemos el portal."
        >
          Restablecer acceso
        </Button>,
      ],
    };
  });

  return (
    <AppShell
      me={me}
      currentPath="/admin/usuarios"
      aside={
        <Card variant="quiet" title="Sobre desactivar">
          <p className="text-sm text-[var(--edu-text-secondary)]">
            Desactivar no borra. La persona conserva sus sesiones, entregas y evaluaciones, porque
            la trazabilidad del programa depende de ese historial.
          </p>
        </Card>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>
        <Button id="create-user" disabled disabledReason="Disponible cuando activemos el portal.">
          Agregar usuario
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Metric value={`${page.meta.total}`} label="Usuarios en la organización" />
        <Metric value={`${pending}`} label="Sin entrar todavía" />
      </div>

      {users.length === 0 ? (
        <EmptyState
          title="Todavía no hay usuarios"
          body="Empieza cargando a los participantes y mentores de la oleada."
        />
      ) : (
        <ResponsiveTable
          caption="Usuarios de la organización, ordenados por atención requerida"
          headers={['Nombre', 'Correo', 'Roles', 'Estado', '']}
          rows={rows}
        />
      )}

      <p className="text-xs text-[var(--edu-text-secondary)]">
        Mostrando {users.length} de {page.meta.total}.
        {page.meta.hasNextPage ? ' Hay más resultados.' : ''}
      </p>
    </AppShell>
  );
}
