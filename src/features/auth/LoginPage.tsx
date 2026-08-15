import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Lock, Mail, AlertCircle, Loader2, Globe, BookOpen, Clock } from 'lucide-react';
import { BrandLogo } from '@/components/common/BrandLogo';
import { authProvider } from '@/lib/authProvider';

export const LoginPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const isInactivityLogout = searchParams.get('reason') === 'inactivity';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  // Quick-Login Helper for Demo and Instant Admin Access
  const handleQuickLogin = (demoRole: string) => {
    setEmail(`${demoRole}@tarbiyahsunnah.id`);
    setPassword('admin123');
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-[#fbfaf6] flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-brand-100 selection:text-brand-900">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <BrandLogo variant="vertical" subtitle="Sistem Informasi & CRM Terpusat" badge="PORTAL PENGURUS & AMIL" />
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-md border border-cream-300 sm:rounded-3xl sm:px-10">
          {isInactivityLogout && !errorMessage && (
            <div className="mb-4 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900 animate-in fade-in">
              <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Sesi Berakhir Otomatis</span>
                <span className="text-[11px] text-amber-800 leading-relaxed block mt-0.5">
                  Akun Anda otomatis keluar karena tidak ada aktivitas selama 30 menit demi keamanan data yayasan dan efisiensi sistem. Silakan masuk kembali.
                </span>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="mb-4 p-3.5 rounded-2xl bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-bold text-surface-700">Email Pegawai / Staf</label>
              <div className="mt-1 relative rounded-xl shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@tarbiyahsunnah.id"
                  className="block w-full pl-9 pr-3 py-2.5 text-xs font-medium border border-cream-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-700 bg-cream-50/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-surface-700">Kata Sandi</label>
              <div className="mt-1 relative rounded-xl shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-9 pr-3 py-2.5 text-xs font-medium border border-cream-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-700 bg-cream-50/50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex justify-center items-center py-2.5 px-4 rounded-xl shadow-sm text-xs font-bold text-white bg-brand-800 hover:bg-brand-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-700 transition-all active:scale-95 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Masuk ke Sistem'}
            </button>
          </form>

          {/* Development Quick-Login Helper */}
          <div className="mt-6 pt-4 border-t border-cream-200">
            <p className="text-[11px] text-center text-surface-400 mb-2 font-bold">Quick Access (Dev Preview):</p>
            <div className="grid grid-cols-2 gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => handleQuickLogin('crm_admin')}
                className="py-1.5 px-2 text-center rounded-xl bg-cream-100 text-brand-950 border border-cream-300 hover:bg-cream-200"
              >
                Admin YTS
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('finance_verifier')}
                className="py-1.5 px-2 text-center rounded-xl bg-cream-100 text-brand-950 border border-cream-300 hover:bg-cream-200"
              >
                Finance Verifier
              </button>
            </div>
          </div>
        </div>

        {/* Back to Public Portals Links */}
        <div className="mt-5 pt-3 border-t border-cream-300/80 flex items-center justify-center gap-4 text-xs font-bold">
          <Link
            to="/donasi"
            className="inline-flex items-center gap-1 text-brand-800 hover:text-brand-950 transition-colors"
          >
            <Globe className="w-3.5 h-3.5 text-amber-600" />
            <span>Portal Donasi & Wakaf</span>
          </Link>
          <span className="text-cream-400">•</span>
          <Link
            to="/kajian"
            className="inline-flex items-center gap-1 text-brand-800 hover:text-brand-950 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-gold-600" />
            <span>Portal Majelis Kajian</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
