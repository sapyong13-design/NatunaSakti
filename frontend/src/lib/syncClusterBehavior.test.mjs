import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')

test('sync cluster keeps listening when backend says sync is already in progress', () => {
    const source = readFileSync(resolve(root, 'src/components/dashboard/SyncCluster.vue'), 'utf8')

    assert.match(source, /isSyncAlreadyInProgress/)
    assert.match(source, /Sync already in progress/)
    assert.match(source, /return\s*\n\s*}/)
})
