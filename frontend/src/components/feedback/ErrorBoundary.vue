<script setup>
import { ref, onErrorCaptured } from 'vue'

const props = defineProps({
    fallback: { type: String, default: 'Terjadi kesalahan' }
})

const emit = defineEmits(['error'])

const hasError = ref(false)
const errorMessage = ref('')

onErrorCaptured((err, instance, info) => {
    console.error('Error captured by boundary:', err, info)
    hasError.value = true
    errorMessage.value = err.message || 'Terjadi kesalahan tidak terduga'
    emit('error', { error: err, info })

    // Prevent error from propagating
    return false
})

function retry() {
    hasError.value = false
    errorMessage.value = ''
    window.location.reload()
}
</script>

<template>
    <slot v-if="!hasError" />
    <div v-else class="ns-error-boundary">
        <div class="ns-error-icon">⚠️</div>
        <h3 class="ns-error-title">Oops! Terjadi Kesalahan</h3>
        <p class="ns-error-message">{{ errorMessage }}</p>
        <div class="ns-error-actions">
            <button class="ns-btn ns-btn-primary" @click="retry">
                🔄 Muat Ulang
            </button>
            <button class="ns-btn ns-btn-ghost" @click="$emit('dismiss')">
                Tutup
            </button>
        </div>
    </div>
</template>

<style scoped>
.ns-error-boundary {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;
    min-height: 400px;
}

.ns-error-icon {
    font-size: 48px;
    margin-bottom: 16px;
}

.ns-error-title {
    font-size: 20px;
    font-weight: 600;
    color: var(--text);
    margin: 0 0 8px;
}

.ns-error-message {
    font-size: 14px;
    color: var(--text-2);
    margin: 0 0 24px;
    max-width: 400px;
}

.ns-error-actions {
    display: flex;
    gap: 12px;
}

.ns-btn {
    height: 40px;
    padding: 0 16px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid var(--border);
}

.ns-btn-primary {
    background: linear-gradient(180deg, var(--accent), var(--accent-2));
    border-color: transparent;
    color: white;
}

.ns-btn-ghost {
    background: var(--surface-2);
    color: var(--text);
}
</style>
