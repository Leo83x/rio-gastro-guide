import { BadgeCheck, Bookmark, Gift, HeartHandshake, MapPin, Sparkles, Star } from 'lucide-react';
import { useMemo } from 'react';
import { getPartnerOfferings } from '../services/opportunityStore';
import type { Restaurant } from '../types/restaurant';
import { SmartImage } from './SmartImage';

interface RestaurantCardProps {
  restaurant: Restaurant;
  index: number;
  matchScore?: number | null;
  matchReason?: string;
  inVault?: boolean;
  confiaCount?: number;
  distanceKm?: number | null;
  onSaveToVault?: (restaurant: Restaurant) => void;
  onSelect: (restaurant: Restaurant) => void;
}

export function RestaurantCard({
  restaurant,
  matchScore,
  matchReason,
  inVault = false,
  confiaCount = 0,
  distanceKm,
  onSaveToVault,
  onSelect,
}: RestaurantCardProps) {
  const hasRating = restaurant.rating > 0 && restaurant.rating_source !== 'none';
  const showMatch = typeof matchScore === 'number' && matchScore >= 65;

  const activeOffering = useMemo(() => {
    try {
      const all = getPartnerOfferings();
      return all.find(
        (o) => o.restaurant_id === restaurant.id && o.status === 'PUBLISHED'
      );
    } catch {
      return undefined;
    }
  }, [restaurant.id]);

  const statusBadge =
    restaurant.operational_status === 'FECHADO' ||
    restaurant.validation_status === 'FECHADO/INVÁLIDO'
      ? { label: 'Fechado', cls: 'text-red-500' }
      : restaurant.is_claimed || restaurant.validation_status === 'CONFIRMADO'
        ? { label: 'Confirmado', cls: 'text-emerald-600 dark:text-emerald-400' }
        : null;

  return (
    <article
      onClick={() => onSelect(restaurant)}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-[#FF6B35]/50 hover:shadow-lg"
    >
      {/* Cover Image with smooth zoom */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[var(--bg-subtle)]">
        <SmartImage
          src={restaurant.cover_image}
          alt={restaurant.name}
          name={restaurant.name}
          category={restaurant.category}
          imageOrigin={restaurant.image_origin}
          hasRealPhoto={restaurant.has_real_photo}
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />

        {/* Top badges: Operational, Geographic & Distance */}
        <div className="absolute left-3 right-3 top-3 flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">
              <MapPin className="h-3 w-3 text-[#FF6B35]" />
              {restaurant.neighborhood}
            </span>
            {typeof distanceKm === 'number' && (
              <span className="rounded-full bg-black/60 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-md">
                {distanceKm < 1
                  ? `${Math.round(distanceKm * 1000)} m`
                  : `${distanceKm.toFixed(1)} km`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {restaurant.is_featured && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
                <Sparkles className="h-3 w-3" />
                Seleção
              </span>
            )}
            <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-[#102F46] backdrop-blur-md">
              {restaurant.attributes?.is_free ? 'Gratuito' : restaurant.price_range}
            </span>
            {onSaveToVault && (
              <button
                type="button"
                aria-label={inVault ? 'Salvo em Meus Desejos' : 'Salvar em Meus Desejos'}
                title={inVault ? 'Salvo em Meus Desejos' : 'Salvar em Meus Desejos'}
                onClick={(e) => {
                  e.stopPropagation();
                  onSaveToVault(restaurant);
                }}
                className={`flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-md transition ${
                  inVault
                    ? 'bg-[#FF6B35] text-white shadow-xs'
                    : 'bg-black/55 text-white hover:bg-[#FF6B35]'
                }`}
              >
                <Bookmark className={`h-3.5 w-3.5 ${inVault ? 'fill-current' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {/* Bottom category pill */}
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-lg bg-white/95 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#102F46] shadow-xs">
              {restaurant.macro_category && restaurant.macro_category !== 'Gastronomia'
                ? restaurant.macro_category === 'Turismo & Praias'
                  ? 'Passeios'
                  : restaurant.macro_category === 'Cultura & Museus'
                    ? 'Cultura'
                    : restaurant.macro_category === 'Vida Noturna' || restaurant.macro_category === 'Eventos & Shows'
                      ? 'Noite & Shows'
                      : restaurant.macro_category === 'Atrações Infantis'
                        ? 'Infantil'
                        : restaurant.macro_category
                : restaurant.category}
            </span>
            {confiaCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-[#397B68]/95 px-2 py-1 text-[10px] font-bold text-white shadow-xs">
                <HeartHandshake className="h-3 w-3" />
                Recomendado ({confiaCount})
              </span>
            )}
          </div>

          {hasRating && (
            <div className="inline-flex items-center gap-1 rounded-lg bg-black/75 px-2 py-1 text-xs font-semibold text-white backdrop-blur-md">
              <Star className="h-3.5 w-3.5 fill-[#F7931E] text-[#F7931E]" />
              <span>{restaurant.rating.toFixed(1)}</span>
              {restaurant.reviews_count > 0 && (
                <span className="text-[11px] font-normal text-white/75">
                  ({restaurant.reviews_count > 999
                    ? `${(restaurant.reviews_count / 1000).toFixed(1)}k`
                    : restaurant.reviews_count})
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="flex flex-1 flex-col justify-between p-4 sm:p-5">
        <div>
          {(showMatch || matchReason) && (
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-1.5 rounded-xl bg-[var(--bg-canvas)] px-2.5 py-1.5 text-[11px]">
              <span className="truncate font-semibold text-[var(--text-secondary)]">
                {matchReason || 'Afinidade com seu perfil'}
              </span>
              {showMatch && (
                <span className="shrink-0 rounded-full bg-[#397B68]/15 px-2 py-0.5 text-[10px] font-extrabold text-[#397B68] dark:text-[#4CA188]">
                  {matchScore}% Match
                </span>
              )}
            </div>
          )}

          {/* Camada de Benefício / Oportunidade Real */}
          {activeOffering && (
            <div className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-900 dark:text-emerald-200">
              <div className="flex items-center justify-between gap-1">
                <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-300">
                  <Gift className="h-3.5 w-3.5" />
                  Benefício disponível
                </span>
                {activeOffering.time_slot_label && (
                  <span className="text-[10px] font-medium text-emerald-700/80 dark:text-emerald-300/80">
                    {activeOffering.time_slot_label}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs font-semibold leading-snug text-[var(--text-primary)]">
                {activeOffering.benefit_summary || activeOffering.condition_badge}
              </p>
              <p className="mt-0.5 text-[10px] text-[var(--text-secondary)]">
                Condição válida conforme regras e disponibilidade da casa.
              </p>
            </div>
          )}

          <div className="flex items-start justify-between gap-2">
            <h3 className="font-sans text-lg font-bold leading-snug tracking-tight text-[var(--text-primary)] transition-colors group-hover:text-[#FF6B35]">
              {restaurant.name}
            </h3>
            {restaurant.is_claimed && (
              <span
                title="Perfil verificado pelo proprietário"
                className="mt-1 inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
              >
                <BadgeCheck className="h-4 w-4" />
              </span>
            )}
          </div>

          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--text-secondary)]">
            {restaurant.description}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--border-hairline)] pt-3 text-xs text-[var(--text-secondary)]">
          <div className="flex min-w-0 items-center gap-2">
            {statusBadge && (
              <span className={`shrink-0 text-[10px] font-bold uppercase ${statusBadge.cls}`}>
                {statusBadge.label}
              </span>
            )}
            <span className="truncate">{restaurant.address}</span>
          </div>
          <span className="shrink-0 font-bold text-[#FF6B35] group-hover:underline">
            {activeOffering ? 'Quero aproveitar →' : 'Conhecer experiência →'}
          </span>
        </div>
      </div>
    </article>
  );
}
