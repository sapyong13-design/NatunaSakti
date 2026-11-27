<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getEisFindings, getEisScore, getEisTrend, getMisStatus, getOfficialEis } from '../lib/eisApi'
import { buildLostOpportunities, extractSippVersionAlert, simulateEisScore } from '../lib/eisAnalysis'
import EisScheduleList from '../components/dashboard/EisScheduleList.vue'
import EisComplianceList from '../components/dashboard/EisComplianceList.vue'
import EisTrendSection from '../components/dashboard/EisTrendSection.vue'

const tabs = [
    { id: 'kinerja', label: 'Kinerja' },
    { id: 'kepatuhan', label: 'Kepatuhan' },
    { id: 'kelengkapan', label: 'Kelengkapan' },
    { id: 'kesesuaian', label: 'Kesesuaian' },
    { id: 'konversi', label: 'Konversi' }
]
const route = useRoute()
const router = useRouter()
const jakarta = 'Asia/Jakarta'
const monthParts = new Intl.DateTimeFormat('en', { timeZone: jakarta, year: 'numeric', month: '2-digit' })
    .formatToParts(new Date())
const defaultPeriod = `${monthParts.find(part => part.type === 'year').value}-${monthParts.find(part => part.type === 'month').value}`
const initialPeriod = typeof route.query.period === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(route.query.period)
    ? route.query.period
    : defaultPeriod
const period = ref(initialPeriod)
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
const initialTab = typeof route.query.tab === 'string' && tabs.some(t => t.id === route.query.tab) ? route.query.tab : tabs[0].id
const active = ref(initialTab)
const filterMode = ref('all')
const indicatorQuery = ref('')
const sortByLoss = ref(false)
const insightPanel = ref('') // '' | 'mis' | 'trend' | 'whatif'
const trendItems = shallowRef([])
const misStatus = shallowRef(null)
const misBusy = ref(false)
const misShowAll = ref(false)
const selectedSimKeys = ref([])
const cache = new Map()
const official = shallowRef(null)
const prevOfficial = shallowRef(null)
const prevComputedScore = shallowRef(null)
const busy = ref(false)
const snapshot = computed(() => official.value?.snapshot)
const aspectIds = ['kinerja', 'kepatuhan', 'kelengkapan', 'kesesuaian']
const implementationScore = computed(() => snapshot.value?.tabs.find(tab => tab.id === 'konversi')?.rows.at(-1)?.points)
const computedScore = shallowRef(null)
const totalScoreNum = computed(() => {
    const raw = implementationScore.value ?? (computedScore.value?.total != null ? String(computedScore.value.total) : null)
    if (!raw) return null
    const n = Number(String(raw).replace(',', '.').replace('%', ''))
    return Number.isFinite(n) ? n : null
})
const animatedScore = ref(null)
let scoreAnimFrame = null
function runScoreCountUp(target) {
    if (scoreAnimFrame) cancelAnimationFrame(scoreAnimFrame)
    if (target === null) { animatedScore.value = null; return }
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        animatedScore.value = target
        return
    }
    const from = animatedScore.value ?? Math.max(0, target - 14)
    const start = performance.now()
    const duration = 520
    const step = (now) => {
        const t = Math.min(1, (now - start) / duration)
        const eased = 1 - Math.pow(1 - t, 3)
        animatedScore.value = from + (target - from) * eased
        if (t < 1) scoreAnimFrame = requestAnimationFrame(step)
        else animatedScore.value = target
    }
    scoreAnimFrame = requestAnimationFrame(step)
}
const totalScoreText = computed(() => {
    if (animatedScore.value !== null) return `${animatedScore.value.toFixed(2).replace('.', ',')}%`
    if (implementationScore.value) return percent(implementationScore.value)
    if (computedScore.value?.total != null) return percent(String(computedScore.value.total))
    return null
})
const scoreRingDash = computed(() => {
    const val = Math.max(0, Math.min(100, animatedScore.value ?? totalScoreNum.value ?? 0))
    const circ = 2 * Math.PI * 26
    return `${((val / 100) * circ).toFixed(2)} ${circ.toFixed(2)}`
})
watch(totalScoreNum, (val) => runScoreCountUp(val), { immediate: true })
const rows = computed(() => snapshot.value?.tabs.find(tab => tab.id === active.value)?.rows ?? [])
const scoreDelta = computed(() => {
    const a = computedScore.value
    if (!a || a.total === null || a.officialTotal === null) return null
    const delta = Math.round((a.total - a.officialTotal) * 100) / 100
    return { value: delta, text: (delta > 0 ? '+' : '') + delta.toFixed(2).replace('.', ',') }
})
function previousPeriodOf(p) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(p || '')) return null
    const [y, m] = p.split('-').map(Number)
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}
function snapshotTotalScore(snap, compScore) {
    const raw = snap?.tabs?.find(tab => tab.id === 'konversi')?.rows?.at(-1)?.points
    if (raw) {
        const parsed = Number(String(raw).replace(',', '.').replace('%', ''))
        if (Number.isFinite(parsed)) return parsed
    }
    return typeof compScore?.total === 'number' ? compScore.total : null
}
const prevMonthDelta = computed(() => {
    const curr = snapshotTotalScore(snapshot.value, computedScore.value)
    const prev = snapshotTotalScore(prevOfficial.value?.snapshot, prevComputedScore.value)
    if (curr === null || prev === null) return null
    const diff = Math.round((curr - prev) * 100) / 100
    const prevLabel = monthFormat.format(new Date(`${previousPeriodOf(period.value)}-01T00:00:00Z`))
    return {
        value: diff,
        text: `${diff > 0 ? '+' : ''}${diff.toFixed(2).replace('.', ',')} pp vs ${prevLabel}`
    }
})
const versionAlert = computed(() => extractSippVersionAlert(snapshot.value, computedScore.value))
const lostOpportunities = computed(() => buildLostOpportunities(computedScore.value))
const simResult = computed(() => simulateEisScore(computedScore.value, selectedSimKeys.value))
const misIssueCount = computed(() => (misStatus.value?.summary?.behind ?? 0) + (misStatus.value?.summary?.excess ?? 0))
const visibleMisTables = computed(() => {
    const list = misStatus.value?.tables ?? []
    return misShowAll.value ? list : list.filter(t => t.state !== 'ok')
})
function normalizeMisLabel(text) {
    return String(text ?? '').normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ').replace(/\s*\/\s*/g, '/')
}
const selectionMisTables = computed(() => {
    if (!selection.value || misStatus.value?.status !== 'ready') return []
    const names = misStatus.value.indicatorMap?.[normalizeMisLabel(selection.value.label)] ?? []
    if (!names.length) return []
    const byName = new Map((misStatus.value.tables ?? []).map(t => [t.tabel, t]))
    return names.map(name => byName.get(name)).filter(Boolean)
})
function toggleSimKey(key) {
    if (selectedSimKeys.value.includes(key)) {
        selectedSimKeys.value = selectedSimKeys.value.filter(k => k !== key)
    } else {
        selectedSimKeys.value = [...selectedSimKeys.value, key]
    }
}
function selectSimTop3() {
    selectedSimKeys.value = lostOpportunities.value.slice(0, 3).map(item => item.key)
}
function toggleInsight(name) {
    insightPanel.value = insightPanel.value === name ? '' : name
}
function lostPointsFor(label) {
    const el = computedElement(label)
    if (!el || !el.denominator) return 0
    return Math.max(0, Math.round((el.denominator - el.points) * 100) / 100)
}
const formatLoss = value => value.toFixed(2).replace(/\.00$/, '').replace('.', ',')
const formatScoreNum = value => {
    const num = Number(String(value ?? '').trim().replace(',', '.'))
    if (!Number.isFinite(num)) return '—'
    return num.toFixed(2).replace(/\.00$/, '').replace('.', ',')
}
const aspectSummaries = computed(() => {
    const convRows = snapshot.value?.tabs.find(tab => tab.id === 'konversi')?.rows ?? []
    return aspectIds.map(id => {
        const tabInfo = tabs.find(tab => tab.id === id)
        const tabRows = snapshot.value?.tabs.find(tab => tab.id === id)?.rows ?? []
        const convRow = convRows.find(row => row.label.toLowerCase() === id)
        const comp = computedScore.value?.components.find(item => item.id === id)
        const officialPct = convRow?.points && !/^[-—]$/.test(convRow.points.trim()) ? convRow.points : null
        const pctText = officialPct ? percent(officialPct) : (comp?.konversi != null ? percent(String(comp.konversi)) : '—')
        const pctNum = officialPct ? Number(String(officialPct).replace(',', '.').replace('%', '')) : (comp?.konversi ?? 0)
        const maks = convRow?.details?.[0]?.values?.[0] ?? comp?.maks
        const peroleh = convRow?.details?.[0]?.values?.[1] ?? comp?.peroleh
        const pointsText = maks != null && peroleh != null ? `${formatScoreNum(peroleh)} / ${formatScoreNum(maks)}` : null
        const issueRows = tabRows.filter(hasIssue).length
        return {
            id,
            label: tabInfo?.label ?? id,
            pctText,
            pctWidth: `${Math.max(0, Math.min(100, Number.isFinite(pctNum) ? pctNum : 0))}%`,
            pointsText,
            issueRows,
            unalignedParts: comp?.unalignedParts ?? 0,
            unalignedTier: comp?.unalignedTier ?? 'ok',
            prevDelta: (() => {
                const prevSnap = prevOfficial.value?.snapshot
                const prevConv = prevSnap?.tabs?.find(t => t.id === 'konversi')?.rows?.find(r => r.label.toLowerCase() === id)
                const prevPct = prevConv?.points ? Number(String(prevConv.points).replace(',', '.').replace('%', '')) : prevComputedScore.value?.components?.find(c => c.id === id)?.konversi
                if (!Number.isFinite(pctNum) || !Number.isFinite(prevPct)) return null
                const diff = Math.round((pctNum - prevPct) * 100) / 100
                return { value: diff, text: `${diff > 0 ? '+' : ''}${diff.toFixed(2).replace('.', ',')} pp` }
            })()
        }
    })
})
const hasIssue = row => row.details.some(detail => row.headers.some((header, i) => (officialCount(header, detail.values[i]) ?? 0) > 0))
const hasLoss = row => lostPointsFor(row.label) > 0
const issueCount = computed(() => rows.value.filter(hasIssue).length)
const lostCount = computed(() => active.value === 'konversi' ? 0 : rows.value.filter(hasLoss).length)
const elementParity = (tabId, label) => computedScore.value?.components.find(item => item.id === tabId)?.elements.find(item => item.label === label)?.parity ?? null
const partParity = (tabId, label, index) => elementParity(tabId, label)?.parts?.[index] ?? null
const isUnaligned = (tabId, row) => Boolean(elementParity(tabId, row.label) && !elementParity(tabId, row.label).aligned)
const unalignedCount = computed(() => active.value === 'konversi' ? 0 : rows.value.filter(row => isUnaligned(active.value, row)).length)
const tabUnaligned = id => computedScore.value?.components.find(item => item.id === id)?.unalignedParts ?? 0
const siteLevelLabels = new Set([
    'rilis versi sipp',
    'kesesuaian kode satker nomor perkara',
    'pelaksanaan sinkronisasi sipp web',
    'sinkronisasi sipp web',
    'pelaksanaan sinkronisasi sipp ke data center mari',
    'sinkronisasi sipp ke data center mari',
    'verifikasi dokumen elektronik elitigasi',
    'verifikasi dokumen elektronik e-litigasi'
])
const isSiteLevel = (row) => siteLevelLabels.has(normalizeMisLabel(row?.label))
const firstAuditDetail = (row) => {
    if (!Array.isArray(row?.details)) return null
    for (let i = 0; i < row.details.length; i++) {
        const detail = row.details[i]
        const cellIdx = (row.headers || []).findIndex((h, idx) => /^tidak$/i.test(h?.trim() ?? '') && cellNumber(detail.values?.[idx]) !== null)
        const fallbackIdx = (detail.values || []).findIndex(v => cellNumber(v) !== null)
        const targetIdx = cellIdx >= 0 ? cellIdx : fallbackIdx
        if (targetIdx >= 0) {
            return { detail, index: i, count: officialCount(row.headers[targetIdx], detail.values[targetIdx]) }
        }
    }
    return null
}
const formatPointsPill = (row) => {
    const el = computedElement(row?.label)
    if (el && el.denominator > 0) return `${formatScoreNum(el.points)} / ${formatScoreNum(el.denominator)} poin`
    return `${row?.points || '—'} poin`
}
const visibleRows = computed(() => {
    if (active.value === 'konversi') return rows.value
    let list = rows.value
    if (filterMode.value === 'issues') list = list.filter(hasIssue)
    else if (filterMode.value === 'lost') list = list.filter(hasLoss)
    else if (filterMode.value === 'unaligned') list = list.filter(row => isUnaligned(active.value, row))
    const q = indicatorQuery.value.trim().toLowerCase()
    if (q) list = list.filter(row => String(row.label || '').toLowerCase().includes(q))
    if (sortByLoss.value) {
        return [...list].sort((a, b) => lostPointsFor(b.label) - lostPointsFor(a.label))
    }
    return list
})
const percent = value => `${String(value).replace('.', ',').replace(/\s*%$/, '')}%`
const computedFor = label => computedScore.value?.components.find(item => item.id === String(label).toLowerCase()) ?? null
const cellNumber = value => {
    const text = String(value ?? '').trim()
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(text)) return null
    const number = Number(text.replaceAll('.', ''))
    return Number.isSafeInteger(number) ? number : null
}
function tabPercent(id) {
    if (id === 'konversi') return computedScore.value?.total != null ? percent(String(computedScore.value.total)) : null
    const component = computedScore.value?.components.find(item => item.id === id)
    return component?.konversi != null ? percent(String(component.konversi)) : null
}
const computedElement = label => computedScore.value?.components.flatMap(item => item.elements).find(item => item.label === label) ?? null
function calcText(label) {
    const element = computedElement(label)
    if (!element) return null
    const parts = [`bobot ${element.weight}`, `poin ${element.points}`]
    parts.push(element.denominator > 0 ? `penyebut ${element.denominator}` : 'tidak masuk penyebut')
    if (element.alwaysCounted && element.activeParts === 0) parts.push('unsur wajib walau tanpa data')
    if (element.weightOverridden) parts.push('bobot mengikuti hitungan EIS, bukan teks indikator')
    return parts.join(' · ')
}
let officialRequest
let localRequest

const drawer = ref(null)
const selection = shallowRef(null)
const result = shallowRef(null)
const checking = ref(false)
const evidence = shallowRef(null)
const localContext = computed(() => result.value?.context)
const localCompare = computed(() => {
    const context = localContext.value
    if (context?.kind !== 'compliance' || !selection.value) return null
    const counts = context.counts ?? {}
    // Jumlah EIS = perkara yang dinilai; yang belum bisa dinilai dilaporkan terpisah.
    const local = {
        jumlah: (counts.matched ?? 0) + (counts.review ?? 0),
        sesuai: counts.matched ?? 0,
        tidak: counts.review ?? 0,
        belum: counts.unknown ?? 0
    }
    const official = new Map(selection.value.metrics.map(metric => [metric.label.trim().toLowerCase(), metric.value]))
    const read = key => {
        const value = official.get(key)
        return value === undefined || value === '' || value === '—' ? null : Number(String(value).replaceAll('.', ''))
    }
    const eis = { jumlah: read('jumlah'), sesuai: read('sesuai'), tidak: read('tidak') }
    const rows = []
    if (eis.jumlah !== null) rows.push({ label: 'Jumlah', eis: eis.jumlah, local: local.jumlah })
    if (eis.sesuai !== null) rows.push({ label: 'Sesuai', eis: eis.sesuai, local: local.sesuai })
    if (eis.tidak !== null) rows.push({ label: 'Tidak', eis: eis.tidak, local: local.tidak })
    const differing = rows.filter(row => row.eis !== row.local)
    const blank = eis.jumlah === null && eis.sesuai === null && eis.tidak === null
    const behindMis = selectionMisTables.value.filter(t => t.state === 'behind').map(t => t.tabel)
    const allMisOk = selectionMisTables.value.length > 0 && selectionMisTables.value.every(t => t.state === 'ok' || t.state === 'known_bug')
    const localBetter = (eis.tidak !== null && local.tidak < eis.tidak) || (eis.sesuai !== null && local.sesuai > eis.sesuai)
    let misVerdict = null
    if (behindMis.length) {
        misVerdict = {
            tone: 'warn',
            text: `Tabel MIS (${behindMis.join(', ')}) masih tertinggal (Lokal > Badilum) — jalankan Sinkron Parsial di MIS.`
        }
    } else if (allMisOk && localBetter && differing.length) {
        misVerdict = {
            tone: 'info',
            text: 'Data SIPP lokal & MIS sudah hijau; angka resmi Badilum menunggu pembaruan periodik.'
        }
    }
    return {
        rows,
        belum: local.belum,
        misVerdict,
        verdict: blank ? 'EIS belum menilai indikator ini pada periode ini.'
            : !rows.length ? 'EIS tidak menampilkan angka pembanding untuk indikator ini.'
            : differing.length ? `${differing.length} angka berbeda dari EIS.`
            : 'Semua angka sama dengan EIS.'
    }
})
const basComparison = computed(() => {
    const context = result.value?.context
    if (context?.kind !== 'bas' || !selection.value) return null
    const counts = new Map(selection.value.metrics.map(metric => [metric.label.toLowerCase(), metric.value]))
    const value = counts.get('jumlah')
    const official = value && /^\d+(?:\.\d{3})*$/.test(value) ? Number(value.replaceAll('.', '')) : null
    if (official === null) return null
    const pdfNote = context.summary.nonPdf
        ? ` Format bukan PDF: ${context.summary.nonPdf} berkas BAS.`
        : context.summary.registered ? ' Format seluruh BAS terdaftar: PDF.' : ''
    return (official === context.summary.registered
        ? 'Jumlah sidang ber-BAS di lokal sama dengan Jumlah EIS. Angka Sesuai/Tidak butuh pemeriksaan berkas.'
        : `Jumlah sidang ber-BAS lokal ${context.summary.registered}, EIS ${official}.`) + pdfNote
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
    if (expected[0] === cohort.total && expected[1] === cohort.recorded && expected[2] === cohort.total - cohort.recorded) {
        return 'Jumlah dan rincian lokal cocok dengan EIS. Badilum tidak menampilkan identitas perkaranya.'
    }
    if (expected[0] === cohort.total && cohort.recorded > expected[1]) {
        return `Jumlah perkara cocok dengan EIS (${cohort.total}), dan di SIPP lokal sudah tercatat ${cohort.recorded}/${cohort.total} (${cohort.recorded === cohort.total ? 'sudah lengkap semua, ' : ''}tinggal menunggu sinkronisasi dari SIPP ke web EIS agar angka resmi ikut terbarui).`
    }
    return 'Jumlah pembanding lokal berbeda dari EIS. Angka resmi tetap menjadi acuan.'
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

async function loadScore(requestedPeriod, signal) {
    computedScore.value = null
    try {
        const data = await getEisScore(requestedPeriod, signal)
        if (period.value === requestedPeriod) computedScore.value = data
    } catch {
        if (period.value === requestedPeriod) computedScore.value = null
    }
}

async function loadTrend() {
    try {
        trendItems.value = await getEisTrend(new AbortController().signal)
    } catch {
        trendItems.value = []
    }
}

async function loadMisStatus() {
    if (misBusy.value) return
    misBusy.value = true
    try {
        misStatus.value = await getMisStatus(new AbortController().signal)
    } catch (error) {
        misStatus.value = { status: 'unavailable', error: error.message, tables: [] }
    } finally {
        misBusy.value = false
    }
}

async function loadPrevMonthComparison(requestedPeriod, signal) {
    prevOfficial.value = null
    prevComputedScore.value = null
    const prev = previousPeriodOf(requestedPeriod)
    if (!prev) return
    try {
        const [prevData, prevScore] = await Promise.all([
            getOfficialEis(prev, false, signal),
            getEisScore(prev, signal).catch(() => null)
        ])
        if (period.value === requestedPeriod) {
            prevOfficial.value = prevData
            prevComputedScore.value = prevScore
        }
    } catch {
        // Silent fallback if previous month is not cached
    }
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
        void loadScore(requestedPeriod, controller.signal)
        void loadPrevMonthComparison(requestedPeriod, controller.signal)
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
        calc: calcText(row.label),
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

watch([period, active], () => {
    const query = { ...route.query }
    if (period.value) query.period = period.value
    if (active.value) query.tab = active.value
    router.replace({ query })
})
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
    void loadTrend()
    void loadMisStatus()
    snapshotPoll = window.setInterval(pollSnapshot, snapshotPollInterval)
    document.addEventListener('visibilitychange', pollSnapshot)
})
onBeforeUnmount(() => {
    if (scoreAnimFrame) cancelAnimationFrame(scoreAnimFrame)
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
            <div class="eis-hero-top">
                <div class="eis-hero-copy">
                    <h1 id="eis-heading">Monitoring EIS</h1>
                    <p class="eis-hero-sub">Evaluasi Implementasi SIPP <span aria-hidden="true">·</span> Pengadilan Negeri Natuna <span aria-hidden="true">·</span> PT Kepulauan Riau</p>
                </div>
                <div v-if="totalScoreText" class="eis-score">
                    <div class="eis-score-ring" aria-hidden="true">
                        <svg viewBox="0 0 64 64">
                            <circle class="eis-ring-track" cx="32" cy="32" r="26" />
                            <circle class="eis-ring-fill" cx="32" cy="32" r="26" :stroke-dasharray="scoreRingDash" />
                        </svg>
                    </div>
                    <div class="eis-score-meta">
                        <span class="eis-score-label">Implementasi SIPP <span aria-hidden="true">·</span> {{ periodLabel }}</span>
                        <strong class="eis-score-value">{{ totalScoreText }}</strong>
                        <div class="eis-score-subline">
                            <span v-if="prevMonthDelta" class="eis-score-mom" :data-trend="prevMonthDelta.value > 0 ? 'up' : prevMonthDelta.value < 0 ? 'down' : 'flat'">
                                {{ prevMonthDelta.text }}
                            </span>
                            <span v-if="scoreDelta" class="eis-score-delta" :data-match="scoreDelta.value === 0">
                                {{ scoreDelta.value === 0 ? 'Cocok hitung ulang (0,00 pp)' : `Hitung ulang ${scoreDelta.text} pp vs EIS` }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            <nav v-if="snapshot" class="eis-pillars" aria-label="Ringkasan nilai per aspek">
                <button v-for="(item, idx) in aspectSummaries" :key="item.id" type="button" class="eis-pillar"
                    :class="{ 'is-active': active === item.id }" :aria-pressed="active === item.id" @click="active = item.id">
                    <div class="eis-pillar-inner">
                        <div class="eis-pillar-head">
                            <span class="eis-pillar-name">{{ item.label }}</span>
                            <span v-if="item.issueRows" class="eis-pillar-issue">{{ item.issueRows }} ‘Tidak’</span>
                        </div>
                        <strong class="eis-pillar-pct">{{ item.pctText }}</strong>
                        <span v-if="item.pointsText || item.prevDelta" class="eis-pillar-pts">
                            <span v-if="item.pointsText" class="eis-pillar-ratio">{{ item.pointsText }} poin</span>
                            <span v-if="item.prevDelta" class="eis-pillar-mom" :data-trend="item.prevDelta.value > 0 ? 'up' : item.prevDelta.value < 0 ? 'down' : 'flat'">{{ item.prevDelta.text }}</span>
                        </span>
                        <span class="eis-pillar-bar" aria-hidden="true"><span :style="{ transform: `scaleX(${Math.max(0, Math.min(1, parseFloat(item.pctWidth) / 100 || 0))})`, transitionDelay: `${idx * 45}ms` }"></span></span>
                    </div>
                </button>
            </nav>
        </header>

        <div class="eis-toolbar">
            <div class="eis-controls">
                <label for="eis-month">Periode (WIB)
                    <input id="eis-month" v-model="period" type="month" required>
                </label>
                <button type="button" class="eis-primary" :disabled="busy || !validPeriod" @click="loadOfficial(true)">
                    <span v-if="busy" class="eis-spinner" aria-hidden="true" />
                    {{ busy ? 'Memuat EIS…' : 'Muat ulang EIS' }}
                </button>
            </div>
            <div class="eis-source" role="status" :data-state="official?.status">
                <span class="eis-source-dot" aria-hidden="true" />
                <div class="eis-source-copy">
                    <strong>{{ !validPeriod ? 'Pilih satu bulan' : busy ? 'Memuat EIS Badilum…' : officialStatus[official?.status] }}</strong>
                    <span v-if="snapshot">Diambil dari Badilum · {{ formatTime(snapshot.fetchedAt) }}</span>
                    <span v-if="snapshot && (busy || official?.status !== 'ready')">Menampilkan snapshot terakhir.</span>
                </div>
            </div>
        </div>
        <Transition name="eis-reveal">
            <div v-if="versionAlert" class="eis-version-banner" role="status">
                <div class="eis-version-title">
                    <span class="eis-alert-pill">Versi SIPP</span>
                    <strong>{{ versionAlert.label }} bernilai 0 (−{{ formatLoss(versionAlert.lostPoints) }} poin<template v-if="versionAlert.totalImpactPp"> / −{{ formatLoss(versionAlert.totalImpactPp) }} pp total</template>)</strong>
                </div>
                <span class="eis-version-meta">Terpasang <code>{{ versionAlert.installed }}</code> · Rilis terbaru Badilum <code>{{ versionAlert.latest }}</code></span>
            </div>
        </Transition>

        <div class="eis-insight-strip" aria-label="Panel analisis EIS dan MIS">
            <button type="button" class="eis-insight-btn" :class="{ 'is-active': insightPanel === 'mis', 'is-alert': misIssueCount > 0 }" :aria-expanded="insightPanel === 'mis'" @click="toggleInsight('mis')">
                <span>Status MIS (102 tabel)</span>
                <strong v-if="misBusy">Memuat…</strong>
                <strong v-else-if="misStatus?.status === 'ready'">
                    {{ misIssueCount > 0 ? `${misIssueCount} selisih` : `${misStatus.summary.ok}/${misStatus.summary.total} Hijau` }}
                </strong>
                <strong v-else>Tidak terjangkau</strong>
            </button>
            <button type="button" class="eis-insight-btn" :class="{ 'is-active': insightPanel === 'whatif' }" :aria-expanded="insightPanel === 'whatif'" @click="toggleInsight('whatif')">
                <span>Simulasi Dampak Skor</span>
                <strong>{{ lostOpportunities.length }} peluang poin</strong>
            </button>
            <button type="button" class="eis-insight-btn" :class="{ 'is-active': insightPanel === 'trend' }" :aria-expanded="insightPanel === 'trend'" @click="toggleInsight('trend')">
                <span>Tren Bulanan</span>
                <strong>{{ trendItems.length }} bulan</strong>
            </button>
        </div>

        <Transition name="eis-reveal" mode="out-in">
            <section v-if="insightPanel === 'mis'" key="mis" class="eis-insight-card" aria-label="Status sinkronisasi MIS">
                <header class="eis-insight-head">
                    <div>
                        <h3>Status Sinkronisasi MIS (<code>192.168.1.2/mis</code>)</h3>
                        <p v-if="misStatus?.status === 'ready'">
                            {{ misStatus.summary.ok }}/{{ misStatus.summary.total }} hijau ·
                            {{ misStatus.summary.behind }} lokal &gt; Badilum ·
                            {{ misStatus.summary.excess }} Badilum &gt; lokal ·
                            {{ misStatus.summary.knownBug }} dikecualikan (bug MIS) ·
                            Remote: <strong>{{ misStatus.remoteStatus }}</strong>
                            <template v-if="misStatus.checkedAt"> · Dicek {{ formatTime(misStatus.checkedAt) }}</template>
                        </p>
                    </div>
                    <div class="eis-insight-actions">
                        <label v-if="misStatus?.tables?.length" class="eis-check-inline">
                            <input v-model="misShowAll" type="checkbox">
                            Tampilkan semua 102 tabel
                        </label>
                        <button type="button" class="eis-secondary" :disabled="misBusy" @click="loadMisStatus">
                            {{ misBusy ? 'Mengecek…' : 'Cek ulang MIS' }}
                        </button>
                    </div>
                </header>
                <div v-if="visibleMisTables.length" class="eis-table-scroll">
                    <table>
                        <thead>
                            <tr><th scope="col">Tabel MIS</th><th scope="col">Lokal</th><th scope="col">Badilum</th><th scope="col">Selisih</th><th scope="col">Status</th><th scope="col">Selesai</th></tr>
                        </thead>
                        <tbody>
                            <tr v-for="t in visibleMisTables" :key="t.tabel">
                                <th scope="row"><code>{{ t.tabel }}</code></th>
                                <td>{{ t.lokal.toLocaleString('id-ID') }}</td>
                                <td>{{ t.badilum.toLocaleString('id-ID') }}</td>
                                <td>{{ t.diff > 0 ? `+${t.diff.toLocaleString('id-ID')}` : t.diff.toLocaleString('id-ID') }}</td>
                                <td>
                                    <span class="eis-mis-badge" :data-state="t.state">
                                        {{ t.state === 'ok' ? 'Hijau' : t.state === 'behind' ? 'Perlu Sinkron Parsial' : t.state === 'excess' ? 'Badilum > Lokal' : 'Bug MIS (dilewati)' }}
                                    </span>
                                </td>
                                <td>{{ t.selesai || '—' }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p v-else-if="misStatus?.status === 'ready'" class="eis-provenance">Semua tabel aktif sudah sinkron (hijau).</p>
            </section>

            <section v-else-if="insightPanel === 'whatif'" key="whatif" class="eis-insight-card" aria-label="Simulasi dampak perbaikan indikator">
                <header class="eis-insight-head">
                    <div>
                        <h3>Simulasi Dampak Skor ("What-If")</h3>
                        <p v-if="simResult">
                            Skor sekarang <strong>{{ formatScoreNum(simResult.baseTotal) }}%</strong> →
                            Simulasi <strong>{{ formatScoreNum(simResult.simulatedTotal) }}%</strong>
                            <span v-if="simResult.deltaPp > 0" class="eis-sim-gain"> (+{{ formatLoss(simResult.deltaPp) }} pp)</span>
                        </p>
                    </div>
                    <div class="eis-insight-actions">
                        <button type="button" class="eis-secondary" @click="selectSimTop3">Pilih Top 3</button>
                        <button type="button" class="eis-secondary" :disabled="!selectedSimKeys.length" @click="selectedSimKeys = []">Reset</button>
                    </div>
                </header>
                <div v-if="lostOpportunities.length" class="eis-table-scroll">
                    <table>
                        <thead>
                            <tr><th scope="col">Simulasi</th><th scope="col">Indikator</th><th scope="col">Aspek</th><th scope="col">Poin hilang</th><th scope="col">Dampak total</th></tr>
                        </thead>
                        <tbody>
                            <tr v-for="item in lostOpportunities" :key="item.key">
                                <td><input type="checkbox" :checked="selectedSimKeys.includes(item.key)" :aria-label="`Simulasikan ${item.label}`" @change="toggleSimKey(item.key)"></td>
                                <th scope="row">
                                    <button type="button" class="eis-trend-jump" @click="active = item.tabId; insightPanel = ''">{{ item.label }}</button>
                                </th>
                                <td style="text-transform: capitalize">{{ item.tabId }}</td>
                                <td>−{{ formatLoss(item.lostPoints) }} ({{ formatLoss(item.points) }}/{{ formatLoss(item.denominator) }})</td>
                                <td><strong class="eis-sim-gain">+{{ formatLoss(item.totalImpactPp) }} pp</strong> <small>({{ formatScoreNum(item.aspectBefore) }}% → {{ formatScoreNum(item.aspectAfter) }}%)</small></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p v-else class="eis-provenance">Tidak ada kehilangan poin pada periode ini.</p>
            </section>

            <section v-else-if="insightPanel === 'trend'" key="trend" class="eis-insight-card" aria-label="Tren skor EIS bulanan">
                <header class="eis-insight-head">
                    <div>
                        <h3>Tren Skor EIS ({{ trendItems.length }} Bulan Tersimpan)</h3>
                        <p>Klik bulan pada grafik atau tabel untuk membuka snapshot periode tersebut.</p>
                    </div>
                </header>
                <EisTrendSection :items="trendItems" :active-period="period" @select-period="period = $event" />
            </section>
        </Transition>

        <p v-if="official?.error && !busy && official.status === 'unavailable'" class="eis-empty" role="status">{{ official.error }}</p>
        <p v-if="!snapshot && !busy && validPeriod" class="eis-empty">Belum ada angka resmi untuk periode ini.</p>
        <div role="tablist" aria-label="Aspek penilaian EIS" class="eis-tabs">
            <button v-for="(tab, index) in tabs" :id="`eis-tab-${tab.id}`" :key="tab.id" type="button" role="tab"
                :aria-selected="active === tab.id" :aria-controls="`eis-panel-${tab.id}`" :tabindex="active === tab.id ? 0 : -1"
                @click="active = tab.id" @keydown="handleTabKeys($event, index)">
                {{ tab.label }}<span v-if="tabUnaligned(tab.id)" class="eis-tab-unaligned" :data-parity="computedFor(tab.label)?.unalignedTier" :title="`${tabUnaligned(tab.id)} bagian belum sama persis`">{{ tabUnaligned(tab.id) }}</span>
            </button>
        </div>

        <section v-for="tab in tabs" v-show="active === tab.id" :id="`eis-panel-${tab.id}`" :key="tab.id"
            :aria-labelledby="`eis-tab-${tab.id}`" :aria-busy="busy" role="tabpanel" tabindex="0" class="eis-panel">
            <template v-if="active === tab.id && snapshot">
                <div class="eis-register-bar">
                    <div><h2>{{ tab.label }}</h2><span>{{ visibleRows.length }}{{ visibleRows.length !== rows.length ? ` / ${rows.length}` : '' }} {{ tab.id === 'konversi' ? 'ringkasan nilai' : 'indikator resmi' }}</span><strong v-if="tabPercent(tab.id)" class="eis-tab-score">{{ tabPercent(tab.id) }}</strong></div>
                    <div v-if="tab.id !== 'konversi'" class="eis-toolbar-switches">
                        <input v-model="indicatorQuery" type="search" class="eis-search-input" :aria-label="`Cari indikator di ${tab.label}`" placeholder="Cari indikator…">
                        <div class="eis-switch" role="group" aria-label="Filter indikator resmi">
                            <button type="button" :aria-pressed="filterMode === 'all'" @click="filterMode = 'all'">Semua</button>
                            <button type="button" :aria-pressed="filterMode === 'lost'" @click="filterMode = 'lost'">Poin hilang <span>{{ lostCount }}</span></button>
                            <button type="button" :aria-pressed="filterMode === 'issues'" @click="filterMode = 'issues'">Ada ‘Tidak’ <span>{{ issueCount }}</span></button>
                            <button type="button" class="eis-switch-unaligned" :aria-pressed="filterMode === 'unaligned'" @click="filterMode = 'unaligned'">Belum sama <span>{{ unalignedCount }}</span></button>
                        </div>
                        <button type="button" class="eis-sort-loss-btn" :aria-pressed="sortByLoss" @click="sortByLoss = !sortByLoss">
                            {{ sortByLoss ? 'Urutan: Poin hilang ↓' : 'Urutkan poin hilang' }}
                        </button>
                    </div>
                </div>
                <div v-if="tab.id === 'konversi' && rows.length" class="eis-register eis-conversion">
                    <table>
                        <thead><tr><th scope="col">Kategori</th><th scope="col">Nilai maksimal</th><th scope="col">Nilai satker</th><th scope="col">Konversi</th><th scope="col">Hitung ulang</th></tr></thead>
                        <tbody><tr v-for="row in rows.slice(0, -1)" :key="row.label">
                            <th scope="row">{{ row.label }}</th>
                            <td>{{ row.details[0]?.values[0] || '—' }}</td><td>{{ row.details[0]?.values[1] || '—' }}</td>
                            <td class="eis-conversion-value">{{ row.points ? percent(row.points) : '—' }}</td>
                            <td class="eis-conversion-check"><template v-if="computedFor(row.label)">{{ computedFor(row.label).konversi === null ? '—' : percent(String(computedFor(row.label).konversi)) }}<small>{{ computedFor(row.label).maks }} / {{ computedFor(row.label).peroleh }}</small></template><template v-else>—</template></td>
                        </tr></tbody>
                    </table>
                    <div class="eis-conversion-total"><span>Implementasi SIPP</span><strong>{{ implementationScore ? percent(implementationScore) : '—' }}<small v-if="computedScore"> · hitung ulang {{ computedScore.total === null ? '—' : percent(String(computedScore.total)) }}<template v-if="scoreDelta"> ({{ scoreDelta.text }} pp)</template></small></strong></div>
                </div>
                <TransitionGroup v-else-if="visibleRows.length" name="eis-row" tag="div" class="eis-register">
                    <article v-for="row in visibleRows" :key="row.label" class="eis-indicator"
                        :class="{ 'eis-indicator-issue': hasIssue(row), 'eis-indicator-lost': lostPointsFor(row.label) > 0, 'eis-indicator-unaligned': isUnaligned(tab.id, row) }" :data-parity="elementParity(tab.id, row.label)?.tier">
                        <header>
                            <div class="eis-indicator-name">
                                <h3>{{ row.label }}</h3>
                                <span class="eis-points">{{ formatPointsPill(row) }}</span>
                                <span v-if="lostPointsFor(row.label) > 0" class="eis-lost-points" title="Selisih bobot maksimal vs poin diperoleh">
                                    −{{ formatLoss(lostPointsFor(row.label)) }} poin
                                </span>
                                <span v-if="isSiteLevel(row)" class="eis-satker-badge">Tingkat Satker</span>
                                <span v-if="isUnaligned(tab.id, row)" class="eis-unaligned-badge" :data-parity="elementParity(tab.id, row.label)?.tier">
                                    {{ elementParity(tab.id, row.label)?.tier === 'warn' ? 'Mendekati' : 'Belum sama' }}<template v-if="(elementParity(tab.id, row.label)?.totalParts ?? 1) > 1"> · {{ elementParity(tab.id, row.label).unalignedCount }}/{{ elementParity(tab.id, row.label).totalParts }}</template>
                                </span>
                                <button
                                    v-if="!isSiteLevel(row) && firstAuditDetail(row)"
                                    type="button"
                                    class="eis-audit-btn"
                                    :disabled="busy"
                                    @click="openFindings($event, row, firstAuditDetail(row).detail, firstAuditDetail(row).index, firstAuditDetail(row).count)"
                                >
                                    Periksa lokal →
                                </button>
                            </div>
                            <p v-if="isUnaligned(tab.id, row) && (elementParity(tab.id, row.label)?.totalParts ?? 1) === 1" class="eis-unaligned-note">
                                {{ elementParity(tab.id, row.label).note }}
                            </p>
                            <details v-if="row.description && !row.details.some(detail => detail.label)" class="eis-indicator-rule">
                                <summary>Kriteria penilaian</summary><p>{{ row.description }}</p>
                            </details>
                        </header>
                        <div v-if="row.details.length" class="eis-measures">
                            <div v-for="(detail, index) in row.details" :key="index" class="eis-measure"
                                :class="{ 'eis-measure-unaligned': partParity(tab.id, row.label, index) && !partParity(tab.id, row.label, index).aligned }" :data-parity="partParity(tab.id, row.label, index)?.tier">
                                <p v-if="detail.label" class="eis-submeasure">
                                    {{ detail.label }}
                                    <span v-if="partParity(tab.id, row.label, index) && !partParity(tab.id, row.label, index).aligned" class="eis-unaligned-badge" :data-parity="partParity(tab.id, row.label, index)?.tier">
                                        {{ partParity(tab.id, row.label, index)?.tier === 'warn' ? 'Mendekati' : 'Belum sama' }} · {{ partParity(tab.id, row.label, index).note }}
                                    </span>
                                </p>
                                <dl><div v-for="(header, cell) in row.headers" :key="cell" :data-status="header.toLowerCase()">
                                    <dt>{{ header }}</dt>
                                    <dd>
                                        <button v-if="cellNumber(detail.values[cell]) !== null" type="button" class="eis-count"
                                            :class="{ 'eis-count-alert': officialCount(header, detail.values[cell]) > 0 }" :disabled="busy"
                                            :aria-label="`Periksa temuan lokal untuk ${row.label}${detail.label ? ` — ${detail.label}` : ''}; Tidak resmi: ${detail.values[cell] || 'belum dinilai'}`"
                                            @click="openFindings($event, row, detail, index, officialCount(header, detail.values[cell]))">{{ detail.values[cell] || '—' }}</button>
                                        <template v-else>{{ detail.values[cell] || '—' }}</template>
                                    </dd>
                                </div></dl>
                            </div>
                        </div>
                    </article>
                </TransitionGroup>
                <p v-else class="eis-empty">{{ indicatorQuery.trim() ? `Tidak ada indikator yang cocok dengan “${indicatorQuery.trim()}”.` : filterMode === 'lost' && rows.length ? 'Tidak ada indikator yang kehilangan poin di tab ini.' : filterMode === 'issues' && rows.length ? 'Tidak ada indikator dengan angka “Tidak” di tab ini.' : filterMode === 'unaligned' && rows.length ? 'Semua indikator di tab ini sudah sama persis dengan EIS.' : 'Belum ada indikator untuk tab ini.' }}</p>
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
                    <p v-if="selection.calc" class="eis-provenance">Hitungan: {{ selection.calc }}</p>
                    <p class="eis-provenance">Badilum tidak menampilkan batas waktu data atau daftar perkara yang dinilai.</p>
                    <details v-if="selection.description" class="eis-indicator-rule">
                        <summary>Kriteria penilaian</summary><p>{{ selection.description }}</p>
                    </details>
                </section>
                <section v-if="selectionMisTables.length" class="eis-mis-drawer-box" aria-label="Status tabel MIS terkait">
                    <strong>Status Tabel MIS Terkait</strong>
                    <ul>
                        <li v-for="t in selectionMisTables" :key="t.tabel">
                            <code>{{ t.tabel }}</code>: Lokal {{ t.lokal.toLocaleString('id-ID') }} vs Badilum {{ t.badilum.toLocaleString('id-ID') }}
                            <span class="eis-mis-badge" :data-state="t.state">
                                {{ t.state === 'ok' ? 'Hijau' : t.state === 'behind' ? 'Perlu Sinkron Parsial' : t.state === 'excess' ? 'Badilum > Lokal' : 'Bug MIS' }}
                            </span>
                        </li>
                    </ul>
                </section>
                <section v-if="localCompare" aria-labelledby="eis-compare-title" class="eis-compare">
                    <div class="eis-section-heading"><h3 id="eis-compare-title">Perbandingan angka</h3></div>
                    <table v-if="localCompare.rows.length">
                        <thead><tr><th scope="col">Angka</th><th scope="col">EIS</th><th scope="col">SIPP lokal</th><th scope="col">Selisih</th></tr></thead>
                        <tbody><tr v-for="line in localCompare.rows" :key="line.label">
                            <th scope="row">{{ line.label }}</th>
                            <td>{{ line.eis }}</td>
                            <td>{{ line.local }}</td>
                            <td :data-diff="line.local - line.eis !== 0">{{ line.local - line.eis === 0 ? 'sama' : (line.local - line.eis > 0 ? '+' : '') + (line.local - line.eis) }}</td>
                        </tr></tbody>
                    </table>
                    <p class="eis-provenance">{{ localCompare.verdict }}<template v-if="localCompare.belum"> · {{ localCompare.belum }} catatan belum dapat dinilai.</template></p>
                    <p v-if="localCompare.misVerdict" class="eis-mis-verdict" :data-tone="localCompare.misVerdict.tone" role="status">{{ localCompare.misVerdict.text }}</p>
                </section>
                <div class="eis-local-bar">
                    <h3>Pemeriksaan SIPP lokal</h3>
                    <span v-if="localContext?.checkedAt">Diperiksa {{ formatTime(localContext.checkedAt) }}</span>
                </div>
                <p v-if="checking" role="status">Memeriksa data SIPP lokal…</p>
                <EisComplianceList v-else-if="localContext?.kind === 'compliance'" :audit="localContext" :return-context="{ from: 'eis', period, tab: active }" />
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
                    <p v-if="localContext.kind === 'bas' && localContext.summary?.nonPdf" class="eis-bas-nonpdf" role="status">
                        Format non-PDF: <strong>{{ localContext.summary.nonPdf }}</strong> berkas BAS yang diunggah bukan PDF.
                    </p>
                    <EisScheduleList :kind="localContext.kind" :checked-at="localContext.checkedAt"
                        :return-context="{ from: 'eis', period, tab: active }"
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
                                    <RouterLink v-if="row.id" :to="{ name: 'Data', query: { perkara: row.id, from: 'eis', period, tab: active } }">{{ row.nomorPerkara }}</RouterLink>
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
                                <th scope="row"><RouterLink :to="{ name: 'Data', query: { perkara: hearing.id, from: 'eis', period, tab: active } }">{{ hearing.nomorPerkara }}</RouterLink></th>
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
                            <RouterLink v-if="Number.isSafeInteger(finding.id) && finding.id > 0" :to="{ name: 'Data', query: { perkara: finding.id, from: 'eis', period, tab: active } }">
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
.eis-tab-score { font-size: .95rem; font-weight: 700; color: var(--accent); letter-spacing: -.01em; }
.eis-score-mom { font-size: .78rem; font-weight: 700; color: var(--text-2); white-space: nowrap; }
.eis-score-mom[data-trend='up'], .eis-pillar-mom[data-trend='up'] { color: var(--success); }
.eis-score-mom[data-trend='down'], .eis-pillar-mom[data-trend='down'] { color: var(--danger); }
.eis-score-mom[data-trend='flat'], .eis-pillar-mom[data-trend='flat'] { color: var(--text-3); font-weight: 500; }
/* Version banner (full border + pill, no side stripe) */
.eis-version-banner { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .5rem 1rem; padding: .75rem 1.05rem; border: 1px solid color-mix(in srgb, var(--warn) 42%, transparent); border-radius: 12px; background: color-mix(in srgb, var(--warn-soft) 75%, var(--bg2)); color: var(--text); font-size: .86rem; }
.eis-version-title { display: flex; flex-wrap: wrap; align-items: center; gap: .55rem; }
.eis-alert-pill { display: inline-flex; align-items: center; padding: .15rem .5rem; border-radius: 999px; background: var(--warn); color: #16120b; font-size: .71rem; font-weight: 800; letter-spacing: .02em; text-transform: uppercase; }
.eis-version-meta { color: var(--text-2); font-size: .82rem; }
.eis-version-banner code { font-family: var(--font-mono, ui-monospace, monospace); font-weight: 700; color: var(--warn); }

/* Insight strip & collapsible cards */
.eis-insight-strip { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .65rem; }
.eis-insight-btn { display: flex; align-items: center; justify-content: space-between; gap: .5rem; padding: .68rem .95rem; border: 1px solid var(--border); border-radius: 12px; background: var(--bg2); color: var(--text-2); font: inherit; font-size: .83rem; font-weight: 550; text-align: start; transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease, transform 120ms ease; }
.eis-insight-btn:hover { border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); background: var(--surface-2); color: var(--text); }
.eis-insight-btn:active { transform: scale(0.99); }
.eis-insight-btn strong { color: var(--text); font-variant-numeric: tabular-nums; font-weight: 750; }
.eis-insight-btn.is-active { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
.eis-insight-btn.is-active strong { color: var(--accent); }
.eis-insight-btn.is-alert strong { color: var(--danger); }
.eis-insight-card { display: grid; gap: .8rem; padding: 1rem 1.15rem; border: 1px solid var(--border); border-radius: 14px; background: var(--bg2); }
.eis-insight-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .6rem 1rem; }
.eis-insight-head h3 { font-size: 1rem; }
.eis-insight-head p { margin-top: .25rem; color: var(--text-2); font-size: .83rem; line-height: 1.5; }
.eis-insight-actions { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; }
.eis-check-inline { display: inline-flex; align-items: center; gap: .35rem; font-size: .82rem; color: var(--text-2); }
.eis-mis-badge { display: inline-block; padding: .12rem .45rem; border-radius: 6px; font-size: .73rem; font-weight: 700; background: var(--bg3); color: var(--text-2); }
.eis-mis-badge[data-state='ok'] { background: var(--success-soft); color: var(--success); }
.eis-mis-badge[data-state='behind'], .eis-mis-badge[data-state='excess'] { background: var(--danger-soft); color: var(--danger); }
.eis-mis-badge[data-state='known_bug'] { background: var(--warn-soft); color: var(--warn); }
.eis-sim-gain { color: var(--success); font-weight: 700; }
.eis-trend-jump { border: 0; padding: 0; background: none; color: var(--accent); font: inherit; font-weight: 650; text-align: start; cursor: pointer; text-decoration: underline; text-underline-offset: .16em; }
.eis-mis-drawer-box { display: grid; gap: .4rem; padding: .7rem .85rem; border: 1px solid var(--border); border-radius: 10px; background: var(--bg3); font-size: .82rem; }
.eis-mis-drawer-box ul { margin: 0; padding-left: 1.15rem; display: grid; gap: .3rem; }

/* Toolbar & source status pill */
.eis-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .75rem 1.25rem; }
.eis-controls { display: flex; flex-wrap: wrap; align-items: end; gap: .6rem; }
.eis-controls label { display: grid; gap: .22rem; font-size: .8rem; font-weight: 650; color: var(--text-2); }
.eis-controls input, .eis-primary, .eis-secondary { min-height: 2.55rem; padding: .42rem .8rem; border: 1px solid var(--border); border-radius: 9px; background: var(--bg2); color: var(--text); font: inherit; transition: border-color 150ms ease, background-color 150ms ease, transform 120ms ease; }
.eis-primary { display: inline-flex; align-items: center; gap: .45rem; background: var(--accent); color: var(--text-tooltip); border-color: var(--accent); font-size: .87rem; font-weight: 700; }
.eis-primary:hover:not(:disabled) { filter: brightness(1.06); }
.eis-primary:active:not(:disabled), .eis-secondary:active:not(:disabled) { transform: scale(0.98); }
.eis-spinner { width: 14px; height: 14px; border: 2px solid color-mix(in srgb, var(--text-tooltip) 30%, transparent); border-top-color: var(--text-tooltip); border-radius: 50%; animation: eis-spin 700ms linear infinite; }
@keyframes eis-spin { to { transform: rotate(360deg); } }
.eis-source { display: flex; align-items: center; gap: .6rem; padding: .55rem .9rem; border: 1px solid var(--border); border-radius: 10px; background: var(--bg2); font-size: .82rem; }
.eis-source-dot { width: 8px; height: 8px; flex: none; border-radius: 50%; background: var(--success); box-shadow: 0 0 8px color-mix(in srgb, var(--success) 55%, transparent); }
.eis-source[data-state='unavailable'] .eis-source-dot { background: var(--danger); box-shadow: 0 0 8px color-mix(in srgb, var(--danger) 55%, transparent); }
.eis-source-copy { display: grid; gap: .08rem; }
.eis-source-copy span { color: var(--text-2); font-size: .78rem; }

/* Indicators list & readability */
.eis-toolbar-switches { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; }
.eis-search-input { min-height: 2.05rem; width: 11.5rem; padding: .28rem .65rem; border: 1px solid var(--border); border-radius: 8px; background: var(--bg2); color: var(--text); font: inherit; font-size: .8rem; transition: border-color 150ms ease, width 180ms ease; }
.eis-search-input::placeholder { color: var(--text-3); }
.eis-search-input:focus { border-color: var(--accent); outline: none; width: 13.5rem; }
.eis-sort-loss-btn { padding: .34rem .7rem; border: 1px solid var(--border); border-radius: 8px; background: var(--bg2); color: var(--text-2); font: inherit; font-size: .8rem; font-weight: 600; transition: all 150ms ease; }
.eis-sort-loss-btn[aria-pressed='true'] { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); font-weight: 700; }
.eis-lost-points { display: inline-block; flex: none; background: var(--danger-soft); color: var(--danger); border: 1px solid color-mix(in srgb, var(--danger) 35%, transparent); border-radius: 6px; padding: .14rem .45rem; font-size: .74rem; font-weight: 750; white-space: nowrap; font-variant-numeric: tabular-nums; }
.eis-satker-badge { display: inline-block; flex: none; padding: .14rem .45rem; border-radius: 6px; background: var(--bg3); border: 1px solid var(--border); color: var(--text-2); font-size: .72rem; font-weight: 600; white-space: nowrap; }
.eis-audit-btn { display: inline-flex; align-items: center; padding: .16rem .52rem; border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--border)); border-radius: 6px; background: var(--accent-soft); color: var(--accent); font: inherit; font-size: .73rem; font-weight: 700; white-space: nowrap; transition: background-color 140ms ease, border-color 140ms ease, transform 120ms ease; }
.eis-audit-btn:hover:not(:disabled) { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 22%, var(--bg2)); transform: translateY(-1px); }
.eis-audit-btn:active:not(:disabled) { transform: scale(0.97); }
.eis-mis-verdict { margin-top: .45rem !important; padding: .48rem .68rem; border-radius: 8px; font-size: .8rem; font-weight: 600; border: 1px solid var(--border); }
.eis-mis-verdict[data-tone='warn'] { background: var(--warn-soft); border-color: color-mix(in srgb, var(--warn) 45%, transparent); color: var(--warn); }
.eis-mis-verdict[data-tone='info'] { background: var(--accent-soft); border-color: color-mix(in srgb, var(--accent) 40%, transparent); color: var(--text); }
.eis-compare table { width: 100%; border-collapse: collapse; font-size: .84rem; }
.eis-compare th, .eis-compare td { padding: .36rem .45rem; border-bottom: 1px solid var(--border); text-align: start; }
.eis-compare td[data-diff='true'] { color: var(--danger); font-weight: 700; }
.eis-tab-unaligned { display: inline-flex; align-items: center; justify-content: center; min-width: 1.25rem; height: 1.25rem; margin-inline-start: .38rem; padding-inline: .32rem; border-radius: 999px; background: var(--danger-soft); color: var(--danger); font-size: .71rem; font-weight: 750; }
.eis-switch-unaligned { color: var(--danger) !important; }
.eis-switch-unaligned[aria-pressed='true'] { border-color: var(--danger) !important; background: var(--danger-soft) !important; }
.eis-unaligned-badge { display: inline-block; padding: .14rem .45rem; border: 1px solid color-mix(in srgb, var(--danger) 40%, transparent); border-radius: 6px; background: var(--danger-soft); color: var(--danger); font-size: .73rem; font-weight: 750; }
.eis-unaligned-note { margin-top: .28rem !important; color: var(--danger); font-size: .79rem; font-weight: 600; line-height: 1.45; }
.eis-tab-unaligned[data-parity='warn'] { background: var(--warn-soft); color: var(--warn); }
.eis-unaligned-badge[data-parity='warn'] { border-color: color-mix(in srgb, var(--warn) 45%, transparent); background: var(--warn-soft); color: var(--warn); }
.eis-indicator-unaligned[data-parity='warn'] .eis-unaligned-note { color: var(--warn); }
.eis-bas-nonpdf { margin: 0; padding: .55rem .75rem; border: 1px solid color-mix(in srgb, var(--warn) 45%, transparent); border-radius: 8px; background: var(--warn-soft); color: var(--warn); font-size: .82rem; font-weight: 600; }

.eis-page { display: grid; gap: 1.1rem; width: 100%; max-width: 1240px; min-width: 0; margin-inline: auto; color: var(--text); }
.eis-page :is(h1, h2, h3, h4, p, dl, dd) { margin: 0; }
.eis-page :is(button, input, summary):focus-visible, .eis-page a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.eis-page button:not(:disabled), .eis-page summary { cursor: pointer; }
.eis-page button:disabled { opacity: .65; }

/* Hero & Score Ring */
.eis-hero { display: grid; border: 1px solid var(--border); border-radius: 16px; background: var(--bg2); overflow: hidden; }
.eis-hero-top { display: flex; justify-content: space-between; align-items: center; gap: 1rem 1.5rem; flex-wrap: wrap; padding: 1.2rem 1.45rem; }
.eis-hero-copy { display: grid; gap: .25rem; min-width: 0; }
.eis-hero-copy h1 { font-size: 1.55rem; font-weight: 750; letter-spacing: -.02em; line-height: 1.18; }
.eis-hero-sub, .eis-subtitle { color: var(--text-2); font-size: .86rem; }
.eis-score { display: flex; align-items: center; gap: .95rem; flex: none; padding-inline-start: 1.35rem; border-inline-start: 1px solid var(--border); }
.eis-score-ring { width: 64px; height: 64px; flex: none; }
.eis-score-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.eis-ring-track { fill: none; stroke: color-mix(in srgb, var(--border) 90%, transparent); stroke-width: 5.5; }
.eis-ring-fill { fill: none; stroke: var(--accent); stroke-width: 5.5; stroke-linecap: round; transition: stroke-dasharray 520ms cubic-bezier(0.16, 1, 0.3, 1); }
.eis-score-meta { display: grid; justify-items: end; text-align: end; gap: .12rem; }
.eis-score-label { color: var(--text-2); font-size: .79rem; font-weight: 600; }
.eis-score-value { line-height: 1.05; font-size: 2.05rem; font-weight: 800; color: var(--accent); font-variant-numeric: tabular-nums; white-space: nowrap; }
.eis-score-subline { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: .25rem .65rem; }
.eis-score-delta { font-size: .76rem; color: var(--text-2); font-weight: 600; }
.eis-score-delta[data-match='true'] { color: var(--success); }

/* Pillars with inner-child hover & scaleX fill motion */
.eis-pillars { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-top: 1px solid var(--border); background: color-mix(in srgb, var(--bg3) 55%, var(--bg2)); }
.eis-pillar { position: relative; padding: 0; border: 0; background: transparent; color: var(--text); font: inherit; text-align: start; transition: background-color 180ms ease, box-shadow 180ms ease; }
.eis-pillar + .eis-pillar { border-inline-start: 1px solid var(--border); }
.eis-pillar-inner { display: grid; gap: .24rem; padding: .9rem 1.15rem; transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1); }
.eis-pillar:hover { background: color-mix(in srgb, var(--accent) 5%, transparent); }
.eis-pillar:hover .eis-pillar-inner { transform: translateY(-2px); }
.eis-pillar.is-active { background: color-mix(in srgb, var(--accent) 9%, transparent); box-shadow: inset 0 2.5px 0 var(--accent); }
.eis-pillar-head { display: flex; align-items: center; justify-content: space-between; gap: .4rem; }
.eis-pillar-name { font-size: .8rem; font-weight: 650; color: var(--text-2); }
.eis-pillar.is-active .eis-pillar-name { color: var(--accent); }
.eis-pillar-issue { padding: .1rem .4rem; border-radius: 5px; background: var(--danger-soft); color: var(--danger); font-size: .71rem; font-weight: 700; white-space: nowrap; }
.eis-pillar-pct { font-size: 1.32rem; font-weight: 800; line-height: 1.2; font-variant-numeric: tabular-nums; color: var(--text); }
.eis-pillar-pts { display: flex; flex-wrap: wrap; align-items: center; gap: .15rem .45rem; font-size: .76rem; color: var(--text-2); font-variant-numeric: tabular-nums; }
.eis-pillar-ratio { white-space: nowrap; }
.eis-pillar-mom { white-space: nowrap; font-weight: 700; }
.eis-pillar-bar { height: 3px; margin-top: .28rem; border-radius: 999px; background: color-mix(in srgb, var(--border) 85%, transparent); overflow: hidden; }
.eis-pillar-bar > span { display: block; width: 100%; height: 100%; border-radius: inherit; background: var(--accent); transform-origin: left center; transition: transform 480ms cubic-bezier(0.16, 1, 0.3, 1); }

/* Tabs */
.eis-tabs { display: flex; gap: .2rem; overflow: auto; border-bottom: 1px solid var(--border); scrollbar-width: thin; }
.eis-tabs button { flex: 0 0 auto; padding: .65rem clamp(.65rem, 2vw, 1.15rem); border: 0; border-bottom: 3px solid transparent; background: transparent; color: var(--text-2); font: inherit; font-size: .9rem; font-weight: 600; transition: color 150ms ease, border-color 180ms ease; }
.eis-tabs button:hover { color: var(--text); }
.eis-tabs button[aria-selected='true'] { border-color: var(--accent); color: var(--accent); font-weight: 750; }
.eis-panel { min-width: 0; animation: eis-panel-in 200ms cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes eis-panel-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

.eis-register-bar, .eis-local-bar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: .5rem .8rem; }
.eis-register-bar { margin-bottom: .75rem; }
.eis-register-bar > div:first-child { display: flex; align-items: baseline; gap: .6rem; }
.eis-register-bar h2 { font-size: 1.26rem; letter-spacing: -.02em; }
.eis-register-bar span, .eis-local-bar span { color: var(--text-2); font-size: .82rem; }
.eis-switch { display: flex; padding: .2rem; gap: .15rem; background: var(--bg3); border: 1px solid var(--border); border-radius: 9px; }
.eis-switch button { background: transparent; color: var(--text-2); padding: .28rem .62rem; border: 1px solid transparent; border-radius: 7px; font: inherit; font-size: .8rem; transition: all 140ms ease; }
.eis-switch button[aria-pressed='true'] { background: var(--bg2); color: var(--text); border-color: var(--border); font-weight: 700; }
.eis-switch button span { color: inherit; margin-left: .18rem; font-weight: 700; }

/* Indicator cards list */
.eis-register { position: relative; border: 1px solid var(--border); border-radius: 14px; background: var(--bg2); overflow: hidden; }
.eis-indicator { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); align-items: center; gap: .65rem 1.4rem; padding: .95rem 1.15rem; transition: background-color 160ms ease; }
.eis-indicator + .eis-indicator { border-top: 1px solid var(--border); }
.eis-indicator:hover { background: color-mix(in srgb, var(--surface-2) 60%, transparent); }
.eis-indicator-lost { background: color-mix(in srgb, var(--warn-soft) 28%, transparent); }
.eis-indicator-issue { background: color-mix(in srgb, var(--danger-soft) 32%, transparent); }
.eis-indicator-unaligned { background: color-mix(in srgb, var(--danger-soft) 22%, transparent); }
.eis-indicator-unaligned[data-parity='warn'] { background: color-mix(in srgb, var(--warn-soft) 24%, transparent); }
.eis-indicator-name { display: flex; align-items: center; gap: .4rem .55rem; flex-wrap: wrap; }
.eis-indicator-name h3 { font-size: .97rem; font-weight: 700; line-height: 1.32; color: var(--text); }
.eis-indicator-rule, .eis-method { color: var(--text-2); font-size: .81rem; line-height: 1.5; }
.eis-indicator-rule { margin-top: .35rem; }
.eis-indicator-rule p, .eis-method p { margin-top: .35rem; white-space: pre-line; max-width: 66ch; line-height: 1.55; }
.eis-points { display: inline-block; flex: none; background: var(--accent-soft); color: var(--accent); border-radius: 6px; padding: .14rem .46rem; font-size: .74rem; font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; }
.eis-measures { display: grid; gap: .45rem; min-width: 0; }
.eis-measure + .eis-measure { padding-top: .48rem; border-top: 1px solid var(--border); }
.eis-measure dl { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: .55rem; margin: 0; }
.eis-measure dl > div { display: grid; gap: .2rem; padding: .42rem .58rem; border-radius: 8px; background: color-mix(in srgb, var(--bg3) 70%, transparent); border: 1px solid color-mix(in srgb, var(--border) 60%, transparent); }
.eis-measure dt { font-size: .72rem; font-weight: 600; color: var(--text-2); letter-spacing: .02em; overflow-wrap: anywhere; }
.eis-measure dd { display: flex; align-items: center; min-height: 1.85rem; font-size: 1.02rem; font-weight: 750; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.eis-measure [data-status='sesuai'] dd { color: var(--success); }
.eis-submeasure { color: var(--text-2); font-size: .8rem; font-weight: 600; margin-bottom: .35rem !important; }
.eis-conversion-value { font-weight: 750; color: var(--accent); }
.eis-conversion-total { display: flex; justify-content: space-between; gap: .6rem; padding: .85rem 1rem; background: var(--accent-soft); color: var(--accent); font-weight: 700; }
.eis-table-scroll { overflow: auto; max-width: 100%; scrollbar-width: thin; }
.eis-page table { border-collapse: collapse; width: 100%; font-size: .85rem; }
.eis-page th, .eis-page td { padding: .55rem .65rem; border-bottom: 1px solid var(--border); text-align: start; }
.eis-page thead th { background: var(--bg3); color: var(--text-2); font-size: .75rem; font-weight: 700; }
.eis-page tbody tr:last-child > * { border-bottom: 0; }

/* Count button cells */
.eis-count { display: inline-flex; align-items: center; justify-content: center; min-width: 2.35rem; min-height: 1.95rem; padding: .15rem .55rem; border: 1px solid var(--border); border-radius: 7px; background: var(--bg2); color: var(--text); font: inherit; font-size: .95rem; font-weight: 750; font-variant-numeric: tabular-nums; transition: border-color 140ms ease, background-color 140ms ease, transform 120ms ease, box-shadow 140ms ease; }
.eis-count:hover:not(:disabled) { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); transform: translateY(-1px); }
.eis-count:active:not(:disabled) { transform: scale(0.96); }
.eis-count-alert { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 42%, var(--border)); background: var(--danger-soft); }
.eis-count-alert:hover:not(:disabled) { border-color: var(--danger); background: color-mix(in srgb, var(--danger) 24%, var(--bg2)); color: var(--danger); }
.eis-empty { padding: 1rem; border: 1px solid var(--border); border-radius: 10px; background: var(--bg2); }

/* Drawer with entrance motion */
.eis-drawer { position: fixed; inset: 0; margin: auto; width: min(58rem, calc(100% - 2rem)); max-width: none; max-height: calc(100dvh - 2rem); padding: 0; border: 1px solid var(--border); border-radius: 16px; background: var(--bg2); color: var(--text); box-shadow: 0 24px 80px rgb(0 0 0 / .42); overflow: auto; overscroll-behavior: contain; opacity: 0; transform: translateY(10px) scale(0.985); transition: opacity 220ms cubic-bezier(0.16, 1, 0.3, 1), transform 220ms cubic-bezier(0.16, 1, 0.3, 1), overlay 220ms allow-discrete, display 220ms allow-discrete; }
.eis-drawer[open] { opacity: 1; transform: translateY(0) scale(1); }
@starting-style { .eis-drawer[open] { opacity: 0; transform: translateY(10px) scale(0.985); } }
.eis-drawer::backdrop { background: rgb(0 0 0 / .62); backdrop-filter: blur(3px); }
.eis-drawer-header { position: sticky; top: 0; z-index: 1; display: flex; align-items: flex-start; justify-content: space-between; gap: .7rem; padding: 1.05rem clamp(1rem, 3vw, 1.5rem); border-bottom: 1px solid var(--border); background: var(--bg2); }
.eis-drawer-header h2 { margin-top: .2rem; font-size: clamp(1.15rem, 3vw, 1.6rem); line-height: 1.24; }
.eis-drawer-body { display: grid; gap: .95rem; padding: 1.05rem clamp(1rem, 3vw, 1.5rem) 1.5rem; }
.eis-section-heading { display: flex; justify-content: space-between; align-items: center; gap: .5rem; margin-bottom: .55rem; }
.eis-section-heading h3, .eis-local-bar h3 { font-size: 1rem; }
.eis-local-bar { padding-top: .75rem; border-top: 1px solid var(--border); }
.eis-drawer .eis-provenance { margin-top: .4rem; color: var(--text-2); font-size: .82rem; line-height: 1.48; }
.eis-method { margin-top: .55rem; }
.eis-comparison { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(5rem, 100%), 1fr)); gap: .6rem; }
.eis-comparison div { min-width: 0; padding: .68rem .85rem; border: 1px solid var(--border); border-radius: 10px; background: var(--bg3); }
.eis-comparison dt { color: var(--text-2); font-size: .8rem; }
.eis-comparison dd { font-size: clamp(1.35rem, 4vw, 1.85rem); font-weight: 800; line-height: 1.2; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.eis-comparison [data-status='sesuai'] dd { color: var(--success); }
.eis-comparison [data-status='tidak'] dd { color: var(--danger); }
.eis-drawer-body [role='status'], .eis-hearing-context > p { color: var(--text-2); font-size: .86rem; line-height: 1.5; }
.eis-times { display: flex; flex-wrap: wrap; gap: .45rem 1.1rem; font-size: .8rem; }
.eis-drawer-body .eis-times { margin-top: .45rem; }
.eis-times dt { color: var(--text-2); }
.eis-times dd { font-weight: 650; }
.eis-mismatch { margin-top: .35rem !important; color: var(--text); font-weight: 650; }
.eis-hearing-context h4 { font-size: .95rem; }
.eis-hearing-context .eis-table-scroll { margin-top: .55rem; border: 1px solid var(--border); border-radius: 10px; }
.eis-hearing-context small { display: block; margin-top: .12rem; color: var(--text-2); font-size: .77rem; }
.eis-hearing-context a, .eis-evidence a { color: var(--accent); text-underline-offset: .16em; }
.eis-raw-entries { padding: .7rem .85rem; border: 1px solid var(--border); border-radius: 10px; background: var(--bg3); }
.eis-raw-entries summary { font-weight: 700; font-size: .88rem; }
.eis-raw-entries summary span { display: block; color: var(--text-2); font-weight: 450; }
.eis-raw-entries[open] summary { margin-bottom: .6rem; }
.eis-findings { list-style: none; margin: 0; padding: 0; }
.eis-findings li { border: 1px solid var(--border); border-radius: 10px; margin-bottom: .5rem; overflow: hidden; }
.eis-evidence-btn { display: flex; justify-content: space-between; width: 100%; padding: .7rem .8rem; border: 0; background: var(--bg3); color: var(--text); font: inherit; font-weight: 650; text-align: start; transition: background-color 140ms ease; }
.eis-evidence-btn:hover { background: var(--surface-2); }
.eis-evidence { padding: .75rem .8rem; }
.eis-sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

/* Vue Transitions: Insight reveal & FLIP row reorder */
.eis-reveal-enter-active { transition: opacity 200ms cubic-bezier(0.16, 1, 0.3, 1), transform 200ms cubic-bezier(0.16, 1, 0.3, 1); }
.eis-reveal-leave-active { transition: opacity 110ms ease, transform 110ms ease; }
.eis-reveal-enter-from { opacity: 0.35; transform: translateY(-4px); }
.eis-reveal-leave-to { opacity: 0; transform: translateY(-4px); }
.eis-row-move { transition: transform 320ms cubic-bezier(0.16, 1, 0.3, 1); }
.eis-row-enter-active { transition: opacity 200ms cubic-bezier(0.16, 1, 0.3, 1), transform 200ms cubic-bezier(0.16, 1, 0.3, 1); }
.eis-row-leave-active { transition: opacity 120ms ease; }
.eis-row-enter-from, .eis-row-leave-to { opacity: 0; transform: translateY(4px); }

@media (max-width: 830px) {
    .eis-pillars { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .eis-pillar + .eis-pillar { border-inline-start: 0; }
    .eis-pillar:nth-child(even) { border-inline-start: 1px solid var(--border); }
    .eis-pillar:nth-child(n+3) { border-top: 1px solid var(--border); }
    .eis-insight-strip { grid-template-columns: 1fr; }
    .eis-indicator { grid-template-columns: minmax(0, 1fr); gap: .7rem; }
}
@media (max-width: 560px) {
    .eis-hero-top { padding: 1rem; }
    .eis-score { width: 100%; border-inline-start: 0; border-top: 1px solid var(--border); padding-inline-start: 0; padding-top: .8rem; justify-content: space-between; }
    .eis-score-meta { justify-items: start; text-align: start; }
    .eis-score-subline { justify-content: flex-start; }
    .eis-pillar-inner { padding: .78rem .9rem; }
    .eis-search-input, .eis-search-input:focus { width: 100%; }
    .eis-switch { flex-wrap: wrap; width: 100%; }
    .eis-switch button { white-space: nowrap; }
    .eis-indicator { padding: .85rem .9rem; gap: .6rem; }
    .eis-measure dl { gap: .4rem; }
    .eis-conversion th, .eis-conversion td { padding: .48rem .38rem; }
    .eis-hearing-context table { min-width: 22rem; }
}
@media (prefers-reduced-motion: reduce) {
    .eis-ring-fill, .eis-pillar-inner, .eis-pillar-bar > span, .eis-count, .eis-drawer, .eis-audit-btn, .eis-search-input,
    .eis-reveal-enter-active, .eis-reveal-leave-active, .eis-row-move, .eis-row-enter-active, .eis-row-leave-active {
        transition-duration: 1ms !important;
        transform: none !important;
    }
    .eis-panel, .eis-spinner { animation: none; }
}
</style>
