import { supabase, unwrap } from '@/lib/supabase';
import type {
  Competition,
  CompetitionEntry,
  Course,
  MembershipStatus,
  ClubRole,
  Department,
  TeeBlock,
  TeeBooking,
} from '@/lib/types';

export interface MemberRow {
  user_id: string;
  role: ClubRole;
  status: MembershipStatus;
  departments: Department[];
  membership_number: string | null;
  joined_at: string;
  profiles: { full_name: string; handicap_index: number | null; phone: string | null } | null;
}

export async function fetchMembers(clubId: string, opts: { activeOnly?: boolean } = {}) {
  let q = supabase
    .from('club_members')
    .select('user_id, role, status, departments, membership_number, joined_at, profiles(full_name, handicap_index, phone)')
    .eq('club_id', clubId);
  if (opts.activeOnly) q = q.eq('status', 'active');
  const rows = unwrap(await q) as unknown as MemberRow[];
  return rows.sort((a, b) => (a.profiles?.full_name ?? '').localeCompare(b.profiles?.full_name ?? ''));
}

export async function fetchCourses(clubId: string) {
  return unwrap(
    await supabase.from('courses').select('*').eq('club_id', clubId).order('sort_order').order('name'),
  ) as Course[];
}

const BOOKING_SELECT =
  'id, course_id, play_date, tee_time, competition_id, booked_by, tee_booking_players(id, user_id, guest_name, profiles(full_name, handicap_index))';

/** Everything needed to draw the tee sheet for one course on one day. */
export async function fetchTeeSheet(courseId: string, date: string) {
  const [bookings, blocks, comps] = await Promise.all([
    supabase.from('tee_bookings').select(BOOKING_SELECT).eq('course_id', courseId).eq('play_date', date),
    supabase.from('tee_sheet_blocks').select('*').eq('course_id', courseId).eq('play_date', date),
    supabase
      .from('competitions')
      .select('*')
      .eq('course_id', courseId)
      .eq('play_date', date)
      .in('status', ['open', 'closed', 'completed']),
  ]);
  return {
    bookings: unwrap(bookings) as unknown as TeeBooking[],
    blocks: unwrap(blocks) as TeeBlock[],
    competitions: unwrap(comps) as Competition[],
  };
}

export async function fetchMyBookings(clubId: string, userId: string, fromDate: string) {
  // Bookings where I'm a player (not only ones I made).
  const mine = unwrap(
    await supabase
      .from('tee_booking_players')
      .select('booking_id')
      .eq('club_id', clubId)
      .eq('user_id', userId),
  ) as { booking_id: string }[];
  if (mine.length === 0) return [];
  return unwrap(
    await supabase
      .from('tee_bookings')
      .select(`${BOOKING_SELECT}, courses(name), competitions(name)`)
      .in(
        'id',
        mine.map((m) => m.booking_id),
      )
      .gte('play_date', fromDate)
      .order('play_date')
      .order('tee_time'),
  ) as unknown as (TeeBooking & { courses: { name: string } | null; competitions: { name: string } | null })[];
}

export async function fetchEntries(competitionId: string) {
  return unwrap(
    await supabase
      .from('competition_entries')
      .select('*, profiles!competition_entries_user_id_fkey(full_name, handicap_index)')
      .eq('competition_id', competitionId),
  ) as unknown as CompetitionEntry[];
}
