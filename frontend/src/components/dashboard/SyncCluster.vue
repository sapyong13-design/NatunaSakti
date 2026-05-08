<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
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
let eventSource = null

function formatTime(iso) {
    if (!iso) return '--'
    const d = new Date(iso)
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
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
    progress.value = { current: 0, total: 200, message: 'Memulai...' }

    eventSource = subscribeSyncProgress((p) => {
        progress.value = p
        if (!p.inProgress) {
            syncing.value = false
            if (eventSource) {
                eventSource.close()
                eventSource = null
            }
            lastSync.value = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
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
})
</script>

<template>
    <div style="display: flex; align-items: center; gap: 12px;">
        <div class="ns-live" v-if="!syncing">
            <span class="ns-live-pulse" />
            <span class="ns-live-label">{{ count }}/{{ total }}</span>
            <span class="ns-live-sep">·</span>
            <span class="ns-live-time">last sync {{ lastSync }}</span>
        </div>
        <div class="ns-live is-syncing" v-else>
            <span class="ns-live-pulse" />
            <span class="ns-live-label">{{ progress.message || 'Syncing...' }}</span>
            <span class="ns-live-sep">·</span>
            <span class="ns-live-time">{{ progress.current }}/{{ progress.total }}</span>
        </div>
        <button class="ns-btn ns-btn-primary" type="button" :disabled="syncing" @click="handleSync">
            <Icon name="sync" :size="14" />
            {{ syncing ? 'Syncing...' : 'Sync SIPP' }}
        </button>
    </div>
</template>
