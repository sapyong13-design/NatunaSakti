const DEFAULT_DASHBOARD_STATE = {
    search: '',
    jenis: 'Semua',
    tahun: '',
    status: 'Semua',
    viewMode: 'table',
    density: 'default',
    page: 1
}

const JENIS_OPTIONS = new Set(['Semua', 'Pidana', 'Perdata', 'Perikanan', 'Hukum'])
const STATUS_OPTIONS = new Set(['Semua', 'Bersidang', 'Minutasi'])
const VIEW_OPTIONS = new Set(['table', 'kanban'])
const DENSITY_OPTIONS = new Set(['default', 'compact', 'spacious'])

function firstValue(value) {
    return Array.isArray(value) ? value[0] : value
}

function cleanString(value) {
    return String(firstValue(value) ?? '').trim()
}

export function normalizeDashboardState(state = {}) {
    const search = cleanString(state.search)
    const jenis = JENIS_OPTIONS.has(cleanString(state.jenis)) ? cleanString(state.jenis) : DEFAULT_DASHBOARD_STATE.jenis
    const status = STATUS_OPTIONS.has(cleanString(state.status)) ? cleanString(state.status) : DEFAULT_DASHBOARD_STATE.status
    const viewMode = VIEW_OPTIONS.has(cleanString(state.viewMode)) ? cleanString(state.viewMode) : DEFAULT_DASHBOARD_STATE.viewMode
    const density = DENSITY_OPTIONS.has(cleanString(state.density)) ? cleanString(state.density) : DEFAULT_DASHBOARD_STATE.density
    const tahun = /^\d{4}$/.test(cleanString(state.tahun)) ? cleanString(state.tahun) : DEFAULT_DASHBOARD_STATE.tahun
    const page = Number.parseInt(firstValue(state.page), 10)

    return {
        search,
        jenis,
        tahun,
        status,
        viewMode,
        density,
        page: Number.isInteger(page) && page > 0 ? page : DEFAULT_DASHBOARD_STATE.page
    }
}

export function dashboardStateFromQuery(query = {}) {
    return normalizeDashboardState({
        search: query.q,
        jenis: query.jenis,
        tahun: query.tahun,
        status: query.status,
        viewMode: query.view,
        density: query.density,
        page: query.page
    })
}

export function dashboardStateToQuery(state = {}) {
    const normalized = normalizeDashboardState(state)
    const query = {}

    if (normalized.search) query.q = normalized.search
    if (normalized.jenis !== DEFAULT_DASHBOARD_STATE.jenis) query.jenis = normalized.jenis
    if (normalized.tahun) query.tahun = normalized.tahun
    if (normalized.status !== DEFAULT_DASHBOARD_STATE.status) query.status = normalized.status
    if (normalized.viewMode !== DEFAULT_DASHBOARD_STATE.viewMode) query.view = normalized.viewMode
    if (normalized.density !== DEFAULT_DASHBOARD_STATE.density) query.density = normalized.density
    if (normalized.page !== DEFAULT_DASHBOARD_STATE.page) query.page = String(normalized.page)

    return query
}
