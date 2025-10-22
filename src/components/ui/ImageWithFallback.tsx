'use client';

import { useState } from 'react';

interface ImageWithFallbackProps {
  src: string;
  fallbackSrc: string;
  finalFallback?: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
}

export function ImageWithFallback({
  src,
  fallbackSrc,
  finalFallback = '/default-avatar.svg',
  alt,
  className = '',
  width,
  height
}: ImageWithFallbackProps) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [hasErrored, setHasErrored] = useState(false);

  const handleError = () => {
    if (!hasErrored && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
      setHasErrored(true);
    } else if (currentSrc !== finalFallback) {
      setCurrentSrc(finalFallback);
    }
  };

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      width={width}
      height={height}
      onError={handleError}
    />
  );
}
