import { onMounted, onUnmounted } from 'vue'

/**
 * Format shortcut key for display
 */
export function formatShortcut(keys) {
    return keys
        .split('+')
        .map(k => {
            if (k === 'ctrl' || k === 'meta') return 'Ctrl'
            if (k === 'shift') return 'Shift'
            if (k === 'alt') return 'Alt'
            return k.charAt(0).toUpperCase() + k.slice(1)
        })
        .join(' + ')
}

/**
 * Keyboard shortcuts composable
 * Supports: Ctrl+F (search), Ctrl+K (command), / (focus search), Esc (close)
 */
export function useKeyboardShortcuts(shortcuts = {}) {
    const defaultShortcuts = {
        // Focus search
        '/': {
            action: () => {
                const searchInput = document.querySelector('input[type="search"], input[placeholder*="cari"], input[placeholder*="Cari"]')
                searchInput?.focus()
                searchInput?.select()
            },
            description: 'Focus search'
        },
        // Escape - close modals/panels
        'Escape': {
            action: () => {
                // Dispatch custom event for components to listen
                window.dispatchEvent(new CustomEvent('keyboard-escape'))
            },
            description: 'Close modal/panel'
        },
        // Ctrl+K - command palette
        'ctrl+k': {
            action: () => {
                window.dispatchEvent(new CustomEvent('keyboard-command'))
            },
            description: 'Command palette'
        },
        // Ctrl+F - find/search
        'ctrl+f': {
            action: () => {
                const searchInput = document.querySelector('input[type="search"], input[placeholder*="cari"], input[placeholder*="Cari"]')
                searchInput?.focus()
                searchInput?.select()
            },
            description: 'Find'
        },
        // Ctrl+N - new (if applicable)
        'ctrl+n': {
            action: () => {
                window.dispatchEvent(new CustomEvent('keyboard-new'))
            },
            description: 'New item'
        }
    }

    const allShortcuts = { ...defaultShortcuts, ...shortcuts }

    function handleKeydown(e) {
        // Check if user is typing in an input
        const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)
        if (isTyping && e.key !== 'Escape' && !(e.ctrlKey || e.metaKey)) {
            return
        }

        // Build key string
        let key = e.key.toLowerCase()
        if (e.ctrlKey || e.metaKey) key = 'ctrl+' + key
        if (e.shiftKey) key = 'shift+' + key
        if (e.altKey) key = 'alt+' + key

        const shortcut = allShortcuts[key]
        if (shortcut) {
            e.preventDefault()
            shortcut.action()
        }
    }

    onMounted(() => {
        document.addEventListener('keydown', handleKeydown)
    })

    onUnmounted(() => {
        document.removeEventListener('keydown', handleKeydown)
    })

    return {
        shortcuts: allShortcuts,
        getAll: () => Object.entries(allShortcuts).map(([key, { description }]) => ({ key, description }))
    }
}

/**
 * Hook to listen for Escape key
 */
export function useEscape(callback) {
    function handleEscape() {
        callback()
    }

    onMounted(() => {
        window.addEventListener('keyboard-escape', handleEscape)
    })

    onUnmounted(() => {
        window.removeEventListener('keyboard-escape', handleEscape)
    })
}

/**
 * Hook to listen for other keyboard events
 */
export function useKeyboardEvent(eventName, callback) {
    function handleEvent() {
        callback()
    }

    onMounted(() => {
        window.addEventListener(`keyboard-${eventName}`, handleEvent)
    })

    onUnmounted(() => {
        window.removeEventListener(`keyboard-${eventName}`, handleEvent)
    })
}
