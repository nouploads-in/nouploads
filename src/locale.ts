import hi from '../presets/hi.json';

export const locales: Record<string, Record<string, string>> = { en: Object.fromEntries(Object.keys(hi.translations).map(key => [key, key])), hi: hi.translations };
export function tr(text: string): string {
  const lang = typeof document === 'undefined' ? 'en' : document.documentElement.lang;
  return locales[lang]?.[text] ?? text;
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    if (Object.hasOwn(locales.en, error.message)) return tr(error.message);
    if (Object.values(locales.hi).includes(error.message)) return error.message;
  }
  return tr(fallback);
}
