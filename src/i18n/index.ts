import { en } from './locales/en.js';
import { zh } from './locales/zh.js';

export type Locale = 'en' | 'zh';
type MessageCatalog = Record<keyof typeof en, string>;
export type MessageKey = keyof MessageCatalog;

const catalogs: Record<Locale, MessageCatalog> = {
  en,
  zh,
};

export function resolveLocale(candidate?: string): Locale {
  if (candidate === 'zh') {
    return 'zh';
  }
  return 'en';
}

export function getDefaultLocale(): Locale {
  return resolveLocale(process.env.OPENAGENTS_LANG);
}

export function t(locale: Locale, key: MessageKey, params?: Record<string, string>): string {
  const template = catalogs[locale][key] ?? catalogs.en[key];
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (_match, token: string) => params[token] ?? `{${token}}`);
}
