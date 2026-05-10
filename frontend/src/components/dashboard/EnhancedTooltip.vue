<script setup>
import { computed } from 'vue'
import { pihakUtama } from '../../lib/pihak'
import { formatDateIndo } from '../../lib/date'

const props = defineProps({
    row: { type: Object, default: null },
    show: { type: Boolean, default: false },
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 }
})

const emit = defineEmits(['close'])

function jenisColor(jenis) {
    if (jenis === 'Pidana') return '#C75B4A'
    if (jenis === 'Perdata') return '#4A7C59'
    if (jenis === 'Perikanan') return '#0ea5e9'
    return '#9ca3af'
}

function jenisBg(jenis) {
    if (jenis === 'Pidana') return 'rgba(199, 91, 74, 0.12)'
    if (jenis === 'Perdata') return 'rgba(74, 124, 89, 0.12)'
    if (jenis === 'Perikanan') return 'rgba(14, 165, 233, 0.12)'
    return 'rgba(156, 163, 175, 0.12)'
}

// Get jadwal count
const jadwalCount = computed(() => {
    return props.row?.jadwal?.length || 0
})

// Get latest jadwal
const latestJadwal = computed(() => {
    if (!props.row?.jadwal?.length) return null
    return props.row.jadwal[0] // Assuming sorted by date desc
})
</script>

<template>
    <Teleport to="body">
        <Transition name="ns-tooltip">
            <div
                v-if="show && row"
                class="ns-enhanced-tooltip"
                :style="{ left: x + 'px', top: y + 'px' }"
            >
                <div class="ns-tooltip-header" :style="{ background: jenisBg(row.jenis_perkara) }">
                    <span
                        class="ns-tooltip-jenis"
                        :style="{ color: jenisColor(row.jenis_perkara) }"
                    >
                        {{ row.jenis_perkara }}
                    </span>
                    <span class="ns-tooltip-nomor">{{ row.nomor_perkara }}</span>
                </div>

                <div class="ns-tooltip-body">
                    <div class="ns-tooltip-section">
                        <span class="ns-tooltip-label">Para Pihak</span>
                        <span class="ns-tooltip-value">{{ pihakUtama(row.para_pihak) }}</span>
                    </div>

                    <div class="ns-tooltip-grid">
                        <div class="ns-tooltip-item">
                            <span class="ns-tooltip-item-label">Register</span>
                            <span class="ns-tooltip-item-value">{{ formatDateIndo(row.sipp_tanggal_register) }}</span>
                        </div>
                        <div class="ns-tooltip-item">
                            <span class="ns-tooltip-item-label">Lama Proses</span>
                            <span class="ns-tooltip-item-value">{{ row.sipp_lama_proses || '—' }}</span>
                        </div>
                        <div class="ns-tooltip-item">
                            <span class="ns-tooltip-item-label">Status</span>
                            <span class="ns-tooltip-item-value">{{ row.sipp_status || '—' }}</span>
                        </div>
                        <div class="ns-tooltip-item">
                            <span class="ns-tooltip-item-label">Jadwal</span>
                            <span class="ns-tooltip-item-value">{{ jadwalCount }} sidang</span>
                        </div>
                    </div>

                    <div v-if="latestJadwal" class="ns-tooltip-latest">
                        <span class="ns-tooltip-latest-label">Sidang Terakhir</span>
                        <span class="ns-tooltip-latest-value">{{ latestJadwal.agenda || '—' }}</span>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.ns-enhanced-tooltip {
    position: fixed;
    min-width: 280px;
    max-width: 360px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    overflow: hidden;
    pointer-events: none;
}

.ns-tooltip-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
}

.ns-tooltip-jenis {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 3px 8px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.8);
}

.ns-tooltip-nomor {
    font-family: "JetBrains Mono", monospace;
    font-size: 12px;
    font-weight: 600;
    color: var(--text);
}

.ns-tooltip-body {
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.ns-tooltip-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.ns-tooltip-label {
    font-size: 10px;
    color: var(--text-3);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.ns-tooltip-value {
    font-size: 13px;
    color: var(--text);
    line-height: 1.4;
}

.ns-tooltip-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
}

.ns-tooltip-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 8px;
    background: var(--surface-2);
    border-radius: 6px;
}

.ns-tooltip-item-label {
    font-size: 10px;
    color: var(--text-3);
    font-weight: 500;
}

.ns-tooltip-item-value {
    font-size: 12px;
    font-weight: 500;
    color: var(--text);
    font-family: "JetBrains Mono", monospace;
}

.ns-tooltip-latest {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 10px;
    background: linear-gradient(135deg, rgba(8, 145, 178, 0.08), transparent);
    border-radius: 6px;
}

.ns-tooltip-latest-label {
    font-size: 10px;
    color: var(--text-3);
    font-weight: 500;
}

.ns-tooltip-latest-value {
    font-size: 11px;
    font-weight: 500;
    color: var(--accent);
}

[data-mode="light"] .ns-enhanced-tooltip {
    background: #ffffff;
    border-color: #e5e7eb;
}

[data-mode="dark"] .ns-enhanced-tooltip {
    background: #1e2129;
    border-color: #2d3748;
}

.ns-tooltip-enter-active,
.ns-tooltip-leave-active {
    transition: all 200ms ease;
}

.ns-tooltip-enter-from,
.ns-tooltip-leave-to {
    opacity: 0;
    transform: translateY(-8px) scale(0.95);
}
</style>
