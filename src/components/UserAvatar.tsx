import React, { useEffect, useMemo, useState } from 'react';

function isImageSource(value?: string | null) {
  if (!value) return false;
  return /^(https?:\/\/|data:image\/|blob:|\/)/i.test(value.trim());
}

function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return 'BP';
  return parts.map((part) => part[0]?.toUpperCase() || '').join('') || 'BP';
}

interface UserAvatarProps {
  name: string;
  src?: string | null;
  className?: string;
  imgClassName?: string;
  initialsClassName?: string;
  title?: string;
}

export default function UserAvatar({
  name,
  src,
  className = '',
  imgClassName = '',
  initialsClassName = '',
  title
}: UserAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [src]);

  const initials = useMemo(() => getInitials(name), [name]);
  const showImage = isImageSource(src) && !imageFailed;

  return (
    <div
      aria-label={title || name}
      className={`relative flex items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(0,230,118,0.24),_rgba(7,10,16,0.98)_72%)] shadow-[0_12px_30px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.08)] ${className}`}
      title={title || name}
    >
      {showImage ? (
        <img
          alt={name}
          className={`h-full w-full object-cover ${imgClassName}`}
          onError={() => setImageFailed(true)}
          referrerPolicy="no-referrer"
          src={src || undefined}
        />
      ) : (
        <span
          aria-hidden="true"
          className={`select-none font-black uppercase tracking-[0.14em] text-white ${initialsClassName}`}
        >
          {initials}
        </span>
      )}
      <div className="pointer-events-none absolute inset-0 rounded-full border border-white/10" />
    </div>
  );
}
