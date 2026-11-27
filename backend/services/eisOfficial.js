const { currentEisDay, parseEisPeriod } = require('../lib/eisPeriod');

const HOST = 'evaluasi.badilum.mahkamahagung.go.id';
const ORIGIN = `https://${HOST}`;
const DATATABLES_HOST = 'cdn.datatables.net';
const PAGE = '/evaluasi3';
const TAB_IDS = ['kinerja', 'kepatuhan', 'kelengkapan', 'kesesuaian', 'konversi'];
const COURT_NAMES = ['PN Natuna', 'Pengadilan Negeri Natuna'];
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const PUBLIC_POSTS = new Set([
    '/evaluasipn', '/HalamanUtamaBaru/juara', '/HalamanUtamaBaru/modal',
    ...TAB_IDS.map((_, i) => `/HalamanUtamaBaru/detiltab${i + 1}`)
]);
const DATATABLES_ASSETS = new Map([
    ['/1.10.20/js/jquery.dataTables.min.js', 'script'],
    ['/1.10.20/js/dataTables.bootstrap4.min.js', 'script'],
    ['/1.10.20/css/dataTables.bootstrap4.min.css', 'stylesheet']
]);
const SCORE = /^-?\d+(?:[.,]\d+)?\s*%?$/;
const NO_DATA = /^(?:tidak ada data(?: yang tersedia)?|data (?:tidak tersedia|belum tersedia|belum dipublikasikan)|no data available in table)\.?$/i;

class SourceUnavailable extends Error {}

function allowedRequest(page, request) {
    const url = new URL(request.url());
    if (url.username || url.password || request.frame() !== page.mainFrame()) return false;
    const { origin, pathname } = url;
    const method = request.method();
    const type = request.resourceType();
    if (origin === ORIGIN) {
        if (type === 'document') return method === 'GET' && pathname === PAGE;
        if (type === 'xhr') return method === 'POST' && PUBLIC_POSTS.has(pathname);
        return method === 'GET' && ['script', 'stylesheet', 'image', 'font'].includes(type) &&
            (pathname.startsWith('/assets_pn/') || pathname.startsWith('/assets/plugins/'));
    }
    return origin === `https://${DATATABLES_HOST}` && method === 'GET' && DATATABLES_ASSETS.get(pathname) === type;
}

// Read the public DataTables draw state instead of assuming a visible court link belongs to
// the new filters. The initial draw and a filter search can both contain the exact same court.
function completedDraw(filters, previous) {
    const table = document.querySelector('#TabelData');
    if (!table || !window.jQuery?.fn?.dataTable?.isDataTable(table)) return false;
    const api = window.jQuery(table).DataTable();
    const settings = api.settings()[0];
    const json = api.ajax.json();
    const data = api.ajax.params();
    const button = document.querySelector('.btn-modern-search');
    if (settings === previous || !button || button.disabled || !json || json.error || json.sError ||
        !Array.isArray(json.data) || Number(json.draw) !== settings.iDraw ||
        json.recordsFiltered == null || Number(json.recordsFiltered) !== json.data.length) return false;
    if (filters && (!data || !Object.entries(filters).every(([name, value]) =>
        data[name] === value && document.getElementById(name)?.value === value))) return false;
    const rendered = [...(table.tBodies[0]?.rows ?? [])].filter(row => !row.querySelector('td.dataTables_empty'));
    return rendered.length === json.data.length;
}

function clickCourt(names) {
    const clean = text => text.replace(/\s+/g, ' ').trim();
    const table = document.querySelector('#TabelData');
    const courtColumn = [...(table?.tHead?.rows[0]?.cells ?? [])].findIndex(cell => clean(cell.textContent).toUpperCase() === 'PENGADILAN');
    if (courtColumn === -1) return 'ambiguous';
    const rows = [...(table.tBodies[0]?.rows ?? [])];
    const cells = rows.map(row => row.cells[courtColumn]).filter(Boolean);
    if (cells.length !== rows.length && !rows.every(row => row.querySelector('td.dataTables_empty'))) return 'ambiguous';
    const exact = cells.filter(cell => names.includes(clean(cell.textContent)) ||
        [...cell.querySelectorAll('a')].some(a => names.includes(clean(a.title))));
    const links = exact.flatMap(cell => [...cell.querySelectorAll('a')].filter(a =>
        names.includes(clean(a.textContent)) || names.includes(clean(a.title))));
    if (exact.length === 0) return 'absent';
    if (exact.length !== 1 || links.length !== 1) return 'ambiguous';
    links[0].click();
    return 'clicked';
}

function modalData() {
    const modal = document.querySelector('#ModalDetil.show');
    const bodies = [1, 2, 3, 4, 5].map(i => modal?.querySelector(`#tabel_detil_evaluasi_tab${i}`));
    if (!modal || !bodies.every(body => body?.rows.length)) return false;
    const clean = text => text.replace(/\s+/g, ' ').trim();
    const cell = c => ({ text: clean(c.textContent), cols: c.colSpan, rows: c.rowSpan });
    return {
        title: clean(modal.querySelector('#judul_nama_pengadilan')?.textContent ?? ''),
        period: clean(modal.querySelector('#judul_periode')?.textContent ?? ''),
        tables: bodies.map(body => ({
            heading: [...(body.parentElement.tHead?.rows[0]?.cells ?? [])].map(c => cell(c).text),
            rows: [...body.rows].map(row => [...row.cells].map((c, column) => {
                const shape = cell(c);
                if (column === 1) {
                    const label = c.querySelector('b, strong');
                    shape.label = label ? clean(label.textContent) : '';
                    // The official description uses BRs to label grouped sub-indicators a., b., etc.
                    const lines = [''];
                    function collect(node) {
                        if (node === label) return;
                        if (node.nodeType === Node.TEXT_NODE) lines[lines.length - 1] += node.textContent;
                        else if (node.nodeName === 'BR') lines.push('');
                        else if (!['SCRIPT', 'STYLE'].includes(node.nodeName)) node.childNodes.forEach(collect);
                    }
                    collect(c);
                    shape.description = lines.map(clean).filter(Boolean);
                }
                if (column === 2) {
                    shape.details = [...c.querySelectorAll('table')].map(table =>
                        [...table.rows].map(detail => [...detail.cells].map(cell)));
                }
                return shape;
            }))
        }))
    };
}

function requireSource(condition, message = 'Format tabel EIS resmi berubah atau belum lengkap.') {
    if (!condition) throw new SourceUnavailable(message);
}

function normalCells(cells, count) {
    return cells.length === count && cells.every(cell => cell.cols === 1 && cell.rows === 1);
}

function extractIndicator(cells) {
    requireSource(normalCells(cells, 4));
    const [number, indicator, breakdown, points] = cells;
    requireSource(/^\d+\.?$/.test(number.text) && indicator.label && SCORE.test(points.text));
    requireSource(breakdown.details.length === 1);
    const [heading, ...entries] = breakdown.details[0];
    requireSource(heading?.length && normalCells(heading, heading.length) && heading.every(cell => cell.text));
    requireSource(entries.every(entry => normalCells(entry, heading.length)));
    const grouped = indicator.description.every(line => /^[a-z][.)]\s/i.test(line)) && indicator.description.length > 1;
    if (entries.length > 1 || grouped) requireSource(grouped && entries.length === indicator.description.length);
    return {
        label: indicator.label,
        description: indicator.description.join('\n'),
        headers: heading.map(cell => cell.text),
        // Blank counts are not zero: the public site sometimes renders four blank rows for PK.
        details: entries.map((entry, i) => ({
            ...(grouped ? { label: indicator.description[i] } : {}),
            values: entry.map(cell => cell.text)
        })),
        points: points.text
    };
}

function extractConversion(table) {
    const headers = table.heading.slice(2);
    const displayNames = ['Kinerja', 'Kepatuhan', 'Kelengkapan', 'Kesesuaian'];
    requireSource(table.rows.length === displayNames.length + 1);
    const rows = table.rows.slice(0, displayNames.length).map((cells, i) => {
        requireSource(normalCells(cells, 5) && cells[1].text === displayNames[i] &&
            cells.slice(2).every(cell => SCORE.test(cell.text)));
        const values = cells.slice(2).map(cell => cell.text);
        return { label: cells[1].text, description: '', headers, details: [{ values }], points: values[2] };
    });
    const summary = table.rows.at(-1);
    requireSource(summary.length === 2 && summary[0].cols === 4 && summary.every(cell => cell.rows === 1) &&
        summary[1].cols === 1 && SCORE.test(summary[1].text));
    rows.push({
        label: summary[0].text || '% Implementasi SIPP', description: '',
        headers: [headers[2]], details: [{ values: [summary[1].text] }], points: summary[1].text
    });
    return rows;
}

function extractSnapshot(data, year, month) {
    const date = `${MONTHS[month - 1]} ${year}`;
    requireSource(COURT_NAMES.includes(data.title) && data.period === `Periode ${date} s.d ${date}`,
        'Judul pengadilan atau bulan pada detail EIS resmi tidak cocok.');
    const conversionHeading = ['#', 'KATEGORI', 'NILAI MAKSIMAL', 'NILAI SATKER', 'KONVERSI %'];
    const indicatorHeading = ['#', 'UNSUR', 'DETAIL', 'POINT'];
    data.tables.forEach((table, i) => {
        const expected = i === 4 ? conversionHeading : indicatorHeading;
        requireSource(table.heading.length === expected.length && table.heading.every((label, j) => label.toUpperCase() === expected[j]));
    });
    if (data.tables.every(table => table.rows.length === 1 && table.rows[0].length === 1 &&
        table.rows[0][0].cols === table.heading.length && NO_DATA.test(table.rows[0][0].text))) {
        return { status: 'unpublished' };
    }
    const tabs = data.tables.map((table, i) => ({
        id: TAB_IDS[i], rows: i === 4 ? extractConversion(table) : table.rows.map(extractIndicator)
    }));
    // Reject a changed page here as a source failure, not as malformed cache data.
    const labels = tabs.slice(0, 4).flatMap(tab => tab.rows.map(row => row.label));
    requireSource(new Set(labels).size === labels.length);
    const conversionLabels = tabs[4].rows.map(row => row.label);
    requireSource(new Set(conversionLabels).size === conversionLabels.length);
    return { status: 'ready', tabs };
}

async function readOfficialEis(period) {
    const { year, month } = parseEisPeriod(period);
    const puppeteer = require('puppeteer');
    let browser;
    try {
        try {
            browser = await puppeteer.launch({
                headless: true,
                pipe: true,
                timeout: 15000,
                args: ['--no-proxy-server', `--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE ${HOST}, EXCLUDE ${DATATABLES_HOST}`]
            });
        } catch (error) {
            throw new SourceUnavailable('Browser untuk membaca EIS resmi tidak dapat dibuka.', { cause: error });
        }
        const page = await browser.newPage();
        page.setDefaultTimeout(15000);
        await page.setBypassServiceWorker(true);
        await page.setRequestInterception(true);
        page.on('request', request => {
            const action = allowedRequest(page, request) ? request.continue() : request.abort('blockedbyclient');
            // The browser can close while a request is still being handled.
            void action.catch(() => {});
        });
        const pageUrl = `${ORIGIN}${PAGE}`;
        let response;
        try {
            response = await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
        } catch (error) {
            throw new SourceUnavailable('Situs EIS resmi tidak dapat dihubungi.', { cause: error });
        }
        requireSource(response?.ok() && page.url() === pageUrl, 'Halaman publik EIS resmi tidak dapat diakses.');
        await page.waitForFunction(completedDraw);
        const previous = await page.evaluateHandle(() => window.jQuery('#TabelData').DataTable().settings()[0]);
        const mm = String(month).padStart(2, '0');
        const yy = String(year);
        const filters = {
            pengadilan_tinggi: '72', kategori: '-1', kelas: '-1',
            bulan_awal: mm, bulan_akhir: mm, tahun_awal: yy, tahun_akhir: yy
        };
        const choicesByName = await page.evaluate(names => Object.fromEntries(names.map(name => {
            const select = document.getElementById(name);
            return [name, select?.tagName === 'SELECT' ? [...select.options].map(option => option.value) : null];
        })), Object.keys(filters));
        requireSource(Object.values(choicesByName).every(choices => choices?.length), 'Kontrol filter EIS resmi tidak lengkap.');
        if (!choicesByName.tahun_awal.includes(yy) && !choicesByName.tahun_akhir.includes(yy)) return { status: 'unpublished' };
        for (const [name, value] of Object.entries(filters)) {
            const choices = await page.select(`#${name}`, value);
            requireSource(choices.includes(value), 'Pilihan filter yang diperlukan tidak tersedia pada halaman EIS resmi.');
        }
        await page.click('.btn-modern-search');
        await page.waitForFunction(completedDraw, {}, filters, previous);
        const court = await page.evaluate(clickCourt, COURT_NAMES);
        if (court === 'absent') return { status: 'unpublished' };
        requireSource(court === 'clicked', 'Tautan detail PN Natuna tidak dapat dikenali.');
        const result = await page.waitForFunction(modalData, { timeout: 20000, polling: 'mutation' });
        requireSource(page.url().split('#', 1)[0] === pageUrl, 'Halaman publik EIS resmi berpindah alamat.');
        return extractSnapshot(await result.jsonValue(), year, month);
    } catch (error) {
        if (error instanceof SourceUnavailable) return { status: 'unavailable', error: error.message };
        if (error instanceof puppeteer.TimeoutError || error instanceof puppeteer.TargetCloseError || error instanceof puppeteer.ProtocolError) {
            return { status: 'unavailable', error: 'Hasil EIS resmi tidak selesai dimuat.' };
        }
        throw error;
    } finally {
        if (browser) await browser.close();
    }
}

function text(value) {
    // The public reader extracts text, never markup. Whitelist fields when persisting so an
    // injected reader or a future scraper cannot accidentally retain raw response/HTML fields.
    if (typeof value !== 'string' || /<\/?[a-z][^>]*>/i.test(value)) throw new TypeError('Nilai EIS harus berupa teks.');
    return value;
}

function validateTabs(tabs) {
    if (!Array.isArray(tabs) || tabs.length !== TAB_IDS.length) throw new TypeError('Snapshot EIS harus memiliki lima tab.');
    return TAB_IDS.map(id => {
        const tab = tabs.find(item => item?.id === id);
        if (!Array.isArray(tab?.rows) || !tab.rows.length) throw new TypeError(`Tab EIS belum lengkap: ${id}`);
        const labels = new Set();
        const rows = tab.rows.map(row => {
            const label = text(row.label);
            if (!label.trim() || labels.has(label) || !Array.isArray(row.headers) || !Array.isArray(row.details) ||
                !SCORE.test(row.points)) throw new TypeError(`Indikator EIS tidak valid: ${id}`);
            labels.add(label);
            return {
                ...(row.id === undefined ? {} : { id: text(row.id) }),
                label, description: text(row.description), headers: row.headers.map(text),
                details: row.details.map(detail => {
                    if (!Array.isArray(detail.values) || detail.values.length !== row.headers.length) {
                        throw new TypeError(`Kolom detail EIS tidak cocok: ${label}`);
                    }
                    return { ...(detail.label === undefined ? {} : { label: text(detail.label) }), values: detail.values.map(text) };
                }),
                points: text(row.points)
            };
        });
        return { id, rows };
    });
}

function createOfficialEis(db, { clock = () => new Date(), reader = readOfficialEis } = {}) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS eis_official_monthly (
            period TEXT PRIMARY KEY,
            attempt_day TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'empty',
            attempted_at TEXT,
            error TEXT,
            snapshot_json TEXT
        )
    `);
    const read = db.prepare('SELECT * FROM eis_official_monthly WHERE period = ?');
    const readReady = db.prepare(`
        SELECT period, status, attempted_at, snapshot_json
        FROM eis_official_monthly
        WHERE status = 'ready' AND snapshot_json IS NOT NULL
        ORDER BY period ASC
    `);
    const claim = db.prepare(`
        INSERT INTO eis_official_monthly (period, attempt_day) VALUES (?, ?)
        ON CONFLICT(period) DO UPDATE SET attempt_day = excluded.attempt_day
        WHERE ? OR eis_official_monthly.attempt_day < excluded.attempt_day
    `);
    const finish = db.prepare(`
        UPDATE eis_official_monthly
        SET status = @status, attempted_at = @attemptedAt, error = @error,
            snapshot_json = COALESCE(@snapshot, snapshot_json)
        WHERE period = @period
    `);
    const inFlight = new Map();

    function get(period) {
        parseEisPeriod(period);
        const row = read.get(period);
        return {
            status: row?.status ?? 'empty',
            snapshot: row?.snapshot_json ? JSON.parse(row.snapshot_json) : null,
            ...(row?.attempted_at ? { attemptedAt: row.attempted_at } : {}),
            ...(row?.error ? { error: row.error } : {})
        };
    }

    async function refresh(period, { force = false } = {}) {
        parseEisPeriod(period);
        if (inFlight.has(period)) return inFlight.get(period);
        const started = new Date(clock());
        const today = currentEisDay(started);
        const attemptedAt = started.toISOString();
        if (!force && period !== today.slice(0, 7)) return get(period);
        if (!claim.run(period, today, Number(force)).changes) return get(period);
        // Claim the day before network I/O, so even a restart during I/O won't repeat the
        // automatic attempt. The prior status/snapshot remains readable until a new result.
        const work = Promise.resolve().then(async () => {
            const result = await reader(period);
            let snapshot = null;
            if (result?.status === 'ready') {
                if ((result.period !== undefined && result.period !== period) ||
                    (result.snapshot && result.snapshot.period !== period)) throw new TypeError('Periode snapshot EIS tidak cocok.');
                const tabs = validateTabs(result.snapshot?.tabs ?? result.tabs);
                snapshot = JSON.stringify({ period, fetchedAt: new Date(clock()).toISOString(), tabs });
            } else if (!['unavailable', 'unpublished'].includes(result?.status)) {
                throw new TypeError('Pembaca EIS mengembalikan status yang tidak dikenal.');
            }
            const error = result.status === 'unavailable' ? text(result.error ?? 'EIS resmi tidak tersedia.') : null;
            finish.run({ period, status: result.status, attemptedAt, error, snapshot });
            return get(period);
        });
        inFlight.set(period, work);
        try {
            return await work;
        } finally {
            inFlight.delete(period);
        }
    }

    function list() {
        return readReady.all().map(row => ({
            period: row.period,
            status: row.status,
            attemptedAt: row.attempted_at,
            snapshot: JSON.parse(row.snapshot_json)
        }));
    }

    return { get, list, refresh };
}

module.exports = { createOfficialEis };
