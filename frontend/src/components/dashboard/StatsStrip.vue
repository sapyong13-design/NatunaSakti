<script setup>
defineProps({
    stats: {
        type: Object,
        required: true
    }
})
</script>

<template>
    <div class="ns-c-page-stats-strip">
        <div class="ns-c-strip-item">
            <span class="ns-c-strip-label">Total</span>
            <span class="ns-c-strip-value">{{ stats.total }}</span>
        </div>
        <span class="ns-c-strip-divider" />
        <div class="ns-c-strip-item">
            <span class="ns-c-strip-label">Pidana</span>
            <span class="ns-c-strip-value">{{ stats.pidana }}</span>
        </div>
        <span class="ns-c-strip-divider" />
        <div class="ns-c-strip-item">
            <span class="ns-c-strip-label">Perdata</span>
            <span class="ns-c-strip-value">{{ stats.perdata }}</span>
        </div>
        <span class="ns-c-strip-divider" />
        <div class="ns-c-strip-item">
            <span class="ns-c-strip-label">Perikanan</span>
            <span class="ns-c-strip-value">{{ stats.perikanan }}</span>
        </div>
        <span class="ns-c-strip-divider" />
        <div class="ns-c-strip-item">
            <span class="ns-c-strip-label">Aktif</span>
            <span class="ns-c-strip-value">{{ stats.aktif }}</span>
        </div>
    </div>
</template>
