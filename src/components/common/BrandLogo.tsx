export interface BrandEmblemProps {
  className?: string;
  size?: number | string;
  useImage?: boolean;
}

/**
 * Tarbiyah Sunnah Official Geometric Emblem
 * Extracted directly from official identity logo:
 * - Top Ray: #EFA914 (Sunnah Gold)
 * - Middle Ray: #D87114 (Warm Terracotta / Amber)
 * - Bottom Shape: #447346 (Tarbiyah Forest Green)
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
      {/* Top Gold Ray */}
      <path
        d="M44 4 L44 21 L80 58 C80.5 58.5 79.5 59.5 78.5 59 L44 26 Z"
        fill="#EFA914"
      />
      {/* Middle Terracotta Ray */}
      <path
        d="M26 15 L26 36 L81 74 C81.5 74.5 80.5 75.5 79.5 75 L26 42 Z"
        fill="#D87114"
      />
      {/* Bottom Forest Green Shape */}
      <path
        d="M22 41 L80 81 C81.5 82 80 84 78 84 L22 84 Z"
        fill="#447346"
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
  const textColor = isDark ? 'text-white' : 'text-brand-900';
  const subColor = isDark ? 'text-gold-300/90' : 'text-surface-500';

  if (variant === 'image-card' || variant === 'vertical') {
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        <div className="p-3.5 bg-[#fbfaf6] rounded-3xl shadow-sm border border-cream-300 mb-3 flex items-center justify-center overflow-hidden">
          <img
            src={imageSrc}
            alt="Logo Resmi Tarbiyah Sunnah"
            className="w-24 h-24 object-contain rounded-2xl"
          />
        </div>
        <div className="flex flex-col items-center">
          <span className={`text-2xl font-black tracking-tight font-display leading-none ${textColor}`}>
            Tarbiyah Sunnah
          </span>
          {showSubtitle && (
            <span className={`text-xs font-semibold tracking-wider uppercase mt-1.5 ${subColor}`}>
              {subtitle}
            </span>
          )}
          {badge && (
            <span className="mt-2.5 inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gold-100 text-gold-900 border border-gold-300/80 shadow-2xs">
              {badge}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Horizontal Layout
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="shrink-0 p-1.5 rounded-2xl bg-[#fbfaf6] shadow-xs border border-cream-300 flex items-center justify-center">
        <BrandEmblem className={emblemSize} />
      </div>
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-base font-black tracking-tight font-display truncate leading-tight ${textColor}`}>
            Tarbiyah Sunnah
          </span>
          {badge && (
            <span className="inline-flex items-center px-2 py-0.2 rounded-md text-[9px] font-black tracking-wider uppercase bg-gold-400 text-gold-950 shadow-2xs">
              {badge}
            </span>
          )}
        </div>
        {showSubtitle && (
          <span className={`text-[11px] font-semibold truncate leading-tight tracking-wide ${subColor}`}>
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
