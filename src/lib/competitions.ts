import type { Competition, CompetitionEntry } from '@/lib/types';

export const isPointsBased = (comp: Pick<Competition, 'format'>) =>
  comp.format === 'stableford' || comp.format === 'par';

/** Sort results: by position if set, otherwise by points (desc) or net score (asc). */
export function rankEntries(comp: Competition, entries: CompetitionEntry[]) {
  const points = isPointsBased(comp);
  return [...entries].sort((a, b) => {
    if (a.position != null || b.position != null) return (a.position ?? 9999) - (b.position ?? 9999);
    if (points) return (b.points ?? -1) - (a.points ?? -1);
    return (a.net_score ?? 9999) - (b.net_score ?? 9999);
  });
}
