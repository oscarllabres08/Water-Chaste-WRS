import Constants from 'expo-constants';

type Extra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const WATER_CHASTE_URL = 'https://hjvwwxdyyugjchkeolyp.supabase.co';
const WATER_CHASTE_ANON_KEY = 'sb_publishable_syjSQ1DOnVQndCcAzDLRgA_icj7QHx2';
const RETIRED_HOST = 'nigvimeeqglqvgvtnbfy';

function readExtra(): Extra {
  const constants = Constants as {
    expoConfig?: { extra?: Extra } | null;
    manifest?: { extra?: Extra } | null;
    manifest2?: { extra?: { expoClient?: { extra?: Extra } } } | null;
  };
  return (
    constants.expoConfig?.extra ??
    constants.manifest?.extra ??
    constants.manifest2?.extra?.expoClient?.extra ??
    {}
  );
}

export function getSupabaseUrlAndKey(): { url: string; anonKey: string } {
  const extra = readExtra();
  let url = (extra.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
  let anonKey = (extra.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();

  // Release APKs must still open when EAS env was not copied into the binary.
  if (!url || !anonKey || url.includes(RETIRED_HOST) || anonKey.includes(RETIRED_HOST)) {
    url = WATER_CHASTE_URL;
    anonKey = WATER_CHASTE_ANON_KEY;
  }

  return { url, anonKey };
}
