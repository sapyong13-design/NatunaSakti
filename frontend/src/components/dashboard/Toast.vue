<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import Icon from '../Icon.vue'

const props = defineProps({
    show: { type: Boolean, default: false },
    type: { type: String, default: 'success' }, // success, error, warning, info
    message: { type: String, default: '' },
    duration: { type: Number, default: 3000 }
})

const emit = defineEmits(['close'])

const isVisible = ref(false)
const progress = ref(100)

const typeConfig = computed(() => {
    const configs = {
        success: { icon: 'check', color: 'var(--success)' },
        error: { icon: 'close', color: 'var(--danger)' },
        warning: { icon: 'bell', color: 'var(--warn)' },
        info: { icon: 'dot', color: 'var(--accent)' }
    }
    return configs[props.type] || configs.info
})

function close() {
    isVisible.value = false
    setTimeout(() => emit('close'), 200)
}

function startProgress() {
    progress.value = 100
    const interval = setInterval(() => {
        progress.value -= 100 / (props.duration / 50)
        if (progress.value <= 0) {
            clearInterval(interval)
            close()
        }
    }, 50)
    return interval
}

let progressInterval = null

watch(() => props.show, (show) => {
    if (show) {
        isVisible.value = true
        if (progressInterval) clearInterval(progressInterval)
        progressInterval = startProgress()
    } else {
        close()
    }
}, { immediate: true })

onMounted(() => {
    if (props.show) {
        isVisible.value = true
        progressInterval = startProgress()
    }
})
</script>

<template>
    <Teleport to="body">
        <Transition name="ns-toast">
            <div v-if="isVisible" class="ns-toast" :class="`ns-toast-${type}`">
                <div class="ns-toast-icon" :style="{ color: typeConfig.color }">
                    <Icon :name="typeConfig.icon" :size="18" />
                </div>
                <span class="ns-toast-message">{{ message }}</span>
                <button type="button" class="ns-toast-close" @click="close">
                    <Icon name="close" :size="14" />
                </button>
                <div class="ns-toast-progress" :style="{ width: progress + '%' }"></div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.ns-toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    min-width: 300px;
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
    overflow: hidden;
}

.ns-toast-icon {
    display: grid;
    place-items: center;
    flex-shrink: 0;
}

.ns-toast-message {
    flex: 1;
    font-size: 13px;
    font-weight: 500;
    color: var(--text);
}

.ns-toast-close {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    color: var(--text3);
    cursor: pointer;
    border-radius: 4px;
    transition: all 150ms;
}

.ns-toast-close:hover {
    background: var(--surface2);
    color: var(--text);
}

.ns-toast-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 3px;
    background: currentColor;
    opacity: 0.3;
    transition: width 50ms linear;
}

.ns-toast-success { color: var(--success); }
.ns-toast-error { color: var(--danger); }
.ns-toast-warning { color: var(--warn); }
.ns-toast-info { color: var(--accent); }

.ns-toast-enter-active,
.ns-toast-leave-active {
    transition: all 250ms cubic-bezier(0.32, 0.72, 0, 1);
}

.ns-toast-enter-from {
    opacity: 0;
    transform: translateY(20px) translateX(20px);
}

.ns-toast-leave-to {
    opacity: 0;
    transform: translateY(10px);
}
</style>
