export function money(cents: number, currency = 'gbp') {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency.toUpperCase() }).format(
      cents / 100,
    );
  } catch {
    return `£${(cents / 100).toFixed(2)}`;
  }
}

/** Parses "12.50" into 1250. Returns null for invalid input. */
export function parseMoney(input: string): number | null {
  const n = Number(input.replace(/[^0-9.]/g, ''));
  if (!input.trim() || Number.isNaN(n)) return null;
  return Math.round(n * 100);
}

/** Local calendar date as YYYY-MM-DD. */
export function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Parses YYYY-MM-DD as a local date (not UTC). */
export function parseIsoDate(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function prettyDate(s: string, opts: Intl.DateTimeFormatOptions = {}) {
  return parseIsoDate(s).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...opts,
  });
}

export function prettyDateTime(s: string) {
  return new Date(s).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "07:30:00" -> "07:30" */
export const hhmm = (t: string) => t.slice(0, 5);

export const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

export const fromMinutes = (mins: number) =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

/** All tee times from first to last inclusive, as "HH:MM". */
export function teeSlots(first: string, last: string, interval: number) {
  const out: string[] = [];
  for (let m = toMinutes(first); m <= toMinutes(last); m += interval) out.push(fromMinutes(m));
  return out;
}

export function timeAgo(s: string) {
  const diff = (Date.now() - new Date(s).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseIsoDate(s).getTime());
export const isValidTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
