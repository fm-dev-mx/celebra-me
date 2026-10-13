import type { InvitationPackageData } from '../../scripts/provision/invitation-package.ts';

/** Minimal client invitation package keyed by slug for Production apply tests. */
export function invitationPackageFixture(
	slug: string,
	hash = `hash-${slug}`,
): InvitationPackageData {
	return {
		schemaVersion: '1',
		packageHash: hash,
		sourceHash: `src-${slug}`,
		metadataHash: 'meta',
		projectionHash: 'proj',
		assetManifestHash: 'assets',
		definitionCreatedAt: '2026-08-12T00:00:00.000Z',
		sourceSlug: slug,
		invitation: {
			slug,
			managedIdentityId: `identity-${slug}`,
			previousSlugs: [],
			title: slug,
			eventType: 'boda',
			themeId: 'theme',
			kind: 'client',
			clientName: 'Test Client',
			hostLoginAlias: 'test-client',
			clientEmail: 'test@example.com',
			clientWhatsapp: '0000000000',
			photosReceived: false,
		},
		draft: { status: 'draft', content: {} },
		publishedContent: { content: {} },
		event: { title: slug, eventType: 'boda', status: 'published' },
		assets: [],
	};
}
