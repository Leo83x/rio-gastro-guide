import type {
  IntentPatternInsight,
  IntentSourceType,
  IntentStatus,
  IntentVaultItem,
} from '../types/intention';
import { generateUUID } from '../utils/slug';

const VAULT_STORAGE_KEY = 'borario_intent_vault_v1';
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export function sanitizeHttpUrl(raw?: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function detectSourceTypeFromUrl(safeUrl: string): IntentSourceType {
  try {
    const host = new URL(safeUrl).hostname.toLowerCase();
    if (host.includes('instagram.com') || host.includes('instagr.am')) return 'instagram_link';
    if (host.includes('tiktok.com')) return 'tiktok_link';
    if (host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube_link';
    return 'web_link';
  } catch {
    return 'web_link';
  }
}

/**
 * Valida MIME e tamanho do print e re-encoda via canvas para remover metadados EXIF
 * (ex.: coordenadas GPS de câmera) mantendo o payload leve para armazenamento local.
 */
export async function validateAndPrepareScreenshot(
  file: File
): Promise<{ ok: true; dataUrl: string } | { ok: false; error: string }> {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return {
      ok: false,
      error: 'Formato não suportado. Envie uma imagem PNG, JPEG ou WebP.',
    };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: 'A imagem excede o limite máximo de 5 MB.',
    };
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const maxDim = 960;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve({ ok: false, error: 'Não foi possível processar a imagem no navegador.' });
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const strippedDataUrl = canvas.toDataURL('image/jpeg', 0.78);
        URL.revokeObjectURL(objectUrl);
        resolve({ ok: true, dataUrl: strippedDataUrl });
      } catch {
        URL.revokeObjectURL(objectUrl);
        resolve({ ok: false, error: 'Erro ao preparar o print para o Cofre.' });
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ ok: false, error: 'Arquivo de imagem inválido ou corrompido.' });
    };
    img.src = objectUrl;
  });
}

export function getIntentVaultItems(): IntentVaultItem[] {
  try {
    const raw = localStorage.getItem(VAULT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as IntentVaultItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIntentVaultItems(items: IntentVaultItem[]): void {
  localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(items));
}

export function addIntentVaultItem(
  payload: Omit<IntentVaultItem, 'id' | 'created_at' | 'updated_at'>
): IntentVaultItem[] {
  const safeUrl = payload.source_url ? sanitizeHttpUrl(payload.source_url) ?? undefined : undefined;
  const now = new Date().toISOString();
  const item: IntentVaultItem = {
    ...payload,
    source_url: safeUrl,
    id: generateUUID(),
    created_at: now,
    updated_at: now,
  };
  const next = [item, ...getIntentVaultItems()];
  writeIntentVaultItems(next);
  return next;
}

export function updateIntentVaultItem(
  id: string,
  patch: Partial<Omit<IntentVaultItem, 'id' | 'created_at'>>
): IntentVaultItem[] {
  const now = new Date().toISOString();
  const next = getIntentVaultItems().map((item) => {
    if (item.id !== id) return item;
    const nextUrl =
      patch.source_url !== undefined
        ? sanitizeHttpUrl(patch.source_url) ?? undefined
        : item.source_url;
    return {
      ...item,
      ...patch,
      source_url: nextUrl,
      updated_at: now,
    };
  });
  writeIntentVaultItems(next);
  return next;
}

export function setIntentVaultStatus(id: string, status: IntentStatus): IntentVaultItem[] {
  return updateIntentVaultItem(id, { status });
}

export function deleteIntentVaultItem(id: string): IntentVaultItem[] {
  const next = getIntentVaultItems().filter((item) => item.id !== id);
  writeIntentVaultItems(next);
  return next;
}

export function hasVenueInVault(venueId: string): boolean {
  return getIntentVaultItems().some(
    (item) => item.linked_venue_id === venueId && item.status !== 'ARCHIVED'
  );
}

/**
 * Gera insights transparentes SOMENTE quando há >= 2 itens ativos compartilhando
 * bairro ou categoria. Nunca inventa padrões com amostra insuficiente.
 */
export function computeIntentPatternInsights(items: IntentVaultItem[]): IntentPatternInsight[] {
  const active = items.filter((i) => i.status === 'SAVED' || i.status === 'PLANNED');
  if (active.length < 2) return [];

  const byNeighborhood = new Map<string, number>();
  const byCategory = new Map<string, number>();

  for (const item of active) {
    if (item.neighborhood_tag?.trim()) {
      const nb = item.neighborhood_tag.trim();
      byNeighborhood.set(nb, (byNeighborhood.get(nb) || 0) + 1);
    }
    if (item.category_tag) {
      byCategory.set(item.category_tag, (byCategory.get(item.category_tag) || 0) + 1);
    }
  }

  const insights: IntentPatternInsight[] = [];

  for (const [nb, count] of byNeighborhood.entries()) {
    if (count >= 2) {
      insights.push({
        id: `nb-${nb}`,
        kind: 'neighborhood',
        label: nb,
        count,
        summary: `Você guardou ${count} desejos em ${nb}. Baseado diretamente nos itens ativos do seu Cofre.`,
        suggested_prompt: `Roteiro em ${nb} combinando meus itens salvos no Cofre`,
      });
    }
  }

  for (const [cat, count] of byCategory.entries()) {
    if (count >= 2) {
      insights.push({
        id: `cat-${cat}`,
        kind: 'category',
        label: cat,
        count,
        summary: `${count} itens do seu Cofre concentram-se em ${cat}.`,
        suggested_prompt: `Experiência de ${cat} no Rio usando meu Cofre`,
      });
    }
  }

  return insights.sort((a, b) => b.count - a.count).slice(0, 3);
}
