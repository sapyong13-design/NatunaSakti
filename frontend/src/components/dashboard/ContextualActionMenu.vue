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
    min-width: 220px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.2);
    z-index: 1000;
    padding: 8px;
    overflow: hidden;
    /* Blur backdrop */
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    will-change: transform, opacity;
}

[data-mode="light"] .ns-context-menu {
    background: rgba(255, 255, 255, 0.95);
    border-color: rgba(74, 28, 27, 0.15);
    box-shadow: 0 12px 48px rgba(74, 28, 27, 0.15), 0 0 0 1px rgba(74, 28, 27, 0.05);
}

[data-mode="dark"] .ns-context-menu {
    background: rgba(30, 33, 41, 0.95);
    border-color: rgba(212, 184, 150, 0.15);
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.4);
}

.ns-context-menu-header {
    padding: 10px 12px;
    background: var(--surface2);
    border-radius: 8px;
    margin-bottom: 6px;
    border: 1px solid var(--border);
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
    color: var(--text3);
    margin-top: 2px;
    font-weight: 500;
}

.ns-context-menu-divider {
    height: 1px;
    background: var(--border);
    margin: 8px 0;
}

.ns-context-menu-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--text);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 180ms cubic-bezier(0.32, 0.72, 0, 1);
    overflow: hidden;
}

/* Ripple effect container */
.ns-context-menu-item::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at var(--ripple-x, 50%) var(--ripple-y, 50%), rgba(74, 28, 27, 0.15), transparent 60%);
    opacity: 0;
    transition: opacity 0.3s;
    pointer-events: none;
}

.ns-context-menu-item:hover::before {
    opacity: 1;
}

.ns-context-menu-item:hover {
    background: var(--accentSoft);
    color: var(--accent);
    transform: translateX(4px);
}

.ns-context-menu-item svg {
    color: var(--item-color);
    position: relative;
    z-index: 1;
}

.ns-context-menu-item span {
    position: relative;
    z-index: 1;
}

/* Enhanced animations */
.ns-context-menu-enter-active {
    transition: all 220ms cubic-bezier(0.32, 0.72, 0, 1);
}

.ns-context-menu-leave-active {
    transition: all 180ms cubic-bezier(0.32, 0.72, 0, 1);
}

.ns-context-menu-enter-from {
    opacity: 0;
    transform: scale(0.92) translateY(-8px);
}

.ns-context-menu-leave-to {
    opacity: 0;
    transform: scale(0.95) translateY(-4px);
}

/* Staggered item animations */
.ns-context-menu-item {
    animation: itemSlideIn 0.2s ease-out backwards;
}

.ns-context-menu-item:nth-child(4) { animation-delay: 0.03s; }
.ns-context-menu-item:nth-child(5) { animation-delay: 0.05s; }
.ns-context-menu-item:nth-child(6) { animation-delay: 0.07s; }
.ns-context-menu-item:nth-child(7) { animation-delay: 0.09s; }

@keyframes itemSlideIn {
    from {
        opacity: 0;
        transform: translateX(-8px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}
</style>
