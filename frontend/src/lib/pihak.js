const ALL_LABELS = [
    'Penuntut Umum', 'Terdakwa', 'Tersangka', 'Anak Berhadapan dengan Hukum',
    'Penggugat', 'Tergugat', 'Pemohon', 'Termohon', 'Kuasa Hukum'
]

const TARGET_LABELS = ['Terdakwa', 'Tersangka', 'Anak Berhadapan dengan Hukum', 'Penggugat', 'Pemohon']

const SEP = ALL_LABELS.map(l => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')

export function pihakUtama(str) {
    if (!str) return '—'
    for (const label of TARGET_LABELS) {
        const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const m = str.match(new RegExp(`${esc}:(.+?)(?=(?:${SEP}):|$)`))
        if (m) return m[1].trim()
    }
    return str
}
