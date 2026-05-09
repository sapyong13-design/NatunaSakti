<script setup>
import { formatShortcut } from '../../composables/useKeyboardShortcuts'

const props = defineProps({
    shortcut: { type: String, required: true }
})
</script>

<template>
    <span class="ns-kbd">
        <span v-for="(key, i) in shortcut.split('+')" :key="i" class="ns-kbd-key">
            {{ key === 'ctrl' ? 'Ctrl' : key === 'shift' ? 'Shift' : key === 'alt' ? 'Alt' : key }}
        </span>
    </span>
</template>

<style scoped>
.ns-kbd {
    display: inline-flex;
    align-items: center;
    gap: 2px;
}

.ns-kbd-key {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--surface2);
    font-size: 10px;
    font-weight: 500;
    font-family: "JetBrains Mono", monospace;
    color: var(--text3);
}
</style>
