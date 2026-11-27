<script setup>
import { ref, nextTick } from 'vue'

const activeTab = ref('data')
const tabButtons = ref([])
const tabs = [
    { key: 'data', label: 'Data Perkara' },
    { key: 'leaderboard', label: 'Leaderboard Hakim' }
]

async function onTabKeydown(event, index) {
    let target
    if (event.key === 'ArrowRight') target = (index + 1) % tabs.length
    else if (event.key === 'ArrowLeft') target = (index + tabs.length - 1) % tabs.length
    else if (event.key === 'Home') target = 0
    else if (event.key === 'End') target = tabs.length - 1
    else return
    event.preventDefault()
    activeTab.value = tabs[target].key
    await nextTick()
    tabButtons.value[target]?.focus()
}
</script>

<template>
    <div class="dashboard-tabs">
        <div class="dashboard-tab-list" role="tablist" aria-label="Tampilan dashboard">
            <button v-for="(tab, index) in tabs" :id="`dashboard-tab-${tab.key}`" :key="tab.key" :ref="el => tabButtons[index] = el"
                type="button" role="tab" :aria-selected="activeTab === tab.key"
                :aria-controls="`dashboard-panel-${tab.key}`" :tabindex="activeTab === tab.key ? 0 : -1"
                @click="activeTab = tab.key" @keydown="onTabKeydown($event, index)">{{ tab.label }}</button>
        </div>
        <section v-for="tab in tabs" :id="`dashboard-panel-${tab.key}`" :key="tab.key"
            role="tabpanel" :aria-labelledby="`dashboard-tab-${tab.key}`" :hidden="activeTab !== tab.key" tabindex="0">
            <slot :name="tab.key" />
        </section>
    </div>
</template>

<style scoped>
.dashboard-tab-list { display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 1px solid var(--ns-border, #d8dee4); }
.dashboard-tab-list button { font: inherit; font-weight: 600; color: inherit; background: transparent; border: 0; border-bottom: 3px solid transparent; padding: 12px 16px; cursor: pointer; }
.dashboard-tab-list button[aria-selected="true"] { color: var(--accent, var(--ns-primary, #2563eb)); border-bottom-color: currentColor; }
.dashboard-tab-list button:focus-visible, [role="tabpanel"]:focus-visible { outline: 2px solid var(--accent, var(--ns-primary, #2563eb)); outline-offset: 3px; }
[hidden] { display: none !important; }
</style>
