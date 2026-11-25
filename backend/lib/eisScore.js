// Mesin hitung skor EIS: mereproduksi nilai maksimal, peroleh, konversi, dan
// % Implementasi SIPP dari snapshot halaman publik EIS.
//
// Rumus (diverifikasi 424/424 unsur, 32/32 komponen, 9 bulan Jan–Nov 2026):
//   poin  = min(Σ w_i · min(1, sesuai_i/jumlah_i), W)
//   maks  = Σ_i W_i · (bagian berdata_i / bagian total_i)  untuk unsur berdata
//         + Σ W_i untuk unsur wajib yang tidak berdata
//   konv  = 100 · peroleh / maks ;  total = rata-rata 4 konversi
//
// Bagian dengan jumlah = 0 menyumbang 0 poin (bukan dilewati). Unsur non-numerik
// (versi SIPP, kode satker) bernilai penuh bila kedua nilai sama.
const { rowParity } = require('./eisParity');

const MAX_POINT = /Nilai Maksimal (\d+(?:\.\d+)?)/;

// Bobot sebenarnya tiga unsur berkas upaya hukum berbeda dari teks "Nilai Maksimal":
// teks menulis 6 dan 4, bobot efektif 7 dan 7, sedangkan PK tidak berbobot.
const WEIGHT_OVERRIDE = new Map([
    ['pengiriman berkas banding', 7],
    ['pengiriman berkas kasasi', 7],
    ['pengiriman berkas peninjauan kembali', 0]
]);

// Unsur yang tetap masuk penyebut walau tidak ada data pada periode berjalan.
const ALWAYS_COUNTED = new Set([
    'rilis versi sipp',
    'kesesuaian kode satker nomor perkara',
    'pelaksanaan mediasi',
    'tanda tangan elektronik salinan putusan perkara perdata',
    'tanda tangan elektronik salinan putusan perkara pidana',
    'data lapor mediasi',
    'sisa biaya perkara tk pertama',
    'sisa biaya perkara tingkat pertama',
    'dokumen elektronik putusan anonimisasi',
    'penetapan jurusita/jurusita pengganti',
    'penginputan penetapan jurusita/jurusita pengganti'
]);

const COMPONENT_IDS = ['kinerja', 'kepatuhan', 'kelengkapan', 'kesesuaian'];

const normalize = (value) => String(value ?? '').normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ');
const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const numeric = (value) => (value === '' || value === null || value === undefined || !/^-?\d+(?:\.\d+)?$/.test(value) ? null : Number(value));

function declaredPoints(text) {
    const match = String(text ?? '').match(MAX_POINT);
    return match ? Number(match[1]) : null;
}

// Bobot tiap bagian unsur, sudah dinormalkan agar jumlahnya sama dengan bobot efektif.
function partWeights(row) {
    const parts = Array.isArray(row.details) ? row.details : [];
    const declared = parts.length > 1
        ? parts.map((part) => declaredPoints(part.label) ?? 0)
        : [declaredPoints(row.description) ?? declaredPoints(row.label) ?? 0];
    const override = WEIGHT_OVERRIDE.get(normalize(row.label));
    if (override === undefined) return declared;
    if (!declared.length) return declared;
    return declared.map(() => override / declared.length);
}

// Unsur non-numerik: nilai penuh bila semua nilai sama dan tidak kosong.
function binaryPoints(row, total) {
    const values = (row.details ?? []).flatMap((part) => part.values ?? []);
    if (!values.length || values.some((value) => value === '' || value === null)) return null;
    if (values.some((value) => numeric(value) !== null)) return null;
    return values.every((value) => value === values[0]) ? total : 0;
}

function elementScore(row) {
    const weights = partWeights(row);
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    const parts = Array.isArray(row.details) ? row.details : [];
    const binary = binaryPoints(row, total);

    let points = 0;
    let activeParts = 0;
    if (binary === null) {
        for (let index = 0; index < parts.length; index++) {
            const [jumlah, sesuai] = (parts[index].values ?? []).map(numeric);
            const weight = weights[index] ?? (parts.length ? total / parts.length : 0);
            if (jumlah === null || jumlah <= 0) continue;
            activeParts++;
            if (sesuai === null) continue;
            points += weight * Math.min(1, sesuai / jumlah);
        }
    } else {
        points = binary;
        activeParts = parts.length;
    }

    const capped = Math.min(round2(points), total);
    let denominator;
    if (!parts.length) {
        denominator = ALWAYS_COUNTED.has(normalize(row.label)) ? total : 0;
    } else if (parts.length > 1) {
        denominator = activeParts ? round2(total * activeParts / parts.length) : (ALWAYS_COUNTED.has(normalize(row.label)) ? total : 0);
    } else {
        denominator = activeParts ? total : (ALWAYS_COUNTED.has(normalize(row.label)) ? total : 0);
    }

    return {
        label: row.label,
        weight: total,
        points: capped,
        denominator,
        officialPoints: Number(row.points) || 0,
        counted: denominator > 0,
        alwaysCounted: ALWAYS_COUNTED.has(normalize(row.label)),
        weightOverridden: WEIGHT_OVERRIDE.has(normalize(row.label)),
        activeParts,
        totalParts: parts.length
    };
}

function scoreSnapshot(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.tabs)) throw new TypeError('Snapshot EIS tidak lengkap.');
    const components = [];
    for (const id of COMPONENT_IDS) {
        const tab = snapshot.tabs.find((item) => item.id === id);
        if (!tab) continue;
        const elements = tab.rows.map((row) => ({ ...elementScore(row), parity: rowParity(id, row) }));
        const maks = round2(elements.reduce((sum, item) => sum + item.denominator, 0));
        const peroleh = round2(elements.reduce((sum, item) => sum + item.points, 0));
        const unalignedParts = elements.reduce((sum, item) => sum + item.parity.unalignedCount, 0);
        const unalignedElements = elements.filter((item) => !item.parity.aligned).length;
        const unalignedTier = elements.some((item) => item.parity.tier === 'diff') ? 'diff' : unalignedParts ? 'warn' : 'ok';
        components.push({
            id,
            label: tab.rows.length ? id : id,
            maks,
            peroleh,
            konversi: maks > 0 ? round2(100 * peroleh / maks) : null,
            unalignedParts,
            unalignedTier,
            unalignedElements,
            elements,
            official: officialComponent(snapshot, id)
        });
    }
    const konversiList = components.map((item) => item.konversi).filter((value) => value !== null);
    const total = konversiList.length ? round2(konversiList.reduce((a, b) => a + b, 0) / konversiList.length) : null;
    return {
        components,
        total,
        officialTotal: officialTotal(snapshot)
    };
}

function officialComponent(snapshot, id) {
    const tab = snapshot.tabs.find((item) => item.id === 'konversi');
    if (!tab) return null;
    const row = tab.rows.find((item) => normalize(item.label) === id);
    if (!row) return null;
    const [maks, peroleh, konversi] = (row.details?.[0]?.values ?? []).map(Number);
    return { maks, peroleh, konversi };
}

function officialTotal(snapshot) {
    const tab = snapshot.tabs.find((item) => item.id === 'konversi');
    const row = tab?.rows.find((item) => /implementasi sipp/i.test(item.label));
    const value = Number(row?.details?.[0]?.values?.[0]);
    return Number.isFinite(value) ? value : null;
}

module.exports = { scoreSnapshot, elementScore, partWeights, ALWAYS_COUNTED, WEIGHT_OVERRIDE };
