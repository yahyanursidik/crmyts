# Design System — CRM YTS (Tarbiyah Sunnah Official Identity)

/* Hallmark · genre: modern-minimal / editorial-foundation · theme: tarbiyah-official-logo */
/* Color Calibration: Direct Extraction from Official Tarbiyah Sunnah Logo */

## 1. Brand Identity & Official Emblem
Yayasan Tarbiyah Sunnah (YTS) adalah lembaga dakwah, pendidikan, dan sosial Islam. Antarmuka CRM didesain menggunakan **Brand Identity Resmi Yayasan Tarbiyah Sunnah**:

* **Emblem Tiga Sinar Geometris**:
  - **Sinar Emas Atas (*Sunnah Gold*)**: `#EFA914` — Melambangkan cahaya ilmu dan kemurnian Sunnah Nabi ﷺ.
  - **Sinar Terakota Tengah (*Warm Terracotta / Amber*)**: `#D87114` — Melambangkan kehangatan dakwah, ukhuwah, dan amal sosial.
  - **Sinar Hijau Hutan Bawah (*Tarbiyah Forest Green*)**: `#447346` / `#365E38` — Melambangkan keteguhan iman, tarbiyah berkelanjutan, dan keberkahan wakaf.
  - **Latar Belakang (*Warm Ivory Cream*)**: `#FBFAF6` / `#F7F5ED` — Melambangkan ketenangan, adab, dan kesederhanaan Islami.

---

## 2. Token Palet Warna Resmi (Tailored Tokens)

```css
:root {
  /* 1. Tarbiyah Forest Green (Primary Brand & Typography) */
  --color-brand-50: #f3f8f3;
  --color-brand-100: #e4f1e5;
  --color-brand-200: #cde4ce;
  --color-brand-300: #a3cba5;
  --color-brand-400: #78aa7a;
  --color-brand-500: #558c58;
  --color-brand-600: #447346; /* Logo Main Green */
  --color-brand-700: #365e38;
  --color-brand-800: #28482a;
  --color-brand-900: #1c321d; /* Logo Typography Text */
  --color-brand-950: #122013; /* Deepest Sidebar Background */

  /* 2. Tarbiyah Warm Terracotta / Amber (Middle Ray) */
  --color-amber-500: #e88523;
  --color-amber-600: #d87114; /* Logo Middle Terracotta Ray */
  --color-amber-700: #c05c0f;
  --color-amber-800: #9f490a;

  /* 3. Tarbiyah Sunnah Gold (Top Ray) */
  --color-gold-400: #f7c244;
  --color-gold-500: #efa914; /* Logo Top Golden Ray */
  --color-gold-600: #dc9e10;
  --color-gold-700: #bb820a;

  /* 4. Canvas & Warm Surface (Logo Ivory Background) */
  --color-canvas: #fbfaf6;
  --color-surface-card: #ffffff;
  --color-surface-muted: #f7f5ed;
  --color-surface-border: #e8e5d8;
  --color-surface-border-strong: #d5d1c1;

  /* 5. Typography Text Scale */
  --color-text-primary: #1c321d;
  --color-text-secondary: #4f4b3e;
  --color-text-muted: #6b6657;
  --color-text-faint: #9e9988;

  /* 6. Functional Status */
  --color-success: #447346;
  --color-warning: #d87114;
  --color-danger: #e11d48;
  --color-info: #0284c7;

  /* 7. Focus Ring */
  --color-focus: #365e38;
}
```

---

## 3. Tipografi
* **Display / Headings**: `'Plus Jakarta Sans', system-ui, -apple-system, sans-serif` (`letter-spacing: -0.02em`)
* **Body / Data**: `'Inter', system-ui, -apple-system, sans-serif`
* **Monospace / Nominal Ref**: `'JetBrains Mono', monospace`

---

## 4. 8-State Interactive Discipline
Setiap tombol dan elemen interaktif mendukung 8 state konsisten:
1. `default`: Surface solid dengan border hairline 1px.
2. `hover`: Transisi halus `translateY(-1px)` dan kontras warna.
3. `:focus-visible`: Outline `2px solid var(--color-focus)` dengan offset `2px`.
4. `:active`: Transisi `translateY(0.5px)` tactile feedback.
5. `disabled`: `opacity: 0.5; pointer-events: none; cursor: not-allowed`.
6. `loading`: Spinner indicator dan teks tertahan.
7. `error`: Border merah aksen dengan teks peringatan.
8. `success`: Highlight border/bg hijau tarbiyah.
