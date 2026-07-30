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

	it('treats sharing-only projection changes as meaningful published drift', () => {
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
});
