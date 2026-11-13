import { BadgeCheck, MapPin, Sparkles, Star } from 'lucide-react';
import type { Restaurant } from '../types/restaurant';
import { SmartImage } from './SmartImage';

interface RestaurantCardProps {
  restaurant: Restaurant;
  index: number;
  matchScore?: number | null;
  onSelect: (restaurant: Restaurant) => void;
}

export function RestaurantCard({ restaurant, matchScore, onSelect }: RestaurantCardProps) {
  const hasRating = restaurant.rating > 0 && restaurant.rating_source !== 'none';

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

        {/* Top badges */}
        <div className="absolute left-3 right-3 top-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">
              <MapPin className="h-3 w-3 text-[#FF6B35]" />
              {restaurant.neighborhood}
            </span>
            {matchScore && matchScore >= 75 && (
              <span className="rounded-full bg-[#397B68]/95 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-md">
                {matchScore}% Match
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
          </div>
        </div>

        {/* Bottom category pill */}
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
          <span className="rounded-lg bg-white/95 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#102F46] shadow-xs">
            {restaurant.macro_category && restaurant.macro_category !== 'Gastronomia'
              ? restaurant.macro_category
              : restaurant.category}
          </span>

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

        <div className="mt-4 flex items-center justify-between border-t border-[var(--border-hairline)] pt-3 text-xs text-[var(--text-secondary)]">
          <span className="truncate pr-2">{restaurant.address}</span>
          <span className="shrink-0 font-bold text-[#FF6B35] group-hover:underline">
            Ver guia →
          </span>
        </div>
      </div>
    </article>
  );
}
