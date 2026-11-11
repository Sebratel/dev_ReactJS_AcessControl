/**
 * Erro de negócio com status HTTP e código legível por máquina
 * (`{DOMINIO}_{PROBLEMA}`, ver padrões de API). A mensagem é para gente e vai
 * para o cliente; detalhes técnicos ficam só no log.
 */
export class AppException extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: unknown[] = [],
  ) {
    super(message);
    this.name = 'AppException';
  }
}
