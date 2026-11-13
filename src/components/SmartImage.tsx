import {
  Beef,
  CameraOff,
  Coffee,
  Fish,
  Flame,
  Pizza,
  Sandwich,
  Sparkles,
  UtensilsCrossed,
  Wine,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ImageOrigin, RestaurantCategory } from '../types/restaurant';

interface SmartImageProps {
  src?: string;
  alt: string;
  category: RestaurantCategory;
  name?: string;
  imageOrigin?: ImageOrigin;
  hasRealPhoto?: boolean;
  compact?: boolean;
  className?: string;
}

function getCategoryIcon(category: RestaurantCategory) {
  switch (category) {
    case 'Pizzaria':
      return Pizza;
    case 'Frutos do Mar':
      return Fish;
    case 'Cafeteria':
      return Coffee;
    case 'Boteco Carioca':
      return Wine;
    case 'Churrascaria':
      return Flame;
    case 'Hamburgueria':
      return Sandwich;
    case 'Japonês':
      return Fish;
    case 'Brasileiro':
      return Beef;
    case 'Contemporâneo':
    case 'Bistrô':
      return Sparkles;
    default:
      return UtensilsCrossed;
  }
}

export function SmartImage({
  src,
  alt,
  category,
  name,
  imageOrigin,
  hasRealPhoto,
  compact = false,
  className = '',
}: SmartImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const shouldShowPlaceholder =
    !src ||
    src.trim() === '' ||
    failed ||
    imageOrigin === 'none' ||
    hasRealPhoto === false;

  if (shouldShowPlaceholder) {
    const Icon = getCategoryIcon(category);
    return (
      <div
        className={`relative flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#1C1917] via-[#26221F] to-[#141210] text-[#FAF8F5] select-none ${className}`}
      >
        {/* Subtle editorial frame */}
        <div className="pointer-events-none absolute inset-2 rounded-xl border border-white/10" />

        <div className="relative z-10 flex flex-col items-center px-3 text-center">
          <div
            className={`flex items-center justify-center rounded-full border border-[#E05A47]/40 bg-[#E05A47]/15 text-[#E05A47] ${
              compact ? 'h-8 w-8' : 'h-12 w-12'
            }`}
          >
            <Icon className={compact ? 'h-4 w-4' : 'h-6 w-6'} />
          </div>

          {!compact && (
            <>
              <span className="mt-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">
                {category}
              </span>
              {name && (
                <span className="font-editorial mt-0.5 line-clamp-1 max-w-[220px] text-sm font-semibold text-white/90">
                  {name}
                </span>
              )}
              <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] text-white/60">
                <CameraOff className="h-2.5 w-2.5" />
                Fotografia oficial não disponível
              </span>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
