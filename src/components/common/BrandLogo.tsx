export interface BrandEmblemProps {
  className?: string;
  size?: number | string;
  useImage?: boolean;
}

/**
 * Tarbiyah Sunnah Official Geometric Emblem
 * Layers: Golden Yellow, Warm Orange, Forest Green
 */
export function BrandEmblem({ className = 'w-10 h-10', size, useImage = false }: BrandEmblemProps) {
  if (useImage) {
    return (
      <img
        src="/logo.png"
        alt="Logo Yayasan Tarbiyah Sunnah"
        className={`${className} object-contain rounded-xl`}
        style={size ? { width: size, height: size } : undefined}
      />
    );
  }

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={size ? { width: size, height: size } : undefined}
      aria-label="Logo Yayasan Tarbiyah Sunnah"
    >
      {/* Top Yellow Ray */}
      <path
        d="M44 4 L44 21 L80 58 C80.5 58.5 79.5 59.5 78.5 59 L44 26 Z"
        fill="#F0B21B"
      />
      {/* Middle Orange Ray */}
      <path
        d="M26 15 L26 36 L81 74 C81.5 74.5 80.5 75.5 79.5 75 L26 42 Z"
        fill="#D47012"
      />
      {/* Bottom Forest Green Shape */}
      <path
        d="M22 41 L80 81 C81.5 82 80 84 78 84 L22 84 Z"
        fill="#445E36"
      />
    </svg>
  );
}

export interface BrandLogoProps {
  variant?: 'vertical' | 'horizontal' | 'icon-only' | 'image-card';
  theme?: 'light' | 'dark' | 'auto';
  className?: string;
  emblemSize?: string;
  showSubtitle?: boolean;
  subtitle?: string;
  badge?: string;
  imageSrc?: string;
}

export function BrandLogo({
  variant = 'horizontal',
  theme = 'light',
  className = '',
  emblemSize = 'w-9 h-9',
  showSubtitle = true,
  subtitle = 'Yayasan Tarbiyah Sunnah',
  badge,
  imageSrc = '/logo.png',
}: BrandLogoProps) {
  if (variant === 'icon-only') {
    return <BrandEmblem className={`${emblemSize} ${className}`} />;
  }

  const isDark = theme === 'dark';
  const textColor = isDark ? 'text-white' : 'text-[#2D4523]';
  const subColor = isDark ? 'text-emerald-300/80' : 'text-slate-500';

  if (variant === 'image-card' || variant === 'vertical') {
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        <div className="p-3 bg-[#FBF9F5] rounded-3xl shadow-sm border border-amber-900/10 mb-3 flex items-center justify-center overflow-hidden">
          <img
            src={imageSrc}
            alt="Logo Resmi Tarbiyah Sunnah"
            className="w-24 h-24 object-contain rounded-2xl"
          />
        </div>
        <div className="flex flex-col items-center">
          <span className={`text-2xl font-extrabold tracking-tight font-sans leading-none ${textColor}`}>
            Tarbiyah Sunnah
          </span>
          {showSubtitle && (
            <span className={`text-xs font-semibold tracking-wider uppercase mt-1.5 ${subColor}`}>
              {subtitle}
            </span>
          )}
          {badge && (
            <span className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-700 border border-amber-500/30">
              {badge}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Horizontal layout
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="shrink-0 flex items-center justify-center p-1 rounded-xl bg-white/95 shadow-2xs border border-slate-200/50">
        <BrandEmblem className={emblemSize} />
      </div>
      <div className="flex flex-col min-w-0 leading-tight">
        <div className="flex items-center gap-1.5">
          <span className={`text-base font-extrabold tracking-tight truncate ${textColor}`}>
            CRM YTS
          </span>
          {badge && (
            <span className="px-1.5 py-0.2 text-[9px] font-bold bg-amber-400/20 text-amber-300 rounded border border-amber-400/30 shrink-0">
              {badge}
            </span>
          )}
        </div>
        {showSubtitle && (
          <span className={`text-[11px] font-medium truncate ${subColor}`}>
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
