import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

const STORAGE_KEY = 'ns-autorefresh'

/**
 * Auto-refresh composable
 * Provides auto-refresh functionality with customizable intervals
 */
export function useAutoRefresh(callback, options = {}) {
    const {
        defaultInterval = 60000, // 1 minute
        minInterval = 10000, // 10 seconds
        maxInterval = 300000, // 5 minutes
        intervals = [10000, 30000, 60000, 120000, 300000] // 10s, 30s, 1m, 2m, 5m
    } = options

    const enabled = ref(false)
    const interval = ref(defaultInterval)
    const lastRefresh = ref(null)
    const nextRefresh = ref(null)
    const isRefreshing = ref(false)

    let timerId = null

    // Load saved preference
    function loadPreference() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY)
            if (saved) {
                const data = JSON.parse(saved)
                enabled.value = data.enabled || false
                interval.value = data.interval || defaultInterval
            }
        } catch (e) {
            console.warn('Failed to load auto-refresh preference:', e)
        }
    }

    // Save preference
    function savePreference() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                enabled: enabled.value,
                interval: interval.value
            }))
        } catch (e) {
            console.warn('Failed to save auto-refresh preference:', e)
        }
    }

    // Perform refresh
    async function refresh() {
        if (isRefreshing.value) return

        isRefreshing.value = true
        try {
            if (typeof callback === 'function') {
                await callback()
            }
            lastRefresh.value = new Date()
            updateNextRefreshTime()
        } catch (error) {
            console.error('Auto-refresh error:', error)
        } finally {
            isRefreshing.value = false
        }
    }

    // Update next refresh time
    function updateNextRefreshTime() {
        if (enabled.value) {
            nextRefresh.value = new Date(Date.now() + interval.value)
        } else {
            nextRefresh.value = null
        }
    }

    // Start auto-refresh
    function start() {
        if (timerId) clearInterval(timerId)
        enabled.value = true
        timerId = setInterval(refresh, interval.value)
        updateNextRefreshTime()
        savePreference()
    }

    // Stop auto-refresh
    function stop() {
        if (timerId) {
            clearInterval(timerId)
            timerId = null
        }
        enabled.value = false
        nextRefresh.value = null
        savePreference()
    }

    // Toggle auto-refresh
    function toggle() {
        if (enabled.value) {
            stop()
        } else {
            start()
        }
    }

    // Set interval and restart if enabled
    function setInterval(newInterval) {
        interval.value = Math.max(minInterval, Math.min(maxInterval, newInterval))
        if (enabled.value) {
            stop()
            start()
        }
        savePreference()
    }

    // Manual refresh
    function manualRefresh() {
        return refresh()
    }

    // Get time until next refresh
    const timeUntilNext = computed(() => {
        if (!nextRefresh.value) return null
        return Math.max(0, nextRefresh.value.getTime() - Date.now())
    })

    // Get formatted next refresh time
    const nextRefreshTime = computed(() => {
        if (!nextRefresh.value) return null
        const mm = String(nextRefresh.value.getMinutes()).padStart(2, '0')
        const ss = String(nextRefresh.value.getSeconds()).padStart(2, '0')
        return `${mm}:${ss}`
    })

    // Interval label
    const intervalLabel = computed(() => {
        const seconds = interval.value / 1000
        if (seconds < 60) return `${seconds}d`
        return `${seconds / 60}m`
    })

    // Watch interval changes
    watch(interval, () => {
        if (enabled.value) {
            stop()
            start()
        }
    })

    onMounted(() => {
        loadPreference()
        if (enabled.value) {
            start()
        }
    })

    onUnmounted(() => {
        stop()
    })

    return {
        enabled,
        interval,
        lastRefresh,
        nextRefresh,
        nextRefreshTime,
        timeUntilNext,
        intervalLabel,
        isRefreshing,
        intervals,
        start,
        stop,
        toggle,
        setInterval,
        manualRefresh
    }
}
