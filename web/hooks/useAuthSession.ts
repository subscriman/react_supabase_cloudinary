import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { ensureProfile, getProfileRole, type ProfileRole } from '../lib/profiles';

type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  role: ProfileRole | null;
};

export function useAuthSession(): AuthState {
  const [state, setState] = useState<AuthState>({
    loading: true,
    session: null,
    user: null,
    role: null,
  });

  useEffect(() => {
    let mounted = true;
    let roleRequestSeq = 0;

    const resolveRoleSafely = async (user: User): Promise<ProfileRole> => {
      try {
        await ensureProfile(user);
        return await getProfileRole(user.id);
      } catch {
        return 'user';
      }
    };

    const applySession = (session: Session | null) => {
      const user = session?.user ?? null;

      setState((prev) => ({
        loading: false,
        session,
        user,
        role: user && prev.user?.id === user.id ? prev.role : null,
      }));

      if (!user) return;

      const requestId = ++roleRequestSeq;
      void (async () => {
        const role = await resolveRoleSafely(user);
        if (!mounted || requestId !== roleRequestSeq) return;

        setState((prev) => {
          if (prev.user?.id !== user.id) return prev;
          return {
            ...prev,
            role,
          };
        });
      })();
    };

    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;
        if (error) {
          setState({
            loading: false,
            session: null,
            user: null,
            role: null,
          });
          return;
        }
        applySession(data.session ?? null);
      } catch {
        if (!mounted) return;
        setState({
          loading: false,
          session: null,
          user: null,
          role: null,
        });
      }
    };

    void init();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      applySession(session);
    });

    return () => {
      mounted = false;
      roleRequestSeq += 1;
      authListener.subscription.unsubscribe();
    };
  }, []);

  return state;
}
