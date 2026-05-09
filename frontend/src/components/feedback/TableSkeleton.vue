<script setup>
defineProps({
    rows: { type: Number, default: 5 },
    columns: { type: Number, default: 6 }
})
</script>

<template>
    <div class="ns-table-skeleton">
        <!-- Header -->
        <div class="ns-table-skeleton-header">
            <div
                v-for="col in columns"
                :key="`header-${col}`"
                class="ns-skeleton ns-skeleton-header-cell"
            />
        </div>
        <!-- Rows -->
        <div class="ns-table-skeleton-body">
            <div
                v-for="row in rows"
                :key="`row-${row}`"
                class="ns-table-skeleton-row"
            >
                <div
                    v-for="col in columns"
                    :key="`cell-${row}-${col}`"
                    class="ns-skeleton ns-skeleton-cell"
                />
            </div>
        </div>
    </div>
</template>

<style scoped>
.ns-table-skeleton {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
}

.ns-table-skeleton-header {
    display: grid;
    grid-template-columns: repeat(var(--columns, 1fr));
    gap: 12px;
    padding: 14px 16px;
    background: var(--bg-2);
    border-bottom: 1px solid var(--border);
}

.ns-skeleton-header-cell {
    height: 20px;
    width: 100%;
}

.ns-table-skeleton-body {
    display: flex;
    flex-direction: column;
}

.ns-table-skeleton-row {
    display: grid;
    grid-template-columns: repeat(var(--columns, 1fr));
    gap: 12px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
}

.ns-table-skeleton-row:last-child {
    border-bottom: none;
}

.ns-skeleton-cell {
    height: 16px;
    width: 100%;
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
</style>
