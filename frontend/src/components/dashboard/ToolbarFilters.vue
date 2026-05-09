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

function toggleMenu(name, event) {
    if (openMenu.value === name) {
        openMenu.value = null
    } else {
        openMenu.value = name
        // Capture position for teleport
        const rect = event.currentTarget.getBoundingClientRect()
        menuPositions.value[name] = {
            top: rect.bottom + 6,
            left: rect.left
        }
    }
}

function selectOption(name, value) {
    if (name === 'jenis') emit('update:jenis', value)
    else if (name === 'tahun') emit('update:tahun', value)
    else if (name === 'status') emit('update:status', value)
    openMenu.value = null
}

// Close dropdown when clicking outside
function handleClickOutside(event) {
    if (!event.target.closest('.ns-chip-menu-teleported') && !event.target.closest('.ns-chip-btn')) {
        openMenu.value = null
    }
}

onMounted(() => {
    document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
    <div class="ns-toolbar-filters">
        <div style="position: relative; flex: 1; max-width: 280px;">
            <span style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text3);">
                <Icon name="search" :size="14" />
            </span>
            <input
                type="text"
                placeholder="Cari nomor / pihak..."
                :value="search"
                @input="emit('update:search', $event.target.value)"
                style="width: 100%; padding: 8px 12px 8px 32px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text); font-size: 13px;"
            />
        </div>

        <div class="ns-filter-chip">
            <button
                type="button"
                class="ns-chip-btn"
                :class="{ 'is-open': openMenu === 'jenis' }"
                @click.stop="toggleMenu('jenis', $event)"
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
                :class="{ 'is-open': openMenu === 'tahun' }"
                @click.stop="toggleMenu('tahun', $event)"
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
                :class="{ 'is-open': openMenu === 'status' }"
                @click.stop="toggleMenu('status', $event)"
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
            class="ns-chip-menu-teleported"
            :style="{ top: menuPositions.jenis?.top + 'px', left: menuPositions.jenis?.left + 'px', background: menuBgColor }"
        >
            <div
                v-for="opt in jenisOptions"
                :key="opt"
                class="ns-chip-option"
                :class="{ 'is-selected': opt === jenis }"
                @click="selectOption('jenis', opt)"
            >
                {{ opt }}
            </div>
        </div>

        <!-- Tahun Dropdown -->
        <div
            v-if="openMenu === 'tahun'"
            class="ns-chip-menu-teleported"
            :style="{ top: menuPositions.tahun?.top + 'px', left: menuPositions.tahun?.left + 'px', background: menuBgColor }"
        >
            <div
                class="ns-chip-option"
                :class="{ 'is-selected': tahun === '' }"
                @click="selectOption('tahun', '')"
            >
                Semua
            </div>
            <div
                v-for="opt in tahunOptions"
                :key="opt"
                class="ns-chip-option"
                :class="{ 'is-selected': String(opt) === tahun }"
                @click="selectOption('tahun', String(opt))"
            >
                {{ opt }}
            </div>
        </div>

        <!-- Status Dropdown -->
        <div
            v-if="openMenu === 'status'"
            class="ns-chip-menu-teleported"
            :style="{ top: menuPositions.status?.top + 'px', left: menuPositions.status?.left + 'px', background: menuBgColor }"
        >
            <div
                class="ns-chip-option"
                :class="{ 'is-selected': status === 'Semua' }"
                @click="selectOption('status', 'Semua')"
            >
                Semua
            </div>
            <div
                class="ns-chip-option"
                :class="{ 'is-selected': status === 'Bersidang' }"
                @click="selectOption('status', 'Bersidang')"
            >
                Sedang Bersidang
            </div>
            <div
                class="ns-chip-option"
                :class="{ 'is-selected': status === 'Minutasi' }"
                @click="selectOption('status', 'Minutasi')"
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
    flex: 1;
    min-width: 0;
}

.ns-filter-chip {
    position: relative;
}

.ns-chip-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    cursor: pointer;
    transition: all 150ms;
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
    font-weight: 500;
    font-size: 13px;
}

.ns-chip-menu-teleported {
    position: fixed;
    min-width: 160px;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 4px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    display: flex;
    flex-direction: column;
    gap: 1px;
    z-index: 99999;
    max-height: 300px;
    overflow-y: auto;
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

.ns-chip-option.is-selected {
    background: var(--accentSoft);
    color: var(--accent);
}
</style>
