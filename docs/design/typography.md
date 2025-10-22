# Simp3 Typography & Font Guide

This guide defines the global typography and font sizing system for the Simp3 app. It matches the look and feel of the Creator Launch modal, ensuring consistent visual hierarchy across your app.

---

## 1. Design Principles

- **Typeface:** Inter (primary font)
- **Line height:** 1.6 for body, 1.2–1.3 for headings
- **Weights:** 400 (body), 500 (UI), 600–800 (headings)
- **Scale:** Fluid modular scale via `clamp()`
- **Letter-spacing:** Slight negative on display text

---

## 2. Semantic Text Tokens

| Token | Usage |
|-------|-------|
| Display | Hero moments |
| H1/H2/H3 | Page & section headings |
| Subtitle | Supportive subtext |
| Body | Main content text |
| UI/Label | Buttons, inputs |
| Caption | Helper or legal text |
| Mono | Code or numeric display |

---

## 3. Tailwind Config

```ts
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      fontSize: {
        display: ['clamp(2rem, 3vw + 1rem, 3rem)', { lineHeight: '1.15', letterSpacing: '-0.01em' }],
        h1: ['clamp(1.75rem, 2.5vw + 0.75rem, 2.25rem)', { lineHeight: '1.2' }],
        h2: ['clamp(1.5rem, 1.6vw + 0.8rem, 1.875rem)', { lineHeight: '1.25' }],
        h3: ['clamp(1.25rem, 1.2vw + 0.6rem, 1.5rem)', { lineHeight: '1.3' }],
        'body-lg': ['1.125rem', { lineHeight: '1.65' }],
        body: ['1rem', { lineHeight: '1.65' }],
        'body-sm': ['0.9375rem', { lineHeight: '1.6' }],
        ui: ['0.9375rem', { lineHeight: '1.4', letterSpacing: '0.005em' }],
        label: ['0.875rem', { lineHeight: '1.4', letterSpacing: '0.01em' }],
        caption: ['0.8125rem', { lineHeight: '1.35' }],
        overline: ['0.75rem', { lineHeight: '1.2', letterSpacing: '0.08em', textTransform: 'uppercase' }],
      },
      fontWeight: {
        regular: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
        extrabold: '800',
      },
      colors: {
        text: {
          primary: 'rgba(255,255,255,0.98)',
          secondary: 'rgba(255,255,255,0.80)',
          muted: 'rgba(255,255,255,0.65)',
          subtle: 'rgba(255,255,255,0.55)',
          inverse: '#111827',
          accent: '#0ea5e9',
          success: '#34d399',
          danger: '#f87171',
        },
      },
    },
  },
  plugins: [],
}
export default config
```

---

## 4. Global CSS Variables

```css
:root {
  --font-sans: Inter, system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  --text-primary: rgba(255,255,255,0.98);
  --text-secondary: rgba(255,255,255,0.80);
  --text-muted: rgba(255,255,255,0.65);

  --fs-display: clamp(2rem, 3vw + 1rem, 3rem);
  --fs-h1: clamp(1.75rem, 2.5vw + .75rem, 2.25rem);
  --fs-h2: clamp(1.5rem, 1.6vw + .8rem, 1.875rem);
  --fs-h3: clamp(1.25rem, 1.2vw + .6rem, 1.5rem);
  --fs-body: 1rem;
}

.typ-display { font: 800 var(--fs-display)/1.15 var(--font-sans); }
.typ-h1 { font: 700 var(--fs-h1)/1.2 var(--font-sans); }
.typ-body { font: 400 var(--fs-body)/1.65 var(--font-sans); }
```

---

## 5. Usage Examples

```tsx
<h1 className="text-display font-extrabold text-text-primary">
  Your Paid Chat is Live
</h1>

<h2 className="text-h2 font-semibold text-text-primary">
  Promote Your Link
</h2>

<p className="text-body text-text-secondary">
  Fans can now message you 1-on-1 and unlock exclusive content.
</p>

<label className="text-label text-text-secondary">Your creator link</label>

<button className="text-ui font-semibold text-gray-900">Tweet my link</button>

<p className="text-caption text-text-muted">
  You can always find your link in Creator > Promote.
</p>
```

---

## 6. Component Class Layer

```css
@layer components {
  .typ-hero { @apply text-display font-extrabold text-text-primary; }
  .typ-h1 { @apply text-h1 font-bold text-text-primary; }
  .typ-h2 { @apply text-h2 font-semibold text-text-primary; }
  .typ-body { @apply text-body text-text-primary; }
  .typ-caption { @apply text-caption text-text-muted; }
}
```

---

## 7. Accessibility

- Minimum text size: **16px**
- Maintain **contrast ≥ 4.5:1**
- Vertical rhythm: multiples of 8px spacing
