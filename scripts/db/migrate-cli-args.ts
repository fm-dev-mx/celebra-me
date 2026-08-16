/**
 * Pure CLI argument parsing and help for schema migrate.
 * Must not import orchestrator, policies, executors, or other mutation code.
 */

import { normalizeOperatorArgv } from '../lib/operator-argv.ts';
import type { MigrateMode, MigrateTarget } from './migration-plan.ts';

export interface MigrateCliArgs {
	help: boolean;
	json: boolean;
	target: MigrateTarget | null;
	mode: MigrateMode;
	/** Disposable-only cutoff (internal/automation; not a human lifecycle flag). */
	maxVersion: string | null;
	/** Raw argv retained for shared --expected parser (loaded only on execute). */
	argv: string[];
	interactiveForced: boolean | null;
}

const TARGETS = new Set<string>(['local', 'preview', 'production', 'disposable-test']);

export function printMigrateHelp(): void {
	process.stderr.write(`db:migrate — Schema migration planning and orchestration

Canonical entry:
  pnpm db:migrate                           # TTY: select target (Cancelar default)
  pnpm db:migrate -- --target <local|preview|production|disposable-test> [options]
  pnpm db:migrate -- --target production    # Production read-only preflight
  pnpm db:migrate -- --target production --apply
    # redirects to pnpm prod:apply -- --schema --apply

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
  Production apply: use pnpm prod:apply -- --schema --apply (owner TTY; no token path)

Default mode is read-only planning. Production --apply delegates to prod:apply.
After a failed apply, re-run preflight.
`);
}

export function parseMigrateCliArgs(argv: string[]): MigrateCliArgs {
	const args = normalizeOperatorArgv(argv.slice(2));
	if (args.includes('--help') || args.includes('-h')) {
		return {
			help: true,
			json: false,
			target: null,
			mode: 'preflight',
			maxVersion: null,
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

	const maxVersionIdx = args.indexOf('--max-version');
	let maxVersion: string | null = null;
	if (maxVersionIdx !== -1) {
		const value = args[maxVersionIdx + 1];
		if (!value || !/^\d{14}$/.test(value)) {
			throw new Error('--max-version requires a 14-digit migration timestamp.');
		}
		if (target && target !== 'disposable-test') {
			throw new Error('--max-version is only valid with --target disposable-test.');
		}
		maxVersion = value;
	}

	let interactiveForced: boolean | null = null;
	if (args.includes('--interactive')) interactiveForced = true;
	if (args.includes('--no-interactive')) interactiveForced = false;

	return {
		help: false,
		json,
		target,
		mode: apply ? 'apply' : 'preflight',
		maxVersion,
		argv: args,
		interactiveForced,
	};
}
