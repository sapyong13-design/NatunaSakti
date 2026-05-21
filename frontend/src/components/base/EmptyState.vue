<script setup>
import { computed } from 'vue'
import Icon from '../Icon.vue'

const props = defineProps({
    icon: { type: String, default: 'folder' },
    title: { type: String, default: 'Tidak Ada Data' },
    description: { type: String, default: '' },
    actions: { type: Array, default: () => [] }
})

const emit = defineEmits(['action'])

const illustrationType = computed(() => {
    if (props.title.toLowerCase().includes('perkara') || props.title.toLowerCase().includes('sidang')) {
        return 'gavel'
    }
    if (props.title.toLowerCase().includes('jadwal') || props.title.toLowerCase().includes('kalender')) {
        return 'calendar'
    }
    if (props.title.toLowerCase().includes('cari') || props.title.toLowerCase().includes('hasil')) {
        return 'search'
    }
    return 'default'
})
</script>

<template>
    <div class="ns-empty-state">
        <!-- Custom SVG Illustration -->
        <svg v-if="illustrationType === 'gavel'" class="ns-empty-illustration" viewBox="0 0 120 100" fill="none">
            <rect x="20" y="40" width="60" height="12" rx="3" fill="var(--accent)" opacity="0.15"/>
            <rect x="35" y="30" width="30" height="8" rx="2" fill="var(--accent)" opacity="0.25"/>
            <circle cx="60" cy="65" r="20" fill="var(--accent)" opacity="0.08"/>
            <path d="M50 55L55 65L65 65L70 55" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.4"/>
            <circle cx="50" cy="45" r="3" fill="var(--accent)" opacity="0.3"/>
            <circle cx="70" cy="45" r="3" fill="var(--accent)" opacity="0.3"/>
        </svg>

        <svg v-else-if="illustrationType === 'calendar'" class="ns-empty-illustration" viewBox="0 0 120 100" fill="none">
            <rect x="30" y="25" width="50" height="45" rx="4" stroke="var(--accent)" stroke-width="2" fill="var(--accent)" opacity="0.08"/>
            <path d="M30 38H80" stroke="var(--accent)" stroke-width="2" opacity="0.3"/>
            <circle cx="42" cy="52" r="4" fill="var(--accent)" opacity="0.2"/>
            <circle cx="58" cy="52" r="4" fill="var(--accent)" opacity="0.2"/>
            <circle cx="68" cy="52" r="4" fill="var(--accent)" opacity="0.2"/>
            <path d="M40 25V20M70 25V20" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" opacity="0.4"/>
        </svg>

        <svg v-else-if="illustrationType === 'search'" class="ns-empty-illustration" viewBox="0 0 120 100" fill="none">
            <circle cx="55" cy="50" r="25" stroke="var(--accent)" stroke-width="2" fill="var(--accent)" opacity="0.08"/>
            <circle cx="55" cy="50" r="18" stroke="var(--accent)" stroke-width="1.5" opacity="0.2"/>
            <line x1="72" y1="67" x2="85" y2="80" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" opacity="0.3"/>
            <path d="M48 46L52 50L62 40" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.25"/>
        </svg>

        <svg v-else class="ns-empty-illustration" viewBox="0 0 120 100" fill="none">
            <rect x="25" y="30" width="45" height="35" rx="4" stroke="var(--accent)" stroke-width="2" fill="var(--accent)" opacity="0.08"/>
            <line x1="35" y1="42" x2="60" y2="42" stroke="var(--accent)" stroke-width="1.5" opacity="0.25"/>
            <line x1="35" y1="50" x2="55" y2="50" stroke="var(--accent)" stroke-width="1.5" opacity="0.2"/>
            <line x1="35" y1="58" x2="50" y2="58" stroke="var(--accent)" stroke-width="1.5" opacity="0.15"/>
            <circle cx="80" cy="70" r="15" fill="var(--accent)" opacity="0.06"/>
            <circle cx="85" cy="25" r="8" fill="var(--accent)" opacity="0.1"/>
        </svg>

        <div class="ns-empty-icon-wrap">
            <Icon :name="icon" :size="28" />
        </div>
        <h3 class="ns-empty-title">{{ title }}</h3>
        <p v-if="description" class="ns-empty-description">{{ description }}</p>
        <div v-if="actions.length" class="ns-empty-actions">
            <button
                v-for="(action, i) in actions"
                :key="i"
                type="button"
                class="ns-empty-action"
                :class="action.class"
                :aria-label="action.label"
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
    position: relative;
}

.ns-empty-illustration {
    width: 100px;
    height: 80px;
    margin-bottom: 8px;
    opacity: 0.8;
}

.ns-empty-icon-wrap {
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--surface2);
    color: var(--accent);
    margin-bottom: 16px;
    box-shadow: 0 4px 16px var(--accentGlow);
}

.ns-empty-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--text);
    margin: 0 0 6px 0;
    font-family: inherit;
}

.ns-empty-description {
    font-size: 13px;
    color: var(--text2);
    max-width: 300px;
    margin: 0 0 20px 0;
    line-height: 1.6;
}

.ns-empty-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: center;
}

.ns-empty-action {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 18px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
    color: var(--text);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 180ms ease, border-color 180ms ease, color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
}

.ns-empty-action:hover {
    border-color: var(--accent);
    background: var(--accentSoft);
    color: var(--accent);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px var(--accentGlow);
}

.ns-empty-action.primary {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
}

.ns-empty-action.primary:hover {
    background: var(--accent2);
    box-shadow: 0 4px 16px var(--accentGlow);
}
</style>
