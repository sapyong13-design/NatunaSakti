import { reactive } from 'vue'

// Reactive state for toasts
const state = reactive({
    items: []
})

let idCounter = 0

export function useToast() {
    function add({ message, type = 'info', duration = 4000 }) {
        const id = ++idCounter
        state.items.push({ id, message, type, duration })
        return id
    }

    function remove(id) {
        const index = state.items.findIndex(item => item.id === id)
        if (index > -1) {
            state.items.splice(index, 1)
        }
    }

    function info(message, duration) {
        return add({ message, type: 'info', duration })
    }

    function success(message, duration) {
        return add({ message, type: 'success', duration })
    }

    function warning(message, duration) {
        return add({ message, type: 'warning', duration })
    }

    function error(message, duration) {
        return add({ message, type: 'error', duration })
    }

    return {
        state,
        add,
        remove,
        info,
        success,
        warning,
        error
    }
}
