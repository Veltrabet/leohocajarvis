import { useEffect, useState } from "react";

export type Lang = "auto" | "tr" | "sq" | "en";

export const LANG_META: Record<Lang, { label: string; short: string; speech: string }> = {
  auto: { label: "Otomatik", short: "AUTO", speech: "tr-TR" },
  tr: { label: "Türkçe", short: "TR", speech: "tr-TR" },
  sq: { label: "Shqip", short: "SQ", speech: "sq-AL" },
  en: { label: "English", short: "EN", speech: "en-US" },
};

const KEY = "jarvis-lang";
const EVENT = "jarvis-lang-change";

export function getLang(): Lang {
  const v = localStorage.getItem(KEY);
  return v === "tr" || v === "sq" || v === "en" || v === "auto" ? v : "auto";
}

export function setLang(lang: Lang) {
  localStorage.setItem(KEY, lang);
  window.dispatchEvent(new Event(EVENT));
}

/** Shared language preference — persisted and synced across every mounted component. */
export function useLang(): [Lang, (l: Lang) => void] {
  const [lang, setState] = useState<Lang>(() => getLang());

  useEffect(() => {
    const sync = () => setState(getLang());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);

  return [lang, setLang];
}

/** Speech locale for the Web Speech API. "auto" listens in Turkish by default. */
export function speechLocale(lang: Lang): string {
  return LANG_META[lang].speech;
}
