<script setup>
import Toast from './Toast.vue'

defineProps({
    items: { type: Array, required: true }
})

const emit = defineEmits(['remove'])

function remove(id) {
    emit('remove', id)
}
</script>

<template>
    <Teleport to="body">
        <div class="ns-toast-container">
            <TransitionGroup name="nsToast">
                <Toast
                    v-for="item in items"
                    :key="item.id"
                    :message="item.message"
                    :type="item.type"
                    :duration="item.duration"
                    @close="remove(item.id)"
                />
            </TransitionGroup>
        </div>
    </Teleport>
</template>

<style scoped>
.ns-toast-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 10px;
    pointer-events: none;
}

.ns-toast-container > * {
    pointer-events: auto;
}
</style>
