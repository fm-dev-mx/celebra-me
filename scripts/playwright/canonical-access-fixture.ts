/**
 * Access-state fixtures for browser tests. The canonical fixture transport clones the
 * first published definition under these slugs: one unpaid (preview) and one disabled
 * by the administrator. Every other canonical invitation is served as paid.
 */
import { listInvitationDefinitions } from '../provision/invitations/registry.ts';

export const CANONICAL_ACCESS_FIXTURE_SLUGS = {
	unpaid: 'fixture-access-unpaid',
	disabled: 'fixture-access-disabled',
} as const;

/** Event type of the cloned definition, which the fixture routes share. */
export function resolveCanonicalAccessFixtureEventType(): string {
	const source = listInvitationDefinitions().find((item) => item.lifecycle === 'published');
	if (!source) throw new Error('No published definition to clone for access fixtures.');
	return source.eventType;
}
