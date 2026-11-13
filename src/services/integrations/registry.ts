export type IntegrationStatus =
  | 'OPERATIONAL'
  | 'CONFIGURABLE'
  | 'OPERATIONAL_DEEP_LINK'
  | 'PENDING_CREDENTIALS';

export interface ExternalIntegrationSpec {
  id: string;
  name: string;
  domain: 'maps' | 'weather' | 'traffic' | 'ai' | 'whatsapp' | 'calendar' | 'bookings' | 'payments';
  provider: string;
  docsUrl: string;
  status: IntegrationStatus;
  requiresCredentials: boolean;
  envVarName?: string;
  costAndLimits: string;
  licensingNotes: string;
}

export const EXTERNAL_INTEGRATIONS_REGISTRY: ExternalIntegrationSpec[] = [
  {
    id: 'osm-overpass',
    name: 'Mapas & POIs (OpenStreetMap / Overpass)',
    domain: 'maps',
    provider: 'OpenStreetMap Foundation / Overpass API',
    docsUrl: 'https://wiki.openstreetmap.org/wiki/Overpass_API',
    status: 'OPERATIONAL',
    requiresCredentials: false,
    costAndLimits: 'Gratuito (rate limit comunitário por IP)',
    licensingNotes: 'Licença aberta ODbL com atribuição obrigatória ao OpenStreetMap.',
  },
  {
    id: 'google-places',
    name: 'Google Places API (New)',
    domain: 'maps',
    provider: 'Google Maps Platform',
    docsUrl: 'https://developers.google.com/maps/documentation/places/web-service/op-overview',
    status: 'CONFIGURABLE',
    requiresCredentials: true,
    envVarName: 'VITE_GOOGLE_PLACES_API_KEY (ou chave no Admin / Backend)',
    costAndLimits: 'Pay-as-you-go (crédito mensal gratuito limitado)',
    licensingNotes: 'Proibido scraping e armazenamento/redistribuição indevida de fotos e conteúdo fora dos Termos.',
  },
  {
    id: 'open-meteo',
    name: 'Clima em Tempo Real (Rio de Janeiro)',
    domain: 'weather',
    provider: 'Open-Meteo Weather API',
    docsUrl: 'https://open-meteo.com/en/docs',
    status: 'OPERATIONAL',
    requiresCredentials: false,
    costAndLimits: 'Gratuito para uso não-comercial até 10.000 req/dia; planos pagos para escala comercial',
    licensingNotes: 'CC BY 4.0 (atribuição requerida).',
  },
  {
    id: 'gemini-ai',
    name: 'Concierge & Roteiros IA',
    domain: 'ai',
    provider: 'Google Gemini API',
    docsUrl: 'https://ai.google.dev/gemini-api/docs',
    status: 'CONFIGURABLE',
    requiresCredentials: true,
    envVarName: 'GEMINI_API_KEY (preferencialmente via backend proxy)',
    costAndLimits: 'Tier gratuito com limite RPM/TPM; pay-as-you-go para produção',
    licensingNotes: 'Respostas baseadas exclusivamente nos registros reais cadastrados no catálogo.',
  },
  {
    id: 'whatsapp-business',
    name: 'WhatsApp Business Cloud API',
    domain: 'whatsapp',
    provider: 'Meta for Developers',
    docsUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api',
    status: 'PENDING_CREDENTIALS',
    requiresCredentials: true,
    envVarName: 'WHATSAPP_CLOUD_TOKEN / PHONE_NUMBER_ID (Backend)',
    costAndLimits: 'Cobrança por conversa (utility/marketing) após franquia',
    licensingNotes: 'Requer opt-in explícito do usuário (LGPD) e conta verificada Meta Business.',
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar (Link Direto / OAuth)',
    domain: 'calendar',
    provider: 'Google Workspace / Calendar Intent',
    docsUrl: 'https://developers.google.com/calendar/api/guides/overview',
    status: 'OPERATIONAL_DEEP_LINK',
    requiresCredentials: false,
    costAndLimits: 'Gratuito via link de evento; OAuth2 gratuito com cota de API',
    licensingNotes: 'Apenas eventos explicitamente adicionados pelo usuário.',
  },
  {
    id: 'mobility-deeplinks',
    name: 'Mobilidade (Uber / 99 / Google Maps)',
    domain: 'traffic',
    provider: 'Deep Links Universais',
    docsUrl: 'https://developer.uber.com/docs/riders/ride-requests/tutorials/deep-links/introduction',
    status: 'OPERATIONAL_DEEP_LINK',
    requiresCredentials: false,
    costAndLimits: 'Gratuito via URL schemes',
    licensingNotes: 'Estimativa de distância/tempo calculada localmente; tarifa real exibida no app parceiro.',
  },
  {
    id: 'payments-stripe',
    name: 'Pagamentos & Ingressos (Club / Drops)',
    domain: 'payments',
    provider: 'Stripe / MercadoPago (A integrar)',
    docsUrl: 'https://stripe.com/docs/api',
    status: 'PENDING_CREDENTIALS',
    requiresCredentials: true,
    envVarName: 'STRIPE_SECRET_KEY / WEBHOOK_SECRET (Backend)',
    costAndLimits: 'Taxa por transação aprovada',
    licensingNotes: 'Fluxo financeiro atual claramente marcado como demonstrativo sem cobrança real.',
  },
];

export interface RioWeatherSnapshot {
  temperatureC: number;
  isRaining: boolean;
  weatherLabel: string;
  source: 'open-meteo-live' | 'unavailable';
}

export async function fetchRioWeatherLive(): Promise<RioWeatherSnapshot> {
  try {
    const res = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=-22.9068&longitude=-43.1729&current=temperature_2m,precipitation,weather_code&timezone=America%2FSao_Paulo'
    );
    if (!res.ok) throw new Error('Weather API unavailable');
    const data = (await res.json()) as {
      current?: { temperature_2m?: number; precipitation?: number; weather_code?: number };
    };
    const temp = data.current?.temperature_2m ?? 26;
    const precip = data.current?.precipitation ?? 0;
    const code = data.current?.weather_code ?? 0;
    const isRaining = precip > 0.2 || code >= 51;

    return {
      temperatureC: Math.round(temp),
      isRaining,
      weatherLabel: isRaining ? 'Chuva / Tempo fechado no Rio' : 'Tempo aberto no Rio',
      source: 'open-meteo-live',
    };
  } catch {
    return {
      temperatureC: 26,
      isRaining: false,
      weatherLabel: 'Clima em tempo real indisponível',
      source: 'unavailable',
    };
  }
}
