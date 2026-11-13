import logoPng from '../assets/brand/borario-logo.png';

interface BrandLogoProps {
  variant?: 'horizontal' | 'vertical' | 'symbol';
  size?: 'sm' | 'md' | 'lg';
  onDark?: boolean;
  showTagline?: boolean;
  className?: string;
}

const PNG_HEIGHTS = {
  sm: 'h-7 sm:h-8',
  md: 'h-8 sm:h-9',
  lg: 'h-10 sm:h-12',
};

export function BrandLogo({
  variant = 'horizontal',
  size = 'md',
  onDark = false,
  showTagline = false,
  className = '',
}: BrandLogoProps) {
  if (variant === 'symbol') {
    const dim = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-12 w-12' : 'h-10 w-10';
    return (
      <img
        src="/brand/borario-icon-192.png"
        alt="BoraRio"
        className={`${dim} shrink-0 rounded-xl object-contain shadow-sm ${className}`}
      />
    );
  }

  const imageEl = (
    <img
      src={logoPng}
      alt="BoraRio"
      className={`${PNG_HEIGHTS[size]} w-auto max-w-full shrink-0 object-contain`}
    />
  );

  if (variant === 'vertical') {
    return (
      <div className={`inline-flex flex-col items-center gap-1.5 ${className}`}>
        <div
          className={`inline-flex items-center justify-center rounded-2xl transition-colors ${
            onDark ? 'bg-white/95 px-3 py-1 shadow-sm' : ''
          }`}
        >
          {imageEl}
        </div>
        {showTagline && (
          <span
            className={`text-[11px] font-semibold tracking-wide ${
              onDark ? 'text-[#F1E8D8]' : 'text-[var(--text-secondary)]'
            }`}
          >
            A cidade acontece. Você aproveita.
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`inline-flex max-w-full items-center gap-2 ${className}`}>
      <div
        className={`inline-flex items-center rounded-xl transition-colors ${
          onDark ? 'bg-white/95 px-2.5 py-0.5 shadow-sm' : ''
        }`}
      >
        {imageEl}
      </div>
      {showTagline && (
        <span
          className={`hidden text-xs font-medium xl:inline ${
            onDark ? 'text-[#F1E8D8]' : 'text-[var(--text-secondary)]'
          }`}
        >
          · A cidade acontece. Você aproveita.
        </span>
      )}
    </div>
  );
}
