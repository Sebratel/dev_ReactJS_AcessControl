/**
 * Log mínimo com carimbo de hora e escopo. Escreve em stdout/stderr porque é
 * isso que o Docker coleta; nenhum dado de usuário ou credencial passa por aqui.
 */
type Level = 'info' | 'warn' | 'error';

function write(level: Level, scope: string, message: string): void {
  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} [${scope}] ${message}`;
  if (level === 'error') process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
}

export const logger = {
  info: (scope: string, message: string) => write('info', scope, message),
  warn: (scope: string, message: string) => write('warn', scope, message),
  error: (scope: string, message: string) => write('error', scope, message),
};
