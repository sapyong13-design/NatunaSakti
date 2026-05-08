<script setup>
import { ref, reactive } from 'vue'
import { useTheme } from '../composables/useTheme'
import Sidebar from '../components/shell/Sidebar.vue'
import TopBar from '../components/shell/TopBar.vue'
import { SIDEBAR_ITEMS } from '../data/sidebarItems.js'

const theme = useTheme()
const collapsed = ref(false)
const expandedGroups = reactive({ bulanan: true })

function toggleGroup(id) {
    expandedGroups[id] = !expandedGroups[id]
}
</script>

<template>
    <div class="ns-app ns-skin-c" :data-mode="theme.mode.value">
        <div class="ns-c-hero-bg" />
        <Sidebar
            :items="SIDEBAR_ITEMS"
            :collapsed="collapsed"
            :expanded-groups="expandedGroups"
            @update:collapsed="collapsed = $event"
            @toggle-group="toggleGroup"
        />
        <main class="ns-main">
            <TopBar />
            <div class="ns-page">
                <slot />
            </div>
        </main>
    </div>
</template>
