<script setup>
import Icon from '../Icon.vue'

defineProps({
    show: { type: Boolean, default: false },
    items: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    title: { type: String, default: 'Riwayat Generate Laporan' }
})

const emit = defineEmits(['close', 'delete'])

function formatGeneratedAt(value) {
    if (!value) return '-'
    const date = new Date(value.replace(' ', 'T'))
    if (isNaN(date.getTime())) return value
    return date.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })
}
</script>

<template>
    <Teleport to="body">
        <Transition name="ns-history-modal">
            <div v-if="show" class="ns-history-backdrop" @click.self="emit('close')">
                <section class="ns-history-dialog" role="dialog" aria-modal="true" aria-labelledby="report-history-title">
                    <header class="ns-history-head">
                        <div>
                            <p class="ns-history-eyebrow">Database</p>
                            <h2 id="report-history-title">{{ title }}</h2>
                        </div>
                        <button type="button" class="ns-icon-btn" aria-label="Tutup riwayat" @click="emit('close')">
                            <Icon name="close" :size="16" />
                        </button>
                    </header>

                    <div class="ns-history-body">
                        <div v-if="loading" class="ns-history-empty">Memuat riwayat…</div>
                        <div v-else-if="!items.length" class="ns-history-empty">Belum ada laporan yang digenerate.</div>
                        <article v-for="item in items" v-else :key="item.id" class="ns-history-item">
                            <div class="ns-history-main">
                                <div class="ns-history-file" :title="item.filename">{{ item.filename }}</div>
                                <div class="ns-history-meta">
                                    <span>{{ item.tipe === 'bulanan' ? 'Bulanan' : 'Mingguan' }}</span>
                                    <span>{{ item.jenis }}</span>
                                    <span>{{ item.periode_label }}</span>
                                    <span>{{ String(item.format).toUpperCase() }}</span>
                                </div>
                                <div class="ns-history-time">Generate: {{ formatGeneratedAt(item.generated_at) }}</div>
                            </div>
                            <button
                                type="button"
                                class="ns-delete-btn"
                                aria-label="Hapus riwayat generate"
                                @click="emit('delete', item)"
                            >
                                <Icon name="trash" :size="14" />
                                <span>Hapus</span>
                            </button>
                        </article>
                    </div>
                </section>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.ns-history-backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal, 1600);
    display: grid;
    place-items: center;
    padding: 20px;
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(5px);
}

.ns-history-dialog {
    width: min(760px, calc(100vw - 24px));
    max-height: min(680px, calc(100vh - 24px));
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #ffffff;
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.35);
}

[data-mode="dark"] .ns-history-dialog {
    background: #1a1d23;
}

.ns-history-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 18px 18px 14px;
    border-bottom: 1px solid var(--border);
    background: inherit;
}

.ns-history-eyebrow {
    margin: 0 0 4px;
    color: var(--accent);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
}

.ns-history-head h2 {
    margin: 0;
    color: var(--text);
    font-size: 20px;
    line-height: 1.2;
}

.ns-icon-btn {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text2);
    cursor: pointer;
}

.ns-history-body {
    display: grid;
    gap: 10px;
    padding: 14px;
    overflow: auto;
    background: inherit;
}

.ns-history-empty {
    padding: 36px 16px;
    text-align: center;
    color: var(--text3);
    font-weight: 600;
}

.ns-history-item {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: #f8fafc;
}

[data-mode="dark"] .ns-history-item {
    background: #111827;
}

.ns-history-main {
    min-width: 0;
}

.ns-history-file {
    overflow: hidden;
    color: var(--text);
    font-size: 13px;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.ns-history-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 7px;
}

.ns-history-meta span {
    padding: 3px 7px;
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--text2);
    font-size: 11px;
    font-weight: 700;
}

.ns-history-time {
    margin-top: 7px;
    color: var(--text3);
    font-size: 11px;
}

.ns-delete-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 10px;
    border: 1px solid color-mix(in srgb, var(--danger, #C75B4A) 35%, var(--border));
    border-radius: 8px;
    background: color-mix(in srgb, var(--danger, #C75B4A) 8%, var(--surface));
    color: var(--danger, #C75B4A);
    cursor: pointer;
    font-size: 12px;
    font-weight: 700;
}

.ns-history-modal-enter-active,
.ns-history-modal-leave-active {
    transition: opacity 180ms ease;
}

.ns-history-modal-enter-from,
.ns-history-modal-leave-to {
    opacity: 0;
}

@media (max-width: 560px) {
    .ns-history-item {
        grid-template-columns: 1fr;
    }

    .ns-delete-btn {
        justify-content: center;
        width: 100%;
    }
}
</style>
