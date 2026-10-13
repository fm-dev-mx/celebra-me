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

/** Invitation ids of the clones (distinct from the source so access lookups stay exact). */
export const CANONICAL_ACCESS_FIXTURE_IDS = {
	unpaid: 'acce55e0-0000-4000-8000-000000000001',
	disabled: 'acce55e0-0000-4000-8000-000000000002',
} as const;

type AccessFixtureState = {
	paymentStatus: 'paid' | 'unpaid';
	publicAccess: 'enabled' | 'disabled';
};

/** Access state served for an invitation id; every canonical invitation is paid. */
export function canonicalAccessStateFor(invitationId: string): AccessFixtureState {
	if (invitationId === CANONICAL_ACCESS_FIXTURE_IDS.unpaid) {
		return { paymentStatus: 'unpaid', publicAccess: 'enabled' };
	}
	if (invitationId === CANONICAL_ACCESS_FIXTURE_IDS.disabled) {
		return { paymentStatus: 'paid', publicAccess: 'disabled' };
	}
	return { paymentStatus: 'paid', publicAccess: 'enabled' };
}

/** The cloned definition (served as paid under its own slug). */
export function resolveCanonicalAccessFixtureSource(): { slug: string; eventType: string } {
	const source = listInvitationDefinitions().find((item) => item.lifecycle === 'published');
	if (!source) throw new Error('No published definition to clone for access fixtures.');
	return { slug: source.slug, eventType: source.eventType };
}

/** Event type of the cloned definition, which the fixture routes share. */
export function resolveCanonicalAccessFixtureEventType(): string {
	return resolveCanonicalAccessFixtureSource().eventType;
}
