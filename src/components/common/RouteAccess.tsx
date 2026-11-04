import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { usePermissions } from '@refinedev/core';
import { ArrowLeft, Home, LockKeyhole } from 'lucide-react';
import type { PermissionCode } from '@server/permissions/constants';
import { canOpenPath } from '@server/permissions/navigation';
import { LoadingState } from './LoadingState';

export function LoginRedirect() {
  const location = useLocation();
  return <Navigate to={`/login?returnTo=${encodeURIComponent(`${location.pathname}${location.search}`)}`} replace />;
}

export function RouteAccess({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { data: permissions = [], isLoading } = usePermissions<PermissionCode[]>({});
  if (isLoading) return <LoadingState message="Memeriksa akses…" />;
  if (canOpenPath(pathname, permissions)) return <>{children}</>;
  return <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center" aria-labelledby="access-title">
    <div className="rounded-2xl bg-amber-50 p-4 text-amber-800"><LockKeyhole className="h-8 w-8" /></div>
    <h1 id="access-title" className="text-xl font-bold text-brand-950">Akses terbatas</h1>
    <p className="text-sm text-surface-600">Halaman ini belum tersedia untuk peran Anda. Hubungi administrator bila akses diperlukan.</p>
    <Link to="/" className="btn-primary gap-2"><Home className="h-4 w-4" />Kembali ke beranda</Link>
  </main>;
}

export function NotFoundPage() {
  return <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cream-100 px-4 text-center">
    <span className="text-sm font-semibold text-amber-800">404</span>
    <h1 className="text-2xl font-bold text-brand-950">Halaman tidak ditemukan</h1>
    <p className="text-sm text-surface-600">Periksa alamat atau pilih halaman yang tersedia.</p>
    <div className="flex gap-3"><Link to="/" className="btn-primary gap-2"><ArrowLeft className="h-4 w-4" />Beranda</Link><Link to="/kajian" className="btn-secondary">Portal kajian</Link></div>
  </main>;
}
