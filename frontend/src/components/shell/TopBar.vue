<script setup>
import { ref } from 'vue'
import { useTheme } from '../../composables/useTheme'
import LiveIndicator from './LiveIndicator.vue'
import Icon from '../Icon.vue'

const theme = useTheme()
const lastSync = ref('--')
</script>

<template>
    <header class="ns-topbar ns-topbar-c">
        <div class="ns-c-org">
            <div class="ns-c-org-line">PENGADILAN NEGERI NATUNA · KELAS II</div>
            <div class="ns-c-org-sub">Mahkamah Agung Republik Indonesia</div>
        </div>
        <div class="ns-topbar-actions">
            <LiveIndicator :syncing="false" :last-sync="lastSync" />
            <button class="ns-icon-btn ns-bell" type="button" aria-label="Notifications">
                <Icon name="bell" :size="16" />
                <span class="ns-bell-dot" />
            </button>
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
