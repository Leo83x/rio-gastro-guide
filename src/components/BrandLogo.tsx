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
      style={
        onDark
          ? {
              filter:
                'brightness(1.2) drop-shadow(0 0 1px rgba(255,255,255,0.85)) drop-shadow(0 2px 8px rgba(255,255,255,0.2))',
            }
          : undefined
      }
      className={`${PNG_HEIGHTS[size]} w-auto max-w-full shrink-0 object-contain transition duration-200`}
    />
  );

  if (variant === 'vertical') {
    return (
      <div className={`inline-flex flex-col items-center gap-1.5 ${className}`}>
        {imageEl}
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
      {imageEl}
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
