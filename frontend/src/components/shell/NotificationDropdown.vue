<script setup>
import { ref, computed } from 'vue'
import Icon from '../Icon.vue'

const props = defineProps({
    items: { type: Array, default: () => [] }
})

const emit = defineEmits(['close', 'clear'])

const open = ref(false)

function toggle() {
    open.value = !open.value
}

function getTimeAgo(isoDate) {
    if (!isoDate) return ''
    const now = new Date()
    const date = new Date(isoDate)
    const diff = now - date
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Baru saja'
    if (minutes < 60) return `${minutes} menit lalu`
    if (hours < 24) return `${hours} jam lalu`
    return `${days} hari lalu`
}
</script>

<template>
    <div class="ns-notification-dropdown" :class="{ 'is-open': open }">
        <button
            class="ns-bell-btn"
            type="button"
            :aria-label="items.length ? `${items.length} notifikasi baru` : 'Tidak ada notifikasi'"
            @click="open = !open"
        >
            <Icon name="bell" :size="16" />
            <span v-if="items.length" class="ns-badge">{{ items.length > 99 ? '99+' : items.length }}</span>
        </button>

        <div v-if="open" class="ns-dropdown">
            <div class="ns-dropdown-header">
                <span class="ns-dropdown-title">Perkara Baru</span>
                <button
                    v-if="items.length"
                    class="ns-clear-btn"
                    type="button"
                    @click="emit('clear')"
                >
                    Hapus semua
                </button>
            </div>

            <div v-if="!items.length" class="ns-empty">
                <Icon name="inbox" :size="24" />
                <span>Tidak ada notifikasi</span>
            </div>

            <div v-else class="ns-list">
                <div
                    v-for="item in items"
                    :key="item.nomor_perkara"
                    class="ns-item"
                >
                    <div class="ns-item-icon">
                        <Icon name="document" :size="14" />
                    </div>
                    <div class="ns-item-content">
                        <div class="ns-item-title">{{ item.nomor_perkara }}</div>
                        <div class="ns-item-meta">
                            <span>{{ item.jenis_perkara }}</span>
                            <span v-if="item.para_pihak" class="ns-item-pihak">
                                · {{ item.para_pihak.slice(0, 30) }}{{ item.para_pihak.length > 30 ? '...' : '' }}
                            </span>
                        </div>
                    </div>
                    <div class="ns-item-time">
                        {{ getTimeAgo(item.created_at) }}
                    </div>
                </div>
            </div>
        </div>

        <div v-if="open" class="ns-backdrop" @click="open = false" />
    </div>
</template>

<style scoped>
.ns-notification-dropdown {
    position: relative;
}

.ns-bell-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text2);
    cursor: pointer;
    transition: all 150ms;
}

.ns-bell-btn:hover {
    border-color: var(--accent);
    color: var(--text);
}

.ns-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    background: var(--danger, #C75B4A);
    color: white;
    font-size: 10px;
    font-weight: 600;
    line-height: 16px;
    text-align: center;
    border-radius: 8px;
    border: 2px solid var(--bg, #fff);
}

[data-mode="dark"] .ns-badge {
    border-color: var(--bg-dark, #1a1d23);
}

[data-mode="dark"] .ns-dropdown {
    background: var(--bg-dark, #1a1d23);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.ns-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    width: 320px;
    max-height: 400px;
    background: var(--bg, #fff);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    z-index: 1000;
    overflow: hidden;
}

.ns-dropdown-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
}

.ns-dropdown-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
}

.ns-clear-btn {
    padding: 4px 8px;
    border: none;
    background: transparent;
    color: var(--accent);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    border-radius: 4px;
}

.ns-clear-btn:hover {
    background: var(--accentSoft);
}

.ns-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 32px 16px;
    color: var(--text3);
}

.ns-empty span {
    font-size: 12px;
}

.ns-list {
    max-height: 340px;
    overflow-y: auto;
}

.ns-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--borderSoft);
    cursor: pointer;
    transition: background 100ms;
}

.ns-item:hover {
    background: var(--surface2);
}

.ns-item:last-child {
    border-bottom: none;
}

.ns-item-icon {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    background: var(--accentSoft);
    color: var(--accent);
    border-radius: 8px;
}

.ns-item-content {
    flex: 1;
    min-width: 0;
}

.ns-item-title {
    font-size: 12px;
    font-weight: 500;
    color: var(--text);
    margin-bottom: 2px;
}

.ns-item-meta {
    font-size: 11px;
    color: var(--text3);
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}

.ns-item-pihak {
    color: var(--text2);
}

.ns-item-time {
    flex-shrink: 0;
    font-size: 10px;
    color: var(--text3);
    white-space: nowrap;
}

.ns-backdrop {
    position: fixed;
    inset: 0;
    z-index: 99;
}
</style>
