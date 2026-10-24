import { en, type MessageKey } from './en';

type Dictionary = Partial<Record<MessageKey, string>>;

const dictionaries: Record<string, Dictionary> = { en };
let current: Dictionary = en;

export function setLocale(locale: string) {
  current = dictionaries[locale] ?? en;
}

/** Translates a key, filling `{name}` placeholders from params. */
export function t(key: MessageKey | string, params: Record<string, string | number> = {}): string {
  const template = (current as Record<string, string>)[key] ?? (en as Record<string, string>)[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
}

export type { MessageKey };
