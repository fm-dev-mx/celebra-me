import { randomUUID } from 'node:crypto';
import { expect, previewEnvironment as preview, test } from './preview-test';
import {
	assertCanonicalPreviewFixture,
	assertExpectedPreviewAccountEmail,
	assertExpectedPreviewAccountRole,
	assertPreviewPublicationTarget,
	PREVIEW_FIXTURE_DEMO_ID,
	PREVIEW_FIXTURE_EVENT_TYPE,
	PREVIEW_FIXTURE_SLUG,
	PREVIEW_FIXTURE_TITLE,
	selectCanonicalPreviewFixture,
} from '../../../scripts/playwright/preview-environment';
import { INVITATION_EDITOR_SECTION_KEYS } from '@/lib/intake/schemas/invitation-editor.schema';
import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import { getSectionValue } from '@/lib/intake/services/section-content-mapper';
import { stableStringify } from '@/lib/content-publication/normalize-content';
import {
	loginAsPreviewAdmin,
	mutateJson,
	readEditorContext,
	readInvitationList,
	readPublicationPreflight,
	readSessionIdentity,
	type InvitationSummary,
} from './support';

test('provisions or verifies the deterministic Preview-only publication fixture', async ({
	page,
}) => {
	await loginAsPreviewAdmin(page, preview);
	const session = await readSessionIdentity(page);
	assertExpectedPreviewAccountEmail(session.email);
	assertExpectedPreviewAccountRole(session.role);

	const inventory = await readInvitationList(page);

	const demos = inventory.filter(
		(item) =>
			item.kind === 'demo' &&
			item.slug === PREVIEW_FIXTURE_DEMO_ID &&
			item.baseDemoId === PREVIEW_FIXTURE_DEMO_ID,
	);
	expect(demos).toHaveLength(1);

	let fixture = selectCanonicalPreviewFixture(inventory) as InvitationSummary | undefined;
	if (!fixture) {
		const created = await mutateJson<{ item: InvitationSummary }>(
			page,
			'/api/dashboard/intake',
			'POST',
			{
				title: PREVIEW_FIXTURE_TITLE,
				slug: PREVIEW_FIXTURE_SLUG,
				eventType: PREVIEW_FIXTURE_EVENT_TYPE,
				baseDemoId: PREVIEW_FIXTURE_DEMO_ID,
				clientName: '',
				clientEmail: '',
				clientWhatsapp: '',
			},
			'Synthetic fixture creation',
		);
		fixture = created.item;
	}
	assertCanonicalPreviewFixture(fixture, session.userId);

	const demoContext = await readEditorContext(page, demos[0].id);
	let fixtureContext = await readEditorContext(page, fixture.id);
	let expectedDraftRevision =
		fixtureContext.draftUpdatedAt ?? fixtureContext.invitation.updatedAt;

	for (const section of INVITATION_EDITOR_SECTION_KEYS) {
		const demoValue = getSectionValue(demoContext.content as DraftContent, section);
		const fixtureValue = getSectionValue(fixtureContext.content as DraftContent, section);
		if (stableStringify(demoValue) === stableStringify(fixtureValue)) continue;

		const saved = await mutateJson<{ draftUpdatedAt: string }>(
			page,
			`/api/dashboard/intake/${encodeURIComponent(fixture.id)}/editor/sections/${section}`,
			'PATCH',
			{
				expectedUpdatedAt: expectedDraftRevision,
				value: demoValue as Record<string, unknown>,
			},
			`Synthetic fixture ${section} reconciliation`,
		);
		expectedDraftRevision = saved.draftUpdatedAt;
		fixtureContext = await readEditorContext(page, fixture.id);
	}

	const baselinePreflight = await readPublicationPreflight(page, fixture.id);
	expect(Array.isArray(baselinePreflight.changedPaths)).toBe(true);
	expect(baselinePreflight.projectionHash).toMatch(/^[a-f0-9]{32}$/);

	if (preview.allowPublication) {
		if (preview.fixtureId) {
			assertPreviewPublicationTarget({
				configuredFixtureId: preview.fixtureId,
				targetInvitationId: fixture.id,
				targetSlug: fixture.slug,
			});
		}
		if (
			!fixtureContext.publication.hasPublishedContent ||
			baselinePreflight.changedPaths.length > 0
		) {
			await mutateJson(
				page,
				`/api/dashboard/intake/${encodeURIComponent(fixture.id)}/editor/publish`,
				'POST',
				{ ...baselinePreflight, idempotencyKey: randomUUID() },
				'Synthetic fixture baseline publication',
			);
		}

		const verifiedContext = await readEditorContext(page, fixture.id);
		expect(verifiedContext.publication.hasPublishedContent).toBe(true);
		expect(verifiedContext.publication.hasUnpublishedChanges).toBe(false);
		const verifiedPreflight = await readPublicationPreflight(page, fixture.id);
		expect(verifiedPreflight.changedPaths).toEqual([]);

		const publicResponse = await page.request.get(
			`/${PREVIEW_FIXTURE_EVENT_TYPE}/${PREVIEW_FIXTURE_SLUG}`,
		);
		expect(publicResponse.status()).toBe(200);
	} else {
		console.info(
			'Baseline publication skipped. Set PLAYWRIGHT_ALLOW_PREVIEW_PUBLICATION=true for a separate opt-in publish.',
		);
	}

	const detailResponse = await page.request.get(
		`/api/dashboard/intake/${encodeURIComponent(fixture.id)}`,
	);
	expect(detailResponse.status()).toBe(200);
	const detail = (await detailResponse.json()) as {
		request: unknown;
		submission: unknown;
		rsvpEvent: null | { guestCount: number; claimCodeCount: number };
	};
	expect(detail.request).toBeNull();
	expect(detail.submission).toBeNull();
	if (detail.rsvpEvent) {
		expect(detail.rsvpEvent.guestCount).toBe(0);
		expect(detail.rsvpEvent.claimCodeCount).toBe(0);
	}

	const reconciledInventory = await readInvitationList(page);
	const secondPass = selectCanonicalPreviewFixture(reconciledInventory);
	expect(secondPass?.id).toBe(fixture.id);

	console.info(`Preview fixture ready. Set PLAYWRIGHT_PREVIEW_INVITATION_ID=${fixture.id}`);
});
