/**
 * content-parity.test.ts — Semantic parity + RSVP/PII exclusion contract
 */

import { describe, expect, it } from '@jest/globals';
import {
	CONTENT_MIRROR_TABLES,
	CONTENT_PARITY_EXCLUDED_TABLES,
	buildSemanticInvitationSnapshot,
	compareAcrossEnvironments,
	compareSemanticInvitationSnapshots,
	isExcludedFromContentParity,
	listSemanticDifferencePaths,
} from '../../scripts/provision/content-parity.ts';
import { STORAGE_URL_PLACEHOLDER } from '../../scripts/provision/invitation-package.ts';

function clientSnapshot(
	overrides: Partial<ReturnType<typeof buildSemanticInvitationSnapshot>> = {},
) {
	const base = buildSemanticInvitationSnapshot({
		invitation: {
			slug: 'client-slug',
			event_type: 'xv',
			kind: 'client',
			base_demo_id: 'demo-xv-jewelry-box',
			theme_id: 'jewelry-box',
			snapshot: { title: 'Cliente' },
		},
		draftContent: { hero: { name: 'Ana' } },
		published: {
			content: {
				hero: { name: 'Ana' },
				image: `${STORAGE_URL_PLACEHOLDER}/client/hero.webp`,
			},
			is_demo: false,
		},
		assets: [{ managed_source_key: 'hero', sha256: 'abc123' }],
		event: { slug: 'client-slug', event_type: 'xv' },
	});
	return { ...base, ...overrides };
}

describe('content parity excluded scope', () => {
	it('excludes guest/claim/RSVP/PII tables by construction', () => {
		expect(CONTENT_PARITY_EXCLUDED_TABLES).toEqual(
			expect.arrayContaining([
				'guest_invitations',
				'guest_invitation_audit',
				'event_claim_codes',
				'intake_requests',
				'intake_submissions',
				'rsvp_records',
				'visitor_sessions',
				'commercial_analytics',
			]),
		);
		expect(isExcludedFromContentParity('guest_invitations')).toBe(true);
		expect(isExcludedFromContentParity('event_claim_codes.used_count')).toBe(true);
		expect(isExcludedFromContentParity('published_invitation_content')).toBe(false);
	});

	it('keeps mirror tables invitation-facing only and disjoint from excluded RSVP/PII', () => {
		expect([...CONTENT_MIRROR_TABLES]).toEqual([
			'invitations',
			'invitation_content_drafts',
			'published_invitation_content',
			'invitation_assets',
			'events',
		]);
		for (const table of CONTENT_MIRROR_TABLES) {
			expect(CONTENT_PARITY_EXCLUDED_TABLES).not.toContain(table);
		}
	});
});

describe('semantic parity comparison', () => {
	it('lists normalized semantic difference paths without returning values', () => {
		expect(
			listSemanticDifferencePaths(
				{ location: { ceremony: { venueEvent: 'A' } }, title: 'Igual' },
				{ location: { ceremony: { venueEvent: 'B' } }, title: 'Igual' },
			),
		).toEqual(['location.ceremony.venueEvent']);
	});

	it('omits uploaded src but reports distinct semantic asset keys', () => {
		expect(
			listSemanticDifferencePaths(
				{
					hero: {
						image: {
							type: 'uploaded',
							assetId: '__INVITATION_ASSET_KEY__:hero',
							src: 'https://local.test/a',
						},
					},
				},
				{
					hero: {
						image: {
							type: 'uploaded',
							assetId: '__INVITATION_ASSET_KEY__:hero',
							src: 'https://preview.test/b',
						},
					},
				},
			),
		).toEqual([]);
		expect(
			listSemanticDifferencePaths(
				{
					hero: {
						image: {
							type: 'uploaded',
							assetId: '__INVITATION_ASSET_KEY__:hero',
							src: 'https://local.test/a',
						},
					},
				},
				{
					hero: {
						image: {
							type: 'uploaded',
							assetId: '__INVITATION_ASSET_KEY__:hero-mobile',
							src: 'https://local.test/a',
						},
					},
				},
			),
		).toEqual(['hero.image']);
	});

	it('accepts legitimate Storage host differences via canonicalization', () => {
		const local = clientSnapshot({
			publishedContent: {
				hero: { name: 'Ana' },
				image: 'https://local.example/storage/v1/object/public/invitation-assets/client/hero.webp',
			},
		});
		const preview = clientSnapshot({
			publishedContent: {
				hero: { name: 'Ana' },
				image: 'https://preview.example/storage/v1/object/public/invitation-assets/client/hero.webp',
			},
		});

		const drifts = compareSemanticInvitationSnapshots('local', local, 'preview', preview);
		expect(drifts).toEqual([]);
	});

	it('detects meaningful published content drift with actionable entity/field', () => {
		const local = clientSnapshot();
		const production = clientSnapshot({
			publishedContent: { hero: { name: 'Different' } },
		});

		const result = compareAcrossEnvironments('client-slug', 'xv', {
			local,
			production,
		});

		expect(result.ok).toBe(false);
		expect(result.drifts).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					entity: 'published_invitation_content',
					field: 'content',
					environments: ['local', 'production'],
				}),
			]),
		);
	});

	it('does not treat host-owned share-message overlays as published semantic drift', () => {
		const local = clientSnapshot({
			publishedContent: {
				hero: { name: 'Ana' },
				sharing: { shareMessages: { invitation: 'Mensaje local' } },
			},
		});
		const production = clientSnapshot({
			publishedContent: {
				hero: { name: 'Ana' },
				sharing: { shareMessages: { invitation: 'Mensaje publicado' } },
			},
		});

		expect(
			compareSemanticInvitationSnapshots('local', local, 'production', production),
		).toEqual([]);
	});

	it('still fails when a material published field differs', () => {
		const local = clientSnapshot({
			publishedContent: {
				hero: { name: 'Ana' },
				sharing: { shareMessages: { invitation: 'Igual' } },
			},
		});
		const production = clientSnapshot({
			publishedContent: {
				hero: { name: 'Different' },
				sharing: { shareMessages: { invitation: 'Igual' } },
			},
		});

		expect(
			compareSemanticInvitationSnapshots('local', local, 'production', production),
		).toEqual([
			expect.objectContaining({
				entity: 'published_invitation_content',
				field: 'content',
			}),
		]);
	});

	it('requires environment-local events projection for non-demo clients', () => {
		const withEvent = clientSnapshot();
		const missingEvent = clientSnapshot({
			eventProjection: {
				slug: 'client-slug',
				eventType: 'xv',
				hasLinkedEvent: false,
			},
		});

		const drifts = compareSemanticInvitationSnapshots(
			'local',
			withEvent,
			'preview',
			missingEvent,
		);
		expect(drifts.some((d) => d.entity === 'events' && d.field === 'hasLinkedEvent')).toBe(
			true,
		);
	});

	it('treats demos as content-only and flags persistent events by default', () => {
		const demo = buildSemanticInvitationSnapshot({
			invitation: {
				slug: 'demo-xv-jewelry-box',
				event_type: 'xv',
				kind: 'demo',
				base_demo_id: 'demo-xv-jewelry-box',
				theme_id: 'jewelry-box',
				snapshot: {},
			},
			published: { content: { hero: { name: 'Demo' } }, is_demo: true },
			assets: [],
			event: null,
		});
		const demoWithEvent = {
			...demo,
			eventProjection: {
				slug: 'demo-xv-jewelry-box',
				eventType: 'xv',
				hasLinkedEvent: true,
			},
		};

		expect(compareSemanticInvitationSnapshots('local', demo, 'preview', { ...demo })).toEqual(
			[],
		);

		const drifts = compareSemanticInvitationSnapshots('local', demo, 'preview', demoWithEvent);
		expect(drifts.some((d) => d.entity === 'events')).toBe(true);
	});

	it('ignores environment identity that is not part of the semantic snapshot', () => {
		// Snapshots intentionally omit owner IDs / versions; compare stays clean.
		const a = clientSnapshot();
		const b = clientSnapshot();
		expect(compareSemanticInvitationSnapshots('local', a, 'production', b)).toEqual([]);
	});

	it('fails parity check and reports IDENTITY_CONFLICT when identity ambiguity exists', () => {
		const normal = clientSnapshot();
		const conflicted = clientSnapshot({
			identityConflict: true,
			matchingIds: ['id-1', 'id-2'],
		});

		const result = compareAcrossEnvironments('client-slug', 'xv', {
			local: conflicted,
			preview: normal,
		});

		expect(result.ok).toBe(false);
		expect(result.drifts).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					entity: 'invitation',
					field: 'identity',
				}),
			]),
		);
	});

	it('treats itinerary.presentation.behavior as equal to canonical itinerary.variant', () => {
		const local = clientSnapshot({
			publishedContent: {
				hero: { name: 'Ana' },
				itinerary: { variant: 'timeline-paper', items: [{ label: 'Cena' }] },
			},
		});
		const production = clientSnapshot({
			publishedContent: {
				hero: { name: 'Ana' },
				itinerary: {
					presentation: { behavior: 'timeline-paper' },
					items: [{ label: 'Cena' }],
				},
			},
		});
		expect(
			compareSemanticInvitationSnapshots('local', local, 'production', production),
		).toEqual([]);
	});

	it('fails when itinerary variants are materially different', () => {
		const local = clientSnapshot({
			publishedContent: {
				hero: { name: 'Ana' },
				itinerary: { variant: 'timeline-paper', items: [{ label: 'Cena' }] },
			},
		});
		const production = clientSnapshot({
			publishedContent: {
				hero: { name: 'Ana' },
				itinerary: { variant: 'standard', items: [{ label: 'Cena' }] },
			},
		});
		expect(
			compareSemanticInvitationSnapshots('local', local, 'production', production).some(
				(drift) => drift.entity === 'published_invitation_content',
			),
		).toBe(true);
	});

	it('compares uploaded refs by rewritten semantic key, not environment UUID or host', () => {
		const localId = '11111111-1111-4111-8111-111111111111';
		const productionId = '22222222-2222-4222-8222-222222222222';
		const local = buildSemanticInvitationSnapshot({
			invitation: {
				slug: 'client-slug',
				event_type: 'xv',
				kind: 'client',
				base_demo_id: 'demo-xv-jewelry-box',
				theme_id: 'jewelry-box',
				snapshot: { title: 'Cliente' },
			},
			draftContent: {
				hero: {
					name: 'Ana',
					image: {
						type: 'uploaded',
						assetId: localId,
						src: 'https://local.example/storage/v1/object/public/invitation-assets/hero.webp',
					},
				},
			},
			published: {
				content: {
					hero: {
						name: 'Ana',
						image: {
							type: 'uploaded',
							assetId: localId,
							src: 'https://local.example/storage/v1/object/public/invitation-assets/hero.webp',
						},
					},
				},
				is_demo: false,
			},
			assets: [{ id: localId, managed_source_key: 'hero', sha256: 'abc123' }],
			event: { slug: 'client-slug', event_type: 'xv' },
		});
		const production = buildSemanticInvitationSnapshot({
			invitation: {
				slug: 'client-slug',
				event_type: 'xv',
				kind: 'client',
				base_demo_id: 'demo-xv-jewelry-box',
				theme_id: 'jewelry-box',
				snapshot: { title: 'Cliente' },
			},
			draftContent: {
				hero: {
					name: 'Ana',
					image: {
						type: 'uploaded',
						assetId: productionId,
						src: 'https://res.cloudinary.com/demo/image/upload/v1/hero.webp',
					},
				},
			},
			published: {
				content: {
					hero: {
						name: 'Ana',
						image: {
							type: 'uploaded',
							assetId: productionId,
							src: 'https://res.cloudinary.com/demo/image/upload/v1/hero.webp',
						},
					},
				},
				is_demo: false,
			},
			assets: [{ id: productionId, managed_source_key: 'hero', sha256: 'abc123' }],
			event: { slug: 'client-slug', event_type: 'xv' },
		});
		expect(
			compareSemanticInvitationSnapshots('local', local, 'production', production),
		).toEqual([]);
	});

	it('fails when rewritten uploaded refs point at different managed keys', () => {
		const localId = '11111111-1111-4111-8111-111111111111';
		const productionId = '22222222-2222-4222-8222-222222222222';
		const local = buildSemanticInvitationSnapshot({
			invitation: {
				slug: 'client-slug',
				event_type: 'xv',
				kind: 'client',
				base_demo_id: 'demo-xv-jewelry-box',
				theme_id: 'jewelry-box',
				snapshot: { title: 'Cliente' },
			},
			published: {
				content: {
					hero: {
						image: { type: 'uploaded', assetId: localId, src: 'https://local.test/a' },
					},
				},
				is_demo: false,
			},
			assets: [{ id: localId, managed_source_key: 'hero', sha256: 'abc123' }],
			event: { slug: 'client-slug', event_type: 'xv' },
		});
		const production = buildSemanticInvitationSnapshot({
			invitation: {
				slug: 'client-slug',
				event_type: 'xv',
				kind: 'client',
				base_demo_id: 'demo-xv-jewelry-box',
				theme_id: 'jewelry-box',
				snapshot: { title: 'Cliente' },
			},
			published: {
				content: {
					hero: {
						image: {
							type: 'uploaded',
							assetId: productionId,
							src: 'https://prod.test/a',
						},
					},
				},
				is_demo: false,
			},
			assets: [{ id: productionId, managed_source_key: 'hero-mobile', sha256: 'abc123' }],
			event: { slug: 'client-slug', event_type: 'xv' },
		});
		expect(
			compareSemanticInvitationSnapshots('local', local, 'production', production).some(
				(drift) => drift.entity === 'published_invitation_content',
			),
		).toBe(true);
	});

	it('ignores unreferenced extra assets when referenced digests match', () => {
		const localId = '11111111-1111-4111-8111-111111111111';
		const previewHero = '22222222-2222-4222-8222-222222222222';
		const previewExtra = '33333333-3333-4333-8333-333333333333';
		const local = buildSemanticInvitationSnapshot({
			invitation: {
				slug: 'client-slug',
				event_type: 'xv',
				kind: 'client',
				base_demo_id: 'demo-xv-jewelry-box',
				theme_id: 'jewelry-box',
				snapshot: { title: 'Cliente' },
			},
			published: {
				content: {
					hero: {
						name: 'Ana',
						image: { type: 'uploaded', assetId: localId, src: 'https://local.test/a' },
					},
				},
				is_demo: false,
			},
			assets: [{ id: localId, managed_source_key: 'hero', sha256: 'abc123' }],
			event: { slug: 'client-slug', event_type: 'xv' },
		});
		const preview = buildSemanticInvitationSnapshot({
			invitation: {
				slug: 'client-slug',
				event_type: 'xv',
				kind: 'client',
				base_demo_id: 'demo-xv-jewelry-box',
				theme_id: 'jewelry-box',
				snapshot: { title: 'Cliente' },
			},
			published: {
				content: {
					hero: {
						name: 'Ana',
						image: {
							type: 'uploaded',
							assetId: previewHero,
							src: 'https://preview.test/a',
						},
					},
				},
				is_demo: false,
			},
			assets: [
				{ id: previewHero, managed_source_key: 'hero', sha256: 'abc123' },
				{ id: previewExtra, managed_source_key: 'gallery-02', sha256: 'deadbeef' },
			],
			event: { slug: 'client-slug', event_type: 'xv' },
		});
		expect(compareSemanticInvitationSnapshots('local', local, 'preview', preview)).toEqual([]);
	});

	it('treats managed uploaded refs as equal to hosted external URL strings', () => {
		const localId = '11111111-1111-4111-8111-111111111111';
		const local = buildSemanticInvitationSnapshot({
			invitation: {
				slug: 'client-slug',
				event_type: 'xv',
				kind: 'client',
				base_demo_id: 'demo-xv-jewelry-box',
				theme_id: 'jewelry-box',
				snapshot: { title: 'Cliente' },
			},
			draftContent: {
				hero: {
					name: 'Ana',
					image: {
						type: 'uploaded',
						assetId: localId,
						src: 'https://local.example/storage/v1/object/public/invitation-assets/hero.webp',
					},
				},
			},
			published: {
				content: {
					hero: {
						name: 'Ana',
						image: {
							type: 'uploaded',
							assetId: localId,
							src: 'https://local.example/storage/v1/object/public/invitation-assets/hero.webp',
						},
					},
				},
				is_demo: false,
			},
			assets: [{ id: localId, managed_source_key: 'hero', sha256: 'abc123' }],
			event: { slug: 'client-slug', event_type: 'xv' },
		});
		const hosted = buildSemanticInvitationSnapshot({
			invitation: {
				slug: 'client-slug',
				event_type: 'xv',
				kind: 'client',
				base_demo_id: 'demo-xv-jewelry-box',
				theme_id: 'jewelry-box',
				snapshot: { title: 'Cliente' },
			},
			draftContent: {
				hero: {
					name: 'Ana',
					image: 'https://res.cloudinary.com/demo/image/upload/v1/hero.webp',
				},
			},
			published: {
				content: {
					hero: {
						name: 'Ana',
						image: 'https://res.cloudinary.com/demo/image/upload/v1/hero.webp',
					},
				},
				is_demo: false,
			},
			assets: [],
			event: { slug: 'client-slug', event_type: 'xv' },
		});

		expect(compareSemanticInvitationSnapshots('local', local, 'preview', hosted)).toEqual([]);
		expect(compareSemanticInvitationSnapshots('local', local, 'production', hosted)).toEqual(
			[],
		);
	});

	it('treats managed uploaded refs as equal to content-only bare semantic key strings', () => {
		const localId = '11111111-1111-4111-8111-111111111111';
		const local = buildSemanticInvitationSnapshot({
			invitation: {
				slug: 'client-slug',
				event_type: 'xv',
				kind: 'client',
				base_demo_id: 'demo-xv-jewelry-box',
				theme_id: 'jewelry-box',
				snapshot: { title: 'Cliente' },
			},
			draftContent: {
				hero: {
					name: 'Ana',
					image: {
						type: 'uploaded',
						assetId: localId,
						src: 'https://local.example/storage/v1/object/public/invitation-assets/hero.webp',
					},
				},
			},
			published: {
				content: {
					hero: {
						name: 'Ana',
						image: {
							type: 'uploaded',
							assetId: localId,
							src: 'https://local.example/storage/v1/object/public/invitation-assets/hero.webp',
						},
					},
				},
				is_demo: false,
			},
			assets: [{ id: localId, managed_source_key: 'hero', sha256: 'abc123' }],
			event: { slug: 'client-slug', event_type: 'xv' },
		});
		const hosted = buildSemanticInvitationSnapshot({
			invitation: {
				slug: 'client-slug',
				event_type: 'xv',
				kind: 'client',
				base_demo_id: 'demo-xv-jewelry-box',
				theme_id: 'jewelry-box',
				snapshot: { title: 'Cliente' },
			},
			draftContent: { hero: { name: 'Ana', image: 'hero' } },
			published: {
				content: { hero: { name: 'Ana', image: 'hero' } },
				is_demo: false,
			},
			assets: [],
			event: { slug: 'client-slug', event_type: 'xv' },
		});

		expect(compareSemanticInvitationSnapshots('local', local, 'preview', hosted)).toEqual([]);
	});

	it('still fails when managed vs hosted content differs materially', () => {
		const localId = '11111111-1111-4111-8111-111111111111';
		const local = buildSemanticInvitationSnapshot({
			invitation: {
				slug: 'client-slug',
				event_type: 'xv',
				kind: 'client',
				base_demo_id: 'demo-xv-jewelry-box',
				theme_id: 'jewelry-box',
				snapshot: { title: 'Cliente' },
			},
			published: {
				content: {
					hero: {
						name: 'Ana',
						image: {
							type: 'uploaded',
							assetId: localId,
							src: 'https://local.example/storage/v1/object/public/invitation-assets/hero.webp',
						},
					},
				},
				is_demo: false,
			},
			assets: [{ id: localId, managed_source_key: 'hero', sha256: 'abc123' }],
			event: { slug: 'client-slug', event_type: 'xv' },
		});
		const hosted = buildSemanticInvitationSnapshot({
			invitation: {
				slug: 'client-slug',
				event_type: 'xv',
				kind: 'client',
				base_demo_id: 'demo-xv-jewelry-box',
				theme_id: 'jewelry-box',
				snapshot: { title: 'Cliente' },
			},
			published: {
				content: {
					hero: {
						name: 'Different',
						image: 'https://res.cloudinary.com/demo/image/upload/v1/hero.webp',
					},
				},
				is_demo: false,
			},
			assets: [],
			event: { slug: 'client-slug', event_type: 'xv' },
		});

		expect(
			compareSemanticInvitationSnapshots('local', local, 'production', hosted).some(
				(drift) => drift.entity === 'published_invitation_content',
			),
		).toBe(true);
	});
});
