<script setup>
defineProps({
    eyebrow: { type: String, default: '' },
    title: { type: String, required: true },
    sub: { type: String, default: '' }
})
</script>

<template>
    <div class="ns-c-page-header">
        <div class="ns-header-content">
            <div v-if="eyebrow" class="ns-c-eyebrow">{{ eyebrow }}</div>
            <h1 class="ns-h1 ns-h1-c">{{ title }}</h1>
            <p v-if="sub" class="ns-h1-sub">{{ sub }}</p>
        </div>
        <div v-if="$slots.default">
            <slot />
        </div>
        <div class="ns-garuda-emblem" aria-label="Lambang Negara">
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M50 8L62 35H90L68 52L76 80L50 62L24 80L32 52L10 35H38L50 8Z" fill="currentColor" opacity="0.12"/>
                <circle cx="50" cy="45" r="8" fill="currentColor" opacity="0.15"/>
                <path d="M50 38V52M44 45H56" stroke="currentColor" stroke-width="2" opacity="0.25"/>
            </svg>
        </div>
    </div>
</template>

<style scoped>
.ns-c-page-header {
    position: relative;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
}

.ns-header-content {
    flex: 1;
}

.ns-garuda-emblem {
    position: absolute;
    left: 0;
    top: 0;
    width: 40px;
    height: 40px;
    color: var(--accent);
    opacity: 0.6;
    pointer-events: none;
}
</style>
