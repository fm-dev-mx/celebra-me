/**
 * CLI entry for building an observability snapshot/summary in an isolated process.
 * Used by the Local dashboard API so sync probes do not block Astro's event loop.
 *
 * Usage:
 *   print-snapshot.ts              → full multi-env detail snapshot
 *   print-snapshot.ts --mode=summary → Local-scoped summary payload
 *   print-snapshot.ts --mode=detail  → full multi-env detail snapshot
 */

import { buildObservabilitySnapshot, buildObservabilitySummary } from './snapshot.ts';

const modeArg = process.argv.find((arg) => arg.startsWith('--mode='));
const mode = modeArg?.slice('--mode='.length) ?? 'detail';

if (mode === 'summary') {
	const summary = await buildObservabilitySummary();
	process.stdout.write(JSON.stringify(summary));
} else if (mode === 'detail') {
	const snapshot = await buildObservabilitySnapshot({ probeScope: 'all' });
	process.stdout.write(JSON.stringify(snapshot));
} else {
	console.error(`Unsupported mode "${mode}". Use summary or detail.`);
	process.exit(2);
}
