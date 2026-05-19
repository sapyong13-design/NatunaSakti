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
let syncStarted = false
let syncFinished = false

const progressPercent = computed(() => {
    if (!progress.value.total) return 0
    return Math.min((progress.value.current / progress.value.total) * 100, 100)
})

const circumference = 2 * Math.PI * 14 // r=14 for smaller circle
const strokeDashoffset = computed(() => {
    return circumference - (progressPercent.value / 100) * circumference
})

const progressLabel = computed(() => `${Math.round(progressPercent.value)}%`)

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
    if (syncing.value) return
    syncing.value = true
    syncComplete.value = false
    syncStarted = false
    syncFinished = false
    progress.value = { current: 0, total: 200, message: 'Memulai...' }

    function finishSync(finalProgress = null) {
        if (syncFinished) return
        syncFinished = true

        if (finalProgress) {
            progress.value = finalProgress
        }

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

    eventSource = subscribeSyncProgress((p) => {
        if (p.inProgress) {
            syncStarted = true
        }

        if (!syncStarted && !p.inProgress) {
            return
        }

        progress.value = p
        if (!p.inProgress) {
            finishSync(p)
        }
    })

    try {
        const result = await syncSippData()
        const total = Number(result?.fetched || result?.total_in_db || progress.value.total || 1)
        finishSync({
            current: total,
            total,
            page: progress.value.page || 0,
            message: result?.message || `Selesai! ${total} perkara di-sync`,
            inProgress: false,
            error: null
        })
    } catch (err) {
        console.error('Sync failed:', err.message)
        syncing.value = false
        if (eventSource) {
            eventSource.close()
            eventSource = null
        }
    }
}

defineExpose({ sync: handleSync })

onMounted(loadStatus)
onUnmounted(() => {
    if (eventSource) eventSource.close()
    if (completeTimeout) clearTimeout(completeTimeout)
})
</script>

<template>
    <div class="ns-sync-wrapper">
        <!-- Status Card -->
        <div
            class="ns-sync-status"
            :class="{ 'is-syncing': syncing, 'is-complete': syncComplete }"
            :title="syncing ? progress.message : `Terakhir ${lastSync}`"
        >
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
                    {{ syncing ? 'Sync...' : syncComplete ? 'Selesai' : 'SIPP' }}
                </div>
                <div class="ns-sync-detail">
                    <template v-if="syncing">
                        {{ progress.current }}/{{ progress.total }} perkara · {{ progressLabel }}
                    </template>
                    <template v-else-if="syncComplete">
                        {{ progress.current }} perkara diproses
                    </template>
                    <template v-else>
                        Terakhir {{ lastSync }}
                    </template>
                </div>
                <div v-if="syncing || syncComplete" class="ns-sync-progress-bar" role="progressbar" :aria-valuenow="Math.round(progressPercent)" aria-valuemin="0" aria-valuemax="100">
                    <span :style="{ width: `${progressPercent}%` }"></span>
                </div>
            </div>

            <!-- Sync Button -->
            <button
                class="ns-sync-btn"
                type="button"
                :disabled="syncing"
                aria-label="Sinkronkan SIPP"
                title="Sinkronkan SIPP"
                @click="handleSync"
            >
                <Icon name="refresh" :size="12" />
            </button>
        </div>
    </div>
</template>

<style scoped>
.ns-sync-wrapper {
    display: flex;
    align-items: center;
    flex-shrink: 0;
}

.ns-sync-status {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    padding: 4px 6px 4px 8px;
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
    min-width: 82px;
    max-width: 108px;
}

.ns-sync-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text);
}

.ns-sync-detail {
    font-size: 10px;
    color: var(--text3);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.ns-sync-message {
    max-width: 220px;
    color: var(--text2);
    font-size: 10px;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.ns-sync-progress-bar {
    width: 100%;
    height: 4px;
    margin-top: 3px;
    border-radius: 999px;
    background: var(--surface2);
    overflow: hidden;
}

.ns-sync-progress-bar span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--accent), var(--accent2));
    transition: width 300ms ease;
}

.ns-sync-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface2);
    color: var(--text);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 200ms;
}

@media (max-width: 720px) {
    .ns-sync-info {
        display: none;
    }
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
