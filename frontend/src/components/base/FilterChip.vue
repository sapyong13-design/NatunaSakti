<script setup>
const props = defineProps({
    label: { type: String, required: true },
    count: { type: Number, default: 0 },
    active: { type: Boolean, default: false },
    icon: { type: String, default: '' }
})
</script>

<template>
    <button
        type="button"
        class="ns-filter-chip"
        :class="{ 'is-active': active }"
    >
        <span>{{ label }}</span>
        <span v-if="count > 0" class="ns-filter-chip-count">{{ count }}</span>
    </button>
</template>

<style scoped>
.ns-filter-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1px solid var(--border);
    border-radius: 20px;
    background: var(--surface);
    color: var(--text2);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms;
}

.ns-filter-chip:hover {
    border-color: var(--accent);
    background: var(--accentSoft);
    color: var(--accent);
}

.ns-filter-chip.is-active {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
}

.ns-filter-chip-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    background: rgba(0, 0, 0, 0.1);
    border-radius: 10px;
    font-size: 10px;
    font-weight: 600;
}

.ns-app[data-mode="dark"] .ns-filter-chip-count {
    background: rgba(255, 255, 255, 0.15);
}

.ns-filter-chip.is-active .ns-filter-chip-count {
    background: rgba(255, 255, 255, 0.25);
}
</style>
