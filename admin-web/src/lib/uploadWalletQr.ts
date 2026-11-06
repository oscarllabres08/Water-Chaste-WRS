import { compressImageForUpload, imageUploadPresets } from './compressImageForUpload';
import { BUCKET } from './format';
import { supabase } from './supabase';

export async function uploadWalletQr(businessId: string, file: File): Promise<string> {
  const prepared = await compressImageForUpload(file, imageUploadPresets.qr);
  const path = `${businessId}/qr/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, prepared, {
    upsert: true,
    contentType: 'image/jpeg',
    cacheControl: '3600',
  });
  if (error) throw error;
  return path;
}
