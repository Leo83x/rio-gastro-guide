import logoPng from '../assets/brand/borario-logo.png';

interface BrandLogoProps {
  variant?: 'horizontal' | 'vertical' | 'symbol' | 'graphic';
  size?: 'sm' | 'md' | 'lg';
  onDark?: boolean;
  showTagline?: boolean;
  showEmblem?: boolean;
  className?: string;
}

const TEXT_SIZES = {
  sm: 'text-xl',
  md: 'text-2xl',
  lg: 'text-3xl sm:text-4xl',
};

export function BrandLogo({
  variant = 'horizontal',
  size = 'md',
  onDark = false,
  showTagline = false,
  showEmblem = true,
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

  if (variant === 'graphic') {
    const height = size === 'sm' ? 'h-7' : size === 'lg' ? 'h-12' : 'h-9';
    return (
      <img
        src={logoPng}
        alt="BoraRio"
        className={`${height} w-auto object-contain ${className}`}
      />
    );
  }

  const boraColor = onDark ? 'text-white' : 'text-[#102F46] dark:text-white';
  const emblemSize = size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-10 w-10' : 'h-8 w-8';

  const wordmark = (
    <span className={`font-sans font-extrabold tracking-tight leading-none ${TEXT_SIZES[size]}`}>
      <span className={boraColor}>Bora</span>
      <span className="bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] bg-clip-text text-transparent">
        Rio
      </span>
    </span>
  );

  if (variant === 'vertical') {
    return (
      <div className={`inline-flex flex-col items-center gap-1.5 ${className}`}>
        <div className="inline-flex items-center gap-2">
          {showEmblem && (
            <img
              src="/brand/borario-icon-192.png"
              alt=""
              className={`${emblemSize} rounded-xl object-contain shadow-sm`}
            />
          )}
          {wordmark}
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
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {showEmblem && (
        <img
          src="/brand/borario-icon-192.png"
          alt=""
          className={`${emblemSize} shrink-0 rounded-xl object-contain shadow-sm`}
        />
      )}
      {wordmark}
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
