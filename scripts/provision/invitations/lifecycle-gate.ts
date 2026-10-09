import type { InvitationDefinition } from './invitation-definition.ts';
import { listInvitationDefinitions } from './registry.ts';

export const LIFECYCLE_NOT_PUBLISHED = 'LIFECYCLE_NOT_PUBLISHED';

export type HostedReleaseTarget = 'preview' | 'production';

/**
 * Hosted targets only receive definitions whose lifecycle is `published`; Local stays open for
 * authoring. Returns the operator-facing block reason, or null when the definition is releasable
 * (or unknown to the registry, which later steps report on their own).
 */
export function lifecycleReleaseBlock(
	definition: Pick<InvitationDefinition, 'slug' | 'lifecycle'> | undefined,
	target: HostedReleaseTarget,
): string | null {
	if (!definition || definition.lifecycle === 'published') return null;
	const environment = target === 'production' ? 'Production' : 'Preview';
	return (
		`${LIFECYCLE_NOT_PUBLISHED}: la definición "${definition.slug}" sigue en authoring ` +
		`(lifecycle in_progress) y no se publica en ${environment}. Marque lifecycle: 'published' ` +
		`en su archivo de scripts/provision/invitations/, genere y acepte el candidato visual, ` +
		`integre en develop y vuelva a intentar. Local sigue disponible para authoring.`
	);
}

export function lifecycleReleaseBlockFor(slug: string, target: HostedReleaseTarget): string | null {
	const definition = listInvitationDefinitions().find((candidate) => candidate.slug === slug);
	return lifecycleReleaseBlock(definition, target);
}
