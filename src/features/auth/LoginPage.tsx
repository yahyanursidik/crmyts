import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  Lock,
  Mail,
  AlertCircle,
  Loader2,
  Globe,
  BookOpen,
  Clock,
  Eye,
  EyeOff,
  Shield,
  MessageSquare,
  ArrowRight,
} from 'lucide-react';
import { BrandEmblem } from '@/components/common/BrandLogo';
import { authProvider } from '@/lib/authProvider';

export const LoginPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const isInactivityLogout = searchParams.get('reason') === 'inactivity';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    try {
      const res = await authProvider.login({ email, password });
      if (res && res.success) {
        window.location.href = res.redirectTo || '/';
      } else {
        setErrorMessage(res?.error?.message || 'Email atau kata sandi tidak valid.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Terjadi kesalahan saat menghubungi server.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f7f5ed] via-[#fbfaf6] to-[#f4f1e6] flex flex-col justify-between selection:bg-brand-100 selection:text-brand-900">
      {/* 1. TOP PORTAL SWITCHER BAR */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-cream-300 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          {/* Logo & Portal Identity */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <BrandEmblem useImage={true} className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl shadow-2xs group-hover:scale-105 transition-transform" />
            <div className="leading-tight">
              <span className="text-sm sm:text-base font-black tracking-tight text-brand-950 font-display block">
                Tarbiyah Sunnah
              </span>
              <span className="text-[10px] font-bold text-surface-500 hidden sm:block">
                Sistem Informasi CRM Terpadu
              </span>
            </div>
          </Link>

          {/* Quick Portal Switcher Pills */}
          <nav className="flex items-center gap-1 sm:gap-1.5 text-xs font-bold">
            <Link
              to="/kajian"
              className="px-3 py-1.5 rounded-xl text-surface-700 hover:text-brand-950 hover:bg-cream-200/80 transition-all flex items-center gap-1.5 text-[11px] sm:text-xs"
            >
              <BookOpen className="w-3.5 h-3.5 text-gold-600 shrink-0" />
              <span>Portal Kajian</span>
            </Link>
            <Link
              to="/donasi"
              className="px-3 py-1.5 rounded-xl text-surface-700 hover:text-brand-950 hover:bg-cream-200/80 transition-all flex items-center gap-1.5 text-[11px] sm:text-xs"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Portal Donasi & Wakaf</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* 2. MAIN LOGIN FORM CONTAINER */}
      <main className="flex-1 flex flex-col justify-center py-6 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md mx-auto space-y-6">
          {/* Header Branding Card */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center p-3 bg-white rounded-3xl shadow-sm border border-cream-300 ring-4 ring-cream-200/50">
              <img
                src="/logo.png"
                alt="Logo Resmi Tarbiyah Sunnah"
                className="w-14 h-14 sm:w-16 sm:h-16 object-contain rounded-2xl"
              />
            </div>
            
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gold-100 text-gold-950 border border-gold-300 shadow-2xs mb-1.5">
                <Shield className="w-3 h-3 text-gold-700" />
                <span>Portal Khusus Pengurus & Amil</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-brand-950 font-display tracking-tight">
                Sistem CRM Terpadu YTS
              </h1>
              <p className="text-xs text-surface-500 mt-1 max-w-xs mx-auto leading-relaxed">
                Masuk untuk mengelola data jamaah, keuangan infaq, amanah wakaf, dan majelis ilmu.
              </p>
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-brand-950/5 border border-cream-300/90 relative overflow-hidden">
            {/* Top decorative accent bar */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-600 via-gold-500 to-emerald-700" />

            {/* Inactivity Alert */}
            {isInactivityLogout && !errorMessage && (
              <div className="mb-5 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900 animate-in fade-in">
                <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-amber-950">Sesi Berakhir Otomatis</span>
                  <span className="text-[11px] text-amber-800 leading-relaxed block mt-0.5">
                    Akun Anda keluar secara otomatis setelah 30 menit tidak aktif demi keamanan data yayasan.
                  </span>
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-900 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-medium">{errorMessage}</span>
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              {/* Email Input */}
              <div>
                <label className="block text-xs font-bold text-surface-800 mb-1.5">
                  Email Akun Staf / Amil
                </label>
                <div className="relative rounded-2xl">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-surface-400">
                    <Mail className="w-4 h-4 text-surface-400" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@tarbiyahsunnah.id"
                    className="block w-full pl-10 pr-3.5 py-3 sm:py-2.5 text-sm sm:text-xs font-medium border border-cream-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-700 focus:border-brand-700 bg-cream-50/40 text-surface-900 placeholder:text-surface-400 transition-all"
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Password Input with Show/Hide Toggle */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-surface-800">
                    Kata Sandi
                  </label>
                  <a
                    href="https://wa.me/6281234567890?text=Bismillah,%20Assalamu'alaikum%20Admin%20IT%20YTS,%20saya%20lupa%20kata%20sandi%20akun%20CRM%20staf..."
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-bold text-brand-800 hover:text-brand-950 hover:underline transition-colors"
                  >
                    Lupa sandi?
                  </a>
                </div>
                <div className="relative rounded-2xl">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-surface-400">
                    <Lock className="w-4 h-4 text-surface-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full pl-10 pr-11 py-3 sm:py-2.5 text-sm sm:text-xs font-medium border border-cream-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-700 focus:border-brand-700 bg-cream-50/40 text-surface-900 placeholder:text-surface-400 transition-all font-mono"
                    autoComplete="current-password"
                  />
                  {/* Eye / EyeOff Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-surface-400 hover:text-brand-900 focus:outline-none transition-colors"
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                    title={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-brand-800" />
                    ) : (
                      <Eye className="w-4 h-4 text-surface-400 hover:text-surface-700" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 flex justify-center items-center py-3.5 sm:py-3 px-4 rounded-2xl shadow-md text-xs font-bold text-white bg-brand-800 hover:bg-brand-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-700 transition-all active:scale-[0.98] disabled:opacity-50 tracking-wide font-display"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-gold-300" />
                    <span>Memverifikasi Akun...</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span>Masuk ke Sistem CRM</span>
                    <ArrowRight className="w-3.5 h-3.5 text-gold-300" />
                  </span>
                )}
              </button>
            </form>
          </div>

          {/* Help & Support WhatsApp */}
          <div className="text-center space-y-2">
            <a
              href="https://wa.me/6281234567890?text=Bismillah,%20Assalamu'alaikum%20Admin%20IT%20Yayasan%20Tarbiyah%20Sunnah,%20saya%20memerlukan%20bantuan%20akses%20staf..."
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 px-4 py-2 rounded-2xl transition-all shadow-2xs active:scale-95"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-700" />
              <span>Bantuan IT & CS Yayasan Tarbiyah Sunnah</span>
            </a>
          </div>
        </div>
      </main>

      {/* 3. FOOTER */}
      <footer className="py-4 px-4 text-center border-t border-cream-300/60 bg-white/60 text-[11px] text-surface-500">
        <p>© {new Date().getFullYear()} Yayasan Tarbiyah Sunnah — Amanah, Transparan & Berorientasi Sunnah</p>
      </footer>
    </div>
  );
};
