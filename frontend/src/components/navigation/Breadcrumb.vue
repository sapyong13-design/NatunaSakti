<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const props = defineProps({
    items: {
        type: Array,
        default: () => []
    }
})

const breadcrumbs = computed(() => {
    if (props.items.length > 0) {
        return props.items
    }

    // Auto-generate from route
    const pathSegments = route.path.split('/').filter(Boolean)
    const crumbs = [{ label: 'Home', to: '/' }]

    let buildPath = ''
    for (const segment of pathSegments) {
        buildPath += '/' + segment
        // Capitalize first letter
        const label = segment.charAt(0).toUpperCase() + segment.slice(1)
        crumbs.push({ label, to: buildPath })
    }

    return crumbs
})
</script>

<template>
    <nav class="ns-breadcrumb" aria-label="Breadcrumb">
        <ol class="ns-breadcrumb-list">
            <li
                v-for="(crumb, index) in breadcrumbs"
                :key="crumb.to"
                class="ns-breadcrumb-item"
                :class="{ 'is-current': index === breadcrumbs.length - 1 }"
            >
                <RouterLink
                    v-if="index < breadcrumbs.length - 1"
                    :to="crumb.to"
                    class="ns-breadcrumb-link"
                >
                    {{ crumb.label }}
                </RouterLink>
                <span v-else class="ns-breadcrumb-current">{{ crumb.label }}</span>
            </li>
        </ol>
    </nav>
</template>

<style scoped>
.ns-breadcrumb {
    padding: 8px 0;
}

.ns-breadcrumb-list {
    display: flex;
    align-items: center;
    gap: 8px;
    list-style: none;
    margin: 0;
    padding: 0;
}

.ns-breadcrumb-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
}

.ns-breadcrumb-item:not(:last-child)::after {
    content: '/';
    color: var(--text-3);
}

.ns-breadcrumb-link {
    color: var(--text-2);
    text-decoration: none;
    transition: color 0.15s ease;
}

.ns-breadcrumb-link:hover {
    color: var(--accent);
}

.ns-breadcrumb-current {
    color: var(--text);
    font-weight: 500;
}
</style>
