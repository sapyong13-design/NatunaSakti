<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { getEisFindings, getOfficialEis } from '../lib/eisApi'
import EisScheduleList from '../components/dashboard/EisScheduleList.vue'
import EisComplianceList from '../components/dashboard/EisComplianceList.vue'

const tabs = [
    { id: 'kinerja', label: 'Kinerja' },
    { id: 'kepatuhan', label: 'Kepatuhan' },
    { id: 'kelengkapan', label: 'Kelengkapan' },
    { id: 'kesesuaian', label: 'Kesesuaian' },
    { id: 'konversi', label: 'Konversi' }
]
const jakarta = 'Asia/Jakarta'
const monthParts = new Intl.DateTimeFormat('en', { timeZone: jakarta, year: 'numeric', month: '2-digit' })
    .formatToParts(new Date())
const period = ref(`${monthParts.find(part => part.type === 'year').value}-${monthParts.find(part => part.type === 'month').value}`)
const monthFormat = new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', month: 'long', year: 'numeric' })
const periodLabel = computed(() => validPeriod.value ? monthFormat.format(new Date(`${period.value}-01T00:00:00Z`)) : 'Periode belum dipilih')
const validPeriod = computed(() => /^\d{4}-(0[1-9]|1[0-2])$/.test(period.value))
const dateFormat = new Intl.DateTimeFormat('id-ID', { timeZone: jakarta, dateStyle: 'medium', timeStyle: 'short' })
const formatTime = value => value && Number.isFinite(Date.parse(value)) ? `${dateFormat.format(new Date(value))} WIB` : '—'
const officialStatus = {
    ready: 'Data resmi tersedia',
    unpublished: 'Data resmi belum dipublikasikan untuk periode ini.',
    unavailable: 'Gagal memperoleh data resmi.',
    empty: 'Belum ada snapshot resmi untuk periode ini. Pilih Muat Ulang untuk mencoba mengambilnya.'
}
const localStatus = {
    checked: 'Pemeriksaan lokal selesai',
    partial: 'Pemeriksaan lokal sebagian',
    unavailable: 'Pemeriksaan lokal tidak tersedia',
    not_case_based: 'Indikator tidak berbasis perkara'
}
const active = ref(tabs[0].id)
const onlyIssues = ref(false)
const cache = new Map()
const official = shallowRef(null)
const busy = ref(false)
const snapshot = computed(() => official.value?.snapshot)
const implementationScore = computed(() => snapshot.value?.tabs.find(tab => tab.id === 'konversi')?.rows.at(-1)?.points)
const rows = computed(() => snapshot.value?.tabs.find(tab => tab.id === active.value)?.rows ?? [])
const hasIssue = row => row.details.some(detail => row.headers.some((header, i) => (officialCount(header, detail.values[i]) ?? 0) > 0))
const issueCount = computed(() => rows.value.filter(hasIssue).length)
const visibleRows = computed(() => onlyIssues.value && active.value !== 'konversi' ? rows.value.filter(hasIssue) : rows.value)
const percent = value => `${value.replace('.', ',').replace(/\s*%$/, '')}%`
let officialRequest
let localRequest

const drawer = ref(null)
const selection = shallowRef(null)
const result = shallowRef(null)
const checking = ref(false)
const evidence = shallowRef(null)
const localContext = computed(() => result.value?.context)
const basComparison = computed(() => {
    const context = result.value?.context
    if (context?.kind !== 'bas' || !selection.value) return null
    const counts = new Map(selection.value.metrics.map(metric => [metric.label.toLowerCase(), metric.value]))
    const value = counts.get('jumlah')
    const official = value && /^\d+(?:\.\d{3})*$/.test(value) ? Number(value.replaceAll('.', '')) : null
    if (official === null) return null
    return official === context.summary.registered
        ? 'Jumlah sidang ber-BAS di lokal sama dengan Jumlah EIS. Angka Sesuai/Tidak butuh pemeriksaan berkas.'
        : `Jumlah sidang ber-BAS lokal ${context.summary.registered}, EIS ${official}.`
})
const witnessComparison = computed(() => {
    const cohort = result.value?.context?.cohort
    if (!cohort || !selection.value) return null
    const counts = new Map(selection.value.metrics.map(metric => [metric.label.toLowerCase(), metric.value]))
    const expected = ['jumlah', 'sesuai', 'tidak'].map(label => {
        const value = counts.get(label)
        return value && /^\d+(?:\.\d{3})*$/.test(value) ? Number(value.replaceAll('.', '')) : null
    })
    if (expected.some(value => value === null)) return null
    return expected[0] === cohort.total && expected[1] === cohort.recorded && expected[2] === cohort.total - cohort.recorded
        ? 'Jumlah dan rincian lokal cocok dengan EIS. Badilum tidak menampilkan identitas perkaranya.'
        : 'Jumlah pembanding lokal berbeda dari EIS. Angka resmi tetap menjadi acuan.'
})
const localCount = computed(() => {
    const audit = result.value
    if (!audit || !['checked', 'partial'].includes(audit.status)) return null
    const count = audit.findings.length
    if (count > 0 || audit.evaluated > 0) return count
    return audit.status === 'checked' && audit.evaluated == null ? 0 : null
})
let trigger

function closeFindings() {
    localRequest?.abort()
    localRequest = undefined
    if (drawer.value?.open) drawer.value.close()
    trigger?.focus()
    trigger = undefined
    selection.value = null
    evidence.value = null
}

async function loadOfficial(refresh = false, background = false) {
    officialRequest?.abort()
    officialRequest = undefined
    const requestedPeriod = period.value
    const previous = cache.get(requestedPeriod)
    if (!background) {
        closeFindings()
        official.value = previous ?? null
        busy.value = validPeriod.value
    }
    if (!validPeriod.value) return

    const controller = new AbortController()
    officialRequest = controller
    try {
        const data = await getOfficialEis(requestedPeriod, refresh, controller.signal)
        if (officialRequest !== controller) return
        const received = data.snapshot?.period === requestedPeriod ? data.snapshot : null
        if (data.status === 'ready' && !received) throw new Error('Snapshot periode yang dipilih tidak diterima.')
        official.value = { ...data, snapshot: received ?? previous?.snapshot ?? null }
    } catch (error) {
        if (officialRequest !== controller) return
        official.value = {
            status: 'unavailable',
            snapshot: previous?.snapshot ?? null,
            attemptedAt: previous?.attemptedAt,
            error: error.name === 'TimeoutError' ? 'Permintaan melebihi batas waktu.' : error.message
        }
    } finally {
        if (officialRequest === controller) {
            officialRequest = undefined
            cache.set(requestedPeriod, official.value)
            busy.value = false
        }
    }
}

function handleTabKeys(event, index) {
    const targets = { Home: 0, End: tabs.length - 1, ArrowLeft: (index + tabs.length - 1) % tabs.length, ArrowRight: (index + 1) % tabs.length }
    if (!Object.hasOwn(targets, event.key)) return
    event.preventDefault()
    const tab = tabs[targets[event.key]]
    active.value = tab.id
    document.getElementById(`eis-tab-${tab.id}`)?.focus()
}

function officialCount(header, value) {
    if (!/^tidak$/i.test(header?.trim() ?? '')) return null
    const text = String(value).trim()
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(text)) return null
    const number = Number(text.replaceAll('.', ''))
    return Number.isSafeInteger(number) ? number : null
}

async function openFindings(event, row, detail, index, count) {
    // Keep the snapshot that supplied this detail index fixed while auditing it.
    officialRequest?.abort()
    officialRequest = undefined
    localRequest?.abort()
    const controller = new AbortController()
    localRequest = controller
    const requestedPeriod = period.value
    trigger = event.currentTarget
    selection.value = {
        label: row.label, detail: detail.label, count, points: row.points,
        description: row.details.length === 1 && row.description !== detail.label ? row.description : '',
        metrics: row.headers.map((header, i) => ({ label: header, value: detail.values[i] || '—' }))
    }
    evidence.value = null
    result.value = null
    checking.value = true
    drawer.value.showModal()
    try {
        const audit = await getEisFindings(requestedPeriod, row.label, index, controller.signal)
        if (localRequest === controller) result.value = audit
    } catch {
        if (localRequest === controller) {
            result.value = { status: 'unavailable', findings: [], reason: 'Hasil pemeriksaan lokal tidak dapat dimuat.' }
        }
    } finally {
        if (localRequest === controller) checking.value = false
    }
}

watch(period, () => loadOfficial(), { immediate: true, flush: 'sync' })

// Read the backend snapshot only; scheduled and startup syncs run on the server.
const snapshotPollInterval = 60_000
let snapshotPoll
function pollSnapshot() {
    if (document.visibilityState === 'visible' && !officialRequest && !selection.value && validPeriod.value) {
        void loadOfficial(false, true)
    }
}

onMounted(() => {
    snapshotPoll = window.setInterval(pollSnapshot, snapshotPollInterval)
    document.addEventListener('visibilitychange', pollSnapshot)
})
onBeforeUnmount(() => {
    window.clearInterval(snapshotPoll)
    document.removeEventListener('visibilitychange', pollSnapshot)
    officialRequest?.abort()
    officialRequest = undefined
    localRequest?.abort()
    localRequest = undefined
})
</script>

<template>
    <section class="eis-page" aria-labelledby="eis-heading">
        <header class="eis-hero">
            <div class="eis-hero-copy">
                <p class="eis-kicker">Evaluasi Implementasi SIPP</p>
                <h1 id="eis-heading">Monitoring EIS</h1>
                <p>Pengadilan Negeri Natuna <span aria-hidden="true">·</span> PT Kepulauan Riau</p>
            </div>
            <div v-if="implementationScore" class="eis-score">
                <span>Implementasi SIPP</span>
                <strong>{{ implementationScore.replace('.', ',').replace(/\s*%$/, '') }}<small>%</small></strong>
                <span>{{ periodLabel }}</span>
            </div>
        </header>

        <div class="eis-toolbar">
            <div class="eis-controls">
                <label for="eis-month">Periode (WIB)
                    <input id="eis-month" v-model="period" type="month" required>
                </label>
                <button type="button" class="eis-primary" :disabled="busy || !validPeriod" @click="loadOfficial(true)">
                    {{ busy ? 'Memuat…' : 'Muat ulang EIS' }}
                </button>
            </div>
            <div class="eis-source" role="status">
                <strong>{{ !validPeriod ? 'Pilih satu bulan' : busy ? 'Memuat EIS Badilum' : officialStatus[official?.status] }}</strong>
                <span v-if="snapshot">Diambil dari Badilum · {{ formatTime(snapshot.fetchedAt) }}</span>
                <span v-if="snapshot && (busy || official?.status !== 'ready')">Menampilkan snapshot terakhir.</span>
            </div>
        </div>
        <p v-if="official?.error && !busy && official.status === 'unavailable'" class="eis-empty" role="status">{{ official.error }}</p>
        <p v-if="!snapshot && !busy && validPeriod" class="eis-empty">Belum ada angka resmi untuk periode ini.</p>

        <div role="tablist" aria-label="Aspek penilaian EIS" class="eis-tabs">
            <button v-for="(tab, index) in tabs" :id="`eis-tab-${tab.id}`" :key="tab.id" type="button" role="tab"
                :aria-selected="active === tab.id" :aria-controls="`eis-panel-${tab.id}`" :tabindex="active === tab.id ? 0 : -1"
                @click="active = tab.id" @keydown="handleTabKeys($event, index)">{{ tab.label }}</button>
        </div>

        <section v-for="tab in tabs" v-show="active === tab.id" :id="`eis-panel-${tab.id}`" :key="tab.id"
            :aria-labelledby="`eis-tab-${tab.id}`" :aria-busy="busy" role="tabpanel" tabindex="0" class="eis-panel">
            <template v-if="active === tab.id && snapshot">
                <div class="eis-register-bar">
                    <div><h2>{{ tab.label }}</h2><span>{{ rows.length }} {{ tab.id === 'konversi' ? 'ringkasan nilai' : 'indikator resmi' }}</span></div>
                    <div v-if="tab.id !== 'konversi'" class="eis-switch" role="group" aria-label="Filter indikator resmi">
                        <button type="button" :aria-pressed="!onlyIssues" @click="onlyIssues = false">Semua</button>
                        <button type="button" :aria-pressed="onlyIssues" @click="onlyIssues = true">Ada ‘Tidak’ <span>{{ issueCount }}</span></button>
                    </div>
                </div>
                <div v-if="tab.id === 'konversi' && rows.length" class="eis-register eis-conversion">
                    <table>
                        <thead><tr><th scope="col">Kategori</th><th scope="col">Nilai maksimal</th><th scope="col">Nilai satker</th><th scope="col">Konversi</th></tr></thead>
                        <tbody><tr v-for="row in rows.slice(0, -1)" :key="row.label">
                            <th scope="row">{{ row.label }}</th>
                            <td>{{ row.details[0]?.values[0] || '—' }}</td><td>{{ row.details[0]?.values[1] || '—' }}</td>
                            <td class="eis-conversion-value">{{ row.points ? percent(row.points) : '—' }}</td>
                        </tr></tbody>
                    </table>
                    <div class="eis-conversion-total"><span>Implementasi SIPP</span><strong>{{ implementationScore ? percent(implementationScore) : '—' }}</strong></div>
                </div>
                <div v-else-if="visibleRows.length" class="eis-register">
                    <article v-for="row in visibleRows" :key="row.label" class="eis-indicator" :class="{ 'eis-indicator-issue': hasIssue(row) }">
                        <header>
                            <div class="eis-indicator-name"><h3>{{ row.label }}</h3><span class="eis-points">{{ row.points || '—' }} poin</span></div>
                            <details v-if="row.description && !row.details.some(detail => detail.label)" class="eis-indicator-rule">
                                <summary>Kriteria penilaian</summary><p>{{ row.description }}</p>
                            </details>
                        </header>
                        <div v-if="row.details.length" class="eis-measures">
                            <div v-for="(detail, index) in row.details" :key="index" class="eis-measure">
                                <p v-if="detail.label" class="eis-submeasure">{{ detail.label }}</p>
                                <dl><div v-for="(header, cell) in row.headers" :key="cell" :data-status="header.toLowerCase()">
                                    <dt>{{ header }}</dt>
                                    <dd>
                                        <button v-if="officialCount(header, detail.values[cell]) !== null || (['kepatuhan', 'kelengkapan', 'kesesuaian'].includes(tab.id) && header.trim().toLowerCase() === 'tidak')" type="button" class="eis-count"
                                            :class="{ 'eis-count-alert': officialCount(header, detail.values[cell]) > 0 }" :disabled="busy"
                                            :aria-label="`Periksa temuan lokal untuk ${row.label}${detail.label ? ` — ${detail.label}` : ''}; Tidak resmi: ${detail.values[cell] || 'belum dinilai'}`"
                                            @click="openFindings($event, row, detail, index, officialCount(header, detail.values[cell]))">{{ detail.values[cell] || '—' }}</button>
                                        <template v-else>{{ detail.values[cell] || '—' }}</template>
                                    </dd>
                                </div></dl>
                            </div>
                        </div>
                    </article>
                </div>
                <p v-else class="eis-empty">{{ onlyIssues && rows.length ? 'Tidak ada indikator dengan angka “Tidak” di tab ini.' : 'Belum ada indikator untuk tab ini.' }}</p>
            </template>
        </section>

        <dialog ref="drawer" class="eis-drawer" aria-labelledby="eis-drawer-title" @cancel.prevent="closeFindings">
            <header class="eis-drawer-header">
                <div>
                    <p class="eis-kicker">{{ periodLabel }} · EIS Badilum</p>
                    <h2 id="eis-drawer-title">{{ selection?.label }}</h2>
                    <p v-if="selection?.detail" class="eis-subtitle">{{ selection.detail }}</p>
                </div>
                <button type="button" class="eis-secondary" autofocus @click="closeFindings">Tutup</button>
            </header>
            <div v-if="selection" class="eis-drawer-body">
                <section aria-labelledby="eis-official-title">
                    <div class="eis-section-heading">
                        <h3 id="eis-official-title">Angka resmi EIS</h3>
                        <span v-if="selection.points" class="eis-points">{{ selection.points }} poin</span>
                    </div>
                    <dl class="eis-comparison">
                        <div v-for="metric in selection.metrics" :key="metric.label" :data-status="metric.label.toLowerCase()">
                            <dt>{{ metric.label }}</dt><dd>{{ metric.value }}</dd>
                        </div>
                    </dl>
                    <p class="eis-provenance">Badilum tidak menampilkan batas waktu data atau daftar perkara yang dinilai.</p>
                    <details v-if="selection.description" class="eis-indicator-rule">
                        <summary>Kriteria penilaian</summary><p>{{ selection.description }}</p>
                    </details>
                </section>
                <div class="eis-local-bar">
                    <h3>Pemeriksaan SIPP lokal</h3>
                    <span v-if="localContext?.checkedAt">Diperiksa {{ formatTime(localContext.checkedAt) }}</span>
                </div>
                <p v-if="checking" role="status">Memeriksa data SIPP lokal…</p>
                <EisComplianceList v-else-if="localContext?.kind === 'compliance'" :audit="localContext" />
                <template v-else-if="result && !localContext?.summary">
                    <p class="eis-provenance" role="status"><strong>{{ localStatus[result.status] }}.</strong> {{ result.reason }}</p>
                    <p v-if="localCount !== null" class="eis-mismatch">{{ localCount }} temuan lokal{{ localCount !== selection.count ? `; angka resmi: ${selection.count}.` : '.' }}</p>
                    <dl v-if="result.evaluated != null || result.unknown != null || result.localSyncedAt" class="eis-times">
                        <div v-if="result.evaluated != null"><dt>Perkara dievaluasi</dt><dd>{{ result.evaluated }}</dd></div>
                        <div v-if="result.unknown != null"><dt>Tidak dapat dinilai</dt><dd>{{ result.unknown }}</dd></div>
                        <div v-if="result.localSyncedAt"><dt>Sinkronisasi SIPP</dt><dd>{{ formatTime(result.localSyncedAt) }}</dd></div>
                    </dl>
                </template>
                <section v-if="localContext?.kind === 'witness' || localContext?.kind === 'bas'" class="eis-hearing-context" aria-label="Daftar jadwal lokal">
                    <p v-if="witnessComparison" class="eis-subtitle">{{ witnessComparison }}</p>
                    <p v-if="basComparison" class="eis-subtitle">{{ basComparison }}</p>
                    <EisScheduleList :kind="localContext.kind" :checked-at="localContext.checkedAt"
                        :rows="localContext.kind === 'witness' ? localContext.cohort?.rows ?? [] : localContext.rows" />
                    <details class="eis-method">
                        <summary>Cara membaca daftar ini</summary>
                        <p>{{ result.reason }} Jadwal hari ini dan mendatang tidak masuk kelompok “Perlu dicek”. Tanggal yang sudah lewat juga bukan bukti sidang terlaksana.</p>
                    </details>
                </section>
                <section v-if="localContext?.kind === 'witness'" class="eis-hearing-context" aria-labelledby="eis-witness-title">
                    <details class="eis-raw-entries">
                        <summary>{{ result.context.summary.total }} entri saksi berdasarkan tanggal input <span>Daftar terpisah, bukan jumlah EIS</span></summary>
                    <h4 id="eis-witness-title" class="eis-sr-only">Rincian entri saksi</h4>
                    <p>{{ result.context.summary.cases }} perkara · {{ result.context.summary.incomplete }} catatan dengan kolom inti belum lengkap · {{ result.context.summary.noQa }} tanpa catatan tanya-jawab · {{ result.context.summary.incompleteQa }} dengan isian tanya-jawab belum lengkap.</p>
                    <p v-if="!result.context.rows.length">Tidak ada input saksi tercatat untuk bulan ini.</p>
                    <div v-else class="eis-table-scroll" role="region" aria-labelledby="eis-witness-title" tabindex="0">
                        <table>
                            <thead><tr><th scope="col">Perkara</th><th scope="col">Saksi</th><th scope="col">Tanggal input (WIB)</th><th scope="col">Kolom inti</th><th scope="col">Tanya-jawab</th></tr></thead>
                            <tbody><tr v-for="row in result.context.rows" :key="row.sourceId">
                                <th scope="row">
                                    <RouterLink v-if="row.id" :to="{ name: 'Data', query: { perkara: row.id } }">{{ row.nomorPerkara }}</RouterLink>
                                    <template v-else>{{ row.nomorPerkara }}</template>
                                </th>
                                <td>{{ row.nama || 'Nama kosong' }}<small v-if="row.jenisSaksi">{{ row.jenisSaksi }}</small></td>
                                <td>{{ row.tanggalInput.replace('T', ' ') }}</td>
                                <td>{{ row.missing.length ? `Periksa: ${row.missing.join(', ')}` : 'Terisi' }}</td>
                                <td>{{ row.qaCount ? `${row.qaComplete}/${row.qaCount} terisi` : 'Tidak tercatat' }}</td>
                            </tr></tbody>
                        </table>
                    </div>
                    </details>
                </section>
                <section v-else-if="localContext && !localContext.summary && localContext.kind !== 'compliance'" class="eis-hearing-context" aria-labelledby="eis-context-title">
                    <h4 id="eis-context-title">{{ result.context.kind === 'witness_schedule' ? 'Agenda yang menyebut saksi' : 'Jadwal sidang untuk pembanding BAS' }}</h4>
                    <p>{{ result.context.rows.length }} jadwal berdasarkan tanggal sidang pada bulan terpilih, bukan tanggal input saksi atau tanggal unggah BAS. Jadwal mendatang juga dapat tercantum.</p>
                    <p v-if="!result.context.rows.length">Tidak ada jadwal pembanding di cache untuk bulan ini.</p>
                    <div v-else class="eis-table-scroll" role="region" aria-labelledby="eis-context-title" tabindex="0">
                        <table>
                            <thead><tr>
                                <th scope="col">Perkara</th><th scope="col">Tanggal sidang</th><th scope="col">Agenda</th>
                                <th scope="col">{{ result.context.kind === 'witness_schedule' ? 'Kelengkapan saksi' : 'Status unggah BAS' }}</th>
                            </tr></thead>
                            <tbody><tr v-for="hearing in result.context.rows" :key="hearing.hearingId">
                                <th scope="row"><RouterLink :to="{ name: 'Data', query: { perkara: hearing.id } }">{{ hearing.nomorPerkara }}</RouterLink></th>
                                <td>{{ hearing.tanggal }}</td><td>{{ hearing.agenda || '—' }}</td><td>Belum dapat diverifikasi</td>
                            </tr></tbody>
                        </table>
                    </div>
                </section>
                <ul v-if="result?.findings.length" class="eis-findings">
                    <li v-for="(finding, index) in result.findings" :key="index">
                        <button type="button" class="eis-evidence-btn" :aria-expanded="evidence === finding"
                            :aria-controls="`eis-evidence-${index}`" @click="evidence = evidence === finding ? null : finding">
                            {{ finding.nomorPerkara || 'Bukti perkara' }} <span>{{ evidence === finding ? '−' : '+' }}</span>
                        </button>
                        <div v-show="evidence === finding" :id="`eis-evidence-${index}`" class="eis-evidence">
                            <p>{{ finding.reason }}</p>
                            <dl class="eis-times">
                                <div v-for="(field, fieldIndex) in finding.fields" :key="fieldIndex"><dt>{{ field.label }}</dt><dd>{{ field.value }}</dd></div>
                            </dl>
                            <RouterLink v-if="Number.isSafeInteger(finding.id) && finding.id > 0" :to="{ name: 'Data', query: { perkara: finding.id } }">
                                Buka detail di Dashboard
                            </RouterLink>
                        </div>
                    </li>
                </ul>
            </div>
        </dialog>
    </section>
</template>

<style scoped>
.eis-page { display: grid; gap: 1rem; width: 100%; max-width: 1240px; min-width: 0; margin-inline: auto; color: var(--text); }
.eis-page :is(h1, h2, h3, h4, p, dl, dd) { margin: 0; }
.eis-page :is(button, input, summary):focus-visible, .eis-page a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.eis-page button:not(:disabled), .eis-page summary { cursor: pointer; }
.eis-page button:disabled { opacity: .65; }
.eis-kicker { color: var(--accent); letter-spacing: .09em; font-size: .73rem; text-transform: uppercase; font-weight: 750; }
.eis-hero { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: clamp(1.2rem, 4vw, 2.2rem); border: 1px solid var(--border); border-radius: 16px; background: linear-gradient(120deg, var(--accent-soft), transparent 65%), var(--bg2); }
.eis-hero h1 { margin-block: .25rem; font-size: clamp(1.7rem, 4vw, 2.6rem); letter-spacing: -.035em; line-height: 1.1; }
.eis-hero-copy > p:last-child, .eis-score span, .eis-source span, .eis-subtitle { color: var(--text-2); }
.eis-score { display: grid; justify-items: end; flex: none; padding-inline-start: 1.1rem; border-inline-start: 1px solid var(--border); text-align: end; font-size: .83rem; }
.eis-score strong { line-height: 1.12; font-size: clamp(1.45rem, 4vw, 2.25rem); color: var(--accent); font-variant-numeric: tabular-nums; }
.eis-score small { font-size: .55em; }
.eis-toolbar { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: .8rem 1.2rem; }
.eis-controls { display: flex; flex-wrap: wrap; align-items: end; gap: .55rem; }
.eis-controls label, .eis-source { display: grid; gap: .15rem; font-size: .83rem; }
.eis-controls label { font-weight: 650; }
.eis-controls input, .eis-primary, .eis-secondary { min-height: 2.55rem; padding: .4rem .75rem; border: 1px solid var(--border); border-radius: 8px; background: var(--bg2); color: var(--text); font: inherit; }
.eis-primary { background: var(--accent); color: var(--text-tooltip); border-color: var(--accent); font-size: .88rem; font-weight: 700; }
.eis-tabs { display: flex; gap: .15rem; overflow: auto; border-bottom: 1px solid var(--border); scrollbar-width: thin; }
.eis-tabs button { flex: 0 0 auto; padding: .6rem clamp(.6rem, 2vw, 1.1rem); border: 0; border-bottom: 3px solid transparent; background: transparent; color: var(--text-2); font: inherit; font-weight: 600; }
.eis-tabs button[aria-selected='true'] { border-color: var(--accent); color: var(--accent); font-weight: 750; }
.eis-panel { min-width: 0; }
.eis-register-bar, .eis-local-bar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: .4rem .8rem; }
.eis-register-bar { margin-bottom: .65rem; }
.eis-register-bar > div:first-child { display: flex; align-items: baseline; gap: .55rem; }
.eis-register-bar h2 { font-size: 1.22rem; letter-spacing: -.025em; }
.eis-register-bar span, .eis-local-bar span { color: var(--text-2); font-size: .78rem; }
.eis-switch { display: flex; padding: .16rem; gap: .12rem; background: var(--bg3); border: 1px solid var(--border); border-radius: 8px; }
.eis-switch button { background: transparent; color: var(--text-2); padding: .25rem .55rem; border: 1px solid transparent; border-radius: 6px; font: inherit; font-size: .78rem; }
.eis-switch button[aria-pressed='true'] { background: var(--bg2); color: var(--text); border-color: var(--border); font-weight: 700; }
.eis-switch button span { color: inherit; margin-left: .15rem; font-weight: 700; }
.eis-register { border: 1px solid var(--border); border-radius: 12px; background: var(--bg2); overflow: hidden; }
.eis-indicator { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr); align-items: baseline; gap: .45rem 1rem; padding: .65rem .9rem; border-inline-start: 3px solid transparent; }
.eis-indicator + .eis-indicator { border-top: 1px solid var(--border); }
.eis-indicator-issue { border-inline-start-color: var(--danger); }
.eis-indicator-name { display: flex; align-items: baseline; gap: .35rem .55rem; flex-wrap: wrap; }
.eis-indicator-name h3 { font-size: .93rem; line-height: 1.25; }
.eis-indicator-rule, .eis-method { color: var(--text-2); font-size: .77rem; }
.eis-indicator-rule { margin-top: .25rem; }
.eis-indicator-rule p, .eis-method p { margin-top: .3rem; white-space: pre-line; }
.eis-points { display: inline-block; flex: none; background: var(--accent-soft); color: var(--accent); border-radius: 5px; padding: .12rem .4rem; font-size: .72rem; font-weight: 700; white-space: nowrap; }
.eis-measures { display: grid; gap: .3rem; min-width: 0; }
.eis-measure + .eis-measure { padding-top: .35rem; border-top: 1px solid var(--border); }
.eis-measure dl { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: .5rem; }
.eis-measure dt { font-size: .72rem; color: var(--text-2); overflow-wrap: anywhere; }
.eis-measure dd { display: flex; align-items: center; min-height: 1.8rem; font-size: .95rem; font-weight: 700; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.eis-measure [data-status='sesuai'] dd { color: var(--success); }
.eis-submeasure { color: var(--text-2); font-size: .77rem; }
.eis-conversion-value { font-weight: 750; color: var(--accent); }
.eis-conversion-total { display: flex; justify-content: space-between; gap: .6rem; padding: .75rem .9rem; background: var(--accent-soft); color: var(--accent); font-weight: 700; }
.eis-table-scroll { overflow: auto; max-width: 100%; scrollbar-width: thin; }
.eis-page table { border-collapse: collapse; width: 100%; font-size: .85rem; }
.eis-page th, .eis-page td { padding: .55rem .65rem; border-bottom: 1px solid var(--border); text-align: start; }
.eis-page thead th { background: var(--bg3); color: var(--text-2); font-size: .75rem; font-weight: 700; }
.eis-page tbody tr:last-child > * { border-bottom: 0; }
.eis-count { min-width: 2rem; min-height: 1.85rem; border: 1px solid var(--border); border-radius: 6px; background: var(--bg3); color: var(--text); font: inherit; font-weight: 750; text-decoration: underline; text-underline-offset: .16em; }
.eis-count-alert { color: var(--danger); background: var(--danger-soft); }
.eis-empty { padding: 1rem; border: 1px solid var(--border); border-radius: 8px; background: var(--bg2); }
.eis-drawer { position: fixed; inset: 0; margin: auto; width: min(58rem, calc(100% - 2rem)); max-width: none; max-height: calc(100dvh - 2rem); padding: 0; border: 1px solid var(--border); border-radius: 16px; background: var(--bg2); color: var(--text); box-shadow: 0 24px 80px rgb(0 0 0 / .38); overflow: auto; overscroll-behavior: contain; }
.eis-drawer::backdrop { background: rgb(0 0 0 / .67); }
.eis-drawer-header { position: sticky; top: 0; z-index: 1; display: flex; align-items: flex-start; justify-content: space-between; gap: .7rem; padding: 1rem clamp(1rem, 3vw, 1.5rem); border-bottom: 1px solid var(--border); background: var(--bg2); }
.eis-drawer-header h2 { margin-top: .2rem; font-size: clamp(1.15rem, 3vw, 1.65rem); line-height: 1.22; }
.eis-drawer-body { display: grid; gap: .85rem; padding: 1rem clamp(1rem, 3vw, 1.5rem) 1.4rem; }
.eis-section-heading { display: flex; justify-content: space-between; align-items: center; gap: .5rem; margin-bottom: .55rem; }
.eis-section-heading h3, .eis-local-bar h3 { font-size: 1rem; }
.eis-local-bar { padding-top: .7rem; border-top: 1px solid var(--border); }
.eis-drawer .eis-provenance { margin-top: .38rem; color: var(--text-2); font-size: .8rem; }
.eis-method { margin-top: .55rem; }
.eis-comparison { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(5rem, 100%), 1fr)); gap: .55rem; }
.eis-comparison div { min-width: 0; padding: .62rem .8rem; border: 1px solid var(--border); border-radius: 8px; background: var(--bg3); }
.eis-comparison dt { color: var(--text-2); font-size: .8rem; }
.eis-comparison dd { font-size: clamp(1.35rem, 4vw, 1.9rem); font-weight: 800; line-height: 1.2; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.eis-comparison [data-status='sesuai'] dd { color: var(--success); }
.eis-comparison [data-status='tidak'] dd { color: var(--danger); }
.eis-drawer-body [role='status'], .eis-hearing-context > p { color: var(--text-2); font-size: .86rem; }
.eis-times { display: flex; flex-wrap: wrap; gap: .4rem 1rem; font-size: .77rem; }
.eis-drawer-body .eis-times { margin-top: .4rem; }
.eis-times dt { color: var(--text-2); }
.eis-times dd { font-weight: 650; }
.eis-mismatch { margin-top: .35rem !important; color: var(--text); font-weight: 650; }
.eis-hearing-context h4 { font-size: .93rem; }
.eis-hearing-context .eis-table-scroll { margin-top: .55rem; border: 1px solid var(--border); border-radius: 8px; }
.eis-hearing-context small { display: block; margin-top: .1rem; color: var(--text-2); font-size: .76rem; }
.eis-hearing-context a, .eis-evidence a { color: var(--accent); text-underline-offset: .15em; }
.eis-raw-entries { padding: .65rem .75rem; border: 1px solid var(--border); border-radius: 8px; background: var(--bg3); }
.eis-raw-entries summary { font-weight: 700; font-size: .87rem; }
.eis-raw-entries summary span { display: block; color: var(--text-2); font-weight: 450; }
.eis-raw-entries[open] summary { margin-bottom: .6rem; }
.eis-findings { list-style: none; margin: 0; padding: 0; }
.eis-findings li { border: 1px solid var(--border); border-radius: 8px; margin-bottom: .45rem; }
.eis-evidence-btn { display: flex; justify-content: space-between; width: 100%; padding: .65rem; border: 0; border-radius: 8px; background: var(--bg3); color: var(--text); font: inherit; font-weight: 650; text-align: start; }
.eis-evidence { padding: .65rem; }
.eis-sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@media (max-width: 830px) { .eis-indicator { grid-template-columns: minmax(0, 1fr); gap: .55rem; } }
@media (max-width: 560px) {
    .eis-hero { align-items: start; flex-wrap: wrap; }
    .eis-score { grid-template-columns: auto auto; justify-content: start; align-items: baseline; gap: .15rem .55rem; border: 0; padding: 0; text-align: start; }
    .eis-score span:last-child { grid-column: 1 / -1; }
    .eis-drawer { width: 100%; max-height: 100dvh; margin: auto 0 0; border-radius: 14px 14px 0 0; }
    .eis-drawer th, .eis-drawer td { padding: .42rem; }
    .eis-indicator { gap: .35rem; }
    .eis-measure dl { background: var(--surface-2); padding: .3rem .45rem; border-radius: 6px; }
    .eis-conversion th, .eis-conversion td { padding: .48rem .38rem; }
    .eis-hearing-context table { min-width: 22rem; }
}
</style>
