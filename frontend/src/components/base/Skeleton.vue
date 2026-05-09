<script setup>
const props = defineProps({
    type: { type: String, default: 'card' }, // card, table, text, circle
    width: { type: String, default: '100%' },
    height: { type: String, default: 'auto' },
    count: { type: Number, default: 1 }
})
</script>

<template>
    <div class="ns-skeleton-wrap">
        <template v-if="type === 'table'">
            <div v-for="i in 5" :key="i" class="ns-skeleton-table-row">
                <div class="ns-skeleton ns-skeleton-circle" style="width: 24px; height: 24px;"></div>
                <div class="ns-skeleton ns-skeleton-text" style="width: 80px;"></div>
                <div class="ns-skeleton ns-skeleton-text" style="width: 140px;"></div>
                <div class="ns-skeleton ns-skeleton-text" style="width: 120px;"></div>
                <div class="ns-skeleton ns-skeleton-text" style="width: 60px;"></div>
            </div>
        </template>
        <template v-else-if="type === 'card'">
            <div class="ns-skeleton-card" :style="{ width, height }"></div>
        </template>
        <template v-else-if="type === 'circle'">
            <div class="ns-skeleton ns-skeleton-circle" :style="{ width, height }"></div>
        </template>
        <template v-else>
            <div v-for="i in count" :key="i" class="ns-skeleton ns-skeleton-text" :style="{ width }"></div>
        </template>
    </div>
</template>

<style scoped>
.ns-skeleton-wrap {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.ns-skeleton-table-row {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 18px;
    border-bottom: 1px solid var(--border);
}

.ns-skeleton-table-row:last-child {
    border-bottom: none;
}
</style>
