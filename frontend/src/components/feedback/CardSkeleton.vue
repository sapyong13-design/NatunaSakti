<script setup>
defineProps({
    variant: { type: String, default: 'stat' } // stat, list, detail
})
</script>

<template>
    <div class="ns-card-skeleton" :class="`ns-card-skeleton-${variant}`">
        <template v-if="variant === 'stat'">
            <div class="ns-skeleton ns-skeleton-label" />
            <div class="ns-skeleton ns-skeleton-value" />
        </template>

        <template v-else-if="variant === 'list'">
            <div class="ns-skeleton ns-skeleton-avatar" />
            <div class="ns-card-skeleton-content">
                <div class="ns-skeleton ns-skeleton-line" />
                <div class="ns-skeleton ns-skeleton-line ns-skeleton-line-short" />
            </div>
        </template>

        <template v-else-if="variant === 'detail'">
            <div class="ns-skeleton ns-skeleton-title" />
            <div class="ns-skeleton ns-skeleton-line" />
            <div class="ns-skeleton ns-skeleton-line" />
            <div class="ns-skeleton ns-skeleton-line ns-skeleton-line-short" />
        </template>
    </div>
</template>

<style scoped>
.ns-card-skeleton {
    padding: 16px 18px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
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

@keyframes ns-skeleton-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}

/* Stat variant */
.ns-card-skeleton-stat {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.ns-skeleton-label {
    height: 12px;
    width: 60%;
}

.ns-skeleton-value {
    height: 40px;
    width: 80%;
}

/* List variant */
.ns-card-skeleton-list {
    display: flex;
    align-items: center;
    gap: 12px;
}

.ns-skeleton-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    flex-shrink: 0;
}

.ns-card-skeleton-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.ns-skeleton-line {
    height: 14px;
    width: 100%;
}

.ns-skeleton-line-short {
    width: 60%;
}

/* Detail variant */
.ns-card-skeleton-detail {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.ns-skeleton-title {
    height: 24px;
    width: 70%;
}
</style>
