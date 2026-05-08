<script setup>
defineProps({
    eyebrow: { type: String, default: '' },
    title: { type: String, required: true },
    sub: { type: String, default: '' }
})
</script>

<template>
    <div class="ns-c-page-header">
        <div>
            <div v-if="eyebrow" class="ns-c-eyebrow">{{ eyebrow }}</div>
            <h1 class="ns-h1 ns-h1-c">{{ title }}</h1>
            <p v-if="sub" class="ns-h1-sub">{{ sub }}</p>
        </div>
        <div v-if="$slots.default">
            <slot />
        </div>
    </div>
</template>
