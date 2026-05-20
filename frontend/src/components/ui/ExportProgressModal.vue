<script setup>
defineProps({
    show: { type: Boolean, default: false },
    progress: { type: Number, default: 0 },
    stepName: { type: String, default: '' },
    eta: { type: String, default: null },
    filename: { type: String, default: '' }
})
</script>

<template>
    <Teleport to="body">
        <Transition name="ns-export-modal">
            <div v-if="show" class="ns-export-backdrop">
                <div class="ns-export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-title">
                    <div class="ns-export-header">
                        <div class="ns-export-icon" aria-hidden="true">DOC</div>
                        <div class="ns-export-title">
                            <h3 id="export-title"> Mengeksport Dokumen</h3>
                            <p v-if="filename" class="ns-export-filename">{{ filename }}</p>
                        </div>
                    </div>

                    <div class="ns-export-body">
                        <div class="ns-export-progress-wrap">
                            <div class="ns-export-progress-bar">
                                <div
                                    class="ns-export-progress-fill"
                                    :style="{ width: `${progress}%` }"
                                />
                            </div>
                            <div class="ns-export-progress-text">{{ progress }}%</div>
                        </div>

                        <div class="ns-export-step">
                            <span class="ns-export-step-label">{{ stepName }}</span>
                            <span v-if="eta" class="ns-export-eta">Estimasi: {{ eta }}</span>
                        </div>
                    </div>

                    <div class="ns-export-footer">
                        <span class="ns-export-hint">Jangan tutup halaman ini saat proses berlangsung</span>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.ns-export-backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal, 1600);
    display: grid;
    place-items: center;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
}

.ns-export-dialog {
    width: 90%;
    max-width: 400px;
    padding: 24px;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: 16px;
    box-shadow: 0 20px 60px -12px rgba(0, 0, 0, 0.4);
}

.ns-export-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 24px;
}

.ns-export-icon {
    width: 48px;
    height: 48px;
    display: grid;
    place-items: center;
    font-size: 24px;
    background: var(--surface-2);
    border-radius: 12px;
}

.ns-export-title h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text);
}

.ns-export-filename {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--text-2);
    font-family: "JetBrains Mono", monospace;
}

.ns-export-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.ns-export-progress-wrap {
    display: flex;
    align-items: center;
    gap: 12px;
}

.ns-export-progress-bar {
    flex: 1;
    height: 8px;
    background: var(--surface-2);
    border-radius: 100px;
    overflow: hidden;
}

.ns-export-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), var(--accent-2));
    border-radius: 100px;
    transition: width 0.3s ease;
}

.ns-export-progress-text {
    font-family: "JetBrains Mono", monospace;
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
    min-width: 40px;
    text-align: right;
}

.ns-export-step {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.ns-export-step-label {
    font-size: 13px;
    color: var(--text-2);
}

.ns-export-eta {
    font-size: 12px;
    color: var(--text-3);
}

.ns-export-footer {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
}

.ns-export-hint {
    font-size: 11px;
    color: var(--text-3);
    text-align: center;
}

/* Transitions */
.ns-export-modal-enter-active,
.ns-export-modal-leave-active {
    transition: opacity 0.2s ease;
}

.ns-export-modal-enter-active .ns-export-dialog,
.ns-export-modal-leave-active .ns-export-dialog {
    transition: opacity 0.3s cubic-bezier(0.32, 0.72, 0, 1),
                transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

.ns-export-modal-enter-from,
.ns-export-modal-leave-to {
    opacity: 0;
}

.ns-export-modal-enter-from .ns-export-dialog,
.ns-export-modal-leave-to .ns-export-dialog {
    opacity: 0;
    transform: scale(0.95) translateY(16px);
}
</style>
