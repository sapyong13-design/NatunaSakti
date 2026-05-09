import { ref, computed } from 'vue'

/**
 * Export progress composable
 * Tracks export operation progress with step updates
 */
export function useExportProgress() {
    const isExporting = ref(false)
    const currentStep = ref(0)
    const totalSteps = ref(100)
    const currentStepName = ref('')
    const startTime = ref(null)
    const exportId = ref(null)

    const progress = computed(() => {
        if (totalSteps.value === 0) return 0
        return Math.round((currentStep.value / totalSteps.value) * 100)
    })

    const eta = computed(() => {
        if (!isExporting.value || !startTime.value || currentStep.value === 0) {
            return null
        }
        const elapsed = Date.now() - startTime.value
        const msPerStep = elapsed / currentStep.value
        const remainingSteps = totalSteps.value - currentStep.value
        const etaMs = remainingSteps * msPerStep

        if (etaMs < 1000) return '< 1s'
        if (etaMs < 60000) return `${Math.round(etaMs / 1000)}s`
        return `${Math.round(etaMs / 60000)}m`
    })

    function start(steps = 100) {
        isExporting.value = true
        currentStep.value = 0
        totalSteps.value = steps
        currentStepName.value = 'Memulai...'
        startTime.value = Date.now()
        exportId.value = Date.now()
    }

    function update(step, name) {
        currentStep.value = step
        currentStepName.value = name
    }

    function increment(name) {
        currentStep.value++
        currentStepName.value = name
    }

    function complete() {
        isExporting.value = false
        currentStep.value = totalSteps.value
        currentStepName.value = 'Selesai'
        const id = exportId.value
        setTimeout(() => {
            reset()
        }, 2000)
        return id
    }

    function error(message = 'Export gagal') {
        isExporting.value = false
        currentStepName.value = message
        setTimeout(() => {
            reset()
        }, 3000)
    }

    function reset() {
        isExporting.value = false
        currentStep.value = 0
        totalSteps.value = 100
        currentStepName.value = ''
        startTime.value = null
        exportId.value = null
    }

    return {
        isExporting,
        progress,
        currentStepName,
        eta,
        exportId,
        start,
        update,
        increment,
        complete,
        error,
        reset
    }
}
