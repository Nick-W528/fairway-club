import type { Href } from 'expo-router';

import type { IconName } from '@/components/ui';
import type { Department } from '@/lib/types';

export interface AdminSection {
  /** Route segment under /admin ('' = overview) */
  segment: string;
  title: string;
  subtitle: string;
  icon: IconName;
  href: Href;
  /** null = admins only, 'any' = any staff */
  dept: Department | null | 'any';
}

export const ADMIN_SECTIONS: AdminSection[] = [
  { segment: '', title: 'Overview', subtitle: 'Today at a glance', icon: 'grid-outline', href: '/(app)/admin', dept: 'any' },
  { segment: 'members', title: 'Members', subtitle: 'Approve requests, roles and staff access', icon: 'people-outline', href: '/(app)/admin/members', dept: null },
  { segment: 'tee-sheet', title: 'Tee sheet', subtitle: 'View bookings, block times', icon: 'time-outline', href: '/(app)/admin/tee-sheet', dept: 'competitions' },
  { segment: 'competitions', title: 'Competitions', subtitle: 'Create, open entries, enter results', icon: 'trophy-outline', href: '/(app)/admin/competitions', dept: 'competitions' },
  { segment: 'bar', title: 'Bar till', subtitle: 'Scan or find members, charge or top up', icon: 'beer-outline', href: '/(app)/admin/bar', dept: 'bar' },
  { segment: 'shop', title: 'Pro shop', subtitle: 'Products, stock and orders', icon: 'pricetag-outline', href: '/(app)/admin/shop', dept: 'pro_shop' },
  { segment: 'course', title: 'Course', subtitle: 'Status, scorecard and details', icon: 'leaf-outline', href: '/(app)/admin/course', dept: 'greenkeeping' },
  { segment: 'posts', title: 'Club updates', subtitle: 'Post news from your area of the club', icon: 'megaphone-outline', href: '/(app)/admin/posts', dept: 'any' },
  { segment: 'settings', title: 'Settings', subtitle: 'Details, branding, tee rules, payments', icon: 'settings-outline', href: '/(app)/admin/settings', dept: null },
];

export function visibleSections(isAdmin: boolean, departments: Department[], canManage: (d: Department) => boolean) {
  return ADMIN_SECTIONS.filter((s) =>
    s.dept === null ? isAdmin : s.dept === 'any' ? isAdmin || departments.length > 0 : canManage(s.dept),
  );
}
