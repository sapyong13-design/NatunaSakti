<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import Icon from '../Icon.vue'
import { syncSippData, subscribeSyncProgress, getSippStatus } from '../../lib/api'

const props = defineProps({
    count: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
})

const emit = defineEmits(['synced'])

const syncing = ref(false)
const progress = ref({ current: 0, total: 200, message: '' })
const lastSync = ref('--')
const syncComplete = ref(false)
let eventSource = null
let completeTimeout = null

const progressPercent = computed(() => {
    if (!progress.value.total) return 0
    return Math.min((progress.value.current / progress.value.total) * 100, 100)
})

const circumference = 2 * Math.PI * 14 // r=14 for smaller circle
const strokeDashoffset = computed(() => {
    return circumference - (progressPercent.value / 100) * circumference
})

function formatTime(iso) {
    if (!iso) return '--'
    const d = new Date(iso)
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

async function loadStatus() {
    try {
        const s = await getSippStatus()
        lastSync.value = formatTime(s.last_sync)
    } catch (err) {
        console.error('Status load failed:', err.message)
    }
}

async function handleSync() {
    syncing.value = true
    syncComplete.value = false
    progress.value = { current: 0, total: 200, message: 'Memulai...' }

    eventSource = subscribeSyncProgress((p) => {
        progress.value = p
        if (!p.inProgress) {
            syncing.value = false
            syncComplete.value = true

            if (completeTimeout) clearTimeout(completeTimeout)
            completeTimeout = setTimeout(() => {
                syncComplete.value = false
            }, 2000)

            if (eventSource) {
                eventSource.close()
                eventSource = null
            }
            lastSync.value = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
            emit('synced')
        }
    })

    try {
        await syncSippData()
    } catch (err) {
        console.error('Sync failed:', err.message)
        syncing.value = false
        if (eventSource) {
            eventSource.close()
            eventSource = null
        }
    }
}

onMounted(loadStatus)
onUnmounted(() => {
    if (eventSource) eventSource.close()
    if (completeTimeout) clearTimeout(completeTimeout)
})
</script>

<template>
    <div class="ns-sync-wrapper">
        <!-- Status Card -->
        <div class="ns-sync-status" :class="{ 'is-syncing': syncing, 'is-complete': syncComplete }">
            <!-- Circular Progress -->
            <div class="ns-sync-circle">
                <svg class="ns-sync-ring" viewBox="0 0 32 32">
                    <circle
                        class="ns-sync-ring-bg"
                        cx="16"
                        cy="16"
                        r="14"
                        fill="none"
                        stroke-width="2.5"
                    />
                    <circle
                        class="ns-sync-ring-progress"
                        :class="{ 'is-animated': syncing }"
                        cx="16"
                        cy="16"
                        r="14"
                        fill="none"
                        stroke-width="2.5"
                        :stroke-dasharray="circumference"
                        :stroke-dashoffset="strokeDashoffset"
                    />
                </svg>
                <div class="ns-sync-icon">
                    <Icon
                        :name="syncing ? 'sync' : syncComplete ? 'check' : 'activity'"
                        :size="syncing ? 14 : 16"
                        :class="{ 'is-spinning': syncing }"
                    />
                </div>
            </div>

            <!-- Status Info -->
            <div class="ns-sync-info">
                <div class="ns-sync-label">
                    {{ syncing ? 'Menyinkronkan...' : syncComplete ? 'Selesai!' : 'SIPP Sync' }}
                </div>
                <div class="ns-sync-detail">
                    <template v-if="syncing">
                        {{ progress.current }}/{{ progress.total }} perkara
                    </template>
                    <template v-else-if="syncComplete">
                        {{ count }} perkara tersinkron
                    </template>
                    <template v-else>
                        Terakhir {{ lastSync }}
                    </template>
                </div>
            </div>

            <!-- Sync Button -->
            <button
                class="ns-sync-btn"
                type="button"
                :disabled="syncing"
                @click="handleSync"
            >
                <Icon name="refresh" :size="12" />
                <span>Sync</span>
            </button>
        </div>
    </div>
</template>

<style scoped>
.ns-sync-wrapper {
    display: flex;
    align-items: center;
}

.ns-sync-status {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    transition: all 300ms cubic-bezier(0.32, 0.72, 0, 1);
}

.ns-sync-status.is-syncing {
    background: linear-gradient(135deg, var(--accentSoft), var(--surface));
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accentSoft), 0 4px 20px rgba(13, 92, 92, 0.1);
    /* Animated gradient border */
    position: relative;
}

.ns-sync-status.is-syncing::before {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: 14px;
    background: linear-gradient(90deg, var(--accent), var(--accent2), var(--accent));
    background-size: 200% 100%;
    animation: gradientMove 2s linear infinite;
    z-index: -1;
    opacity: 0.6;
}

@keyframes gradientMove {
    0% { background-position: 0% 50%; }
    100% { background-position: 200% 50%; }
}

.ns-sync-status.is-complete {
    background: linear-gradient(135deg, var(--successSoft), var(--surface));
    border-color: var(--success);
    box-shadow: 0 0 0 1px var(--successSoft), 0 4px 20px rgba(74, 124, 89, 0.1);
}

.ns-sync-circle {
    position: relative;
    width: 32px;
    height: 32px;
    flex-shrink: 0;
}

.ns-sync-ring {
    position: absolute;
    inset: 0;
    transform: rotate(-90deg);
}

.ns-sync-ring-bg {
    stroke: var(--surface2);
}

.ns-sync-ring-progress {
    stroke: var(--accent);
    transition: stroke-dashoffset 300ms ease-out;
}

.ns-sync-status.is-complete .ns-sync-ring-progress {
    stroke: var(--success);
}

.ns-sync-ring-progress.is-animated {
    animation: syncPulse 1.5s ease-in-out infinite;
}

@keyframes syncPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
}

.ns-sync-icon {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: var(--text2);
}

.ns-sync-status.is-syncing .ns-sync-icon {
    color: var(--accent);
}

.ns-sync-status.is-complete .ns-sync-icon {
    color: var(--success);
}

.ns-sync-icon .is-spinning {
    animation: spin 1s linear infinite;
}

@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.ns-sync-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 120px;
}

.ns-sync-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text);
}

.ns-sync-detail {
    font-size: 10px;
    color: var(--text3);
}

.ns-sync-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface2);
    color: var(--text);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 200ms;
}

.ns-sync-btn:hover:not(:disabled) {
    border-color: var(--accent);
    background: var(--accentSoft);
    color: var(--accent);
}

.ns-sync-btn:active:not(:disabled) {
    transform: scale(0.98);
}

.ns-sync-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
</style>
