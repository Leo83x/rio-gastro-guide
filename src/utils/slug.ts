import type { PriceRange, RestaurantCategory } from '../types/restaurant';

export function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function normalizeCategory(raw?: string, fallback: RestaurantCategory = 'Contemporâneo'): RestaurantCategory {
  if (!raw) return fallback;
  const v = raw.toLowerCase();
  if (v.includes('ital') || v.includes('pasta') || v.includes('trattoria')) return 'Italiano';
  if (v.includes('japon') || v.includes('sushi') || v.includes('ramen') || v.includes('oriental')) return 'Japonês';
  if (v.includes('pizza')) return 'Pizzaria';
  if (v.includes('churras') || v.includes('steak') || v.includes('grill') || v.includes('parrilla') || v.includes('bbq'))
    return 'Churrascaria';
  if (v.includes('mar') || v.includes('seafood') || v.includes('peixe') || v.includes('fish') || v.includes('camar'))
    return 'Frutos do Mar';
  if (v.includes('caf') || v.includes('coffee') || v.includes('padaria') || v.includes('bakery') || v.includes('confeit'))
    return 'Cafeteria';
  if (v.includes('burg') || v.includes('hamburg') || v.includes('lanche')) return 'Hamburgueria';
  if (v.includes('boteco') || v.includes('bar') || v.includes('pub') || v.includes('cervej') || v.includes('chopp'))
    return 'Boteco Carioca';
  if (v.includes('bistr') || v.includes('franc') || v.includes('french')) return 'Bistrô';
  if (v.includes('brasil') || v.includes('regional') || v.includes('feijoada') || v.includes('mineir') || v.includes('nordest'))
    return 'Brasileiro';
  return fallback;
}

export function normalizePriceRange(raw?: string | number): PriceRange {
  if (!raw) return '$$';
  const str = String(raw).trim();
  if (str === '$' || str === '1') return '$';
  if (str === '$$' || str === '2') return '$$';
  if (str === '$$$' || str === '3') return '$$$';
  if (str === '$$$$' || str === '4') return '$$$$';
  const dollarCount = (str.match(/\$/g) || []).length;
  if (dollarCount >= 4) return '$$$$';
  if (dollarCount === 3) return '$$$';
  if (dollarCount === 2) return '$$';
  if (dollarCount === 1) return '$';
  return '$$';
}
