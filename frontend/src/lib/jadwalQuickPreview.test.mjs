import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')

test('jadwal quick preview fetches schedule when table row has no jadwal array', () => {
    const source = readFileSync(resolve(root, 'src/components/dashboard/JadwalQuickPreview.vue'), 'utf8')

    assert.match(source, /getJadwalSidang/)
    assert.match(source, /watch\(/)
    assert.match(source, /props\.row\?\.nomor_perkara/)
})
