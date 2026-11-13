import logoPng from '../assets/brand/borario-logo.png';

interface BrandLogoProps {
  variant?: 'horizontal' | 'vertical' | 'symbol';
  size?: 'sm' | 'md' | 'lg';
  onDark?: boolean;
  showTagline?: boolean;
  className?: string;
}

const PNG_HEIGHTS = {
  sm: 'h-10 sm:h-12',
  md: 'h-11 sm:h-14',
  lg: 'h-14 sm:h-16',
};

export function BrandLogo({
  variant = 'horizontal',
  size = 'md',
  onDark = false,
  showTagline = false,
  className = '',
}: BrandLogoProps) {
  if (variant === 'symbol') {
    const dim = size === 'sm' ? 'h-9 w-9' : size === 'lg' ? 'h-14 w-14' : 'h-11 w-11';
    return (
      <img
        src="/brand/borario-icon-192.png"
        alt="BoraRio"
        className={`${dim} shrink-0 rounded-xl object-contain ${className}`}
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
