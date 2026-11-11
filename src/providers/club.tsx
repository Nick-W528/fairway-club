import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';
import type { Club, Department, Membership } from '@/lib/types';
import { useAuth } from '@/providers/auth';

export type MembershipWithClub = Membership & { clubs: Club };

interface ClubState {
  memberships: MembershipWithClub[];
  club: Club | null;
  membership: MembershipWithClub | null;
  loading: boolean;
  selectClub: (clubId: string | null) => Promise<void>;
  reload: () => Promise<void>;
  /** Admin/owner, or staff with that department. */
  canManage: (dept: Department) => boolean;
  isAdmin: boolean;
  isStaff: boolean;
}

const KEY = 'golfapp.selectedClub';
const ClubContext = createContext<ClubState | null>(null);

async function loadMemberships(userId: string) {
  const [{ data }, stored] = await Promise.all([
    supabase.from('club_members').select('*, clubs(*)').eq('user_id', userId),
    AsyncStorage.getItem(KEY).catch(() => null),
  ]);
  return { list: (data ?? []) as MembershipWithClub[], stored };
}

export function ClubProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id;
  // Memberships are stored with the user they belong to; anything else counts as "not loaded".
  const [loaded, setLoaded] = useState<{ userId: string; list: MembershipWithClub[] } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const apply = useCallback((uid: string, list: MembershipWithClub[], stored: string | null) => {
    setLoaded({ userId: uid, list });
    const active = list.filter((m) => m.status === 'active');
    setSelectedId((cur) => {
      const want = cur ?? stored;
      if (want && active.some((m) => m.club_id === want)) return want;
      return active.length === 1 ? active[0].club_id : null;
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadMemberships(userId).then(({ list, stored }) => {
      if (!cancelled) apply(userId, list, stored);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, apply]);

  const reload = useCallback(async () => {
    if (!userId) return;
    const { list, stored } = await loadMemberships(userId);
    apply(userId, list, stored);
  }, [userId, apply]);

  const selectClub = async (clubId: string | null) => {
    setSelectedId(clubId);
    if (clubId) await AsyncStorage.setItem(KEY, clubId).catch(() => {});
    else await AsyncStorage.removeItem(KEY).catch(() => {});
  };

  const memberships = loaded && loaded.userId === userId ? loaded.list : [];
  const loading = !!userId && loaded?.userId !== userId;
  const membership =
    memberships.find((m) => m.club_id === selectedId && m.status === 'active') ?? null;
  const isAdmin = membership?.role === 'admin' || membership?.role === 'owner';
  const isStaff = isAdmin || membership?.role === 'staff';
  const canManage = (dept: Department) =>
    isAdmin || (membership?.role === 'staff' && membership.departments.includes(dept));

  return (
    <ClubContext.Provider
      value={{
        memberships,
        club: membership?.clubs ?? null,
        membership,
        loading,
        selectClub,
        reload,
        canManage,
        isAdmin,
        isStaff,
      }}>
      {children}
    </ClubContext.Provider>
  );
}

export function useClub() {
  const ctx = useContext(ClubContext);
  if (!ctx) throw new Error('useClub must be used inside ClubProvider');
  return ctx;
}

/** For screens that are only reachable once a club is selected. */
export function useCurrentClub() {
  const ctx = useClub();
  if (!ctx.club || !ctx.membership) throw new Error('No club selected');
  return { ...ctx, club: ctx.club, membership: ctx.membership };
}
