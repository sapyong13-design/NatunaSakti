<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'

const props = defineProps({
    items: { type: Array, default: () => [] },
    itemHeight: { type: Number, default: 48 }, // Height of each row
    containerHeight: { type: Number, default: 400 }, // Visible viewport height
    buffer: { type: Number, default: 5 }, // Extra rows to render above/below viewport
    overscan: { type: Number, default: 3 } // Rows to pre-render for smooth scrolling
})

const emit = defineEmits(['visible-change'])

const scrollTop = ref(0)
const containerRef = ref(null)
const isScrolling = ref(false)
let scrollTimeout = null
let scrollListener = null

// Calculate total height of all items
const totalHeight = computed(() => props.items.length * props.itemHeight)

// Calculate which items are visible
const visibleRange = computed(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop.value / props.itemHeight) - props.buffer)
    const endIndex = Math.min(
        props.items.length - 1,
        Math.ceil((scrollTop.value + props.containerHeight) / props.itemHeight) + props.buffer
    )
    return { start: startIndex, end: endIndex }
})

// Get visible items with their offset positions
const visibleItems = computed(() => {
    const { start, end } = visibleRange.value
    const items = []

    for (let i = start; i <= end; i++) {
        if (props.items[i]) {
            items.push({
                index: i,
                data: props.items[i],
                offset: i * props.itemHeight
            })
        }
    }

    return items
})

// Calculate offset for positioning
const offsetY = computed(() => {
    const { start } = visibleRange.value
    return start * props.itemHeight
})

// Handle scroll events
function handleScroll(e) {
    scrollTop.value = e.target.scrollTop
    isScrolling.value = true

    // Clear previous timeout
    if (scrollTimeout) clearTimeout(scrollTimeout)

    // Set new timeout to detect scroll end
    scrollTimeout = setTimeout(() => {
        isScrolling.value = false
    }, 150)
}

// Scroll to specific item
function scrollToItem(index, behavior = 'smooth') {
    if (index < 0 || index >= props.items.length) return

    const targetOffset = index * props.itemHeight
    const currentScroll = scrollTop.value
    const container = containerRef.value

    if (!container) return

    // Check if item is already visible
    const isVisible = targetOffset >= currentScroll &&
                     targetOffset <= currentScroll + props.containerHeight - props.itemHeight

    if (isVisible) return

    // Scroll to make item visible
    const scrollPosition = Math.max(0, targetOffset - props.containerHeight / 2 + props.itemHeight / 2)

    container.scrollTo({
        top: scrollPosition,
        behavior
    })
}

// Scroll to top
function scrollToTop(behavior = 'smooth') {
    const container = containerRef.value
    if (!container) return
    container.scrollTo({ top: 0, behavior })
}

// Scroll to bottom
function scrollToBottom(behavior = 'smooth') {
    const container = containerRef.value
    if (!container) return
    container.scrollTo({
        top: totalHeight.value - props.containerHeight,
        behavior
    })
}

// Get current scroll percentage
const scrollPercentage = computed(() => {
    if (totalHeight.value <= props.containerHeight) return 100
    return (scrollTop.value / (totalHeight.value - props.containerHeight)) * 100
})

// Check if at top/bottom
const isAtTop = computed(() => scrollTop.value === 0)
const isAtBottom = computed(() => {
    return scrollTop.value + props.containerHeight >= totalHeight.value - 1
})

// Emit visible range changes
watch(visibleRange, (newRange) => {
    emit('visible-change', newRange)
}, { immediate: true })

// Expose methods
defineExpose({
    scrollToItem,
    scrollToTop,
    scrollToBottom,
    containerRef
})
</script>

<template>
    <div
        ref="containerRef"
        class="ns-virtual-scroller"
        :style="{ height: `${containerHeight}px` }"
        @scroll="handleScroll"
    >
        <div
            class="ns-virtual-scroller-content"
            :style="{
                height: `${totalHeight}px`,
                transform: `translateY(${offsetY}px)`
            }"
        >
            <div
                v-for="item in visibleItems"
                :key="item.index"
                class="ns-virtual-scroller-item"
                :style="{ height: `${itemHeight}px` }"
                :data-index="item.index"
            >
                <slot
                    name="item"
                    :item="item.data"
                    :index="item.index"
                />
            </div>
        </div>

        <!-- Scroll indicator (shows while scrolling) -->
        <Transition name="ns-scroll-fade">
            <div v-if="isScrolling" class="ns-scroll-indicator">
                <div class="ns-scroll-progress" :style="{ width: `${scrollPercentage}%` }" />
            </div>
        </Transition>

        <!-- Shadow indicators -->
        <div
            v-show="!isAtTop"
            class="ns-scroll-shadow ns-scroll-shadow-top"
        />
        <div
            v-show="!isAtBottom"
            class="ns-scroll-shadow ns-scroll-shadow-bottom"
        />
    </div>
</template>

<style scoped>
.ns-virtual-scroller {
    position: relative;
    overflow-y: auto;
    overflow-x: hidden;
    scroll-behavior: smooth;
}

.ns-virtual-scroller::-webkit-scrollbar {
    width: 8px;
}

.ns-virtual-scroller::-webkit-scrollbar-track {
    background: var(--surface-1);
    border-radius: 4px;
}

.ns-virtual-scroller::-webkit-scrollbar-thumb {
    background: var(--surface-3);
    border-radius: 4px;
    transition: background 0.2s ease;
}

.ns-virtual-scroller::-webkit-scrollbar-thumb:hover {
    background: var(--text-3);
}

.ns-virtual-scroller-content {
    position: relative;
    will-change: transform;
}

.ns-virtual-scroller-item {
    display: flex;
    align-items: center;
    box-sizing: border-box;
}

/* Scroll indicator */
.ns-scroll-indicator {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    z-index: 100;
    pointer-events: none;
}

.ns-scroll-progress {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), var(--accent-2));
    transition: width 0.1s linear;
}

/* Shadow indicators */
.ns-scroll-shadow {
    position: absolute;
    left: 0;
    right: 0;
    height: 24px;
    pointer-events: none;
    z-index: 10;
}

.ns-scroll-shadow-top {
    top: 0;
    background: linear-gradient(to bottom, var(--bg-2), transparent);
}

.ns-scroll-shadow-bottom {
    bottom: 0;
    background: linear-gradient(to top, var(--bg-2), transparent);
}

/* Fade transition for scroll indicator */
.ns-scroll-fade-enter-active,
.ns-scroll-fade-leave-active {
    transition: opacity 0.3s ease;
}

.ns-scroll-fade-enter-from,
.ns-scroll-fade-leave-to {
    opacity: 0;
}
</style>
