import React from 'react';

interface PortalBackgroundProps {
  children?: React.ReactNode;
  className?: string;
  showOrnaments?: boolean;
}

/**
 * Tarbiyah Sunnah Ambient Canvas & Islamic Geometric Watermark
 * Warm Ivory (#fbfaf6) canvas with delicate Sunnah Gold & Forest Green ambient glows
 */
export function PortalBackground({
  children,
  className = '',
  showOrnaments = true,
}: PortalBackgroundProps) {
  return (
    <div className={`relative min-h-screen bg-[#fbfaf6] text-surface-900 overflow-x-hidden ${className}`}>
      {/* 1. Ambient Glow Layers */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        {/* Top-Right Sunnah Gold Glow */}
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-gradient-to-br from-gold-400/10 via-amber-400/5 to-transparent blur-3xl" />
        
        {/* Top-Left Tarbiyah Forest Glow */}
        <div className="absolute -top-40 -left-40 w-[30rem] h-[30rem] rounded-full bg-gradient-to-tr from-brand-600/8 via-brand-500/4 to-transparent blur-3xl" />
        
        {/* Center Subtle Warmth */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[45rem] h-[45rem] rounded-full bg-gradient-to-b from-cream-200/40 via-gold-100/20 to-transparent blur-3xl" />
      </div>

      {/* 2. Delicate Islamic Geometric Star Pattern (Watermark) */}
      {showOrnaments && (
        <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.035] select-none overflow-hidden">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
            <defs>
              <pattern id="islamic-star-pattern" width="80" height="80" patternUnits="userSpaceOnUse">
                {/* 8-Pointed Star Motif */}
                <path
                  d="M40 0 L52 28 L80 40 L52 52 L40 80 L28 52 L0 40 L28 28 Z"
                  fill="none"
                  stroke="#1c321d"
                  strokeWidth="1.2"
                />
                <circle cx="40" cy="40" r="16" fill="none" stroke="#efa914" strokeWidth="0.8" />
                <path
                  d="M0 0 L10 10 M80 0 L70 10 M0 80 L10 70 M80 80 L70 70"
                  stroke="#1c321d"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#islamic-star-pattern)" />
          </svg>
        </div>
      )}

      {/* 3. Content Layer */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {children}
      </div>
    </div>
  );
}
