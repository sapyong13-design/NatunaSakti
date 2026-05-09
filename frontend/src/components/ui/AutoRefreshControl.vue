<script setup>
const props = defineProps({
    enabled: { type: Boolean, required: true },
    interval: { type: Number, required: true },
    intervalLabel: { type: String, required: true },
    nextRefreshTime: { type: String, default: null },
    isRefreshing: { type: Boolean, default: false }
})

const emit = defineEmits(['toggle', 'set-interval', 'refresh'])
</script>

<template>
    <div class="ns-auto-refresh">
        <button
            class="ns-refresh-toggle"
            :class="{ 'ns-refresh-toggle--active': enabled }"
            :title="enabled ? 'Auto-refresh aktif' : 'Aktifkan auto-refresh'"
            @click="$emit('toggle')"
        >
            <span class="ns-refresh-icon" :class="{ 'ns-spin': isRefreshing }">🔄</span>
            <span v-if="enabled" class="ns-refresh-status">ON</span>
        </button>

        <div v-if="enabled" class="ns-refresh-info">
            <select
                class="ns-refresh-interval"
                :value="interval"
                @change="$emit('set-interval', Number($event.target.value))"
            >
                <option :value="10000">10 detik</option>
                <option :value="30000">30 detik</option>
                <option :value="60000">1 menit</option>
                <option :value="120000">2 menit</option>
                <option :value="300000">5 menit</option>
            </select>
            <span v-if="nextRefreshTime" class="ns-refresh-next">
                next: {{ nextRefreshTime }}
            </span>
        </div>
    </div>
</template>

<style scoped>
.ns-auto-refresh {
    display: flex;
    align-items: center;
    gap: 8px;
}

.ns-refresh-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 10px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text-2);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
}

.ns-refresh-toggle:hover {
    background: var(--surface-3);
    border-color: var(--text-3);
}

.ns-refresh-toggle--active {
    background: rgba(16, 185, 129, 0.15);
    border-color: #10b981;
    color: #10b981;
}

.ns-refresh-icon {
    font-size: 14px;
    transition: transform 0.3s ease;
}

.ns-refresh-icon.ns-spin {
    animation: ns-spin 1s linear infinite;
}

.ns-refresh-status {
    font-weight: 600;
}

.ns-refresh-info {
    display: flex;
    align-items: center;
    gap: 6px;
}

.ns-refresh-interval {
    padding: 4px 8px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    font-size: 11px;
    cursor: pointer;
}

.ns-refresh-next {
    font-size: 10px;
    color: var(--text-3);
    font-family: "JetBrains Mono", monospace;
}

@keyframes ns-spin {
    to { transform: rotate(360deg); }
}
</style>
