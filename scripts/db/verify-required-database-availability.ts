/** Fail-closed, read-only availability preflight for database-dependent operator tasks. */
import { classifyDbTarget } from './db-guard.ts';
import { runPsql } from './db-workflow-lib.ts';
import { resolveDbUrlForEnv, type TargetEnv } from '../provision/dbs-status.ts';

const ALL_TARGETS: readonly TargetEnv[] = ['local', 'preview', 'production'];
const EXPECTED_CLASSIFICATION: Record<TargetEnv, string> = {
	local: 'persistent-local',
	preview: 'preview',
	production: 'production',
};

export type DatabaseAvailabilityReason =
	'CREDENTIALS_REQUIRED' | 'IDENTITY_CONFLICT' | 'UNREACHABLE' | 'READ_ONLY_ENFORCEMENT_FAILED';

export interface DatabaseAvailabilityResult {
	environment: TargetEnv;
	available: boolean;
	reasonCode?: DatabaseAvailabilityReason;
}

interface AvailabilityDependencies {
	resolveUrl: (environment: TargetEnv) => string | null;
	classify: (dbUrl: string) => string;
	probe: (dbUrl: string, timeoutMs: number) => { status: number | null; stdout: string };
}

const defaultDependencies: AvailabilityDependencies = {
	resolveUrl(environment) {
		return resolveDbUrlForEnv(environment).dbUrl;
	},
	classify(dbUrl) {
		return classifyDbTarget(dbUrl).target;
	},
	probe(dbUrl, timeoutMs) {
		return runPsql(
			`begin read only;
select current_setting('transaction_read_only');
rollback;`,
			dbUrl,
			{
				tuplesOnly: true,
				throwOnError: false,
				timeoutMs,
				env: { ...process.env, PGOPTIONS: '-c default_transaction_read_only=on' },
			},
		);
	},
};

export function verifyRequiredDatabaseAvailability(
	targets: readonly TargetEnv[],
	options: { timeoutMs?: number; dependencies?: AvailabilityDependencies } = {},
): DatabaseAvailabilityResult[] {
	const timeoutMs = options.timeoutMs ?? 5_000;
	const dependencies = options.dependencies ?? defaultDependencies;
	return targets.map((environment) => {
		const dbUrl = dependencies.resolveUrl(environment);
		if (!dbUrl) return { environment, available: false, reasonCode: 'CREDENTIALS_REQUIRED' };
		if (dependencies.classify(dbUrl) !== EXPECTED_CLASSIFICATION[environment]) {
			return { environment, available: false, reasonCode: 'IDENTITY_CONFLICT' };
		}
		const result = dependencies.probe(dbUrl, timeoutMs);
		if (result.status !== 0) {
			return { environment, available: false, reasonCode: 'UNREACHABLE' };
		}
		if (!result.stdout.split(/\r?\n/).some((line) => line.trim() === 'on')) {
			return {
				environment,
				available: false,
				reasonCode: 'READ_ONLY_ENFORCEMENT_FAILED',
			};
		}
		return { environment, available: true };
	});
}

export function parseTargets(argv: readonly string[]): TargetEnv[] {
	const targetIndex = argv.indexOf('--targets');
	const raw = targetIndex >= 0 ? argv[targetIndex + 1] : undefined;
	if (!raw) return [...ALL_TARGETS];
	const targets = [...new Set(raw.split(/[,\s]+/).map((item) => item.trim()))].filter(Boolean);
	if (
		targets.length === 0 ||
		targets.some((target) => !ALL_TARGETS.includes(target as TargetEnv))
	) {
		throw new Error('Use --targets local,preview,production with one or more known targets.');
	}
	return targets as TargetEnv[];
}

export function main(argv: readonly string[] = process.argv.slice(2)): void {
	const targets = parseTargets(argv);
	const results = verifyRequiredDatabaseAvailability(targets);
	for (const result of results) {
		console.info(
			result.available
				? `PASS ${result.environment}: AVAILABLE_READ_ONLY`
				: `FAIL ${result.environment}: ${result.reasonCode}`,
		);
	}
	if (results.some((result) => !result.available)) {
		console.error(
			'Database-dependent task preflight failed. Stop dependent work; do not infer zero, no-change, or integrity from unavailable evidence.',
		);
		process.exitCode = 1;
	}
}

if (process.argv[1]?.endsWith('verify-required-database-availability.ts')) {
	try {
		main();
	} catch (error) {
		console.error(error instanceof Error ? error.message : 'Invalid availability preflight.');
		process.exitCode = 1;
	}
}
