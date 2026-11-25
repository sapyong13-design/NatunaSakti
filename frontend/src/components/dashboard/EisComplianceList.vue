<script setup>
import { computed, ref } from 'vue'

const props = defineProps({ audit: { type: Object, required: true } })
const filters = [
    { id: 'review', label: 'Perlu dicek' },
    { id: 'matched', label: 'Memenuhi cek lokal' },
    { id: 'unknown', label: 'Belum bisa dinilai' }
]
const filter = ref(filters.find(item => props.audit.counts[item.id])?.id ?? 'review')
const rows = computed(() => props.audit.rows.filter(row => row.state === filter.value))
const dateFormat = new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', dateStyle: 'medium' })

function civilDate(value) {
    if (!value || value.startsWith('0000-')) return 'Tidak tercatat'
    const [date, time] = value.split(/[T ]/)
    const day = new Date(`${date}T00:00:00Z`)
    if (!Number.isFinite(day.valueOf())) return 'Tanggal tidak valid'
    return `${dateFormat.format(day)}${time ? ` · ${time.slice(0, 5)} WIB` : ''}`
}
</script>

<template>
    <section class="compliance" aria-label="Pembanding Kepatuhan SIPP lokal">
        <p class="compliance-method">{{ audit.basis }}</p>
        <p v-if="audit.nonPdfCount" class="compliance-nonpdf" role="status">
            Format non-PDF: <strong>{{ audit.nonPdfCount }}</strong> berkas yang diunggah bukan PDF (EIS tetap menghitung sebagai unggahan).
        </p>
        <div class="compliance-filters" role="group" aria-label="Status pemeriksaan lokal">
            <button v-for="item in filters" :key="item.id" type="button" :aria-pressed="filter === item.id" @click="filter = item.id">
                {{ item.label }} <strong>{{ audit.counts[item.id] }}</strong>
            </button>
        </div>
        <p v-if="!rows.length" class="compliance-empty" role="status">
            {{ audit.rows.length ? 'Tidak ada catatan pada kelompok ini.' : 'Tidak ada catatan lokal untuk dasar periode ini.' }}
        </p>
        <ul v-else class="compliance-list" :aria-label="filters.find(item => item.id === filter).label">
            <li v-for="(row, i) in rows" :key="i">
                <header>
                    <RouterLink v-if="row.id" :to="{ name: 'Data', query: { perkara: row.id } }">{{ row.nomorPerkara }}</RouterLink>
                    <strong v-else>{{ row.nomorPerkara || 'Nomor perkara tidak tercatat' }}</strong>
                    <span :data-state="row.state" :data-nonpdf="row.nonPdf ? 'true' : null">{{ row.note }}</span>
                </header>
                <dl>
                    <div v-if="row.eventAt"><dt>{{ row.eventLabel }}</dt><dd>{{ civilDate(row.eventAt) }}</dd></div>
                    <div v-if="row.comparisonAt"><dt>{{ row.comparisonLabel }}</dt><dd>{{ civilDate(row.comparisonAt) }}</dd></div>
                    <div v-if="row.present !== null"><dt>Catatan pendukung</dt><dd>{{ row.present ? 'Tercatat' : 'Belum tercatat' }}</dd></div>
                    <div v-if="row.flagText"><dt>Flag publikasi lokal</dt><dd>{{ row.flagText === 'Y' ? 'Dipublikasikan' : row.flagText === 'T' ? 'Tidak dipublikasikan' : row.flagText }}</dd></div>
                    <div v-if="row.docExt || row.nonPdf"><dt>Format berkas</dt><dd :class="row.nonPdf ? 'compliance-nonpdf-ext' : 'compliance-pdf-ext'">{{ row.nonPdf ? `${row.nonPdf} (bukan PDF)` : 'PDF (.pdf)' }}<template v-if="row.docName"> · {{ row.docName }}</template></dd></div>
                </dl>
            </li>
        </ul>
    </section>
</template>

<style scoped>
.compliance { display: grid; gap: .6rem; min-width: 0; }
.compliance-method, .compliance-empty { color: var(--text-2); font-size: .82rem; }
.compliance-filters { display: flex; flex-wrap: wrap; gap: .35rem; }
.compliance-filters button { border: 1px solid var(--border); border-radius: 7px; background: var(--bg2); color: var(--text-2); padding: .32rem .5rem; font: inherit; font-size: .77rem; }
.compliance-filters button[aria-pressed='true'] { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
.compliance-filters strong { margin-inline-start: .2rem; }
.compliance-empty { border: 1px dashed var(--border); border-radius: 8px; padding: .75rem; }
.compliance-list { margin: 0; padding: 0; list-style: none; border: 1px solid var(--border); border-radius: 8px; }
.compliance-list li { display: grid; gap: .35rem; padding: .65rem .7rem; font-size: .83rem; }
.compliance-list li + li { border-top: 1px solid var(--border); }
.compliance-list header, .compliance-list dl { display: flex; flex-wrap: wrap; justify-content: space-between; gap: .2rem .7rem; }
.compliance-list dl { margin: 0; justify-content: start; gap: .3rem 1.5rem; }
.compliance-list dt { color: var(--text-2); font-size: .75rem; }
.compliance-list dd { margin: 0; font-weight: 600; }
.compliance-list a { color: var(--accent); font-weight: 700; }
.compliance-list header span { color: var(--text-2); font-size: .78rem; }
.compliance-list header [data-state='review'] { color: var(--danger); font-weight: 700; }
.compliance-nonpdf { margin: 0; padding: .48rem .65rem; border: 1px solid color-mix(in srgb, var(--warn) 45%, transparent); border-inline-start: 3px solid var(--warn); border-radius: 7px; background: var(--warn-soft); color: var(--warn); font-size: .8rem; font-weight: 600; }
.compliance-pdf-ext { color: var(--success, #16a34a); font-weight: 700; }
.compliance-list header [data-nonpdf='true'], .compliance-nonpdf-ext { color: var(--warn); font-weight: 700; }
</style>
