<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
    rows: { type: Array, required: true },
    kind: { type: String, required: true },
    checkedAt: { type: String, required: true }
})
const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' })
const labelFormat = new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', day: 'numeric', month: 'short' })
const today = computed(() => dayFormat.format(new Date(props.checkedAt)))
const groups = computed(() => {
    const past = [], current = [], future = []
    for (const row of props.rows) {
        if (row.tanggal < today.value) past.push(row)
        else if (row.tanggal === today.value) current.push(row)
        else future.push(row)
    }
    const missing = past.filter(needsReview)
    return [
        { id: 'review', label: 'Perlu dicek', rows: missing },
        { id: 'past', label: 'Sudah lewat', rows: past },
        { id: 'today', label: 'Hari ini', rows: current },
        { id: 'future', label: 'Mendatang', rows: future }
    ]
})
const selected = ref(null)
const group = computed(() => groups.value.find(item => item.id === selected.value)
    ?? groups.value.find(item => item.rows.length > 0) ?? groups.value[0])

function needsReview(row) {
    return props.kind === 'witness' ? !row.recorded : row.uploadState !== 'registered'
}

function state(row) {
    if (!needsReview(row)) {
        if (props.kind === 'bas') {
            if (row.nonPdf) return { label: `BAS bukan PDF (${row.nonPdf})`, tone: 'warn' }
            return { label: row.docExt ? `BAS · ${row.docExt.slice(1).toUpperCase()}` : 'Rujukan BAS ada', tone: 'ok' }
        }
        return { label: `${row.witnessCount} entri`, tone: 'ok' }
    }
    if (row.tanggal > today.value) return { label: 'Belum waktunya', tone: 'neutral' }
    if (row.tanggal === today.value) return { label: 'Belum tercatat · hari ini', tone: 'neutral' }
    return { label: props.kind === 'bas' && row.uploadState === 'unknown' ? 'Rujukan tidak dikenali' : 'Belum tercatat', tone: 'review' }
}

function filledSections(row) {
    return [row.hasTemplateContent && 'Template BAS', row.hasHearingDetail && 'Detail sidang',
        row.hasTemplateQa && 'Tanya-jawab', row.hasTemplateClosing && 'Penutup'].filter(Boolean).join(', ')
}

function labelDate(date) {
    return labelFormat.format(new Date(`${date}T00:00:00Z`))
}
</script>

<template>
    <div class="schedule-register">
        <div class="schedule-scopes" role="group" aria-label="Filter waktu jadwal lokal">
            <button v-for="item in groups" :key="item.id" type="button" :aria-pressed="group.id === item.id" @click="selected = item.id">
                {{ item.label }} <span>{{ item.rows.length }}</span>
            </button>
        </div>
        <p v-if="!group.rows.length" class="schedule-empty">{{ group.id === 'review' ? 'Tidak ada jadwal lewat yang perlu dicek dari data lokal.' : 'Tidak ada jadwal dalam kelompok ini.' }}</p>
        <ul v-else class="schedule-list" :aria-label="group.label">
            <li v-for="row in group.rows" :key="row.sourceId" class="schedule-entry">
                <time :datetime="row.tanggal">{{ labelDate(row.tanggal) }}</time>
                <div class="schedule-case">
                    <RouterLink v-if="row.id" :to="{ name: 'Data', query: { perkara: row.id } }">{{ row.nomorPerkara }}</RouterLink>
                    <strong v-else>{{ row.nomorPerkara }}</strong>
                    <p v-if="kind === 'bas' && row.docName" class="schedule-file">{{ row.docName }}</p>
                    <details v-if="row.agenda || kind === 'bas'" class="schedule-extra">
                        <summary>{{ kind === 'bas' ? 'Agenda & isian BAS' : 'Agenda sidang' }}</summary>
                        <p v-if="row.agenda">{{ row.agenda }}</p>
                        <p v-if="kind === 'bas'">Isian terstruktur: {{ filledSections(row) || 'Tidak tercatat' }}</p>
                    </details>
                </div>
                <span class="schedule-state" :data-tone="state(row).tone">{{ state(row).label }}</span>
            </li>
        </ul>
    </div>
</template>

<style scoped>
.schedule-register { display: grid; gap: .65rem; }
.schedule-scopes { display: flex; flex-wrap: wrap; gap: .3rem; }
.schedule-scopes button { display: flex; align-items: center; gap: .35rem; border: 1px solid var(--border); background: var(--bg2); color: var(--text-2); border-radius: 7px; padding: .3rem .48rem; font: inherit; font-size: .76rem; }
.schedule-scopes button[aria-pressed='true'] { color: var(--accent); background: var(--accent-soft); border-color: var(--accent); font-weight: 700; }
.schedule-scopes span { padding-inline: .23rem; font-variant-numeric: tabular-nums; font-weight: 700; }
.schedule-empty { padding: .75rem; border: 1px dashed var(--border); border-radius: 8px; color: var(--text-2); font-size: .84rem; }
.schedule-list { list-style: none; margin: 0; padding: 0; border-block: 1px solid var(--border); }
.schedule-entry { display: grid; grid-template-columns: 5rem minmax(0, 1fr) max-content; align-items: start; gap: .5rem .8rem; padding: .58rem .25rem; font-size: .84rem; }
.schedule-entry + .schedule-entry { border-top: 1px solid var(--border); }
.schedule-entry time { color: var(--text-2); font-variant-numeric: tabular-nums; }
.schedule-case { min-width: 0; overflow-wrap: anywhere; }
.schedule-case a { color: var(--text); font-weight: 700; text-underline-offset: .16em; }
.schedule-state { width: fit-content; border-radius: 5px; padding: .12rem .4rem; background: var(--bg3); color: var(--text-2); font-size: .75rem; font-weight: 650; }
.schedule-state[data-tone='ok'] { color: var(--success); background: var(--success-soft); }
.schedule-state[data-tone='review'] { color: var(--danger); background: var(--danger-soft); }
.schedule-state[data-tone='warn'] { color: var(--warn); background: var(--warn-soft); }
.schedule-file { margin: .12rem 0 0; color: var(--text-2); font-size: .74rem; font-family: var(--font-mono, ui-monospace, monospace); overflow-wrap: anywhere; }
.schedule-extra { margin-top: .15rem; color: var(--text-2); font-size: .77rem; }
.schedule-extra summary { cursor: pointer; }
.schedule-extra p { margin: .2rem 0 0; }
@media (max-width: 560px) {
    .schedule-entry { grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: .15rem .45rem; }
    .schedule-entry time { grid-column: 1; }
    .schedule-entry .schedule-case { grid-column: 1 / -1; grid-row: 2; }
    .schedule-state { grid-column: 2; grid-row: 1; }
}
</style>
