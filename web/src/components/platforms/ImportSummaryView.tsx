import type { ReactNode } from 'react';
import type { ImportSummary } from '../../services/types';
import { formatDate } from '../../utils/format';
import { Checkbox } from '../ui/Field';
import { WarningNote } from '../ui/States';
import type { ImporterConfig } from './importers';

function Line({ label, value, tone }: { label: string; value: number; tone?: 'new' | 'warn' }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-[13px]">
      <span className="text-on-surface-variant">{label}</span>
      <span className={tone === 'new' && value ? 'font-bold tabular-nums text-emerald-700 dark:text-emerald-300' : tone === 'warn' && value ? 'font-bold tabular-nums text-amber-700 dark:text-amber-300' : 'font-semibold tabular-nums text-on-surface'}>
        {value}
      </span>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-outline bg-surface-container-low px-3.5 py-2.5">
      <p className="pb-1 text-[10.5px] font-bold uppercase tracking-wider text-on-surface-variant">{title}</p>
      <div className="divide-y divide-outline">{children}</div>
    </div>
  );
}

function NameList({ title, names }: { title: string; names: string[] }) {
  if (!names.length) return null;
  return (
    <details className="rounded-xl border border-outline px-3 py-2 text-[13px]">
      <summary className="cursor-pointer font-semibold text-on-surface">{title} ({names.length})</summary>
      <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-5 text-on-surface-variant">
        {names.map((n) => <li key={n}>{n}</li>)}
      </ul>
    </details>
  );
}

/** Resultado (prévia ou aplicado) de uma importação de export. */
export function ImportSummaryView({ summary, importer, revokeMissing, onRevokeMissingChange }: {
  summary: ImportSummary;
  importer: ImporterConfig;
  revokeMissing: boolean;
  onRevokeMissingChange?: (value: boolean) => void;
}) {
  const { dashboards, people, hubAccess, grants, notInExport } = summary;
  const items = importer.itemsLabel;
  const itemsLower = items.toLowerCase();
  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Block title="Planilha">
          <Line label="Linhas lidas" value={summary.rowsRead} />
          <Line label="Linhas válidas" value={summary.rowsValid} />
          <Line label="Linhas ignoradas" value={summary.ignoredCount} tone="warn" />
        </Block>
        <Block title={items}>
          <Line label="Novos na árvore" value={dashboards.created.length} tone="new" />
          <Line label="Ligados a um cadastrado à mão" value={dashboards.linked.length} tone="new" />
          <Line label="Renomeados na origem" value={dashboards.renamed.length} tone="warn" />
          <Line label="Já existiam" value={dashboards.unchanged} />
        </Block>
        <Block title="Pessoas">
          <Line label="Novas" value={people.created} tone="new" />
          <Line label="Nome completado" value={people.updated} />
          <Line label="Já cadastradas" value={people.unchanged} />
          {people.withoutHubAccount > 0 && <Line label="Sem cadastro na ferramenta (nunca entraram)" value={people.withoutHubAccount} tone="warn" />}
        </Block>
        <Block title="Acessos">
          <Line label={`${importer.rootLabel} — novos`} value={hubAccess.created} tone="new" />
          <Line label="Nível de acesso atualizado" value={hubAccess.updated} tone="warn" />
          <Line label={`Acessos a ${itemsLower} novos`} value={grants.created} tone="new" />
          <Line label="Já registrados" value={grants.unchanged + hubAccess.unchanged} />
        </Block>
      </div>

      <NameList title={`${items} novos`} names={dashboards.created} />
      <NameList title={`Ligados a ${itemsLower} já cadastrados`} names={dashboards.linked} />
      <NameList title="Renomeados" names={dashboards.renamed.map((r) => `${r.from} → ${r.to}`)} />
      <NameList title="Linhas ignoradas" names={summary.ignored.map((i) => `Linha ${i.rowNumber}: ${i.reason}`)} />

      {notInExport.total > 0 && (
        <WarningNote>
          <p>
            <strong>{notInExport.total}</strong> acesso(s) estão registrados aqui mas <strong>não constam no export</strong>
            {summary.applied && notInExport.revoked ? ` — ${notInExport.revoked} removido(s).` : '. Pode ser algo liberado aqui e ainda não aplicado na ferramenta, ou removido lá.'}
          </p>
          <ul className="mt-1.5 max-h-32 list-disc overflow-y-auto pl-5 text-xs">
            {notInExport.sample.map((s) => <li key={`${s.personEmail}-${s.resourceName}`}>{s.personEmail} · {s.resourceName} (desde {formatDate(s.grantedAt)})</li>)}
          </ul>
          {onRevokeMissingChange && (
            <Checkbox
              className="mt-2"
              label="Remover daqui esses acessos (a ferramenta é a fonte da verdade)"
              description={`Cada remoção vai para o log com o motivo “Não consta mais no ${importer.sourceLabel}”.`}
              checked={revokeMissing}
              onChange={(e) => onRevokeMissingChange(e.target.checked)}
            />
          )}
        </WarningNote>
      )}
    </div>
  );
}
