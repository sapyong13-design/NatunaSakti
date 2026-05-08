# Redesign Fase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pasang fondasi visual untuk redesign frontend — stylesheet, font, theme system (light/dark + persist), dan komponen primitif (Icon, LambangPN, Sparkline, StackedBars). Halaman existing tidak diubah.

**Architecture:** Style global dipasang di `frontend/src/assets/styles/`. Theme jadi composable Vue 3 module-singleton — `useTheme()` mengelola state, persist localStorage, apply CSS vars di `<html>`. Komponen primitif jadi single-file Vue di `frontend/src/components/`. Verifikasi via halaman test sementara `/test-foundation`.

**Tech Stack:** Vue 3 (Composition API), Element Plus (di-keep), Vite, system font stack.

**Catatan TDD:** Project tidak punya test runner. Verifikasi tiap task via manual: dev server start tanpa error, browser DevTools confirm DOM/CSS, console clean.

**Sebelum mulai:** pastiin frontend dev server bisa start. Cek port 5173 — kalau ada Vite running dari sesi lain, kill dulu:

```powershell
$p = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($p) { Stop-Process -Id $p.OwningProcess -Force }
```

---

### Task 1: Copy design CSS + import di `main.js`

**Files:**
- Create: `frontend/src/assets/styles/design-tokens.css` (copy from `D:\export-c\styles.css`)
- Create: `frontend/src/assets/styles/design-bookman.css` (copy from `D:\export-c\styles-bc.css`)
- Modify: `frontend/src/main.js`

- [ ] **Step 1: Copy stylesheets**

```bash
mkdir -p "C:\Users\faris\Documents\natunasakti\frontend\src\assets\styles"
cp "D:\export-c\styles.css" "C:\Users\faris\Documents\natunasakti\frontend\src\assets\styles\design-tokens.css"
cp "D:\export-c\styles-bc.css" "C:\Users\faris\Documents\natunasakti\frontend\src\assets\styles\design-bookman.css"
```

Verify file sizes match source (~22KB and ~8.7KB):
```bash
ls -la "C:\Users\faris\Documents\natunasakti\frontend\src\assets\styles"
```

Expected: 2 files dengan size mendekati `D:\export-c` originals.

- [ ] **Step 2: Import di `main.js`**

Replace seluruh isi `C:\Users\faris\Documents\natunasakti\frontend\src\main.js` dengan:

```javascript
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

Urutan penting: Element Plus dulu, design tokens, lalu existing `style.css`.

- [ ] **Step 3: Restart dev server, verify no error**

```powershell
$p = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($p) { Stop-Process -Id $p.OwningProcess -Force }
```

```bash
cd "C:\Users\faris\Documents\natunasakti\frontend" && npm run dev > dev.log 2>&1 &
sleep 5 && grep -i "error\|fail" dev.log || echo "no errors"
```

Expected: `no errors`. Output `dev.log` should show Vite ready notice.

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add frontend/src/assets/styles/design-tokens.css frontend/src/assets/styles/design-bookman.css frontend/src/main.js && git commit -m "style: import design tokens (variation C) stylesheets"
```

---

### Task 2: Tambah JetBrains Mono ke `index.html`

**Files:**
- Modify: `frontend/index.html`

- [ ] **Step 1: Tambah `<link>` font**

Buka `C:\Users\faris\Documents\natunasakti\frontend\index.html`. Cari tag `<head>...</head>`. Sebelum `</head>`, tambahkan:

```html
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Verify font load di browser**

Dev server harusnya hot-reload setelah edit `index.html` (atau kill+start ulang kalau perlu). Buka http://localhost:5173, DevTools → Network → filter "googleapis" — harus ada request ke `fonts.googleapis.com/css2?family=JetBrains+Mono...` dengan status 200.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add frontend/index.html && git commit -m "style: load JetBrains Mono from Google Fonts"
```

---

### Task 3: `useTheme` composable

**Files:**
- Create: `frontend/src/composables/useTheme.js`

- [ ] **Step 1: Buat folder + file**

```bash
mkdir -p "C:\Users\faris\Documents\natunasakti\frontend\src\composables"
```

Tulis `C:\Users\faris\Documents\natunasakti\frontend\src\composables\useTheme.js` dengan isi:

```javascript
import { ref, watch, readonly } from 'vue'

const STORAGE_KEY = 'ns-theme'

const lightTheme = {
    bg: '#fbfdfc',
    bg2: '#ffffff',
    surface: 'rgba(255,255,255,0.95)',
    surface2: 'rgba(16,75,55,0.04)',
    border: 'rgba(16,75,55,0.1)',
    text: '#0a2e22',
    text2: 'rgba(10,46,34,0.7)',
    text3: 'rgba(10,46,34,0.5)',
    accent: '#047857',
    accent2: '#10b981',
    accentSoft: 'rgba(4,120,87,0.1)',
    accentGlow: 'rgba(4,120,87,0.25)',
    danger: '#dc2626',
    warn: '#d97706',
    info: '#1d4ed8',
    gradientBg: '#fbfdfc'
}

const darkTheme = {
    bg: '#0a1612',
    bg2: '#0f1f1a',
    surface: 'rgba(255,255,255,0.04)',
    surface2: 'rgba(255,255,255,0.02)',
    border: 'rgba(255,255,255,0.08)',
    text: '#e5f0ea',
    text2: 'rgba(229,240,234,0.72)',
    text3: 'rgba(229,240,234,0.45)',
    accent: '#10b981',
    accent2: '#34d399',
    accentSoft: 'rgba(16,185,129,0.14)',
    accentGlow: 'rgba(16,185,129,0.4)',
    danger: '#f87171',
    warn: '#fbbf24',
    info: '#60a5fa',
    gradientBg: '#0a1612'
}

function initialMode() {
    if (typeof window === 'undefined') return 'light'
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function kebab(s) {
    return s.replace(/[A-Z]/g, c => '-' + c.toLowerCase())
}

function applyTheme(m) {
    const t = m === 'dark' ? darkTheme : lightTheme
    const root = document.documentElement
    root.dataset.mode = m
    for (const [key, value] of Object.entries(t)) {
        root.style.setProperty(`--${kebab(key)}`, value)
    }
}

const mode = ref(initialMode())
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

- [ ] **Step 2: Smoke test composable di console**

Belum ada UI yang pakai. Untuk verify, cek browser console di http://localhost:5173 — biarkan Vite import tetap kompilasi tanpa error. Cek Vite/dev.log:

```bash
sleep 2 && grep -iE "error|fail" "C:\Users\faris\Documents\natunasakti\frontend\dev.log" | tail -5 || echo "no errors"
```

Expected: `no errors`. Belum dipakai jadi belum apply CSS vars — itu di Task 8.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add frontend/src/composables/useTheme.js && git commit -m "feat: useTheme composable with localStorage + system preference"
```

---

### Task 4: `Icon.vue` component

**Files:**
- Create: `frontend/src/components/Icon.vue`

- [ ] **Step 1: Buat Icon.vue**

Tulis `C:\Users\faris\Documents\natunasakti\frontend\src\components\Icon.vue` dengan isi:

```vue
<script setup>
defineProps({
    name: { type: String, required: true },
    size: { type: Number, default: 16 }
})

const ICONS = {
    search:       { vb: '0 0 24 24', sw: 1.8, body: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>' },
    refresh:      { vb: '0 0 24 24', sw: 1.8, body: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>' },
    sync:         { vb: '0 0 24 24', sw: 1.8, body: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>' },
    trash:        { vb: '0 0 24 24', sw: 1.8, body: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/>' },
    chevronDown:  { vb: '0 0 24 24', sw: 1.8, body: '<path d="m6 9 6 6 6-6"/>' },
    chevronRight: { vb: '0 0 24 24', sw: 1.8, body: '<path d="m9 6 6 6-6 6"/>' },
    close:        { vb: '0 0 24 24', sw: 1.8, body: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>' },
    bell:         { vb: '0 0 24 24', sw: 1.8, body: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>' },
    folder:       { vb: '0 0 24 24', sw: 1.8, body: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>' },
    filePlus:     { vb: '0 0 24 24', sw: 1.8, body: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 12v6"/><path d="M9 15h6"/>' },
    fileCheck:    { vb: '0 0 24 24', sw: 1.8, body: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/>' },
    calendar:     { vb: '0 0 24 24', sw: 1.8, body: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>' },
    clock:        { vb: '0 0 24 24', sw: 1.8, body: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>' },
    wallet:       { vb: '0 0 24 24', sw: 1.8, body: '<path d="M19 7H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z"/><path d="M16 14h.01"/><path d="M3 9V6a2 2 0 0 1 2-2h11"/>' },
    scale:        { vb: '0 0 24 24', sw: 1.8, body: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>' },
    gavel:        { vb: '0 0 24 24', sw: 1.8, body: '<path d="m14.5 12.5-8 8a2.12 2.12 0 0 1-3-3l8-8"/><path d="m16 16 6-6"/><path d="m8 8 6-6"/><path d="m9 7 8 8"/><path d="m21 11-8-8"/>' },
    fish:         { vb: '0 0 24 24', sw: 1.8, body: '<path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z"/><path d="M18 12v.5"/><path d="M16 17.93a9.77 9.77 0 0 1 0-11.86"/><path d="M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5-.23 6.5C5.58 18.03 7 16 7 13.33"/><path d="M10.46 7.26C10.2 5.88 9.17 4.24 8 3h5.8a2 2 0 0 1 1.98 1.67l.23 1.4"/><path d="m16.01 17.93-.23 1.4A2 2 0 0 1 13.8 21H9.5a5.96 5.96 0 0 0 1.49-3.98"/>' },
    chartBar:     { vb: '0 0 24 24', sw: 1.8, body: '<path d="M3 3v18h18"/><path d="M7 16V11"/><path d="M12 16V8"/><path d="M17 16v-3"/>' },
    settings:     { vb: '0 0 24 24', sw: 1.8, body: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>' },
    menu:         { vb: '0 0 24 24', sw: 1.8, body: '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>' },
    sun:          { vb: '0 0 24 24', sw: 1.8, body: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m4.93 19.07 1.41-1.41"/><path d="m17.66 6.34 1.41-1.41"/>' },
    moon:         { vb: '0 0 24 24', sw: 1.8, body: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>' },
    trendUp:      { vb: '0 0 24 24', sw: 2,   body: '<path d="M22 7 13.5 15.5 8.5 10.5 2 17"/><path d="M16 7h6v6"/>' },
    trendDown:    { vb: '0 0 24 24', sw: 2,   body: '<path d="M22 17 13.5 8.5 8.5 13.5 2 7"/><path d="M16 17h6v-6"/>' },
    check:        { vb: '0 0 24 24', sw: 2.5, body: '<path d="M20 6 9 17l-5-5"/>' },
    user:         { vb: '0 0 24 24', sw: 1.8, body: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>' },
    dot:          { vb: '0 0 8 8',   sw: 0,   body: '<circle cx="4" cy="4" r="3" fill="currentColor"/>' },
    arrowRight:   { vb: '0 0 24 24', sw: 2,   body: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>' },
    activity:     { vb: '0 0 24 24', sw: 1.8, body: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>' }
}
</script>

<template>
    <svg
        v-if="ICONS[name]"
        :width="size"
        :height="size"
        :viewBox="ICONS[name].vb"
        fill="none"
        stroke="currentColor"
        :stroke-width="ICONS[name].sw"
        stroke-linecap="round"
        stroke-linejoin="round"
        v-html="ICONS[name].body"
    />
</template>
```

Catatan: `dot` punya `stroke-width: 0` karena dia pakai `fill` (lihat body — `fill="currentColor"`), bukan stroke. Acceptable karena rendering di-handle SVG sendiri.

- [ ] **Step 2: Verify dev server tidak error**

```bash
sleep 2 && grep -iE "error|fail" "C:\Users\faris\Documents\natunasakti\frontend\dev.log" | tail -5 || echo "no errors"
```

Expected: `no errors`. Component belum dipakai jadi cuma harus parse benar.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add frontend/src/components/Icon.vue && git commit -m "feat: Icon component with 30 Lucide-style icons"
```

---

### Task 5: `LambangPN.vue` component

**Files:**
- Create: `frontend/src/components/LambangPN.vue`

- [ ] **Step 1: Buat file**

Tulis `C:\Users\faris\Documents\natunasakti\frontend\src\components\LambangPN.vue` dengan isi:

```vue
<script setup>
import { computed } from 'vue'

const props = defineProps({
    size: { type: Number, default: 36 },
    primary: { type: String, default: '#10b981' },
    secondary: { type: String, default: '#fff' }
})

const gradId = computed(() => 'lpn-grad-' + Math.random().toString(36).slice(2, 9))
</script>

<template>
    <svg :width="size" :height="size" viewBox="0 0 64 64" fill="none">
        <defs>
            <linearGradient :id="gradId" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" :stop-color="primary" stop-opacity="1" />
                <stop offset="100%" :stop-color="primary" stop-opacity="0.7" />
            </linearGradient>
        </defs>
        <!-- Outer pentagon -->
        <path d="M32 4 L58 22 L48 56 L16 56 L6 22 Z" :fill="`url(#${gradId})`" :stroke="secondary" stroke-width="1.2" />
        <!-- Scale of justice -->
        <g :stroke="secondary" stroke-width="1.6" stroke-linecap="round" fill="none">
            <line x1="32" y1="18" x2="32" y2="44" />
            <line x1="20" y1="24" x2="44" y2="24" />
            <path d="M20 24 L16 32 Q20 34 24 32 Z" :fill="secondary" fill-opacity="0.9" />
            <path d="M44 24 L40 32 Q44 34 48 32 Z" :fill="secondary" fill-opacity="0.9" />
            <circle cx="32" cy="44" r="2.5" :fill="secondary" />
        </g>
        <!-- Tree leaves on top -->
        <g :fill="secondary" fill-opacity="0.85">
            <circle cx="32" cy="14" r="3" />
            <circle cx="27" cy="16" r="2" />
            <circle cx="37" cy="16" r="2" />
        </g>
    </svg>
</template>
```

- [ ] **Step 2: Verify dev server tidak error**

```bash
sleep 2 && grep -iE "error|fail" "C:\Users\faris\Documents\natunasakti\frontend\dev.log" | tail -5 || echo "no errors"
```

Expected: `no errors`.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add frontend/src/components/LambangPN.vue && git commit -m "feat: LambangPN logo component"
```

---

### Task 6: `Sparkline.vue` chart component

**Files:**
- Create: `frontend/src/components/charts/Sparkline.vue`

- [ ] **Step 1: Buat folder + file**

```bash
mkdir -p "C:\Users\faris\Documents\natunasakti\frontend\src\components\charts"
```

Tulis `C:\Users\faris\Documents\natunasakti\frontend\src\components\charts\Sparkline.vue` dengan isi:

```vue
<script setup>
import { computed } from 'vue'

const props = defineProps({
    data: { type: Array, required: true },
    color: { type: String, default: '#10b981' },
    width: { type: Number, default: 200 },
    height: { type: Number, default: 60 },
    fill: { type: Boolean, default: true }
})

const gradId = 'spark-' + Math.random().toString(36).slice(2, 9)

const computed_ = computed(() => {
    const max = Math.max(...props.data)
    const min = Math.min(...props.data)
    const range = max - min || 1
    const step = props.width / Math.max(1, props.data.length - 1)
    const points = props.data.map((v, i) => [
        i * step,
        props.height - ((v - min) / range) * (props.height - 8) - 4
    ])
    const path = points
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
        .join(' ')
    const areaPath = `${path} L ${props.width} ${props.height} L 0 ${props.height} Z`
    const last = points[points.length - 1] || [0, 0]
    return { points, path, areaPath, last }
})
</script>

<template>
    <svg :width="width" :height="height" style="display: block">
        <defs>
            <linearGradient :id="gradId" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" :stop-color="color" stop-opacity="0.35" />
                <stop offset="100%" :stop-color="color" stop-opacity="0" />
            </linearGradient>
        </defs>
        <path v-if="fill" :d="computed_.areaPath" :fill="`url(#${gradId})`" />
        <path
            :d="computed_.path"
            fill="none"
            :stroke="color"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
        />
        <g v-if="computed_.points.length">
            <circle :cx="computed_.last[0]" :cy="computed_.last[1]" r="6" :fill="color" fill-opacity="0.2" />
            <circle :cx="computed_.last[0]" :cy="computed_.last[1]" r="3" :fill="color" />
        </g>
    </svg>
</template>
```

- [ ] **Step 2: Verify dev server tidak error**

```bash
sleep 2 && grep -iE "error|fail" "C:\Users\faris\Documents\natunasakti\frontend\dev.log" | tail -5 || echo "no errors"
```

Expected: `no errors`.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add frontend/src/components/charts/Sparkline.vue && git commit -m "feat: Sparkline chart component"
```

---

### Task 7: `StackedBars.vue` chart component

**Files:**
- Create: `frontend/src/components/charts/StackedBars.vue`

- [ ] **Step 1: Buat file**

Tulis `C:\Users\faris\Documents\natunasakti\frontend\src\components\charts\StackedBars.vue` dengan isi:

```vue
<script setup>
import { computed } from 'vue'

const props = defineProps({
    data: { type: Array, required: true },
    width: { type: Number, default: 280 },
    height: { type: Number, default: 100 },
    colorA: { type: String, default: '#10b981' },
    colorB: { type: String, default: '#34d399' }
})

const bars = computed(() => {
    const max = Math.max(...props.data.map(d => d.pidana + d.perdata))
    const barW = (props.width - 16) / props.data.length
    return props.data.map((d, i) => {
        const total = d.pidana + d.perdata
        const totalH = (total / max) * props.height
        const pidH = (d.pidana / max) * props.height
        const perH = (d.perdata / max) * props.height
        const x = 8 + i * barW
        const y = props.height - totalH
        return { x, y, barW, pidH, perH, week: d.week }
    })
})
</script>

<template>
    <svg :width="width" :height="height + 20" style="display: block">
        <g v-for="(b, i) in bars" :key="i">
            <rect :x="b.x + 3" :y="b.y" :width="b.barW - 6" :height="b.pidH" rx="3" :fill="colorA" />
            <rect :x="b.x + 3" :y="b.y + b.pidH" :width="b.barW - 6" :height="b.perH" rx="3" :fill="colorB" opacity="0.85" />
            <text
                :x="b.x + b.barW / 2"
                :y="height + 14"
                text-anchor="middle"
                font-size="9"
                fill="currentColor"
                opacity="0.6"
            >{{ b.week }}</text>
        </g>
    </svg>
</template>
```

- [ ] **Step 2: Verify dev server tidak error**

```bash
sleep 2 && grep -iE "error|fail" "C:\Users\faris\Documents\natunasakti\frontend\dev.log" | tail -5 || echo "no errors"
```

Expected: `no errors`.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add frontend/src/components/charts/StackedBars.vue && git commit -m "feat: StackedBars chart component"
```

---

### Task 8: `FoundationTest` view + route + final verification

**Files:**
- Create: `frontend/src/views/FoundationTest.vue`
- Modify: `frontend/src/router/index.js`

- [ ] **Step 1: Buat view**

Tulis `C:\Users\faris\Documents\natunasakti\frontend\src\views\FoundationTest.vue` dengan isi:

```vue
<script setup>
import { useTheme } from '../composables/useTheme'
import Icon from '../components/Icon.vue'
import LambangPN from '../components/LambangPN.vue'
import Sparkline from '../components/charts/Sparkline.vue'
import StackedBars from '../components/charts/StackedBars.vue'

const theme = useTheme()
const sparkData = [3, 5, 4, 7, 6, 8, 10, 9]
const barData = [
    { week: 'W1', pidana: 4, perdata: 2 },
    { week: 'W2', pidana: 6, perdata: 3 },
    { week: 'W3', pidana: 5, perdata: 4 },
    { week: 'W4', pidana: 8, perdata: 3 },
    { week: 'W5', pidana: 7, perdata: 5 },
    { week: 'W6', pidana: 9, perdata: 4 }
]
</script>

<template>
    <div style="padding: 24px; background: var(--bg); color: var(--text); min-height: 100vh; font-family: 'Bookman Old Style', 'Bookman', 'URW Bookman L', Georgia, serif;">
        <h1>Foundation Test</h1>
        <p>Mode saat ini: <b>{{ theme.mode.value }}</b></p>
        <button @click="theme.toggle()" style="padding: 8px 16px; cursor: pointer;">
            Toggle theme
        </button>

        <h2 style="margin-top: 32px;">Icons</h2>
        <div style="display: flex; gap: 16px; align-items: center; color: var(--accent);">
            <Icon name="search" :size="20" />
            <Icon name="sun" :size="20" />
            <Icon name="moon" :size="20" />
            <Icon name="trendUp" :size="20" />
            <Icon name="bell" :size="20" />
            <Icon name="gavel" :size="20" />
            <Icon name="fish" :size="20" />
            <Icon name="dot" :size="12" />
        </div>

        <h2 style="margin-top: 32px;">LambangPN</h2>
        <LambangPN :size="64" :primary="'#047857'" />

        <h2 style="margin-top: 32px;">Sparkline</h2>
        <Sparkline :data="sparkData" />

        <h2 style="margin-top: 32px;">StackedBars</h2>
        <StackedBars :data="barData" />
    </div>
</template>
```

- [ ] **Step 2: Tambah route**

Edit `C:\Users\faris\Documents\natunasakti\frontend\src\router\index.js`. Cari array `routes`, tambah entry baru sebelum closing bracket:

```javascript
{
    path: '/test-foundation',
    name: 'test-foundation',
    component: () => import('../views/FoundationTest.vue')
}
```

(Pastikan route ini ditambahkan ke `routes` array — tidak duplikasi entry.)

- [ ] **Step 3: Verify halaman jalan**

Buka http://localhost:5173/test-foundation di browser.

Manual checks:
1. Halaman render tanpa blank/error
2. Heading "Foundation Test" muncul, font terlihat serif (Bookman/Georgia)
3. 8 ikon tampil (search, sun, moon, trendUp, bell, gavel, fish, dot)
4. LambangPN tampil sebagai pentagon hijau
5. Sparkline tampil sebagai garis dengan area gradient
6. StackedBars tampil sebagai 6 bar stacked
7. Klik tombol "Toggle theme":
   - Background berubah (light ↔ dark)
   - Console DevTools: `document.documentElement.dataset.mode` flipped
   - localStorage ada key `ns-theme` dengan value "dark" atau "light"
   - Reload halaman → mode tetap (persist OK)
8. Console browser bersih dari error

Confirm via DevTools Network bahwa Google Fonts JetBrains Mono ke-load (untuk dipakai di mode mono nanti).

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add frontend/src/views/FoundationTest.vue frontend/src/router/index.js && git commit -m "test: foundation verification view at /test-foundation"
```

- [ ] **Step 5: Push semua commit Fase 1**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git push origin master
```

- [ ] **Step 6: Commit spec & plan dokumen**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add docs/superpowers/specs/2026-05-08-redesign-fase-1-foundation-design.md docs/superpowers/plans/2026-05-08-redesign-fase-1-foundation.md && git commit -m "docs: spec and plan for redesign fase 1 foundation"
```

```bash
cd "C:\Users\faris\Documents\natunasakti" && git push origin master
```
