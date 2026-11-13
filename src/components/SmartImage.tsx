import { useEffect, useState } from 'react';
import { getCuratedCoverImage } from '../data/curatedImages';
import type { RestaurantCategory } from '../types/restaurant';

interface SmartImageProps {
  src: string;
  alt: string;
  category: RestaurantCategory;
  fallbackIndex?: number;
  className?: string;
}

export function SmartImage({
  src,
  alt,
  category,
  fallbackIndex = 0,
  className = '',
}: SmartImageProps) {
  const [imgSrc, setImgSrc] = useState<string>(src);
  const [fallbackLevel, setFallbackLevel] = useState<number>(0);

  useEffect(() => {
    setImgSrc(src);
    setFallbackLevel(0);
  }, [src]);

  const handleError = () => {
    if (fallbackLevel === 0) {
      setFallbackLevel(1);
      setImgSrc(getCuratedCoverImage(category, fallbackIndex));
    } else if (fallbackLevel === 1) {
      setFallbackLevel(2);
      setImgSrc(getCuratedCoverImage('Contemporâneo', fallbackIndex + 1));
    }
  };

  return (
    <img
      src={imgSrc}
      alt={alt}
      loading="lazy"
      onError={handleError}
      className={className}
    />
  );
}
