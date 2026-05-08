# Redesign Fase 5 — Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Selesaikan rebuild — bersihkan Element Plus + file lama (InputView, FoundationTest, HelloWorld, hero.png, style.css), tambah animasi DetailPanel slide, dan responsive breakpoints.

**Architecture:** Cleanup atomic per task (delete files + update router + update main.js). Element Plus uninstall via npm. Responsive CSS di file baru `design-responsive.css`. AppShell handle viewport auto-collapse. DetailPanel pakai Vue `<Transition>`.

**Tech Stack:** Vue 3, Vite, npm.

**Sebelum mulai:** kalau Vite dev server mati, restart. Backend tidak disentuh di fase ini.

---

### Task 1: Cleanup file lama + router + main.js

**Files:**
- Delete: `frontend/src/views/InputView.vue`, `frontend/src/views/FoundationTest.vue`, `frontend/src/components/HelloWorld.vue`, `frontend/src/assets/hero.png`, `frontend/src/style.css`
- Modify: `frontend/src/router/index.js`
- Modify: `frontend/src/main.js`

- [ ] **Step 1: Hapus file**

```bash
cd "C:\Users\faris\Documents\natunasakti"
rm -f frontend/src/views/InputView.vue
rm -f frontend/src/views/FoundationTest.vue
rm -f frontend/src/components/HelloWorld.vue
rm -f frontend/src/assets/hero.png
rm -f frontend/src/style.css
```

Verify deletion:
```bash
ls frontend/src/views/InputView.vue 2>&1 || echo "deleted"
ls frontend/src/components/HelloWorld.vue 2>&1 || echo "deleted"
ls frontend/src/style.css 2>&1 || echo "deleted"
```

Expected: each prints `deleted` (file not found errors).

- [ ] **Step 2: Replace `frontend/src/router/index.js`**

Replace ENTIRE content with:

```javascript
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
    {
        path: '/',
        name: 'Home',
        redirect: '/data'
    },
    {
        path: '/bulanan',
        redirect: '/bulanan/pidana'
    },
    {
        path: '/bulanan/:jenis',
        name: 'Bulanan',
        component: () => import('../views/BulananView.vue')
    },
    {
        path: '/mingguan',
        name: 'Mingguan',
        component: () => import('../views/MingguanView.vue')
    },
    {
        path: '/data',
        name: 'Data',
        component: () => import('../views/DataView.vue')
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

export default router
```

(Hilang: `/input`, `/test-foundation`.)

- [ ] **Step 3: Replace `frontend/src/main.js`**

Replace ENTIRE content with:

```javascript
import { createApp } from 'vue'
import './assets/styles/design-tokens.css'
import './assets/styles/design-bookman.css'
import App from './App.vue'
import router from './router'

const app = createApp(App)
app.use(router)
app.mount('#app')
```

(Hilang: ElementPlus import, element-plus CSS, style.css import. `design-responsive.css` belum di-import — Task 3 akan add.)

- [ ] **Step 4: Verify Vite kompilasi tanpa error**

```bash
sleep 3 && grep -iE "error|fail" "C:\Users\faris\Documents\natunasakti\frontend\dev.log" | tail -10 || echo "no errors"
```

Expected: `no errors`. Vite akan rebuild otomatis. Halaman utama (DataView, BulananView, MingguanView) belum boleh broken — mereka tidak import Element Plus apa pun setelah Fase 4.

Verify routes still respond:
```bash
PORT=5173
for p in "/" "/data" "/bulanan/pidana" "/mingguan"; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT$p" --max-time 3)
  echo "$p → $status"
done
```

Expected: each returns 200.

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add -A frontend/ && git commit -m "chore: remove InputView, FoundationTest, Element Plus imports, legacy style.css"
```

(`-A frontend/` includes deletions, modifications, and removes empty paths.)

---

### Task 2: Uninstall Element Plus packages

**Files:**
- Modify: `frontend/package.json` + `frontend/package-lock.json` (auto via npm)

- [ ] **Step 1: Uninstall packages**

```bash
cd "C:\Users\faris\Documents\natunasakti\frontend" && npm uninstall element-plus @element-plus/icons-vue 2>&1 | tail -10
```

Expected: removed packages output, lockfile updated. No errors.

- [ ] **Step 2: Verify package.json**

```bash
grep -E "element-plus" "C:\Users\faris\Documents\natunasakti\frontend\package.json" || echo "removed"
```

Expected: `removed`.

- [ ] **Step 3: Verify Vite still runs (restart if needed)**

```powershell
$p = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($p) { Stop-Process -Id $p.OwningProcess -Force }
```

```bash
cd "C:\Users\faris\Documents\natunasakti\frontend" && npm run dev > dev.log 2>&1 &
sleep 5 && grep -iE "error|fail" dev.log | head -10 || echo "no errors"
```

Expected: `no errors`. Vite ready notice di log.

Verify route:
```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:5173/data" --max-time 3
```

Expected: 200.

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add frontend/package.json frontend/package-lock.json && git commit -m "chore: uninstall element-plus and @element-plus/icons-vue"
```

---

### Task 3: Create `design-responsive.css` + import

**Files:**
- Create: `frontend/src/assets/styles/design-responsive.css`
- Modify: `frontend/src/main.js`

- [ ] **Step 1: Create CSS file**

Create `C:\Users\faris\Documents\natunasakti\frontend\src\assets\styles\design-responsive.css` with EXACTLY this content:

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

    /* PageHeader stacks */
    .ns-c-page-header { grid-template-columns: 1fr; gap: 12px; }
}
```

- [ ] **Step 2: Import di `main.js`**

Replace ENTIRE content of `C:\Users\faris\Documents\natunasakti\frontend\src\main.js` with:

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

- [ ] **Step 3: Verify**

```bash
sleep 2 && grep -iE "error|fail" "C:\Users\faris\Documents\natunasakti\frontend\dev.log" | tail -5 || echo "no errors"
```

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add frontend/src/assets/styles/design-responsive.css frontend/src/main.js && git commit -m "feat(style): responsive breakpoints for mobile/tablet"
```

---

### Task 4: AppShell auto-collapse on mobile

**Files:**
- Modify: `frontend/src/layouts/AppShell.vue`

- [ ] **Step 1: Replace AppShell.vue**

Replace ENTIRE content of `C:\Users\faris\Documents\natunasakti\frontend\src\layouts\AppShell.vue` with:

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

(Tambahan dari Fase 2: `onMounted`, `onUnmounted`, `mq`, `onMqChange`. Template tidak berubah.)

- [ ] **Step 2: Verify**

```bash
sleep 2 && grep -iE "error|fail" "C:\Users\faris\Documents\natunasakti\frontend\dev.log" | tail -5 || echo "no errors"
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add frontend/src/layouts/AppShell.vue && git commit -m "feat(shell): auto-collapse sidebar on mobile viewport"
```

---

### Task 5: DetailPanel transitions

**Files:**
- Modify: `frontend/src/components/dashboard/DetailPanel.vue`

- [ ] **Step 1: Wrap aside dan backdrop dalam `<Transition>`**

Open `C:\Users\faris\Documents\natunasakti\frontend\src\components\dashboard\DetailPanel.vue`. Replace the `<template>` block AND add a `<style scoped>` block at end. The `<script setup>` block stays untouched.

Find current template:
```vue
<template>
    <Teleport to="body">
        <div v-if="open" class="ns-detail-backdrop" @click="emit('close')" />
        <aside v-if="open && row" class="ns-detail-panel">
            ...
        </aside>
    </Teleport>
</template>
```

Replace with (preserving full inner content of `<aside>`):

```vue
<template>
    <Teleport to="body">
        <Transition name="ns-backdrop">
            <div v-if="open" class="ns-detail-backdrop" @click="emit('close')" />
        </Transition>
        <Transition name="ns-panel">
            <aside v-if="open && row" class="ns-detail-panel">
                <header class="ns-detail-head">
                    <div>
                        <div class="ns-detail-eyebrow">{{ row.jenis_perkara }}</div>
                        <h2 class="ns-detail-title ns-mono">{{ row.nomor_perkara }}</h2>
                        <div class="ns-detail-pihak">{{ row.para_pihak }}</div>
                    </div>
                    <button class="ns-icon-btn" type="button" @click="emit('close')" aria-label="Close">
                        <Icon name="close" :size="18" />
                    </button>
                </header>

                <div class="ns-detail-body">
                    <div class="ns-detail-status-card">
                        <span class="ns-detail-status-pulse" />
                        <div>
                            <div>{{ row.sipp_status || 'Status tidak diketahui' }}</div>
                            <div class="ns-detail-status-sub">Lama proses: {{ row.sipp_lama_proses || '—' }}</div>
                        </div>
                    </div>

                    <div class="ns-detail-section">
                        <div class="ns-detail-section-title">Informasi Perkara</div>
                        <div class="ns-detail-grid">
                            <div class="ns-detail-field">
                                <div class="ns-detail-field-label">Klasifikasi</div>
                                <div class="ns-detail-field-value">{{ row.sipp_klasifikasi || '—' }}</div>
                            </div>
                            <div class="ns-detail-field">
                                <div class="ns-detail-field-label">Tanggal Register</div>
                                <div class="ns-detail-field-value">{{ row.sipp_tanggal_register || '—' }}</div>
                            </div>
                            <div class="ns-detail-field">
                                <div class="ns-detail-field-label">Tahun Masuk</div>
                                <div class="ns-detail-field-value">{{ row.tahun_masuk }}</div>
                            </div>
                            <div class="ns-detail-field">
                                <div class="ns-detail-field-label">Tanggal Putus</div>
                                <div class="ns-detail-field-value">{{ row.tanggal_putus || '—' }}</div>
                            </div>
                        </div>
                    </div>

                    <div class="ns-detail-section">
                        <div class="ns-detail-section-title">Jadwal Sidang</div>
                        <div v-if="loadingJadwal" style="padding: 16px; color: var(--text-3); font-size: 13px;">Memuat...</div>
                        <div v-else-if="!jadwal.length" class="ns-empty">Tidak ada jadwal sidang</div>
                        <div v-else style="display: flex; flex-direction: column; gap: 10px;">
                            <div v-for="(j, i) in jadwal" :key="i" class="ns-detail-agenda">
                                <div style="font-weight: 600;">{{ j.tanggal }}<span v-if="j.jam" style="color: var(--text-3); font-weight: 400; margin-left: 8px;">{{ j.jam }}</span></div>
                                <div style="margin-top: 4px;">{{ j.agenda }}</div>
                                <div v-if="j.ruangan" class="ns-detail-status-sub">{{ j.ruangan }}</div>
                                <div v-if="j.alasanDitunda && j.alasanDitunda !== '0'" style="margin-top: 4px; font-size: 11.5px; color: var(--warn);">Ditunda: {{ j.alasanDitunda }}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="ns-detail-actions">
                    <button class="ns-btn ns-btn-ghost" type="button" :disabled="refreshing" @click="handleRefreshJadwal">
                        <Icon name="refresh" :size="14" />
                        {{ refreshing ? 'Refreshing...' : 'Refresh Jadwal' }}
                    </button>
                    <button class="ns-btn ns-btn-danger" type="button" :disabled="deleting" @click="handleDelete">
                        <Icon name="trash" :size="14" />
                        {{ deleting ? 'Deleting...' : 'Delete' }}
                    </button>
                </div>
            </aside>
        </Transition>
    </Teleport>
</template>

<style scoped>
.ns-backdrop-enter-active,
.ns-backdrop-leave-active {
    transition: opacity 200ms ease;
}
.ns-backdrop-enter-from,
.ns-backdrop-leave-to {
    opacity: 0;
}
.ns-panel-enter-active,
.ns-panel-leave-active {
    transition: transform 280ms cubic-bezier(0.32, 0.72, 0, 1);
}
.ns-panel-enter-from,
.ns-panel-leave-to {
    transform: translateX(100%);
}
</style>
```

Pastikan `<script setup>` block (di atas template) TIDAK berubah — biarkan persis seperti existing.

- [ ] **Step 2: Verify**

```bash
sleep 2 && grep -iE "error|fail" "C:\Users\faris\Documents\natunasakti\frontend\dev.log" | tail -5 || echo "no errors"
```

Test in browser: navigate to `/data`, klik row → panel slides in dari kanan smooth (~280ms). Klik backdrop → panel slides out + backdrop fades.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add frontend/src/components/dashboard/DetailPanel.vue && git commit -m "feat(dashboard): DetailPanel slide-in/out transitions"
```

---

### Task 6: Final verify + push

- [ ] **Step 1: Verify all routes still work**

```bash
PORT=5173
for path in "/" "/data" "/bulanan" "/bulanan/pidana" "/bulanan/perdata" "/bulanan/perikanan" "/mingguan"; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT$path" --max-time 3)
  echo "$path → $status"
done

echo "--- removed routes (should still 200 because Vite SPA, but no content match) ---"
for path in "/input" "/test-foundation"; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT$path" --max-time 3)
  echo "$path → $status (Vite returns index, but Vue Router has no match — expect blank content)"
done
```

Expected: all responding routes return 200.

- [ ] **Step 2: Verify Element Plus benar-benar hilang dari node_modules**

```bash
ls "C:\Users\faris\Documents\natunasakti\frontend\node_modules\element-plus" 2>&1 || echo "element-plus removed"
ls "C:\Users\faris\Documents\natunasakti\frontend\node_modules\@element-plus" 2>&1 || echo "@element-plus removed"
```

Expected: both print "removed".

- [ ] **Step 3: Confirm 5 commits ahead, push**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git log --oneline origin/master..HEAD
```

Should show exactly 5 commits (Tasks 1-5 of Fase 5). Then:

```bash
git push origin master
```

- [ ] **Step 4: Commit + push spec & plan**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add docs/superpowers/specs/2026-05-08-redesign-fase-5-polish-design.md docs/superpowers/plans/2026-05-08-redesign-fase-5-polish.md && git commit -m "docs: spec and plan for redesign fase 5 polish"
```

```bash
git push origin master
```

- [ ] **Step 5: Verify final state on origin/master**

```bash
git log --oneline origin/master -10
```

Expected top entry: `docs: spec and plan for redesign fase 5 polish`. Below: 5 polish task commits + Fase 4 docs + Fase 4 task commits.
