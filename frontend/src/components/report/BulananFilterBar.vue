<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import Icon from '../Icon.vue'

defineProps({
    bulan: { type: Number, required: true },
    tahun: { type: Number, required: true },
    format: { type: String, default: 'pdf' },
    loading: { type: Boolean, default: false },
    exporting: { type: Boolean, default: false },
    canExport: { type: Boolean, default: false }
})

const emit = defineEmits(['update:bulan', 'update:tahun', 'update:format', 'fetch', 'export'])

const BULAN_NAMA = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

const openMenu = ref(null)

function toggleMenu(name) {
    openMenu.value = openMenu.value === name ? null : name
}

function selectBulan(idx) {
    emit('update:bulan', idx + 1)
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
                        :class="{ 'is-open': openMenu === 'bulan' }"
                        @click.stop="toggleMenu('bulan')">
                    <span class="ns-chip-label">Bulan:</span>
                    <span class="ns-chip-value">{{ BULAN_NAMA[bulan - 1] }}</span>
                    <Icon name="chevronDown" :size="12" />
                </button>
                <div v-if="openMenu === 'bulan'" class="ns-chip-menu">
                    <div v-for="(nama, idx) in BULAN_NAMA" :key="idx"
                         class="ns-chip-option"
                         :class="{ 'is-selected': idx + 1 === bulan }"
                         @click="selectBulan(idx)">
                        {{ nama }}
                    </div>
                </div>
            </div>

            <div class="ns-filter-chip">
                <span class="ns-chip-btn" style="cursor: default;">
                    <span class="ns-chip-label">Tahun:</span>
                    <input type="number"
                           :value="tahun"
                           min="2020" max="2030"
                           @input="emit('update:tahun', parseInt($event.target.value) || 2020)"
                           style="width: 70px; border: 0; background: transparent; color: inherit; font-weight: 500; font-size: inherit; outline: none;">
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
