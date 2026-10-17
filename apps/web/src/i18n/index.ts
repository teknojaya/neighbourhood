import { en, type MessageKey } from './en';

const messages: Record<MessageKey, string> = en;

/** Looks up a UI string and fills `{placeholders}`. */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const template = messages[key];
  return vars ? template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : template;
}

export function hasMessage(key: string): key is MessageKey {
  return key in messages;
}

export type { MessageKey };
