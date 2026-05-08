<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import Icon from '../Icon.vue'

defineProps({
    start: { type: String, default: '' },
    end: { type: String, default: '' },
    format: { type: String, default: 'pdf' },
    loading: { type: Boolean, default: false },
    exporting: { type: Boolean, default: false },
    canExport: { type: Boolean, default: false }
})

const emit = defineEmits(['update:start', 'update:end', 'update:format', 'fetch', 'export'])

const openMenu = ref(null)
const menuPos = reactive({ top: 0, left: 0 })
const formatBtn = ref(null)

function toggleMenu(name) {
    if (openMenu.value === name) { openMenu.value = null; return }
    const el = formatBtn.value
    if (el) {
        const rect = el.getBoundingClientRect()
        menuPos.top = rect.bottom + 6
        menuPos.left = rect.left
    }
    openMenu.value = name
}

function selectFormat(f) {
    emit('update:format', f)
    openMenu.value = null
}

function handleClickOutside(e) {
    if (!e.target.closest('.ns-chip-teleport') && !e.target.closest('.ns-filter-chip')) {
        openMenu.value = null
    }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))
</script>

<template>
    <div class="ns-toolbar">
        <div class="ns-toolbar-filters">
            <div class="ns-filter-chip">
                <span class="ns-chip-btn" style="cursor: default;">
                    <span class="ns-chip-label">Mulai:</span>
                    <input type="date"
                           :value="start"
                           @input="emit('update:start', $event.target.value)"
                           style="border: 0; background: transparent; color: inherit; font-size: inherit; outline: none;">
                </span>
            </div>

            <div class="ns-filter-chip">
                <span class="ns-chip-btn" style="cursor: default;">
                    <span class="ns-chip-label">Akhir:</span>
                    <input type="date"
                           :value="end"
                           @input="emit('update:end', $event.target.value)"
                           style="border: 0; background: transparent; color: inherit; font-size: inherit; outline: none;">
                </span>
            </div>

            <div class="ns-filter-chip" ref="formatBtn">
                <button type="button" class="ns-chip-btn"
                        :class="{ 'is-open': openMenu === 'format' }"
                        @click.stop="toggleMenu('format')">
                    <span class="ns-chip-label">Format:</span>
                    <span class="ns-chip-value">{{ format.toUpperCase() }}</span>
                    <Icon name="chevronDown" :size="12" />
                </button>
            </div>
        </div>

        <div style="display: flex; gap: 8px;">
            <button type="button" class="ns-btn ns-btn-ghost" :disabled="loading" @click="emit('fetch')">
                <Icon name="refresh" :size="14" />
                {{ loading ? 'Memuat...' : 'Tampilkan' }}
            </button>
            <button type="button" class="ns-btn ns-btn-primary" :disabled="exporting || !canExport" @click="emit('export')">
                <Icon name="filePlus" :size="14" />
                {{ exporting ? 'Exporting...' : `Export ${format.toUpperCase()}` }}
            </button>
        </div>
    </div>

    <Teleport to="body">
        <div
            v-if="openMenu === 'format'"
            class="ns-chip-menu ns-chip-teleport"
            :style="{ position: 'fixed', top: menuPos.top + 'px', left: menuPos.left + 'px' }"
        >
            <div class="ns-chip-option" :class="{ 'is-selected': format === 'pdf' }" @click="selectFormat('pdf')">PDF</div>
            <div class="ns-chip-option" :class="{ 'is-selected': format === 'docx' }" @click="selectFormat('docx')">DOCX (Word)</div>
        </div>
    </Teleport>
</template>
