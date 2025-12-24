import { useEffect, useState } from "react";
import { translations } from "./translations";

const defaultLang = localStorage.getItem("dfos_lang") || "en";
let currentLang = defaultLang;

export function t(path: string): string {
  const parts = path.split(".");
  let result: any = translations[currentLang as keyof typeof translations];

  for (const p of parts) {
    if (!result || typeof result !== "object" || !(p in result)) {
      return path;
    }
    result = result[p];
  }

  return typeof result === "string" ? result : path;
}

export function setLanguage(lang: string): void {
  currentLang = lang;
  localStorage.setItem("dfos_lang", lang);
  window.dispatchEvent(new Event("language-change"));
}

export function getLanguage(): string {
  return currentLang;
}

export function useLanguage(): string {
  const [lang, setLang] = useState(getLanguage());

  useEffect(() => {
    const handler = () => setLang(getLanguage());
    window.addEventListener("language-change", handler);
    return () => window.removeEventListener("language-change", handler);
  }, []);

  return lang;
}
