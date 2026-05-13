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
