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
	process.stderr.write(`db:migrate — Schema migration planning and orchestration

Public Production entry:
  pnpm db:prod:migrate                      # read-only preflight
  pnpm db:prod:migrate -- --apply           # owner TTY apply (release-check + backup)

Multi-env engine:
  pnpm db:migrate                           # TTY: select target (Cancelar default)
  pnpm db:migrate -- --target <local|preview|production|disposable-test> [options]

Aliases (preselect target only; same CLI/policy):
  pnpm db:local:migrate
  pnpm db:preview:migrate
  pnpm db:prod:migrate

Options:
  --target <target>     Migration target (TTY selector when omitted; required without TTY)
  --apply               Apply after plan validation (default: read-only preflight)
  --expected <versions> Optional exact pending-set pin (comma-separated)
  --json                Emit MigrationPlan JSON on stdout (human logs on stderr)
  --interactive         Guided TTY for non-Production targets (Cancel / Revisar / Aplicar)
  --no-interactive      Disable guided prompts
  --help, -h            Show this help (no database access)

Environment:
  Preview apply (non-TTY): CELEBRA_TASK_SCOPE=preview:schema:migrate
  Preview release identity: clean Git HEAD (derived automatically; no manual SHA export)
  Production apply: release-check evidence + interactive owner TTY (no token path)

Default mode is read-only planning. Production apply: backup → one revalidation →
owner menu → bound code → write. After a failed apply, re-run preflight.
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
