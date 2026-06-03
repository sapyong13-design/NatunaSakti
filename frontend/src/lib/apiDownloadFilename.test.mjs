import test from 'node:test'
import assert from 'node:assert/strict'
import { getFilenameFromContentDisposition } from './api.js'

test('reads report filename from content-disposition header', () => {
    const header = 'attachment; filename="5. AKURASI PERIKANAN MEI 2026.docx"'

    assert.equal(
        getFilenameFromContentDisposition(header, 'fallback.docx'),
        '5. AKURASI PERIKANAN MEI 2026.docx'
    )
})

test('uses fallback filename when content-disposition has no filename', () => {
    assert.equal(
        getFilenameFromContentDisposition('attachment', 'fallback.docx'),
        'fallback.docx'
    )
})
