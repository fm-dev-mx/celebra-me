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

const VALID_FLAGS = new Set([
	'--status',
	'--targets',
	'--slug',
	'--source-dir',
	'--dry-run',
	'--apply',
	'--non-interactive',
	'--json',
	'--technical',
	'--owner-user-id',
	'--package',
	'--approval-artifact',
	'--adoption-plan',
	'--adoption-apply',
	'--adoption-manifest',
	'--preview-provenance',
	'--asset-policy',
	'--update-scope',
	'--content-only',
	'--prune-assets',
	'--include-legacy',
	'--include-archived',
	'--include-demos',
	'--artifact',
	'--evidence',
	'--confirm-slug',
	'--confirm-scope',
	'--confirm-destructive',
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
					'--source-dir',
					'--owner-user-id',
					'--package',
					'--approval-artifact',
					'--adoption-manifest',
					'--artifact',
					'--evidence',
					'--confirm-slug',
					'--asset-policy',
					'--update-scope',
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

	const definitions = listInvitationDefinitions()
		.filter((definition) => !requestedSlug || definition.slug === requestedSlug)
		.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
		.map((definition) => {
			const envEntries = targets.map((target) => {
				const envInfo = {
					status: 'UNVERIFIED',
					reason: 'Fast target summaries require configured target credentials and are read-only.',
				};
				return [target, envInfo];
			});
			return {
				slug: definition.slug,
				title: definition.title,
				createdAt: definition.createdAt,
				classification: 'UNVERIFIED',
				environments: Object.fromEntries(envEntries),
			};
		});

	return {
		mode: 'status',
		filters: {
			slug: requestedSlug ?? null,
			targets,
			includeLegacy: opts.includeLegacy ?? false,
			includeArchived: opts.includeArchived ?? false,
			includeDemos: opts.includeDemos ?? false,
		},
		definitions,
		legacy: opts.includeLegacy
			? {
					status: 'UNVERIFIED',
					reason: 'Legacy discovery requires a configured target and is not available from definitions alone.',
				}
			: undefined,
	};
}
