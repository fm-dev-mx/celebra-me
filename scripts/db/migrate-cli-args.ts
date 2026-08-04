/**
 * Pure CLI argument parsing and help for schema migrate.
 * Must not import orchestrator, policies, executors, or other mutation code.
 */

import type { MigrateMode, MigrateTarget } from './migration-plan.ts';

export interface MigrateCliArgs {
	help: boolean;
	json: boolean;
	target: MigrateTarget | null;
	mode: MigrateMode;
	/** Raw argv retained for shared --expected parser (loaded only on execute). */
	argv: string[];
	interactiveForced: boolean | null;
}

const TARGETS = new Set<string>(['local', 'preview', 'production', 'disposable-test']);

export function printMigrateHelp(): void {
	process.stderr.write(`db:migrate — Unified schema migration planning and orchestration

Usage:
  pnpm db:migrate -- --target <local|preview|production|disposable-test> [options]
  pnpm db:local:migrate | db:preview:migrate | db:prod:migrate   (compatibility wrappers)

Options:
  --target <target>     Migration target (required for canonical entrypoint)
  --apply               Apply after plan validation (default: read-only preflight)
  --expected <versions> Optional exact pending-set pin (comma-separated)
  --json                Emit MigrationPlan JSON on stdout (human logs on stderr)
  --interactive         Force guided TTY actions (Run / Review / Cancel)
  --no-interactive      Disable guided prompts
  --help, -h            Show this help (no database access)

Environment:
  Preview apply (non-TTY): CELEBRA_TASK_SCOPE=preview:schema:migrate
  Preview release identity: CELEBRA_TARGET_RELEASE_SHA (required for hosted Preview)
  Production apply: pnpm release-check evidence + interactive owner TTY (no token path)

Deprecated (Preview shim only):
  --allowlist <versions>   Alias of --expected (warns)
  EXPECTED_MIGRATIONS      Alias of --expected (warns)

Default mode is read-only planning. Apply rebuilds evidence and rejects plan drift
before authorization or the first write. After a failed apply, re-run preflight.
`);
}

export function parseMigrateCliArgs(argv: string[]): MigrateCliArgs {
	const args = argv.slice(2);
	if (args.includes('--help') || args.includes('-h')) {
		return {
			help: true,
			json: false,
			target: null,
			mode: 'preflight',
			argv: args,
			interactiveForced: null,
		};
	}

	const json = args.includes('--json');
	const apply = args.includes('--apply');
	if (apply && args.includes('--dry-run')) {
		throw new Error(
			'Cannot combine --apply with --dry-run. Omit --dry-run; default is read-only preflight.',
		);
	}

	const targetIdx = args.indexOf('--target');
	let target: MigrateTarget | null = null;
	if (targetIdx !== -1) {
		const value = args[targetIdx + 1];
		if (!value || !TARGETS.has(value)) {
			throw new Error(
				`Invalid or missing --target. Expected local|preview|production|disposable-test.`,
			);
		}
		target = value as MigrateTarget;
	}

	let interactiveForced: boolean | null = null;
	if (args.includes('--interactive')) interactiveForced = true;
	if (args.includes('--no-interactive')) interactiveForced = false;

	return {
		help: false,
		json,
		target,
		mode: apply ? 'apply' : 'preflight',
		argv: args,
		interactiveForced,
	};
}
