import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { ApiError } from '../../services/httpClient';
import { importAccessExport } from '../../services/importsService';
import type { ImportSummary, ImportTable } from '../../services/types';
import { parseCsv } from '../../utils/csv';
import { toImportTable, type RawCell } from '../../utils/sheet';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { ErrorState, LoadingState } from '../ui/States';
import type { ImporterConfig } from './importers';
import { ImportSummaryView } from './ImportSummaryView';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPT = '.xlsx,.xlsm,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12';

/** Um arquivo -> tabela: CSV pelo leitor próprio; .xlsx/.xlsm pela biblioteca (só valores, nenhuma macro roda). */
async function readTable(file: File, sheetName?: string): Promise<ImportTable> {
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} é maior que 10 MB.`);
  if (/\.csv$/i.test(file.name) || file.type === 'text/csv') {
    return toImportTable(parseCsv(await file.text()) as RawCell[][]);
  }
  // carregado só aqui: quem não importa não baixa o leitor de planilha
  const { default: readXlsxFile } = await import('read-excel-file/browser');
  const sheets = await readXlsxFile(file);
  const sheet = sheets.find((s) => sheetName && s.sheet.trim().toLowerCase() === sheetName.toLowerCase()) ?? sheets[0];
  if (!sheet) throw new Error(`${file.name} não tem nenhuma aba.`);
  return toImportTable(sheet.data as RawCell[][]);
}

/**
 * Importar export(s) de uma plataforma (HUB BI, HUB APPS, UpValue). As
 * planilhas são lidas aqui no navegador; o servidor devolve primeiro uma
 * PRÉVIA (nada gravado) e só grava quando a pessoa confirma.
 */
export function ImportDialog({ importer, open, onClose }: { importer: ImporterConfig; open: boolean; onClose: () => void }) {
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [tables, setTables] = useState<ImportTable[] | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [preview, setPreview] = useState<ImportSummary | null>(null);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [revokeMissing, setRevokeMissing] = useState(false);

  const run = useMutation({
    mutationFn: ({ dryRun }: { dryRun: boolean }) => importAccessExport(importer.format, tables!, { dryRun, revokeMissing: !dryRun && revokeMissing }),
  });

  useEffect(() => {
    if (!open) {
      setFileNames([]);
      setTables(null);
      setReadError(null);
      setPreview(null);
      setResult(null);
      setRevokeMissing(false);
      run.reset();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const onFiles = async (list: FileList | null) => {
    const files = list ? [...list] : [];
    if (!files.length) return;
    setReadError(null);
    setPreview(null);
    setResult(null);
    setFileNames(files.map((f) => f.name));
    setReading(true);
    try {
      const parsed = await Promise.all(files.map((f) => readTable(f, importer.sheetName)));
      setTables(parsed);
      setPreview(await importAccessExport(importer.format, parsed, { dryRun: true, revokeMissing: false }));
    } catch (err) {
      setReadError(err instanceof ApiError ? err.message : err instanceof Error ? `Não foi possível ler: ${err.message}` : 'Não foi possível ler os arquivos.');
    } finally {
      setReading(false);
    }
  };

  const confirm = async () => {
    try {
      const summary = await run.mutateAsync({ dryRun: false });
      setResult(summary);
      await Promise.all(['platforms', 'resources', 'grants', 'people', 'protocols', 'access-events'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      notify({ tone: 'success', title: 'Importação concluída', description: `${summary.grants.created + summary.hubAccess.created} acesso(s) registrados.` });
    } catch (err) {
      notify({ tone: 'error', title: 'Importação falhou', description: err instanceof ApiError ? err.message : 'Nada foi gravado.' });
    }
  };

  const shown = result ?? preview;
  const hint = importer.multiple
    ? '.csv, .xlsx ou .xlsm · selecione os arquivos juntos'
    : `.csv, .xlsx ou .xlsm · ${importer.sheetName ? `aba “${importer.sheetName}” (ou a primeira)` : 'a primeira aba é lida'}`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      width="max-w-3xl"
      title={importer.title}
      description={`${importer.description} Importar os mesmos arquivos de novo não duplica nada.`}
      footer={result ? (
        <Button variant="primary" onClick={onClose}>Fechar</Button>
      ) : (
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={confirm} disabled={!preview} loading={run.isPending} icon={<Upload size={14} aria-hidden />}>
            Importar
          </Button>
        </>
      )}
    >
      <div className="grid grid-cols-1 gap-4">
        {!result && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-outline-strong bg-surface-container-low p-4">
            <FileSpreadsheet size={22} className="text-primary-text" aria-hidden />
            <div className="min-w-0 flex-1 text-sm">
              {fileNames.length ? (
                <ul className="grid gap-0.5">{fileNames.map((n) => <li key={n} className="truncate font-semibold text-on-surface">{n}</li>)}</ul>
              ) : (
                <p className="font-semibold text-on-surface">Nenhum arquivo escolhido</p>
              )}
              <p className="text-xs text-on-surface-variant">{hint}</p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              multiple={importer.multiple}
              className="sr-only"
              onChange={(e) => {
                void onFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <Button size="sm" onClick={() => inputRef.current?.click()} disabled={reading}>
              {importer.multiple ? 'Escolher arquivos' : 'Escolher planilha'}
            </Button>
          </div>
        )}
        {reading && <LoadingState label="Lendo e calculando a prévia…" className="py-6" />}
        {readError && <ErrorState message={readError} />}
        {shown && (
          <>
            <p className="text-sm font-semibold text-on-surface">{result ? 'Importado:' : 'Prévia — nada foi gravado ainda:'}</p>
            {shown.notices.length > 0 && (
              <ul className="grid gap-1 rounded-lg bg-surface-container-low px-3 py-2 text-[12.5px] text-on-surface-variant">
                {shown.notices.map((n) => <li key={n}>• {n}</li>)}
              </ul>
            )}
            <ImportSummaryView
              summary={shown}
              importer={importer}
              revokeMissing={revokeMissing}
              onRevokeMissingChange={result ? undefined : setRevokeMissing}
            />
          </>
        )}
      </div>
    </Dialog>
  );
}
