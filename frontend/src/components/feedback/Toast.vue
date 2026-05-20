<script setup>
import { computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
    message: { type: String, required: true },
    type: { type: String, default: 'info' }, // info, success, warning, error
    duration: { type: Number, default: 4000 }
})

const emit = defineEmits(['close'])

const iconMap = {
    info: 'i',
    success: 'OK',
    warning: '!',
    error: 'x'
}

let timer = null

onMounted(() => {
    if (props.duration > 0) {
        timer = setTimeout(() => emit('close'), props.duration)
    }
})

onUnmounted(() => {
    if (timer) clearTimeout(timer)
})

const classes = computed(() => [
    'ns-toast',
    `ns-toast-${props.type}`
])
</script>

<template>
    <div :class="classes" role="alert" :aria-live="type === 'error' ? 'assertive' : 'polite'">
        <span class="ns-toast-icon">{{ iconMap[type] }}</span>
        <span class="ns-toast-message">{{ message }}</span>
        <button
            class="ns-toast-close"
            @click="emit('close')"
            aria-label="Tutup notifikasi"
        >x</button>
    </div>
</template>

<style scoped>
.ns-toast {
    display: flex;
    align-items: center;
    gap: 12px;
    width: max-content;
    min-width: min(320px, calc(100vw - 24px));
    max-width: min(480px, calc(100vw - 24px));
    padding: 14px 16px;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 8px 24px -8px rgba(0,0,0,0.3);
    animation: ns-toast-in 0.3s cubic-bezier(0.32, 0.72, 0, 1);
    z-index: var(--z-toast, 1500);
}

.nsToast-enter-active,
.nsToast-leave-active {
    transition: opacity 0.3s ease, transform 0.3s ease;
}

.nsToast-enter-from,
.nsToast-leave-to {
    opacity: 0;
    transform: translateX(100%);
}

@keyframes ns-toast-in {
    from {
        opacity: 0;
        transform: translateX(40px) scale(0.95);
    }
    to {
        opacity: 1;
        transform: translateX(0) scale(1);
    }
}

.ns-toast-icon {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    font-size: 14px;
    border-radius: 6px;
}

.ns-toast-message {
    flex: 1;
    font-size: 13px;
    line-height: 1.4;
    color: var(--text);
}

.ns-toast-close {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    border: none;
    background: transparent;
    color: var(--text-3);
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.15s ease, color 0.15s ease;
}

.ns-toast-close:hover {
    background: var(--surface-2);
    color: var(--text);
}

/* Type variants */
.ns-toast-info .ns-toast-icon {
    background: rgba(59, 130, 246, 0.15);
    color: #3b82f6;
}
.ns-toast-info {
    border-left: 3px solid #3b82f6;
}

.ns-toast-success .ns-toast-icon {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
}
.ns-toast-success {
    border-left: 3px solid #10b981;
}

.ns-toast-warning .ns-toast-icon {
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
}
.ns-toast-warning {
    border-left: 3px solid #f59e0b;
}

.ns-toast-error .ns-toast-icon {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
}
.ns-toast-error {
    border-left: 3px solid #ef4444;
}
</style>
