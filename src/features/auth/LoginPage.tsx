import React, { useState } from 'react';
import { Link } from 'react-router';
import { useLogin } from '@refinedev/core';
import { Lock, Mail, AlertCircle, Loader2, Globe, BookOpen } from 'lucide-react';
import { BrandLogo } from '@/components/common/BrandLogo';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { mutate: login, isPending } = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    login(
      { email, password },
      {
        onError: (err: any) => {
          setErrorMessage(err?.message || 'Login gagal. Periksa email dan password.');
        },
      }
    );
  };

  // Demo shortcut for local development testing
  const handleQuickLogin = (demoRole: string) => {
    const mockUser = {
      id: 'usr_mock_123',
      email: `${demoRole}@tarbiyahsunnah.id`,
      name: `Staf ${demoRole.toUpperCase()}`,
      roles: [demoRole],
      permissions: ['dashboard.view', 'persons.list', 'events.view', 'tasks.view_own'],
    };
    localStorage.setItem('crm_user_session', JSON.stringify(mockUser));
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <BrandLogo variant="vertical" subtitle="Sistem Informasi & CRM Terpusat" badge="PORTAL PENGURUS & AMIL" />
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm border border-navy-200/80 sm:rounded-xl sm:px-10">
          {errorMessage && (
            <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-navy-700">Email Pegawai / Staf</label>
              <div className="mt-1 relative rounded-md shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-navy-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@tarbiyahsunnah.id"
                  className="block w-full pl-9 pr-3 py-2 text-sm border border-navy-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-700 focus:border-brand-700"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy-700">Kata Sandi</label>
              <div className="mt-1 relative rounded-md shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-navy-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-9 pr-3 py-2 text-sm border border-navy-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-700 focus:border-brand-700"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-800 hover:bg-brand-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-700 transition-colors disabled:opacity-50"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Masuk ke Sistem'}
            </button>
          </form>

          {/* Development Quick-Login Helper */}
          <div className="mt-6 pt-4 border-t border-navy-100">
            <p className="text-[11px] text-center text-navy-400 mb-2 font-medium">Quick Access (Dev Preview):</p>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => handleQuickLogin('crm_admin')}
                className="py-1 px-2 text-center rounded bg-cream-200 text-brand-900 hover:bg-brand-100 font-medium"
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('finance_verifier')}
                className="py-1 px-2 text-center rounded bg-cream-200 text-brand-900 hover:bg-brand-100 font-medium"
              >
                Finance
              </button>
            </div>
          </div>
        </div>

        {/* Back to Public Portals Links */}
        <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-center gap-4 text-xs font-semibold">
          <Link
            to="/donasi"
            className="inline-flex items-center gap-1 text-emerald-800 hover:text-emerald-950 transition-colors"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-600" />
            <span>Portal Donasi & Wakaf</span>
          </Link>
          <span className="text-slate-300">•</span>
          <Link
            to="/kajian"
            className="inline-flex items-center gap-1 text-teal-800 hover:text-teal-950 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-teal-600" />
            <span>Portal Majelis Kajian</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
