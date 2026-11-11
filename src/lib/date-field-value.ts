import { isoDate } from '@/lib/format';

export type DateFieldMode = 'date' | 'time' | 'datetime';

const pad = (n: number) => String(n).padStart(2, '0');

/** Date → 'YYYY-MM-DD' | 'HH:MM' | 'YYYY-MM-DD HH:MM' (local time). */
export function toValue(d: Date, mode: DateFieldMode) {
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return mode === 'date' ? isoDate(d) : mode === 'time' ? time : `${isoDate(d)} ${time}`;
}

/** Parses a stored value back to a Date (now, if empty or invalid). */
export function fromValue(value: string, mode: DateFieldMode): Date {
  const now = new Date();
  if (!value) return now;
  if (mode === 'time') {
    const [h, m] = value.split(':').map(Number);
    const d = new Date(now);
    d.setHours(h || 0, m || 0, 0, 0);
    return d;
  }
  const [datePart, timePart = '00:00'] = value.split(' ');
  const [y, mo, day] = datePart.split('-').map(Number);
  const [h, m] = timePart.split(':').map(Number);
  const d = new Date(y, (mo || 1) - 1, day || 1, h || 0, m || 0);
  return Number.isNaN(d.getTime()) ? now : d;
}
