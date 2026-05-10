const ALL_LABELS = [
    'Penuntut Umum', 'Terdakwa', 'Tersangka', 'Anak Berhadapan dengan Hukum',
    'Penggugat', 'Tergugat', 'Pemohon', 'Termohon', 'Kuasa Hukum'
]

const TARGET_LABELS = ['Terdakwa', 'Tersangka', 'Anak Berhadapan dengan Hukum', 'Penggugat', 'Pemohon', 'Tergugat', 'Termohon']

const SEP = ALL_LABELS.map(l => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')

export function pihakUtama(str) {
    if (!str) return '—'

    // Skip if it looks like a nomor perkara pattern (short, contains /P, /Pid, /Pdt)
    if (typeof str === 'string') {
        const trimmed = str.trim()
        // Check if it's a short nomor perkara pattern
        if (/^[\d\/]+$/.test(trimmed)) return '—'
        if (trimmed.includes('/Pdt') || trimmed.includes('/Pid') || trimmed.includes('/B/')) return '—'
    }

    // Try format "Label: Name"
    for (const label of TARGET_LABELS) {
        const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const m = str.match(new RegExp(`${esc}:(.+?)(?=(?:${SEP}):|$)`))
        if (m) return m[1].trim()
    }

    // Try format "Label Name" (colon-less)
    for (const label of TARGET_LABELS) {
        const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const m = str.match(new RegExp(`${esc}\\s+(.+?)(?=\\s*(?:${SEP})|$)`))
        if (m) return m[1].trim()
    }

    return '—'
}
