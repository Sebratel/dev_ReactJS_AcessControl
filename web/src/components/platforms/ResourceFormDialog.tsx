import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useToast } from '../../context/ToastContext';
import { useCreateResource, useUpdateResource } from '../../hooks/useAccessMutations';
import { ApiError } from '../../services/httpClient';
import type { ResourceNode, ResourceType } from '../../services/types';
import { CHILD_TYPES, RESOURCE_TYPE_LABEL } from '../../utils/labels';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Checkbox, Field, Input, Select, Textarea } from '../ui/Field';

const schema = z.object({
  resourceType: z.string().min(1),
  name: z.string().trim().min(1, 'Informe o nome').max(200),
  url: z.string().trim().max(2000).refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), 'Use um link começando com http:// ou https://'),
  description: z.string().trim().max(1000),
  owner: z.string().trim().max(200),
  isAccessControlled: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

export type ResourceDialogState =
  | { mode: 'create'; parent: ResourceNode; defaultType: Exclude<ResourceType, 'PLATFORM'> }
  | { mode: 'edit'; node: ResourceNode }
  | null;

/** Cadastrar (dentro de um nó) ou editar um item da árvore: nome, tipo, link e se tem controle próprio. */
export function ResourceFormDialog({ state, onClose, onSaved }: {
  state: ResourceDialogState;
  onClose: () => void;
  onSaved?: (node: ResourceNode) => void;
}) {
  const { notify } = useToast();
  const create = useCreateResource();
  const update = useUpdateResource();
  const isRoot = state?.mode === 'edit' && state.node.resourceType === 'PLATFORM';
  const parentType: ResourceType = state?.mode === 'create' ? state.parent.resourceType : 'PLATFORM';
  const typeOptions = state?.mode === 'edit' ? Object.keys(RESOURCE_TYPE_LABEL).filter((t) => t !== 'PLATFORM') : CHILD_TYPES[parentType];

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!state) return;
    if (state.mode === 'create') {
      reset({ resourceType: state.defaultType, name: '', url: '', description: '', owner: '', isAccessControlled: true });
    } else {
      const n = state.node;
      reset({ resourceType: n.resourceType, name: n.name, url: n.url ?? '', description: n.description, owner: n.owner, isAccessControlled: n.isAccessControlled });
    }
  }, [state, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (!state) return;
    const payload = {
      name: values.name,
      url: values.url || null,
      description: values.description,
      owner: values.owner,
      isAccessControlled: values.isAccessControlled,
    };
    try {
      const saved = state.mode === 'create'
        ? await create.mutateAsync({ ...payload, parentId: state.parent.id, resourceType: values.resourceType as Exclude<ResourceType, 'PLATFORM'> })
        : await update.mutateAsync({
          id: state.node.id,
          changes: isRoot ? payload : { ...payload, resourceType: values.resourceType as Exclude<ResourceType, 'PLATFORM'> },
        });
      notify({ tone: 'success', title: state.mode === 'create' ? 'Item cadastrado' : 'Alterações salvas', description: saved.name });
      onSaved?.(saved);
      onClose();
    } catch (err) {
      notify({ tone: 'error', title: 'Não foi possível salvar', description: err instanceof ApiError ? err.message : undefined });
    }
  });

  const title = state?.mode === 'create' ? `Adicionar em “${state.parent.name}”` : 'Editar item';

  return (
    <Dialog
      open={state !== null}
      onClose={onClose}
      title={title}
      width="max-w-xl"
      footer={(
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={onSubmit} loading={create.isPending || update.isPending}>Salvar</Button>
        </>
      )}
    >
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3" noValidate>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[11rem_1fr]">
          <Field label="Tipo">
            {(id) => (
              <Select id={id} disabled={isRoot} {...register('resourceType')}>
                {isRoot && <option value="PLATFORM">{RESOURCE_TYPE_LABEL.PLATFORM}</option>}
                {typeOptions.map((t) => <option key={t} value={t}>{RESOURCE_TYPE_LABEL[t as ResourceType]}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Nome" error={errors.name?.message}>
            {(id) => <Input id={id} aria-invalid={Boolean(errors.name)} placeholder="Ex.: Relatórios Analíticos de Atendimento" {...register('name')} />}
          </Field>
        </div>
        <Field label="Link (opcional)" error={errors.url?.message}>
          {(id) => <Input id={id} type="url" placeholder="https://…" aria-invalid={Boolean(errors.url)} {...register('url')} />}
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Responsável / dono (opcional)">
            {(id) => <Input id={id} placeholder="Área ou pessoa" {...register('owner')} />}
          </Field>
          <div className="flex items-end pb-1">
            <Checkbox
              label="Tem controle de acesso próprio"
              description="Desmarque se quem vê o nível acima já vê este."
              {...register('isAccessControlled')}
            />
          </div>
        </div>
        <Field label="Descrição (opcional)">
          {(id) => <Textarea id={id} rows={2} {...register('description')} />}
        </Field>
      </form>
    </Dialog>
  );
}
