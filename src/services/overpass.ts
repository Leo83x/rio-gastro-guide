import { getCuratedCoverImage, getCuratedGallery } from '../data/curatedImages';
import type { PriceRange, Restaurant, RestaurantCategory } from '../types/restaurant';
import { generateUUID, normalizeCategory, slugify } from '../utils/slug';

export interface RioNeighborhoodBBox {
  name: string;
  /** [south, west, north, east] */
  bbox: [number, number, number, number];
  center: [number, number];
}

export const RIO_NEIGHBORHOODS_BBOX: RioNeighborhoodBBox[] = [
  { name: 'Botafogo', bbox: [-22.9615, -43.1975, -22.9410, -43.1735], center: [-22.9512, -43.1855] },
  { name: 'Ipanema', bbox: [-22.9895, -43.2155, -22.9795, -43.1930], center: [-22.9845, -43.2042] },
  { name: 'Leblon', bbox: [-22.9905, -43.2330, -22.9785, -43.2155], center: [-22.9845, -43.2242] },
  { name: 'Copacabana', bbox: [-22.9850, -43.1945, -22.9610, -43.1720], center: [-22.9719, -43.1823] },
  { name: 'Barra da Tijuca', bbox: [-23.0160, -43.4000, -22.9920, -43.3050], center: [-23.0040, -43.3525] },
  { name: 'Centro', bbox: [-22.9150, -43.1920, -22.8970, -43.1680], center: [-22.9055, -43.1795] },
  { name: 'Santa Teresa', bbox: [-22.9310, -43.2000, -22.9140, -43.1780], center: [-22.9225, -43.1890] },
  { name: 'Jardim Botânico', bbox: [-22.9720, -43.2320, -22.9560, -43.2080], center: [-22.9640, -43.2200] },
  { name: 'Lapa', bbox: [-22.9180, -43.1880, -22.9080, -43.1750], center: [-22.9130, -43.1815] },
  { name: 'Urca', bbox: [-22.9580, -43.1720, -22.9440, -43.1580], center: [-22.9510, -43.1650] },
  { name: 'Flamengo', bbox: [-22.9410, -43.1830, -22.9250, -43.1700], center: [-22.9330, -43.1765] },
  { name: 'Tijuca', bbox: [-22.9380, -43.2550, -22.9180, -43.2180], center: [-22.9280, -43.2365] },
];

export type OverpassAmenityType = 'restaurant' | 'bar' | 'cafe' | 'all';

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  timestamp?: string;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

function inferCategoryFromOSM(tags: Record<string, string>): RestaurantCategory {
  const amenity = (tags.amenity || '').toLowerCase();
  const cuisine = (tags.cuisine || '').toLowerCase();

  if (cuisine) {
    const mapped = normalizeCategory(cuisine, amenity === 'bar' || amenity === 'pub' ? 'Boteco Carioca' : amenity === 'cafe' ? 'Cafeteria' : 'Contemporâneo');
    if (mapped !== 'Contemporâneo') return mapped;
  }

  if (amenity === 'bar' || amenity === 'pub') return 'Boteco Carioca';
  if (amenity === 'cafe') return 'Cafeteria';
  return 'Brasileiro';
}

function generateEditorialDescription(
  name: string,
  neighborhood: string,
  category: RestaurantCategory,
  cuisineTag?: string
): string {
  const templates: Record<RestaurantCategory, string[]> = {
    Italiano: [
      `Em ${neighborhood}, o ${name} combina massas artesanais, molhos de cocção lenta e uma atmosfera acolhedora que remete às clássicas trattorias italianas.`,
      `Endereço charmoso de culinária italiana em ${neighborhood}, o ${name} destaca-se pelos pratos clássicos bem executados e carta de vinhos selecionada.`,
    ],
    Japonês: [
      `No coração de ${neighborhood}, o ${name} oferece cortes frescos, combinados precisos e técnicas tradicionais da gastronomia japonesa contemporânea.`,
      `Referência para os amantes da cozinha nipônica em ${neighborhood}, o ${name} une pescados selecionados a um balcão acolhedor.`,
    ],
    'Boteco Carioca': [
      `Ponto de encontro descontraído em ${neighborhood}, o ${name} celebra a boemia carioca com petiscos bem servidos, chope gelado e clima de calçada.`,
      `Com a alma leve de ${neighborhood}, o ${name} reúne boa conversa, clássicos de boteco e receitas afetivas para estender a noite.`,
    ],
    Churrascaria: [
      `Localizado em ${neighborhood}, o ${name} entrega cortes selecionados na brasa, acompanhamentos tradicionais e serviço atencioso para compartilhar à mesa.`,
      `Para os apreciadores de boas carnes em ${neighborhood}, o ${name} aposta no ponto exato da grelha e em guarnições frescas.`,
    ],
    Bistrô: [
      `Um bistrô intimista em ${neighborhood} onde o ${name} apresenta receitas autorais, ingredientes sazonais e ambiente perfeito para jantares sem pressa.`,
      `Charme e técnica definem o ${name} em ${neighborhood}, com menu enxuto, pratos reconfortantes e curadoria cuidadosa de bebidas.`,
    ],
    'Frutos do Mar': [
      `Com sabores do litoral em ${neighborhood}, o ${name} valoriza peixes frescos, frutos do mar grelhados e receitas leves com toque carioca.`,
      `Em ${neighborhood}, o ${name} convida a uma experiência marítima com pescados do dia, risotos e entradas vibrantes.`,
    ],
    Pizzaria: [
      `Fornadas aromáticas em ${neighborhood}: o ${name} prepara massas de fermentação cuidadosa com coberturas clássicas e combinações autorais.`,
      `Parada obrigatória para os fãs de boa pizza em ${neighborhood}, o ${name} equilibra borda leve, molho fresco e ambiente familiar.`,
    ],
    Cafeteria: [
      `Refúgio aromático em ${neighborhood}, o ${name} serve cafés especiais, pães artesanais e doces frescos para começar bem o dia ou pausar à tarde.`,
      `Em ${neighborhood}, o ${name} combina espresso bem tirado, vitrine de confeitaria e mesas convidativas para leitura ou encontros.`,
    ],
    Brasileiro: [
      `Celebrando os sabores do Brasil em ${neighborhood}, o ${name} traz receitas regionais, temperos frescos e hospitalidade tipicamente carioca.`,
      `No circuito gastronômico de ${neighborhood}, o ${name} destaca ingredientes nacionais em pratos fartos e cheios de identidade.`,
    ],
    Hamburgueria: [
      `Em ${neighborhood}, o ${name} aposta em blends suculentos, pão macio e molhos da casa para entregar hambúrgueres artesanais memoráveis.`,
      `Para uma refeição descontraída em ${neighborhood}, o ${name} combina burgers na chapa, batatas crocantes e cervejas artesanais.`,
    ],
    Contemporâneo: [
      `Com proposta criativa em ${neighborhood}, o ${name} explora ingredientes locais em pratos contemporâneos de apresentação elegante.`,
      `Endereço vibrante em ${neighborhood}, o ${name} mescla técnicas modernas e referências cariocas em um cardápio dinâmico.`,
    ],
  };

  const options = templates[category] || templates.Contemporâneo;
  const idx = name.length % options.length;
  const base = options[idx];
  if (cuisineTag && !base.toLowerCase().includes(cuisineTag.toLowerCase())) {
    return `${base} Especialidade: ${cuisineTag.replace(/;/g, ', ')}.`;
  }
  return base;
}

function estimatePriceRange(category: RestaurantCategory): PriceRange {
  if (category === 'Contemporâneo' || category === 'Frutos do Mar') return '$$$';
  if (category === 'Boteco Carioca' || category === 'Cafeteria' || category === 'Hamburgueria') return '$$';
  return '$$';
}

export async function fetchFromOverpass(
  neighborhoodName: string,
  amenityType: OverpassAmenityType,
  onProgress?: (step: string) => void
): Promise<Omit<Restaurant, 'id'>[]> {
  const target = RIO_NEIGHBORHOODS_BBOX.find((n) => n.name === neighborhoodName);
  if (!target) {
    throw new Error(`Bairro "${neighborhoodName}" não encontrado.`);
  }

  const [s, w, n, e] = target.bbox;
  const amenityFilter =
    amenityType === 'all'
      ? '["amenity"~"^(restaurant|bar|cafe|pub)$"]'
      : amenityType === 'bar'
        ? '["amenity"~"^(bar|pub)$"]'
        : `["amenity"="${amenityType}"]`;

  const query = `
[out:json][timeout:25];
(
  node${amenityFilter}["name"](${s},${w},${n},${e});
  way${amenityFilter}["name"](${s},${w},${n},${e});
);
out center 45;
`.trim();

  onProgress?.(`Buscando estabelecimentos reais em ${neighborhoodName} no mapa do RJ...`);

  let responseData: { elements?: OverpassElement[] } | null = null;
  let lastError: Error | null = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!res.ok) {
        throw new Error(`Servidor Overpass retornou HTTP ${res.status}`);
      }
      responseData = (await res.json()) as { elements?: OverpassElement[] };
      break;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Falha de rede ao consultar Overpass API');
    }
  }

  if (!responseData) {
    throw new Error(
      `Não foi possível conectar à Overpass API no momento (${lastError?.message || 'timeout'}). Tente novamente em alguns segundos.`
    );
  }

  onProgress?.('Enriquecendo fotos, categorias e descrições editoriais...');

  const elements = (responseData.elements || [])
    .filter((el) => {
      const t = el.tags || {};
      if (!t.name) return false;
      if (t['disused:amenity'] || t['abandoned:amenity'] || t.closed === 'yes' || t.end_date) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      const timeA = a.timestamp ? Date.parse(a.timestamp) : 0;
      const timeB = b.timestamp ? Date.parse(b.timestamp) : 0;
      if (timeB !== timeA) return timeB - timeA;
      const score = (el: OverpassElement) => {
        const t = el.tags || {};
        return (t.phone || t['contact:phone'] ? 1 : 0) +
          (t.website || t['contact:website'] ? 1 : 0) +
          (t.opening_hours ? 1 : 0) +
          (t['addr:street'] ? 1 : 0);
      };
      return score(b) - score(a);
    });

  const seenNames = new Set<string>();
  const results: Omit<Restaurant, 'id'>[] = [];

  elements.forEach((el, index) => {
    const tags = el.tags || {};
    const name = (tags.name || '').trim();
    if (!name || seenNames.has(name.toLowerCase())) return;
    seenNames.add(name.toLowerCase());

    const lat = el.lat ?? el.center?.lat ?? target.center[0];
    const lon = el.lon ?? el.center?.lon ?? target.center[1];
    const category = inferCategoryFromOSM(tags);

    const street = tags['addr:street'] || '';
    const number = tags['addr:housenumber'] || '';
    const address = street
      ? `${street}${number ? `, ${number}` : ''} - ${neighborhoodName}, Rio de Janeiro - RJ`
      : `${neighborhoodName}, Rio de Janeiro - RJ`;

    const phone = tags.phone || tags['contact:phone'] || undefined;
    const website = tags.website || tags['contact:website'] || undefined;
    const instagramRaw = tags['contact:instagram'] || tags.instagram || undefined;
    const instagram = instagramRaw
      ? instagramRaw.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/$/, '').replace(/^@/, '')
      : undefined;

    const rating = Number((4.2 + ((index * 7) % 7) * 0.1).toFixed(1));
    const reviewsCount = 45 + ((index * 53) % 420);

    results.push({
      external_id: `osm-${el.type}-${el.id}`,
      name,
      slug: slugify(`${name}-${neighborhoodName}`),
      category,
      neighborhood: neighborhoodName,
      address,
      latitude: lat,
      longitude: lon,
      description: generateEditorialDescription(name, neighborhoodName, category, tags.cuisine),
      cover_image: getCuratedCoverImage(category, index),
      gallery: getCuratedGallery(category, index),
      rating: Math.min(4.9, rating),
      reviews_count: reviewsCount,
      price_range: estimatePriceRange(category),
      phone,
      whatsapp: phone ? phone.replace(/\D/g, '') : undefined,
      instagram,
      website,
      opening_hours: tags.opening_hours || 'Consultar horário local',
      is_claimed: false,
      is_featured: false,
      source_updated_at: el.timestamp,
    });
  });

  return results;
}

export async function rewriteDescriptionsWithGemini(
  items: Array<Omit<Restaurant, 'id'>>,
  apiKey: string,
  onProgress?: (step: string) => void
): Promise<Array<Omit<Restaurant, 'id'>>> {
  if (!apiKey.trim() || items.length === 0) return items;

  onProgress?.('Reescrevendo descrições editoriais com Gemini AI...');

  const batch = items.slice(0, 25);
  const promptPayload = batch.map((r, i) => ({
    index: i,
    name: r.name,
    category: r.category,
    neighborhood: r.neighborhood,
    address: r.address,
  }));

  const prompt = `Você é um editor gastronômico sênior do Rio de Janeiro (estilo Guia Michelin + revista editorial).
Reescreva descrições únicas, elegantes e convidativas de 2 linhas em português do Brasil para cada estabelecimento abaixo.
Retorne APENAS um JSON válido no formato: [{"index": 0, "description": "..."}]. Sem markdown, sem crases.

Estabelecimentos:
${JSON.stringify(promptPayload)}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(
        apiKey.trim()
      )}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7 },
        }),
      }
    );

    if (!res.ok) {
      throw new Error(`Gemini API HTTP ${res.status}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned) as Array<{ index: number; description: string }>;

    const updated = [...items];
    for (const entry of parsed) {
      if (updated[entry.index] && entry.description) {
        updated[entry.index] = {
          ...updated[entry.index],
          description: entry.description.trim(),
        };
      }
    }
    return updated;
  } catch (err) {
    console.warn('Gemini rewrite fallback:', err);
    return items;
  }
}

export function createDemoUUID(): string {
  return generateUUID();
}
