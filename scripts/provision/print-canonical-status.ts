/**
 * Isolated-process printer for the canonical status view.
 * Used by the Local dashboard API so probes do not block Astro's event loop.
 *
 * Usage:
 *   print-canonical-status.ts
 *   print-canonical-status.ts --local
 *   print-canonical-status.ts --diagnostics
 *   print-canonical-status.ts --env=preview
 *   print-canonical-status.ts --skip-production-preflight
 *   print-canonical-status.ts --preflight-only
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	buildCanonicalStatusView,
	buildLocalCanonicalStatusView,
	refineCanonicalStatusViewPromotions,
} from './canonical-status.ts';
import type { TargetEnv } from './dbs-status.ts';
import type { CanonicalStatusView } from '../../src/lib/status/types.ts';

const localOnly = process.argv.includes('--local');
const diagnostics = process.argv.includes('--diagnostics');
const preflightOnly = process.argv.includes('--preflight-only');
const envArg = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length);
const domainArg = process.argv
	.find((arg) => arg.startsWith('--domain='))
	?.slice('--domain='.length);

function parseEnv(value: string | undefined): TargetEnv | undefined {
	if (value === 'local' || value === 'preview' || value === 'production') return value;
	return undefined;
}

function parseDomain(value: string | undefined): 'schema' | 'content' | 'patch' | undefined {
	if (value === 'schema' || value === 'content' || value === 'patch') return value;
	return undefined;
}

function statusCachePath(): string {
	const fromEnv = process.env.CELEBRA_STATUS_CACHE_PATH?.trim();
	if (fromEnv) return fromEnv;
	return resolve(process.cwd(), '.cache/canonical-status.json');
}

function readCachedStatusView(): CanonicalStatusView | null {
	const file = statusCachePath();
	if (!existsSync(file)) return null;
	try {
		return JSON.parse(readFileSync(file, 'utf8')) as CanonicalStatusView;
	} catch {
		return null;
	}
}

if (localOnly) {
	process.stdout.write(JSON.stringify(buildLocalCanonicalStatusView()));
} else {
	const env = parseEnv(envArg);
	const domain = parseDomain(domainArg);
	if (preflightOnly) {
		const previous = readCachedStatusView();
		const view = previous
			? await refineCanonicalStatusViewPromotions(previous)
			: await buildCanonicalStatusView({
					environments: env ? [env] : undefined,
					diagnostics,
					domain,
					includeProductionPreflight: true,
				});
		process.stdout.write(JSON.stringify(view));
	} else {
		const view = await buildCanonicalStatusView({
			environments: env ? [env] : undefined,
			diagnostics,
			domain,
			includeProductionPreflight: false,
		});
		process.stdout.write(JSON.stringify(view));
	}
}
