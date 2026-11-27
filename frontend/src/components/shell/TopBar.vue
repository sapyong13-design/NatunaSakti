<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useTheme } from '../../composables/useTheme'
import LiveIndicator from './LiveIndicator.vue'
import NotificationDropdown from './NotificationDropdown.vue'
import Icon from '../Icon.vue'
import { getPerkara, getSippStatus } from '../../lib/api'

let checkInterval = null

const theme = useTheme()
const lastSync = ref('--')
const lastSyncTitle = ref('')
const syncStatusTone = ref('ok')
const syncStatusLabel = ref('Sync OK')
const newPerkara = ref([])
const lastKnownCount = ref(0)

defineProps({
    mobileMenuOpen: { type: Boolean, default: false }
})

defineEmits(['toggle-menu'])
defineExpose({ checkNewPerkara })

function updateSyncIndicator(countData) {
    const iso = countData?.last_sync
    if (!iso || !Number.isFinite(Date.parse(iso))) {
        lastSync.value = 'Belum sync'
        lastSyncTitle.value = 'Belum ada riwayat sinkronisasi SIPP'
        syncStatusTone.value = 'warn'
        syncStatusLabel.value = 'Perlu Sync'
        return
    }

    const date = new Date(iso)
    const ageHours = (Date.now() - date.getTime()) / 3600000
    const timeText = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date)

    lastSync.value = `${timeText} WIB`
    lastSyncTitle.value = `Sinkronisasi terakhir: ${date.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB (${countData?.sipp_synced ?? 0}/${countData?.total ?? 0} perkara)`

    if ((countData?.total || 0) > (countData?.sipp_synced || 0)) {
        syncStatusTone.value = 'warn'
        syncStatusLabel.value = 'Parsial'
    } else if (ageHours > 24) {
        syncStatusTone.value = 'warn'
        syncStatusLabel.value = 'Cache >24j'
    } else {
        syncStatusTone.value = 'ok'
        syncStatusLabel.value = 'Sync OK'
    }
}

async function checkNewPerkara() {
    try {
        const countData = await getSippStatus()
        updateSyncIndicator(countData)
        const currentTotal = countData.total || 0

        // Get stored count from localStorage
        const storedCount = localStorage.getItem('sipp_last_perkara_count')
        const storedNum = storedCount ? parseInt(storedCount) : 0

        if (storedNum > 0 && currentTotal > storedNum) {
            // Get the new perkara
            const data = await getPerkara({ limit: currentTotal - storedNum })
            const perkara = Array.isArray(data) ? data : (data.data || [])
            newPerkara.value = perkara
        }

        // Update stored count
        if (!storedCount) {
            localStorage.setItem('sipp_last_perkara_count', String(currentTotal))
        }

        lastKnownCount.value = currentTotal
    } catch (err) {
        console.error('Check new perkara failed:', err.message)
        syncStatusTone.value = 'error'
        syncStatusLabel.value = 'Offline'
        lastSync.value = 'API tidak terjangkau'
    }
}
function clearNotifications() {
    newPerkara.value = []
    // Update stored count to current total
    localStorage.setItem('sipp_last_perkara_count', String(lastKnownCount.value))
}

onMounted(() => {
    checkNewPerkara()
    // Check every 5 minutes
    checkInterval = setInterval(checkNewPerkara, 300000)
    // Listen for sync complete event
    window.addEventListener('sipp-synced', checkNewPerkara)
})

onUnmounted(() => {
    if (checkInterval) clearInterval(checkInterval)
    window.removeEventListener('sipp-synced', checkNewPerkara)
})
</script>

<template>
    <header class="ns-topbar ns-topbar-c">
        <!-- Hamburger menu button (mobile only) -->
        <button
            class="ns-hamburger"
            type="button"
            :aria-label="mobileMenuOpen ? 'Tutup menu' : 'Buka menu'"
            :class="{ 'ns-hamburger--open': mobileMenuOpen }"
            @click="$emit('toggle-menu')"
        >
            <span class="ns-hamburger-line" />
            <span class="ns-hamburger-line" />
            <span class="ns-hamburger-line" />
        </button>

        <div class="ns-c-org">
            <div class="ns-c-org-line">PENGADILAN NEGERI NATUNA &middot; KELAS II</div>
            <div class="ns-c-org-sub">Mahkamah Agung Republik Indonesia</div>
        </div>
        <div class="ns-topbar-actions">
            <LiveIndicator :syncing="false" :status="syncStatusTone" :label="syncStatusLabel" :last-sync="lastSync" :title="lastSyncTitle" />
            <NotificationDropdown :items="newPerkara" @clear="clearNotifications" />
            <button
                class="ns-icon-btn"
                type="button"
                :aria-label="theme.mode.value === 'dark' ? 'Switch to light' : 'Switch to dark'"
                @click="theme.toggle()"
            >
                <Icon :name="theme.mode.value === 'dark' ? 'sun' : 'moon'" :size="16" />
            </button>
        </div>
    </header>
</template>

<style scoped>
.ns-hamburger {
    display: none;
    flex-direction: column;
    justify-content: center;
    gap: 5px;
    width: 36px;
    height: 36px;
    padding: 8px;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.2s ease, border-color 0.2s ease;
}

.ns-hamburger:hover {
    background: var(--surface-2);
    border-color: var(--text-3);
}

.ns-hamburger-line {
    width: 100%;
    height: 2px;
    background: var(--text);
    border-radius: 1px;
    transition: transform 0.2s ease, opacity 0.2s ease;
}

.ns-hamburger--open .ns-hamburger-line:nth-child(1) {
    transform: translateY(7px) rotate(45deg);
}

.ns-hamburger--open .ns-hamburger-line:nth-child(2) {
    opacity: 0;
}

.ns-hamburger--open .ns-hamburger-line:nth-child(3) {
    transform: translateY(-7px) rotate(-45deg);
}

@media (max-width: 768px) {
    .ns-hamburger {
        display: flex;
    }

    .ns-c-org-line {
        font-size: 10px;
    }

    .ns-c-org-sub {
        display: none;
    }
}

.ns-topbar-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 0 0 auto;
}

.ns-icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text2);
    cursor: pointer;
    transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease;
}

.ns-icon-btn:hover {
    border-color: var(--accent);
    color: var(--text);
}

.ns-c-org {
    flex: 1;
    min-width: 0;
    text-align: center;
    overflow: hidden;
}

.ns-c-org-line {
    font-size: 12px;
    font-weight: 600;
    color: var(--text);
    letter-spacing: 0.05em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.ns-c-org-sub {
    font-size: 10px;
    color: var(--text3);
    margin-top: 2px;
}
</style>
