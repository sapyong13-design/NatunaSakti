<script setup>
import { ref, watch, onMounted, computed } from 'vue'
import Icon from '../Icon.vue'

const props = defineProps({
    stats: { type: Object, required: true }
})

const animatedValues = ref({
    total: 0,
    bersidang: 0,
    minutasi: 0
})

// Spring physics animation
function springAnimation(target, key) {
    const start = animatedValues.value[key]
    const end = target
    const startTime = performance.now()
    const duration = 1200

    function update(currentTime) {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)

        // Spring easing: bounce at the end
        const springEasing = (t) => {
            const c4 = (2 * Math.PI) / 3
            return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1
        }

        animatedValues.value[key] = Math.floor(start + (end - start) * springEasing(progress))

        if (progress < 1) {
            requestAnimationFrame(update)
        } else {
            animatedValues.value[key] = end
        }
    }

    requestAnimationFrame(update)
}

watch(() => props.stats, (newStats) => {
    if (!newStats) return
    Object.keys(animatedValues.value).forEach((key, index) => {
        const targetValue = newStats[key] ?? 0
        if (targetValue !== animatedValues.value[key]) {
            setTimeout(() => {
                springAnimation(targetValue, key)
            }, index * 100)
        }
    })
}, { deep: true, immediate: true })

// Dynamic font size based on value length
function getValueFontSize(value) {
    const str = String(value)
    if (str.length >= 5) return '18px'
    if (str.length >= 4) return '20px'
    return '22px'
}

// Sparkline trend data (mock for now - can be connected to real trend data)
const sparklineData = {
    total: [12, 19, 15, 22, 18, 25, 30],
    bersidang: [5, 8, 6, 9, 7, 10, 12],
    minutasi: [3, 5, 4, 6, 5, 7, 9]
}

function generateSparklinePath(data) {
    const max = Math.max(...data, 1)
    const min = Math.min(...data, 0)
    const range = max - min || 1
    const width = 40
    const height = 12

    return data.map((val, i) => {
        const x = (i / (data.length - 1)) * width
        const y = height - ((val - min) / range) * height
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
    }).join(' ')
}

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
            v-for="(card, index) in cardData"
            :key="card.key"
            class="ns-quick-stat-card"
            :class="{ 'ns-card-primary': index === 0 }"
            :style="{
                '--stat-color': card.color,
                '--stat-bg': card.bg,
                '--card-index': index,
                '--font-size': getValueFontSize(animatedValues[card.key])
            }"
        >
            <!-- Corner decoration for primary card -->
            <div v-if="index === 0" class="ns-card-corner"></div>
            <div v-if="index === 0" class="ns-card-corner ns-card-corner-bottom"></div>

            <div class="ns-quick-stat-icon">
                <Icon :name="card.icon" :size="20" />
            </div>
            <div class="ns-quick-stat-content">
                <span class="ns-quick-stat-value" :style="{ fontSize: getValueFontSize(animatedValues[card.key]) }">
                    {{ animatedValues[card.key] || 0 }}
                </span>
                <span class="ns-quick-stat-label">{{ card.label }}</span>
                <!-- Mini sparkline -->
                <svg class="ns-sparkline" viewBox="0 0 40 12" preserveAspectRatio="none">
                    <defs>
                        <linearGradient :id="`gradient-${card.key}`" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" :stop-color="card.color" stop-opacity="0.3"/>
                            <stop offset="100%" :stop-color="card.color" stop-opacity="0"/>
                        </linearGradient>
                    </defs>
                    <path
                        :d="generateSparklinePath(sparklineData[card.key])"
                        fill="none"
                        :stroke="card.color"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />
                    <path
                        :d="`${generateSparklinePath(sparklineData[card.key])} L 40 12 L 0 12 Z`"
                        :fill="`url(#gradient-${card.key})`"
                        stroke="none"
                    />
                </svg>
            </div>
        </div>
    </div>
</template>

<style scoped>
.ns-quick-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 24px;
}

.ns-quick-stat-card {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 18px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    transition: transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 200ms ease;
    will-change: transform;
    /* Entrance animation */
    animation: cardSlideIn 0.5s cubic-bezier(0.32, 0.72, 0, 1) backwards;
    animation-delay: calc(var(--card-index) * 0.1s);
    overflow: hidden;
}

@keyframes cardSlideIn {
    from {
        opacity: 0;
        transform: translateY(20px) scale(0.95);
    }
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

/* Primary card elevation */
.ns-card-primary {
    box-shadow: 0 8px 28px rgba(74, 28, 27, 0.12);
    border-color: var(--accent);
}

[data-mode="light"] .ns-card-primary {
    box-shadow: 0 8px 28px rgba(74, 28, 27, 0.12);
    background: linear-gradient(135deg, #ffffff 0%, #faf8f5 100%);
}

[data-mode="dark"] .ns-card-primary {
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    background: linear-gradient(135deg, #242020 0%, #1a1816 100%);
}

/* Corner decorations for primary card */
.ns-card-corner {
    position: absolute;
    width: 16px;
    height: 16px;
    border-top: 2px solid var(--accent);
    border-left: 2px solid var(--accent);
    top: 0;
    left: 0;
    border-top-left-radius: 12px;
    opacity: 0.4;
}

.ns-card-corner-bottom {
    top: auto;
    left: auto;
    bottom: 0;
    right: 0;
    border-top: none;
    border-left: none;
    border-bottom: 2px solid var(--accent);
    border-right: 2px solid var(--accent);
    border-top-left-radius: 0;
    border-bottom-right-radius: 12px;
}

/* Hover lift effect */
.ns-quick-stat-card:hover {
    transform: translateY(-4px) scale(1.01);
    box-shadow: 0 12px 32px rgba(74, 28, 27, 0.15);
}

[data-mode="light"] .ns-quick-stat-card:hover {
    box-shadow: 0 12px 32px rgba(74, 28, 27, 0.15);
}

[data-mode="dark"] .ns-quick-stat-card:hover {
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.35);
}

.ns-quick-stat-icon {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--stat-bg);
    border-radius: 12px;
    color: var(--stat-color);
    flex-shrink: 0;
    position: relative;
    overflow: hidden;
}

/* Shimmer effect on icon */
.ns-quick-stat-icon::after {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
    transition: left 0.5s;
}

.ns-quick-stat-card:hover .ns-quick-stat-icon::after {
    left: 100%;
    transition: left 0.6s ease-in-out;
}

.ns-quick-stat-content {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
}

.ns-quick-stat-value {
    font-size: 22px;
    font-weight: 700;
    color: var(--stat-color);
    font-family: "JetBrains Mono", monospace;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    transition: font-size 0.3s ease;
}

.ns-quick-stat-label {
    font-size: 11px;
    color: var(--text2);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

/* Sparkline */
.ns-sparkline {
    width: 40px;
    height: 12px;
    margin-top: 2px;
    opacity: 0.7;
}

[data-mode="light"] .ns-quick-stat-card {
    background: #ffffff;
    border-color: #e5e7eb;
}

[data-mode="dark"] .ns-quick-stat-card {
    background: #1e2129;
    border-color: #2d3748;
}

[data-mode="dark"] .ns-sparkline {
    opacity: 0.5;
}

@media (max-width: 768px) {
    .ns-quick-stats {
        grid-template-columns: 1fr;
    }
}
</style>
