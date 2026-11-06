import Constants from 'expo-constants';

type Extra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const WATER_CHASTE_URL = 'https://hjvwwxdyyugjchkeolyp.supabase.co';
const WATER_CHASTE_ANON_KEY = 'sb_publishable_syjSQ1DOnVQndCcAzDLRgA_icj7QHx2';
const RETIRED_HOST = 'nigvimeeqglqvgvtnbfy';

export function getSupabaseUrlAndKey(): { url: string; anonKey: string } {
  const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

  // In release APK, `extra` from app.config.js (EAS env) is the reliable source.
  let url = (extra.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL)?.trim();
  let anonKey = (extra.supabaseAnonKey ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY)?.trim();

  // A Metro session started against the old Zoda project keeps that host until restart.
  if (!url || url.includes(RETIRED_HOST)) {
    url = WATER_CHASTE_URL;
    anonKey = WATER_CHASTE_ANON_KEY;
  }

  if (!url || !anonKey) {
    const msg =
      'Missing Supabase config. Use EAS profile preview/production (seller-app/eas.json) or seller-app/.env locally.';
    if (__DEV__) throw new Error(msg);
    console.error(msg);
    return { url: url || 'https://invalid.local', anonKey: anonKey || 'missing-anon-key' };
  }

  return { url, anonKey };
}
