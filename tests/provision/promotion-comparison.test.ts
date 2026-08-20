/**
 * promotion-comparison.test.ts — Divergence reporting regression coverage
 */

import { describe, expect, it } from '@jest/globals';
import {
	ACKNOWLEDGE_DISCARD_UNPUBLISHED_DRAFT_FLAG,
	checkTargetDivergenceConflict,
	isTargetDivergenceConflictMessage,
	semanticInvitationContentEqual,
	TARGET_DIVERGENCE_ACKNOWLEDGE_HINT,
} from '../../scripts/provision/promotion-comparison.ts';
import { hashPublicationProjection } from '../../src/lib/intake/services/publication-diff.service.ts';

describe('checkTargetDivergenceConflict', () => {
	const draftContent = { title: 'Draft title', copy: 'local edit' };
	const publishedContent = { title: 'Published title', copy: 'published' };
	const proposedContent = { title: 'Proposed title', copy: 'managed' };

	it('reports the published version number instead of none when version is present', () => {
		expect(() =>
			checkTargetDivergenceConflict(
				'abril-michelle-becerra-rea',
				proposedContent,
				{
					status: 'draft',
					updated_at: '2026-07-27T12:00:00.000Z',
					content: draftContent,
				},
				{
					version: 19,
					content: publishedContent,
				},
			),
		).toThrow(/target published version 19/);
	});

	it('never reports published version as none when an existing publication carries version', () => {
		try {
			checkTargetDivergenceConflict(
				'test-slug',
				proposedContent,
				{
					status: 'draft',
					updated_at: '2026-07-27T12:00:00.000Z',
					content: draftContent,
				},
				{
					version: 3,
					content: publishedContent,
				},
			);
			throw new Error('Expected divergence conflict');
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			expect(message).toContain('target published version 3');
			expect(message).not.toMatch(/target published version none/);
		}
	});

	it('includes package content hash separately from proposed merged-content hash', () => {
		const packageHash = hashPublicationProjection({ title: 'Package', copy: 'canonical' });
		const proposedHash = hashPublicationProjection(proposedContent);

		expect(() =>
			checkTargetDivergenceConflict(
				'test-slug',
				proposedContent,
				{
					status: 'draft',
					updated_at: '2026-07-27T12:00:00.000Z',
					content: draftContent,
				},
				{
					version: 2,
					content: publishedContent,
				},
				{
					packageContentHash: packageHash,
				},
			),
		).toThrow(
			new RegExp(
				`package content hash ${packageHash}; proposed merged-content hash ${proposedHash}`,
			),
		);
	});

	it('includes the acknowledgement flag in the conflict message', () => {
		expect(() =>
			checkTargetDivergenceConflict(
				'test-slug',
				proposedContent,
				{
					status: 'draft',
					updated_at: '2026-07-27T12:00:00.000Z',
					content: draftContent,
				},
				{
					version: 2,
					content: publishedContent,
				},
			),
		).toThrow(ACKNOWLEDGE_DISCARD_UNPUBLISHED_DRAFT_FLAG);
	});

	it('classifies the conflict message for TTY recovery', () => {
		try {
			checkTargetDivergenceConflict(
				'test-slug',
				proposedContent,
				{
					status: 'draft',
					updated_at: '2026-07-27T12:00:00.000Z',
					content: draftContent,
				},
				{
					version: 2,
					content: publishedContent,
				},
			);
			throw new Error('Expected divergence conflict');
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			expect(isTargetDivergenceConflictMessage(message)).toBe(true);
			expect(message).toContain(TARGET_DIVERGENCE_ACKNOWLEDGE_HINT);
		}
	});

	it('does not throw when unpublished draft discard is acknowledged', () => {
		expect(() =>
			checkTargetDivergenceConflict(
				'test-slug',
				proposedContent,
				{
					status: 'draft',
					updated_at: '2026-07-27T12:00:00.000Z',
					content: draftContent,
				},
				{
					version: 2,
					content: publishedContent,
				},
				{
					acknowledgeDiscardUnpublishedDraft: true,
				},
			),
		).not.toThrow();
	});
});

describe('canonicalizeManagedInvitationContent', () => {
	it('treats equivalent itinerary presentation spellings as equal', () => {
		expect(
			semanticInvitationContentEqual(
				{ itinerary: { variant: 'timeline-paper', items: [{ label: 'Cena' }] } },
				{
					itinerary: {
						presentation: { behavior: 'timeline-paper' },
						items: [{ label: 'Cena' }],
					},
				},
			),
		).toBe(true);
	});

	it('still distinguishes a materially different itinerary variant', () => {
		expect(
			semanticInvitationContentEqual(
				{ itinerary: { variant: 'timeline-paper', items: [{ label: 'Cena' }] } },
				{ itinerary: { variant: 'standard', items: [{ label: 'Cena' }] } },
			),
		).toBe(false);
	});

	it('strips host-owned share messages without hiding other sharing fields', () => {
		expect(
			semanticInvitationContentEqual(
				{
					sharing: {
						ogDescription: 'XV',
						shareMessages: { invitation: 'A' },
					},
				},
				{
					sharing: {
						ogDescription: 'XV',
						shareMessages: { invitation: 'B' },
					},
				},
			),
		).toBe(true);
		expect(
			semanticInvitationContentEqual(
				{ sharing: { ogDescription: 'Uno' } },
				{ sharing: { ogDescription: 'Dos' } },
			),
		).toBe(false);
	});

	it('equates managed uploaded refs with hosted external URL strings', () => {
		const localId = '11111111-1111-4111-8111-111111111111';
		expect(
			semanticInvitationContentEqual(
				{
					hero: {
						image: {
							type: 'uploaded',
							assetId: localId,
							src: 'https://local.example/storage/v1/object/public/invitation-assets/hero.webp',
						},
					},
				},
				{ hero: { image: 'https://res.cloudinary.com/demo/image/upload/v1/hero.webp' } },
				new Map([[localId, 'hero']]),
			),
		).toBe(true);
		expect(
			semanticInvitationContentEqual(
				{
					hero: {
						image: {
							type: 'uploaded',
							assetId: localId,
							src: 'https://local.example/storage/v1/object/public/invitation-assets/hero.webp',
						},
					},
				},
				{
					hero: {
						image: 'https://res.cloudinary.com/demo/image/upload/v1/portrait.webp',
					},
				},
				new Map([[localId, 'hero']]),
			),
		).toBe(false);
	});

	it('equates managed uploaded refs with content-only bare semantic key strings', () => {
		const localId = '11111111-1111-4111-8111-111111111111';
		expect(
			semanticInvitationContentEqual(
				{
					hero: {
						image: {
							type: 'uploaded',
							assetId: localId,
							src: 'https://local.example/storage/v1/object/public/invitation-assets/hero.webp',
						},
					},
				},
				{ hero: { image: 'hero' } },
				new Map([[localId, 'hero']]),
			),
		).toBe(true);
		expect(
			semanticInvitationContentEqual(
				{
					hero: {
						image: {
							type: 'uploaded',
							assetId: localId,
							src: 'https://local.example/storage/v1/object/public/invitation-assets/hero.webp',
						},
					},
				},
				{ hero: { image: 'hero-mobile' } },
				new Map([[localId, 'hero']]),
			),
		).toBe(false);
	});

	it('fails when content differs under managed vs external asset representations', () => {
		const localId = '11111111-1111-4111-8111-111111111111';
		expect(
			semanticInvitationContentEqual(
				{
					hero: {
						name: 'Ana',
						image: {
							type: 'uploaded',
							assetId: localId,
							src: 'https://local.example/storage/v1/object/public/invitation-assets/hero.webp',
						},
					},
				},
				{
					hero: {
						name: 'Different',
						image: 'https://res.cloudinary.com/demo/image/upload/v1/hero.webp',
					},
				},
				new Map([[localId, 'hero']]),
			),
		).toBe(false);
	});
});
