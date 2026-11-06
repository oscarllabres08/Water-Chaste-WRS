import {

  createContext,

  useCallback,

  useContext,

  useEffect,

  useMemo,

  useRef,

  useState,

  type ReactNode,

} from 'react';

import type { Session, User } from '@supabase/supabase-js';



import { supabase } from '../lib/supabase';



type ProfileRow = {

  role: string;

  display_name: string | null;

  seller_team_role: string | null;

  seller_join_status: string | null;

  seller_workspace_owner_id: string | null;

  store_code: string | null;

};



type AuthContextValue = {

  session: Session | null;

  user: User | null;

  loading: boolean;

  profileLoading: boolean;

  profile: ProfileRow | null;

  /** Store owner id. For approved staff this is the master admin id used by store queries. */

  businessId: string | null;

  isStoreOwner: boolean;

  isApprovedStaff: boolean;

  gateMessage: string | null;

  clearGateMessage: () => void;

  refreshProfile: () => Promise<void>;

  signOut: () => Promise<void>;

};



const AuthContext = createContext<AuthContextValue | undefined>(undefined);



function isOwnerProfile(p: ProfileRow | null): boolean {

  if (!p || p.role !== 'seller') return false;

  const team = p.seller_team_role;

  if (team === 'owner') return true;

  if (team == null) return true;

  return false;

}

function isApprovedStaff(p: ProfileRow | null): boolean {

  if (!p || p.role !== 'seller' || p.seller_team_role !== 'staff') return false;

  return (p.seller_join_status ?? 'pending') === 'approved' && Boolean(p.seller_workspace_owner_id);

}



export function AuthProvider({ children }: { children: ReactNode }) {

  const [session, setSession] = useState<Session | null>(null);

  const [loading, setLoading] = useState(true);

  const [profileLoading, setProfileLoading] = useState(false);

  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const [gateMessage, setGateMessage] = useState<string | null>(null);

  const attemptedAutoRegisterRef = useRef<string | null>(null);



  const refreshProfile = useCallback(async () => {

    const uid = session?.user?.id;

    if (!uid) {

      setProfile(null);

      setProfileLoading(false);

      attemptedAutoRegisterRef.current = null;

      return;

    }

    setProfileLoading(true);

    try {

      const { data, error } = await supabase

        .from('profiles')

        .select('role,display_name,seller_team_role,seller_join_status,seller_workspace_owner_id,store_code')

        .eq('user_id', uid)

        .maybeSingle();

      if (error) throw error;

      let row = (data ?? null) as ProfileRow | null;



      if (!row || row.role !== 'seller') {

        const alreadyTried = attemptedAutoRegisterRef.current === uid;

        if (!alreadyTried) {

          attemptedAutoRegisterRef.current = uid;

          const displayName =

            String(

              (session?.user?.user_metadata as { display_name?: string; full_name?: string })?.display_name ??

                (session?.user?.user_metadata as { full_name?: string })?.full_name ??

                ''

            ).trim() || null;

          const { error: regErr } = await supabase.rpc('register_pending_seller', {

            p_display_name: displayName,

          });

          if (!regErr) {

            const { data: data2 } = await supabase

              .from('profiles')

              .select('role,display_name,seller_team_role,seller_join_status,seller_workspace_owner_id,store_code')

              .eq('user_id', uid)

              .maybeSingle();

            row = (data2 ?? null) as ProfileRow | null;

          }

        }

      }



      if (!row || row.role !== 'seller') {

        setGateMessage('This account is not a store admin. Register on this page, or ask the master admin to approve you.');

        await supabase.auth.signOut();

        setProfile(null);

        return;

      }



      if (row.seller_team_role === 'staff') {

        const status = row.seller_join_status ?? 'pending';

        if (status === 'pending') {

          setGateMessage(

            'Your account is waiting for approval. The master admin must approve it on Staff account approval before you can sign in.'

          );

          await supabase.auth.signOut();

          setProfile(null);

          return;

        }

        if (status === 'rejected') {

          setGateMessage('Your registration was rejected by the master admin.');

          await supabase.auth.signOut();

          setProfile(null);

          return;

        }

      }



      if (!isOwnerProfile(row) && !isApprovedStaff(row)) {

        setGateMessage('Only an approved store account can sign in here.');

        await supabase.auth.signOut();

        setProfile(null);

        return;

      }



      setGateMessage(null);

      setProfile(row);

    } catch {

      setProfile(null);

    } finally {

      setProfileLoading(false);

    }

  }, [session?.user?.id, session?.user?.user_metadata]);



  useEffect(() => {

    let mounted = true;

    supabase.auth

      .getSession()

      .then(({ data }) => {

        if (!mounted) return;

        setSession(data.session ?? null);

        setLoading(false);

      })

      .catch(() => {

        if (!mounted) return;

        setLoading(false);

      });



    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {

      setSession(nextSession ?? null);

    });



    return () => {

      mounted = false;

      sub.subscription.unsubscribe();

    };

  }, []);



  useEffect(() => {

    void refreshProfile();

  }, [refreshProfile]);



  const businessId = useMemo(() => {

    if (!session?.user?.id || !profile) return null;

    if (isOwnerProfile(profile)) return session.user.id;

    if (isApprovedStaff(profile)) return profile.seller_workspace_owner_id;

    return null;

  }, [session?.user?.id, profile]);



  const value = useMemo<AuthContextValue>(

    () => ({

      session,

      user: session?.user ?? null,

      loading,

      profileLoading,

      profile,

      businessId,

      isStoreOwner: isOwnerProfile(profile),

      isApprovedStaff: isApprovedStaff(profile),

      gateMessage,

      clearGateMessage: () => setGateMessage(null),

      refreshProfile,

      signOut: async () => {

        await supabase.auth.signOut();

        setProfile(null);

      },

    }),

    [session, loading, profileLoading, profile, businessId, gateMessage, refreshProfile]

  );



  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;

}



export function useAuth() {

  const ctx = useContext(AuthContext);

  if (!ctx) throw new Error('useAuth must be used within AuthProvider');

  return ctx;

}

