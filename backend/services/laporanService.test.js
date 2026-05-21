const assert = require('assert');
const test = require('node:test');
const Database = require('better-sqlite3');
const PizZip = require('pizzip');
const { generateLaporanBulanan, generateLaporanMingguan } = require('./laporanService');

function createDb() {
    const db = new Database(':memory:');
    db.exec(`
        CREATE TABLE perkara (
            nomor_perkara TEXT PRIMARY KEY,
            nama_perkara TEXT,
            para_pihak TEXT,
            jenis_perkara TEXT,
            sipp_tanggal_register TEXT,
            sipp_klasifikasi TEXT,
            sipp_status TEXT
        );
        CREATE TABLE jadwal_sidang (
            nomor_perkara TEXT,
            nomor INTEGER,
            tanggal TEXT
        );
        CREATE TABLE putusan_perkara (
            nomor_perkara TEXT PRIMARY KEY,
            tanggal_putusan TEXT,
            amar_putusan TEXT,
            status_putusan TEXT,
            tanggal_minutasi TEXT,
            majelis_hakim TEXT,
            panitera_pengganti TEXT,
            raw_text TEXT,
            raw_json TEXT,
            fetched_at TEXT
        );
    `);
    return db;
}

function insertPerkara(db, nomor, status = 'Minutasi', values = {}) {
    db.prepare(`
        INSERT INTO perkara (nomor_perkara, nama_perkara, para_pihak, jenis_perkara, sipp_tanggal_register, sipp_klasifikasi, sipp_status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
        nomor,
        values.nama_perkara || values.sipp_klasifikasi || 'Pidana Biasa',
        values.para_pihak || '',
        values.jenis_perkara || 'Pidana',
        values.sipp_tanggal_register || '02 Mei 2026',
        values.sipp_klasifikasi || values.nama_perkara || 'Pidana Biasa',
        status
    );
}

function insertPutusan(db, nomor, values) {
    db.prepare(`
        INSERT INTO putusan_perkara
        (nomor_perkara, tanggal_putusan, amar_putusan, status_putusan, tanggal_minutasi,
         majelis_hakim, panitera_pengganti, raw_text, raw_json, fetched_at)
        VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, '2026-05-20T00:00:00.000Z')
    `).run(
        nomor,
        values.tanggal_putusan || null,
        values.amar_putusan || null,
        values.status_putusan || null,
        values.tanggal_minutasi || null,
        values.raw_text || '',
        JSON.stringify(values.raw || [])
    );
}

function docRows(buffer) {
    const xml = new PizZip(buffer).files['word/document.xml'].asText();
    return getTableRows(xml).map(row => ({
        no: cellText(getRowCells(row)[0] || ''),
        text: cellText(row),
        xml: row,
        cells: getRowCells(row).map(cell => ({
            text: cellText(cell),
            xml: cell
        }))
    }));
}

function docXml(buffer) {
    return new PizZip(buffer).files['word/document.xml'].asText();
}

function getTableRows(xml) {
    const rows = [];
    let pos = 0;
    while (pos < xml.length) {
        const start = xml.indexOf('<w:tr', pos);
        if (start === -1) break;
        const end = xml.indexOf('</w:tr>', start) + 7;
        rows.push(xml.substring(start, end));
        pos = end;
    }
    return rows;
}

function getRowCells(rowXml) {
    const cells = [];
    let pos = 0;
    while (pos < rowXml.length) {
        const start = rowXml.indexOf('<w:tc>', pos);
        if (start === -1) break;
        const end = rowXml.indexOf('</w:tc>', start) + 7;
        cells.push(rowXml.substring(start, end));
        pos = end;
    }
    return cells;
}

function cellText(xml) {
    const parts = [];
    let pos = 0;
    while (pos < xml.length) {
        const wt = xml.indexOf('<w:t', pos);
        if (wt === -1) break;
        const nextChar = xml[wt + 4];
        if (nextChar !== '>' && nextChar !== ' ') {
            pos = wt + 4;
            continue;
        }
        const tagClose = xml.indexOf('>', wt) + 1;
        const textEnd = xml.indexOf('</w:t>', tagClose);
        if (textEnd === -1) break;
        parts.push(xml.substring(tagClose, textEnd));
        pos = textEnd + 6;
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function paragraphTexts(cellXml) {
    const paragraphs = [];
    let pos = 0;
    while (pos < cellXml.length) {
        const start = cellXml.indexOf('<w:p', pos);
        if (start === -1) break;
        const openEnd = cellXml.indexOf('>', start);
        const end = cellXml.indexOf('</w:p>', openEnd) + 6;
        paragraphs.push({
            text: cellText(cellXml.substring(start, end)),
            xml: cellXml.substring(start, end)
        });
        pos = end;
    }
    return paragraphs;
}

test('laporan bulanan mengisi row 3 denda dan row 4 anonimisasi dari putusan', () => {
    const db = createDb();
    insertPerkara(db, '10/Pid.B/2026/PN Ntn');
    insertPerkara(db, '11/Pid.B/2026/PN Ntn');
    insertPerkara(db, '12/Pid.B/2026/PN Ntn', 'Putus');

    insertPutusan(db, '10/Pid.B/2026/PN Ntn', {
        tanggal_putusan: 'Rabu, 20 Mei 2026',
        status_putusan: 'Pidana penjara dan denda Rp1.000.000,00'
    });
    insertPutusan(db, '11/Pid.B/2026/PN Ntn', {
        tanggal_putusan: 'Kamis, 21 Mei 2026',
        raw: [{ label: 'Pihak Dipublikasikan', value: 'Tidak' }]
    });
    insertPutusan(db, '12/Pid.B/2026/PN Ntn', {
        tanggal_putusan: 'Jumat, 22 Mei 2026',
        raw: [{ label: 'Pihak Dipublikasikan', value: 'Tidak' }]
    });

    const rows = docRows(generateLaporanBulanan(db, 'Pidana', 5, 2026, { end: '2026-05-31' }));
    const row3 = rows.find(row => row.no === '3').text;
    const row4 = rows.find(row => row.no === '4').text;

    assert.match(row3, /10\/Pid\.B\/2026\/PN Ntn/);
    assert.doesNotMatch(row3, /11\/Pid\.B\/2026\/PN Ntn/);
    assert.match(row3, /✓/);
    assert.doesNotMatch(row3, /âœ“/);
    assert.match(row4, /11\/Pid\.B\/2026\/PN Ntn/);
    assert.doesNotMatch(row4, /12\/Pid\.B\/2026\/PN Ntn/);
});

test('laporan mingguan membatasi row 3 dan row 4 ke periode laporan', () => {
    const db = createDb();
    insertPerkara(db, '20/Pid.B/2026/PN Ntn');
    insertPerkara(db, '21/Pid.B/2026/PN Ntn');
    insertPerkara(db, '22/Pid.B/2026/PN Ntn');

    insertPutusan(db, '20/Pid.B/2026/PN Ntn', {
        tanggal_putusan: 'Rabu, 20 Mei 2026',
        status_putusan: 'Pidana denda Rp500.000,00'
    });
    insertPutusan(db, '21/Pid.B/2026/PN Ntn', {
        tanggal_putusan: 'Kamis, 21 Mei 2026',
        raw: [{ label: 'Pihak Dipublikasikan', value: 'Tidak' }]
    });
    insertPutusan(db, '22/Pid.B/2026/PN Ntn', {
        tanggal_putusan: 'Rabu, 13 Mei 2026',
        status_putusan: 'Pidana denda Rp750.000,00',
        raw: [{ label: 'Pihak Dipublikasikan', value: 'Tidak' }]
    });

    const rows = docRows(generateLaporanMingguan(db, 'Pidana', '2026-05-18', '2026-05-24'));
    const row3 = rows.find(row => row.no === '3').text;
    const row4 = rows.find(row => row.no === '4').text;

    assert.match(row3, /20\/Pid\.B\/2026\/PN Ntn/);
    assert.doesNotMatch(row3, /22\/Pid\.B\/2026\/PN Ntn/);
    assert.match(row4, /21\/Pid\.B\/2026\/PN Ntn/);
    assert.doesNotMatch(row4, /22\/Pid\.B\/2026\/PN Ntn/);
});

test('laporan bulanan membaca tanggal putusan dari teks jika kolom tanggal berisi placeholder', () => {
    const db = createDb();
    insertPerkara(db, '15/Pid.Sus/2026/PN Ntn', 'Pengiriman Berkas  Banding', {
        sipp_tanggal_register: '13 Feb 2026'
    });
    insertPutusan(db, '15/Pid.Sus/2026/PN Ntn', {
        tanggal_putusan: 'Tanggal Putusan',
        tanggal_minutasi: 'Tanggal Minutasi',
        status_putusan: 'No Nama Tanggal Putusan Putusan 1IMAM KANAFI Kamis, 23 Apr. 2026 Pidana Denda Rp.500.000.000,00'
    });

    const rows = docRows(generateLaporanBulanan(db, 'Pidana', 4, 2026, { end: '2026-04-30' }));
    const row3 = rows.find(row => row.no === '3').text;

    assert.match(row3, /15\/Pid\.Sus\/2026\/PN Ntn/);
});

test('laporan bulanan membaca tanggal perkara disamarkan dari teks jika kolom tanggal berisi placeholder', () => {
    const db = createDb();
    insertPerkara(db, '2/Pid.Sus-Anak/2026/PN Ntn', 'Minutasi', {
        sipp_tanggal_register: '31 Mar 2026'
    });
    insertPutusan(db, '2/Pid.Sus-Anak/2026/PN Ntn', {
        tanggal_putusan: 'Tanggal Putusan',
        tanggal_minutasi: 'Tanggal Minutasi',
        status_putusan: 'No Nama Tanggal Putusan Putusan 1Terdakwa1 Kamis, 16 Apr. 2026 Pidana Penjara Waktu Tertentu (2 Tahun)',
        raw: [{ label: 'Amar Putusan', value: 'Disamarkan' }]
    });

    const rows = docRows(generateLaporanBulanan(db, 'Pidana', 4, 2026, { end: '2026-04-30' }));
    const row4 = rows.find(row => row.no === '4').text;

    assert.match(row4, /2\/Pid\.Sus-Anak\/2026\/PN Ntn/);
});

test('laporan bulanan memasukkan perkara register yang pihaknya disamarkan', () => {
    const db = createDb();
    insertPerkara(db, '24/Pid.Sus/2026/PN Ntn', 'Persidangan', {
        sipp_tanggal_register: '02 Apr 2026',
        para_pihak: 'Penuntut Umum:MUHAMMAD SAID LUBIS, S.H.Terdakwa:Disamarkan'
    });

    const rows = docRows(generateLaporanBulanan(db, 'Pidana', 4, 2026, { end: '2026-04-30' }));
    const row4 = rows.find(row => row.no === '4').text;

    assert.match(row4, /24\/Pid\.Sus\/2026\/PN Ntn/);
});

test('laporan bulanan memasukkan perkara bersidang yang pihaknya disamarkan', () => {
    const db = createDb();
    insertPerkara(db, '17/Pid.Sus/2026/PN Ntn', 'Persidangan', {
        sipp_tanggal_register: '19 Feb 2026',
        para_pihak: 'Penuntut Umum:KARYA SO IMMANUEL GORT, S.H., M.H.Terdakwa:Disamarkan'
    });
    db.prepare(`
        INSERT INTO jadwal_sidang (nomor_perkara, nomor, tanggal)
        VALUES ('17/Pid.Sus/2026/PN Ntn', 1, 'Senin, 20 Apr. 2026')
    `).run();

    const rows = docRows(generateLaporanBulanan(db, 'Pidana', 4, 2026, { end: '2026-04-30' }));
    const row4 = rows.find(row => row.no === '4').text;

    assert.match(row4, /17\/Pid\.Sus\/2026\/PN Ntn/);
});

test('row 2 pidana kosong jika hanya ada sidang perkara non-tilang', () => {
    const db = createDb();
    insertPerkara(db, '30/Pid.B/2026/PN Ntn');
    db.prepare(`
        INSERT INTO jadwal_sidang (nomor_perkara, nomor, tanggal)
        VALUES ('30/Pid.B/2026/PN Ntn', 1, 'Selasa, 05 Mei 2026')
    `).run();

    const rows = docRows(generateLaporanBulanan(db, 'Pidana', 5, 2026, { end: '2026-05-31' }));
    const row2 = rows.find(row => row.no === '2').text;
    const row5 = rows.find(row => row.no === '5').text;

    assert.match(row2, /Perkara Tilan[g ]+- - - - -/);
    assert.doesNotMatch(row2, /30\/Pid\.B\/2026\/PN Ntn/);
    assert.match(row5, /30\/Pid\.B\/2026\/PN Ntn/);
});

test('row 2 pidana diisi hanya untuk perkara tilang dalam periode', () => {
    const db = createDb();
    insertPerkara(db, '31/Pid.B/2026/PN Ntn');
    insertPerkara(db, '32/Pid.C/2026/PN Ntn', 'Minutasi', {
        nama_perkara: 'Pelanggaran Lalu Lintas / Tilang',
        sipp_klasifikasi: 'Pelanggaran Lalu Lintas'
    });

    const rows = docRows(generateLaporanMingguan(db, 'Pidana', '2026-05-01', '2026-05-07'));
    const row2 = rows.find(row => row.no === '2').text;

    assert.match(row2, /32\/Pid\.C\/2026\/PN Ntn/);
    assert.doesNotMatch(row2, /31\/Pid\.B\/2026\/PN Ntn/);
});

test('row 5 pidana mingguan berisi semua perkara pidana yang bersidang pada periode', () => {
    const db = createDb();
    insertPerkara(db, '33/Pid.B/2026/PN Ntn');
    insertPerkara(db, '34/Pid.C/2026/PN Ntn', 'Minutasi', {
        nama_perkara: 'Pelanggaran Lalu Lintas / Tilang',
        sipp_klasifikasi: 'Pelanggaran Lalu Lintas'
    });
    insertPerkara(db, '35/Pid.B/2026/PN Ntn');

    db.prepare(`
        INSERT INTO jadwal_sidang (nomor_perkara, nomor, tanggal)
        VALUES
        ('33/Pid.B/2026/PN Ntn', 1, 'Senin, 04 Mei 2026'),
        ('34/Pid.C/2026/PN Ntn', 1, 'Selasa, 05 Mei 2026'),
        ('35/Pid.B/2026/PN Ntn', 1, 'Senin, 11 Mei 2026')
    `).run();

    const rows = docRows(generateLaporanMingguan(db, 'Pidana', '2026-05-01', '2026-05-07'));
    const row5 = rows.find(row => row.no === '5').text;

    assert.match(row5, /33\/Pid\.B\/2026\/PN Ntn/);
    assert.match(row5, /34\/Pid\.C\/2026\/PN Ntn/);
    assert.doesNotMatch(row5, /35\/Pid\.B\/2026\/PN Ntn/);
});

test('row 3 dan 4 kosong dibersihkan menjadi strip, bukan data bawaan template', () => {
    const db = createDb();
    const rows = docRows(generateLaporanBulanan(db, 'Pidana', 5, 2026, { end: '2026-05-31' }));
    const row3 = rows.find(row => row.no === '3').text;
    const row4 = rows.find(row => row.no === '4').text;

    assert.doesNotMatch(row3, /15\/ Pid\.Sus|18\/ Pid\.Sus/);
    assert.doesNotMatch(row4, /21\/ Pid\.Sus|24\/ Pid\.Sus|26\/ Pid\.Sus|28\/ Pid\.Sus/);
    assert.match(row3, /Denda \/ Uang Pengganti - - - - -/);
    assert.match(row4, /Anonimisasi Perkara - - - - -/);
});

test('row 5 kosong dibersihkan menjadi strip center', () => {
    const db = createDb();
    const rows = docRows(generateLaporanBulanan(db, 'Pidana', 5, 2026, { end: '2026-05-31' }));
    const row5 = rows.find(row => row.no === '5');

    assert.doesNotMatch(row5.text, /12\/ Pid\.B|13\/ Pid\.Sus|26\/ Pid\.Sus/);
    assert.match(row5.text, /Berita Acara Sidang - - - - -/);

    for (const cell of row5.cells.slice(2)) {
        assert.strictEqual(cell.text, '-');
        assert.match(cell.xml, /<w:jc w:val="center"\/>/);
    }
});

test('strip kosong di kolom nomor perkara ikut center seperti contoh', () => {
    const db = createDb();
    const rows = docRows(generateLaporanBulanan(db, 'Pidana', 5, 2027, { end: '2027-05-31' }));
    const row3 = rows.find(row => row.no === '3');
    const nomorCellParagraphs = paragraphTexts(row3.cells[1].xml);
    const dashParagraph = nomorCellParagraphs.find(paragraph => paragraph.text === '-');

    assert.ok(dashParagraph);
    assert.match(dashParagraph.xml, /<w:jc w:val="center"\/>/);
});

test('tabel laporan memakai fixed layout agar kolom tidak melebar saat digenerate', () => {
    const db = createDb();
    insertPerkara(db, '123456789/Pid.Sus-Panjang/2028/PN Ntn');

    const xml = docXml(generateLaporanBulanan(db, 'Pidana', 5, 2028, { end: '2028-05-31' }));

    assert.match(xml, /<w:tblLayout w:type="fixed"\/>/);
});

test('laporan bulanan mengurutkan nomor perkara secara numerik jika tanggal register sama', () => {
    const db = createDb();
    insertPerkara(db, '24/Pid.Sus/2026/PN Ntn', 'Minutasi', { sipp_tanggal_register: '05 Mei 2026' });
    insertPerkara(db, '23/Pid.B/2026/PN Ntn', 'Minutasi', { sipp_tanggal_register: '05 Mei 2026' });
    insertPerkara(db, '25/Pid.B/2026/PN Ntn', 'Minutasi', { sipp_tanggal_register: '05 Mei 2026' });
    insertPerkara(db, '26/Pid.Sus/2026/PN Ntn', 'Minutasi', { sipp_tanggal_register: '05 Mei 2026' });

    const rows = docRows(generateLaporanBulanan(db, 'Pidana', 5, 2026, { end: '2026-05-31' }));
    const row1 = rows.find(row => row.no === '1').text;

    assert.ok(row1.indexOf('23/Pid.B/2026/PN Ntn') < row1.indexOf('24/Pid.Sus/2026/PN Ntn'));
    assert.ok(row1.indexOf('24/Pid.Sus/2026/PN Ntn') < row1.indexOf('25/Pid.B/2026/PN Ntn'));
    assert.ok(row1.indexOf('25/Pid.B/2026/PN Ntn') < row1.indexOf('26/Pid.Sus/2026/PN Ntn'));
});

test('laporan bulanan perdata tidak mengisi row Perkara Eksekusi dengan perkara disamarkan non-eksekusi', () => {
    const db = createDb();
    insertPerkara(db, '6/Pdt.G/2026/PN Ntn', 'Minutasi', {
        jenis_perkara: 'Perdata',
        sipp_tanggal_register: '10 April 2026',
        sipp_klasifikasi: 'Perceraian'
    });
    insertPerkara(db, '7/Pdt.G/2026/PN Ntn', 'Minutasi', {
        jenis_perkara: 'Perdata',
        sipp_tanggal_register: '11 April 2026',
        sipp_klasifikasi: 'Perceraian'
    });
    insertPutusan(db, '6/Pdt.G/2026/PN Ntn', {
        tanggal_putusan: 'Senin, 20 April 2026',
        tanggal_minutasi: 'Selasa, 21 April 2026',
        raw: [{ label: 'Pihak Dipublikasikan', value: 'Tidak' }]
    });
    insertPutusan(db, '7/Pdt.G/2026/PN Ntn', {
        tanggal_putusan: 'Rabu, 22 April 2026',
        tanggal_minutasi: 'Kamis, 23 April 2026',
        raw: [{ label: 'Pihak Dipublikasikan', value: 'Tidak' }]
    });

    const rows = docRows(generateLaporanBulanan(db, 'Perdata', 4, 2026, { end: '2026-04-30' }));
    const row4 = rows.find(row => row.no === '4');

    assert.match(row4.text, /Perkara Eksekusi/);
    assert.doesNotMatch(row4.text, /6\/Pdt\.G\/2026\/PN Ntn/);
    assert.doesNotMatch(row4.text, /7\/Pdt\.G\/2026\/PN Ntn/);
    assert.match(row4.text, /Perkara Eksekusi - - - - -/);
});

test('laporan bulanan perdata mengisi row Anonimisasi, Eksekusi, dan Dispensasi sesuai label template', () => {
    const db = createDb();
    insertPerkara(db, '6/Pdt.G/2026/PN Ntn', 'Minutasi', {
        jenis_perkara: 'Perdata',
        sipp_tanggal_register: '10 April 2026',
        para_pihak: 'Penggugat:Disamarkan',
        sipp_klasifikasi: 'Perceraian'
    });
    insertPerkara(db, '8/Pdt.Eks/2026/PN Ntn', 'Minutasi', {
        jenis_perkara: 'Perdata',
        sipp_tanggal_register: '12 April 2026',
        sipp_klasifikasi: 'Eksekusi'
    });
    insertPerkara(db, '9/Pdt.P/2026/PN Ntn', 'Minutasi', {
        jenis_perkara: 'Perdata',
        sipp_tanggal_register: '13 April 2026',
        sipp_klasifikasi: 'Dispensasi Kawin'
    });

    const rows = docRows(generateLaporanBulanan(db, 'Perdata', 4, 2026, { end: '2026-04-30' }));
    const row3 = rows.find(row => row.no === '3').text;
    const row4 = rows.find(row => row.no === '4').text;
    const row5 = rows.find(row => row.no === '5').text;

    assert.match(row3, /Anonimisasi Perkara/);
    assert.match(row3, /6\/Pdt\.G\/2026\/PN Ntn/);
    assert.doesNotMatch(row3, /8\/Pdt\.Eks\/2026\/PN Ntn/);
    assert.match(row4, /Perkara Eksekusi/);
    assert.match(row4, /8\/Pdt\.Eks\/2026\/PN Ntn/);
    assert.doesNotMatch(row4, /6\/Pdt\.G\/2026\/PN Ntn/);
    assert.match(row5, /Dispensasi dan Ijin Nikah/);
    assert.match(row5, /9\/Pdt\.P\/2026\/PN Ntn/);
});

test('laporan bulanan perdata memasukkan perkara anonimisasi ke Berita Acara Sidang', () => {
    const db = createDb();
    insertPerkara(db, '6/Pdt.G/2026/PN Ntn', 'Minutasi', {
        jenis_perkara: 'Perdata',
        sipp_tanggal_register: '10 April 2026',
        para_pihak: 'Penggugat:Disamarkan',
        sipp_klasifikasi: 'Perceraian'
    });
    insertPerkara(db, '7/Pdt.G/2026/PN Ntn', 'Minutasi', {
        jenis_perkara: 'Perdata',
        sipp_tanggal_register: '11 April 2026',
        sipp_klasifikasi: 'Perceraian'
    });
    db.prepare(`
        INSERT INTO jadwal_sidang (nomor_perkara, nomor, tanggal)
        VALUES ('7/Pdt.G/2026/PN Ntn', 1, 'Senin, 13 April 2026')
    `).run();

    const rows = docRows(generateLaporanBulanan(db, 'Perdata', 4, 2026, { end: '2026-04-30' }));
    const row2 = rows.find(row => row.no === '2').text;
    const row3 = rows.find(row => row.no === '3').text;

    assert.match(row2, /Berita Acara Sidang/);
    assert.match(row2, /6\/Pdt\.G\/2026\/PN Ntn/);
    assert.match(row2, /7\/Pdt\.G\/2026\/PN Ntn/);
    assert.ok(row2.indexOf('6/Pdt.G/2026/PN Ntn') < row2.indexOf('7/Pdt.G/2026/PN Ntn'));
    assert.match(row3, /6\/Pdt\.G\/2026\/PN Ntn/);
});

test('laporan mingguan perdata memasukkan perkara anonimisasi ke Berita Acara Sidang', () => {
    const db = createDb();
    insertPerkara(db, '6/Pdt.G/2026/PN Ntn', 'Minutasi', {
        jenis_perkara: 'Perdata',
        sipp_tanggal_register: '04 Mei 2026',
        para_pihak: 'Penggugat:Disamarkan',
        sipp_klasifikasi: 'Perceraian'
    });
    insertPerkara(db, '7/Pdt.G/2026/PN Ntn', 'Minutasi', {
        jenis_perkara: 'Perdata',
        sipp_tanggal_register: '05 Mei 2026',
        sipp_klasifikasi: 'Perceraian'
    });
    db.prepare(`
        INSERT INTO jadwal_sidang (nomor_perkara, nomor, tanggal)
        VALUES ('7/Pdt.G/2026/PN Ntn', 1, 'Selasa, 05 Mei 2026')
    `).run();

    const rows = docRows(generateLaporanMingguan(db, 'Perdata', '2026-05-01', '2026-05-07'));
    const row2 = rows.find(row => row.no === '2').text;
    const row3 = rows.find(row => row.no === '3').text;

    assert.match(row2, /Berita Acara Sidang/);
    assert.match(row2, /6\/Pdt\.G\/2026\/PN Ntn/);
    assert.match(row2, /7\/Pdt\.G\/2026\/PN Ntn/);
    assert.ok(row2.indexOf('6/Pdt.G/2026/PN Ntn') < row2.indexOf('7/Pdt.G/2026/PN Ntn'));
    assert.match(row3, /6\/Pdt\.G\/2026\/PN Ntn/);
});

test('laporan mingguan perdata tidak memakai mapping pidana untuk row 3 sampai 5', () => {
    const db = createDb();
    insertPerkara(db, '6/Pdt.G/2026/PN Ntn', 'Minutasi', {
        jenis_perkara: 'Perdata',
        sipp_tanggal_register: '04 Mei 2026',
        para_pihak: 'Penggugat:Disamarkan',
        sipp_klasifikasi: 'Perceraian'
    });
    insertPerkara(db, '8/Pdt.Eks/2026/PN Ntn', 'Minutasi', {
        jenis_perkara: 'Perdata',
        sipp_tanggal_register: '05 Mei 2026',
        sipp_klasifikasi: 'Eksekusi'
    });
    insertPerkara(db, '9/Pdt.P/2026/PN Ntn', 'Minutasi', {
        jenis_perkara: 'Perdata',
        sipp_tanggal_register: '06 Mei 2026',
        sipp_klasifikasi: 'Ijin Nikah'
    });

    const rows = docRows(generateLaporanMingguan(db, 'Perdata', '2026-05-01', '2026-05-07'));
    const row3 = rows.find(row => row.no === '3').text;
    const row4 = rows.find(row => row.no === '4').text;
    const row5 = rows.find(row => row.no === '5').text;

    assert.match(row3, /Anonimisasi Perkara/);
    assert.match(row3, /6\/Pdt\.G\/2026\/PN Ntn/);
    assert.match(row4, /Perkara Eksekusi/);
    assert.match(row4, /8\/Pdt\.Eks\/2026\/PN Ntn/);
    assert.doesNotMatch(row4, /6\/Pdt\.G\/2026\/PN Ntn/);
    assert.match(row5, /Dispensasi dan Ijin Nikah/);
    assert.match(row5, /9\/Pdt\.P\/2026\/PN Ntn/);
});

test('laporan bulanan perikanan tidak mengisi row kosong dengan data pidana', () => {
    const db = createDb();
    insertPerkara(db, '1/Pid.Sus-PRK/2026/PN Ntn', 'Minutasi', {
        jenis_perkara: 'Perikanan',
        sipp_tanggal_register: '10 April 2026',
        sipp_klasifikasi: 'Perikanan'
    });
    insertPutusan(db, '1/Pid.Sus-PRK/2026/PN Ntn', {
        tanggal_putusan: 'Senin, 20 April 2026',
        status_putusan: 'Pidana denda Rp500.000,00',
        raw: [{ label: 'Pihak Dipublikasikan', value: 'Tidak' }]
    });

    const rows = docRows(generateLaporanBulanan(db, 'Perikanan', 4, 2026, { end: '2026-04-30' }));

    for (const no of ['3', '4', '5']) {
        const row = rows.find(item => item.no === no).text;
        assert.doesNotMatch(row, /1\/Pid\.Sus-PRK\/2026\/PN Ntn/);
        assert.match(row, new RegExp(`^${no}(?: -)+$`));
    }
});

test('row 5 kosong tidak mempertahankan tinggi besar bawaan template', () => {
    const db = createDb();
    const rows = docRows(generateLaporanBulanan(db, 'Pidana', 5, 2028, { end: '2028-05-31' }));
    const row5 = rows.find(row => row.no === '5');

    assert.doesNotMatch(row5.xml, /<w:trHeight w:val="3440"\/>/);
});

test('semua bagian a sampai e tetap berisi strip jika tidak ada data', () => {
    const db = createDb();
    const rows = docRows(generateLaporanBulanan(db, 'Pidana', 5, 2028, { end: '2028-05-31' }));

    for (const no of ['1', '2', '3', '4', '5']) {
        const row = rows.find(item => item.no === no);
        assert.ok(row, `row ${no} tidak ditemukan`);
        assert.strictEqual(row.cells[1].text.endsWith('-'), true);
        for (const cell of row.cells.slice(2)) {
            assert.strictEqual(cell.text, '-');
        }
    }
});
