<script setup>
import { computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import Icon from '../Icon.vue'
import LambangPN from '../LambangPN.vue'

const props = defineProps({
    items: { type: Array, required: true },
    collapsed: { type: Boolean, default: false },
    expandedGroups: { type: Object, required: true },
    mobileOpen: { type: Boolean, default: false }
})

const emit = defineEmits(['update:collapsed', 'toggleGroup', 'close-mobile'])

const route = useRoute()

function isItemActive(item) {
    return route.path === item.to
}

function isGroupActive(group) {
    return group.children?.some(c => route.path === c.to)
}

function isGroupExpanded(group) {
    return !!props.expandedGroups[group.id]
}
</script>

<template>
    <!-- Mobile backdrop -->
    <Teleport to="body">
        <div
            v-if="mobileOpen"
            class="ns-sidebar-backdrop"
            @click="emit('close-mobile')"
        />
    </Teleport>

    <aside class="ns-sidebar" :class="{ 'is-collapsed': collapsed, 'is-mobile-open': mobileOpen }">
        <div class="ns-brand">
            <LambangPN :size="32" primary="#047857" />
            <div v-if="!collapsed || mobileOpen" class="ns-brand-text">
                <div class="ns-brand-title">Natuna Sakti</div>
                <div class="ns-brand-sub">PN Natuna Kelas II</div>
            </div>
        </div>

        <nav class="ns-nav">
            <template v-for="item in items" :key="item.id">
                <RouterLink
                    v-if="item.type === 'item'"
                    :to="item.to"
                    class="ns-nav-item"
                    :class="{ 'is-active': isItemActive(item) }"
                >
                    <span class="ns-nav-icon"><Icon :name="item.icon" :size="18" /></span>
                    <span v-if="!collapsed || mobileOpen" class="ns-nav-label">{{ item.label }}</span>
                </RouterLink>

                <div v-else-if="item.type === 'group'" class="ns-nav-group">
                    <button
                        type="button"
                        class="ns-nav-item"
                        :class="{ 'is-active': isGroupActive(item) }"
                        @click="emit('toggleGroup', item.id)"
                    >
                        <span class="ns-nav-icon"><Icon :name="item.icon" :size="18" /></span>
                        <span v-if="!collapsed || mobileOpen" class="ns-nav-label">{{ item.label }}</span>
                        <span v-if="!collapsed || mobileOpen" class="ns-nav-chevron">
                            <Icon
                                :name="isGroupExpanded(item) ? 'chevronDown' : 'chevronRight'"
                                :size="14"
                            />
                        </span>
                    </button>
                    <div v-if="(!collapsed || mobileOpen) && isGroupExpanded(item)" class="ns-nav-children">
                        <RouterLink
                            v-for="child in item.children"
                            :key="child.id"
                            :to="child.to"
                            class="ns-nav-item"
                            :class="{ 'is-active': isItemActive(child) }"
                        >
                            <span class="ns-nav-icon"><Icon :name="child.icon" :size="16" /></span>
                            <span class="ns-nav-label">{{ child.label }}</span>
                        </RouterLink>
                    </div>
                </div>
            </template>
        </nav>

        <div class="ns-sidebar-footer">
            <button
                type="button"
                class="ns-collapse-btn"
                :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
                @click="emit('update:collapsed', !collapsed)"
            >
                <Icon
                    name="chevronRight"
                    :size="14"
                    :style="collapsed ? '' : 'transform: rotate(180deg)'"
                />
            </button>
        </div>
    </aside>
</template>

<style scoped>
/* Mobile backdrop (outside template) */
:deep(.ns-sidebar-backdrop) {
    position: fixed;
    inset: 0;
    z-index: var(--z-backdrop, 910);
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
}

@media (min-width: 769px) {
    :deep(.ns-sidebar-backdrop) {
        display: none;
    }
}

/* Mobile sidebar styles */
@media (max-width: 768px) {
    .ns-sidebar {
        position: fixed !important;
        top: 0;
        left: 0;
        bottom: 0;
        z-index: var(--z-sidebar, 900);
        width: 280px !important;
        transform: translateX(-100%);
        transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
    }

    .ns-sidebar.is-mobile-open {
        transform: translateX(0);
    }

    .ns-sidebar.is-collapsed {
        width: 280px !important;
    }

    .ns-sidebar.is-mobile-open .ns-brand-text,
    .ns-sidebar.is-mobile-open .ns-nav-label,
    .ns-sidebar.is-mobile-open .ns-nav-chevron {
        display: flex;
    }

    .ns-sidebar.is-mobile-open .ns-nav-item {
        justify-content: flex-start;
    }

    .ns-sidebar.is-mobile-open .ns-collapse-btn {
        display: none;
    }
}
</style>
