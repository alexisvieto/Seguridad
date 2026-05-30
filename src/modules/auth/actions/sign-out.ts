'use server';

import { getSupabaseServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function signOutAction() {
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}
