<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import Icon from '../Icon.vue'

const props = defineProps({
    show: { type: Boolean, default: false },
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    row: { type: Object, default: null }
})

const emit = defineEmits(['close', 'action'])

const menuRef = ref(null)

const menuItems = computed(() => [
    { key: 'detail', icon: 'eye', label: 'Lihat Detail', color: 'var(--accent)' },
    { key: 'refresh', icon: 'refresh', label: 'Refresh Jadwal', color: '#10b981' },
    { key: 'copy', icon: 'clipboard', label: 'Copy Nomor Perkara', color: '#6366f1' },
    { key: 'sipp', icon: 'external', label: 'Buka di SIPP', color: '#f59e0b' }
])

function handleAction(key) {
    emit('action', { key, row: props.row })
    emit('close')
}

function handleClickOutside(e) {
    if (menuRef.value && !menuRef.value.contains(e.target)) {
        emit('close')
    }
}

function handleEscape(e) {
    if (e.key === 'Escape') {
        emit('close')
    }
}

onMounted(() => {
    document.addEventListener('click', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside)
    document.removeEventListener('keydown', handleEscape)
})

// Position menu to stay within viewport
const menuStyle = computed(() => {
    const style = { left: `${props.x}px`, top: `${props.y}px` }

    if (typeof window !== 'undefined') {
        const menuWidth = 200
        const menuHeight = menuItems.value.length * 40 + 8

        if (props.x + menuWidth > window.innerWidth) {
            style.left = `${props.x - menuWidth}px`
        }
        if (props.y + menuHeight > window.innerHeight) {
            style.top = `${props.y - menuHeight}px`
        }
    }

    return style
})
</script>

<template>
    <Teleport to="body">
        <Transition name="ns-context-menu">
            <div
                v-if="show"
                ref="menuRef"
                class="ns-context-menu"
                :style="menuStyle"
            >
                <div class="ns-context-menu-header">
                    <span class="ns-context-menu-nomor">{{ row?.nomor_perkara }}</span>
                    <span class="ns-context-menu-jenis">{{ row?.jenis_perkara }}</span>
                </div>
                <div class="ns-context-menu-divider"></div>
                <button
                    v-for="item in menuItems"
                    :key="item.key"
                    class="ns-context-menu-item"
                    :style="{ '--item-color': item.color }"
                    @click="handleAction(item.key)"
                >
                    <Icon :name="item.icon" :size="14" />
                    <span>{{ item.label }}</span>
                </button>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.ns-context-menu {
    position: fixed;
    min-width: 200px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    padding: 6px;
    overflow: hidden;
}

.ns-context-menu-header {
    padding: 8px 10px;
    background: var(--surface-2);
    border-radius: 6px;
    margin-bottom: 4px;
}

.ns-context-menu-nomor {
    display: block;
    font-family: "JetBrains Mono", monospace;
    font-size: 11px;
    font-weight: 600;
    color: var(--text);
}

.ns-context-menu-jenis {
    display: block;
    font-size: 10px;
    color: var(--text-3);
    margin-top: 2px;
}

.ns-context-menu-divider {
    height: 1px;
    background: var(--border);
    margin: 6px 0;
}

.ns-context-menu-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 10px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
}

.ns-context-menu-item:hover {
    background: var(--accent-soft);
    color: var(--accent);
}

.ns-context-menu-item svg {
    color: var(--item-color);
}

[data-mode="light"] .ns-context-menu {
    background: #ffffff;
    border-color: #e5e7eb;
}

[data-mode="dark"] .ns-context-menu {
    background: #1e2129;
    border-color: #2d3748;
}

.ns-context-menu-enter-active,
.ns-context-menu-leave-active {
    transition: all 150ms ease;
}

.ns-context-menu-enter-from,
.ns-context-menu-leave-to {
    opacity: 0;
    transform: scale(0.95);
}

.ns-context-menu-enter-active .ns-context-menu-item,
.ns-context-menu-leave-active .ns-context-menu-item {
    transition-delay: 50ms;
}
</style>
