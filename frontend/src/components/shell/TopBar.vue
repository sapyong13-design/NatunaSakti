<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useTheme } from '../../composables/useTheme'
import LiveIndicator from './LiveIndicator.vue'
import NotificationDropdown from './NotificationDropdown.vue'
import Icon from '../Icon.vue'
import { getPerkara } from '../../lib/api'

let checkInterval = null

const theme = useTheme()
const lastSync = ref('--')
const newPerkara = ref([])
const lastKnownCount = ref(0)

defineProps({
    mobileMenuOpen: { type: Boolean, default: false }
})

defineEmits(['toggle-menu'])
defineExpose({ checkNewPerkara })

async function checkNewPerkara() {
    try {
        // Get total count first
        const API_BASE = 'http://localhost:3000/api'
        const countRes = await fetch(`${API_BASE}/perkara/sipp/status`)
        const countData = await countRes.json()
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
            <div class="ns-c-org-line">PENGADILAN NEGERI NATUNA · KELAS II</div>
            <div class="ns-c-org-sub">Mahkamah Agung Republik Indonesia</div>
        </div>
        <div class="ns-topbar-actions">
            <LiveIndicator :syncing="false" :last-sync="lastSync" />
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
    transition: all 0.2s ease;
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
    transition: all 0.2s ease;
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
    transition: all 150ms;
}

.ns-icon-btn:hover {
    border-color: var(--accent);
    color: var(--text);
}

.ns-c-org {
    flex: 1;
    text-align: center;
}

.ns-c-org-line {
    font-size: 12px;
    font-weight: 600;
    color: var(--text);
    letter-spacing: 0.05em;
}

.ns-c-org-sub {
    font-size: 10px;
    color: var(--text3);
    margin-top: 2px;
}
</style>
