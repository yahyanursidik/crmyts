import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowDownRight, ArrowLeft, ArrowRight, BookOpen, CheckCircle2, HeartHandshake, HelpCircle, Lightbulb, MessageCircle, Send, Ticket } from 'lucide-react';
import { BrandEmblem } from '@/components/common/BrandLogo';
import { apiClient } from '@/lib/apiClient';
import { usePageMetadata } from '@/lib/pageMetadata';
import './jamaah-room.css';

const CATEGORIES = [
  ['kebutuhan', 'Saya butuh sesuatu'], ['pertanyaan', 'Saya ingin bertanya'],
  ['saran', 'Saran'], ['masukan', 'Masukan'], ['ide', 'Ide'],
  ['cerita', 'Cerita Jamaah'], ['pengalaman', 'Pengalaman bersama YTS'],
] as const;

const PATHWAYS = [
  { key: 'needs', label: 'Butuh arah', icon: HelpCircle, categories: ['kebutuhan', 'pertanyaan'],
    title: 'Ceritakan yang Anda butuhkan.', hint: 'Mungkin soal kajian, rekaman, layanan, atau cara mengikuti program YTS. Mulai dari mana saja.' },
  { key: 'input', label: 'Beri masukan', icon: Lightbulb, categories: ['saran', 'masukan', 'ide'],
    title: 'Apa yang bisa kami perbaiki?', hint: 'Sampaikan hal yang membantu, mengganggu, atau ide yang ingin Anda lihat hadir di YTS.' },
  { key: 'story', label: 'Bagi cerita', icon: BookOpen, categories: ['cerita', 'pengalaman'],
    title: 'Bagikan perjalanan Anda.', hint: 'Bagaimana Anda pertama kali mengenal kajian atau program YTS? Ini ruang pengalaman, bukan permintaan pujian.' },
] as const;

type Story = { id: string; subject: string; message: string; displayName: string; eventTitle: string | null; publishedAt: string };
type Form = { category: string; name: string; email: string; phone: string; subject: string; message: string; wantsReply: boolean; publicationConsent: boolean; anonymousPublication: boolean; website: string };
const EMPTY: Form = { category: 'kebutuhan', name: '', email: '', phone: '', subject: '', message: '', wantsReply: false, publicationConsent: false, anonymousPublication: true, website: '' };

export function JamaahRoomPage() {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('eventId');
  const [eventTitle, setEventTitle] = useState('');
  const [eventError, setEventError] = useState('');
  const [form, setForm] = useState<Form>(EMPTY);
  const [stories, setStories] = useState<Story[]>([]);
  const [storiesError, setStoriesError] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');
  usePageMetadata({ title: 'Ruang Jamaah | Yayasan Tarbiyah Sunnah', description: 'Ruang untuk didengar, disapa, dan tetap terhubung dengan ilmu serta program Yayasan Tarbiyah Sunnah.' });

  useEffect(() => {
    apiClient<Story[]>('/public/jamaah-room/stories').then(({ data }) => setStories(data)).catch(() => setStoriesError(true));
  }, []);
  useEffect(() => {
    if (!eventId) return;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId)) { setEventError('Tautan kajian tidak valid.'); return; }
    apiClient<{ title: string }>(`/public/jamaah-room/event/${eventId}`)
      .then(({ data }) => setEventTitle(data.title))
      .catch(() => setEventError('Kajian pada tautan ini tidak ditemukan. Anda tetap dapat mengirim pesan umum.'));
  }, [eventId]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));
  const isStory = form.category === 'cerita' || form.category === 'pengalaman';
  const selectedPath = PATHWAYS.find((path) => path.categories.some((category) => category === form.category)) || PATHWAYS[0];
  const visibleCategories = CATEGORIES.filter(([category]) => selectedPath.categories.some((value) => value === category));

  function changeReplyPreference(wantsReply: boolean) {
    setForm((current) => ({ ...current, wantsReply, ...(wantsReply ? {} : { email: '', phone: '' }) }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    setError('');
    setSending(true);
    try {
      const { data } = await apiClient<{ reference?: string }>('/public/jamaah-room', {
        method: 'POST', body: JSON.stringify({ ...form, eventId: eventTitle ? eventId : null,
          publicationConsent: isStory && form.publicationConsent }),
      });
      setReference(data.reference || 'DITERIMA');
      setForm(EMPTY);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Pesan belum terkirim. Silakan coba lagi.');
    } finally { setSending(false); }
  }

  return (
    <div className="jr">
      <header className="jr__header">
        <div className="jr__wrap jr__header-inner">
          <Link to="/kajian" className="jr__brand" aria-label="Yayasan Tarbiyah Sunnah, ke halaman kajian">
            <BrandEmblem useImage className="jr__logo" />
            <span><strong>Yayasan Tarbiyah Sunnah</strong><small>Ruang Jamaah</small></span>
          </Link>
          <nav className="jr__header-nav" aria-label="Navigasi Ruang Jamaah">
            <a href="#cerita">Cerita Jamaah</a>
            <Link to={eventTitle && eventId ? `/kajian/${eventId}` : '/kajian'}><ArrowLeft size={15} aria-hidden="true" /> Kajian</Link>
          </nav>
        </div>
      </header>
      <main>
        <section className="jr__intro" aria-labelledby="jr-title">
          <div className="jr__wrap jr__intro-grid">
            <div className="jr__intro-copy">
              <p className="jr__eyebrow">YTS / TEMPAT UNTUK TETAP TERHUBUNG</p>
              <h1 id="jr-title">Ruang Jamaah</h1>
              <p className="jr__lede">Anda tidak hanya hadir lalu tercatat. Kami ingin tetap menyapa, mendengar, dan membantu Anda menemukan jalan kembali ke ilmu serta program YTS.</p>
              <div className="jr__intro-actions">
                <a className="jr__primary-link" href="#sampaikan">Mulai bercerita <ArrowDownRight size={18} aria-hidden="true" /></a>
                <a className="jr__quiet-link" href="#cerita">Baca cerita jamaah <ArrowRight size={17} aria-hidden="true" /></a>
              </div>
            </div>
            <div className="jr__intro-note">
              <span className="jr__section-index">KAMI MENDENGAR</span>
              <p>Datang sendiri ke kajian, terbantu oleh rekaman, punya pertanyaan, atau ingin menyampaikan sesuatu? Semua itu layak didengar.</p>
              <div className="jr__values" aria-label="Disapa, didengar, dilayani, dan dihubungkan kembali">
                <span>Disapa</span><span>Didengar</span><span>Dilayani</span><span>Terhubung</span>
              </div>
            </div>
          </div>
        </section>

        <section id="sampaikan" className="jr__conversation" aria-labelledby="jr-conversation-title">
          <div className="jr__wrap jr__conversation-grid">
            <div className="jr__conversation-intro">
              <span className="jr__section-index">01 / RUANG UNTUK ANDA</span>
              <h2 id="jr-conversation-title">Mulai dari yang Anda rasakan.</h2>
              <p>Tidak harus tersusun rapi. Tulis dengan kata-kata Anda sendiri; tim YTS akan membacanya.</p>
              {eventTitle && <p className="jr__event-context">Tentang kajian <strong>{eventTitle}</strong></p>}
              {eventError && <p className="jr__inline-warning" role="status">{eventError}</p>}
              <div className="jr__privacy-note"><span>Pesan Anda bersifat privat.</span> Cerita hanya tampil bila Anda memberi izin dan tim YTS meninjaunya.</div>
            </div>
            <div className="jr__conversation-body">

              {reference ? (
                <div className="jr__success" role="status">
                  <CheckCircle2 size={31} aria-hidden="true" />
                  <h3>Terima kasih sudah bercerita.</h3>
                  <p>Pesan Anda sudah sampai ke tim YTS. Simpan nomor <strong>{reference}</strong> bila kelak Anda ingin menanyakannya. Jika Anda meminta balasan, kontak yang diberikan dapat digunakan tim untuk menindaklanjuti pesan.</p>
                  <button type="button" onClick={() => setReference('')} className="jr__secondary-button">Sampaikan hal lain</button>
                </div>
              ) : (
                <form onSubmit={submit} className="jr__form">
                  <fieldset className="jr__pathways">
                    <legend>Hari ini Anda ingin...</legend>
                    <div className="jr__path-list">
                      {PATHWAYS.map((path) => {
                        const Icon = path.icon;
                        return <button type="button" key={path.key} aria-pressed={selectedPath.key === path.key}
                          onClick={() => set('category', path.categories[0])} className="jr__path-button">
                          <Icon size={18} aria-hidden="true" /><span>{path.label}</span>
                        </button>;
                      })}
                    </div>
                  </fieldset>

                  <div className="jr__form-heading"><h3>{selectedPath.title}</h3><p>{selectedPath.hint}</p></div>
                  <fieldset className="jr__categories">
                    <legend>Lebih tepatnya</legend>
                    <div className="jr__category-list">
                      {visibleCategories.map(([value, label]) => <label key={value} className="jr__category-option">
                        <input type="radio" name="category" value={value} checked={form.category === value} onChange={() => set('category', value)} />
                        <span>{label}</span>
                      </label>)}
                    </div>
                  </fieldset>

                  <div className="jr__field"><label htmlFor="room-subject">Judul singkat <span aria-hidden="true">*</span></label>
                    <input id="room-subject" value={form.subject} onChange={(e) => set('subject', e.target.value)} required minLength={5} maxLength={160} placeholder={isStory ? 'Misalnya: Pertama kali datang sendiri' : 'Misalnya: Ingin tahu jadwal kajian berikutnya'} />
                  </div>
                  <div className="jr__field"><label htmlFor="room-message">Ceritakan kepada kami <span aria-hidden="true">*</span></label>
                    <textarea id="room-message" value={form.message} onChange={(e) => set('message', e.target.value)} required minLength={20} maxLength={4000} placeholder={isStory ? 'Awalnya saya datang sendiri...' : 'Apa yang sedang Anda alami atau butuhkan?'} />
                    <span className="jr__field-help">Tidak perlu menulis dengan sempurna. {form.message.length}/4000 karakter</span>
                  </div>

                  <div className="jr__contact">
                    <h3>Bagaimana kami menyapa Anda?</h3>
                    <p>Nama boleh dikosongkan. Kontak hanya diminta bila Anda ingin dihubungi kembali.</p>
                    <div className="jr__field"><label htmlFor="room-name">Nama panggilan <span>(opsional)</span></label>
                      <input id="room-name" autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={120} placeholder="Nama yang nyaman untuk Anda" />
                    </div>
                    <label className="jr__check"><input type="checkbox" checked={form.wantsReply} onChange={(e) => changeReplyPreference(e.target.checked)} /><span>Saya ingin dihubungi kembali oleh tim YTS.</span></label>
                    {form.wantsReply && <div className="jr__contact-methods">
                      <p>Isi setidaknya satu cara untuk menghubungi Anda.</p>
                      <div className="jr__field"><label htmlFor="room-phone">Nomor WhatsApp</label><input id="room-phone" type="tel" autoComplete="tel" inputMode="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="08xxxxxxxxxx" /></div>
                      <div className="jr__field"><label htmlFor="room-email">Alamat email</label><input id="room-email" type="email" autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} maxLength={254} placeholder="nama@contoh.com" /></div>
                    </div>}
                  </div>

                  {isStory && <div className="jr__consent">
                    <h3>Tentang cerita Anda</h3>
                    <p>Cerita ini tetap privat kecuali Anda memberi izin di bawah. Tim YTS akan meninjau dan menyiapkan versi yang aman sebelum ditampilkan.</p>
                    <label className="jr__check"><input type="checkbox" checked={form.publicationConsent} onChange={(e) => set('publicationConsent', e.target.checked)} /><span>Saya mengizinkan cerita ini dibagikan di Ruang Jamaah.</span></label>
                    {form.publicationConsent && <label className="jr__check"><input type="checkbox" checked={form.anonymousPublication} onChange={(e) => set('anonymousPublication', e.target.checked)} /><span>Bagikan tanpa nama saya.</span></label>}
                  </div>}

                  <div className="jr__honeypot" aria-hidden="true"><label htmlFor="room-website">Website</label><input id="room-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set('website', e.target.value)} /></div>
                  {error && <p className="jr__error" role="alert">{error}</p>}
                  <div className="jr__form-end"><button type="submit" disabled={sending} className="jr__submit"><Send size={17} aria-hidden="true" />{sending ? 'Mengirim pesan...' : isStory ? 'Kirim cerita saya' : 'Kirim pesan saya'}</button><p>Pesan ini masuk ke tim YTS, bukan langsung tampil di publik.</p></div>
                </form>
              )}
            </div>
          </div>
        </section>

        <section id="cerita" className="jr__stories" aria-labelledby="jr-stories-title">
          <div className="jr__wrap">
            <div className="jr__stories-heading"><div><span className="jr__section-index">02 / CERITA JAMAAH</span><h2 id="jr-stories-title">Perjalanan yang saling menguatkan.</h2></div><p>Pengalaman yang dibagikan atas izin penulis. Bukan testimonial; setiap cerita tetap milik jamaah yang mengalaminya.</p></div>
            {storiesError ? <p className="jr__stories-state" role="status">Cerita belum dapat dimuat saat ini. Anda tetap bisa menyampaikan pesan kepada tim YTS.</p> : stories.length ? (
              <div className="jr__story-list">{stories.map((story) => <article key={story.id} className="jr__story">
                <MessageCircle size={20} aria-hidden="true" /><div><h3>{story.subject}</h3><p>{story.message}</p><span>{story.displayName}{story.eventTitle ? ` · ${story.eventTitle}` : ''}</span></div>
              </article>)}</div>
            ) : <div className="jr__stories-empty"><HeartHandshake size={25} aria-hidden="true" /><p>Belum ada cerita yang dibagikan di sini. Ruang ini tetap terbuka untuk pengalaman yang mungkin juga membantu jamaah lain.</p><a href="#sampaikan">Bagikan perjalanan Anda <ArrowRight size={17} aria-hidden="true" /></a></div>}
          </div>
        </section>

        <section className="jr__continuity" aria-labelledby="jr-continuity-title">
          <div className="jr__wrap jr__continuity-inner">
            <div><span className="jr__section-index">TETAP TERHUBUNG</span><h2 id="jr-continuity-title">Langkah berikutnya bisa dimulai di sini.</h2></div>
            <nav aria-label="Layanan YTS lainnya" className="jr__continuity-links">
              <Link to="/kajian"><BookOpen size={18} aria-hidden="true" /> Jadwal kajian <ArrowRight size={16} aria-hidden="true" /></Link>
              <Link to="/peserta"><Ticket size={18} aria-hidden="true" /> Tiket saya <ArrowRight size={16} aria-hidden="true" /></Link>
              <Link to="/donasi"><HeartHandshake size={18} aria-hidden="true" /> Program YTS <ArrowRight size={16} aria-hidden="true" /></Link>
            </nav>
          </div>
        </section>
      </main>
      <footer className="jr__footer"><div className="jr__wrap"><span>Yayasan Tarbiyah Sunnah</span><span>Disapa. Didengar. Dilayani. Tetap terhubung.</span></div></footer>
    </div>
  );
}
