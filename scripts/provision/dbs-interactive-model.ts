/** Pure selection model for the read-only dbs terminal navigator. */
import { isAuthoringPromotion } from '../../src/lib/status/promotion-lifecycle.ts';
import type {
	CanonicalPromotionRow,
	CanonicalStatusView,
	TargetEnv,
} from '../../src/lib/status/types.ts';
import type { MediaReferencesStatus } from '../../src/lib/status/media-reference-types.ts';

export type InvitationChoice = {
	slug: string;
	eventType: string;
	route: string;
	label: string;
};

export function buildInvitationChoices(
	view: CanonicalStatusView,
	media: MediaReferencesStatus,
): InvitationChoice[] {
	const pending = new Map<string, Omit<InvitationChoice, 'label'>>();
	for (const row of view.promotions) {
		if (isAuthoringPromotion(row)) continue;
		if (
			!(['local', 'preview', 'production'] as const).some(
				(env) =>
					row.envEvidence[env] === 'LIVE' && isConfirmedPending(row.environments[env]),
			)
		)
			continue;
		const route = `${row.eventType}/${row.slug}`;
		if (isSafeRoute(route))
			pending.set(route, { slug: row.slug, eventType: row.eventType, route });
	}
	for (const target of ['preview', 'production'] as const)
		for (const finding of media[target]?.findings ?? []) {
			if (!isSafeRoute(finding.route)) continue;
			const [eventType, slug] = finding.route.split('/');
			pending.set(finding.route, {
				eventType: eventType!,
				slug: slug!,
				route: finding.route,
			});
		}
	const slugCounts = new Map<string, number>();
	for (const choice of pending.values())
		slugCounts.set(choice.slug, (slugCounts.get(choice.slug) ?? 0) + 1);
	return [...pending.values()]
		.map((choice) => ({
			...choice,
			label:
				slugCounts.get(choice.slug)! > 1
					? `${choice.slug} (${choice.eventType})`
					: choice.slug,
		}))
		.sort((a, b) => a.label.localeCompare(b.label));
}

function isSafeRoute(route: string): boolean {
	return /^[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(route);
}

function isConfirmedPending(state: string): boolean {
	return state === 'behind' || state === 'absent' || state === 'diverged';
}

export type InvitationEnvironmentStatus =
	'UPDATE_PENDING' | 'MEDIA_REVIEW' | 'BOTH' | 'CURRENT' | 'UNVERIFIED';

function publicationUnverified(row: CanonicalPromotionRow | undefined, env: TargetEnv): boolean {
	return Boolean(
		row &&
		(row.envEvidence[env] !== 'LIVE' ||
			row.environments[env] === 'unknown' ||
			row.environments[env] === 'conflict'),
	);
}

export function invitationEnvironmentStatus(
	choice: InvitationChoice,
	env: TargetEnv,
	view: CanonicalStatusView,
	media: MediaReferencesStatus,
): InvitationEnvironmentStatus {
	const row = view.promotions.find(
		(promotion) => promotion.slug === choice.slug && promotion.eventType === choice.eventType,
	);
	const publicationPending =
		row &&
		!isAuthoringPromotion(row) &&
		row.envEvidence[env] === 'LIVE' &&
		isConfirmedPending(row.environments[env]);
	const mediaStatus = env === 'local' ? null : media[env];
	const mediaPending = Boolean(
		mediaStatus?.findings.some((finding) => finding.route === choice.route),
	);
	if (publicationPending && mediaPending) return 'BOTH';
	if (publicationPending) return 'UPDATE_PENDING';
	if (mediaPending) return 'MEDIA_REVIEW';
	if (
		view.environments[env].evidence !== 'LIVE' ||
		publicationUnverified(row, env) ||
		(env !== 'local' && (!mediaStatus || mediaStatus.status === 'UNVERIFIED'))
	)
		return 'UNVERIFIED';
	if (row?.environments[env] === 'match' || view.inSyncSlugs.includes(choice.slug))
		return 'CURRENT';
	return 'UNVERIFIED';
}

export function shouldOpenDbsMenu(args: readonly string[], isTTY: boolean): boolean {
	return isTTY && args.length === 0;
}
