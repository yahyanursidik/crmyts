import React, { useId, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AlertCircle, Clock, Eye, EyeOff, Lock, Check } from 'lucide-react';
import { BrandEmblem } from '@/components/common/BrandLogo';
import { authProvider } from '@/lib/authProvider';

const SUPPORT_WHATSAPP = '628112401476';
const SUPPORT_PHONE_DISPLAY = '0811-2401-476';
const SUPPORT_EMAIL = 'info@tarbiyahsunnah.id';

function supportWhatsAppUrl(message: string): string {
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(message)}`;
}

function errorFromUnknown(err: unknown): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return 'Tidak bisa menghubungi server. Cek jaringan, lalu coba lagi.';
}

export const LoginPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const isInactivityLogout = searchParams.get('reason') === 'inactivity';
  const formId = useId();
  const emailId = `${formId}-email`;
  const passwordId = `${formId}-password`;
  const errorId = `${formId}-error`;
  const inactivityId = `${formId}-inactivity`;
  const capsId = `${formId}-caps`;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const emailFormatError =
    emailTouched && email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ? 'Format email tidak valid. Gunakan alamat seperti nama@tarbiyahsunnah.id.'
      : null;
  const fieldsInvalid = Boolean(errorMessage) || Boolean(emailFormatError);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    try {
      const res = await authProvider.login({ email, password, rememberMe });
      if (res && res.success) {
        window.location.href = res.redirectTo || '/';
      } else {
        setErrorMessage(
          res?.error?.message ||
            'Email atau kata sandi tidak cocok. Periksa ejaan, lalu coba lagi.',
        );
      }
    } catch (err: unknown) {
      setErrorMessage(errorFromUnknown(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EFEBE1] font-sans flex flex-col justify-between selection:bg-[#B58B3C]/30 selection:text-[#14352A]">
      {/* Top Portal Navigation Bar */}
      <header className="h-14 bg-[#FBF9F4] border-b border-[#1B4332]/12 px-6 sm:px-10 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 text-inherit no-underline">
          <BrandEmblem useImage={true} className="h-7 w-7 rounded-md shrink-0" />
          <span className="font-display font-bold text-sm tracking-tight text-[#14352A]">
            Tarbiyah Sunnah
          </span>
        </Link>

        <nav className="flex items-center gap-5 text-xs font-semibold text-[#3D4A44]">
          <Link to="/kajian" className="hover:text-[#14352A] transition-colors">
            Portal Kajian
          </Link>
          <Link to="/donasi" className="hover:text-[#14352A] transition-colors">
            Portal Donasi
          </Link>
          <Link to="/bazar" className="hover:text-[#14352A] transition-colors">
            Bazar UMKM
          </Link>
        </nav>
      </header>

      {/* Main Split Panel Container (Mockup 2a) */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8 lg:p-12">
        <div className="w-full max-w-[1040px] min-h-[620px] bg-[#FBF9F4] border border-[#1B4332]/14 rounded-2xl shadow-xl shadow-[#1B4332]/5 overflow-hidden flex flex-col md:flex-row">
          {/* Left Form Panel (520px) */}
          <div className="w-full md:w-[480px] lg:w-[520px] shrink-0 p-8 sm:p-11 lg:p-12 flex flex-col justify-between bg-[#FBF9F4]">
            <div>
              {/* Logo / Brand Header */}
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#B58B3C] flex items-center justify-center font-display font-extrabold text-sm text-[#14352A] shadow-xs">
                  Y
                </div>
                <div>
                  <div className="font-display font-bold text-[13px] text-[#14352A] leading-none">
                    CRM YTS
                  </div>
                  <div className="font-mono font-medium text-[9.5px] text-[#8A9690] tracking-wider mt-0.5">
                    YAYASAN TARBIYAH SUNNAH
                  </div>
                </div>
              </div>

              {/* Title & Description */}
              <div className="mt-8 sm:mt-10 space-y-2">
                <h1 className="font-display font-bold text-2xl sm:text-[26px] text-[#1C2321] leading-tight tracking-tight">
                  Masuk ke ruang kendali amanah
                </h1>
                <p className="text-[13px] text-[#6B7A72] leading-relaxed">
                  Akses internal. Akun dibuat oleh CRM Admin sesuai role dan izin masing-masing.
                </p>
              </div>

              {/* Inactivity Alert */}
              {isInactivityLogout && !errorMessage && (
                <div
                  id={inactivityId}
                  className="mt-5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5"
                  role="status"
                >
                  <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <span>Sesi berakhir setelah tidak aktif. Masuk kembali untuk melanjutkan tugas amanah.</span>
                </div>
              )}

              {/* Error Alert */}
              {errorMessage && (
                <div
                  id={errorId}
                  className="mt-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5 animate-in fade-in duration-200"
                  role="alert"
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="font-medium">{errorMessage}</span>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
                {/* Email Field */}
                <div>
                  <label htmlFor={emailId} className="block text-[11.5px] font-semibold text-[#3D4A44] mb-1.5">
                    Email lembaga
                  </label>
                  <input
                    id={emailId}
                    type="email"
                    name="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => setEmailTouched(true)}
                    placeholder="nama@tarbiyahsunnah.id"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    autoFocus
                    disabled={submitting}
                    aria-invalid={fieldsInvalid}
                    className={`w-full h-11 px-3.5 rounded-xl bg-[#F7F4EC] border text-[13px] text-[#1C2321] transition-all outline-none ${
                      emailFormatError
                        ? 'border-rose-400 bg-rose-50/40'
                        : 'border-[#1B4332]/18 focus:border-[#1B4332] focus:bg-[#FBF9F4] focus:ring-3 focus:ring-[#1B4332]/12'
                    }`}
                  />
                  {emailFormatError && (
                    <p className="mt-1 text-[11px] text-rose-600 font-medium">{emailFormatError}</p>
                  )}
                </div>

                {/* Password Field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor={passwordId} className="text-[11.5px] font-semibold text-[#3D4A44]">
                      Kata sandi
                    </label>
                    <a
                      href={supportWhatsAppUrl(
                        "Bismillah, assalamu'alaikum Admin IT YTS. Saya memerlukan bantuan lupa kata sandi akun CRM staf.",
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-semibold text-[#1F2A44] hover:underline"
                    >
                      Lupa kata sandi?
                    </a>
                  </div>

                  <div className="relative">
                    <input
                      id={passwordId}
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onBlur={() => setPasswordTouched(true)}
                      onKeyUp={(e) => setCapsLockOn(e.getModifierState('CapsLock'))}
                      placeholder="••••••••••"
                      autoComplete="current-password"
                      spellCheck={false}
                      disabled={submitting}
                      className={`w-full h-11 pl-3.5 pr-20 rounded-xl bg-[#F7F4EC] border text-[13px] text-[#1C2321] transition-all outline-none ${
                        errorMessage
                          ? 'border-rose-400 bg-rose-50/40'
                          : 'border-[#1B4332]/18 focus:border-[#1B4332] focus:bg-[#FBF9F4] focus:ring-3 focus:ring-[#1B4332]/12'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-1 text-[11px] font-semibold text-[#1F2A44] hover:text-[#14352A] rounded flex items-center gap-1"
                    >
                      {showPassword ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5 text-[#6B7A72]" />
                          <span>Tutup</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5 text-[#6B7A72]" />
                          <span>Lihat</span>
                        </>
                      )}
                    </button>
                  </div>

                  {capsLockOn && (
                    <p id={capsId} className="mt-1 text-[11px] text-amber-700 font-medium">
                      Caps Lock aktif.
                    </p>
                  )}
                  {passwordTouched && password.length === 0 && (
                    <p className="mt-1 text-[11px] text-rose-600 font-medium">Kata sandi wajib diisi.</p>
                  )}
                </div>

                {/* Remember Device Checkbox */}
                <div className="pt-0.5">
                  <label className="inline-flex items-center gap-2.5 cursor-pointer text-xs font-medium text-[#3D4A44] select-none">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={rememberMe}
                      onClick={() => setRememberMe(!rememberMe)}
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                        rememberMe
                          ? 'bg-[#1B4332] border-[#1B4332] text-white'
                          : 'bg-[#F7F4EC] border-[#1B4332]/25'
                      }`}
                    >
                      {rememberMe && <Check className="w-3 h-3 stroke-[3]" />}
                    </button>
                    <span>Ingat perangkat ini selama 14 hari</span>
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-12 rounded-xl bg-[#1B4332] hover:bg-[#14352A] active:scale-[0.99] text-white font-display font-semibold text-[13.5px] transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Memeriksa Akun...</span>
                    </>
                  ) : (
                    <span>Masuk</span>
                  )}
                </button>

                {/* Audit Log Security Note */}
                <div className="p-3.5 rounded-xl bg-[#1F2A44]/5 border border-[#1F2A44]/10 flex items-start gap-2.5 text-[11.5px] text-[#6B7A72] leading-relaxed">
                  <Lock className="w-4 h-4 text-[#1F2A44] shrink-0 mt-0.5" />
                  <span>
                    Setiap login, export, dan akses catatan terbatas tercatat pada audit log lembaga.
                  </span>
                </div>
              </form>
            </div>

            {/* Bottom Footer Info */}
            <div className="mt-8 pt-5 border-t border-[#1B4332]/10 flex items-center justify-between text-[11.5px]">
              <span className="text-[#8A9690]">
                Belum punya akses?{' '}
                <a
                  href={supportWhatsAppUrl(
                    "Bismillah, assalamu'alaikum Admin IT YTS. Saya staf lembaga ingin meminta akses akun CRM YTS.",
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#1F2A44] font-semibold hover:underline"
                >
                  Hubungi CRM Admin
                </a>
              </span>
              <span className="font-mono font-medium text-[11px] text-[#A8B2AC]">v1.0 · MVP</span>
            </div>
          </div>

          {/* Right Vision Panel (Deep Green #14352A with Texture) */}
          <div className="hidden md:flex flex-1 bg-[#14352A] p-10 lg:p-12 flex-col justify-end relative overflow-hidden text-white">
            {/* Repeating Pattern Overlay */}
            <div
              className="absolute inset-0 pointer-events-none opacity-40"
              style={{
                background:
                  'repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 2px, transparent 2px 13px)',
              }}
            />

            <div className="relative z-10 max-w-[500px] space-y-6">
              <div className="space-y-3">
                <span className="font-mono font-semibold text-[10.5px] text-[#E0B970] tracking-widest uppercase">
                  PRODUCT VISION
                </span>
                <blockquote className="font-display font-bold text-xl lg:text-[23px] text-white leading-relaxed tracking-tight">
                  “Ruang kendali amanah lembaga untuk mengenal jamaah, menjaga relasi, mengelola follow-up, serta memperkuat akuntabilitas donasi dan wakaf.”
                </blockquote>
              </div>

              {/* 4 Statistics Grid */}
              <div className="grid grid-cols-2 gap-y-4 gap-x-6 pt-6 border-t border-white/14">
                <div>
                  <div className="font-display font-bold text-2xl text-white">4.812</div>
                  <div className="text-[11.5px] text-white/55 mt-0.5">profil jamaah terkelola</div>
                </div>
                <div>
                  <div className="font-display font-bold text-2xl text-white">10 role</div>
                  <div className="text-[11.5px] text-white/55 mt-0.5">izin dipisah per fungsi</div>
                </div>
                <div>
                  <div className="font-display font-bold text-2xl text-white">H+1</div>
                  <div className="text-[11.5px] text-white/55 mt-0.5">batas pencatatan komunikasi penting</div>
                </div>
                <div>
                  <div className="font-display font-bold text-2xl text-[#E0B970]">100%</div>
                  <div className="text-[11.5px] text-white/55 mt-0.5">aksi verifikasi &amp; export tercatat</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-[#8A9690] border-t border-[#1B4332]/10 bg-[#FBF9F4]">
        <p>© {new Date().getFullYear()} Yayasan Tarbiyah Sunnah · Jl. Jurang No.64, Pasteur, Sukajadi, Bandung</p>
      </footer>
    </div>
  );
};
