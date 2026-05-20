<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import Icon from '../Icon.vue'

const props = defineProps({
    search: { type: String, default: '' },
    jenis: { type: String, default: 'Semua' },
    tahun: { type: String, default: '' },
    status: { type: String, default: 'Semua' },
    jenisOptions: { type: Array, default: () => ['Semua', 'Pidana', 'Perdata', 'Perikanan'] },
    tahunOptions: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:search', 'update:jenis', 'update:tahun', 'update:status'])

const openMenu = ref(null)
const menuPositions = ref({})

const isDark = computed(() => document.documentElement.dataset.mode === 'dark')
const menuBgColor = computed(() => isDark.value ? '#1a1d23' : '#ffffff')
const currentYear = new Date().getFullYear()

function toggleMenu(name, event) {
    if (openMenu.value === name) {
        openMenu.value = null
    } else {
        openMenu.value = name
        const rect = event.currentTarget.getBoundingClientRect()
        menuPositions.value[name] = getMenuPosition(rect)
    }
}

function getMenuPosition(rect) {
    const menuWidth = 260
    const menuMaxHeight = 300
    const gutter = 12
    const top = rect.bottom + 6
    const flippedTop = Math.max(gutter, rect.top - menuMaxHeight - 6)

    return {
        top: top + menuMaxHeight > window.innerHeight - gutter ? flippedTop : top,
        left: Math.max(gutter, Math.min(rect.left, window.innerWidth - menuWidth - gutter))
    }
}

function selectOption(name, value) {
    if (name === 'jenis') emit('update:jenis', value)
    else if (name === 'tahun') emit('update:tahun', value)
    else if (name === 'status') emit('update:status', value)
    openMenu.value = null
}

function updateOpenMenuPosition() {
    if (!openMenu.value) return
    const button = document.querySelector(`.ns-chip-btn[data-menu="${openMenu.value}"]`)
    if (!button) return
    const rect = button.getBoundingClientRect()
    menuPositions.value[openMenu.value] = getMenuPosition(rect)
}

// Close dropdown when clicking outside
function handleClickOutside(event) {
    if (!event.target.closest('.ns-chip-menu-teleported') && !event.target.closest('.ns-chip-btn')) {
        openMenu.value = null
    }
}

onMounted(() => {
    document.addEventListener('click', handleClickOutside)
    window.addEventListener('resize', updateOpenMenuPosition)
    window.addEventListener('scroll', updateOpenMenuPosition, true)
})

onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside)
    window.removeEventListener('resize', updateOpenMenuPosition)
    window.removeEventListener('scroll', updateOpenMenuPosition, true)
})
</script>

<template>
    <div class="ns-toolbar-filters">
        <div class="ns-search-wrap">
            <span class="ns-search-icon" aria-hidden="true">
                <Icon name="search" :size="14" />
            </span>
            <input
                type="text"
                name="dashboard-search"
                autocomplete="off"
                aria-label="Cari perkara"
                placeholder="Cari nomor / pihak…"
                :value="search"
                @input="emit('update:search', $event.target.value)"
                @keydown.escape="emit('update:search', '')"
                class="ns-search-input"
            />
        </div>

        <div class="ns-filter-chip">
            <button
                type="button"
                class="ns-chip-btn"
                data-menu="jenis"
                :class="{ 'is-open': openMenu === 'jenis' }"
                aria-haspopup="listbox"
                :aria-expanded="openMenu === 'jenis'"
                aria-controls="filter-menu-jenis"
                @click.stop="toggleMenu('jenis', $event)"
                @keydown.escape="openMenu = null"
            >
                <span class="ns-chip-label">Jenis:</span>
                <span class="ns-chip-value">{{ jenis }}</span>
                <Icon name="chevronDown" :size="12" />
            </button>
        </div>

        <div v-if="tahunOptions.length" class="ns-filter-chip">
            <button
                type="button"
                class="ns-chip-btn"
                data-menu="tahun"
                :class="{ 'is-open': openMenu === 'tahun' }"
                aria-haspopup="listbox"
                :aria-expanded="openMenu === 'tahun'"
                aria-controls="filter-menu-tahun"
                @click.stop="toggleMenu('tahun', $event)"
                @keydown.escape="openMenu = null"
            >
                <span class="ns-chip-label">Tahun:</span>
                <span class="ns-chip-value">{{ tahun || 'Semua' }}</span>
                <Icon name="chevronDown" :size="12" />
            </button>
        </div>

        <div class="ns-filter-chip">
            <button
                type="button"
                class="ns-chip-btn"
                data-menu="status"
                :class="{ 'is-open': openMenu === 'status' }"
                aria-haspopup="listbox"
                :aria-expanded="openMenu === 'status'"
                aria-controls="filter-menu-status"
                @click.stop="toggleMenu('status', $event)"
                @keydown.escape="openMenu = null"
            >
                <span class="ns-chip-label">Status:</span>
                <span class="ns-chip-value">{{ status === 'Semua' ? 'Semua' : status === 'Bersidang' ? 'Sedang Bersidang' : status }}</span>
                <Icon name="chevronDown" :size="12" />
            </button>
        </div>
    </div>

    <!-- Teleport dropdowns to body for proper z-index -->
    <Teleport to="body">
        <!-- Jenis Dropdown -->
        <div
            v-if="openMenu === 'jenis'"
            id="filter-menu-jenis"
            class="ns-chip-menu-teleported"
            role="listbox"
            :style="{ top: menuPositions.jenis?.top + 'px', left: menuPositions.jenis?.left + 'px', background: menuBgColor }"
        >
            <div
                v-for="opt in jenisOptions"
                :key="opt"
                class="ns-chip-option"
                :class="{ 'is-selected': opt === jenis }"
                role="option"
                tabindex="0"
                :aria-selected="opt === jenis"
                @click="selectOption('jenis', opt)"
                @keydown.enter.prevent="selectOption('jenis', opt)"
                @keydown.space.prevent="selectOption('jenis', opt)"
                @keydown.escape="openMenu = null"
            >
                {{ Number(opt) === currentYear ? `${opt} (berjalan)` : opt }}
            </div>
        </div>

        <!-- Tahun Dropdown -->
        <div
            v-if="openMenu === 'tahun'"
            id="filter-menu-tahun"
            class="ns-chip-menu-teleported"
            role="listbox"
            :style="{ top: menuPositions.tahun?.top + 'px', left: menuPositions.tahun?.left + 'px', background: menuBgColor }"
        >
            <div
                class="ns-chip-option"
                :class="{ 'is-selected': tahun === '' }"
                role="option"
                tabindex="0"
                :aria-selected="tahun === ''"
                @click="selectOption('tahun', '')"
                @keydown.enter.prevent="selectOption('tahun', '')"
                @keydown.space.prevent="selectOption('tahun', '')"
                @keydown.escape="openMenu = null"
            >
                Semua
            </div>
            <div
                v-for="opt in tahunOptions"
                :key="opt"
                class="ns-chip-option"
                :class="{ 'is-selected': String(opt) === tahun }"
                role="option"
                tabindex="0"
                :aria-selected="String(opt) === tahun"
                @click="selectOption('tahun', String(opt))"
                @keydown.enter.prevent="selectOption('tahun', String(opt))"
                @keydown.space.prevent="selectOption('tahun', String(opt))"
                @keydown.escape="openMenu = null"
            >
                {{ opt }}
            </div>
        </div>

        <!-- Status Dropdown -->
        <div
            v-if="openMenu === 'status'"
            id="filter-menu-status"
            class="ns-chip-menu-teleported"
            role="listbox"
            :style="{ top: menuPositions.status?.top + 'px', left: menuPositions.status?.left + 'px', background: menuBgColor }"
        >
            <div
                class="ns-chip-option"
                :class="{ 'is-selected': status === 'Semua' }"
                role="option"
                tabindex="0"
                :aria-selected="status === 'Semua'"
                @click="selectOption('status', 'Semua')"
                @keydown.enter.prevent="selectOption('status', 'Semua')"
                @keydown.space.prevent="selectOption('status', 'Semua')"
                @keydown.escape="openMenu = null"
            >
                Semua
            </div>
            <div
                class="ns-chip-option"
                :class="{ 'is-selected': status === 'Bersidang' }"
                role="option"
                tabindex="0"
                :aria-selected="status === 'Bersidang'"
                @click="selectOption('status', 'Bersidang')"
                @keydown.enter.prevent="selectOption('status', 'Bersidang')"
                @keydown.space.prevent="selectOption('status', 'Bersidang')"
                @keydown.escape="openMenu = null"
            >
                Sedang Bersidang
            </div>
            <div
                class="ns-chip-option"
                :class="{ 'is-selected': status === 'Minutasi' }"
                role="option"
                tabindex="0"
                :aria-selected="status === 'Minutasi'"
                @click="selectOption('status', 'Minutasi')"
                @keydown.enter.prevent="selectOption('status', 'Minutasi')"
                @keydown.space.prevent="selectOption('status', 'Minutasi')"
                @keydown.escape="openMenu = null"
            >
                Minutasi
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.ns-toolbar-filters {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1 1 auto;
    min-width: 0;
    flex-wrap: nowrap;
}

.ns-search-wrap {
    position: relative;
    flex: 1 1 260px;
    min-width: 0;
    max-width: 360px;
}

.ns-search-icon {
    position: absolute;
    left: 10px;
    top: 50%;
    display: grid;
    place-items: center;
    color: var(--text3);
    transform: translateY(-50%);
    pointer-events: none;
}

.ns-search-input {
    width: 100%;
    min-height: 36px;
    padding: 8px 12px 8px 32px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text);
    font-size: 13px;
    line-height: 1.2;
    transition: border-color 150ms ease, box-shadow 150ms ease, background-color 150ms ease;
}

.ns-search-input:focus-visible {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accentSoft);
    outline: 0;
}

.ns-filter-chip {
    position: relative;
    flex: 0 0 auto;
    min-width: 112px;
}

.ns-chip-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 36px;
    width: 100%;
    max-width: 150px;
    padding: 7px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    cursor: pointer;
    transition: background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease, color 150ms ease;
}

.ns-chip-btn:hover {
    border-color: var(--accentSoft);
}

.ns-chip-btn.is-open {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accentSoft);
}

.ns-chip-label {
    color: var(--text3);
    font-size: 12px;
    font-weight: 400;
}

.ns-chip-value {
    min-width: 0;
    font-weight: 500;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.ns-chip-menu-teleported {
    position: fixed;
    min-width: 180px;
    max-width: min(260px, calc(100vw - 20px));
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 4px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    display: flex;
    flex-direction: column;
    gap: 1px;
    z-index: var(--z-dropdown, 1200);
    max-height: 300px;
    overflow-y: auto;
}

@media (max-width: 1100px) {
    .ns-toolbar-filters {
        flex-wrap: wrap;
    }
}

@media (max-width: 720px) {
    .ns-toolbar-filters {
        align-items: stretch;
    }

    .ns-search-wrap,
    .ns-filter-chip,
    .ns-chip-btn {
        width: 100%;
        max-width: none;
    }

    .ns-chip-btn {
        justify-content: space-between;
    }
}

.ns-chip-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 10px;
    border-radius: 7px;
    background: transparent;
    cursor: pointer;
    font-size: 13px;
    color: var(--text);
    white-space: nowrap;
    user-select: none;
}

.ns-chip-option:hover {
    background: var(--surface2);
}

.ns-chip-option:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
}

.ns-chip-option.is-selected {
    background: var(--accentSoft);
    color: var(--accent);
}
</style>
