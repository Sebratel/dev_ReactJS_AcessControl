import type { ImportFormat } from '../../services/importsService';

/** Os exports que cada plataforma sabe importar (o servidor tem um leitor por formato). */
export interface ImporterConfig {
  format: ImportFormat;
  title: string;
  description: string;
  /** aba preferida da planilha; sem ela, a primeira */
  sheetName?: string;
  /** aceita vários arquivos de uma vez (cada um reconhecido pelas colunas) */
  multiple?: boolean;
  /** como chamar os itens e o acesso à ferramenta no resumo */
  itemsLabel: string;
  rootLabel: string;
  sourceLabel: string;
}

export const IMPORTERS: Record<string, ImporterConfig> = {
  'hub-bi': {
    format: 'hub-bi-permissions',
    title: 'Importar permissões do HUB BI',
    description: 'Export “permissões ativas” do HUB BI: colunas id_dashboard, dashboard, email (e, se houver, usuario, nivel_usuario, ativa, criado_em).',
    itemsLabel: 'Dashboards',
    rootLabel: 'Acesso ao hub (Admin/User)',
    sourceLabel: 'HUB BI',
  },
  aplicacoes: {
    format: 'hub-apps',
    title: 'Importar os exports do HUB APPS',
    description: 'Escolha juntos os CSVs do HUB APPS: acessos por usuário (obrigatório), usuários e apps. Cada arquivo é reconhecido pelas colunas; o “usuários por app” pode ir junto e é ignorado.',
    multiple: true,
    itemsLabel: 'Aplicações',
    rootLabel: 'Acesso ao HUB APPS',
    sourceLabel: 'HUB APPS',
  },
  upvalue: {
    format: 'upvalue-reports',
    title: 'Importar o controle da UpValue',
    description: 'Planilha “Controle UpValue” (aba Export): colunas Usuário, email e Relatório — o nome e o e-mail só na primeira linha de cada pessoa.',
    sheetName: 'Export',
    itemsLabel: 'Relatórios',
    rootLabel: 'Acesso à UpValue',
    sourceLabel: 'controle da UpValue',
  },
};
