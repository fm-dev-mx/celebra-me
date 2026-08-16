import { domainUnverified } from '../db/schema-lifecycle-state.ts';
import type { AssetPolicy } from './asset-reconciliation.ts';
import { listInvitationDefinitions } from './invitations/registry.ts';
import type { UpdateScope } from './semantic-delta.ts';

export type InvitationUpdateTarget = 'local' | 'preview' | 'production';

function flagValue(args: string[], flag: string): string | undefined {
	const index = args.indexOf(flag);
	return index >= 0 ? args[index + 1] : undefined;
}

function isUpdateScope(value: string | undefined): value is UpdateScope {
	return value === 'content-only' || value === 'content-and-assets' || value === 'assets-only';
}

/** Parse an explicit CLI scope override. Omitted flags inherit definition deliveryScope. */
export function parseCliUpdateScope(args: string[]): UpdateScope | undefined {
	const hasContentOnly = args.includes('--content-only');
	const hasUpdateScope = args.includes('--update-scope');
	if (hasContentOnly && hasUpdateScope) {
		throw new Error('UPDATE_SCOPE_CONFLICT: Use --update-scope o --content-only, no ambos.');
	}
	if (hasContentOnly) return 'content-only';
	if (!hasUpdateScope) return undefined;
	const raw = flagValue(args, '--update-scope');
	if (isUpdateScope(raw)) return raw;
	throw new Error(
		`UPDATE_SCOPE_INVALID: "${raw ?? ''}" no es un alcance válido. Use content-only, content-and-assets o assets-only.`,
	);
}

/** Resolve the canonical managed update scope from an explicit override or definition policy. */
export function resolvePromotionUpdateScope(input: {
	updateScope?: UpdateScope;
	deliveryScope?: string;
}): UpdateScope | undefined {
	if (input.updateScope) return input.updateScope;
	if (isUpdateScope(input.deliveryScope)) return input.deliveryScope;
	return undefined;
}

export function requireResolvedUpdateScope(input: {
	updateScope?: UpdateScope;
	deliveryScope?: string;
}): UpdateScope {
	const resolved = resolvePromotionUpdateScope(input);
	if (!resolved) {
		throw new Error(
			'UPDATE_SCOPE_UNRESOLVED: No se pudo resolver el alcance. Declare deliveryScope en la definición o pase --update-scope.',
		);
	}
	return resolved;
}

/** Default asset policy for a resolved update scope. */
export function defaultAssetPolicy(scope: UpdateScope): AssetPolicy {
	return scope === 'content-only' ? 'preserve' : 'missing';
}

/** Fail at plan time when content-only would create, replace, or delete assets. */
export function assertContentOnlyAllowsNoAssetMutations(input: {
	updateScope: UpdateScope;
	plannedAssetMutations: number;
}): void {
	if (input.updateScope !== 'content-only' || input.plannedAssetMutations <= 0) return;
	throw new Error(
		'CONTENT_ONLY_ASSET_MUTATION: El alcance content-only no permite cambios de archivos. Use --update-scope content-and-assets o el deliveryScope de la definición.',
	);
}

export function parseTargets(raw: string | undefined): InvitationUpdateTarget[] {
	if (!raw) return [];
	const values =
		raw === 'all'
			? ['local', 'preview', 'production']
			: raw
					.split(/[\s,]+/)
					.map((s) => s.trim())
					.filter(Boolean);
	for (const target of values)
		if (!['local', 'preview', 'production'].includes(target))
			throw new Error(`Unknown target "${target}".`);
	if (values.includes('production')) {
		return ['local', 'preview', 'production'];
	}
	const selected = new Set(values);
	return (['local', 'preview', 'production'] as InvitationUpdateTarget[]).filter((target) =>
		selected.has(target),
	);
}

export function parseMutationTargets(raw: string | undefined): InvitationUpdateTarget[] {
	if (!raw) return [];
	if (raw === 'all') {
		throw new Error(
			'MUTATION_TARGETS_EXPLICIT_REQUIRED: --targets all is read-only only. Use --targets local,preview for invitation:release content mutations.',
		);
	}
	const targets = parseTargets(raw);
	if (targets.includes('production')) {
		throw new Error(
			'PRODUCTION_PROMOTION_REQUIRED: Use pnpm prod:apply -- --slug <slug> for owner-only Production releases. Domain dry-run remains pnpm invitation:release -- --slug <slug> --targets production --dry-run.',
		);
	}
	return targets;
}

/**
 * Mutation targets for invitation:release. Production is allowed alone and
 * dispatches through the promotion orchestrator (never mixed with Local/Preview).
 * Unlike status parseTargets(), bare `production` does not expand to all envs.
 */
export function parseReleaseMutationTargets(raw: string | undefined): InvitationUpdateTarget[] {
	if (!raw) return [];
	if (raw === 'all') {
		throw new Error(
			'MUTATION_TARGETS_EXPLICIT_REQUIRED: --targets all is read-only only. Use --targets local, preview, local,preview, or production.',
		);
	}
	const values = raw
		.split(/[\s,]+/)
		.map((s) => s.trim())
		.filter(Boolean);
	for (const target of values) {
		if (!['local', 'preview', 'production'].includes(target)) {
			throw new Error(`Unknown target "${target}".`);
		}
	}
	if (values.includes('production')) {
		if (values.length !== 1) {
			throw new Error(
				'PRODUCTION_TARGET_EXCLUSIVE: --targets production cannot be combined with local/preview. Run content stages first, then Production.',
			);
		}
		return ['production'];
	}
	return parseMutationTargets(raw);
}

export function validateUpdateOptions(input: {
	slug?: string;
	targets?: InvitationUpdateTarget[];
	rekeyFrom?: string;
	isMutation?: boolean;
	/** When true, Production mutation is allowed (orchestrator path). */
	allowProductionMutation?: boolean;
}): void {
	if (input.rekeyFrom && input.targets?.includes('production')) {
		throw new Error(
			'IDENTITY_REKEY_UNSUPPORTED_TARGET: Identity rekey (--rekey-from) is not supported for Production. Use Local or Preview only.',
		);
	}

	if (
		input.targets &&
		input.targets.includes('production') &&
		input.isMutation !== false &&
		!input.allowProductionMutation
	) {
		throw new Error(
			'PRODUCTION_PROMOTION_REQUIRED: Use pnpm prod:apply -- --slug <slug> for owner-only Production releases. Domain dry-run remains pnpm invitation:release -- --slug <slug> --targets production --dry-run.',
		);
	}
}

const VALID_FLAGS = new Set([
	'--status',
	'--targets',
	'--slug',
	'--rekey-from',
	'--source-dir',
	'--dry-run',
	'--apply',
	'--non-interactive',
	'--json',
	'--technical',
	'--owner-user-id',
	'--package',
	'--allow-stale-package',
	'--package-hash',
	'--approve',
	'--preview-provenance',
	'--diagnose-receipt',
	'--reconcile-stale',
	'--asset-policy',
	'--update-scope',
	'--content-only',
	'--prune-assets',
	'--include-legacy',
	'--include-archived',
	'--include-demos',
	'--confirm-destructive',
	'--acknowledge-discard-unpublished-draft',
	'--conflict-resolutions',
	'--field-selections',
	'--verbose',
	'--backup-manifest',
	'--interactive',
	'--no-interactive',
	'--help',
	'-h',
]);

export function checkUnknownFlags(args: string[]): void {
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg.startsWith('-')) {
			if (!VALID_FLAGS.has(arg)) {
				throw new Error(
					`Opción no reconocida: "${arg}". Use --help para ver las opciones permitidas.`,
				);
			}
			if (
				[
					'--targets',
					'--slug',
					'--rekey-from',
					'--source-dir',
					'--owner-user-id',
					'--package',
					'--package-hash',
					'--asset-policy',
					'--update-scope',
					'--conflict-resolutions',
					'--field-selections',
					'--backup-manifest',
				].includes(arg)
			) {
				i++;
			}
		} else {
			throw new Error(
				`Opción no reconocida: "${arg}". Use --help para ver las opciones permitidas.`,
			);
		}
	}
}

export interface StatusReportOptions {
	slug?: string;
	targets?: InvitationUpdateTarget[];
	includeLegacy?: boolean;
	includeArchived?: boolean;
	includeDemos?: boolean;
}

export function parseStatusOptions(input: StatusReportOptions): StatusReportOptions {
	return {
		slug: input.slug,
		targets: input.targets && input.targets.length > 0 ? input.targets : undefined,
		includeLegacy: Boolean(input.includeLegacy),
		includeArchived: Boolean(input.includeArchived),
		includeDemos: Boolean(input.includeDemos),
	};
}

export function buildStatusReport(input: StatusReportOptions): Record<string, unknown> {
	const opts = parseStatusOptions(input);
	const requestedSlug = opts.slug;
	const targets =
		opts.targets && opts.targets.length > 0 ? opts.targets : ['local', 'preview', 'production'];

	const unprobedRemote = domainUnverified(
		'inventory',
		'invitation:release --status is local inventory only. Remote environments are not probed. Use pnpm dbs for cross-environment schema/content evidence.',
	);
	const unprobedLocal = domainUnverified(
		'inventory',
		'Local inventory not yet enriched; this report builder does not probe persistent-local.',
	);

	const definitions = listInvitationDefinitions()
		.filter((definition) => !requestedSlug || definition.slug === requestedSlug)
		.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
		.map((definition) => {
			const envEntries = targets.map((target) => {
				const unverified = target === 'local' ? unprobedLocal : unprobedRemote;
				const envInfo =
					target === 'local'
						? {
								status: unverified.status,
								domain: unverified.domain,
								reason: unverified.reason,
							}
						: {
								status: unverified.status,
								domain: unverified.domain,
								probed: false,
								reason: unverified.reason,
							};
				return [target, envInfo];
			});
			return {
				slug: definition.slug,
				title: definition.title,
				createdAt: definition.createdAt,
				classification: {
					status: 'UNVERIFIED' as const,
					domain: 'inventory' as const,
					reason: 'Local inventory classification only; remote environments are not probed.',
				},
				environments: Object.fromEntries(envEntries),
			};
		});

	const legacyUnprobed = opts.includeLegacy
		? domainUnverified(
				'inventory',
				'Legacy discovery is not performed by invitation:release --status without a configured local inventory probe.',
			)
		: undefined;

	return {
		mode: 'status',
		surface: 'local_inventory',
		remoteProbe: 'not_performed',
		filters: {
			slug: requestedSlug ?? null,
			targets,
			includeLegacy: opts.includeLegacy ?? false,
			includeArchived: opts.includeArchived ?? false,
			includeDemos: opts.includeDemos ?? false,
		},
		definitions,
		legacy: legacyUnprobed
			? {
					status: legacyUnprobed.status,
					domain: legacyUnprobed.domain,
					reason: legacyUnprobed.reason,
				}
			: undefined,
	};
}
