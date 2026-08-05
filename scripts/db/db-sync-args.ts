/**
 * db-sync-args.ts — CLI argument parsing for `pnpm db:sync`.
 * Help/parse paths stay free of orchestrator / mutation imports.
 */

import {
	assertAllowedDirection,
	DB_SYNC_MODES,
	isDbSyncMode,
	type DbSyncDirection,
	type DbSyncMode,
} from './db-sync-types.ts';

export interface DbSyncCliArgs {
	help: boolean;
	mode: DbSyncMode | null;
	direction: DbSyncDirection | null;
	target: 'local' | 'preview' | 'production' | null;
	slug: string | null;
	eventType: string | null;
	packagePath: string | null;
	expectedPlan: string | null;
	backupManifest: string | null;
	apply: boolean;
	json: boolean;
	noInteractive: boolean;
	strict: boolean;
	envs: Array<'local' | 'preview' | 'production'>;
}

export function printDbSyncHelp(): void {
	process.stderr.write(`pnpm db:sync — invitation database synchronization orchestration facade

Modes:
  diagnose   Read-only availability, schema lifecycle, and readiness (default)
  compare    Read-only semantic content parity
  plan       Build an immutable sync plan (no writes)
  apply      Revalidate plan and delegate to an existing engine

Directions (hard allowlist):
  definition-to-local
  definition-to-preview
  package-to-production
  production-to-preview-mirror

Forbidden through db:sync:
  Preview→Production copy, Local→Production without promote,
  Production/Preview dump import to Local, schema migrations, RSVP/PII mirror.

Options:
  --mode <mode>
  --direction <direction>
  --target <local|preview|production>   Convenience alias for update directions
  --slug <slug>
  --event-type <type>                   Required for compare when slug set
  --package <path>                      Invitation package for update/promote
  --expected-plan <planId>              Required for headless apply
  --backup-manifest <path>              Promote backup gate
  --apply                               Mutation intent (apply mode only)
  --json                                Secret-free machine output on stdout
  --no-interactive                      Require explicit flags (non-TTY safe)
  --strict                              Non-zero exit when diagnose evidence is incomplete
  --envs local,preview,production       Diagnose/compare targets
  --help

Examples:
  pnpm db:sync
  pnpm db:sync diagnose -- --strict --json
  pnpm db:sync compare -- --slug <slug> --event-type boda --envs local,preview
  pnpm db:sync plan -- --direction definition-to-preview --slug <slug> --package <path>
  pnpm db:sync apply -- --direction production-to-preview-mirror --expected-plan <id> --apply --no-interactive

Separate systems (not db:sync):
  pnpm db:migrate
  pnpm db:preview:sync-invitations   (specialized mirror alias; still authoritative)
  pnpm invitation:update / invitation:promote
  pnpm db:local:restore-from-dump
  Dashboard Content Sync (demos)
  pnpm lane:sync
`);
}

function readOption(argv: string[], index: number, name: string): { value: string; next: number } {
	const current = argv[index]!;
	if (current.startsWith(`${name}=`)) {
		return { value: current.slice(name.length + 1), next: index };
	}
	const value = argv[index + 1];
	if (!value || value.startsWith('--')) {
		throw new Error(`Missing value for ${name}`);
	}
	return { value, next: index + 1 };
}

function directionFromTarget(target: 'local' | 'preview' | 'production'): DbSyncDirection {
	if (target === 'local') return 'definition-to-local';
	if (target === 'preview') return 'definition-to-preview';
	throw new Error(
		'FORBIDDEN_DIRECTION: --target production is not a definition update target. ' +
			'Use --direction package-to-production with invitation:promote gates.',
	);
}

// Flag matrix intentionally dense; keep parsing centralized rather than spreading across files.
// eslint-disable-next-line complexity -- CLI option parsing is a flat switch over known flags.
export function parseDbSyncArgs(argv: string[] = process.argv.slice(2)): DbSyncCliArgs {
	const args: DbSyncCliArgs = {
		help: false,
		mode: null,
		direction: null,
		target: null,
		slug: null,
		eventType: null,
		packagePath: null,
		expectedPlan: null,
		backupManifest: null,
		apply: false,
		json: false,
		noInteractive: false,
		strict: false,
		envs: ['local', 'preview', 'production'],
	};

	for (let i = 0; i < argv.length; i += 1) {
		const token = argv[i]!;
		if (token === '--') continue;
		if (token === '--help' || token === '-h') {
			args.help = true;
			continue;
		}
		if (isDbSyncMode(token) && args.mode === null && !token.startsWith('--')) {
			args.mode = token;
			continue;
		}
		if (token === '--mode' || token.startsWith('--mode=')) {
			const { value, next } = readOption(argv, i, '--mode');
			i = next;
			if (!isDbSyncMode(value)) {
				throw new Error(`Unknown mode "${value}". Allowed: ${DB_SYNC_MODES.join(', ')}`);
			}
			args.mode = value;
			continue;
		}
		if (token === '--direction' || token.startsWith('--direction=')) {
			const { value, next } = readOption(argv, i, '--direction');
			i = next;
			args.direction = assertAllowedDirection(value);
			continue;
		}
		if (token === '--target' || token.startsWith('--target=')) {
			const { value, next } = readOption(argv, i, '--target');
			i = next;
			if (value !== 'local' && value !== 'preview' && value !== 'production') {
				throw new Error(`Unknown --target "${value}"`);
			}
			args.target = value;
			continue;
		}
		if (token === '--slug' || token.startsWith('--slug=')) {
			const { value, next } = readOption(argv, i, '--slug');
			i = next;
			args.slug = value.trim();
			continue;
		}
		if (token === '--event-type' || token.startsWith('--event-type=')) {
			const { value, next } = readOption(argv, i, '--event-type');
			i = next;
			args.eventType = value.trim();
			continue;
		}
		if (token === '--package' || token.startsWith('--package=')) {
			const { value, next } = readOption(argv, i, '--package');
			i = next;
			args.packagePath = value;
			continue;
		}
		if (token === '--expected-plan' || token.startsWith('--expected-plan=')) {
			const { value, next } = readOption(argv, i, '--expected-plan');
			i = next;
			args.expectedPlan = value.trim();
			continue;
		}
		if (token === '--backup-manifest' || token.startsWith('--backup-manifest=')) {
			const { value, next } = readOption(argv, i, '--backup-manifest');
			i = next;
			args.backupManifest = value;
			continue;
		}
		if (token === '--envs' || token.startsWith('--envs=')) {
			const { value, next } = readOption(argv, i, '--envs');
			i = next;
			args.envs = value
				.split(/[\s,]+/)
				.map((part) => part.trim())
				.filter(Boolean) as Array<'local' | 'preview' | 'production'>;
			continue;
		}
		if (token === '--apply') {
			args.apply = true;
			continue;
		}
		if (token === '--json') {
			args.json = true;
			continue;
		}
		if (token === '--no-interactive') {
			args.noInteractive = true;
			continue;
		}
		if (token === '--strict') {
			args.strict = true;
			continue;
		}
		throw new Error(`Unknown argument: ${token}`);
	}

	if (args.target && !args.direction) {
		args.direction = directionFromTarget(args.target);
	}

	if (args.direction) {
		assertAllowedDirection(args.direction);
	}

	if (!args.mode && args.apply) {
		args.mode = 'apply';
	}

	return args;
}
