import { supabase } from './database';

export interface MirrorImageResult {
  finalUrl: string;
  mirrored: boolean;
  error?: string;
}

export interface MirrorImageOptions {
  proxyBaseUrl?: string;
}

/**
 * Limpa títulos poluídos por SEO do Google Maps / Outscraper.
 * Ex: "Baurú Restaurante | Barra da Tijuca – Rio de J" -> "Baurú Restaurante"
 */
export function sanitizeVenueName(rawName: string): string {
  if (!rawName) return '';

  // 1. Corta tudo após pipe "|"
  let cleaned = rawName.split('|')[0].trim();

  // 2. Corta sufixos de bairro/cidade após traços (-, –, —)
  const locationSuffixes =
    /\s*[-–—]\s*(Barra da Tijuca|Recreio(?:\s+dos\s+Bandeirantes)?|Rio de J.*|RJ|Copacabana|Ipanema|Leblon|Botafogo|Centro|Tijuca|Lagoa|Flamengo|Laranjeiras|G[áa]vea|Jardim Bot[âa]nico|Santa Teresa|Lapa|Urca|Humait[áa]|S[ãa]o Conrado|Leme|Arpoador|Catete|Gl[óo]ria).*$/i;
  cleaned = cleaned.replace(locationSuffixes, '').trim();

  return cleaned || rawName.trim();
}

/**
 * Evita que a descrição seja apenas uma cópia truncada do título sujo
 * ou contenha separadores SEO "|".
 */
export function sanitizeVenueDescription(
  rawDesc: string | undefined,
  cleanName: string,
  category: string,
  neighborhood: string
): string {
  const trimmed = (rawDesc || '').trim();
  const normalizedCleanName = cleanName.trim().toLowerCase();

  if (
    !trimmed ||
    (normalizedCleanName.length > 0 && trimmed.toLowerCase().startsWith(normalizedCleanName)) ||
    trimmed.includes('|') ||
    trimmed.length < 20
  ) {
    const safeCategory = (category || 'gastronomia').trim().toLowerCase();
    const safeNeighborhood = (neighborhood || 'Rio de Janeiro').trim();
    return `Experiência de ${safeCategory} selecionada em ${safeNeighborhood}, Rio de Janeiro.`;
  }

  return trimmed;
}

/**
 * Detecta se a URL da foto é um link temporário assinado do Google/Outscraper.
 */
export function isTemporaryGoogleImageUrl(url?: string): boolean {
  if (!url) return false;
  return (
    url.includes('googleusercontent.com/grass-cs/') ||
    url.includes('googleusercontent.com/gps-cs') ||
    url.includes('googleusercontent.com/p/') ||
    url.includes('ggpht.com/')
  );
}

/**
 * Detecta se a URL já foi espelhada e otimizada (DataURL ou bucket venue-media do Supabase).
 */
export function isAlreadyMirroredImageUrl(url?: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  return (
    trimmed.startsWith('data:image/') ||
    trimmed.includes('/storage/v1/object/public/venue-media/')
  );
}

function isGoogleHostedImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'googleusercontent.com' ||
      host.endsWith('.googleusercontent.com') ||
      host === 'ggpht.com' ||
      host.endsWith('.ggpht.com') ||
      host === 'gstatic.com' ||
      host.endsWith('.gstatic.com') ||
      host === 'streetviewpixels-pa.googleapis.com'
    );
  } catch {
    return false;
  }
}

function getImageProxyBaseUrl(overrideUrl?: string): string {
  if (overrideUrl && overrideUrl.trim()) {
    return overrideUrl.trim().replace(/\/+$/, '');
  }
  const envProxy = import.meta.env.VITE_BORARIO_OUTSCRAPER_PROXY_URL as string | undefined;
  if (envProxy && envProxy.trim()) {
    return envProxy.trim().replace(/\/+$/, '');
  }
  return '/api/outscraper';
}

async function fetchExternalImageBlob(
  imageUrl: string,
  options?: MirrorImageOptions
): Promise<Blob> {
  let directError: string | null = null;

  try {
    const response = await fetch(imageUrl, { mode: 'cors' });
    if (response.ok) {
      const blob = await response.blob();
      if (blob.size > 0) return blob;
      directError = 'Imagem recebida vazia.';
    } else {
      directError = `HTTP ${response.status}`;
    }
  } catch (err) {
    directError = err instanceof Error ? err.message : 'Bloqueio CORS ao baixar imagem direta';
  }

  // Fallback seguro via proxy same-origin / Edge Function para CDNs Google/Outscraper com restrição CORS
  if (isTemporaryGoogleImageUrl(imageUrl) || isGoogleHostedImageUrl(imageUrl)) {
    const proxyBase = getImageProxyBaseUrl(options?.proxyBaseUrl);
    const proxyUrl = `${proxyBase}/mirror-image?url=${encodeURIComponent(imageUrl)}`;
    const proxyRes = await fetch(proxyUrl, { method: 'GET' });
    if (!proxyRes.ok) {
      throw new Error(`Proxy mirror-image retornou HTTP ${proxyRes.status}`);
    }
    const proxyBlob = await proxyRes.blob();
    if (proxyBlob.size === 0) {
      throw new Error('Proxy mirror-image retornou imagem vazia.');
    }
    return proxyBlob;
  }

  throw new Error(directError || 'Falha ao baixar imagem externa.');
}

async function convertBlobToWebp(
  blob: Blob,
  maxDimension: number,
  quality: number
): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('Conversão Canvas WebP disponível apenas no navegador.');
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Falha ao decodificar imagem para conversão WebP.'));
      el.src = objectUrl;
    });

    const srcWidth = img.naturalWidth || img.width || 1;
    const srcHeight = img.naturalHeight || img.height || 1;
    const scale = Math.min(1, maxDimension / Math.max(srcWidth, srcHeight));
    const width = Math.max(1, Math.round(srcWidth * scale));
    const height = Math.max(1, Math.round(srcHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Contexto Canvas 2D indisponível.');
    }

    // Desenhar no Canvas remove EXIF e garante saída limpa em WebP
    ctx.drawImage(img, 0, 0, width, height);

    const webpBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result);
          else reject(new Error('Falha ao codificar WebP via Canvas.'));
        },
        'image/webp',
        quality
      );
    });

    return webpBlob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string' && reader.result.startsWith('data:')) {
        resolve(reader.result);
      } else {
        reject(new Error('Falha ao gerar DataURL WebP.'));
      }
    };
    reader.onerror = () => reject(new Error('Erro no FileReader ao converter WebP.'));
    reader.readAsDataURL(blob);
  });
}

function sanitizeStorageKeySegment(raw: string): string {
  const safe = raw.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return safe.slice(0, 64) || 'venue';
}

/**
 * Baixa a imagem externa, converte para WebP otimizado via Canvas (removendo EXIF)
 * e faz upload para o Supabase Storage (ou retorna DataURL compacto em fallback).
 */
export async function mirrorAndOptimizeVenueImage(
  imageUrl: string,
  venueId: string,
  options?: MirrorImageOptions
): Promise<MirrorImageResult> {
  const trimmedUrl = (imageUrl || '').trim();
  if (!trimmedUrl) {
    return { finalUrl: '', mirrored: false, error: 'URL inválida' };
  }

  if (isAlreadyMirroredImageUrl(trimmedUrl)) {
    return { finalUrl: trimmedUrl, mirrored: true };
  }

  if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
    return { finalUrl: trimmedUrl, mirrored: false, error: 'URL inválida' };
  }

  try {
    const sourceBlob = await fetchExternalImageBlob(trimmedUrl, options);

    // Quando o Supabase Storage está ativo, gera WebP de alta definição (max 900px, 0.82)
    if (supabase) {
      const webpBlob = await convertBlobToWebp(sourceBlob, 900, 0.82);
      const safeId = sanitizeStorageKeySegment(venueId);
      const nonce = Math.random().toString(36).slice(2, 7);
      const filePath = `venues/${safeId}-${Date.now()}-${nonce}.webp`;

      const { error: uploadError } = await supabase.storage
        .from('venue-media')
        .upload(filePath, webpBlob, {
          contentType: 'image/webp',
          upsert: true,
        });

      if (!uploadError) {
        const { data } = supabase.storage.from('venue-media').getPublicUrl(filePath);
        if (data?.publicUrl) {
          return { finalUrl: data.publicUrl, mirrored: true };
        }
      }
    }

    // Fallback compacto para LocalStorage (max 720px, 0.72) para proteger cota de 5 MB
    const compactWebpBlob = await convertBlobToWebp(sourceBlob, 720, 0.72);
    const dataUrl = await blobToDataUrl(compactWebpBlob);
    return { finalUrl: dataUrl, mirrored: true };
  } catch (err) {
    return {
      finalUrl: trimmedUrl,
      mirrored: false,
      error: err instanceof Error ? err.message : 'Erro desconhecido ao espelhar foto',
    };
  }
}

/**
 * Espelha capa e galeria de um estabelecimento em WebP reutilizando URLs repetidas
 * (evitando baixar e codificar duas vezes quando gallery[0] === cover_image).
 */
export async function mirrorVenuePhotos(
  coverImage: string,
  gallery: string[],
  venueId: string,
  options?: MirrorImageOptions & { onlyTemporaryGoogle?: boolean; cache?: Map<string, MirrorImageResult> }
): Promise<{
  cover_image: string;
  gallery: string[];
  mirroredCount: number;
  failedCount: number;
}> {
  const cache = options?.cache ?? new Map<string, MirrorImageResult>();
  const shouldProcess = (url: string): boolean => {
    const trimmed = url.trim();
    if (!trimmed || isAlreadyMirroredImageUrl(trimmed)) return false;
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return false;
    if (options?.onlyTemporaryGoogle) {
      return isTemporaryGoogleImageUrl(trimmed);
    }
    return true;
  };

  let mirroredCount = 0;
  let failedCount = 0;

  const resolveUrl = async (rawUrl: string): Promise<string> => {
    const trimmed = rawUrl.trim();
    if (!trimmed) return '';
    if (!shouldProcess(trimmed)) return trimmed;

    const cached = cache.get(trimmed);
    if (cached) {
      return cached.finalUrl;
    }

    const res = await mirrorAndOptimizeVenueImage(trimmed, venueId, options);
    cache.set(trimmed, res);
    if (res.mirrored) {
      mirroredCount++;
    } else {
      failedCount++;
    }
    return res.finalUrl;
  };

  const nextCover = coverImage ? await resolveUrl(coverImage) : '';
  const nextGallery: string[] = [];
  const seen = new Set<string>();

  for (const url of gallery || []) {
    const resolved = await resolveUrl(url);
    if (resolved && !seen.has(resolved)) {
      seen.add(resolved);
      nextGallery.push(resolved);
    }
  }

  if (nextCover && !seen.has(nextCover)) {
    nextGallery.unshift(nextCover);
  }

  return {
    cover_image: nextCover || nextGallery[0] || '',
    gallery: nextGallery,
    mirroredCount,
    failedCount,
  };
}
