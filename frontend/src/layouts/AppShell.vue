<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useTheme } from '../composables/useTheme'
import { useToast } from '../composables/useToast'
import Sidebar from '../components/shell/Sidebar.vue'
import TopBar from '../components/shell/TopBar.vue'
import ToastContainer from '../components/feedback/ToastContainer.vue'
import { SIDEBAR_ITEMS } from '../data/sidebarItems.js'

const theme = useTheme()
const toast = useToast()
const collapsed = ref(false)
const mobileMenuOpen = ref(false)
const expandedGroups = reactive({})

let mq = null
function onMqChange(e) {
    if (e.matches) collapsed.value = true
}

onMounted(() => {
    mq = window.matchMedia('(max-width: 768px)')
    if (mq.matches) collapsed.value = true
    mq.addEventListener('change', onMqChange)
})

onUnmounted(() => {
    if (mq) mq.removeEventListener('change', onMqChange)
})

function toggleGroup(id) {
    expandedGroups[id] = !expandedGroups[id]
}

function toggleMobileMenu() {
    mobileMenuOpen.value = !mobileMenuOpen.value
}

// Close mobile menu when clicking outside
function handleBackdropClick() {
    mobileMenuOpen.value = false
}

function removeToast(id) {
    toast.remove(id)
}
</script>

<template>
    <div class="ns-app ns-skin-c" :data-mode="theme.mode.value">
        <div class="ns-c-hero-bg" />
        <Sidebar
            :items="SIDEBAR_ITEMS"
            :collapsed="collapsed"
            :expanded-groups="expandedGroups"
            :mobile-open="mobileMenuOpen"
            @update:collapsed="collapsed = $event"
            @toggle-group="toggleGroup"
            @close-mobile="mobileMenuOpen = false"
        />
        <main class="ns-main">
            <TopBar :mobile-menu-open="mobileMenuOpen" @toggle-menu="toggleMobileMenu" />
            <div class="ns-page">
                <slot />
            </div>
        </main>

        <ToastContainer :items="toast.state.items" @remove="removeToast" />
    </div>
</template>
