import { supabase } from './supabase';

export async function fetchLoyaltyProgramActive(businessId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('loyalty_points_active')
    .eq('user_id', businessId)
    .maybeSingle();
  if (error) throw error;
  return data?.loyalty_points_active === true;
}

export async function setLoyaltyProgramActive(businessId: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('profiles').update({ loyalty_points_active: active }).eq('user_id', businessId);
  if (error) throw error;
}

export type PosLoyaltyAward = {
  ok: boolean;
  points: number;
  balance: number;
  linkedApp: boolean;
  message: string;
};

export async function awardPosSaleLoyalty(
  saleId: string,
  profileUserId: string | null
): Promise<PosLoyaltyAward> {
  const { data, error } = await supabase.rpc('seller_award_pos_loyalty', {
    p_pos_sale_id: saleId,
    p_profile_user_id: profileUserId,
  });
  const result = data as {
    ok?: boolean;
    points_awarded?: number;
    points_balance?: number;
    linked_app?: boolean;
    message?: string;
  } | null;
  if (error || result?.ok === false) {
    const missing = error?.message?.includes('seller_award_pos_loyalty') || error?.message?.includes('schema cache');
    return {
      ok: false,
      points: 0,
      balance: 0,
      linkedApp: false,
      message: missing
        ? 'Run supabase/pos-loyalty.sql once in the Supabase SQL Editor, then record the sale again.'
        : result?.message || error?.message || 'Could not add loyalty points.',
    };
  }
  return {
    ok: true,
    points: result?.points_awarded ?? 0,
    balance: result?.points_balance ?? 0,
    linkedApp: result?.linked_app === true,
    message: result?.message ?? '',
  };
}

export async function countLoyaltyEligibleProducts(businessId: string): Promise<number> {
  const { count, error } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('seller_id', businessId)
    .eq('earn_loyalty_points', true);
  if (error) throw error;
  return count ?? 0;
}
