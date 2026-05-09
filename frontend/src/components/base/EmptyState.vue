<script setup>
import Icon from '../Icon.vue'

const props = defineProps({
    icon: { type: String, default: 'folder' },
    title: { type: String, default: 'Tidak Ada Data' },
    description: { type: String, default: '' },
    actions: { type: Array, default: () => [] }
})

const emit = defineEmits(['action'])
</script>

<template>
    <div class="ns-empty-state">
        <div class="ns-empty-icon-wrap">
            <Icon :name="icon" :size="32" />
        </div>
        <h3 class="ns-empty-title">{{ title }}</h3>
        <p v-if="description" class="ns-empty-description">{{ description }}</p>
        <div v-if="actions.length" class="ns-empty-actions">
            <button
                v-for="(action, i) in actions"
                :key="i"
                type="button"
                class="ns-empty-action"
                @click="emit('action', action)"
            >
                <Icon v-if="action.icon" :name="action.icon" :size="14" />
                {{ action.label }}
            </button>
        </div>
    </div>
</template>

<style scoped>
.ns-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;
}

.ns-empty-icon-wrap {
    display: grid;
    place-items: center;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--surface2);
    color: var(--text3);
    margin-bottom: 16px;
}

.ns-empty-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
    margin: 0 0 6px 0;
}

.ns-empty-description {
    font-size: 12px;
    color: var(--text3);
    max-width: 280px;
    margin: 0 0 20px 0;
}

.ns-empty-actions {
    display: flex;
    gap: 10px;
}

.ns-empty-action {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms;
}

.ns-empty-action:hover {
    border-color: var(--accent);
    background: var(--accentSoft);
    color: var(--accent);
}

.ns-empty-action.primary {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
}

.ns-empty-action.primary:hover {
    background: var(--accent2);
}
</style>
