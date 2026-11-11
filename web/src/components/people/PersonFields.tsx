import { useToast } from '../../context/ToastContext';
import { useUpdatePerson } from '../../hooks/useAccessMutations';
import { ApiError } from '../../services/httpClient';
import type { Person } from '../../services/types';
import { Checkbox, Field, Input, Textarea } from '../ui/Field';

/** Dados de cadastro da pessoa (o e-mail é a identidade e não muda). */
export interface PersonFormValues {
  name: string;
  department: string;
  notes: string;
  isActive: boolean;
}

export const toPersonForm = (person: Person): PersonFormValues => ({
  name: person.name,
  department: person.department,
  notes: person.notes,
  isActive: person.isActive,
});

/** Campos do cadastro — usados no painel lateral da lista e no diálogo da página da pessoa. */
export function PersonFields({ value, onChange, disabled }: {
  value: PersonFormValues;
  onChange: (next: PersonFormValues) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-3">
      <Field label="Nome">
        {(id) => <Input id={id} value={value.name} maxLength={200} disabled={disabled} onChange={(e) => onChange({ ...value, name: e.target.value })} />}
      </Field>
      <Field label="Área / equipe">
        {(id) => <Input id={id} value={value.department} maxLength={200} disabled={disabled} onChange={(e) => onChange({ ...value, department: e.target.value })} />}
      </Field>
      <Field label="Observações">
        {(id) => <Textarea id={id} rows={3} value={value.notes} maxLength={1000} disabled={disabled} onChange={(e) => onChange({ ...value, notes: e.target.value })} />}
      </Field>
      <Checkbox
        label="Pessoa ativa"
        description="Desmarque para quem saiu da empresa (os acessos continuam até serem removidos)."
        checked={value.isActive}
        disabled={disabled}
        onChange={(e) => onChange({ ...value, isActive: e.target.checked })}
      />
    </div>
  );
}

/** Salva o cadastro e avisa; devolve true quando deu certo. */
export function useSavePerson() {
  const { notify } = useToast();
  const update = useUpdatePerson();
  const save = async (person: Person, form: PersonFormValues): Promise<boolean> => {
    try {
      await update.mutateAsync({
        id: person.id,
        changes: { ...form, name: form.name.trim(), department: form.department.trim(), notes: form.notes.trim() },
      });
      notify({ tone: 'success', title: 'Cadastro atualizado', description: person.email });
      return true;
    } catch (err) {
      notify({ tone: 'error', title: 'Não foi possível salvar', description: err instanceof ApiError ? err.message : undefined });
      return false;
    }
  };
  return { save, isSaving: update.isPending };
}
