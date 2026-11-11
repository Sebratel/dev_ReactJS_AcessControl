/**
 * Configuração do front. Nada aqui é segredo: tudo que vai para o bundle é
 * público. O ID do cliente Google vem do servidor (/auth/config).
 */
export const API_BASE_URL = '/api/v1';

/**
 * O servidor relê o Voalle a cada 3 min (PROTOCOLS_REFRESH_MS). A tela confere
 * o resultado a cada 30 s: é leve (o servidor responde da memória), mostra uma
 * leitura nova logo que ela sai e mantém o "online" da Administração em dia.
 */
export const PROTOCOLS_POLL_MS = 30_000;

export const APP_NAME = 'Controle de Acessos';

/** Mesmo contato de suporte das dashboards irmãs. */
export const SUPPORT_EMAIL = 'intel@sebratel.com.br';
