import { listInvitationDefinitions } from './invitations/registry.ts';

export type InvitationUpdateTarget = 'local' | 'preview' | 'production';

export function parseTargets(raw: string | undefined): InvitationUpdateTarget[] {
	if (!raw) return [];
	const values = raw === 'all' ? ['local', 'preview'] : raw.split(',');
	if (values.includes('local') && values.includes('production') && !values.includes('preview')) throw new Error('Local + Production is invalid: Preview approval is mandatory.');
	for (const target of values) if (!['local', 'preview', 'production'].includes(target)) throw new Error(`Unknown target "${target}".`);
	return values as InvitationUpdateTarget[];
}

export function buildStatusReport(args: string[]): Record<string, unknown> {
	const value = (flag: string): string | undefined => {
		const index = args.indexOf(flag);
		return index >= 0 ? args[index + 1] : undefined;
	};
	const requestedSlug = value('--slug');
	const statusTargets = parseTargets(value('--targets'));
	const targets = statusTargets.length > 0 ? statusTargets : ['local', 'preview', 'production'];
	const definitions = listInvitationDefinitions()
		.filter((definition) => !requestedSlug || definition.slug === requestedSlug)
		.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
		.map((definition) => ({
			slug: definition.slug, title: definition.title, createdAt: definition.createdAt, classification: 'UNVERIFIED',
			environments: Object.fromEntries(targets.map((target) => [target, { status: 'UNVERIFIED', reason: 'Fast target summaries require configured target credentials and are read-only.' }])),
		}));
	return { mode: 'status', filters: { slug: requestedSlug, targets, includeLegacy: args.includes('--include-legacy'), includeArchived: args.includes('--include-archived'), includeDemos: args.includes('--include-demos') }, definitions, legacy: args.includes('--include-legacy') ? { status: 'UNVERIFIED', reason: 'Legacy discovery requires a configured target and is not available from definitions alone.' } : undefined };
}
