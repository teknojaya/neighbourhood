/**
 * Minimal structured logger (JSON lines → Cloud Logging).
 *
 * Rules: never log request bodies, AI prompts/outputs, needs text, private
 * information, exact locations, tokens or API keys. Log ids and codes only.
 */
type Level = 'debug' | 'info' | 'warn' | 'error';
type Fields = Record<string, string | number | boolean | null | undefined>;

const SEVERITY: Record<Level, string> = { debug: 'DEBUG', info: 'INFO', warn: 'WARNING', error: 'ERROR' };

function write(level: Level, message: string, fields: Fields = {}) {
  if (process.env.NODE_ENV === 'test' && level !== 'error') return;
  const line = JSON.stringify({ severity: SEVERITY[level], message, ...fields, time: new Date().toISOString() });
  if (level === 'error' || level === 'warn') console.error(line);
  else process.stdout.write(`${line}\n`);
}

export const logger = {
  debug: (m: string, f?: Fields) => write('debug', m, f),
  info: (m: string, f?: Fields) => write('info', m, f),
  warn: (m: string, f?: Fields) => write('warn', m, f),
  error: (m: string, f?: Fields) => write('error', m, f),
};
