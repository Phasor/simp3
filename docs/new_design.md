# Task: Upgrade simp2 Chat UI to “Centered, Uniform, Single-Line Composer”

## Objectives
1. **Centered conversation column** inside a full-width app shell (no more “too wide” feel).
2. **Uniform message bubbles** (same rounded shape for both sides).
3. **Single-line composer** (icons + input + send in one row, inline ⇧+↵ hint).
4. **Compact rhythm** (tighter vertical spacing + grouped messages).
5. **Dark mode + compact mode toggles** (persisted in `localStorage`).

---

## Design Tokens (Tailwind)
Add/confirm in `tailwind.config.js`:
```js
// tailwind.config.js
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#2563EB',
          600: '#2563EB',
          700: '#1D4ED8'
        }
      },
      boxShadow: {
        soft: '0 4px 24px rgba(0,0,0,0.06)',
      }
    }
  },
  plugins: []
}
```

---

## Layout Rules
- App stays full width, but **message column** is `mx-auto max-w-3xl px-4 sm:px-6 lg:px-8`.
- **You** (creator) messages: right-aligned, `bg-brand-600 text-white`.
- **Them** messages: left-aligned, `bg-white dark:bg-gray-800` + border.
- All bubbles: `rounded-2xl px-3.5 py-2.5`.
- Group consecutive messages from the same sender with `space-y-1.5`.
- Timestamps appear **on hover** via `.msg:hover .time { opacity: 1 }`.
- Composer is **single line**: `+` icon, emoji icon, pill input, Send button.

---

## Components (Next.js / Tailwind)

### 1) Messages container (centered column)
Replace your messages area wrapper with:
```tsx
<div id="messages" className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
  <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
    {/* messages go here */}
  </div>
</div>
```

### 2) Uniform bubbles
Use these two variants (drop the “notch” corners):

```tsx
{/* You (right) */}
<div className="flex justify-end mb-4">
  <div className="msg relative max-w-[78%] sm:max-w-[62%] rounded-2xl px-3.5 py-2.5 bg-brand-600 text-white shadow-soft">
    {text}
    <span className="time absolute -bottom-5 right-2 text-[10px] text-white/70 opacity-0 transition">now</span>
  </div>
</div>

{/* Them (left, grouped) */}
<div className="flex items-start gap-3 mb-5">
  <img src={avatarUrl} className="w-7 h-7 rounded-full mt-1" alt="" />
  <div className="space-y-1.5">
    <div className="msg relative max-w-[78%] sm:max-w-[62%] rounded-2xl px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-800 shadow-soft">
      {text}
      <span className="time absolute -bottom-5 left-2 text-[10px] text-gray-400 opacity-0 transition">2m</span>
    </div>
    {/* next bubbles from same sender */}
  </div>
</div>
```

### 3) Single-line composer
Replace your composer with:

```tsx
<div className="bg-white/80 dark:bg-gray-950/60 backdrop-blur border-t border-gray-200 dark:border-gray-800 p-3">
  <div className="max-w-3xl mx-auto flex items-center gap-3">
    {/* Add */}
    <button className="shrink-0 p-2 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800" title="Add">
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
    </button>

    {/* Emoji */}
    <button className="shrink-0 p-2 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100" title="Emoji">
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/>
      </svg>
    </button>

    {/* Input (pill) */}
    <div className="flex-1 relative">
      <textarea
        id="chat-input"
        rows={1}
        placeholder="Type a message..."
        className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-full px-4 py-2 pr-14 resize-none outline-none leading-6 text-[15px] shadow-sm"
      />
      <span className="absolute right-14 top-1/2 -translate-y-1/2 text-xs text-gray-400 hidden sm:block">⇧ + ↵</span>
    </div>

    {/* Send */}
    <button id="chat-send" className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-brand-600 text-white hover:bg-brand-700 active:translate-y-px transition">
      <svg className="w-4 h-4 -rotate-45" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 12h14"/><path d="m5 12 7 7"/><path d="m5 12 7-7"/>
      </svg>
      <span>Send</span>
    </button>
  </div>
</div>
```

### 4) Small CSS helpers (global or component `<style jsx global>`)

```css
/* Thin scrollbars and timestamp reveal */
* { scrollbar-width: thin; scrollbar-color: #CBD5E1 transparent; }
*::-webkit-scrollbar { height: 8px; width: 8px; }
*::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 999px; }
*::-webkit-scrollbar-track { background: transparent; }
.msg:hover .time { opacity: 1; }

/* Compact mode (optional) */
body.compact .msg { padding: .5rem .75rem !important; }
body.compact .group-stack > * + * { margin-top: .25rem !important; }
```

### 5) Minimal JS for autosize + shortcuts (React example)
```tsx
// In your chat page/component
useEffect(() => {
  const input = document.getElementById('chat-input') as HTMLTextAreaElement | null;
  if (!input) return;
  const autoGrow = () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 160) + 'px';
  };
  input.addEventListener('input', autoGrow);
  autoGrow();
  return () => input.removeEventListener('input', autoGrow);
}, []);

useEffect(() => {
  const input = document.getElementById('chat-input') as HTMLTextAreaElement | null;
  const send = document.getElementById('chat-send');
  if (!input || !send) return;

  const keyHandler = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      (send as HTMLButtonElement).click();
    }
  };
  input.addEventListener('keydown', keyHandler);
  return () => input.removeEventListener('keydown', keyHandler);
}, []);
```

---

## File Map (suggested)
- `app/chat/page.tsx` (or your current chat page) — apply layout changes.
- `components/ChatComposer.tsx` — replace with single-line composer.
- `styles/globals.css` — add helpers (timestamps/scrollbars & compact mode).

---

## Acceptance Criteria (QA)
- [ ] Conversation **column is centered** and limited to `max-w-3xl`, with comfortable side gutters on desktop.
- [ ] **All bubbles** (both sides) use `rounded-2xl px-3.5 py-2.5` with **no notched corners**.
- [ ] Consecutive messages from the same sender are **grouped** with **tight spacing** (≈ `space-y-1.5`).
- [ ] **Timestamps** appear on bubble **hover** only.
- [ ] Composer shows **+**, **emoji**, **pill input**, **Send** in a **single line** with inline `⇧+↵` hint.
- [ ] Press **Enter** to send, **Shift+Enter** for newline.
- [ ] **Dark mode** still looks correct (colors/borders/text).
- [ ] Optional: **Compact mode** (`document.body.classList.toggle('compact')`) shrinks padding & gaps.
- [ ] No horizontal scrollbar at common breakpoints (sm/md/lg/xl).
- [ ] Mobile: sidebar collapses (if you have one); messages and composer remain usable.

---

## Optional: Windows Commands (Tailwind rebuild)
If you need to rerun Tailwind build locally on Windows (PowerShell):

```powershell
# If using Next.js with Tailwind (JIT), dev server rebuilds automatically:
npm run dev

# If you have a separate Tailwind CLI build step:
npx tailwindcss -i .\styles\input.css -o .\public\tailwind.css --watch
```

---

## Hand-off Note (for Claude in Cursor)
> Apply the **exact Tailwind classes and structure** from this spec. Do not introduce variant shapes for bubbles. Keep the message column constrained to `max-w-3xl` and centered. Preserve dark mode. Implement the single-line composer as shown and ensure Enter/Shift+Enter behavior.
