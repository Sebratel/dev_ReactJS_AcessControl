import { useEffect, useState } from 'react';
import type { Person } from '../../services/types';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { PersonFields, toPersonForm, useSavePerson } from './PersonFields';

/** Dados da pessoa (o e-mail é a identidade e não muda). */
export function PersonEditDialog({ person, open, onClose }: { person: Person; open: boolean; onClose: () => void }) {
  const { save, isSaving } = useSavePerson();
  const [form, setForm] = useState(() => toPersonForm(person));

  useEffect(() => {
    if (open) setForm(toPersonForm(person));
  }, [open, person]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Editar pessoa"
      description={person.email}
      footer={(
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={async () => { if (await save(person, form)) onClose(); }} loading={isSaving}>Salvar</Button>
        </>
      )}
    >
      <PersonFields value={form} onChange={setForm} />
    </Dialog>
  );
}
