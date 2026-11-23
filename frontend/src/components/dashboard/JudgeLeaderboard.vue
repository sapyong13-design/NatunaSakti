<script setup>
import { ref, watch, computed } from 'vue'
import { getJudgeLeaderboard } from '../../lib/api'

const props = defineProps({ refreshKey: { type: String, default: null } })
const now = new Date()
const period = ref('monthly')
const year = ref(now.getFullYear())
const month = ref(now.getMonth() + 1)
const result = ref(null)
const loading = ref(false)
const error = ref('')
const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const unknownCount = computed(() => result.value?.coverage.unknown_roles.reduce((n, r) => n + r.rows, 0) || 0)
let request = 0
async function load() {
    const current = ++request
    loading.value = true
    error.value = ''
    result.value = null
    try {
        const filters = { period: period.value, year: year.value }
        if (period.value === 'monthly') filters.month = month.value
        const response = await getJudgeLeaderboard(filters)
        if (current === request) result.value = response
    } catch (e) {
        if (current === request) error.value = e.message
    } finally {
        if (current === request) loading.value = false
    }
}
watch([period, year, month, () => props.refreshKey], load, { immediate: true })
</script>

<template>
    <section class="judge-card" aria-labelledby="judge-leaderboard-title" :aria-busy="loading">
        <header class="judge-header">
            <div>
                <h2 id="judge-leaderboard-title">Leaderboard Hakim</h2>
                <p>Tanggal penetapan / penunjukan hakim — bukan tanggal pendaftaran perkara.</p>
            </div>
            <div class="judge-controls">
                <label>Periode <select v-model="period"><option value="monthly">Bulanan</option><option value="yearly">Tahunan</option></select></label>
                <label v-if="period === 'monthly'">Bulan <select v-model.number="month"><option v-for="(name, i) in months" :key="name" :value="i + 1">{{ name }}</option></select></label>
                <label>Tahun <input v-model.number.lazy="year" type="number" min="1000" max="9998" step="1" /></label>
                <button type="button" :disabled="loading" @click="load">Muat ulang</button>
            </div>
        </header>
        <p v-if="loading" role="status">Memuat leaderboard…</p>
        <p v-else-if="error" role="alert">Gagal memuat leaderboard: {{ error }}</p>
        <template v-else-if="result">
            <p v-if="!result.coverage.synced_at" role="status">Belum ada cache penugasan hakim. Jalankan sinkron SIPP penuh.</p>
            <p v-else-if="!result.data.length" role="status">Belum ada penugasan hakim yang dapat dihitung pada periode ini.</p>
            <div v-else class="judge-table-scroll">
                <table>
                    <caption>Jumlah perkara unik per hakim; urut total terbanyak, lalu nama (bukan penilaian kinerja).</caption>
                    <thead><tr><th scope="col">Hakim</th><th scope="col">Ketua</th><th scope="col">Tunggal</th><th scope="col">Anggota 1</th><th scope="col">Anggota 2</th><th scope="col">Total unik</th></tr></thead>
                    <tbody><tr v-for="judge in result.data" :key="judge.hakim_id"><th scope="row">{{ judge.hakim_nama }}</th><td>{{ judge.ketua }}</td><td>{{ judge.tunggal }}</td><td>{{ judge.anggota1 }}</td><td>{{ judge.anggota2 }}</td><td><strong>{{ judge.total }}</strong></td></tr></tbody>
                </table>
            </div>
            <div class="judge-notes">
                <p v-if="result.coverage.synced_at">Cache terakhir: {{ new Date(result.coverage.synced_at).toLocaleString('id-ID') }} · {{ result.coverage.counted_rows }} / {{ result.coverage.period_rows }} baris penugasan periode dapat dihitung.</p>
                <p>Semua tahapan PN (termasuk tahapan 17) disertakan<span v-if="result.coverage.includes_inactive">, termasuk riwayat penugasan tidak aktif/diganti</span>. Perkara yang sama dihitung sekali per peran dan sekali pada total tiap hakim; jumlah kolom peran dapat melebihi total. Bukan jumlah perkara aktif atau putusan.</p>
                <p v-if="unknownCount || result.coverage.missing_judge_rows || result.coverage.missing_date_rows" role="status">Dikecualikan: {{ unknownCount }} baris peran/urutan belum dikenali, {{ result.coverage.missing_judge_rows }} baris tanpa identitas hakim (periode ini), {{ result.coverage.missing_date_rows }} baris tanpa tanggal (seluruh cache).</p>
                <details v-if="unknownCount"><summary>Rincian peran belum dikenali</summary><ul><li v-for="(role, i) in result.coverage.unknown_roles" :key="i">ID {{ role.jabatan_hakim_id }} · {{ role.jabatan_hakim_nama || '(tanpa nama)' }} · urutan {{ role.urutan }}: {{ role.rows }} baris</li></ul></details>
            </div>
        </template>
    </section>
</template>

<style scoped>
.judge-card { margin-bottom: 20px; padding: 20px; border: 1px solid var(--ns-border, #d8dee4); border-radius: 12px; background: var(--ns-bg-card, transparent); color: inherit; }
.judge-header { display: flex; flex-wrap: wrap; gap: 16px; justify-content: space-between; align-items: start; }
h2 { font-size: 18px; margin: 0 0 6px; }
p { margin: 6px 0; line-height: 1.5; }
.judge-header p, .judge-notes, caption { font-size: 12px; opacity: .8; }
.judge-controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: end; }
label { display: flex; flex-direction: column; gap: 5px; font-size: 12px; }
select, input, button { font: inherit; color: inherit; background: var(--ns-bg-card, transparent); border: 1px solid var(--ns-border, #aeb8c2); padding: 7px; border-radius: 6px; }
input { width: 90px; }
button { cursor: pointer; }
.judge-table-scroll { overflow-x: auto; margin-top: 16px; }
table { width: 100%; border-collapse: collapse; white-space: nowrap; }
caption { text-align: left; padding: 0 0 10px; white-space: normal; }
th, td { text-align: right; padding: 10px; border-bottom: 1px solid var(--ns-border, #d8dee4); font-variant-numeric: tabular-nums; }
th:first-child { text-align: left; }
.judge-notes { margin-top: 12px; }
</style>
