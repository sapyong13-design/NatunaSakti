<script setup>
import { computed } from 'vue'

const props = defineProps({
    size: { type: Number, default: 36 },
    primary: { type: String, default: '#10b981' },
    secondary: { type: String, default: '#fff' }
})

const gradId = computed(() => 'lpn-grad-' + Math.random().toString(36).slice(2, 9))
</script>

<template>
    <svg :width="size" :height="size" viewBox="0 0 64 64" fill="none">
        <defs>
            <linearGradient :id="gradId" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" :stop-color="primary" stop-opacity="1" />
                <stop offset="100%" :stop-color="primary" stop-opacity="0.7" />
            </linearGradient>
        </defs>
        <!-- Outer pentagon -->
        <path d="M32 4 L58 22 L48 56 L16 56 L6 22 Z" :fill="`url(#${gradId})`" :stroke="secondary" stroke-width="1.2" />
        <!-- Scale of justice -->
        <g :stroke="secondary" stroke-width="1.6" stroke-linecap="round" fill="none">
            <line x1="32" y1="18" x2="32" y2="44" />
            <line x1="20" y1="24" x2="44" y2="24" />
            <path d="M20 24 L16 32 Q20 34 24 32 Z" :fill="secondary" fill-opacity="0.9" />
            <path d="M44 24 L40 32 Q44 34 48 32 Z" :fill="secondary" fill-opacity="0.9" />
            <circle cx="32" cy="44" r="2.5" :fill="secondary" />
        </g>
        <!-- Tree leaves on top -->
        <g :fill="secondary" fill-opacity="0.85">
            <circle cx="32" cy="14" r="3" />
            <circle cx="27" cy="16" r="2" />
            <circle cx="37" cy="16" r="2" />
        </g>
    </svg>
</template>
