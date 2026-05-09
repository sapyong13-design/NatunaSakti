import { ref, computed, onMounted, onUnmounted } from 'vue'

/**
 * Session management composable
 * Handles idle timeout, session expiration, and auto-logout
 */
export function useSessionManager(options = {}) {
    const {
        idleTimeout = 30 * 60 * 1000, // 30 minutes default
        warningTime = 5 * 60 * 1000, // Show warning 5 minutes before timeout
        onIdle,
        onWarning,
        onExpire
    } = options

    const isIdle = ref(false)
    const isWarning = ref(false)
    const timeRemaining = ref(0)
    const lastActivity = ref(Date.now())

    let idleTimer = null
    let warningTimer = null

    function resetIdleTimer() {
        lastActivity.value = Date.now()
        isIdle.value = false
        isWarning.value = false

        // Clear existing timers
        if (idleTimer) clearTimeout(idleTimer)
        if (warningTimer) clearTimeout(warningTimer)

        // Set warning timer
        warningTimer = setTimeout(() => {
            showWarning()
        }, idleTimeout - warningTime)

        // Set idle timer
        idleTimer = setTimeout(() => {
            handleIdle()
        }, idleTimeout)
    }

    function showWarning() {
        isWarning.value = true
        timeRemaining.value = warningTime / 1000 // in seconds

        if (onWarning) {
            onWarning(timeRemaining.value)
        }
    }

    function handleIdle() {
        isIdle.value = true
        isWarning.value = false

        if (onIdle) {
            onIdle()
        } else {
            // Default behavior: logout
            handleExpire()
        }
    }

    function handleExpire() {
        if (onExpire) {
            onExpire()
        }
    }

    function extendSession() {
        resetIdleTimer()
    }

    // Activity listeners
    function handleActivity() {
        resetIdleTimer()
    }

    onMounted(() => {
        // Listen for user activity
        const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'resize']
        events.forEach(event => {
            document.addEventListener(event, handleActivity, { passive: true })
        })

        // Start idle timer
        resetIdleTimer()
    })

    onUnmounted(() => {
        if (idleTimer) clearTimeout(idleTimer)
        if (warningTimer) clearTimeout(warningTimer)

        const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'resize']
        events.forEach(event => {
            document.removeEventListener(event, handleActivity)
        })
    })

    // Update remaining time countdown
    setInterval(() => {
        if (isWarning.value && timeRemaining.value > 0) {
            timeRemaining.value--
        }
    }, 1000)

    const formattedTimeRemaining = computed(() => {
        const minutes = Math.floor(timeRemaining.value / 60)
        const seconds = timeRemaining.value % 60
        return `${minutes}:${String(seconds).padStart(2, '0')}`
    })

    return {
        isIdle,
        isWarning,
        timeRemaining,
        formattedTimeRemaining,
        resetIdleTimer: resetIdleTimer,
        extendSession,
        handleExpire
    }
}
