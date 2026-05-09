import { ref, watch, readonly, onMounted } from 'vue'

const STORAGE_KEY = 'ns-theme'

const lightTheme = {
    bg: '#FAFAF9',
    bg2: '#ffffff',
    bg3: '#F5F5F4',
    surface: 'rgba(255,255,255,0.95)',
    surface2: 'rgba(13,92,92,0.04)',
    surface3: 'rgba(13,92,92,0.08)',
    border: 'rgba(13,92,92,0.15)',
    text: '#1C1917',
    text2: 'rgba(28,25,23,0.85)',
    text3: 'rgba(28,25,23,0.55)',
    // Primary — Deep institutional teal
    accent: '#0D5C5C',
    accent2: '#0A4A4A',
    accentSoft: 'rgba(13,92,92,0.1)',
    accentGlow: 'rgba(13,92,92,0.2)',
    // Semantic — muted institutional
    danger: '#C75B4A',
    dangerSoft: 'rgba(199,91,74,0.12)',
    success: '#4A7C59',
    successSoft: 'rgba(74,124,89,0.12)',
    warn: '#B8860B',
    warnSoft: 'rgba(184,134,11,0.12)',
    info: '#0D5C5C',
    gradientBg: 'linear-gradient(180deg, #FAFAF9 0%, #F0F4F4 100%)',
    // Tooltip colors
    bgTooltip: '#1C1917',
    textTooltip: '#FAFAF9'
}

const darkTheme = {
    bg: '#1A1D1F',
    bg2: '#24282B',
    bg3: '#2D3236',
    surface: 'rgba(255,255,255,0.04)',
    surface2: 'rgba(255,255,255,0.02)',
    surface3: 'rgba(255,255,255,0.06)',
    border: 'rgba(255,255,255,0.1)',
    text: '#E8E6E3',
    text2: 'rgba(232,230,227,0.85)',
    text3: 'rgba(232,230,227,0.55)',
    // Primary — muted for dark mode
    accent: '#4DB6AC',
    accent2: '#80CBC4',
    accentSoft: 'rgba(77,182,172,0.14)',
    accentGlow: 'rgba(77,182,172,0.25)',
    // Semantic — adjusted for dark
    danger: '#E57373',
    dangerSoft: 'rgba(229,115,115,0.15)',
    success: '#81C784',
    successSoft: 'rgba(129,199,132,0.15)',
    warn: '#FFD54F',
    warnSoft: 'rgba(255,213,79,0.12)',
    info: '#4DB6AC',
    gradientBg: 'linear-gradient(180deg, #1A1D1F 0%, #24282B 100%)',
    // Tooltip colors
    bgTooltip: '#E8E6E3',
    textTooltip: '#1A1D1F'
}

function initialMode() {
    if (typeof window === 'undefined') return 'light'
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function kebab(s) {
    return s.replace(/[A-Z]/g, c => '-' + c.toLowerCase())
}

function applyTheme(m) {
    const t = m === 'dark' ? darkTheme : lightTheme
    const root = document.documentElement

    // Add transition class for smooth theme switch
    root.classList.add('ns-theme-transitioning')

    root.dataset.mode = m
    for (const [key, value] of Object.entries(t)) {
        root.style.setProperty(`--${kebab(key)}`, value)
    }

    // Remove transition class after animation
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
