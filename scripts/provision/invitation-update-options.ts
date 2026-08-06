import { domainUnverified } from '../db/schema-lifecycle-state.ts';
import { listInvitationDefinitions } from './invitations/registry.ts';

export type InvitationUpdateTarget = 'local' | 'preview' | 'production';

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
			'MUTATION_TARGETS_EXPLICIT_REQUIRED: --targets all is read-only only. Use --targets local,preview for invitation:update mutations.',
		);
	}
	const targets = parseTargets(raw);
	if (targets.includes('production')) {
		throw new Error(
			'PRODUCTION_PROMOTION_REQUIRED: Direct Production mutation via invitation:update is prohibited. Use pnpm invitation:promote for owner-only Production releases.',
		);
	}
	return targets;
}

export function validateUpdateOptions(input: {
	slug?: string;
	targets?: InvitationUpdateTarget[];
	rekeyFrom?: string;
	isMutation?: boolean;
}): void {
	if (input.rekeyFrom && input.targets?.includes('production')) {
		throw new Error(
			'IDENTITY_REKEY_UNSUPPORTED_TARGET: Identity rekey (--rekey-from) is not supported for Production. Use Local or Preview only.',
		);
	}

	if (input.targets && input.targets.includes('production') && input.isMutation !== false) {
		throw new Error(
			'PRODUCTION_PROMOTION_REQUIRED: Direct Production mutation via invitation:update is prohibited. Use pnpm invitation:promote for owner-only Production releases.',
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
	'--preview-provenance',
	'--asset-policy',
	'--update-scope',
	'--content-only',
	'--prune-assets',
	'--include-legacy',
	'--include-archived',
	'--include-demos',
	'--evidence',
	'--confirm-destructive',
	'--conflict-resolutions',
	'--field-selections',
	'--verbose',
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
					'--evidence',
					'--asset-policy',
					'--update-scope',
					'--conflict-resolutions',
					'--field-selections',
				].includes(arg)
			) {
				i++;
			}
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
		'invitation:update --status is local inventory only. Remote environments are not probed. Use pnpm dbs for cross-environment schema/content evidence.',
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
				'Legacy discovery is not performed by invitation:update --status without a configured local inventory probe.',
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
