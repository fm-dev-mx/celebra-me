/**
 * Pure CLI argument parsing for invitation:promote (no mutation imports).
 */
import type { UpdateScope } from './semantic-delta.ts';

export type InvitationPromoteMode = 'guided' | 'preflight' | 'apply';

export interface InvitationPromoteCliArgs {
	help: boolean;
	mode: InvitationPromoteMode;
	slug?: string;
	sourceDir?: string;
	packagePath?: string;
	ownerUserId?: string;
	backupManifestPath?: string;
	updateScope?: UpdateScope;
	conflictResolutionsPath?: string;
	assetPolicyRaw?: string;
	pruneAssets: boolean;
	allowStalePackage: boolean;
	json: boolean;
	verbose: boolean;
	interactiveForced: boolean | null;
}

function value(args: string[], flag: string): string | undefined {
	const index = args.indexOf(flag);
	return index >= 0 ? args[index + 1] : undefined;
}

export function printInvitationPromoteHelp(): void {
	process.stdout.write(`
pnpm invitation:promote — Owner-only Production managed-content promotion
=======================================================================

Promotes an exact Preview-approved release to Production using the managed
import/publication engine. Never runs schema migrations.

Usage:
  pnpm invitation:promote
  pnpm invitation:promote -- --slug <slug> [--package <path>|--source-dir <path>] [--dry-run]
  pnpm invitation:promote -- --slug <slug> [--package <path>] --apply

Modes:
  (TTY, no args)          Interactive discovery + guided owner apply
  (default) / --dry-run   Read-only preflight (approval, schema, backup, Production divergence)
  --apply                 Owner-confirmed Production mutation + mandatory post-verification
  --help                  Show this help

Release identity:
  --slug <slug>           Managed invitation identity (required outside guided TTY)
  --package <path>        Immutable approved package JSON
  --source-dir <path>     Rebuild from managed definition (must match approval hashes)

Owner apply gates (guided path prepares these automatically):
  --backup-manifest <path>  Optional explicit critical backup manifest
  pnpm release-check        Valid evidence for the current clean HEAD (auto-run when missing)
  Interactive TTY           Exact typed confirmation immediately before the first write

Optional:
  --owner-user-id <uuid>  Owner assertion for new Production invitations
  --asset-policy <name>   Asset reconciliation policy
  --prune-assets          Allow planned definition-owned asset deletes
  --update-scope <scope>  content-only | content-and-assets | assets-only
  --conflict-resolutions <file.json>
  --json                  Machine-readable output (stdout); human logs remain on stderr
  --verbose               Include full hashes and plan IDs in human output
  --allow-stale-package   Intentional historical package (still must match approval)
  --interactive / --no-interactive

Approvals SSOT is the shared Preview DB store (pnpm invitation:approvals:migrate for one-time import).

Agent boundaries:
  Agents may run dry-run/preflight with Production read credentials.
  Agents must NOT execute --apply. Owner-only confirmation is mandatory.
  Schema incompatibility → OWNER_ACTION_REQUIRED via pnpm db:prod:migrate (separate workflow).
`);
}

export function parseInvitationPromoteCliArgs(
	argv: string[] = process.argv.slice(2),
): InvitationPromoteCliArgs {
	const args = [...argv];
	const help = args.includes('--help') || args.includes('-h');
	const apply = args.includes('--apply');
	const dryRunFlag = args.includes('--dry-run');
	if (apply && dryRunFlag) {
		throw new Error('Cannot combine --apply with --dry-run.');
	}

	const slug = value(args, '--slug');
	const hasExplicitMode = apply || dryRunFlag || Boolean(slug);
	const interactiveForced = args.includes('--interactive')
		? true
		: args.includes('--no-interactive')
			? false
			: null;

	let mode: InvitationPromoteMode;
	if (apply) mode = 'apply';
	else if (hasExplicitMode) mode = 'preflight';
	else mode = 'guided';

	if (args.includes('--approvals-dir')) {
		throw new Error(
			'--approvals-dir was removed. Approvals SSOT is the shared Preview DB store; import legacy files with pnpm invitation:approvals:migrate -- --apply.',
		);
	}

	const updateScope = value(args, '--update-scope') as UpdateScope | undefined;
	if (
		updateScope &&
		updateScope !== 'content-only' &&
		updateScope !== 'content-and-assets' &&
		updateScope !== 'assets-only'
	) {
		throw new Error('--update-scope must be content-only, content-and-assets, or assets-only.');
	}

	return {
		help,
		mode,
		slug,
		sourceDir: value(args, '--source-dir'),
		packagePath: value(args, '--package'),
		ownerUserId: value(args, '--owner-user-id'),
		backupManifestPath: value(args, '--backup-manifest'),
		updateScope,
		conflictResolutionsPath: value(args, '--conflict-resolutions'),
		assetPolicyRaw: value(args, '--asset-policy'),
		pruneAssets: args.includes('--prune-assets'),
		allowStalePackage: args.includes('--allow-stale-package'),
		json: args.includes('--json'),
		verbose: args.includes('--verbose'),
		interactiveForced,
	};
}
