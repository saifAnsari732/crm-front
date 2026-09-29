import React, { useState, useEffect } from 'react';

const getBgColor = (name = '') => {
  const colors = [
    'bg-blue-600',
    'bg-indigo-600',
    'bg-violet-600',
    'bg-emerald-600',
    'bg-teal-600',
    'bg-cyan-600',
    'bg-sky-600',
    'bg-amber-600',
    'bg-rose-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export default function Avatar({
  src,
  name = 'User',
  size = 'md',
  className = '',
  shape = 'rounded-full',
  status,
  border = true,
  alt,
}) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [src]);

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-9 h-9 text-xs',
    lg: 'w-11 h-11 text-sm',
    xl: 'w-14 h-14 text-base font-bold',
    '2xl': 'w-16 h-16 text-xl font-bold',
    '3xl': 'w-20 h-20 text-2xl font-bold',
  }[size] || size;

  const initials = name
    ? name
        .trim()
        .split(' ')
        .filter(Boolean)
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'EM';

  const hasImage = Boolean(src && !imgError && typeof src === 'string' && src.trim() && src !== 'NONE');

  return (
    <div className={`relative inline-block flex-shrink-0 ${className}`}>
      {hasImage ? (
        <img
          src={src}
          alt={alt || name}
          onError={() => setImgError(true)}
          className={`${sizeClasses} ${shape} object-cover ${border ? 'border border-slate-200/80 shadow-xs' : ''}`}
        />
      ) : (
        <div
          className={`${sizeClasses} ${shape} ${getBgColor(name)} text-white flex items-center justify-center font-bold tracking-tight shadow-xs ${border ? 'border border-white/20' : ''}`}
        >
          {initials}
        </div>
      )}

      {status !== undefined && (
        <span
          className={`absolute bottom-0 right-0 rounded-full border-2 border-white ${
            size === 'xs' || size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5'
          } ${
            status === 'online' || status === true
              ? 'bg-emerald-500'
              : status === 'tracking'
              ? 'bg-blue-500 ring-2 ring-blue-400/30 animate-pulse'
              : 'bg-slate-300'
          }`}
        />
      )}
    </div>
  );
}
