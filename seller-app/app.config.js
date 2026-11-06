/** @type {import('@expo/env').loadEnvFiles} */
const { load: loadEnv } = require('@expo/env');

loadEnv(process.cwd());

const base = require('./app.json');

// Always baked into the binary. Env can override, but a missing or old key
// must not ship an APK that closes on open.
const WATER_CHASTE_URL = 'https://hjvwwxdyyugjchkeolyp.supabase.co';
const WATER_CHASTE_ANON_KEY = 'sb_publishable_syjSQ1DOnVQndCcAzDLRgA_icj7QHx2';
const RETIRED_HOST = 'nigvimeeqglqvgvtnbfy';

let supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || '';
let supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';
if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes(RETIRED_HOST)) {
  supabaseUrl = WATER_CHASTE_URL;
  supabaseAnonKey = WATER_CHASTE_ANON_KEY;
}

module.exports = () => ({
  expo: {
    ...base.expo,
    extra: {
      ...base.expo.extra,
      supabaseUrl,
      supabaseAnonKey,
    },
  },
});
