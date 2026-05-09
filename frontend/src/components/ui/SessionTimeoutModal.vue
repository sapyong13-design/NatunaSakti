<script setup>
defineProps({
    show: { type: Boolean, default: false },
    timeRemaining: { type: String, default: '5:00' }
})

const emit = defineEmits(['extend', 'logout'])
</script>

<template>
    <Teleport to="body">
        <Transition name="ns-timeout-modal">
            <div v-if="show" class="ns-timeout-backdrop">
                <div class="ns-timeout-dialog" role="dialog" aria-labelledby="timeout-title">
                    <div class="ns-timeout-icon">⏰</div>

                    <h3 id="timeout-title" class="ns-timeout-title">Sesi Segera Berakhir</h3>

                    <p class="ns-timeout-message">
                        Anda akan otomatis keluar karena tidak ada aktivitas.
                        <br>Waktu tersisa: <strong>{{ timeRemaining }}</strong>
                    </p>

                    <div class="ns-timeout-actions">
                        <button
                            type="button"
                            class="ns-btn ns-btn-extend"
                            @click="$emit('extend')"
                        >
                            🔄 Perpanjang Sesi
                        </button>
                        <button
                            type="button"
                            class="ns-btn ns-btn-logout"
                            @click="$emit('logout')"
                        >
                            Keluar Sekarang
                        </button>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.ns-timeout-backdrop {
    position: fixed;
    inset: 0;
    z-index: 99999;
    display: grid;
    place-items: center;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    animation: ns-fade-in 0.2s ease;
}

@keyframes ns-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
}

.ns-timeout-dialog {
    position: relative;
    width: 90%;
    max-width: 420px;
    padding: 32px 28px;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: 20px;
    box-shadow: 0 24px 60px -12px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    animation: ns-slide-up 0.4s cubic-bezier(0.32, 0.72, 0, 1);
}

@keyframes ns-slide-up {
    from {
        opacity: 0;
        transform: translateY(24px) scale(0.95);
    }
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

.ns-timeout-icon {
    font-size: 48px;
    margin-bottom: 20px;
    animation: ns-pulse 2s ease-in-out infinite;
}

@keyframes ns-pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
}

.ns-timeout-title {
    font-size: 20px;
    font-weight: 600;
    color: var(--text);
    margin: 0 0 12px;
}

.ns-timeout-message {
    font-size: 14px;
    color: var(--text-2);
    line-height: 1.6;
    margin: 0 0 24px;
}

.ns-timeout-actions {
    display: flex;
    gap: 12px;
    width: 100%;
}

.ns-btn {
    flex: 1;
    height: 44px;
    padding: 0 16px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
}

.ns-btn-extend {
    background: linear-gradient(180deg, var(--accent), var(--accent-2));
    border-color: transparent;
    color: white;
    box-shadow: 0 4px 14px -4px var(--accent-glow);
}

.ns-btn-extend:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 18px -4px var(--accent-glow);
}

.ns-btn-logout {
    background: var(--surface-2);
    border: 1px solid var(--border);
    color: var(--text);
}

.ns-btn-logout:hover {
    background: var(--surface-3);
    border-color: var(--text-3);
}

.ns-timeout-modal-enter-active,
.ns-timeout-modal-leave-active {
    transition: opacity 0.2s ease;
}

.ns-timeout-modal-enter-from,
.ns-timeout-modal-leave-to {
    opacity: 0;
}

.ns-timeout-modal-leave-active .ns-timeout-dialog {
    animation: ns-slide-down 0.3s ease forwards;
}

@keyframes ns-slide-down {
    to {
        opacity: 0;
        transform: translateY(16px) scale(0.95);
    }
}
</style>
