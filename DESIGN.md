# Design System — CRM YTS (Hallmark Anti-AI-Slop Standard)

/* Hallmark · genre: modern-minimal / editorial-foundation · theme: emerald-markaz */
/* Pre-emit critique: P5 H5 E5 S5 R5 V5 */

## 1. Brand Identity & Foundation Voice
Yayasan Tarbiyah Sunnah (YTS) adalah lembaga dakwah, pendidikan, dan sosial Islam. Antarmuka CRM didesain dengan pendekatan **High-Craft Modern Enterprise**:
* **Tone**: Utilitarian, tenang, amanah, presisi finansial, dan bermartabat.
* **Anti-AI-Slop Standards**:
  - Tanpa gradien ungu/violet gelap klise.
  - Tanpa bubble pills mengapung sembarangan.
  - Tanpa bento box acak dengan icon berlebihan.
  - Tipografi tegas dengan tracking proporsional (`letter-spacing: -0.015em` pada heading).
  - Konsistensi 8 state interaksi pada setiap tombol dan input: *default, hover, focus-visible, active, disabled, loading, error, success*.

---

## 2. Token Palet Warna (Tailored HSL / OKLCH)

```css
:root {
  /* Brand Markaz & Dakwah (Deep Emerald & Forest) */
  --color-brand-50: #f0fdf4;
  --color-brand-100: #dcfce7;
  --color-brand-200: #bbf7d0;
  --color-brand-600: #16a34a;
  --color-brand-700: #15803d;
  --color-brand-800: #065f46;
  --color-brand-900: #064e3b;
  --color-brand-950: #022c22;

  /* Gold & Wakaf Accent */
  --color-gold-500: #d97706;
  --color-gold-600: #b45309;

  /* Neutral Background & Surface (Warm Alabaster) */
  --color-canvas: #f8fafc;
  --color-surface-card: #ffffff;
  --color-surface-hover: #f1f5f9;
  --color-surface-border: #e2e8f0;
  --color-surface-border-strong: #cbd5e1;

  /* Typography Text Scale */
  --color-text-primary: #0f172a;
  --color-text-secondary: #475569;
  --color-text-muted: #64748b;
  --color-text-faint: #94a3b8;

  /* Functional Status */
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-danger: #ef4444;
  --color-info: #0284c7;

  /* Focus Ring */
  --color-focus: #065f46;
}
```

---

## 3. Tipografi (Google Fonts: Plus Jakarta Sans & Inter)
* **Display / Headings**: `'Plus Jakarta Sans', system-ui, -apple-system, sans-serif`
* **Body / Data**: `'Inter', system-ui, -apple-system, sans-serif`
* **Monospace / Nominal Ref**: `'JetBrains Mono', monospace`

---

## 4. 8-State Interactive Discipline
Setiap tombol dan elemen interaktif wajib mendukung:
1. `default`: Surface solid dengan border hairline 1px.
2. `hover`: Transisi halus `translateY(-1px)` dan peningkatan contrast.
3. `:focus-visible`: Outline `2px solid var(--color-focus)` dengan offset `2px`.
4. `:active`: Transisi `translateY(0.5px)` tactile feedback.
5. `disabled`: `opacity: 0.5; pointer-events: none; cursor: not-allowed`.
6. `loading`: Spinner indicator dan teks tertahan.
7. `error`: Border merah aksen dengan teks peringatan.
8. `success`: Highlight border/bg hijau emerald.
