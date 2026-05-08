<script setup>
import { useTheme } from '../composables/useTheme'
import Icon from '../components/Icon.vue'
import LambangPN from '../components/LambangPN.vue'
import Sparkline from '../components/charts/Sparkline.vue'
import StackedBars from '../components/charts/StackedBars.vue'

const theme = useTheme()
const sparkData = [3, 5, 4, 7, 6, 8, 10, 9]
const barData = [
    { week: 'W1', pidana: 4, perdata: 2 },
    { week: 'W2', pidana: 6, perdata: 3 },
    { week: 'W3', pidana: 5, perdata: 4 },
    { week: 'W4', pidana: 8, perdata: 3 },
    { week: 'W5', pidana: 7, perdata: 5 },
    { week: 'W6', pidana: 9, perdata: 4 }
]
</script>

<template>
    <div style="padding: 24px; background: var(--bg); color: var(--text); min-height: 100vh; font-family: 'Bookman Old Style', 'Bookman', 'URW Bookman L', Georgia, serif;">
        <h1>Foundation Test</h1>
        <p>Mode saat ini: <b>{{ theme.mode.value }}</b></p>
        <button @click="theme.toggle()" style="padding: 8px 16px; cursor: pointer;">
            Toggle theme
        </button>

        <h2 style="margin-top: 32px;">Icons</h2>
        <div style="display: flex; gap: 16px; align-items: center; color: var(--accent);">
            <Icon name="search" :size="20" />
            <Icon name="sun" :size="20" />
            <Icon name="moon" :size="20" />
            <Icon name="trendUp" :size="20" />
            <Icon name="bell" :size="20" />
            <Icon name="gavel" :size="20" />
            <Icon name="fish" :size="20" />
            <Icon name="dot" :size="12" />
        </div>

        <h2 style="margin-top: 32px;">LambangPN</h2>
        <LambangPN :size="64" :primary="'#047857'" />

        <h2 style="margin-top: 32px;">Sparkline</h2>
        <Sparkline :data="sparkData" />

        <h2 style="margin-top: 32px;">StackedBars</h2>
        <StackedBars :data="barData" />
    </div>
</template>
