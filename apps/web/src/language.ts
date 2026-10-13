// The user's language (R3.2, ADR-042): remembered on this phone; the page text follows it.
import { DEFAULT_LANG, isLang, uiText, type LangCode, type UiKey } from '@footprint/shared';

const KEY = 'footprint.language';

export function loadLanguage(): LangCode {
  try {
    const v = localStorage.getItem(KEY);
    return isLang(v) ? v : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG; // storage blocked: English
  }
}

export function saveLanguage(lang: LangCode): void {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* not remembered — still used for this visit */
  }
}

/** Page text in `lang`: every element with data-i18n="key" (and data-i18n-placeholder) is filled from the catalogue. */
export function applyPageLanguage(lang: LangCode, root: ParentNode = document): void {
  if (typeof document !== 'undefined') document.documentElement.lang = lang.slice(0, 2);
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = uiText(el.dataset.i18n as UiKey, lang);
  });
  root.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = uiText(el.dataset.i18nPlaceholder as UiKey, lang);
  });
}
