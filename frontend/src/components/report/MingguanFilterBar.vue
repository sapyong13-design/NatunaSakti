<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import Icon from '../Icon.vue'
import IndonesiaCalendar from '../IndonesiaCalendar.vue'

const props = defineProps({
    start:      { type: String, default: '' },
    end:        { type: String, default: '' },
    format:     { type: String, default: 'docx' },
    loading:    { type: Boolean, default: false },
    exporting:  { type: Boolean, default: false },
    canExport:  { type: Boolean, default: false }
})

const emit = defineEmits(['update:start', 'update:end', 'update:format', 'fetch', 'export'])

const BULAN_NAMA = ['Januari','Februari','Maret','April','Mei','Juni',
                    'Juli','Agustus','September','Oktober','November','Desember']

const openMenu   = ref(null)
const menuPos    = reactive({ top: 0, left: 0, right: null })
const calBtn     = ref(null)
const formatBtn  = ref(null)

function fmtDate(iso) {
    if (!iso) return ''
    const [y, m, d] = iso.split('-')
    return `${d} ${BULAN_NAMA[+m-1].slice(0,3)} ${y}`
}

function calLabel() {
    if (props.start && props.end)
        return `${fmtDate(props.start)} – ${fmtDate(props.end)}`
    if (props.start)
        return `${fmtDate(props.start)} – …`
    return 'Pilih Tanggal'
}

function toggleMenu(name) {
    if (openMenu.value === name) { openMenu.value = null; return }
    const el = name === 'cal' ? calBtn.value : formatBtn.value
    if (el) {
        const rect = el.getBoundingClientRect()
        const calW = 296 + 16
        // Prefer opening to the left if near right edge
        if (rect.left + calW > window.innerWidth - 8) {
            menuPos.left = null
            menuPos.right = window.innerWidth - rect.right
        } else {
            menuPos.left = rect.left
            menuPos.right = null
        }
        menuPos.top = rect.bottom + 6
    }
    openMenu.value = name
}

function selectFormat(f) {
    emit('update:format', f)
    openMenu.value = null
}

function handleClickOutside(e) {
    if (!e.target.closest('.ns-cal-teleport') && !e.target.closest('.ns-filter-chip')) {
        openMenu.value = null
    }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))
</script>

<template>
    <div class="ns-toolbar">
        <div class="ns-toolbar-filters">
            <!-- Calendar date range picker -->
            <div class="ns-filter-chip" ref="calBtn">
                <button type="button" class="ns-chip-btn"
                        :class="{ 'is-open': openMenu === 'cal', 'is-active': start && end }"
                        @click.stop="toggleMenu('cal')">
                    <Icon name="calendar" :size="13" />
                    <span class="ns-chip-value">{{ calLabel() }}</span>
                    <Icon name="chevronDown" :size="12" />
                </button>
            </div>

            <!-- Format picker -->
            <div class="ns-filter-chip" ref="formatBtn">
                <button type="button" class="ns-chip-btn"
                        :class="{ 'is-open': openMenu === 'format' }"
                        @click.stop="toggleMenu('format')">
                    <span class="ns-chip-label">Format:</span>
                    <span class="ns-chip-value">{{ format.toUpperCase() }}</span>
                    <Icon name="chevronDown" :size="12" />
                </button>
            </div>
        </div>

        <div style="display: flex; gap: 8px;">
            <button type="button" class="ns-btn ns-btn-ghost" :disabled="loading" @click="emit('fetch')">
                <Icon name="refresh" :size="14" />
                {{ loading ? 'Memuat...' : 'Tampilkan' }}
            </button>
            <button type="button" class="ns-btn ns-btn-primary"
                    :disabled="exporting || !canExport"
                    @click="emit('export')">
                <Icon name="filePlus" :size="14" />
                {{ exporting ? 'Exporting...' : `Export ${format.toUpperCase()}` }}
            </button>
        </div>
    </div>

    <Teleport to="body">
        <!-- Calendar popup -->
        <div v-if="openMenu === 'cal'"
             class="ns-cal-teleport"
             :style="{
                 position: 'fixed',
                 top: menuPos.top + 'px',
                 left: menuPos.right == null ? menuPos.left + 'px' : 'auto',
                 right: menuPos.right != null ? menuPos.right + 'px' : 'auto',
                 zIndex: 9999
             }">
            <IndonesiaCalendar
                :start-date="start"
                :end-date="end"
                @update:start-date="emit('update:start', $event)"
                @update:end-date="emit('update:end', $event)"
                @done="openMenu = null"
            />
        </div>

        <!-- Format popup -->
        <div v-if="openMenu === 'format'"
             class="ns-chip-menu ns-chip-teleport"
             :style="{ position: 'fixed', top: menuPos.top + 'px', left: menuPos.left + 'px' }">
            <div class="ns-chip-option" :class="{ 'is-selected': format === 'pdf' }" @click="selectFormat('pdf')">PDF</div>
            <div class="ns-chip-option" :class="{ 'is-selected': format === 'docx' }" @click="selectFormat('docx')">DOCX (Word)</div>
        </div>
    </Teleport>
</template>
