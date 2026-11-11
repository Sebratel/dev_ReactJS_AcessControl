import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldPlus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { useToast } from '../../context/ToastContext';
import { useGrantAccess } from '../../hooks/useAccessMutations';
import { useGrants } from '../../hooks/useAccessQueries';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { usePlatformResources } from '../../hooks/usePlatforms';
import { ApiError } from '../../services/httpClient';
import type { Platform } from '../../services/types';
import { pluralize } from '../../utils/format';
import { personPath } from '../layout/pages';
import { Button } from '../ui/Button';
import { Checkbox, Field, Input, Select, Textarea } from '../ui/Field';
import { ErrorState, LoadingState } from '../ui/States';
import { ResourcePicker } from './ResourcePicker';

const schema = z.object({
  email: z.string().trim().toLowerCase().email('Informe um e-mail válido'),
  name: z.string().trim().max(200),
  accessLevel: z.string().trim().max(100),
  protocolNumber: z.string().trim().regex(/^\d{0,20}$/, 'Só números'),
  notes: z.string().trim().max(1000),
  includeAncestors: z.boolean(),
});
type FormValues = z.infer<typeof schema>;
const isEmail = (value: string): boolean => z.string().email().safeParse(value).success;

export interface GrantFormDefaults {
  email?: string;
  name?: string;
  protocolNumber?: string;
  resourceIds?: number[];
}

/**
 * Conceder acesso: pessoa (e-mail é a identidade em todos os hubs) + recursos
 * da árvore. Por padrão os níveis acima entram junto (aba sem dashboard não
 * serve para nada). O que a pessoa do e-mail já tem — em qualquer plataforma —
 * aparece marcado e travado na árvore, então não dá para conceder de novo.
 */
export function GrantAccessForm({ platforms, platformSlug, onPlatformChange, defaults, suggestedIds, onDone }: {
  platforms: Platform[];
  platformSlug: string | null;
  /** quando informado, a pessoa pode trocar a plataforma (tela de protocolo) */
  onPlatformChange?: (slug: string) => void;
  defaults?: GrantFormDefaults;
  suggestedIds?: Set<number>;
  onDone?: () => void;
}) {
  const { notify } = useToast();
  const grant = useGrantAccess();
  const resources = usePlatformResources(platformSlug);
  const [selected, setSelected] = useState<Set<number>>(new Set(defaults?.resourceIds ?? []));
  const [pickError, setPickError] = useState<string | null>(null);
  const defaultIdsKey = (defaults?.resourceIds ?? []).join(',');

  useEffect(() => {
    setSelected(new Set(defaults?.resourceIds ?? []));
  }, [platformSlug, defaultIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: defaults?.email ?? '',
      name: defaults?.name ?? '',
      accessLevel: '',
      protocolNumber: defaults?.protocolNumber ?? '',
      notes: '',
      includeAncestors: true,
    },
  });

  const nodes = useMemo(() => resources.data ?? [], [resources.data]);

  // acessos ativos de quem recebe (todas as plataformas), relidos quando o e-mail muda
  const typedEmail = useDebouncedValue((watch('email') ?? '').trim().toLowerCase(), 400);
  const ownerEmail = isEmail(typedEmail) ? typedEmail : '';
  const current = useGrants({ email: ownerEmail, status: 'ACTIVE' }, ownerEmail !== '');
  const ownerGrants = useMemo(() => (ownerEmail ? current.data ?? [] : []), [ownerEmail, current.data]);
  const ownedIds = useMemo(() => new Set(ownerGrants.map((g) => g.resourceId)), [ownerGrants]);
  const ownedHere = useMemo(() => nodes.filter((n) => ownedIds.has(n.id)).length, [nodes, ownedIds]);
  const toGrant = useMemo(() => [...selected].filter((id) => !ownedIds.has(id)), [selected, ownedIds]);

  const onSubmit = handleSubmit(async (values) => {
    if (!toGrant.length) {
      setPickError(ownedHere ? 'Escolha um item que a pessoa ainda não tenha.' : 'Escolha ao menos um item da árvore.');
      return;
    }
    setPickError(null);
    try {
      const result = await grant.mutateAsync({
        email: values.email,
        name: values.name || undefined,
        resourceIds: toGrant,
        includeAncestors: values.includeAncestors,
        accessLevel: values.accessLevel,
        protocolNumber: values.protocolNumber || null,
        notes: values.notes,
      });
      notify({
        tone: 'success',
        title: result.created.length ? `${pluralize(result.created.length, 'acesso registrado', 'acessos registrados')}` : 'Nada novo para registrar',
        description: result.alreadyActive.length ? `${pluralize(result.alreadyActive.length, 'item já estava', 'itens já estavam')} concedido(s).` : values.email,
      });
      reset({ ...values, notes: '', accessLevel: '' });
      setSelected(new Set());
      onDone?.();
    } catch (err) {
      notify({ tone: 'error', title: 'Não foi possível registrar', description: err instanceof ApiError ? err.message : 'Tente novamente.' });
    }
  });

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4" noValidate>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="E-mail de quem recebe" error={errors.email?.message}>
          {(id) => <Input id={id} type="email" autoComplete="off" placeholder="nome@sebratel.com.br" aria-invalid={Boolean(errors.email)} {...register('email')} />}
        </Field>
        <Field label="Nome (opcional)">
          {(id) => <Input id={id} placeholder="Completa o cadastro da pessoa" {...register('name')} />}
        </Field>
      </div>

      {onPlatformChange && (
        <Field label="Plataforma">
          {(id) => (
            <Select id={id} value={platformSlug ?? ''} onChange={(e) => onPlatformChange(e.target.value)}>
              <option value="" disabled>Escolha a plataforma</option>
              {platforms.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
            </Select>
          )}
        </Field>
      )}

      <div className="grid grid-cols-1 gap-1.5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">O que liberar</p>
        {!platformSlug ? (
          <p className="text-sm text-on-surface-variant">Escolha a plataforma para ver a árvore.</p>
        ) : resources.isLoading ? (
          <LoadingState label="Carregando a árvore…" className="py-6" />
        ) : resources.isError ? (
          <ErrorState message="Não foi possível carregar a árvore desta plataforma." />
        ) : (
          <ResourcePicker nodes={nodes} selected={selected} onChange={setSelected} suggestedIds={suggestedIds} ownedIds={ownedIds} />
        )}
        {platformSlug && ownedHere > 0 && (
          <p className="text-xs text-on-surface-variant">
            Marcados e travados: {pluralize(ownedHere, 'item que a pessoa já tem', 'itens que a pessoa já tem')} aqui.{' '}
            <Link to={personPath(ownerGrants[0]!.personId)} className="font-semibold text-primary-text hover:underline">
              Ver todos os acessos ({ownerGrants.length})
            </Link>
          </p>
        )}
        {pickError && <p className="text-xs font-medium text-rose-700 dark:text-rose-300" role="alert">{pickError}</p>}
        <Checkbox
          label="Incluir os níveis acima"
          description="Ex.: ao liberar uma aba, registra também o acesso ao dashboard e ao hub."
          {...register('includeAncestors')}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nível / papel (opcional)" hint="Ex.: Visualizador, Editor, Gestor">
          {(id) => <Input id={id} {...register('accessLevel')} />}
        </Field>
        <Field label="Protocolo (opcional)" error={errors.protocolNumber?.message}>
          {(id) => <Input id={id} inputMode="numeric" placeholder="Nº no Voalle" {...register('protocolNumber')} />}
        </Field>
      </div>
      <Field label="Observação (opcional)">
        {(id) => <Textarea id={id} rows={2} {...register('notes')} />}
      </Field>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={grant.isPending} icon={<ShieldPlus size={16} aria-hidden />}>
          Registrar acesso{toGrant.length > 0 ? ` (${toGrant.length})` : ''}
        </Button>
      </div>
    </form>
  );
}
