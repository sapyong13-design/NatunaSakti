<script setup>
defineProps({
    value: { type: Number, default: 0 }, // 0-100
    max: { type: Number, default: 100 },
    size: { type: String, default: 'md' }, // sm, md, lg
    showLabel: { type: Boolean, default: false },
    label: { type: String, default: '' },
    color: { type: String, default: 'accent' }, // accent, success, warning, danger
    striped: { type: Boolean, default: false },
    animated: { type: Boolean, default: false }
})

const colorMap = {
    accent: 'var(--accent)',
    success: 'var(--accent-2)',
    warning: 'var(--warn)',
    danger: 'var(--danger)'
}
</script>

<template>
    <div class="ns-progress-wrap" :class="`ns-progress-${size}`">
        <div v-if="label || showLabel" class="ns-progress-header">
            <span v-if="label" class="ns-progress-label">{{ label }}</span>
            <span class="ns-progress-value">{{ Math.round((value / max) * 100) }}%</span>
        </div>
        <div class="ns-progress-track">
            <div
                class="ns-progress-fill"
                :class="{
                    'ns-progress-striped': striped,
                    'ns-progress-animated': animated
                }"
                :style="{
                    width: `${Math.min((value / max) * 100, 100)}%`,
                    backgroundColor: colorMap[color] || colorMap.accent
                }"
            />
        </div>
    </div>
</template>

<style scoped>
.ns-progress-wrap {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.ns-progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
}

.ns-progress-label {
    color: var(--text);
    font-weight: 500;
}

.ns-progress-value {
    font-family: "JetBrains Mono", monospace;
    color: var(--text-2);
    font-variant-numeric: tabular-nums;
}

.ns-progress-track {
    height: 100%;
    background: var(--surface-2);
    border-radius: 100px;
    overflow: hidden;
}

.ns-progress-sm .ns-progress-track {
    height: 6px;
}

.ns-progress-md .ns-progress-track {
    height: 10px;
}

.ns-progress-lg .ns-progress-track {
    height: 14px;
}

.ns-progress-fill {
    height: 100%;
    border-radius: 100px;
    transition: width 300ms cubic-bezier(0.32, 0.72, 0, 1);
}

.ns-progress-striped {
    background-image: linear-gradient(
        45deg,
        rgba(255, 255, 255, 0.15) 25%,
        transparent 25%,
        transparent 50%,
        rgba(255, 255, 255, 0.15) 50%,
        rgba(255, 255, 255, 0.15) 75%,
        transparent 75%,
        transparent
    );
    background-size: 1rem 1rem;
}

.ns-progress-animated.ns-progress-striped {
    animation: ns-progress-stripes 1s linear infinite;
}

@keyframes ns-progress-stripes {
    from { background-position: 1rem 0; }
    to { background-position: 0 0; }
}
</style>
