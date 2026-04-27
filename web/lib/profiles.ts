import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type ProfileRole = 'user' | 'admin';

export async function ensureProfile(user: User): Promise<void> {
  const displayName =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    user.email ||
    'ArtTomato User';

  await supabase.from('profiles').upsert(
    {
      id: user.id,
      display_name: displayName,
      avatar_url: (user.user_metadata?.avatar_url as string | undefined) || null,
    },
    {
      onConflict: 'id',
      ignoreDuplicates: false,
    },
  );
}

export async function getProfileRole(userId: string): Promise<ProfileRole> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    return 'user';
  }

  return data?.role === 'admin' ? 'admin' : 'user';
}
