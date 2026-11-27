<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { formatDateIndoShort } from '../../lib/date'
import StatusBadge from './StatusBadge.vue'
import ContextualActionMenu from './ContextualActionMenu.vue'
import JadwalQuickPreview from './JadwalQuickPreview.vue'
import Icon from '../Icon.vue'

const props = defineProps({
    rows: { type: Array, required: true },
    startIndex: { type: Number, default: 0 },
    upcomingPerkaraNumbers: { type: Array, default: () => [] },
    density: { type: String, default: 'default' },
    sortBy: { type: String, default: 'register' },
    sortDir: { type: String, default: 'desc' }
})

const emit = defineEmits(['rowClick', 'menuAction', 'sort'])
// Context menu state
const contextMenu = ref({
    show: false,
    x: 0,
    y: 0,
    row: null
})

// Jadwal preview state
const jadwalPreview = ref({
    show: false,
    x: 0,
    y: 0,
    row: null
})


let previewTimeout = null

function handleContextMenu(e, row) {
    e.preventDefault()
    contextMenu.value = {
        show: true,
        x: e.clientX,
        y: e.clientY,
        row
    }
}

function handleMenuAction({ key, row }) {
    emit('menuAction', { key, row })
}

function handleMouseEnter(e, row) {
    // Clear existing timeout
    if (previewTimeout) {
        clearTimeout(previewTimeout)
    }

    // Show preview after 300ms delay
    previewTimeout = setTimeout(() => {
        const rect = e.target.getBoundingClientRect()
        jadwalPreview.value = {
            show: true,
            x: rect.left,
            y: rect.bottom + 4,
            row
        }
    }, 300)
}

function handleMouseLeave() {
    if (previewTimeout) {
        clearTimeout(previewTimeout)
    }
    jadwalPreview.value.show = false
}


onUnmounted(() => {
    if (previewTimeout) {
        clearTimeout(previewTimeout)
    }
})


const expandedNumber = ref(null)
const tableRows = computed(() => props.rows.map(row => {
    const parties = []
    for (const line of String(row.para_pihak || '').split('\n').filter(Boolean)) {
        const colon = line.indexOf(':')
        if (colon >= 0) parties.push({ role: line.slice(0, colon), name: line.slice(colon + 1).trim() })
        else if (parties.length) parties[parties.length - 1].name += `\n${line}`
        else parties.push({ role: 'Pihak', name: line })
    }
    const primary = parties.find(party => !/penuntut umum/i.test(party.role)) || parties[0]
    return { row, parties, primary }
}))

function toggleParties(number) {
    expandedNumber.value = expandedNumber.value === number ? null : number
}

function formatDate(value) {
    return formatDateIndoShort(value)
}

const todayWibIso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
}).format(new Date())

function isTodayIso(iso) {
    return Boolean(iso && iso.slice(0, 10) === todayWibIso)
}

function isOverdue(row) {
    if (Number(row?.tahun_masuk) < 2016) return false
    const status = String(row?.sipp_status || '').toLowerCase()
    if (status === 'minutasi' || status === 'putusan') return false
    const match = String(row?.sipp_lama_proses || '').match(/(\d+)\s*hari/i)
    return Boolean(match && Number(match[1]) > 150)
}

function sortIndicator(column) {
    if (props.sortBy !== column) return '↕'
    return props.sortDir === 'asc' ? '↑' : '↓'
}

function ariaSort(column) {
    if (props.sortBy !== column) return 'none'
    return props.sortDir === 'asc' ? 'ascending' : 'descending'
}
</script>

<template>
    <section class="ns-register" :class="`is-density-${density}`" aria-label="Register perkara">
        <div class="ns-register-heading">
            <div><strong>Register perkara</strong><span>{{ rows.length }} perkara pada halaman ini</span></div>
            <span class="ns-register-help">Pilih nomor untuk detail perkara</span>
        </div>
        <div class="ns-table-scroll" tabindex="0" role="region" aria-label="Tabel perkara, dapat digulir">
            <table class="ns-data-table">
                <caption class="ns-sr-only">Register perkara SIPP lokal. Anonimisasi merupakan flag publikasi, bukan penggantian nama.</caption>
                <colgroup><col class="col-no"/><col class="col-number"/><col class="col-party"/><col class="col-kind"/><col class="col-date"/><col class="col-status"/><col class="col-days"/><col class="col-anon"/></colgroup>
                <thead><tr>
                    <th scope="col">No</th>
                    <th scope="col" :aria-sort="ariaSort('nomor')"><button type="button" class="ns-sort-btn" :class="{ 'is-active': sortBy === 'nomor' }" @click="emit('sort', 'nomor')">Nomor perkara <span>{{ sortIndicator('nomor') }}</span></button></th>
                    <th scope="col">Nama pihak</th>
                    <th scope="col">Klasifikasi</th>
                    <th scope="col" :aria-sort="ariaSort('register')"><button type="button" class="ns-sort-btn" :class="{ 'is-active': sortBy === 'register' }" @click="emit('sort', 'register')">Register <span>{{ sortIndicator('register') }}</span></button></th>
                    <th scope="col" :aria-sort="ariaSort('status')"><button type="button" class="ns-sort-btn" :class="{ 'is-active': sortBy === 'status' }" @click="emit('sort', 'status')">Status <span>{{ sortIndicator('status') }}</span></button></th>
                    <th scope="col" class="align-right" :aria-sort="ariaSort('hari')"><button type="button" class="ns-sort-btn is-right" :class="{ 'is-active': sortBy === 'hari' }" @click="emit('sort', 'hari')">Hari <span>{{ sortIndicator('hari') }}</span></button></th>
                    <th scope="col" class="align-center"><abbr title="Flag anonimisasi publikasi SIPP">Anon.</abbr></th>
                </tr></thead>
                <tbody>
                    <tr v-if="!rows.length"><td colspan="8" class="ns-empty-cell"><strong>Tidak ada perkara</strong><p>Coba ubah pencarian atau filter.</p></td></tr>
                    <template v-for="({ row, parties, primary }, idx) in tableRows" :key="row.id || row.nomor_perkara">
                        <tr class="ns-data-row" :class="{ 'is-expanded': expandedNumber === row.nomor_perkara }" @contextmenu="handleContextMenu($event, row)">
                            <td class="ns-row-number">{{ idx + 1 + startIndex }}</td>
                            <td class="cell-number">
                                <button class="ns-number" type="button" @click="emit('rowClick', row)" @mouseenter="handleMouseEnter($event, row)" @mouseleave="handleMouseLeave">{{ row.nomor_perkara }}</button>
                                <span class="ns-case-type" :class="`type-${row.jenis_perkara?.toLowerCase()}`">{{ row.jenis_perkara }}</span>
                            </td>
                            <td class="cell-party">
                                <span class="ns-party-name" :title="primary?.name">{{ primary?.name || 'Nama belum tersedia' }}</span>
                                <button v-if="parties.length" class="ns-party-button" type="button" :aria-expanded="expandedNumber === row.nomor_perkara" :aria-controls="`parties-${row.id || idx}`" :aria-label="`Semua pihak perkara ${row.nomor_perkara}`" @click="toggleParties(row.nomor_perkara)">
                                    <span>{{ primary?.role }}</span><span class="ns-party-more">Semua pihak <Icon :name="expandedNumber === row.nomor_perkara ? 'chevronDown' : 'chevronRight'" :size="12" /></span>
                                </button>
                            </td>
                            <td class="cell-kind" data-label="Klasifikasi"><span class="ns-classification" :title="row.sipp_klasifikasi || row.nama_perkara">{{ row.sipp_klasifikasi || row.nama_perkara || '—' }}</span></td>
                            <td class="ns-date" data-label="Register"><time :datetime="row.sipp_tanggal_register || undefined">{{ formatDate(row.sipp_tanggal_register) }}</time></td>
                            <td class="cell-status" data-label="Status">
                                <StatusBadge v-if="row.sipp_status" :status="row.sipp_status" size="sm"/>
                                <span v-else class="ns-muted">Belum diisi</span>
                                <span
                                    v-if="row.next_sidang_tanggal && row.sipp_status !== 'Minutasi'"
                                    class="ns-next-hearing"
                                    :class="{ 'is-today': isTodayIso(row.next_sidang_tanggal) }"
                                    :title="row.next_sidang_agenda || 'Jadwal sidang berikutnya'"
                                >
                                    {{ isTodayIso(row.next_sidang_tanggal) ? 'Sidang hari ini' : `Sidang ${formatDate(row.next_sidang_tanggal)}` }}
                                </span>
                            </td>
                            <td class="ns-days align-right" :class="{ 'is-overdue': isOverdue(row) }" data-label="Hari proses" :title="isOverdue(row) ? `${row.sipp_lama_proses} (Aktif > 150 hari / batas 5 bln SEMA 2/2014)` : (row.sipp_lama_proses || 'Belum tersedia')">{{ row.sipp_lama_proses?.replace(/\s*Hari/i, '') || '—' }}</td>
                            <td class="cell-anon align-center" data-label="Anonimisasi">
                                <input v-if="['T', 'Y'].includes(row.sipp_pihak_dipublikasikan)" type="checkbox" :checked="row.sipp_pihak_dipublikasikan === 'T'" :aria-label="`Anonimisasi perkara ${row.nomor_perkara}`" :title="row.sipp_pihak_dipublikasikan === 'T' ? 'Anonimisasi: Ya' : 'Anonimisasi: Tidak'" disabled />
                                <span v-else class="ns-unknown" aria-label="Anonimisasi belum diketahui" title="Flag anonimisasi belum diisi pada SIPP">—</span>
                            </td>
                        </tr>
                        <tr v-if="expandedNumber === row.nomor_perkara" class="ns-expanded-row">
                            <td colspan="8">
                                <div :id="`parties-${row.id || idx}`" class="ns-parties-detail">
                                    <div class="ns-parties-heading"><strong>Semua pihak</strong><button type="button" class="ns-close-parties" :aria-label="`Tutup pihak perkara ${row.nomor_perkara}`" @click="toggleParties(row.nomor_perkara)"><Icon name="close" :size="16"/></button></div>
                                    <dl><div v-for="(party, i) in parties" :key="i"><dt>{{ party.role }}</dt><dd>{{ party.name }}</dd></div></dl>
                                    <button class="ns-detail-link" type="button" @click="emit('rowClick', row)">Buka detail perkara <Icon name="arrowRight" :size="14"/></button>
                                </div>
                            </td>
                        </tr>
                    </template>
                </tbody>
            </table>
        </div>
        <div class="ns-register-footer"><span>Nama sesuai DB SIPP lokal</span><span>Anon.: checklist flag publikasi · — belum diisi</span></div>
        <ContextualActionMenu :show="contextMenu.show" :x="contextMenu.x" :y="contextMenu.y" :row="contextMenu.row" @close="contextMenu.show = false" @action="handleMenuAction"/>
        <JadwalQuickPreview :show="jadwalPreview.show" :x="jadwalPreview.x" :y="jadwalPreview.y" :row="jadwalPreview.row" @close="jadwalPreview.show = false"/>
    </section>
</template>

<style scoped>
.ns-register { border: 1px solid var(--border); border-radius: 12px; overflow: hidden; background: var(--surface); }
.ns-register-heading { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 16px 20px; border-bottom: 1px solid var(--border); }
.ns-register-heading strong { font-size: 15px; color: var(--text); font-weight: 600; }
.ns-register-heading div { display: flex; align-items: baseline; gap: 12px; }
.ns-register-heading span, .ns-register-footer { font-size: 12px; color: var(--text-2); }
.ns-table-scroll { overflow: auto; max-height: min(640px, 72vh); scrollbar-gutter: stable; scrollbar-color: var(--border) transparent; }
.ns-data-table { width: 100%; min-width: 1000px; table-layout: fixed; border-spacing: 0; border-collapse: separate; font-size: 13px; line-height: 1.4; color: var(--text); }
.col-no { width: 42px; }.col-number { width: 210px; }.col-party { width: auto; }.col-kind { width: 150px; }.col-date { width: 104px; }.col-status { width: 138px; }.col-days { width: 64px; }.col-anon { width: 56px; }
.ns-data-table th { position: sticky; top: 0; z-index: 2; text-align: left; background: var(--bg-2); color: var(--text-2); font-size: 12px; font-weight: 600; padding: 12px; border-bottom: 1px solid var(--border); white-space: nowrap; }
.ns-sort-btn { display: inline-flex; align-items: center; gap: 4px; border: 0; padding: 0; background: none; color: inherit; font: inherit; cursor: pointer; }
.ns-sort-btn.is-right { width: 100%; justify-content: flex-end; }
.ns-sort-btn span { opacity: 0.45; font-size: 11px; }
.ns-sort-btn.is-active, .ns-sort-btn:hover { color: var(--accent); }
.ns-sort-btn.is-active span { opacity: 1; }
.ns-next-hearing { display: block; margin-top: 4px; font-size: 11px; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ns-next-hearing.is-today { color: var(--warning, #d97706); font-weight: 600; }
.ns-days.is-overdue { color: var(--danger, #dc2626); font-weight: 700; }
.ns-data-row { height: 64px; }
.ns-data-row:hover { background: var(--surface-2); }
.ns-data-row.is-expanded { background: var(--accentSoft); }
.ns-row-number { color: var(--text-3); font-size: 12px; font-variant-numeric: tabular-nums; }
.ns-number { display: block; border: 0; padding: 0; background: none; color: var(--text); font-family: "JetBrains Mono", monospace; font-size: 12px; font-weight: 600; text-align: left; cursor: pointer; white-space: nowrap; text-underline-offset: 3px; }
.ns-number:hover { text-decoration: underline; color: var(--accent); }
.ns-case-type { display: block; font-size: 11px; margin-top: 4px; color: var(--text-2); }
.type-pidana { color: #e49b8e; }.type-perdata { color: #8ec6a0; }.type-perikanan { color: #80c9ec; }
:global([data-mode="light"]) .type-pidana { color: #963f32; }:global([data-mode="light"]) .type-perdata { color: #356040; }:global([data-mode="light"]) .type-perikanan { color: #226681; }
.ns-party-name { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.ns-party-button { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; min-height: 24px; border: 0; padding: 0; background: none; color: var(--text-2); font: inherit; font-size: 11px; text-align: left; cursor: pointer; }
.ns-party-button > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ns-party-more { display: inline-flex; align-items: center; flex-shrink: 0; gap: 2px; color: var(--accent); }
.ns-classification { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; color: var(--text-2); font-size: 12px; }
.ns-date { font-size: 12px; color: var(--text-2); font-variant-numeric: tabular-nums; white-space: nowrap; }
.ns-days { font-variant-numeric: tabular-nums; }
.ns-data-table .align-right { text-align: right; }.ns-data-table .align-center { text-align: center; }
.ns-data-table input[type="checkbox"] { width: 16px; height: 16px; margin: 0; accent-color: var(--accent); vertical-align: middle; opacity: 1; }
.ns-unknown, .ns-muted { color: var(--text-2); }
.ns-data-table abbr { text-decoration: none; cursor: help; }
.ns-expanded-row > td { padding: 0 20px 20px 54px; background: var(--accentSoft); }
.ns-parties-detail { padding-top: 16px; }
.ns-parties-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.ns-parties-heading strong { font-size: 13px; }
.ns-close-parties { display: grid; place-items: center; width: 32px; height: 32px; background: none; border: 1px solid var(--border); border-radius: 6px; color: var(--text); cursor: pointer; }
.ns-parties-detail dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 32px; margin: 12px 0 16px; }
.ns-parties-detail dt { font-size: 11px; color: var(--text-2); margin-bottom: 4px; }
.ns-parties-detail dd { margin: 0; color: var(--text); line-height: 1.6; white-space: pre-line; overflow-wrap: anywhere; }
.ns-detail-link { display: inline-flex; align-items: center; gap: 8px; border: 0; padding: 4px 0; background: none; color: var(--accent); cursor: pointer; font: inherit; font-size: 12px; }
.ns-register button:focus-visible, .ns-table-scroll:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 3px; }
.ns-register-footer { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px 20px; padding: 12px 20px; }
.ns-mobile-hint { display: none; }
.ns-empty-cell { padding: 48px 20px !important; text-align: center; }.ns-empty-cell p { color: var(--text-2); }
.ns-sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.is-density-compact .ns-data-row { height: 56px; }.is-density-compact .ns-data-table td { padding-top: 7px; padding-bottom: 7px; }
@media (max-width: 760px) {
    .ns-register-heading { align-items: flex-start; padding: 16px; }.ns-register-heading div { flex-direction: column; gap: 4px; }.ns-register-help { display: none; }
    .ns-table-scroll { max-height: none; overflow: visible; }
    .ns-data-table { min-width: 0; display: block; }
    .ns-data-table colgroup { display: none; }
    .ns-data-table thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
    .ns-data-table tbody { display: block; }
    .ns-data-row, .is-density-compact .ns-data-row { display: grid; grid-template-columns: 1fr 1fr; height: auto; padding: 16px; gap: 12px 16px; border-bottom: 1px solid var(--border); }
    .ns-data-table .ns-data-row td { display: block; padding: 0; border: 0; text-align: left; }
    .ns-data-row .ns-row-number { display: none; }
    .cell-number, .cell-party, .cell-kind { grid-column: 1 / -1; }
    .cell-party { padding: 12px 0 !important; border-top: 1px solid var(--border) !important; border-bottom: 1px solid var(--border) !important; }
    .ns-number { font-size: 13px; white-space: normal; overflow-wrap: anywhere; }
    .ns-party-name { white-space: normal; }
    .ns-party-button { min-height: 36px; }
    .ns-classification { display: block; }
    td[data-label]::before { content: attr(data-label); display: block; margin-bottom: 4px; font-size: 11px; color: var(--text-2); }
    .ns-expanded-row, .ns-expanded-row > td { display: block; }
    .ns-expanded-row > td { padding: 0 16px 16px; }
    .ns-parties-detail dl { grid-template-columns: 1fr; }
    .ns-register-footer { flex-direction: column; padding: 16px; }
}
</style>
