import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LOG_PATH } from '../../components/layout/pages';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { ErrorState, LoadingState } from '../../components/ui/States';
import { useSession } from '../../context/SessionContext';
import { useAppUsers } from '../../hooks/useAccessQueries';
import { ApiError } from '../../services/httpClient';
import type { AppUser, TeamRole } from '../../services/types';
import { updateUserRole, userKeys } from '../../services/usersService';
import { formatDate, formatDateTime, timeAgo } from '../../utils/format';
import { ROLE_EFFECT, ROLE_LABEL, ROLE_ORDER } from '../../utils/labels';

function RoleSelector({ user, disabled, onChange }: { user: AppUser; disabled: boolean; onChange: (role: TeamRole) => void }) {
  return (
    <span className="alternador papel-seletor" role="radiogroup" aria-label={`Permissão de ${user.name}`}>
      {ROLE_ORDER.map((role) => (
        <button
          key={role}
          type="button"
          role="radio"
          aria-checked={user.role === role}
          className={`${user.role === role ? 'on' : ''} papel-${role.toLowerCase()}`}
          disabled={disabled}
          onClick={() => { if (role !== user.role) onChange(role); }}
        >
          {ROLE_LABEL[role]}
        </button>
      ))}
    </span>
  );
}

/**
 * ADMINISTRAÇÃO — só administradores (mesmo desenho da logisticDashboard):
 * quem já entrou na aplicação, quem está online agora e a permissão de cada um.
 * Quem entra pela primeira vez é "Padrão"; as trocas de permissão vão para o log.
 */
export default function AdminPage() {
  const { user: me, isAdmin, config } = useSession();
  const users = useAppUsers(isAdmin);
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<{ user: AppUser; role: TeamRole } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const updateRole = useMutation({
    mutationFn: ({ email, role }: { email: string; role: TeamRole }) => updateUserRole(email, role),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: userKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['access-events'] }),
    ]),
  });

  if (!isAdmin) {
    return <main className="page sem-filtros"><div className="banner error">Esta tela é só para administradores.</div></main>;
  }

  const list = users.data?.data ?? [];
  const count = (role: TeamRole) => list.filter((u) => u.role === role).length;

  const confirm = async () => {
    if (!pending) return;
    try {
      await updateRole.mutateAsync({ email: pending.user.email, role: pending.role });
      setPending(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível alterar a permissão.');
      setPending(null);
    }
  };

  return (
    <main className="page sem-filtros">
      {!config?.enabled && (
        <div className="banner">Login desligado neste ambiente: ninguém entra pelo Google, então a lista abaixo não muda.</div>
      )}
      <div className="admin-resumo">
        <div className="admin-numero"><b>{list.length}</b><span>usuários</span></div>
        <div className="admin-numero online"><b>{users.data?.meta.online ?? 0}</b><span>online agora</span></div>
        <div className="admin-numero"><b>{count('ADMIN')}</b><span>{ROLE_LABEL.ADMIN}</span></div>
        <div className="admin-numero"><b>{count('EDITOR')}</b><span>{ROLE_LABEL.EDITOR}</span></div>
        <div className="admin-numero"><b>{count('VIEWER')}</b><span>{ROLE_LABEL.VIEWER}</span></div>
      </div>
      {error && <ErrorState message={error} />}

      <section className="visual v-auto">
        <header>
          <span className="titulo">Usuários e permissões</span>
          <span className="sub">
            Quem entra pela primeira vez fica como {ROLE_LABEL.VIEWER} (consulta). As trocas ficam no <Link to={LOG_PATH} className="text-white underline">log</Link>.
          </span>
        </header>
        <div className="body flush">
          {users.isLoading && <LoadingState />}
          {users.isError && <div className="p-3"><ErrorState message="Não foi possível carregar os usuários." /></div>}
          {users.data && (
            <div className="tbl-wrap">
              <table className="pbi">
                <thead>
                  <tr>
                    <th>STATUS</th>
                    <th className="left">NOME</th>
                    <th className="left">E-MAIL</th>
                    <th>ÚLTIMO LOGIN</th>
                    <th>ÚLTIMO ACESSO</th>
                    <th>PRIMEIRO ACESSO</th>
                    <th>PERMISSÃO</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((u) => (
                    <tr key={u.email}>
                      <td className="center"><span className={`status-usuario${u.online ? ' on' : ''}`}><i />{u.online ? 'Online' : 'Offline'}</span></td>
                      <td className="left">{u.name}{u.email === me?.email && <span className="apagado"> (você)</span>}</td>
                      <td className="left">{u.email}</td>
                      <td className="center">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '—'}</td>
                      <td className="center" title={formatDateTime(u.lastSeenAt)}>{u.online ? 'agora' : timeAgo(u.lastSeenAt)}</td>
                      <td className="center">{formatDate(u.firstSeenAt)}</td>
                      <td className="center">
                        <RoleSelector user={u} disabled={updateRole.isPending} onChange={(role) => { setError(null); setPending({ user: u, role }); }} />
                      </td>
                    </tr>
                  ))}
                  {list.length === 0 && (
                    <tr><td colSpan={7} className="center apagado">Ninguém entrou ainda.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <Dialog
        open={pending !== null}
        onClose={() => setPending(null)}
        title="Alterar permissão"
        description={pending && (
          <>
            <b>{pending.user.name}</b> ({pending.user.email}) passa de <b>{ROLE_LABEL[pending.user.role]}</b> para{' '}
            <b>{ROLE_LABEL[pending.role]}</b>. {ROLE_EFFECT[pending.role]}
          </>
        )}
        footer={(
          <>
            <Button onClick={() => setPending(null)}>Cancelar</Button>
            <Button variant="primary" onClick={confirm} loading={updateRole.isPending}>Confirmar</Button>
          </>
        )}
      />
    </main>
  );
}
