import { Building2 } from 'lucide-react';
import { useState } from 'react';

interface CampusImageProps {
  src: string;
  alt: string;
  fallbackTitle: string;
  className?: string;
}

export function CampusImage({ src, alt, fallbackTitle, className = '' }: CampusImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 text-slate-200 p-6 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <Building2 className="w-8 h-8 text-amber-400 mb-3" strokeWidth={1.5} />
        <p className="font-display text-sm font-medium text-white">{fallbackTitle}</p>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
