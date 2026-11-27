import { API_BASE } from './api.js'

const officialStatuses = ['ready', 'unpublished', 'unavailable', 'empty']
const findingsStatuses = ['checked', 'partial', 'unavailable', 'not_case_based']

async function request(path, params, method, statuses, signal) {
    const response = await fetch(`${API_BASE}/eis${path}?${new URLSearchParams(params)}`, {
        method,
        cache: 'no-store',
        signal: AbortSignal.any([signal, AbortSignal.timeout(90000)])
    })
    const result = await response.json()
    // The server may include a usable snapshot even when an upstream refresh fails.
    if (!statuses.includes(result?.status)) {
        throw new Error(result?.error || `Respons EIS tidak valid (HTTP ${response.status}).`)
    }
    return result
}

export function getOfficialEis(period, refresh, signal) {
    return request(refresh ? '/refresh' : '', { period }, refresh ? 'POST' : 'GET', officialStatuses, signal)
}

export async function getEisScore(period, signal) {
    const response = await fetch(`${API_BASE}/eis/score?${new URLSearchParams({ period })}`, {
        cache: 'no-store',
        signal: AbortSignal.any([signal, AbortSignal.timeout(20000)])
    })
    const result = await response.json()
    if (!Array.isArray(result?.components)) throw new Error(result?.error || 'Skor hitung ulang tidak tersedia.')
    return result
}

export function getEisFindings(period, label, index, signal) {
    return request('/findings', { period, label, index }, 'GET', findingsStatuses, signal)
}

export async function getEisTrend(signal) {
    const response = await fetch(`${API_BASE}/eis/trend`, {
        cache: 'no-store',
        signal: AbortSignal.any([signal, AbortSignal.timeout(15000)])
    })
    const result = await response.json()
    if (!Array.isArray(result?.items)) throw new Error('Data tren EIS tidak tersedia.')
    return result.items
}

export async function getMisStatus(signal) {
    const response = await fetch(`${API_BASE}/eis/mis-status`, {
        cache: 'no-store',
        signal: AbortSignal.any([signal, AbortSignal.timeout(15000)])
    })
    const result = await response.json()
    if (!result || !['ready', 'unavailable'].includes(result.status)) {
        throw new Error('Respons status MIS tidak valid.')
    }
    return result
}
