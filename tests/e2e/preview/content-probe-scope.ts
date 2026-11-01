import {
	isPreviewArchivedInvitation,
	type PostDeployEnvironment,
} from '../../../scripts/ops/post-deploy-smoke';

/**
 * Which public content cases `invitation-public-content.spec.ts` visits.
 *
 * - `all` (default): every visual page case at every viewport, for manual release checks.
 * - `event-types`: one case per event type at the first viewport, for the probe that runs after
 *   every Preview deploy. A real published invitation wins over a demo of the same event type.
 */
export type ContentProbeScope = 'all' | 'event-types';
export type ContentProbeEnvironment = PostDeployEnvironment;

export interface ContentProbeCase {
	kind: 'invitation' | 'demo';
	eventType: string;
	slug?: string;
}

export function resolveContentProbeScope(value: string | undefined): ContentProbeScope {
	const scope = value?.trim() || 'all';
	if (scope !== 'all' && scope !== 'event-types') {
		throw new Error('PREVIEW_CONTENT_PROBE must be "all" or "event-types".');
	}
	return scope;
}

export function selectContentProbeCases<Case extends ContentProbeCase, Viewport>(
	cases: readonly Case[],
	viewports: readonly Viewport[],
	scope: ContentProbeScope,
	environment: ContentProbeEnvironment = 'preview',
): { entry: Case; viewports: Viewport[] }[] {
	const filteredCases = cases.filter(
		(entry) =>
			environment !== 'preview' ||
			entry.kind !== 'invitation' ||
			!isPreviewArchivedInvitation(entry.eventType, entry.slug),
	);

	if (scope === 'all')
		return filteredCases.map((entry) => ({ entry, viewports: [...viewports] }));

	const byEventType = new Map<string, Case>();
	for (const entry of filteredCases) {
		const current = byEventType.get(entry.eventType);
		if (!current || (current.kind === 'demo' && entry.kind === 'invitation')) {
			byEventType.set(entry.eventType, entry);
		}
	}
	return [...byEventType.values()].map((entry) => ({ entry, viewports: viewports.slice(0, 1) }));
}
