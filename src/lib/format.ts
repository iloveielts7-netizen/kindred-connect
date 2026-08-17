/** Locale-aware helpers so components never format dates or numbers by hand. */
const LOCALE = "en";

export function formatTime(value: string | number | Date, locale = LOCALE) {
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(
    new Date(value),
  );
}

export function formatDay(value: string | number | Date, locale = LOCALE) {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(value));
}

export function formatRelative(value: string | number | Date, locale = LOCALE) {
  const diff = Date.now() - new Date(value).getTime();
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const minutes = Math.round(diff / 60000);
  if (minutes < 60) return rtf.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  return rtf.format(-Math.round(hours / 24), "day");
}

export function formatBytes(bytes: number, locale = LOCALE) {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} ${units[unit]}`;
}

export function formatSeconds(total: number, locale = LOCALE) {
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  const nf = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2 });
  return `${new Intl.NumberFormat(locale).format(m)}:${nf.format(s)}`;
}
