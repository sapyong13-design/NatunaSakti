<script setup>
import { computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import Icon from '../Icon.vue'
import LambangPN from '../LambangPN.vue'

const props = defineProps({
    items: { type: Array, required: true },
    collapsed: { type: Boolean, default: false },
    expandedGroups: { type: Object, required: true }
})

const emit = defineEmits(['update:collapsed', 'toggleGroup'])

const route = useRoute()

function isItemActive(item) {
    return route.path === item.to
}

function isGroupActive(group) {
    return group.children?.some(c => route.path === c.to)
}

function isGroupExpanded(group) {
    return props.expandedGroups[group.id] || isGroupActive(group)
}
</script>

<template>
    <aside class="ns-sidebar" :class="{ 'is-collapsed': collapsed }">
        <div class="ns-brand">
            <LambangPN :size="32" primary="#047857" />
            <div v-if="!collapsed" class="ns-brand-text">
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
                    <span v-if="!collapsed" class="ns-nav-label">{{ item.label }}</span>
                </RouterLink>

                <div v-else-if="item.type === 'group'" class="ns-nav-group">
                    <button
                        type="button"
                        class="ns-nav-item"
                        :class="{ 'is-active': isGroupActive(item) }"
                        @click="emit('toggleGroup', item.id)"
                    >
                        <span class="ns-nav-icon"><Icon :name="item.icon" :size="18" /></span>
                        <span v-if="!collapsed" class="ns-nav-label">{{ item.label }}</span>
                        <span v-if="!collapsed" class="ns-nav-chevron">
                            <Icon
                                :name="isGroupExpanded(item) ? 'chevronDown' : 'chevronRight'"
                                :size="14"
                            />
                        </span>
                    </button>
                    <div v-if="!collapsed && isGroupExpanded(item)" class="ns-nav-children">
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
