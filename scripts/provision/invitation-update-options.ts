import { listInvitationDefinitions } from './invitations/registry.ts';

export type InvitationUpdateTarget = 'local' | 'preview' | 'production';

export function parseTargets(raw: string | undefined): InvitationUpdateTarget[] {
	if (!raw) return [];
	const values = raw === 'all' ? ['local', 'preview'] : raw.split(',');
	if (values.includes('local') && values.includes('production') && !values.includes('preview')) throw new Error('Local + Production is invalid: Preview approval is mandatory.');
	for (const target of values) if (!['local', 'preview', 'production'].includes(target)) throw new Error(`Unknown target "${target}".`);
	return values as InvitationUpdateTarget[];
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
	'--include-legacy',
	'--include-archived',
	'--include-demos',
	'--artifact',
	'--evidence',
	'--help',
	'-h',
]);

export function checkUnknownFlags(args: string[]): void {
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg.startsWith('-')) {
			if (!VALID_FLAGS.has(arg)) {
				throw new Error(`Opción no reconocida: "${arg}". Use --help para ver las opciones permitidas.`);
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

export function parseStatusOptions(input: string[] | StatusReportOptions): StatusReportOptions {
	if (!Array.isArray(input)) {
		return {
			slug: input.slug,
			targets: input.targets && input.targets.length > 0 ? input.targets : undefined,
			includeLegacy: Boolean(input.includeLegacy),
			includeArchived: Boolean(input.includeArchived),
			includeDemos: Boolean(input.includeDemos),
		};
	}
	const value = (flag: string): string | undefined => {
		const index = input.indexOf(flag);
		return index >= 0 ? input[index + 1] : undefined;
	};
	const rawTargets = value('--targets');
	const parsedTargets = parseTargets(rawTargets);
	return {
		slug: value('--slug'),
		targets: parsedTargets.length > 0 ? parsedTargets : undefined,
		includeLegacy: input.includes('--include-legacy'),
		includeArchived: input.includes('--include-archived'),
		includeDemos: input.includes('--include-demos'),
	};
}

export function buildStatusReport(input: string[] | StatusReportOptions): Record<string, unknown> {
	const opts = parseStatusOptions(input);
	const requestedSlug = opts.slug;
	const targets = opts.targets && opts.targets.length > 0 ? opts.targets : ['local', 'preview', 'production'];

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
			? { status: 'UNVERIFIED', reason: 'Legacy discovery requires a configured target and is not available from definitions alone.' }
			: undefined,
	};
}
