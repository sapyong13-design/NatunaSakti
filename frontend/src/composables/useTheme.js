import { ref, watch, readonly, onMounted } from 'vue'

const STORAGE_KEY = 'ns-theme'

const lightTheme = {
    // Mahogany & Gold - Modern Legal Authority
    bg: '#FAF8F5',
    bg2: '#FFFFFF',
    bg3: '#F5F3F0',
    surface: 'rgba(255,255,255,0.95)',
    surface2: 'rgba(74,28,27,0.04)',
    surface3: 'rgba(74,28,27,0.08)',
    border: 'rgba(74,28,27,0.12)',
    text: '#2D2420',
    text2: 'rgba(45,36,32,0.8)',
    text3: 'rgba(45,36,32,0.5)',
    // Primary — Mahogany Deep
    accent: '#4A1C1B',
    accent2: '#6B2827',
    accentSoft: 'rgba(74,28,27,0.1)',
    accentGlow: 'rgba(74,28,27,0.25)',
    // Semantic — institutional
    danger: '#A83E32',
    dangerSoft: 'rgba(168,62,50,0.12)',
    success: '#3D6B4E',
    successSoft: 'rgba(61,107,78,0.12)',
    warn: '#B8860B',
    warnSoft: 'rgba(184,134,11,0.12)',
    info: '#4A1C1B',
    gradientBg: 'linear-gradient(180deg, #FAF8F5 0%, #F2EFE9 100%)',
    // Tooltip colors
    bgTooltip: '#2D2420',
    textTooltip: '#FAF8F5'
}

const darkTheme = {
    // Midnight Slate & Burnished Gold — Crisp Judicial Authority
    bg: '#0C1017',
    bg2: '#131923',
    bg3: '#1A2230',
    bgDark: '#131923',
    surface: 'rgba(19, 25, 35, 0.9)',
    surface2: 'rgba(148, 163, 184, 0.09)',
    surface3: 'rgba(148, 163, 184, 0.16)',
    border: 'rgba(148, 163, 184, 0.16)',
    text: '#F1F5F9',
    text2: '#A6B3C6',
    text3: '#7C8BA1',
    // Primary — Warm Champagne Gold
    accent: '#E2B95B',
    accent2: '#F0CC7A',
    accentSoft: 'rgba(226, 185, 91, 0.14)',
    accentGlow: 'rgba(226, 185, 91, 0.24)',
    // Semantic — Calibrated for Midnight Slate
    danger: '#F87171',
    dangerSoft: 'rgba(248, 113, 113, 0.14)',
    success: '#4ADE80',
    successSoft: 'rgba(74, 222, 128, 0.14)',
    warn: '#FBBF24',
    warnSoft: 'rgba(251, 191, 36, 0.14)',
    info: '#60A5FA',
    gradientBg: 'radial-gradient(1100px 520px at 82% -8%, rgba(226, 185, 91, 0.06), transparent 60%), radial-gradient(900px 460px at 12% 100%, rgba(56, 189, 248, 0.05), transparent 62%), linear-gradient(180deg, #0B0F16 0%, #101621 100%)',
    // Tooltip & Primary button text colors
    bgTooltip: '#F1F5F9',
    textTooltip: '#0C1017'
}

function initialMode() {
    if (typeof window === 'undefined') return 'light'
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function kebab(s) {
    return s
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .toLowerCase()
}

const TOKEN_ALIASES = {
    bg2: '--bg-2',
    bg3: '--bg-3',
    surface2: '--surface-2',
    surface3: '--surface-3',
    text2: '--text-2',
    text3: '--text-3',
    accent2: '--accent-2'
}

function applyTheme(m) {
    const t = m === 'dark' ? darkTheme : lightTheme
    const root = document.documentElement

    // Add transition class for smooth theme switch
    root.classList.add('ns-theme-transitioning')

    root.dataset.mode = m
    for (const [key, value] of Object.entries(t)) {
        root.style.setProperty(`--${kebab(key)}`, value)
        if (TOKEN_ALIASES[key]) {
            root.style.setProperty(TOKEN_ALIASES[key], value)
        }
    }
    if (m === 'light') {
        root.style.removeProperty('--bg-dark')
    }
    setTimeout(() => {
        root.classList.remove('ns-theme-transitioning')
    }, 300)
}

const mode = ref(initialMode())
const isSystem = ref(!localStorage.getItem(STORAGE_KEY))

watch(mode, (newMode) => {
    applyTheme(newMode)
    localStorage.setItem(STORAGE_KEY, newMode)
}, { immediate: true })

export function useTheme() {
    // Listen for system preference changes
    onMounted(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        mediaQuery.addEventListener('change', (e) => {
            if (isSystem.value) {
                mode.value = e.matches ? 'dark' : 'light'
            }
        })
    })

    return {
        mode: readonly(mode),
        isDark: () => mode.value === 'dark',
        isLight: () => mode.value === 'light',
        toggle() {
            mode.value = mode.value === 'dark' ? 'light' : 'dark'
            isSystem.value = false
        },
        set(value) {
            mode.value = value
            isSystem.value = false
        },
        useSystem() {
            const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
            mode.value = systemDark ? 'dark' : 'light'
            isSystem.value = true
            localStorage.removeItem(STORAGE_KEY)
        },
        isUsingSystem: () => isSystem.value
    }
}
