/**
 * Isolated-process printer for the canonical status view.
 * Used by the Local dashboard API so probes do not block Astro's event loop.
 *
 * Usage:
 *   print-canonical-status.ts
 *   print-canonical-status.ts --local
 *   print-canonical-status.ts --diagnostics
 *   print-canonical-status.ts --env=preview
 */
import {
	buildCanonicalStatusView,
	buildLocalCanonicalStatusView,
} from './canonical-status.ts';
import type { TargetEnv } from './dbs-status.ts';

const localOnly = process.argv.includes('--local');
const diagnostics = process.argv.includes('--diagnostics');
const envArg = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length);

function parseEnv(value: string | undefined): TargetEnv | undefined {
	if (value === 'local' || value === 'preview' || value === 'production') return value;
	return undefined;
}

if (localOnly) {
	process.stdout.write(JSON.stringify(buildLocalCanonicalStatusView()));
} else {
	const env = parseEnv(envArg);
	const view = await buildCanonicalStatusView({
		environments: env ? [env] : undefined,
		diagnostics,
	});
	process.stdout.write(JSON.stringify(view));
}
