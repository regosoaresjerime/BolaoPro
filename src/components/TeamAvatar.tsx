import React, { useEffect, useMemo, useState } from 'react';

function isImageSource(value?: string | null) {
  if (!value) return false;
  return /^(https?:\/\/|data:image\/|blob:|\/)/i.test(value.trim());
}

function looksLikeEmoji(value?: string | null) {
  if (!value) return false;
  return /[\p{Extended_Pictographic}\uFE0F]/u.test(value);
}

function getTeamFallback(name: string, fallback?: string | null, src?: string | null) {
  const normalizedFallback = fallback?.trim();
  const normalizedSource = src?.trim();

  if (normalizedFallback) return normalizedFallback;
  if (normalizedSource && !isImageSource(normalizedSource) && looksLikeEmoji(normalizedSource)) {
    return normalizedSource;
  }

  const compact = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 3))
    .join('')
    .slice(0, 3)
    .toUpperCase();

  return compact || 'TIM';
}

interface TeamAvatarProps {
  name: string;
  src?: string | null;
  fallback?: string | null;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  accent?: string;
  accentDark?: string;
  title?: string;
}

export default function TeamAvatar({
  name,
  src,
  fallback,
  className = '',
  imageClassName = '',
  fallbackClassName = '',
  accent = 'rgba(26, 188, 156, 0.52)',
  accentDark = '#050914',
  title
}: TeamAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [src]);

  const showImage = isImageSource(src) && !imageFailed;
  const displayFallback = useMemo(
    () => getTeamFallback(name, fallback, src),
    [fallback, name, src]
  );
  const emojiFallback = looksLikeEmoji(displayFallback);

  return (
    <div
      aria-label={title || name}
      className={`relative flex items-center justify-center overflow-hidden rounded-full border border-white/15 shadow-[0_12px_28px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.08)] ${className}`}
      style={{ background: `radial-gradient(circle at top, ${accent} 0%, ${accentDark} 72%)` }}
      title={title || name}
    >
      {showImage ? (
        <div className="flex h-[82%] w-[82%] items-center justify-center rounded-full bg-white/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] ring-1 ring-black/10">
          <img
            alt={name}
            className={`h-[76%] w-[76%] object-contain drop-shadow-[0_2px_3px_rgba(0,0,0,0.18)] ${imageClassName}`}
            onError={() => setImageFailed(true)}
            referrerPolicy="no-referrer"
            src={src || undefined}
          />
        </div>
      ) : (
        <span
          aria-hidden="true"
          className={`select-none font-black uppercase text-white ${emojiFallback ? 'text-2xl leading-none' : 'tracking-[0.16em] text-sm'} ${fallbackClassName}`}
        >
          {displayFallback}
        </span>
      )}
      <div className="pointer-events-none absolute inset-0 rounded-full border border-white/10" />
    </div>
  );
}
