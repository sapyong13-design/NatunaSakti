<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import Icon from '../Icon.vue'

const props = defineProps({
    search: { type: String, default: '' },
    jenis: { type: String, default: 'Semua' },
    tahun: { type: String, default: '' },
    jenisOptions: { type: Array, default: () => ['Semua', 'Pidana', 'Perdata', 'Perikanan'] },
    tahunOptions: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:search', 'update:jenis', 'update:tahun'])

const openMenu = ref(null)
const menuPos = reactive({ top: 0, left: 0 })
const jenisBtn = ref(null)
const tahunBtn = ref(null)

function toggleMenu(name) {
    if (openMenu.value === name) {
        openMenu.value = null
        return
    }
    const el = name === 'jenis' ? jenisBtn.value : tahunBtn.value
    if (el) {
        const rect = el.getBoundingClientRect()
        menuPos.top = rect.bottom + 6
        menuPos.left = rect.left
    }
    openMenu.value = name
}

function selectOption(name, value) {
    if (name === 'jenis') emit('update:jenis', value)
    else if (name === 'tahun') emit('update:tahun', value)
    openMenu.value = null
}

function handleClickOutside(e) {
    if (!e.target.closest('.ns-chip-teleport') && !e.target.closest('.ns-filter-chip')) {
        openMenu.value = null
    }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))
</script>

<template>
    <div class="ns-toolbar-filters">
        <div style="position: relative; flex: 1; max-width: 280px;">
            <span style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-3);">
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

        <div class="ns-filter-chip" ref="jenisBtn">
            <button
                type="button"
                class="ns-chip-btn"
                :class="{ 'is-open': openMenu === 'jenis' }"
                @click.stop="toggleMenu('jenis')"
            >
                <span class="ns-chip-label">Jenis:</span>
                <span class="ns-chip-value">{{ jenis }}</span>
                <Icon name="chevronDown" :size="12" />
            </button>
        </div>

        <div class="ns-filter-chip" v-if="tahunOptions.length" ref="tahunBtn">
            <button
                type="button"
                class="ns-chip-btn"
                :class="{ 'is-open': openMenu === 'tahun' }"
                @click.stop="toggleMenu('tahun')"
            >
                <span class="ns-chip-label">Tahun:</span>
                <span class="ns-chip-value">{{ tahun || 'Semua' }}</span>
                <Icon name="chevronDown" :size="12" />
            </button>
        </div>
    </div>

    <Teleport to="body">
        <div
            v-if="openMenu === 'jenis'"
            class="ns-chip-menu ns-chip-teleport"
            :style="{ position: 'fixed', top: menuPos.top + 'px', left: menuPos.left + 'px' }"
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

        <div
            v-if="openMenu === 'tahun'"
            class="ns-chip-menu ns-chip-teleport"
            :style="{ position: 'fixed', top: menuPos.top + 'px', left: menuPos.left + 'px' }"
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
    </Teleport>
</template>
