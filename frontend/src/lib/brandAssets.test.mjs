import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')

test('brand logo assets used by the app exist', () => {
    const icon = resolve(root, 'public/brand-logo-icon.svg')
    const horizontalLight = resolve(root, 'public/brand-logo-horizontal-light.svg')
    const horizontalDark = resolve(root, 'public/brand-logo-horizontal-dark.svg')

    assert.equal(existsSync(icon), true)
    assert.equal(existsSync(horizontalLight), true)
    assert.equal(existsSync(horizontalDark), true)
})

test('sidebar references horizontal brand and dashboard does not duplicate the logo', () => {
    const dataView = readFileSync(resolve(root, 'src/views/DataView.vue'), 'utf8')
    const sidebar = readFileSync(resolve(root, 'src/components/shell/Sidebar.vue'), 'utf8')
    const index = readFileSync(resolve(root, 'index.html'), 'utf8')

    assert.doesNotMatch(dataView, /brand-logo-horizontal\.svg/)
    assert.match(sidebar, /brand-logo-horizontal-\$\{variant\}\.svg/)
    assert.match(index, /brand-logo-icon\.svg/)
})

test('horizontal wordmark has separate light and dark variants', () => {
    const light = readFileSync(resolve(root, 'public/brand-logo-horizontal-light.svg'), 'utf8')
    const dark = readFileSync(resolve(root, 'public/brand-logo-horizontal-dark.svg'), 'utf8')

    assert.match(light, /fill="#064532"/)
    assert.match(light, /#07543f/)
    assert.match(light, /#d99a00/)
    assert.doesNotMatch(light, /#ffffff/)

    assert.match(dark, /fill="#f8fafc"/)
    assert.match(dark, /fill="#7cc242"/)
    assert.match(dark, /#ffffff/)
    assert.match(dark, /#f5b70a/)
    assert.doesNotMatch(dark, /#bfdbfe/)
    assert.doesNotMatch(dark, /#38bdf8/)
    assert.doesNotMatch(dark, /stroke="#020617"/)
    assert.doesNotMatch(dark, /stroke="#001c3d"/)
})

test('page icon uses the dark-mode mark', () => {
    const icon = readFileSync(resolve(root, 'public/brand-logo-icon.svg'), 'utf8')

    assert.match(icon, /#ffffff/)
    assert.match(icon, /#f8fafc/)
    assert.match(icon, /#7cc242/)
    assert.match(icon, /#f5b70a/)
    assert.doesNotMatch(icon, /#062b57/)
    assert.doesNotMatch(icon, /#001c3d/)
})
