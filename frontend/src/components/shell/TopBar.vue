<script setup>
import { ref } from 'vue'
import { useTheme } from '../../composables/useTheme'
import LiveIndicator from './LiveIndicator.vue'
import Icon from '../Icon.vue'

const theme = useTheme()
const lastSync = ref('--')

defineProps({
    mobileMenuOpen: { type: Boolean, default: false }
})

defineEmits(['toggle-menu'])
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
</style>
