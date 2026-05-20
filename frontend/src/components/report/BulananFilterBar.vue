<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import Icon from '../Icon.vue'
import IndonesiaCalendar from '../IndonesiaCalendar.vue'

const props = defineProps({
    bulan: { type: Number, required: true },
    tahun: { type: Number, required: true },
    end: { type: String, default: '' },
    format: { type: String, default: 'docx' },
    loading: { type: Boolean, default: false },
    exporting: { type: Boolean, default: false },
    canExport: { type: Boolean, default: false }
})

const emit = defineEmits(['update:bulan', 'update:tahun', 'update:end', 'update:format', 'fetch', 'export', 'history'])

const BULAN_NAMA = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

const openMenu = ref(null)
const menuPos = reactive({ top: 0, left: 0, right: null })
const bulanBtn = ref(null)
const endBtn = ref(null)
const formatBtn = ref(null)

function toIso(year, month, day) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function monthStartIso() {
    return toIso(props.tahun, props.bulan, 1)
}

function monthEndIso() {
    return toIso(props.tahun, props.bulan, new Date(props.tahun, props.bulan, 0).getDate())
}

function fmtDate(iso) {
    if (!iso) return ''
    const [y, m, d] = iso.split('-')
    return `${d} ${BULAN_NAMA[+m - 1].slice(0, 3)} ${y}`
}

function toggleMenu(name) {
    if (openMenu.value === name) { openMenu.value = null; return }
    const el = name === 'bulan' ? bulanBtn.value : name === 'end' ? endBtn.value : formatBtn.value
    if (el) {
        const rect = el.getBoundingClientRect()
        if (name === 'end') {
            const calW = 296 + 16
            if (rect.left + calW > window.innerWidth - 8) {
                menuPos.left = null
                menuPos.right = window.innerWidth - rect.right
            } else {
                menuPos.left = rect.left
                menuPos.right = null
            }
        } else {
            menuPos.left = rect.left
            menuPos.right = null
        }
        menuPos.top = rect.bottom + 6
    }
    openMenu.value = name
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
    if (!e.target.closest('.ns-cal-teleport') && !e.target.closest('.ns-chip-teleport') && !e.target.closest('.ns-filter-chip')) {
        openMenu.value = null
    }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))
</script>

<template>
    <div class="ns-toolbar">
        <div class="ns-toolbar-filters">
            <div class="ns-filter-chip" ref="bulanBtn">
                <button type="button" class="ns-chip-btn"
                        aria-haspopup="listbox"
                        :aria-expanded="openMenu === 'bulan'"
                        :class="{ 'is-open': openMenu === 'bulan' }"
                        @click.stop="toggleMenu('bulan')">
                    <span class="ns-chip-label">Bulan:</span>
                    <span class="ns-chip-value">{{ BULAN_NAMA[bulan - 1] }}</span>
                    <Icon name="chevronDown" :size="12" />
                </button>
            </div>

            <div class="ns-filter-chip">
                <span class="ns-chip-btn" style="cursor: default;">
                    <span class="ns-chip-label">Tahun:</span>
                    <input type="number"
                           :value="tahun"
                           min="2020" max="2030"
                           @input="emit('update:tahun', parseInt($event.target.value) || 2020)"
                           style="width: 70px; border: 0; background: transparent; color: inherit; font-weight: 500; font-size: inherit; outline: 0;">
                </span>
            </div>

            <div class="ns-filter-chip ns-filter-chip-date" ref="endBtn">
                <button type="button" class="ns-chip-btn"
                        aria-haspopup="dialog"
                        :aria-expanded="openMenu === 'end'"
                        :class="{ 'is-open': openMenu === 'end', 'is-active': end }"
                        @click.stop="toggleMenu('end')">
                    <Icon name="calendar" :size="13" />
                    <span class="ns-chip-label">Akhir:</span>
                    <span class="ns-chip-value">{{ fmtDate(end) || 'Pilih tanggal' }}</span>
                    <Icon name="chevronDown" :size="12" />
                </button>
            </div>

            <div class="ns-filter-chip" ref="formatBtn">
                <button type="button" class="ns-chip-btn"
                        aria-haspopup="listbox"
                        :aria-expanded="openMenu === 'format'"
                        :class="{ 'is-open': openMenu === 'format' }"
                        @click.stop="toggleMenu('format')">
                    <span class="ns-chip-label">Format:</span>
                    <span class="ns-chip-value">{{ format.toUpperCase() }}</span>
                    <Icon name="chevronDown" :size="12" />
                </button>
            </div>
        </div>

        <div class="ns-report-toolbar-actions">
            <button type="button" class="ns-btn ns-btn-ghost" :disabled="loading" @click="emit('fetch')">
                <Icon name="refresh" :size="14" />
                {{ loading ? 'Memuat…' : 'Tampilkan' }}
            </button>
            <button type="button" class="ns-btn ns-btn-ghost" @click="emit('history')">
                <Icon name="clock" :size="14" />
                Riwayat Generate
            </button>
            <button type="button" class="ns-btn ns-btn-primary" :disabled="exporting || !canExport" @click="emit('export')">
                <Icon name="filePlus" :size="14" />
                {{ exporting ? 'Mengekspor…' : `Export ${format.toUpperCase()}` }}
            </button>
        </div>
    </div>

    <Teleport to="body">
        <div
            v-if="openMenu === 'bulan'"
            class="ns-chip-menu ns-chip-teleport"
            role="listbox"
            :style="{ position: 'fixed', top: menuPos.top + 'px', left: menuPos.left + 'px' }"
        >
            <div v-for="(nama, idx) in BULAN_NAMA" :key="idx"
                 class="ns-chip-option"
                 :class="{ 'is-selected': idx + 1 === bulan }"
                 role="option"
                 tabindex="0"
                 :aria-selected="idx + 1 === bulan"
                 @click="selectBulan(idx)">
                {{ nama }}
            </div>
        </div>

        <div
            v-if="openMenu === 'format'"
            class="ns-chip-menu ns-chip-teleport"
            role="listbox"
            :style="{ position: 'fixed', top: menuPos.top + 'px', left: menuPos.left + 'px' }"
        >
            <div class="ns-chip-option" role="option" tabindex="0" :aria-selected="format === 'pdf'" :class="{ 'is-selected': format === 'pdf' }" @click="selectFormat('pdf')">PDF</div>
            <div class="ns-chip-option" role="option" tabindex="0" :aria-selected="format === 'docx'" :class="{ 'is-selected': format === 'docx' }" @click="selectFormat('docx')">DOCX (Word)</div>
        </div>

        <div v-if="openMenu === 'end'"
             class="ns-cal-teleport"
             :style="{
                 position: 'fixed',
                 top: menuPos.top + 'px',
                 left: menuPos.right == null ? menuPos.left + 'px' : 'auto',
                 right: menuPos.right != null ? menuPos.right + 'px' : 'auto',
                 zIndex: 'var(--z-dropdown, 1200)'
             }">
            <IndonesiaCalendar
                mode="single"
                :start-date="monthStartIso()"
                :end-date="end"
                :min-date="monthStartIso()"
                :max-date="monthEndIso()"
                @update:end-date="emit('update:end', $event)"
                @done="openMenu = null"
            />
        </div>
    </Teleport>
</template>

<style scoped>
.ns-toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}

.ns-toolbar-filters,
.ns-report-toolbar-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
}

.ns-toolbar-filters {
    flex: 1 1 360px;
    flex-wrap: wrap;
}

.ns-report-toolbar-actions {
    flex: 0 1 auto;
    justify-content: flex-end;
    flex-wrap: wrap;
}

.ns-filter-chip {
    min-width: 148px;
}

.ns-filter-chip-date {
    min-width: 188px;
}

.ns-chip-btn {
    width: 100%;
    min-height: 36px;
    justify-content: space-between;
}

.ns-chip-value {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.ns-cal-teleport {
    max-width: calc(100vw - 24px);
}

input:focus-visible,
.ns-chip-btn:focus-visible,
.ns-btn:focus-visible,
.ns-chip-option:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
}

@media (max-width: 760px) {
    .ns-toolbar {
        align-items: stretch;
    }

    .ns-toolbar-filters,
    .ns-report-toolbar-actions {
        width: 100%;
    }

    .ns-report-toolbar-actions {
        display: grid;
        grid-template-columns: 1fr;
    }

    .ns-report-toolbar-actions .ns-btn {
        justify-content: center;
        width: 100%;
    }
}
</style>
