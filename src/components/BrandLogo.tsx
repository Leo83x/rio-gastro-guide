import logoPng from '../assets/brand/borario-logo.png';

interface BrandLogoProps {
  variant?: 'horizontal' | 'vertical' | 'symbol';
  size?: 'sm' | 'md' | 'lg';
  onDark?: boolean;
  showTagline?: boolean;
  className?: string;
}

const SIZE_HEIGHTS = {
  sm: 'h-7',
  md: 'h-9',
  lg: 'h-12',
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

  if (variant === 'vertical') {
    return (
      <div className={`inline-flex flex-col items-center gap-1.5 ${className}`}>
        <div
          className={`inline-flex items-center justify-center rounded-2xl transition-colors ${
            onDark ? 'bg-white/95 px-3 py-1.5 shadow-sm' : ''
          }`}
        >
          <img
            src={logoPng}
            alt="BoraRio"
            className={`${SIZE_HEIGHTS[size]} w-auto object-contain`}
          />
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
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <div
        className={`inline-flex items-center rounded-xl transition-colors ${
          onDark ? 'bg-white/95 px-2.5 py-1 shadow-sm' : ''
        }`}
      >
        <img
          src={logoPng}
          alt="BoraRio"
          className={`${SIZE_HEIGHTS[size]} w-auto object-contain`}
        />
      </div>
      {showTagline && (
        <span
          className={`hidden text-xs font-medium xl:inline ${
            onDark ? 'text-[#F1E8D8]' : 'text-[var(--text-secondary)]'
          }`}
        >
          A cidade acontece. Você aproveita.
        </span>
      )}
    </div>
  );
}
