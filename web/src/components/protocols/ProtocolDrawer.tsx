import { useEffect, useMemo, useState } from 'react';
import { useSession } from '../../context/SessionContext';
import { useProtocolDetail } from '../../hooks/useProtocols';
import { ApiError } from '../../services/httpClient';
import type { Grant, Platform } from '../../services/types';
import { titleCase } from '../../utils/format';
import { GrantAccessForm } from '../access/GrantAccessForm';
import { GrantList } from '../access/GrantList';
import { RevokeDialog } from '../access/RevokeDialog';
import { personPath } from '../layout/pages';
import { Card, CardHeader } from '../ui/Card';
import { Drawer } from '../ui/Drawer';
import { EmptyState, ErrorState, LoadingState } from '../ui/States';
import { LateBadge, RegistrationBadge, RequestTypeBadge, StateBadge } from './ProtocolBadges';
import { ProtocolInfo } from './ProtocolInfo';
import { ProtocolTrackingPanel } from './ProtocolTrackingPanel';

/**
 * Atender um protocolo: o que o Voalle diz e o formulário para registrar a
 * inclusão — na árvore dele, o que a pessoa já tem vem marcado e travado. Na
 * exclusão (ou para quem só lê) aparece a lista dos acessos atuais da pessoa.
 */
export function ProtocolDrawer({ protocolNumber, platforms, onClose }: {
  protocolNumber: string | null;
  platforms: Platform[];
  onClose: () => void;
}) {
  const { canEdit } = useSession();
  const detail = useProtocolDetail(protocolNumber);
  const protocol = detail.data?.protocol;
  const [formPlatform, setFormPlatform] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<Grant | null>(null);

  useEffect(() => setFormPlatform(protocol?.platformSlug ?? null), [protocol?.protocolNumber, protocol?.platformSlug]);

  const suggestedIds = useMemo(() => new Set((detail.data?.suggestions ?? []).map((s) => s.resourceId)), [detail.data]);
  const ownedIds = useMemo(() => new Set((detail.data?.personGrants ?? []).map((g) => g.resourceId)), [detail.data]);
  const preselected = useMemo(() => {
    const best = detail.data?.suggestions[0];
    return best && best.score >= 0.6 && !ownedIds.has(best.resourceId) && formPlatform === protocol?.platformSlug ? [best.resourceId] : [];
  }, [detail.data, ownedIds, formPlatform, protocol?.platformSlug]);

  const title = protocol ? `Protocolo ${protocol.protocolNumber}` : `Protocolo ${protocolNumber ?? ''}`;
  const sameAsRequester = protocol?.targetEmail && protocol.targetEmail === protocol.requesterEmail;
  const showForm = protocol?.requestType !== 'EXCLUSION' && canEdit;

  return (
    <Drawer
      open={protocolNumber !== null}
      onClose={onClose}
      title={title}
      width="max-w-3xl"
      subtitle={protocol && (
        <div className="mt-1 flex flex-wrap gap-1">
          <StateBadge protocol={protocol} />
          <RequestTypeBadge protocol={protocol} />
          <LateBadge protocol={protocol} />
          <RegistrationBadge protocol={protocol} />
        </div>
      )}
    >
      {detail.isLoading && <LoadingState />}
      {detail.isError && <ErrorState message={detail.error instanceof ApiError ? detail.error.message : 'Não foi possível abrir o protocolo.'} />}
      {protocol && detail.data && (
        <div className="grid grid-cols-1 gap-4">
          <ProtocolInfo protocol={protocol} />
          <ProtocolTrackingPanel protocol={protocol} platforms={platforms} />

          {detail.data.linkedGrants.length > 0 && (
            <Card>
              <CardHeader title="Registrado com este protocolo" subtitle="Acessos concedidos ou removidos citando este número." />
              <div className="px-4 sm:px-5"><GrantList grants={detail.data.linkedGrants} mode="resources" canEdit={false} /></div>
            </Card>
          )}

          {showForm && (
            <Card>
              <CardHeader title="Registrar acesso liberado" subtitle="Libere na ferramenta e registre aqui — vai para o log com o número do protocolo." />
              <div className="p-4 sm:p-5">
                <GrantAccessForm
                  key={protocol.protocolNumber}
                  platforms={platforms}
                  platformSlug={formPlatform}
                  onPlatformChange={setFormPlatform}
                  defaults={{
                    email: protocol.targetEmail ?? '',
                    name: sameAsRequester ? titleCase(protocol.requesterName) : '',
                    protocolNumber: protocol.protocolNumber,
                    resourceIds: preselected,
                  }}
                  suggestedIds={formPlatform === protocol.platformSlug ? suggestedIds : undefined}
                />
              </div>
            </Card>
          )}
          {!canEdit && (
            <EmptyState title="Somente leitura" description="Seu papel na equipe é de leitura — peça a permissão de Edição para registrar acessos." />
          )}

          {/* na inclusão o que a pessoa já tem aparece marcado e travado na árvore do formulário */}
          {!showForm && (
            <Card>
              <CardHeader
                title={protocol.requestType === 'EXCLUSION' ? 'Escolha o que remover' : 'Acessos atuais da pessoa'}
                subtitle={detail.data.person
                  ? `${detail.data.person.email} · nesta plataforma`
                  : `${protocol.targetEmail ?? 'Pessoa'} ainda não tem nenhum acesso registrado aqui.`}
              />
              <div className="px-4 sm:px-5">
                {detail.data.personGrants.length ? (
                  <GrantList
                    grants={detail.data.personGrants}
                    mode="resources"
                    canEdit={canEdit}
                    onRevoke={setRevoking}
                    personHref={personPath}
                  />
                ) : (
                  <p className="py-3 text-sm text-on-surface-variant">Nenhum acesso ativo.</p>
                )}
              </div>
            </Card>
          )}
        </div>
      )}
      <RevokeDialog grant={revoking} defaultProtocol={protocol?.protocolNumber} onClose={() => setRevoking(null)} />
    </Drawer>
  );
}
