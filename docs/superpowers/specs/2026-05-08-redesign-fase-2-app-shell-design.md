# Redesign Fase 2 — App Shell (Sidebar + Topbar)

**Tanggal:** 2026-05-08
**Konteks:** Fase 2 dari rebuild frontend ke desain "Gov Modern". Fase 1 (Foundation) menyiapkan stylesheet, theme system, dan komponen primitif. Fase 2 membangun layout shell — sidebar collapsible, topbar dengan org info + sync indicator + theme toggle, dan `PageHeader` reusable yang akan dipakai oleh halaman di Fase 3-4.

## Tujuan

Setelah fase ini, halaman-halaman existing (DataView, BulananView, MingguanView) tampil di dalam shell baru: sidebar kiri, topbar atas, konten di tengah. Sidebar nav berfungsi (klik = pindah route), groups bisa di-expand/collapse, theme toggle aktif. Konten internal halaman belum di-redesign — mereka tampak seperti sekarang (Element Plus) dibungkus shell baru. Itu Fase 3-4.

## Struktur File

```
frontend/src/
├── layouts/
│   └── AppShell.vue                 ← layout pembungkus
├── components/
│   ├── shell/
│   │   ├── Sidebar.vue
│   │   ├── TopBar.vue
│   │   ├── LiveIndicator.vue
│   │   └── PageHeader.vue
│   └── (existing: Icon.vue, LambangPN.vue, charts/)
└── data/
    └── sidebarItems.js              ← SIDEBAR_ITEMS const
```

`layouts/` dan `data/` adalah folder baru. `components/shell/` baru (sub-folder).

## SIDEBAR_ITEMS

File `frontend/src/data/sidebarItems.js`:

```js
export const SIDEBAR_ITEMS = [
    { type: 'item',  id: 'akurasi',  label: 'Akurasi Kepaniteraan', icon: 'chartBar', to: '/data' },
    { type: 'group', id: 'bulanan',  label: 'Bulanan', icon: 'calendar', children: [
        { id: 'bulanan-pidana',    label: 'Pidana',    icon: 'gavel', to: '/bulanan/pidana' },
        { id: 'bulanan-perdata',   label: 'Perdata',   icon: 'scale', to: '/bulanan/perdata' },
        { id: 'bulanan-perikanan', label: 'Perikanan', icon: 'fish',  to: '/bulanan/perikanan' }
    ]},
    { type: 'item',  id: 'mingguan', label: 'Mingguan', icon: 'clock', to: '/mingguan' }
]
```

Schema:
- `type: 'item'` → leaf, navigate `to` saat diklik
- `type: 'group'` → expandable parent, klik header toggle expand state, child diklik navigate `to`
- `id` unique untuk active highlighting + expand state tracking

## Router Updates

File `frontend/src/router/index.js` — tambah route, ubah eksisting:

```js
const routes = [
    { path: '/', name: 'Home', redirect: '/data' },
    { path: '/bulanan', redirect: '/bulanan/pidana' },                                 // changed from direct render
    { path: '/bulanan/:jenis', name: 'Bulanan', component: () => import('../views/BulananView.vue') },
    { path: '/mingguan', name: 'Mingguan', component: () => import('../views/MingguanView.vue') },
    { path: '/input', name: 'Input', component: () => import('../views/InputView.vue') }, // orphan, dibersihin Fase 5
    { path: '/data', name: 'Data', component: () => import('../views/DataView.vue') },
    { path: '/test-foundation', name: 'test-foundation', component: () => import('../views/FoundationTest.vue') }
]
```

`BulananView` akan menerima `route.params.jenis` (string: 'pidana' | 'perdata' | 'perikanan'). Existing BulananView mungkin tidak baca param ini — perilaku tidak berubah secara visual sampai Fase 4. Tidak masalah untuk Fase 2.

## Komponen `AppShell.vue`

Tanggung jawab:
- Render sidebar di kiri (collapsed atau full sesuai state)
- Render topbar di atas
- Render `<slot />` (yang berisi `<router-view />`) di area main
- Manage state: `collapsed: ref(false)`, `expandedGroups: reactive({ bulanan: true })`
- Set class `.ns-app .ns-skin-c` dan `data-mode` dari `useTheme().mode`

```vue
<script setup>
import { ref, reactive } from 'vue'
import { useTheme } from '../composables/useTheme'
import Sidebar from '../components/shell/Sidebar.vue'
import TopBar from '../components/shell/TopBar.vue'
import { SIDEBAR_ITEMS } from '../data/sidebarItems.js'

const theme = useTheme()
const collapsed = ref(false)
const expandedGroups = reactive({ bulanan: true })

function toggleGroup(id) {
    expandedGroups[id] = !expandedGroups[id]
}
</script>

<template>
    <div class="ns-app ns-skin-c" :data-mode="theme.mode.value">
        <div class="ns-c-hero-bg" />
        <Sidebar
            :items="SIDEBAR_ITEMS"
            :collapsed="collapsed"
            :expanded-groups="expandedGroups"
            @update:collapsed="collapsed = $event"
            @toggle-group="toggleGroup"
        />
        <main class="ns-main">
            <TopBar />
            <div class="ns-page">
                <slot />
            </div>
        </main>
    </div>
</template>
```

`.ns-c-hero-bg` adalah background visual element dari styles.css (gradient hero band).

## Komponen `Sidebar.vue`

Props:
- `items: Array` (SIDEBAR_ITEMS shape)
- `collapsed: Boolean`
- `expandedGroups: Object`

Emits:
- `update:collapsed` — toggle button di footer sidebar
- `toggleGroup(id: string)` — klik group header

Active item detection: pakai `useRoute()` + cocokin `route.path` ke `item.to`. Kalau match, item dapat class `.is-active` (atau apa pun yang styles.css define). Untuk group, jika salah satu child `to` match `route.path`, group dianggap aktif (highlight + auto-expand).

Klik leaf item: pakai `<router-link :to="item.to">` — tidak perlu programmatic push. Klik group header: emit `toggleGroup(id)`.

Render structure:
```vue
<aside class="ns-sidebar" :class="{ 'is-collapsed': collapsed }">
    <div class="ns-brand">
        <LambangPN :size="32" :primary="..." />
        <div class="ns-brand-text" v-if="!collapsed">
            <div class="ns-brand-title">Natuna Sakti</div>
            <div class="ns-brand-sub">PN Natuna Kelas II</div>
        </div>
    </div>
    <nav class="ns-nav">
        <template v-for="item in items" :key="item.id">
            <!-- type=item: render router-link -->
            <!-- type=group: render header (clickable toggle) + children list (v-show by expanded state) -->
        </template>
    </nav>
    <button class="ns-collapse-btn" @click="$emit('update:collapsed', !collapsed)">
        <Icon :name="collapsed ? 'chevronRight' : 'chevronLeft'" />
    </button>
</aside>
```

Catatan: Icon component tidak punya `chevronLeft`. Solution: pakai CSS rotate (`transform: scaleX(-1)`) atau pakai `chevronRight` dengan rotate kondisional. Atau kasih param ke Icon biar bisa rotate. Simplest: pakai `chevronRight` dengan inline `:style="{ transform: collapsed ? 'none' : 'rotate(180deg)' }"`.

CSS classes dipakai dari `design-tokens.css`: `.ns-sidebar`, `.ns-brand`, `.ns-nav`, `.ns-collapse-btn`. Hanya konfigurasi struktur — visual sudah handled oleh CSS yang ada.

## Komponen `TopBar.vue`

Tanggung jawab: render header bar dengan org info kiri + actions kanan.

```vue
<script setup>
import { ref } from 'vue'
import { useTheme } from '../../composables/useTheme'
import LiveIndicator from './LiveIndicator.vue'
import Icon from '../Icon.vue'

const theme = useTheme()
const lastSync = ref('--')   // stub, real value Fase 3
</script>

<template>
    <header class="ns-topbar ns-topbar-c">
        <div class="ns-c-org">
            <div class="ns-c-org-line">PENGADILAN NEGERI NATUNA · KELAS II</div>
            <div class="ns-c-org-sub">Mahkamah Agung Republik Indonesia</div>
        </div>
        <div class="ns-topbar-actions">
            <LiveIndicator :syncing="false" :last-sync="lastSync" />
            <button class="ns-icon-btn ns-bell" type="button">
                <Icon name="bell" :size="16" />
                <span class="ns-bell-dot" />
            </button>
            <button class="ns-icon-btn" type="button" @click="theme.toggle()">
                <Icon :name="theme.mode.value === 'dark' ? 'sun' : 'moon'" :size="16" />
            </button>
        </div>
    </header>
</template>
```

CSS classes: `.ns-topbar`, `.ns-topbar-c`, `.ns-c-org`, `.ns-topbar-actions`, `.ns-icon-btn`, `.ns-bell`, `.ns-bell-dot`. Sudah didefinisikan di `design-tokens.css`.

Bell button no-op (untuk MVP). Theme toggle pakai `useTheme().toggle()`.

## Komponen `LiveIndicator.vue`

Props:
- `syncing: Boolean` — kalau true, dot warna kuning + label "Syncing..."; kalau false, dot hijau + label "Sync OK · {lastSync}"
- `lastSync: String` — timestamp string (`"23.00.10"` atau `"--"`)

```vue
<script setup>
defineProps({
    syncing: { type: Boolean, default: false },
    lastSync: { type: String, default: '--' }
})
</script>

<template>
    <div class="ns-live" :class="{ 'is-syncing': syncing }">
        <span class="ns-live-pulse" />
        <span class="ns-live-label">{{ syncing ? 'Syncing...' : 'Sync OK' }}</span>
        <span class="ns-live-sep">·</span>
        <span class="ns-live-time">{{ lastSync }}</span>
    </div>
</template>
```

CSS: `.ns-live`, `.ns-live-pulse`, `.ns-live-label`, `.ns-live-sep`, `.ns-live-time` (already in design-tokens.css).

## Komponen `PageHeader.vue`

Reusable hero. Props: `eyebrow?`, `title`, `sub?`. Default slot for action buttons / stats strip yang muncul di kanan title.

```vue
<script setup>
defineProps({
    eyebrow: { type: String, default: '' },
    title: { type: String, required: true },
    sub: { type: String, default: '' }
})
</script>

<template>
    <div class="ns-c-page-header">
        <div class="ns-c-page-title-block">
            <div v-if="eyebrow" class="ns-c-eyebrow">{{ eyebrow }}</div>
            <h1 class="ns-h1 ns-h1-c">{{ title }}</h1>
            <p v-if="sub" class="ns-h1-sub">{{ sub }}</p>
        </div>
        <div v-if="$slots.default" class="ns-c-page-header-actions">
            <slot />
        </div>
    </div>
</template>
```

PageHeader belum dipakai di view manapun di Fase 2. Akan dipakai di Fase 3 (DataView) dan Fase 4 (Bulanan/Mingguan). Komponen-nya disiapkan dulu agar verification page bisa render contoh.

## `App.vue` Replacement

Replace seluruh `App.vue` jadi:

```vue
<script setup>
import AppShell from './layouts/AppShell.vue'
</script>

<template>
    <AppShell>
        <router-view />
    </AppShell>
</template>
```

Hapus styles `<style scoped>` lama. Existing CSS (`style.css`, header gradient hijau, dll) tetap di-load tapi tidak dipakai oleh AppShell — boleh tetap untuk meredam regresi visual halaman lain saat transisi.

## Verifikasi

1. `/data` — DataView tampil di dalam shell. Sidebar item "Akurasi Kepaniteraan" highlighted.
2. `/bulanan/pidana` — BulananView tampil. Sidebar group "Bulanan" expanded, sub "Pidana" highlighted.
3. `/bulanan` — auto-redirect ke `/bulanan/pidana`.
4. `/mingguan` — MingguanView. Sidebar item "Mingguan" highlighted.
5. `/test-foundation` — komponen test (Icon, LambangPN, charts) tampil di dalam shell. Tidak crash.
6. Klik group "Bulanan" header — expand/collapse toggle, sub-items show/hide.
7. Klik tombol theme toggle di topbar — flip mode, persist localStorage.
8. Klik tombol collapse sidebar (`.ns-collapse-btn` di bagian bawah aside) — class `is-collapsed` toggle pada `<aside>`. Bila `design-tokens.css` mendefinisikan visual untuk `.ns-sidebar.is-collapsed` (cek `grep is-collapsed design-tokens.css`), narrow ke icon-only otomatis. Kalau tidak ada, struktur tetap berfungsi — visual narrowing dipoles Fase 5.

## Out of Scope

- Tidak ubah konten internal `DataView.vue`, `BulananView.vue`, `MingguanView.vue`. Mereka tampil seperti sekarang di dalam shell baru — Element Plus components akan terlihat agak mismatch dengan shell-nya. Itu di-redesign di Fase 3-4.
- Tidak hapus `App.vue` styles lama secara agresif (dibersihin Fase 5)
- Tidak hapus route `/input` (orphan, Fase 5)
- Bell dropdown (out of MVP)
- Sync handler real (Fase 3)
- Animasi sidebar collapse polish (Fase 5)
- Responsive breakpoint (Fase 5)
- Hapus existing `frontend/src/style.css` (Fase 5)
