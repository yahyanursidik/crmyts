import React, { useId, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AlertCircle, ArrowRight, CalendarDays, Clock, Eye, EyeOff, HeartHandshake, KeyRound, Loader2, MessageCircle, Ticket, Users } from 'lucide-react';
import { BrandEmblem } from '@/components/common/BrandLogo';
import { authProvider } from '@/lib/authProvider';
import './login-page.css';

const supportUrl = (message: string) => `https://wa.me/628112401476?text=${encodeURIComponent(message)}`;
const PORTALS = [
  { href: '/kajian', icon: CalendarDays, label: 'Jadwal kajian', hint: 'Pilih kegiatan & daftar', tone: 'green' },
  { href: '/peserta', icon: Ticket, label: 'Tiket saya', hint: 'Lihat tiket & riwayat hadir', tone: 'gold' },
  { href: '/donasi', icon: HeartHandshake, label: 'Donasi & wakaf', hint: 'Dukung program kebaikan', tone: 'terra' },
];

export const LoginPage: React.FC = () => {
  const [params] = useSearchParams();
  const id = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  const emailError = touched.email && (!email.trim() ? 'Email wajib diisi.' : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? 'Periksa kembali alamat email.' : '');
  const passwordError = touched.password && !password ? 'Kata sandi wajib diisi.' : '';
  const reason = params.get('reason');
  const notice = reason === 'inactivity' ? 'Sesi berakhir karena tidak aktif. Silakan masuk kembali.' : reason === 'expired' ? 'Sesi telah berakhir. Silakan masuk kembali.' : reason === 'connection' ? 'Sesi belum dapat diperiksa. Periksa koneksi lalu coba kembali.' : '';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setTouched({ email: true, password: true });
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { emailRef.current?.focus(); return; }
    if (!password) { passwordRef.current?.focus(); return; }
    setSubmitting(true);
    try {
      const result = await authProvider.login({ email, password, rememberMe, returnTo: params.get('returnTo') });
      if (result.success) window.location.assign(result.redirectTo || '/');
      else setError(result.error?.message || 'Gagal masuk. Periksa email dan kata sandi.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Koneksi terputus. Silakan coba lagi.');
    } finally { setSubmitting(false); }
  };

  return <div className="login-page">
    <header className="login-nav">
      <Link to="/kajian" className="login-wordmark"><BrandEmblem useImage className="h-10 w-10 shrink-0" /><span className="login-wordmark-name">Tarbiyah Sunnah<span>Jamaah · Dakwah · Kebaikan</span></span></Link>
      <Link to="/peserta" className="login-public-link"><Ticket size={16} />Portal jamaah<ArrowRight size={15} /></Link>
    </header>
    <main className="login-shell">
      <section className="login-aside" aria-labelledby="welcome-heading">
        <span className="login-kicker"><span />TERHUBUNG DALAM KEBAIKAN</span>
        <h1 id="welcome-heading">Lebih dekat dengan jamaah.<br /><span>Lebih mudah mengelola amanah.</span></h1>
        <p className="login-lede">Satu ruang kerja untuk jamaah, kegiatan, donasi, dan wakaf Yayasan Tarbiyah Sunnah.</p>
        <div className="login-connection" aria-label="Jamaah terhubung dengan kegiatan dan layanan"><span><Users size={18} />Jamaah</span><span aria-hidden="true">—</span><span><CalendarDays size={18} />Kegiatan</span><span aria-hidden="true">—</span><span><HeartHandshake size={18} />Layanan</span></div>
        <div className="login-portals"><h2>Untuk jamaah</h2>{PORTALS.map(({ href, icon: Icon, label, hint, tone }) => <Link to={href} key={href} className="login-portal"><span className={`login-portal-icon is-${tone}`}><Icon size={21} /></span><span><strong>{label}</strong><small>{hint}</small></span><ArrowRight size={17} /></Link>)}</div>
      </section>
      <section className="login-panel" aria-labelledby="login-heading">
        <div className="login-panel-inner">
          <div className="login-form-emblem"><KeyRound size={24} /></div>
          <span className="login-panel-kicker">RUANG KERJA YTS</span>
          <h2 id="login-heading">Masuk pengurus</h2>
          <p className="login-heading-sub">Gunakan akun staf Anda. Akses mengikuti peran akun.</p>
          {notice && !error && <div className="login-banner is-warning" role="status"><Clock size={18} /><span>{notice}</span></div>}
          {error && <div id={`${id}-error`} className="login-banner is-error" role="alert"><AlertCircle size={18} /><span>{error}</span></div>}
          <form onSubmit={submit} noValidate aria-busy={submitting}>
            <div className={`login-field${emailError ? ' is-error' : ''}`}>
              <label htmlFor={`${id}-email`}>Email staf</label>
              <input ref={emailRef} id={`${id}-email`} name="email" className="login-input" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} onBlur={() => setTouched((prev) => ({ ...prev, email: true }))} required autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="nama@tarbiyahsunnah.id" disabled={submitting} aria-invalid={Boolean(emailError)} aria-describedby={emailError ? `${id}-email-error` : undefined} />
              <p id={`${id}-email-error`} className="login-field-error" aria-live="polite">{emailError || '\u00a0'}</p>
            </div>
            <div className={`login-field${passwordError ? ' is-error' : ''}`}>
              <div className="login-label-row"><label htmlFor={`${id}-password`}>Kata sandi</label><a href={supportUrl('Assalamu’alaikum Admin YTS, saya membutuhkan bantuan pemulihan kata sandi akun staf.')} target="_blank" rel="noreferrer" className="login-forgot">Lupa kata sandi?</a></div>
              <div className="login-input-wrap"><input ref={passwordRef} id={`${id}-password`} name="password" className="login-input has-toggle" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} onBlur={() => { setTouched((prev) => ({ ...prev, password: true })); setCapsLock(false); }} onKeyUp={(e) => setCapsLock(e.getModifierState('CapsLock'))} required autoComplete="current-password" placeholder="Masukkan kata sandi" disabled={submitting} aria-invalid={Boolean(passwordError)} aria-describedby={[passwordError ? `${id}-password-error` : '', capsLock ? `${id}-caps` : ''].filter(Boolean).join(' ') || undefined} /><button type="button" className="login-toggle" onClick={() => setShowPassword((prev) => !prev)} aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'} aria-pressed={showPassword} disabled={submitting}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div>
              <p id={`${id}-password-error`} className="login-field-error" aria-live="polite">{passwordError || '\u00a0'}</p>{capsLock && <p id={`${id}-caps`} className="login-hint">Caps Lock aktif.</p>}
            </div>
            <label className="login-remember"><input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} disabled={submitting} /><span>Tetap masuk di perangkat ini <small>hingga 14 hari</small></span></label>
            <button className="login-submit" type="submit" disabled={submitting}>{submitting ? <><Loader2 size={18} className="animate-spin" />Memeriksa akun…</> : <>Masuk ke ruang kerja<ArrowRight size={18} /></>}</button>
          </form>
          <div className="login-help"><MessageCircle size={17} /><span>Butuh akses? <a href={supportUrl('Assalamu’alaikum Admin YTS, saya ingin meminta akses akun staf yayasan.')} target="_blank" rel="noreferrer">Hubungi administrator</a></span></div>
          <Link to="/ruang-jamaah" className="login-feedback">Sampaikan pertanyaan atau saran<ArrowRight size={14} /></Link>
        </div>
      </section>
    </main>
    <footer className="login-foot"><span>© {new Date().getFullYear()} Yayasan Tarbiyah Sunnah</span><Link to="/bazar">Bazar UMKM<ArrowRight size={14} /></Link></footer>
  </div>;
};
