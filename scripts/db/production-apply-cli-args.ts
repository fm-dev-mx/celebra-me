/**
 * Pure CLI argument parsing for pnpm prod:apply.
 * Must not import orchestrator, credentials, or mutation code.
 */

import { normalizeOperatorArgv } from '../lib/operator-argv.ts';
import { parseExpectedConstraint } from './migrate-expected.ts';

const KNOWN_FLAGS = new Set([
	'--schema',
	'--slug',
	'--slugs',
	'--all-ready',
	'--patch',
	'--image-namespace',
	'--image-namespace-rollback',
	'--expected',
	'--apply',
	'--json',
	'--help',
	'-h',
	'--owner-user-id',
]);

const AUTHORIZATION_BYPASS_FLAGS = new Set([
	'--already-authorized',
	'--authorized',
	'--permit',
	'--token',
	'--approval-token',
	'--binding',
	'--binding-hex',
]);

export interface ProductionApplyCliArgs {
	help: boolean;
	json: boolean;
	apply: boolean;
	schema: boolean;
	slugs: string[];
	allReady: boolean;
	patchFile?: string;
	imageManifestPath?: string;
	imageRollback?: boolean;
	ownerUserId?: string;
	inspectAll: boolean;
	expectedPin: string[] | null;
}

export function printProductionApplyHelp(): void {
	process.stderr.write(`prod:apply — Owner-only Production plan and apply

Canonical owner entry for Production mutation. Default is read-only planning.
Absence of scope never means apply everything.

  pnpm prod:apply
  pnpm prod:apply -- --schema
  pnpm prod:apply -- --slug <slug>
  pnpm prod:apply -- --slugs <slug,slug>
  pnpm prod:apply -- --all-ready
  pnpm prod:apply -- --patch <file.sql>
  pnpm prod:apply -- --image-namespace <manifest.json>
  pnpm prod:apply -- --image-namespace-rollback <manifest.json>
  pnpm prod:apply -- --schema --slugs a,b --apply
  pnpm prod:apply -- --schema --expected <versions> --apply
  pnpm prod:apply -- --all-ready --apply

Options:
  --schema              Include canonical pending schema migrations
  --slug <slug>         Include one invitation (repeatable)
  --slugs <a,b>         Include an explicit invitation set (order preserved)
  --all-ready           Include READY schema + READY invitations only
  --patch <file>        Explicit specialized DML (never implied by --all-ready)
  --image-namespace <file>          Reviewed invitation image migration manifest
  --image-namespace-rollback <file> Reviewed image migration rollback
  --expected <versions> Optional exact pending-set pin (requires --schema)
  --apply               Mutate Production after one owner TTY confirmation
  --owner-user-id <id>  Only when the patch SQL reads app.owner_user_id
  --json                Emit the secret-free plan on stdout
  --help, -h            Show this help (no database access)

--all-ready excludes draft repair, one-off resets, historical patches, and
UNKNOWN/BLOCKED items. --apply reuses valid release-check evidence for the current
HEAD or runs pnpm release-check once. Agents must stop after the read-only plan.
`);
}

function flagValue(args: readonly string[], flag: string): string | undefined {
	const index = args.indexOf(flag);
	if (index === -1) return undefined;
	const value = args[index + 1];
	if (!value || value.startsWith('--')) return undefined;
	return value;
}

function collectRepeatable(args: readonly string[], flag: string): string[] {
	const values: string[] = [];
	for (let i = 0; i < args.length; i += 1) {
		if (args[i] !== flag) continue;
		const value = args[i + 1];
		if (!value || value.startsWith('--')) {
			throw new Error(`${flag} requires a value.`);
		}
		values.push(value);
		i += 1;
	}
	return values;
}

function uniquePreserveOrder(values: readonly string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const value of values) {
		const slug = value.trim();
		if (!slug || seen.has(slug)) continue;
		seen.add(slug);
		out.push(slug);
	}
	return out;
}

function assertKnownCliFlags(args: readonly string[]): void {
	for (const token of args) {
		if (!token.startsWith('--') && !token.startsWith('-')) continue;
		if (AUTHORIZATION_BYPASS_FLAGS.has(token)) {
			throw new Error(
				`Authorization cannot be supplied from CLI (${token}). Owner TTY confirmation is the only Production apply gate.`,
			);
		}
		if (token.startsWith('--') && !KNOWN_FLAGS.has(token)) {
			throw new Error(`Unknown flag: ${token}`);
		}
	}
}

function parseSlugArgs(args: readonly string[]): string[] {
	const slugsFromList = (flagValue(args, '--slugs') ?? '')
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);
	return uniquePreserveOrder([...slugsFromList, ...collectRepeatable(args, '--slug')]);
}

function isInspectAllScope(input: {
	schema: boolean;
	slugs: readonly string[];
	allReady: boolean;
	patchFile?: string;
	imageManifestPath?: string;
}): boolean {
	return (
		!input.schema &&
		input.slugs.length === 0 &&
		!input.allReady &&
		!input.patchFile &&
		!input.imageManifestPath
	);
}

function assertCliCombinations(input: {
	allReady: boolean;
	schema: boolean;
	slugs: readonly string[];
	patchFile?: string;
	imageManifestPath?: string;
	apply: boolean;
	inspectAll: boolean;
	expectedPin: string[] | null;
}): void {
	if (input.allReady && (input.slugs.length > 0 || input.patchFile)) {
		throw new Error(
			'Cannot combine --all-ready with --slug, --slugs, or --patch. --all-ready includes only READY schema and invitations.',
		);
	}
	if (
		input.imageManifestPath &&
		(input.schema ||
			input.allReady ||
			input.slugs.length > 0 ||
			input.patchFile ||
			input.expectedPin)
	) {
		throw new Error('Image namespace migration must be the only Production apply scope.');
	}
	if (input.expectedPin && !input.schema && !input.allReady) {
		throw new Error('--expected requires --schema or --all-ready.');
	}
	if (input.apply && input.inspectAll) {
		throw new Error(
			'SCOPE_REQUIRED: --apply requires an explicit scope (--schema, --slug/--slugs, --all-ready, or --patch). No arguments never apply.',
		);
	}
}

export function parseProductionApplyCliArgs(argv: string[]): ProductionApplyCliArgs {
	const args = normalizeOperatorArgv(argv.slice(2));
	if (args.includes('--help') || args.includes('-h')) {
		return {
			help: true,
			json: false,
			apply: false,
			schema: false,
			slugs: [],
			allReady: false,
			imageRollback: false,
			inspectAll: true,
			expectedPin: null,
		};
	}

	assertKnownCliFlags(args);
	const schema = args.includes('--schema');
	const allReady = args.includes('--all-ready');
	const apply = args.includes('--apply');
	const json = args.includes('--json');
	const patchFile = flagValue(args, '--patch');
	const imageManifestPath =
		flagValue(args, '--image-namespace') ?? flagValue(args, '--image-namespace-rollback');
	const imageRollback = args.includes('--image-namespace-rollback');
	if (args.includes('--image-namespace') && imageRollback)
		throw new Error('Choose migration or rollback, not both.');
	if ((args.includes('--image-namespace') || imageRollback) && !imageManifestPath)
		throw new Error('Image namespace scope requires a manifest path.');
	const ownerUserId = flagValue(args, '--owner-user-id');
	const slugs = parseSlugArgs(args);
	const inspectAll = isInspectAllScope({ schema, slugs, allReady, patchFile, imageManifestPath });
	const expectedPin = parseExpectedConstraint(args).expectedPin;
	assertCliCombinations({
		allReady,
		schema,
		slugs,
		patchFile,
		imageManifestPath,
		apply,
		inspectAll,
		expectedPin,
	});

	return {
		help: false,
		json,
		apply,
		schema: schema || allReady,
		slugs,
		allReady,
		patchFile,
		imageManifestPath,
		imageRollback,
		ownerUserId,
		inspectAll,
		expectedPin,
	};
}
