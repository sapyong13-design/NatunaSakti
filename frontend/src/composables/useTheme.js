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
    // Midnight Court - Navy Deep + Warm Cream
    bg: '#1A1816',
    bg2: '#242020',
    bg3: '#2D2826',
    surface: 'rgba(255,255,255,0.04)',
    surface2: 'rgba(255,255,255,0.03)',
    surface3: 'rgba(255,255,255,0.07)',
    border: 'rgba(212,184,150,0.15)',
    text: '#FAF8F5',
    text2: 'rgba(250,248,245,0.8)',
    text3: 'rgba(250,248,245,0.5)',
    // Primary — Gold Accent for midnight
    accent: '#C9A962',
    accent2: '#D4B872',
    accentSoft: 'rgba(201,169,98,0.14)',
    accentGlow: 'rgba(201,169,98,0.2)',
    // Semantic — adjusted for midnight
    danger: '#E57373',
    dangerSoft: 'rgba(229,115,115,0.15)',
    success: '#81C784',
    successSoft: 'rgba(129,199,132,0.15)',
    warn: '#FFD54F',
    warnSoft: 'rgba(255,213,79,0.12)',
    info: '#C9A962',
    gradientBg: 'linear-gradient(180deg, #1A1816 0%, #242020 100%)',
    // Tooltip colors
    bgTooltip: '#FAF8F5',
    textTooltip: '#1A1816'
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
