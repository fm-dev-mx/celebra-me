import { expect, previewEnvironment as preview, test } from './preview-test';
import {
	assertCanonicalPreviewFixture,
	assertExpectedPreviewAccountEmail,
	assertExpectedPreviewAccountRole,
	PREVIEW_FIXTURE_DEMO_ID,
	PREVIEW_FIXTURE_EVENT_TYPE,
	PREVIEW_FIXTURE_SLUG,
	PREVIEW_FIXTURE_TITLE,
	PreviewRequestWindowLimiter,
	selectCanonicalPreviewFixture,
} from '../../../scripts/playwright/preview-environment';
import { INVITATION_EDITOR_SECTION_KEYS } from '@/lib/intake/schemas/invitation-editor.schema';
import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import { applySectionValue, getSectionValue } from '@/lib/intake/services/section-content-mapper';
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

	const draftRateLimiter = new PreviewRequestWindowLimiter();
	await draftRateLimiter.beforeRequest();
	const demoContext = await readEditorContext(page, demos[0].id);
	await draftRateLimiter.beforeRequest();
	const fixtureContext = await readEditorContext(page, fixture.id);
	let fixtureContent = fixtureContext.content as DraftContent;
	let expectedDraftRevision =
		fixtureContext.draftUpdatedAt ?? fixtureContext.invitation.updatedAt;

	for (const section of INVITATION_EDITOR_SECTION_KEYS) {
		const demoValue = getSectionValue(demoContext.content as DraftContent, section);
		const fixtureValue = getSectionValue(fixtureContent, section);
		if (stableStringify(demoValue) === stableStringify(fixtureValue)) continue;

		await draftRateLimiter.beforeRequest();
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
		fixtureContent = applySectionValue(fixtureContent, section, demoValue);
	}

	await draftRateLimiter.beforeRequest();
	const baselinePreflight = await readPublicationPreflight(page, fixture.id);
	expect(Array.isArray(baselinePreflight.changedPaths)).toBe(true);
	expect(baselinePreflight.projectionHash).toMatch(/^[a-f0-9]{32}$/);

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
