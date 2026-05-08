import { ref, watch, readonly } from 'vue'

const STORAGE_KEY = 'ns-theme'

const lightTheme = {
    bg: '#fbfdfc',
    bg2: '#ffffff',
    surface: 'rgba(255,255,255,0.95)',
    surface2: 'rgba(16,75,55,0.04)',
    border: 'rgba(16,75,55,0.1)',
    text: '#0a2e22',
    text2: 'rgba(10,46,34,0.7)',
    text3: 'rgba(10,46,34,0.5)',
    accent: '#047857',
    accent2: '#10b981',
    accentSoft: 'rgba(4,120,87,0.1)',
    accentGlow: 'rgba(4,120,87,0.25)',
    danger: '#dc2626',
    warn: '#d97706',
    info: '#1d4ed8',
    gradientBg: '#fbfdfc'
}

const darkTheme = {
    bg: '#0a1612',
    bg2: '#0f1f1a',
    surface: 'rgba(255,255,255,0.04)',
    surface2: 'rgba(255,255,255,0.02)',
    border: 'rgba(255,255,255,0.08)',
    text: '#e5f0ea',
    text2: 'rgba(229,240,234,0.72)',
    text3: 'rgba(229,240,234,0.45)',
    accent: '#10b981',
    accent2: '#34d399',
    accentSoft: 'rgba(16,185,129,0.14)',
    accentGlow: 'rgba(16,185,129,0.4)',
    danger: '#f87171',
    warn: '#fbbf24',
    info: '#60a5fa',
    gradientBg: '#0a1612'
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
    root.dataset.mode = m
    for (const [key, value] of Object.entries(t)) {
        root.style.setProperty(`--${kebab(key)}`, value)
    }
}

const mode = ref(initialMode())
watch(mode, applyTheme, { immediate: true })

export function useTheme() {
    return {
        mode: readonly(mode),
        isDark: () => mode.value === 'dark',
        toggle() {
            mode.value = mode.value === 'dark' ? 'light' : 'dark'
            localStorage.setItem(STORAGE_KEY, mode.value)
        }
    }
}
