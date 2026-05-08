<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import Icon from '../Icon.vue'

defineProps({
    jenis: { type: String, default: 'Perdata' },
    start: { type: String, default: '' },
    end: { type: String, default: '' },
    format: { type: String, default: 'pdf' },
    loading: { type: Boolean, default: false },
    exporting: { type: Boolean, default: false },
    canExport: { type: Boolean, default: false }
})

const emit = defineEmits(['update:jenis', 'update:start', 'update:end', 'update:format', 'fetch', 'export'])

const JENIS_OPTIONS = ['Pidana', 'Perdata', 'Perikanan']
const openMenu = ref(null)

function toggleMenu(name) {
    openMenu.value = openMenu.value === name ? null : name
}

function selectJenis(j) {
    emit('update:jenis', j)
    openMenu.value = null
}

function selectFormat(f) {
    emit('update:format', f)
    openMenu.value = null
}

function handleClickOutside(e) {
    if (!e.target.closest('.ns-filter-chip')) openMenu.value = null
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))
</script>

<template>
    <div class="ns-toolbar">
        <div class="ns-toolbar-filters">
            <div class="ns-filter-chip">
                <button type="button" class="ns-chip-btn"
                        :class="{ 'is-open': openMenu === 'jenis' }"
                        @click.stop="toggleMenu('jenis')">
                    <span class="ns-chip-label">Jenis:</span>
                    <span class="ns-chip-value">{{ jenis }}</span>
                    <Icon name="chevronDown" :size="12" />
                </button>
                <div v-if="openMenu === 'jenis'" class="ns-chip-menu">
                    <div v-for="opt in JENIS_OPTIONS" :key="opt"
                         class="ns-chip-option"
                         :class="{ 'is-selected': opt === jenis }"
                         @click="selectJenis(opt)">
                        {{ opt }}
                    </div>
                </div>
            </div>

            <div class="ns-filter-chip">
                <span class="ns-chip-btn" style="cursor: default;">
                    <span class="ns-chip-label">Mulai:</span>
                    <input type="date"
                           :value="start"
                           @input="emit('update:start', $event.target.value)"
                           style="border: 0; background: transparent; color: inherit; font-size: inherit; outline: none;">
                </span>
            </div>

            <div class="ns-filter-chip">
                <span class="ns-chip-btn" style="cursor: default;">
                    <span class="ns-chip-label">Akhir:</span>
                    <input type="date"
                           :value="end"
                           @input="emit('update:end', $event.target.value)"
                           style="border: 0; background: transparent; color: inherit; font-size: inherit; outline: none;">
                </span>
            </div>

            <div class="ns-filter-chip">
                <button type="button" class="ns-chip-btn"
                        :class="{ 'is-open': openMenu === 'format' }"
                        @click.stop="toggleMenu('format')">
                    <span class="ns-chip-label">Format:</span>
                    <span class="ns-chip-value">{{ format.toUpperCase() }}</span>
                    <Icon name="chevronDown" :size="12" />
                </button>
                <div v-if="openMenu === 'format'" class="ns-chip-menu">
                    <div class="ns-chip-option" :class="{ 'is-selected': format === 'pdf' }" @click="selectFormat('pdf')">PDF</div>
                    <div class="ns-chip-option" :class="{ 'is-selected': format === 'docx' }" @click="selectFormat('docx')">DOCX (Word)</div>
                </div>
            </div>
        </div>

        <div style="display: flex; gap: 8px;">
            <button type="button" class="ns-btn ns-btn-ghost" :disabled="loading" @click="emit('fetch')">
                <Icon name="refresh" :size="14" />
                {{ loading ? 'Memuat...' : 'Tampilkan' }}
            </button>
            <button type="button" class="ns-btn ns-btn-primary" :disabled="exporting || !canExport" @click="emit('export')">
                <Icon name="filePlus" :size="14" />
                {{ exporting ? 'Exporting...' : `Export ${format.toUpperCase()}` }}
            </button>
        </div>
    </div>
</template>
