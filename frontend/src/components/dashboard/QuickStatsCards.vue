<script setup>
import Icon from '../Icon.vue'

defineProps({
    stats: { type: Object, required: true }
})

const cardData = [
    {
        key: 'total',
        label: 'Total Perkara',
        icon: 'fileCheck',
        color: '#6366f1',
        bg: 'rgba(99, 102, 241, 0.1)'
    },
    {
        key: 'bersidang',
        label: 'Sedang Bersidang',
        icon: 'clock',
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.1)'
    },
    {
        key: 'minutasi',
        label: 'Selesai Minutasi',
        icon: 'check',
        color: '#10b981',
        bg: 'rgba(16, 185, 129, 0.1)'
    }
]
</script>

<template>
    <div class="ns-quick-stats">
        <div
            v-for="card in cardData"
            :key="card.key"
            class="ns-quick-stat-card"
            :style="{
                '--stat-color': card.color,
                '--stat-bg': card.bg
            }"
        >
            <div class="ns-quick-stat-icon">
                <Icon :name="card.icon" :size="20" />
            </div>
            <div class="ns-quick-stat-content">
                <span class="ns-quick-stat-value">{{ stats[card.key] || 0 }}</span>
                <span class="ns-quick-stat-label">{{ card.label }}</span>
            </div>
        </div>
    </div>
</template>

<style scoped>
.ns-quick-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 16px;
}

.ns-quick-stat-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    transition: transform 150ms ease, box-shadow 150ms ease;
}

.ns-quick-stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

[data-mode="dark"] .ns-quick-stat-card:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
}

.ns-quick-stat-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--stat-bg);
    border-radius: 10px;
    color: var(--stat-color);
    flex-shrink: 0;
}

.ns-quick-stat-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.ns-quick-stat-value {
    font-size: 22px;
    font-weight: 700;
    color: var(--stat-color);
    font-family: "JetBrains Mono", monospace;
    line-height: 1;
}

.ns-quick-stat-label {
    font-size: 11px;
    color: var(--text-2);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

[data-mode="light"] .ns-quick-stat-card {
    background: #ffffff;
    border-color: #e5e7eb;
}

[data-mode="dark"] .ns-quick-stat-card {
    background: #1e2129;
    border-color: #2d3748;
}

@media (max-width: 768px) {
    .ns-quick-stats {
        grid-template-columns: 1fr;
    }
}
</style>
