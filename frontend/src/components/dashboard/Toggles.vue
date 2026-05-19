<script setup>
import { ref, watch } from 'vue'
import Icon from '../Icon.vue'

const props = defineProps({
    type: { type: String, default: 'density' }, // 'density' or 'compare'
    modelValue: { type: [String, Boolean], default: '' }
})

const emit = defineEmits(['update:modelValue'])

const localValue = ref(props.modelValue)

watch(() => props.modelValue, (val) => {
    localValue.value = val
})

watch(localValue, (val) => {
    emit('update:modelValue', val)
})

function setValue(val) {
    localValue.value = val
    if (props.type === 'density') {
        document.documentElement.dataset.density = val
    }
}
</script>

<template>
    <!-- Density Toggle -->
    <div v-if="type === 'density'" class="ns-toggle-group">
        <button
            type="button"
            class="ns-toggle-btn"
            :class="{ 'is-active': localValue === 'compact' }"
            aria-label="Kepadatan tabel rapat"
            title="Rapat"
            @click="setValue('compact')"
        >
            <Icon name="moreHorizontal" :size="12" />
        </button>
        <button
            type="button"
            class="ns-toggle-btn"
            :class="{ 'is-active': localValue === 'spacious' }"
            aria-label="Kepadatan tabel lega"
            title="Lega"
            @click="setValue('spacious')"
        >
            <Icon name="menu" :size="12" />
        </button>
    </div>

    <!-- Compare Toggle -->
    <button
        v-else
        type="button"
        class="ns-compare-toggle"
        :class="{ 'is-active': localValue }"
        @click="setValue(!localValue)"
    >
        <Icon :name="localValue ? 'check' : 'scale'" :size="12" />
        <span>Compare</span>
    </button>
</template>

<style scoped>
.ns-toggle-group {
    display: inline-flex;
    background: var(--surface2);
    border-radius: 8px;
    padding: 2px;
    flex-shrink: 0;
}

.ns-toggle-btn {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text3);
    cursor: pointer;
    transition: all 150ms;
}

.ns-toggle-btn:hover {
    color: var(--text2);
}

.ns-toggle-btn.is-active {
    background: var(--bg2);
    color: var(--text);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.ns-compare-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text2);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms;
}

.ns-compare-toggle:hover {
    border-color: var(--accent);
    background: var(--accentSoft);
    color: var(--accent);
}

.ns-compare-toggle.is-active {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
}
</style>
