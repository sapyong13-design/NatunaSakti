import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const checks = [
  {
    file: 'src/components/dashboard/PerkaraTable.vue',
    name: 'dashboard table accepts density prop',
    test: (source) => /density:\s*\{\s*type:\s*String/.test(source),
  },
  {
    file: 'src/components/dashboard/PerkaraTable.vue',
    name: 'dashboard table no longer forces horizontal min-width',
    test: (source) => !/min-width:\s*900px/.test(source),
  },
  {
    file: 'src/components/dashboard/PerkaraTable.vue',
    name: 'dashboard table keeps duration bar without SLA status labels',
    test: (source) => /ns-lama-bar/.test(source) && !/getLamaLabel/.test(source) && !/ns-lama-status/.test(source),
  },
  {
    file: 'src/views/DataView.vue',
    name: 'dashboard passes density into table',
    test: (source) => /:density="density"/.test(source),
  },
  {
    file: 'src/views/DataView.vue',
    name: 'dashboard renders active filter summary',
    test: (source) => /activeFilterSummary/.test(source) && /ns-filter-summary/.test(source),
  },
  {
    file: 'src/views/DataView.vue',
    name: 'dashboard renders attention strip',
    test: (source) => /attentionStats/.test(source) && /ns-attention-strip/.test(source),
  },
  {
    file: 'src/components/dashboard/QuickStatsCards.vue',
    name: 'quick stats use hierarchy classes',
    test: (source) => /ns-quick-stat-card-main/.test(source) && /ns-quick-stat-card-secondary/.test(source),
  },
  {
    file: 'src/components/dashboard/TrendCard.vue',
    name: 'trend card renders persistent legend',
    test: (source) => /ns-trend-legend/.test(source) && /Pidana/.test(source) && /Perdata/.test(source) && /Perikanan/.test(source),
  },
  {
    file: 'src/components/dashboard/TrendChart.vue',
    name: 'trend chart supports keyboard and aria labels',
    test: (source) => /tabindex="0"/.test(source) && /aria-label/.test(source) && /@keydown\.enter/.test(source),
  },
  {
    file: 'src/views/DataView.vue',
    name: 'filter summary renders removable chips',
    test: (source) => /activeFilterChips/.test(source) && /removeFilterChip/.test(source) && /ns-filter-chip-list/.test(source),
  },
  {
    file: 'src/views/DataView.vue',
    name: 'loading and empty states expose sync action',
    test: (source) => /ns-table-skeleton-panel/.test(source) && /Sync dari SIPP/.test(source),
  },
  {
    file: 'src/views/DataView.vue',
    name: 'empty sync action triggers real SIPP sync',
    test: (source) => /syncClusterRef/.test(source) && /triggerSippSync/.test(source) && /syncClusterRef\.value\?\.sync\(\)/.test(source),
  },
  {
    file: 'src/components/dashboard/SyncCluster.vue',
    name: 'sync cluster exposes sync and shows explicit progress',
    test: (source) =>
      /defineExpose\(\{\s*sync: handleSync\s*\}\)/s.test(source) &&
      /ns-sync-progress-bar/.test(source) &&
      /progress\.message/.test(source),
  },
  {
    file: 'src/components/base/EmptyState.vue',
    name: 'empty state supports primary action classes',
    test: (source) => /:class="action\.class"/.test(source) && /ns-empty-action\.primary/.test(source),
  },
  {
    file: 'src/views/DataView.vue',
    name: 'decorative grain overlay removed from dashboard',
    test: (source) => !/ns-grain-overlay/.test(source),
  },
  {
    file: 'src/components/dashboard/ToolbarFilters.vue',
    name: 'toolbar filters include labels and accessible dropdowns',
    test: (source) => /aria-label="Cari perkara"/.test(source) && /@keydown\.escape/.test(source) && /role="listbox"/.test(source),
  },
  {
    file: 'src/views/DataView.vue',
    name: 'view toggle icon buttons are labelled',
    test: (source) => /aria-label="Tampilkan tabel"/.test(source) && /aria-label="Tampilkan kanban"/.test(source),
  },
  {
    file: 'src/assets/styles/design-responsive.css',
    name: 'mobile drawer keeps full navigation labels visible',
    test: (source) => /\.ns-sidebar\.is-mobile-open\s+\.ns-brand-text/.test(source) && /\.ns-sidebar\.is-mobile-open\s+\.ns-nav-label/.test(source),
  },
  {
    file: 'src/assets/styles/design-tokens.css',
    name: 'global overlay z-index tokens are defined',
    test: (source) => /--z-sidebar:/.test(source) && /--z-dropdown:/.test(source) && /--z-toast:/.test(source) && /--z-modal:/.test(source),
  },
  {
    file: 'src/components/feedback/Toast.vue',
    name: 'toast clamps to mobile viewport width',
    test: (source) => /max-width:\s*min\(480px,\s*calc\(100vw - 24px\)\)/.test(source),
  },
  {
    file: 'src/components/dashboard/ToolbarFilters.vue',
    name: 'teleported filter menus clamp to viewport edge',
    test: (source) => /const menuWidth = 260/.test(source) && /Math\.max\(gutter,\s*Math\.min/.test(source),
  },
  {
    file: 'src/components/shell/TopBar.vue',
    name: 'topbar text can shrink without overlapping actions',
    test: (source) => /\.ns-c-org\s*\{[^}]*min-width:\s*0/s.test(source) && /overflow:\s*hidden/.test(source),
  },
  {
    file: 'src/components/dashboard/PerkaraTable.vue',
    name: 'jenis perkara badges stay on one line',
    test: (source) => /\.ns-jenis-badge\s*\{[^}]*white-space:\s*nowrap/s.test(source) && /\.ns-col-jenis\s*\{[^}]*width:\s*96px/s.test(source),
  },
  {
    file: 'src/components/report/BulananFilterBar.vue',
    name: 'monthly report toolbar has responsive action group with history',
    test: (source) => /'history'/.test(source) && /class="ns-report-toolbar-actions"/.test(source) && /@click="emit\('history'\)"/.test(source),
  },
  {
    file: 'src/components/report/MingguanFilterBar.vue',
    name: 'weekly report toolbar has responsive action group with history',
    test: (source) => /'history'/.test(source) && /class="ns-report-toolbar-actions"/.test(source) && /@click="emit\('history'\)"/.test(source),
  },
  {
    file: 'src/components/report/ReportTable.vue',
    name: 'report table uses scroll container, sticky solid header, and clamped long text',
    test: (source) =>
      /overflow-x:\s*auto/.test(source) &&
      /min-width:\s*980px/.test(source) &&
      /position:\s*sticky/.test(source) &&
      /-webkit-line-clamp:\s*2/.test(source) &&
      /title="pihakUtama/.test(source),
  },
  {
    file: 'src/components/report/ReportHistoryModal.vue',
    name: 'report history modal scrolls internally and truncates long filenames',
    test: (source) =>
      /max-height:\s*min\(680px,\s*calc\(100vh - 24px\)\)/.test(source) &&
      /overflow:\s*auto/.test(source) &&
      /text-overflow:\s*ellipsis/.test(source) &&
      /:title="item\.filename"/.test(source),
  },
  {
    file: 'src/views/BulananView.vue',
    name: 'monthly report error stacks on mobile and history action lives in toolbar',
    test: (source) => !/ns-report-actions/.test(source) && /@history="openHistory"/.test(source) && /@media \(max-width:\s*560px\)/.test(source),
  },
  {
    file: 'src/views/MingguanView.vue',
    name: 'weekly report error stacks on mobile and history action lives in toolbar',
    test: (source) => !/ns-report-actions/.test(source) && /@history="openHistory"/.test(source) && /@media \(max-width:\s*560px\)/.test(source),
  },
];

const failures = [];

for (const check of checks) {
  const source = read(check.file);
  if (!check.test(source)) {
    failures.push(`${check.file} - ${check.name}`);
  }
}

if (failures.length) {
  console.error('Dashboard polish checks failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dashboard polish checks passed (${checks.length}/${checks.length})`);
