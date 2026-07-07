/**
 * ci:diagnose — run all CI stages independently and report summary.
 *
 * Unlike `pnpm run ci` (which stops at the first failure via `&&`),
 * this script runs every stage regardless of previous results so you
 * can see the complete health picture in one pass.
 *
 * Usage:
 *   pnpm run ci:diagnose
 *   pnpm run ci:diagnose -- --skip-gate     # skip expensive stages for quick iteration
 */
import { execSync } from 'node:child_process';

const STAGES = [
  { name: 'type-check', cmd: 'pnpm type-check' },
  { name: 'lint', cmd: 'pnpm lint' },
  { name: 'lint:styles', cmd: 'pnpm lint:styles:changed' },
  { name: 'validate:ui-governance', cmd: 'pnpm validate:ui-governance' },
  { name: 'validate:event-parity', cmd: 'pnpm validate:event-parity' },
  { name: 'validate:no-pii', cmd: 'pnpm validate:no-pii' },
  { name: 'unit tests', cmd: 'pnpm test' },
  { name: 'e2e:ci (DB-free)', cmd: 'pnpm test:e2e:ci' },
];

const skipGates = process.argv.includes('--skip-gate');

/** @type {Array<{name: string, passed: boolean, duration: number}>} */
const results = [];

for (const stage of STAGES) {
  // Gate C — skip expensive stages in quick mode
  if (skipGates && (stage.name === 'unit tests' || stage.name === 'e2e tests')) {
    console.log(`⏭  ${stage.name} — skipped (--skip-gate)`);
    continue;
  }

  const start = performance.now();
  try {
    execSync(stage.cmd, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 300_000,
    });
    const elapsed = Math.round((performance.now() - start) / 100) / 10;
    results.push({ name: stage.name, passed: true, duration: elapsed });
    console.log(`✅ ${stage.name} — ${elapsed}s`);
  } catch (err) {
    const elapsed = Math.round((performance.now() - start) / 100) / 10;
    const error = /** @type {{ stdout?: string; stderr?: string; status?: number }} */ (err);
    results.push({ name: stage.name, passed: false, duration: elapsed });
    console.log(`❌ ${stage.name} — ${elapsed}s (exit ${error.status ?? '?'})`);
  }
}

console.log('\n═══════════════════════════════════════');
console.log('           CI DIAGNOSE REPORT');
console.log('═══════════════════════════════════════\n');

const passed = results.filter((r) => r.passed);
const failed = results.filter((r) => !r.passed);

console.log(`Passed: ${passed.length} / ${results.length}`);
if (failed.length > 0) {
  console.log(`Failed: ${failed.length}`);
  for (const f of failed) {
    console.log(`\n  ❌ ${f.name} (${f.duration}s)`);
  }
}

console.log(`\nTotal time: ${results.reduce((s, r) => s + r.duration, 0).toFixed(1)}s`);
process.exit(failed.length > 0 ? 1 : 0);
