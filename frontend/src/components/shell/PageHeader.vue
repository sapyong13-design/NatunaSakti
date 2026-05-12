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
    padding: 16px 0 24px 0;
    overflow: hidden;
}

/* Geometric pattern overlay */
.ns-c-page-header::before {
    content: '';
    position: absolute;
    right: -40px;
    top: -30px;
    width: 180px;
    height: 180px;
    background:
        repeating-linear-gradient(
            45deg,
            transparent,
            transparent 10px,
            var(--accentSoft) 10px,
            var(--accentSoft) 11px
        ),
        repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 10px,
            var(--accentSoft) 10px,
            var(--accentSoft) 11px
        );
    opacity: 0.4;
    border-radius: 50%;
    pointer-events: none;
    mask-image: radial-gradient(circle, black 30%, transparent 70%);
    -webkit-mask-image: radial-gradient(circle, black 30%, transparent 70%);
}

[data-mode="dark"] .ns-c-page-header::before {
    opacity: 0.25;
}

.ns-c-page-header::after {
    content: '';
    position: absolute;
    right: 40px;
    bottom: -20px;
    width: 80px;
    height: 80px;
    border: 2px solid var(--accentSoft);
    border-radius: 50%;
    opacity: 0.3;
    pointer-events: none;
}

.ns-header-content {
    flex: 1;
    position: relative;
    z-index: 1;
}

.ns-garuda-emblem {
    position: absolute;
    left: 0;
    top: 0;
    width: 48px;
    height: 48px;
    color: var(--accent);
    opacity: 0.5;
    pointer-events: none;
}

.ns-c-eyebrow {
    font-size: 11px;
    font-weight: 600;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 6px;
}

.ns-h1-sub {
    margin-top: 8px;
    font-size: 14px;
    color: var(--text2);
    line-height: 1.5;
}
</style>
