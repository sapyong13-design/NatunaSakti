# Redesign Fase 2 — App Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pasang shell layout (sidebar collapsible + topbar) dan komponen reusable (LiveIndicator, PageHeader). Halaman existing (DataView/Bulanan/Mingguan) tampil di dalam shell baru tanpa diubah konten.

**Architecture:** `AppShell.vue` di `layouts/` jadi root layout. Sidebar/TopBar/LiveIndicator/PageHeader di `components/shell/`. Router diupdate untuk hierarchy `/bulanan/:jenis`. `App.vue` diramping jadi pemanggil `<AppShell><router-view /></AppShell>`.

**Tech Stack:** Vue 3 Composition API, vue-router, Element Plus (di-keep di view internal), CSS class dari `design-tokens.css` + `design-bookman.css`.

**Catatan:** Class CSS yang dipakai sudah ke-verified ada di stylesheet (Fase 1). `.ns-skin-c`, `.ns-sidebar`, `.ns-nav-item`, `.ns-topbar-c`, `.ns-c-org`, `.ns-c-page-header`, dll semuanya defined.

**Sebelum mulai:** kalau Vite dev server lagi mati, start dulu:

```powershell
$p = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($p) { Stop-Process -Id $p.OwningProcess -Force }
```

```bash
cd "C:\Users\faris\Documents\natunasakti\frontend" && npm run dev > dev.log 2>&1 &
```

---

### Task 1: `data/sidebarItems.js`

**Files:**
- Create: `frontend/src/data/sidebarItems.js`

- [ ] **Step 1: Buat folder + file**

```bash
mkdir -p "C:\Users\faris\Documents\natunasakti\frontend\src\data"
```

Create `frontend/src/data/sidebarItems.js`:

```javascript
export const SIDEBAR_ITEMS = [
    {
        type: 'item',
        id: 'akurasi',
        label: 'Akurasi Kepaniteraan',
        icon: 'chartBar',
        to: '/data'
    },
    {
        type: 'group',
        id: 'bulanan',
        label: 'Bulanan',
        icon: 'calendar',
        children: [
            { id: 'bulanan-pidana',    label: 'Pidana',    icon: 'gavel', to: '/bulanan/pidana' },
            { id: 'bulanan-perdata',   label: 'Perdata',   icon: 'scale', to: '/bulanan/perdata' },
            { id: 'bulanan-perikanan', label: 'Perikanan', icon: 'fish',  to: '/bulanan/perikanan' }
        ]
    },
    {
        type: 'item',
        id: 'mingguan',
        label: 'Mingguan',
        icon: 'clock',
        to: '/mingguan'
    }
]
```

- [ ] **Step 2: Verify dev server compiles**

```bash
sleep 2 && grep -iE "error|fail" "C:\Users\faris\Documents\natunasakti\frontend\dev.log" | tail -5 || echo "no errors"
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add frontend/src/data/sidebarItems.js && git commit -m "feat(shell): SIDEBAR_ITEMS data structure"
```

---

### Task 2: `LiveIndicator.vue`

**Files:**
- Create: `frontend/src/components/shell/LiveIndicator.vue`

- [ ] **Step 1: Buat folder + file**

```bash
mkdir -p "C:\Users\faris\Documents\natunasakti\frontend\src\components\shell"
```

Create `frontend/src/components/shell/LiveIndicator.vue`:

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

- [ ] **Step 2: Verify**

```bash
sleep 2 && grep -iE "error|fail" "C:\Users\faris\Documents\natunasakti\frontend\dev.log" | tail -5 || echo "no errors"
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add frontend/src/components/shell/LiveIndicator.vue && git commit -m "feat(shell): LiveIndicator component"
```

---

### Task 3: `PageHeader.vue`

**Files:**
- Create: `frontend/src/components/shell/PageHeader.vue`

- [ ] **Step 1: Buat file**

Create `frontend/src/components/shell/PageHeader.vue`:

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
        <div>
            <div v-if="eyebrow" class="ns-c-eyebrow">{{ eyebrow }}</div>
            <h1 class="ns-h1 ns-h1-c">{{ title }}</h1>
            <p v-if="sub" class="ns-h1-sub">{{ sub }}</p>
        </div>
        <div v-if="$slots.default">
            <slot />
        </div>
    </div>
</template>
```

CSS class `.ns-c-page-header` adalah CSS grid 2-kolom (1fr + auto). Cukup pakai 2 div langsung sebagai child — tidak perlu wrapper named.

- [ ] **Step 2: Verify**

```bash
sleep 2 && grep -iE "error|fail" "C:\Users\faris\Documents\natunasakti\frontend\dev.log" | tail -5 || echo "no errors"
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add frontend/src/components/shell/PageHeader.vue && git commit -m "feat(shell): PageHeader reusable hero component"
```

---

### Task 4: `TopBar.vue`

**Files:**
- Create: `frontend/src/components/shell/TopBar.vue`

- [ ] **Step 1: Buat file**

Create `frontend/src/components/shell/TopBar.vue`:

```vue
<script setup>
import { ref } from 'vue'
import { useTheme } from '../../composables/useTheme'
import LiveIndicator from './LiveIndicator.vue'
import Icon from '../Icon.vue'

const theme = useTheme()
const lastSync = ref('--')
</script>

<template>
    <header class="ns-topbar ns-topbar-c">
        <div class="ns-c-org">
            <div class="ns-c-org-line">PENGADILAN NEGERI NATUNA · KELAS II</div>
            <div class="ns-c-org-sub">Mahkamah Agung Republik Indonesia</div>
        </div>
        <div class="ns-topbar-actions">
            <LiveIndicator :syncing="false" :last-sync="lastSync" />
            <button class="ns-icon-btn ns-bell" type="button" aria-label="Notifications">
                <Icon name="bell" :size="16" />
                <span class="ns-bell-dot" />
            </button>
            <button
                class="ns-icon-btn"
                type="button"
                :aria-label="theme.mode.value === 'dark' ? 'Switch to light' : 'Switch to dark'"
                @click="theme.toggle()"
            >
                <Icon :name="theme.mode.value === 'dark' ? 'sun' : 'moon'" :size="16" />
            </button>
        </div>
    </header>
</template>
```

- [ ] **Step 2: Verify**

```bash
sleep 2 && grep -iE "error|fail" "C:\Users\faris\Documents\natunasakti\frontend\dev.log" | tail -5 || echo "no errors"
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add frontend/src/components/shell/TopBar.vue && git commit -m "feat(shell): TopBar with org info, LiveIndicator, theme toggle"
```

---

### Task 5: `Sidebar.vue`

**Files:**
- Create: `frontend/src/components/shell/Sidebar.vue`

- [ ] **Step 1: Buat file**

Create `frontend/src/components/shell/Sidebar.vue`:

```vue
<script setup>
import { computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import Icon from '../Icon.vue'
import LambangPN from '../LambangPN.vue'

const props = defineProps({
    items: { type: Array, required: true },
    collapsed: { type: Boolean, default: false },
    expandedGroups: { type: Object, required: true }
})

const emit = defineEmits(['update:collapsed', 'toggleGroup'])

const route = useRoute()

function isItemActive(item) {
    return route.path === item.to
}

function isGroupActive(group) {
    return group.children?.some(c => route.path === c.to)
}

function isGroupExpanded(group) {
    return props.expandedGroups[group.id] || isGroupActive(group)
}
</script>

<template>
    <aside class="ns-sidebar" :class="{ 'is-collapsed': collapsed }">
        <div class="ns-brand">
            <LambangPN :size="32" primary="#047857" />
            <div v-if="!collapsed" class="ns-brand-text">
                <div class="ns-brand-title">Natuna Sakti</div>
                <div class="ns-brand-sub">PN Natuna Kelas II</div>
            </div>
        </div>

        <nav class="ns-nav">
            <template v-for="item in items" :key="item.id">
                <RouterLink
                    v-if="item.type === 'item'"
                    :to="item.to"
                    class="ns-nav-item"
                    :class="{ 'is-active': isItemActive(item) }"
                >
                    <span class="ns-nav-icon"><Icon :name="item.icon" :size="18" /></span>
                    <span v-if="!collapsed" class="ns-nav-label">{{ item.label }}</span>
                </RouterLink>

                <div v-else-if="item.type === 'group'" class="ns-nav-group">
                    <button
                        type="button"
                        class="ns-nav-item"
                        :class="{ 'is-active': isGroupActive(item) }"
                        @click="emit('toggleGroup', item.id)"
                    >
                        <span class="ns-nav-icon"><Icon :name="item.icon" :size="18" /></span>
                        <span v-if="!collapsed" class="ns-nav-label">{{ item.label }}</span>
                        <span v-if="!collapsed" class="ns-nav-chevron">
                            <Icon
                                :name="isGroupExpanded(item) ? 'chevronDown' : 'chevronRight'"
                                :size="14"
                            />
                        </span>
                    </button>
                    <div v-if="!collapsed && isGroupExpanded(item)" class="ns-nav-children">
                        <RouterLink
                            v-for="child in item.children"
                            :key="child.id"
                            :to="child.to"
                            class="ns-nav-item"
                            :class="{ 'is-active': isItemActive(child) }"
                        >
                            <span class="ns-nav-icon"><Icon :name="child.icon" :size="16" /></span>
                            <span class="ns-nav-label">{{ child.label }}</span>
                        </RouterLink>
                    </div>
                </div>
            </template>
        </nav>

        <div class="ns-sidebar-footer">
            <button
                type="button"
                class="ns-collapse-btn"
                :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
                @click="emit('update:collapsed', !collapsed)"
            >
                <Icon
                    name="chevronRight"
                    :size="14"
                    :style="collapsed ? '' : 'transform: rotate(180deg)'"
                />
            </button>
        </div>
    </aside>
</template>
```

- [ ] **Step 2: Verify**

```bash
sleep 2 && grep -iE "error|fail" "C:\Users\faris\Documents\natunasakti\frontend\dev.log" | tail -5 || echo "no errors"
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add frontend/src/components/shell/Sidebar.vue && git commit -m "feat(shell): Sidebar with collapsible groups and active highlighting"
```

---

### Task 6: `AppShell.vue` layout

**Files:**
- Create: `frontend/src/layouts/AppShell.vue`

- [ ] **Step 1: Buat folder + file**

```bash
mkdir -p "C:\Users\faris\Documents\natunasakti\frontend\src\layouts"
```

Create `frontend/src/layouts/AppShell.vue`:

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

- [ ] **Step 2: Verify**

```bash
sleep 2 && grep -iE "error|fail" "C:\Users\faris\Documents\natunasakti\frontend\dev.log" | tail -5 || echo "no errors"
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add frontend/src/layouts/AppShell.vue && git commit -m "feat(shell): AppShell layout"
```

---

### Task 7: Update `router/index.js`

**Files:**
- Modify: `frontend/src/router/index.js`

- [ ] **Step 1: Replace router config**

Replace seluruh isi `frontend/src/router/index.js` dengan:

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
        path: '/input',
        name: 'Input',
        component: () => import('../views/InputView.vue')
    },
    {
        path: '/data',
        name: 'Data',
        component: () => import('../views/DataView.vue')
    },
    {
        path: '/test-foundation',
        name: 'test-foundation',
        component: () => import('../views/FoundationTest.vue')
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

export default router
```

- [ ] **Step 2: Verify routes work**

```bash
sleep 2 && grep -iE "error|fail" "C:\Users\faris\Documents\natunasakti\frontend\dev.log" | tail -5 || echo "no errors"
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add frontend/src/router/index.js && git commit -m "feat: nested route /bulanan/:jenis with redirect from /bulanan"
```

---

### Task 8: Replace `App.vue` + final verify + push

**Files:**
- Modify: `frontend/src/App.vue`

- [ ] **Step 1: Replace App.vue**

Replace seluruh isi `frontend/src/App.vue` dengan:

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

(Tanpa `<style>` — semua styling sekarang via design-tokens.css.)

- [ ] **Step 2: Verify dev server kompilasi**

```bash
sleep 3 && grep -iE "error|fail" "C:\Users\faris\Documents\natunasakti\frontend\dev.log" | tail -10 || echo "no errors"
```

- [ ] **Step 3: Verify routes respond 200**

```bash
PORT=5173
for path in "/" "/data" "/bulanan" "/bulanan/pidana" "/bulanan/perdata" "/bulanan/perikanan" "/mingguan" "/test-foundation"; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT$path" --max-time 3 2>&1)
  echo "$path → $status"
done
```

Expected: every path returns 200 (Vite SPA returns index for all paths).

- [ ] **Step 4: Smoke test imports via curl on hashed module URLs**

Vite serves modules at `/src/...`. Verify the new layout module resolves:

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:5173/src/layouts/AppShell.vue" --max-time 3
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:5173/src/components/shell/Sidebar.vue" --max-time 3
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:5173/src/data/sidebarItems.js" --max-time 3
```

Expected: each returns 200. If 404 → file path/name issue.

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add frontend/src/App.vue && git commit -m "feat: App.vue uses AppShell layout"
```

- [ ] **Step 6: Push semua commit Fase 2**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git log --oneline origin/master..HEAD
```

Should show 8 commits (Tasks 1-8). Then:

```bash
git push origin master
```

- [ ] **Step 7: Commit dan push spec + plan**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add docs/superpowers/specs/2026-05-08-redesign-fase-2-app-shell-design.md docs/superpowers/plans/2026-05-08-redesign-fase-2-app-shell.md && git commit -m "docs: spec and plan for redesign fase 2 app shell"
```

```bash
git push origin master
```
