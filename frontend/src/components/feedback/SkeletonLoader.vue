<script setup>
const props = defineProps({
    width: { type: String, default: '100%' },
    height: { type: String, default: '16px' },
    variant: { type: String, default: 'rect' }, // rect, circle, text
    count: { type: Number, default: 1 }
})
</script>

<template>
    <div class="ns-skeleton-wrapper">
        <div
            v-for="i in count"
            :key="i"
            class="ns-skeleton"
            :class="`ns-skeleton-${variant}`"
            :style="{
                width: typeof width === 'number' ? `${width}px` : width,
                height: typeof height === 'number' ? `${height}px` : height
            }"
        />
    </div>
</template>

<style scoped>
.ns-skeleton-wrapper {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.ns-skeleton {
    background: linear-gradient(
        90deg,
        var(--surface-2) 25%,
        var(--border) 50%,
        var(--surface-2) 75%
    );
    background-size: 200% 100%;
    border-radius: 6px;
    animation: ns-skeleton-shimmer 1.5s ease-in-out infinite;
}

.ns-skeleton-circle {
    border-radius: 50%;
}

.ns-skeleton-text {
    border-radius: 4px;
    height: 14px;
}

@keyframes ns-skeleton-shimmer {
    0% {
        background-position: 200% 0;
    }
    100% {
        background-position: -200% 0;
    }
}
</style>
