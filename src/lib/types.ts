export type ClubRole = 'member' | 'staff' | 'admin' | 'owner';
export type MembershipStatus = 'pending' | 'active' | 'suspended';
export type Department = 'club' | 'bar' | 'pro_shop' | 'golf_pro' | 'greenkeeping' | 'competitions';
export type CompetitionFormat =
  | 'stableford'
  | 'medal'
  | 'par'
  | 'matchplay'
  | 'texas_scramble'
  | 'fourball'
  | 'other';
export type CompetitionStatus = 'draft' | 'open' | 'closed' | 'completed' | 'cancelled';
export type CourseStatus = 'open' | 'restricted' | 'closed';
export type OrderStatus = 'pending' | 'paid' | 'ready' | 'collected' | 'cancelled';

export const DEPARTMENTS: { key: Department; label: string; icon: string }[] = [
  { key: 'club', label: 'Club Office', icon: 'business-outline' },
  { key: 'competitions', label: 'Competitions', icon: 'trophy-outline' },
  { key: 'bar', label: 'Bar & Catering', icon: 'beer-outline' },
  { key: 'pro_shop', label: 'Pro Shop', icon: 'pricetag-outline' },
  { key: 'golf_pro', label: 'Golf Pro', icon: 'golf-outline' },
  { key: 'greenkeeping', label: 'Greenkeeping', icon: 'leaf-outline' },
];

export const departmentLabel = (d: Department) =>
  DEPARTMENTS.find((x) => x.key === d)?.label ?? d;

export const FORMAT_LABELS: Record<CompetitionFormat, string> = {
  stableford: 'Stableford',
  medal: 'Medal',
  par: 'Par / Bogey',
  matchplay: 'Matchplay',
  texas_scramble: 'Texas Scramble',
  fourball: 'Fourball',
  other: 'Other',
};

export const COMP_STATUS_TONE = {
  draft: 'neutral',
  open: 'success',
  closed: 'warning',
  completed: 'primary',
  cancelled: 'danger',
} as const;

export const ORDER_STATUS_TONE = {
  pending: 'neutral',
  paid: 'primary',
  ready: 'success',
  collected: 'neutral',
  cancelled: 'danger',
} as const;

export interface Profile {
  id: string;
  full_name: string;
  handicap_index: number | null;
  phone: string | null;
  avatar_url: string | null;
}

export interface Club {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  logo_url: string | null;
  cover_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  currency: string;
  first_tee: string;
  last_tee: string;
  tee_interval_minutes: number;
  max_players_per_tee: number;
  booking_window_days: number;
  card_payments_enabled: boolean;
  brand_color: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface Membership {
  club_id: string;
  user_id: string;
  role: ClubRole;
  status: MembershipStatus;
  departments: Department[];
  membership_number: string | null;
  joined_at: string;
}

export interface Course {
  id: string;
  club_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  par: number | null;
  yardage: number | null;
  course_rating: number | null;
  slope_rating: number | null;
  status: CourseStatus;
  status_note: string | null;
  buggies_allowed: boolean;
  trolleys_allowed: boolean;
  status_updated_at: string;
}

export interface Hole {
  id: string;
  course_id: string;
  number: number;
  par: number;
  stroke_index: number | null;
  yards_white: number | null;
  yards_yellow: number | null;
  yards_red: number | null;
  description: string | null;
}

export interface Post {
  id: string;
  club_id: string;
  department: Department;
  title: string;
  body: string;
  image_url: string | null;
  pinned: boolean;
  published_at: string;
}

export interface Competition {
  id: string;
  club_id: string;
  course_id: string;
  name: string;
  description: string | null;
  format: CompetitionFormat;
  play_date: string;
  first_tee: string;
  last_tee: string;
  entry_fee_cents: number;
  max_entries: number | null;
  handicap_allowance: number;
  eligibility: string | null;
  status: CompetitionStatus;
  entries_close_at: string | null;
}

export interface TeeBlock {
  id: string;
  course_id: string;
  play_date: string;
  start_time: string;
  end_time: string;
  reason: string;
}

export interface BookingPlayer {
  id: string;
  user_id: string | null;
  guest_name: string | null;
  profiles: { full_name: string; handicap_index: number | null } | null;
}

export interface TeeBooking {
  id: string;
  course_id: string;
  play_date: string;
  tee_time: string;
  competition_id: string | null;
  booked_by: string;
  tee_booking_players: BookingPlayer[];
}

export interface CompetitionEntry {
  competition_id: string;
  user_id: string;
  booking_id: string | null;
  fee_paid_cents: number;
  gross_score: number | null;
  net_score: number | null;
  points: number | null;
  position: number | null;
  profiles: { full_name: string; handicap_index: number | null } | null;
}

export interface WalletTransaction {
  id: string;
  amount_cents: number;
  type: string;
  description: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  club_id: string;
  name: string;
  description: string | null;
  category: string;
  price_cents: number;
  image_url: string | null;
  stock: number | null;
  active: boolean;
}

export interface Order {
  id: string;
  user_id: string;
  status: OrderStatus;
  payment_method: 'wallet' | 'card';
  total_cents: number;
  created_at: string;
  order_items: { name: string; quantity: number; unit_price_cents: number }[];
  profiles?: { full_name: string } | null;
}
