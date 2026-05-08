# Redesign Fase 1 — Foundation (Styles, Fonts, Theme, Primitives)

**Tanggal:** 2026-05-08
**Konteks:** Fase pertama dari rebuild frontend ke desain "Gov Modern Variation C" (export di `D:\export-c`). Fase ini menyiapkan fondasi visual: stylesheet, font, theme system, dan komponen primitif (icon + chart). Belum menyentuh layout/halaman — itu fase 2 dan seterusnya.

## Tujuan

Setelah fase ini selesai, project bisa:
- Render CSS class `.ns-*` dari design ke elemen Vue mana saja
- Toggle light/dark theme via composable `useTheme()`, persist via localStorage, default ikut OS
- Pakai `<Icon name="..." />` untuk semua ikon dari design (~22 nama)
- Render chart Sparkline dan StackedBars dengan data dinamis

Halaman yang ada (DataView, Bulanan, Mingguan) **tidak diubah** di fase ini. Element Plus tetap aktif.

## Struktur File

```
frontend/src/
├── assets/
│   └── styles/
│       ├── design-tokens.css      ← copy: D:\export-c\styles.css (604 lines)
│       └── design-bookman.css     ← copy: D:\export-c\styles-bc.css (260 lines)
├── composables/
│   └── useTheme.js                ← reactive mode + toggle + apply CSS vars
├── components/
│   ├── Icon.vue                   ← <Icon name="search" :size="16" />
│   ├── LambangPN.vue              ← logo SVG (port dari primitives.jsx)
│   └── charts/
│       ├── Sparkline.vue
│       └── StackedBars.vue
```

`composables/` adalah folder baru — Vue 3 Composition API convention.

## Wiring `main.js`

Tambah import CSS setelah Element Plus, sebelum `style.css`:

```js
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import './assets/styles/design-tokens.css'
import './assets/styles/design-bookman.css'
import './style.css'
import App from './App.vue'
import router from './router'

const app = createApp(App)
app.use(ElementPlus)
app.use(router)
app.mount('#app')
```

Urutan: Element Plus dulu, design tokens, lalu existing `style.css`. Existing `style.css` bisa override design — tapi karena belum dipakai untuk halaman baru, nggak konflik.

## Font

Design pakai font stack:
```css
font-family: "Bookman Old Style", "Bookman", "URW Bookman L", Georgia, serif;
```
"Bookman Old Style" adalah font sistem Windows. Di mesin lain fallback ke "Bookman", lalu "URW Bookman L" (Linux), lalu "Georgia" (universal). Tidak ada `@font-face` yang perlu di-load — pakai system fonts.

JetBrains Mono dari Google Fonts (untuk monospace di nomor perkara/timestamp). Tambahin ke `frontend/index.html`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
```

## Theme System

### Composable `useTheme.js`

```js
import { ref, watch, readonly } from 'vue'

const STORAGE_KEY = 'ns-theme'
const lightTheme = { /* ...lightThemeC dari app-c.jsx... */ }
const darkTheme  = { /* ...darkThemeC dari app-c.jsx... */ }

const mode = ref(initialMode())

function initialMode() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(m) {
  const t = m === 'dark' ? darkTheme : lightTheme
  const root = document.documentElement
  root.dataset.mode = m
  for (const [key, value] of Object.entries(t)) {
    root.style.setProperty(`--${kebab(key)}`, value)
  }
}

function kebab(s) {
  return s.replace(/[A-Z]/g, c => '-' + c.toLowerCase())
}

watch(mode, applyTheme, { immediate: true })

export function useTheme() {
  return {
    mode: readonly(mode),
    isDark: () => mode.value === 'dark',
    toggle() {
      mode.value = mode.value === 'dark' ? 'light' : 'dark'
      localStorage.setItem(STORAGE_KEY, mode.value)
    }
  }
}
```

Module-level state — satu instance untuk seluruh app. Singleton pattern via top-of-module `ref`.

`watch(..., { immediate: true })` apply theme begitu module di-load (pas `useTheme()` pertama kali dipanggil dari mana pun).

### Theme objects

Salin `lightThemeC` + `darkThemeC` dari `D:\export-c\app-c.jsx` line 163-183. Keys: `bg, bg2, surface, surface2, border, text, text2, text3, accent, accent2, accentSoft, accentGlow, danger, warn, info, gradientBg`.

Konversi kebab-case: `accent2` → `--accent-2`, `accentSoft` → `--accent-soft`, dll. Sesuai dengan nama CSS var di `app-c.jsx` line 47-54.

## Komponen `Icon.vue`

Single-file component dengan SVG markup di-render via `v-html` atau template. Prop:
- `name: string` — nama ikon (search, refresh, sync, trash, chevronDown, chevronRight, close, bell, folder, filePlus, fileCheck, calendar, clock, wallet, scale, gavel, fish, chartBar, settings, menu, sun, moon, trendUp, trendDown, check, user, dot, arrowRight, activity)
- `size: number` (default 16)

Internal: object/Map `name → SVG inner content` (sebagai template string atau berisi `<path>...</path>` saja). Wrap dalam `<svg>` dengan attribute standar (viewBox, fill, stroke, strokeWidth, strokeLinecap).

Source SVG: salin path data dari `primitives.jsx` line 3-33. Total 30+ ikon — port semua sekaligus.

Kalau `name` tidak match, return null + warning console.

## Komponen Chart

### `Sparkline.vue`

Props:
- `data: number[]`
- `color: string` (default `#10b981`)
- `width: number` (default 200)
- `height: number` (default 60)
- `fill: boolean` (default true)

Render SVG dengan area gradient + line + last-point marker. Logic persis dengan `primitives.jsx:66-93`. Pakai `useId()` Vue equivalent untuk unique gradient id (`useId()` di Vue 3.5+ atau gunakan `Math.random().toString(36)`).

### `StackedBars.vue`

Props:
- `data: { week: string, pidana: number, perdata: number }[]`
- `width: number` (default 280)
- `height: number` (default 100)
- `colorA: string` (default `#10b981`)
- `colorB: string` (default `#34d399`)

Logic dari `primitives.jsx:96-118`.

## Komponen `LambangPN.vue`

Props:
- `size: number` (default 36)
- `primary: string` (default `#10b981`)
- `secondary: string` (default `#fff`)

Logo SVG pohon beringin. Port dari `primitives.jsx:36-63`.

## Verifikasi

Buat halaman test sementara `frontend/src/views/FoundationTest.vue` dan route `/test-foundation`. Halaman ini render:
- 5 ikon (`Icon name="search"`, `sun`, `moon`, `trendUp`, `bell`)
- 1 `Sparkline` dengan data dummy `[3,5,4,7,6,8,10,9]`
- 1 `StackedBars` dengan `[{week:'W1',pidana:5,perdata:2}, ...]`
- Tombol toggle tema yang panggil `useTheme().toggle()` — observasi `<html data-mode>` dan beberapa CSS var dari DevTools
- 1 `LambangPN` size=64

Setelah Fase 5 selesai, route ini dihapus.

## Out of scope

- Layout `AppShell` (Fase 2)
- Sidebar / topbar / hero (Fase 2)
- Stats strip / chart cards / tabel / detail panel (Fase 3)
- Halaman Bulanan/Mingguan (Fase 4)
- Responsive breakpoint, animasi transisi (Fase 5)
- Hapus existing `style.css` lama (Fase 5)
- Test framework / unit test (project belum punya, scope creep)
