export type ImageCompressOptions = {
  maxEdge?: number;
  minEdge?: number;
  targetMaxBytes?: number;
  qualityStart?: number;
  qualityMin?: number;
};

/** Smaller files for Supabase Storage. QR stays sharper so it can still be scanned. */
export const imageUploadPresets = {
  avatar: { maxEdge: 512, minEdge: 256, targetMaxBytes: 80_000, qualityStart: 0.7, qualityMin: 0.42 },
  logo: { maxEdge: 640, minEdge: 320, targetMaxBytes: 100_000, qualityStart: 0.72, qualityMin: 0.45 },
  qr: { maxEdge: 720, minEdge: 480, targetMaxBytes: 130_000, qualityStart: 0.82, qualityMin: 0.62 },
  product: { maxEdge: 800, minEdge: 420, targetMaxBytes: 150_000, qualityStart: 0.72, qualityMin: 0.42 },
  proof: { maxEdge: 1200, minEdge: 640, targetMaxBytes: 180_000, qualityStart: 0.7, qualityMin: 0.42 },
} as const;

const FALLBACK = imageUploadPresets.product;

function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|heic|heif|gif)$/i.test(file.name);
}

function resolveOptions(options?: ImageCompressOptions) {
  return {
    maxEdge: options?.maxEdge ?? FALLBACK.maxEdge,
    minEdge: options?.minEdge ?? FALLBACK.minEdge,
    targetMaxBytes: options?.targetMaxBytes ?? FALLBACK.targetMaxBytes,
    qualityStart: options?.qualityStart ?? FALLBACK.qualityStart,
    qualityMin: options?.qualityMin ?? FALLBACK.qualityMin,
  };
}

/** Resize and JPEG-compress before uploading to Supabase Storage. */
export async function compressImageForUpload(file: File, options?: ImageCompressOptions): Promise<File> {
  if (!isImageFile(file)) {
    throw new Error('Please choose an image file.');
  }

  const { maxEdge, minEdge, targetMaxBytes, qualityStart, qualityMin } = resolveOptions(options);
  let edge = maxEdge;
  let quality = qualityStart;
  let lastBlob: Blob | null = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const blob = await imageFileToJpegBlob(file, edge, quality);
    lastBlob = blob;
    if (blob.size <= targetMaxBytes) break;
    if (quality > qualityMin) {
      quality = Math.max(qualityMin, Math.round((quality - 0.08) * 100) / 100);
      continue;
    }
    if (edge > minEdge) {
      edge = Math.max(minEdge, Math.round(edge * 0.8));
      quality = qualityStart;
      continue;
    }
    break;
  }

  if (!lastBlob) {
    throw new Error('Could not compress image.');
  }

  const base = file.name.replace(/\.[^.]+$/i, '').trim() || 'image';
  return new File([lastBlob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}

async function imageFileToJpegBlob(file: File, maxEdge: number, quality: number): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadHtmlImage(url);
    const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight, 1));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not compress image');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Compression failed'))), 'image/jpeg', quality);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read image. Use JPG or PNG.'));
    img.src = src;
  });
}
