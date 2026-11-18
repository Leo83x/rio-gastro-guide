import type { PartnerVipInviteConfig } from '../types/growth';
import { supabase } from './supabaseClient';

const VIP_CONFIGS_CACHE_KEY = 'borario_partner_vip_invite_configs_v1';

function readCache(): Record<string, PartnerVipInviteConfig> {
  try {
    const raw = localStorage.getItem(VIP_CONFIGS_CACHE_KEY);
    if (!raw) return {};
    return (JSON.parse(raw) as Record<string, PartnerVipInviteConfig>) || {};
  } catch {
    return {};
  }
}

function writeCache(map: Record<string, PartnerVipInviteConfig>): void {
  try {
    localStorage.setItem(VIP_CONFIGS_CACHE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota errors
  }
}

export function getCachedPartnerVipConfig(restaurantId: string): PartnerVipInviteConfig | null {
  if (!restaurantId) return null;
  const map = readCache();
  return map[restaurantId] || null;
}

export async function fetchPartnerVipConfig(
  restaurantId: string
): Promise<PartnerVipInviteConfig | null> {
  if (!restaurantId) return null;
  try {
    const res = await fetch(
      `/api/referrals/vip-config?restaurantId=${encodeURIComponent(restaurantId)}`
    );
    if (res.ok) {
      const json = (await res.json()) as {
        ok?: boolean;
        config?: PartnerVipInviteConfig | null;
      };
      if (json.ok && json.config) {
        const map = readCache();
        map[restaurantId] = json.config;
        writeCache(map);
        return json.config;
      }
      if (json.ok && json.config === null) {
        return null;
      }
    }
  } catch {
    // Fallback para cache local
  }
  return getCachedPartnerVipConfig(restaurantId);
}

export async function savePartnerVipConfigOnServer(params: {
  restaurantId: string;
  offeringId?: string | null;
  enabled: boolean;
  benefitTitle: string;
  conditionsText?: string;
  maxInvitesPerCheckin: number;
  totalQuota?: number | null;
  validDaysAfterCheckin: number;
}): Promise<{ ok: boolean; config?: PartnerVipInviteConfig; message: string }> {
  try {
    const session = supabase ? (await supabase.auth.getSession()).data.session : null;
    if (!session?.access_token) {
      return {
        ok: false,
        message: 'Sessão autenticada do estabelecimento obrigatória para salvar no servidor.',
      };
    }

    const res = await fetch('/api/referrals/vip-config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(params),
    });

    const json = (await res.json()) as {
      ok?: boolean;
      config?: PartnerVipInviteConfig;
      message?: string;
    };

    if (!res.ok || !json.ok || !json.config) {
      return {
        ok: false,
        message: json.message || 'Não foi possível salvar a configuração de Convites VIP.',
      };
    }

    const map = readCache();
    map[params.restaurantId] = json.config;
    writeCache(map);

    return {
      ok: true,
      config: json.config,
      message: 'Configuração de Convite VIP salva no servidor.',
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Erro de rede ao salvar Convite VIP.',
    };
  }
}
