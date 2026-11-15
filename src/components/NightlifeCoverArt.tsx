import { Disc3, Mic2, Music, Sparkles, Wine } from 'lucide-react';
import { useState } from 'react';
import {
  NIGHTLIFE_SUBAREA_META,
  type NightlifeImageOrigin,
  type NightlifeSubArea,
} from '../types/nightlife';

interface NightlifeCoverArtProps {
  src?: string;
  alt: string;
  subArea: NightlifeSubArea;
  imageOrigin: NightlifeImageOrigin;
  compact?: boolean;
  className?: string;
}

function SubAreaIcon({ subArea, compact }: { subArea: NightlifeSubArea; compact: boolean }) {
  const cls = compact ? 'h-4 w-4 text-[#F7931E]' : 'h-6 w-6 text-[#F7931E]';
  switch (subArea) {
    case 'SAMBA_PAGODE':
      return <Music className={cls} />;
    case 'FESTAS_BALADAS':
      return <Disc3 className={cls} />;
    case 'SHOWS':
      return <Mic2 className={cls} />;
    case 'ROOFTOPS_EXPERIENCIAS':
      return <Wine className={cls} />;
    default:
      return <Sparkles className={cls} />;
  }
}

export function NightlifeCoverArt({
  src,
  alt,
  subArea,
  imageOrigin,
  compact = false,
  className = '',
}: NightlifeCoverArtProps) {
  const [failedSrc, setFailedSrc] = useState<string>('');
  const cleanSrc = (src || '').trim();
  const hasUsablePhoto =
    Boolean(cleanSrc) &&
    imageOrigin !== 'NONE' &&
    imageOrigin !== 'ILLUSTRATIVE_CATEGORY_FALLBACK' &&
    failedSrc !== cleanSrc;

  if (!hasUsablePhoto) {
    const meta = NIGHTLIFE_SUBAREA_META[subArea];
    return (
      <div
        className={`relative flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br ${meta.fallbackTint} text-white select-none ${className}`}
      >
        <div className="pointer-events-none absolute inset-2 rounded-xl border border-white/15" />
        <div className="relative z-10 flex flex-col items-center px-3 text-center">
          <div
            className={`flex items-center justify-center rounded-full border border-white/25 bg-white/10 backdrop-blur-md ${
              compact ? 'h-9 w-9' : 'h-12 w-12'
            }`}
          >
            <SubAreaIcon subArea={subArea} compact={compact} />
          </div>
          {!compact && (
            <span className="mt-2 rounded-full border border-white/15 bg-black/25 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/85">
              {meta.shortLabel}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <img
      src={cleanSrc}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(cleanSrc)}
      className={className}
    />
  );
}
