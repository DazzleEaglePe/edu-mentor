import { AppShell } from '@/components/shell/app-shell';
import { Button } from '@/components/ui/button';
import { Card, Metric } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { loadAdminUsers, loadAuthMe } from '@/lib/api/fixtures';
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
 * aparecen. La pertenencia a una oleada vive en `Enrollment`, que es otro
 * recurso y merece su propia pantalla (A7).
 *
 * Lo que sí aporta valor operativo es `mustChangePassword`: durante la primera
 * semana del piloto distingue a quien todavía no logró entrar de quien ya está
 * operando, y es lo que ordena la lista.
 */
export default async function AdminUsuariosPage() {
  const [me, page] = await Promise.all([loadAuthMe(), loadAdminUsers()]);
  const users = sortByAttention(page.data);
  const pending = pendingFirstAccess(page.data);

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
        <div className="overflow-x-auto rounded-[var(--edu-radius-md)] border border-[var(--edu-border)]">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Usuarios de la organización, ordenados por atención requerida
            </caption>
            <thead>
              <tr className="bg-[var(--edu-surface-sunken)] text-left">
                <th scope="col" className="px-3 py-2 font-semibold">
                  Nombre
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Correo
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Roles
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Estado
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const state = accountState(user);
                const described = describeAccountState(state);

                return (
                  <tr key={user.id} className="border-t border-[var(--edu-border)] align-top">
                    <td className="px-3 py-2 font-medium">{user.fullName}</td>
                    <td className="px-3 py-2 text-[var(--edu-text-secondary)]">{user.email}</td>
                    <td className="px-3 py-2">{describeRoles(user.roles)}</td>
                    <td className="px-3 py-2">
                      <span className="font-medium">{described.label}</span>
                      <span className="block text-xs text-[var(--edu-text-secondary)]">
                        {described.hint}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        id={`reset-access-${user.id}`}
                        variant="ghost"
                        disabled
                        disabledReason="Disponible cuando activemos el portal."
                      >
                        Restablecer acceso
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-[var(--edu-text-secondary)]">
        Mostrando {users.length} de {page.meta.total}.
        {page.meta.hasNextPage ? ' Hay más resultados.' : ''}
      </p>
    </AppShell>
  );
}
