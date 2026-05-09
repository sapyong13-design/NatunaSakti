<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
    src: { type: String, required: true },
    alt: { type: String, required: true },
    // Responsive sources
    srcset: { type: Array, default: () => [] }, // [{ src, width, descriptor }]
    sizes: { type: String, default: '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw' },
    // Sizing
    width: { type: [String, Number], default: 'auto' },
    height: { type: [String, Number], default: 'auto' },
    aspectRatio: { type: String, default: null }, // e.g., '16/9', '4/3', '1/1'
    maxWidth: { type: String, default: '100%' },
    // Quality & format
    quality: { type: Number, default: 85 }, // For optimization services
    format: { type: String, default: 'auto' }, // auto, webp, avif, jpg, png
    // Loading
    loading: { type: String, default: 'lazy', validator: (v) => ['eager', 'lazy'].includes(v) },
    decoding: { type: String, default: 'async', validator: (v) => ['sync', 'async', 'auto'].includes(v) },
    // Fallback
    fallback: { type: String, default: null },
    // Styling
    fit: { type: String, default: 'cover', validator: (v) => ['fill', 'contain', 'cover', 'none', 'scale-down'].includes(v) },
    rounded: { type: [String, Boolean], default: false }, // false, true, 'sm', 'md', 'lg', 'full'
    shadow: { type: [String, Boolean], default: false }, // false, true, 'sm', 'md', 'lg'
    // Placeholder
    placeholder: { type: String, default: null }, // Base64 or blurhash
    placeholderBlur: { type: Boolean, default: true },
    // Effects
    grayscale: { type: Boolean, default: false },
    zoomOnHover: { type: Boolean, default: false },
    // Background
    background: { type: String, default: 'transparent' }
})

const emit = defineEmits(['load', 'error',('loadstart')])

const imageRef = ref(null)
const isLoaded = ref(false)
const isError = ref(false)
const isInView = ref(props.loading === 'eager')
const showPlaceholder = ref(props.placeholder && props.placeholderBlur)

// Intersection Observer for lazy loading
let observer = null

onMounted(() => {
    if (props.loading === 'lazy' && !isInView.value) {
        observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    isInView.value = true
                    observer?.disconnect()
                }
            },
            { rootMargin: '50px' }
        )
        observer.observe(imageRef.value)
    }
})

onUnmounted(() => {
    observer?.disconnect()
})

// Handle image load
function handleLoad() {
    isLoaded.value = true
    showPlaceholder.value = false
    emit('load')
}

// Handle image error
function handleError() {
    isError.value = true
    emit('error')
}

// Retry loading
function retry() {
    isError.value = false
    if (imageRef.value) {
        imageRef.value.src = props.src
    }
}

// Generate optimized URL (for image services like Cloudinary, imgix, etc.)
const optimizedSrc = computed(() => {
    if (!props.src) return ''

    // If using an image service, add optimization parameters
    const url = new URL(props.src, window.location.origin)

    // Add quality parameter (common format)
    url.searchParams.set('q', props.quality)

    // Auto format selection
    if (props.format === 'auto') {
        // Browser will handle format selection via Accept header
    } else if (props.format !== 'auto') {
        url.searchParams.set('f', props.format)
    }

    return url.toString()
})

// Generate srcset from provided sources
const computedSrcset = computed(() => {
    if (props.srcset.length > 0) {
        return props.srcset.map(s => `${s.src} ${s.descriptor || s.width + 'w'}`).join(', ')
    }

    // Auto-generate srcset for common sizes
    const sizes = [320, 640, 960, 1280, 1920]
    return sizes.map(size => {
        const url = new URL(props.src, window.location.origin)
        url.searchParams.set('w', size)
        url.searchParams.set('q', props.quality)
        return `${url.toString()} ${size}w`
    }).join(', ')
})

// Container styles
const containerStyle = computed(() => {
    const styles = {
        maxWidth: props.maxWidth,
        background: props.background
    }

    if (props.aspectRatio) {
        styles.aspectRatio = props.aspectRatio
    }

    return styles
})

// Image styles
const imageStyle = computed(() => {
    return {
        width: typeof props.width === 'number' ? `${props.width}px` : props.width,
        height: typeof props.height === 'number' ? `${props.height}px` : props.height,
        objectFit: props.fit,
        filter: props.grayscale ? 'grayscale(100%)' : 'none',
        transition: props.zoomOnHover ? 'transform 0.3s ease' : 'none'
    }
})

// Roundness classes
const roundedClass = computed(() => {
    if (props.rounded === 'full') return 'ns-img-rounded-full'
    if (props.rounded === true || props.rounded === 'md') return 'ns-img-rounded'
    if (props.rounded === 'sm') return 'ns-img-rounded-sm'
    if (props.rounded === 'lg') return 'ns-img-rounded-lg'
    return ''
})

// Shadow classes
const shadowClass = computed(() => {
    if (props.shadow === true || props.shadow === 'md') return 'ns-img-shadow'
    if (props.shadow === 'sm') return 'ns-img-shadow-sm'
    if (props.shadow === 'lg') return 'ns-img-shadow-lg'
    return ''
})

// Watch src changes
watch(() => props.src, () => {
    isLoaded.value = false
    isError.value = false
    showPlaceholder.value = props.placeholder && props.placeholderBlur
})

// Expose methods
defineExpose({ retry })
</script>

<template>
    <figure class="ns-responsive-image" :class="[roundedClass, shadowClass]" :style="containerStyle">
        <!-- Placeholder blur -->
        <div
            v-if="showPlaceholder && !isLoaded"
            class="ns-image-placeholder"
            :style="{
                backgroundImage: placeholder ? `url(${placeholder})` : undefined,
                background: placeholder ? undefined : 'var(--surface-2)'
            }"
        />

        <!-- Loading skeleton -->
        <div v-if="!isLoaded && !isError && !showPlaceholder" class="ns-image-skeleton" />

        <!-- Main image -->
        <img
            v-if="isInView || loading === 'eager'"
            ref="imageRef"
            :src="optimizedSrc"
            :srcset="computedSrcset"
            :sizes="sizes"
            :alt="alt"
            :loading="loading"
            :decoding="decoding"
            :style="imageStyle"
            :class="[
                'ns-image-element',
                { 'is-loaded': isLoaded, 'zoom-on-hover': zoomOnHover }
            ]"
            @load="handleLoad"
            @error="handleError"
        >

        <!-- Fallback image -->
        <img
            v-else-if="fallback && isError"
            :src="fallback"
            :alt="`${alt} (fallback)`"
            class="ns-image-element ns-image-fallback"
            :style="imageStyle"
        >

        <!-- Error state -->
        <div v-if="isError && !fallback" class="ns-image-error">
            <span class="ns-error-icon">🖼️</span>
            <span class="ns-error-text">Gambar tidak tersedia</span>
            <button v-if="!isInView" class="ns-error-retry" @click="retry">Coba Lagi</button>
        </div>

        <!-- Caption -->
        <figcaption v-if="$slots.caption" class="ns-image-caption">
            <slot name="caption" />
        </figcaption>
    </figure>
</template>

<style scoped>
.ns-responsive-image {
    position: relative;
    display: inline-block;
    overflow: hidden;
}

.ns-image-element {
    display: block;
    width: 100%;
    height: auto;
    opacity: 0;
    transition: opacity 0.3s ease, filter 0.3s ease;
}

.ns-image-element.is-loaded {
    opacity: 1;
}

.ns-image-element.zoom-on-hover:hover {
    transform: scale(1.05);
}

.ns-image-fallback {
    opacity: 0.7;
}

.ns-image-placeholder {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center;
    filter: blur(20px);
    transform: scale(1.1);
    transition: opacity 0.3s ease;
}

.ns-image-skeleton {
    position: absolute;
    inset: 0;
    background: linear-gradient(
        90deg,
        var(--surface-2) 0%,
        var(--surface-3) 50%,
        var(--surface-2) 100%
    );
    background-size: 200% 100%;
    animation: ns-skeleton-shimmer 1.5s ease-in-out infinite;
}

@keyframes ns-skeleton-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}

.ns-image-error {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: var(--surface-2);
    color: var(--text-3);
    padding: 24px;
    text-align: center;
}

.ns-error-icon {
    font-size: 32px;
    opacity: 0.5;
}

.ns-error-text {
    font-size: 13px;
}

.ns-error-retry {
    margin-top: 8px;
    padding: 6px 12px;
    font-size: 12px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
}

.ns-error-retry:hover {
    background: var(--accent-2);
    transform: translateY(-1px);
}

.ns-image-caption {
    margin-top: 8px;
    font-size: 12px;
    color: var(--text-3);
    text-align: center;
}

/* Rounded variants */
.ns-img-rounded-sm {
    border-radius: 4px;
}

.ns-img-rounded {
    border-radius: 8px;
}

.ns-img-rounded-lg {
    border-radius: 16px;
}

.ns-img-rounded-full {
    border-radius: 9999px;
}

/* Shadow variants */
.ns-img-shadow-sm {
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.ns-img-shadow {
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.ns-img-shadow-lg {
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}
</style>
