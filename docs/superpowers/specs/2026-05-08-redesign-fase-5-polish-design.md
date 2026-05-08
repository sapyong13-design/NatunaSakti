# Redesign Fase 5 — Polish (Cleanup, Animations, Responsive)

**Tanggal:** 2026-05-08
**Konteks:** Fase 5 (terakhir) dari rebuild frontend. Fase 1-4 menyelesaikan stylesheet, shell, DataView, dan reports. Fase 5 mempolish — bersihkan dependencies & file lama, tambahkan animasi DetailPanel slide, dan responsive breakpoints.

## Tujuan

Setelah fase ini:
- Element Plus dependency hilang dari project (tidak ada user lagi setelah Fase 4)
- File lama (InputView, FoundationTest, HelloWorld, hero.png, style.css lama) ke-hapus
- Route `/input` dan `/test-foundation` ke-hapus
- DetailPanel slide-in dengan animasi smooth via Vue `<Transition>`
- Layout responsive di breakpoint ≤ 768px — sidebar narrow ke icon-only, cards row stack, panel full-width, table horizontal scroll

## File Changes

### Hapus (delete)

```
frontend/src/views/InputView.vue
frontend/src/views/FoundationTest.vue
frontend/src/components/HelloWorld.vue
frontend/src/assets/hero.png
frontend/src/style.css
```

### Modify

```
frontend/src/router/index.js          ← hapus 2 routes (/input, /test-foundation)
frontend/src/main.js                  ← hapus Element Plus + style.css imports
frontend/package.json                 ← hapus element-plus, @element-plus/icons-vue
frontend/src/components/dashboard/DetailPanel.vue  ← wrap dalam <Transition>
frontend/src/layouts/AppShell.vue     ← auto-collapse sidebar di mobile
```

### Create

```
frontend/src/assets/styles/design-responsive.css
```

Import di `main.js` setelah `design-bookman.css`.

## Cleanup Detail

### `router/index.js` — hapus 2 routes

Hapus dua entri:
```js
{ path: '/input', name: 'Input', component: () => import('../views/InputView.vue') },
{ path: '/test-foundation', name: 'test-foundation', component: () => import('../views/FoundationTest.vue') }
```

Final routes: Home redirect ke /data, /bulanan redirect ke /bulanan/pidana, /bulanan/:jenis, /mingguan, /data.

### `main.js` — strip Element Plus

Final content:
```javascript
import { createApp } from 'vue'
import './assets/styles/design-tokens.css'
import './assets/styles/design-bookman.css'
import './assets/styles/design-responsive.css'
import App from './App.vue'
import router from './router'

const app = createApp(App)
app.use(router)
app.mount('#app')
```

### `package.json` — uninstall deps

Run `npm uninstall element-plus @element-plus/icons-vue` — auto-update package.json + package-lock.json. Vite restart untuk drop ESM cache.

## Animasi DetailPanel

Modify `frontend/src/components/dashboard/DetailPanel.vue`. Wrap backdrop dan aside dalam `<Transition>` Vue components dengan distinct names:

```vue
<template>
    <Teleport to="body">
        <Transition name="ns-backdrop">
            <div v-if="open" class="ns-detail-backdrop" @click="emit('close')" />
        </Transition>
        <Transition name="ns-panel">
            <aside v-if="open && row" class="ns-detail-panel">
                ...
            </aside>
        </Transition>
    </Teleport>
</template>

<style scoped>
.ns-backdrop-enter-active, .ns-backdrop-leave-active {
    transition: opacity 200ms ease;
}
.ns-backdrop-enter-from, .ns-backdrop-leave-to {
    opacity: 0;
}
.ns-panel-enter-active, .ns-panel-leave-active {
    transition: transform 280ms cubic-bezier(0.32, 0.72, 0, 1);
}
.ns-panel-enter-from, .ns-panel-leave-to {
    transform: translateX(100%);
}
</style>
```

Catatan: `<Transition>` Vue hanya animate satu root child. Karena backdrop dan aside adalah dua siblings di Teleport, perlu dua `<Transition>` terpisah (ATAU pakai `<TransitionGroup>` — tapi simpler dengan dua transitions).

## Responsive — `design-responsive.css`

```css
/* ============================================
   Responsive breakpoints (Fase 5)
   ============================================ */

@media (max-width: 768px) {

    /* Sidebar: narrow icon-only on mobile */
    .ns-sidebar:not(.is-collapsed) { width: 64px; }
    .ns-sidebar .ns-brand-text,
    .ns-sidebar .ns-nav-label,
    .ns-sidebar .ns-nav-chevron,
    .ns-sidebar .ns-nav-children {
        display: none;
    }

    /* Topbar */
    .ns-c-org-line { font-size: 11px; }
    .ns-c-org-sub { display: none; }
    .ns-topbar-actions .ns-live { display: none; }

    /* Cards row stacks */
    .ns-c-cards-row { grid-template-columns: 1fr; }

    /* Toolbar wraps */
    .ns-toolbar { flex-wrap: wrap; gap: 8px; }
    .ns-toolbar-filters { width: 100%; flex-wrap: wrap; }

    /* Stats strip wraps */
    .ns-c-page-stats-strip { flex-wrap: wrap; gap: 12px; }
    .ns-c-strip-divider { display: none; }

    /* Detail panel full-width */
    .ns-detail-panel { width: 100% !important; max-width: 100%; }

    /* Tables horizontal scroll */
    .ns-table-card { overflow-x: auto; }
    .ns-table-head, .ns-tr { min-width: 720px; }

    /* PageHeader */
    .ns-c-page-header { grid-template-columns: 1fr; gap: 12px; }
}
```

## AppShell auto-collapse on mobile

Modify `frontend/src/layouts/AppShell.vue`. Tambah lifecycle hook untuk detect viewport.

```vue
<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useTheme } from '../composables/useTheme'
import Sidebar from '../components/shell/Sidebar.vue'
import TopBar from '../components/shell/TopBar.vue'
import { SIDEBAR_ITEMS } from '../data/sidebarItems.js'

const theme = useTheme()
const collapsed = ref(false)
const expandedGroups = reactive({ bulanan: true })

let mq = null
function onMqChange(e) {
    if (e.matches) collapsed.value = true
}

onMounted(() => {
    mq = window.matchMedia('(max-width: 768px)')
    if (mq.matches) collapsed.value = true
    mq.addEventListener('change', onMqChange)
})

onUnmounted(() => {
    if (mq) mq.removeEventListener('change', onMqChange)
})

function toggleGroup(id) {
    expandedGroups[id] = !expandedGroups[id]
}
</script>
```

(Template tetap sama dengan Fase 2.)

## Verifikasi

1. **Cleanup verify:** routes `/input` dan `/test-foundation` → tidak match (browser tampil layout shell tanpa konten — vue-router default behavior). `node_modules/element-plus` dan `node_modules/@element-plus` tidak ada lagi setelah uninstall. `package.json` deps tinggal: `axios`, `element-plus` REMOVED, `@vue/...` (vue, vue-router), supabase (kalau dipakai).
2. **Bundle size:** `npm run build` lalu cek `dist/assets/*.js` total — should be smaller than before (Element Plus typical 600KB+ unminified, ~150-200KB gzipped).
3. **Vite dev server:** `npm run dev` boots tanpa error related to Element Plus.
4. **DetailPanel animasi:** Klik row di `/data` → panel slide-in dari kanan smooth ~280ms. Klik backdrop → panel slide-out + backdrop fade.
5. **Responsive:** Resize browser ke <=768px:
   - Sidebar narrows ke ~64px (cuma icons)
   - Topbar org-sub hilang, sync indicator hilang
   - Cards row stack vertical (TrendCard atas, mini cards bawah)
   - Toolbar wrap, filter chips bisa wrap ke baris baru
   - PerkaraTable horizontal scroll dalam card
   - Detail panel full-width
6. **Auto-collapse:** Buka langsung di mobile width — sidebar sudah `is-collapsed` saat mount.
7. **Resize back to desktop:** layout kembali full (CSS reverts), tapi `collapsed` state tetap (mq listener tidak revert — user buka manual).

## Out of scope

- Hamburger button + slide-in sidebar overlay (kompromi: narrow icon-only di mobile)
- Swipe gesture untuk close panel
- Print stylesheet
- A11y comprehensive audit
- 404 page custom untuk unmatched routes
- Backend cleanup (puppeteer tetap dipakai SIPP)
- Hapus `frontend/src/components/HelloWorld.vue` import statements (tidak ada — file standalone Vite scaffold)
