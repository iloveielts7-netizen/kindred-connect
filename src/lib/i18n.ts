import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import { en } from "@/locales/en";

export const supportedLanguages = [{ code: "en", label: "English", dir: "ltr" as const }];

if (!i18next.isInitialized) {
  void i18next.use(initReactI18next).init({
    resources: { en: { translation: en } },
    lng: "en",
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

export default i18next;

/** Locale-aware helpers so components never format dates or numbers by hand. */
export function formatTime(value: string | number | Date, locale = i18next.language) {
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(
    new Date(value),
  );
}

export function formatDay(value: string | number | Date, locale = i18next.language) {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(value));
}

export function formatRelative(value: string | number | Date, locale = i18next.language) {
  const diff = Date.now() - new Date(value).getTime();
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const minutes = Math.round(diff / 60000);
  if (minutes < 60) return rtf.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  return rtf.format(-Math.round(hours / 24), "day");
}

export function formatBytes(bytes: number, locale = i18next.language) {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} ${units[unit]}`;
}

export function formatSeconds(total: number, locale = i18next.language) {
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  const nf = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2 });
  return `${new Intl.NumberFormat(locale).format(m)}:${nf.format(s)}`;
}
